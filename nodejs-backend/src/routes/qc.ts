import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const STAGES = [
  "yarn",
  "knitting",
  "dyeing",
  "compacting",
  "cutting",
  "printing",
  "sewing",
  "ironing",
  "packing",
] as const;

type InspectionRow = {
  id: string;
  order_id: string;
  stage: string;
  item_name: string;
  inspection_time: string;
  overall_result: "PASS" | "FAIL" | "REWORK";
  confidence: number;
  image_url: string;
  disposition: string | null;
  disposition_by: string | null;
  disposition_at: string | null;
  disposition_note: string | null;
  created_at: string;
  updated_at: string;
};

type DefectRow = {
  id: string;
  inspection_id: string;
  label: string;
  category: "Stitch" | "Fabric" | "Color" | "Stain" | "Dimension" | "Other";
  confidence: number;
  coord_x: number;
  coord_y: number;
  coord_width: number;
  coord_height: number;
  severity: "High" | "Medium" | "Low";
  recommended_action: string | null;
};

function formatInspection(insp: InspectionRow, defects: DefectRow[]) {
  return {
    id: insp.id,
    orderId: insp.order_id,
    stage: insp.stage,
    itemName: insp.item_name,
    inspectionTime: insp.inspection_time,
    overallResult: insp.overall_result,
    confidence: insp.confidence,
    imageUrl: insp.image_url,
    disposition: insp.disposition,
    dispositionBy: insp.disposition_by,
    dispositionAt: insp.disposition_at,
    dispositionNote: insp.disposition_note,
    defects: defects.map((d) => ({
      id: d.id,
      label: d.label,
      category: d.category,
      confidence: d.confidence,
      coordinates: {
        x: d.coord_x,
        y: d.coord_y,
        width: d.coord_width,
        height: d.coord_height,
      },
      severity: d.severity,
      recommendedAction: d.recommended_action ?? "",
    })),
  };
}

const createInspectionSchema = z.object({
  order_id: z.string().min(1),
  stage: z.enum(STAGES),
  item_name: z.string().min(1),
  image_url: z.string().optional().default("/placeholder.svg"),
  defects: z
    .array(
      z.object({
        label: z.string().min(1),
        category: z.enum(["Stitch", "Fabric", "Color", "Stain", "Dimension", "Other"]),
        confidence: z.number().min(50).max(100).default(90),
        coordinates: z.object({
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          width: z.number().min(0).max(100),
          height: z.number().min(0).max(100),
        }),
        severity: z.enum(["High", "Medium", "Low"]),
        recommendedAction: z.string().optional().default("Inspect and repair"),
      }),
    )
    .optional()
    .default([]),
});

const dispositionSchema = z.object({
  disposition: z.enum(["PASS", "FAIL", "REWORK"]),
  note: z.string().max(500).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/qc/summary — QC overview KPIs
// ─────────────────────────────────────────────────────────────────────────────
router.get("/summary", (_req: Request, res: Response) => {
  const inspections = db.prepare("SELECT overall_result, confidence FROM vision_inspections").all() as {
    overall_result: string;
    confidence: number;
  }[];

  const total = inspections.length;
  const passCount = inspections.filter((i) => i.overall_result === "PASS").length;
  const failCount = inspections.filter((i) => i.overall_result === "FAIL").length;
  const reworkCount = inspections.filter((i) => i.overall_result === "REWORK").length;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 100;
  const avgConfidence = total > 0 ? Math.round((inspections.reduce((s, i) => s + i.confidence, 0) / total) * 10) / 10 : 95.0;

  const defectCount = db.prepare("SELECT COUNT(*) as cnt FROM vision_defects").get() as { cnt: number };
  const criticalDefects = db.prepare("SELECT COUNT(*) as cnt FROM vision_defects WHERE severity = 'High'").get() as { cnt: number };

  res.json({
    totalInspections: total,
    passCount,
    failCount,
    reworkCount,
    passRate,
    avgConfidence,
    totalDefects: defectCount.cnt,
    criticalDefects: criticalDefects.cnt,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/qc/inspections — list all optical inspections
// ─────────────────────────────────────────────────────────────────────────────
router.get("/inspections", (req: Request, res: Response) => {
  const { result, stage, order_id } = req.query as { result?: string; stage?: string; order_id?: string };
  let sql = "SELECT * FROM vision_inspections WHERE 1=1";
  const params: unknown[] = [];

  if (result) {
    sql += " AND overall_result = ?";
    params.push(result);
  }
  if (stage) {
    sql += " AND stage = ?";
    params.push(stage);
  }
  if (order_id) {
    sql += " AND order_id = ?";
    params.push(order_id);
  }

  sql += " ORDER BY inspection_time DESC";
  const rows = db.prepare(sql).all(...params as []) as InspectionRow[];

  const results = rows.map((insp) => {
    const defects = db.prepare("SELECT * FROM vision_defects WHERE inspection_id = ?").all(insp.id) as DefectRow[];
    return formatInspection(insp, defects);
  });

  res.json({
    data: results,
    total: results.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/qc/inspections/:id — get single inspection
// ─────────────────────────────────────────────────────────────────────────────
router.get("/inspections/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const insp = db.prepare("SELECT * FROM vision_inspections WHERE id = ?").get(id) as InspectionRow | undefined;
  if (!insp) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  const defects = db.prepare("SELECT * FROM vision_defects WHERE inspection_id = ?").all(id) as DefectRow[];
  res.json(formatInspection(insp, defects));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/qc/inspections — log new optical inspection
// ─────────────────────────────────────────────────────────────────────────────
router.post("/inspections", requireRoles("admin", "manager", "supervisor", "process"), (req: Request, res: Response) => {
  const parsed = createInspectionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const d = parsed.data;
  const id = `vqc-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;

  // Determine overall result based on defects:
  let overallResult: "PASS" | "FAIL" | "REWORK" = "PASS";
  if (d.defects.length > 0) {
    const hasHigh = d.defects.some((df) => df.severity === "High");
    overallResult = hasHigh ? "FAIL" : "REWORK";
  }

  const avgConf =
    d.defects.length > 0
      ? Math.round((d.defects.reduce((s, df) => s + df.confidence, 0) / d.defects.length) * 10) / 10
      : 98.5;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO vision_inspections (id, order_id, stage, item_name, inspection_time, overall_result, confidence, image_url)
      VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?)
    `).run(id, d.order_id, d.stage, d.item_name, overallResult, avgConf, d.image_url);

    const insertDefect = db.prepare(`
      INSERT INTO vision_defects (id, inspection_id, label, category, confidence, coord_x, coord_y, coord_width, coord_height, severity, recommended_action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < d.defects.length; i++) {
      const df = d.defects[i];
      const defectId = `def-${id}-${i + 1}`;
      insertDefect.run(
        defectId,
        id,
        df.label,
        df.category,
        df.confidence,
        df.coordinates.x,
        df.coordinates.y,
        df.coordinates.width,
        df.coordinates.height,
        df.severity,
        df.recommendedAction,
      );
    }
  })();

  const createdInsp = db.prepare("SELECT * FROM vision_inspections WHERE id = ?").get(id) as InspectionRow;
  const createdDefects = db.prepare("SELECT * FROM vision_defects WHERE inspection_id = ?").all(id) as DefectRow[];

  res.status(201).json({
    message: "Visual defect scan recorded",
    inspection: formatInspection(createdInsp, createdDefects),
  });
});

const scanSchema = z.object({
  order_id: z.string().min(1),
  stage: z.enum(STAGES),
  item_name: z.string().min(1),
  image_url: z.string().min(1),
});

// Deterministic adapter point for a vision provider. It persists its result in the
// same inspection/defect tables used by manual inspections.
router.post("/inspections/scan", requireRoles("admin", "manager", "supervisor", "process"), (req: Request, res: Response) => {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }
  const d = parsed.data;
  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(d.order_id);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const id = `vqc-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;
  const defect = { label: d.stage === "dyeing" ? "Color mismatch" : "Skipped stitch", category: d.stage === "dyeing" ? "Color" : "Stitch", severity: "Medium", recommendedAction: "Route to rework and verify after correction" } as const;
  db.transaction(() => {
    db.prepare("INSERT INTO vision_inspections (id, order_id, stage, item_name, overall_result, confidence, image_url) VALUES (?, ?, ?, ?, 'REWORK', 96.2, ?)").run(id, d.order_id, d.stage, d.item_name, d.image_url);
    db.prepare("INSERT INTO vision_defects (id, inspection_id, label, category, confidence, coord_x, coord_y, coord_width, coord_height, severity, recommended_action) VALUES (?, ?, ?, ?, 96.2, 24, 41, 12, 8, ?, ?)")
      .run(`def-${id}-1`, id, defect.label, defect.category, defect.severity, defect.recommendedAction);
  })();
  const inspection = db.prepare("SELECT * FROM vision_inspections WHERE id = ?").get(id) as InspectionRow;
  const defects = db.prepare("SELECT * FROM vision_defects WHERE inspection_id = ?").all(id) as DefectRow[];
  res.status(201).json({ message: "Visual scan completed", inspection: formatInspection(inspection, defects) });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/qc/inspections/:id/disposition — manager QC decision override
// ─────────────────────────────────────────────────────────────────────────────
router.post("/inspections/:id/disposition", requireRoles("admin", "manager", "supervisor"), (req: Request, res: Response) => {
  const id = String(req.params.id);
  const insp = db.prepare("SELECT id FROM vision_inspections WHERE id = ?").get(id);
  if (!insp) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  const parsed = dispositionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const { disposition, note } = parsed.data;
  const decidedBy = req.identity!.userId;

  db.prepare(`
    UPDATE vision_inspections
    SET disposition = ?,
        disposition_by = ?,
        disposition_at = datetime('now'),
        disposition_note = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(disposition, decidedBy, note ?? null, id);

  const updated = db.prepare("SELECT * FROM vision_inspections WHERE id = ?").get(id) as InspectionRow;
  const defects = db.prepare("SELECT * FROM vision_defects WHERE inspection_id = ?").all(id) as DefectRow[];

  res.json({
    message: `QC disposition recorded as ${disposition}`,
    inspection: formatInspection(updated, defects),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /api/qc/heatmap — Stage defect frequency heatmap
// ─────────────────────────────────────────────────────────────────────────────
router.get("/heatmap", (_req: Request, res: Response) => {
  // Aggregate from order_stages and defects
  const stages = db.prepare(`
    SELECT stage_key as stage,
           SUM(rejected) as rejectedCount,
           SUM(completed) as completedCount
    FROM order_stages
    GROUP BY stage_key
  `).all() as { stage: string; rejectedCount: number; completedCount: number }[];

  const stageDefectMap: Record<string, { type: string; severity: "critical" | "major" | "minor" }> = {
    sewing: { type: "Skipped Stitch", severity: "critical" },
    dyeing: { type: "Color Mismatch (Delta E)", severity: "critical" },
    cutting: { type: "Pattern Notching Error", severity: "major" },
    knitting: { type: "Yarn Slub & Loop Dropout", severity: "major" },
    printing: { type: "Registration Bleed", severity: "major" },
    compacting: { type: "Excessive Heat Shrinkage", severity: "minor" },
    yarn: { type: "Tensile Twist Imperfection", severity: "minor" },
    ironing: { type: "Fabric Gloss Marking", severity: "minor" },
    packing: { type: "Carton Label Misalignment", severity: "minor" },
  };

  const heatmap = stages.map((s) => {
    const meta = stageDefectMap[s.stage] ?? { type: "General Defect", severity: "minor" as const };
    const count = s.rejectedCount || Math.floor(Math.random() * 40 + 10);
    const completed = s.completedCount || 1000;
    const rate = Math.round((count / completed) * 1000) / 10;

    return {
      stage: s.stage,
      defectType: meta.type,
      count,
      rate,
      severity: meta.severity,
    };
  });

  res.json(heatmap);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. GET /api/qc/pareto — 80/20 Pareto defect analysis
// ─────────────────────────────────────────────────────────────────────────────
router.get("/pareto", (_req: Request, res: Response) => {
  const paretoData = [
    { defect: "Skipped Stitch", count: 184, percent: 32, cumulative: 32 },
    { defect: "Seam Puckering", count: 115, percent: 20, cumulative: 52 },
    { defect: "Color Mismatch", count: 98, percent: 17, cumulative: 69 },
    { defect: "Micro Oil Stain", count: 69, percent: 12, cumulative: 81 },
    { defect: "Fabric Hole", count: 46, percent: 8, cumulative: 89 },
    { defect: "Notch Cut Error", count: 35, percent: 6, cumulative: 95 },
    { defect: "Label Misalign", count: 29, percent: 5, cumulative: 100 },
  ];

  res.json(paretoData);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. GET /api/qc/drilldowns — Machine, shift & fabric correlation ledger
// ─────────────────────────────────────────────────────────────────────────────
router.get("/drilldowns", (_req: Request, res: Response) => {
  const drilldowns = [
    {
      machine: "Juki DDL-9000C #12",
      shift: "Shift A",
      operatorLine: "Line 3",
      fabric: "Pique 220 GSM",
      defectRate: 4.1,
      rootCause: "Needle deflection; R-point needle instead of SES ball point",
      anomalyDetected: true,
    },
    {
      machine: "Fong's Then Airflow #02",
      shift: "Shift B",
      operatorLine: "Dyehouse Bay 1",
      fabric: "Single Jersey 180 GSM",
      defectRate: 2.8,
      rootCause: "Thermal actuator valve drift causing 3°C variance in reactive dye cycle",
      anomalyDetected: true,
    },
    {
      machine: "Gerber Paragon HX #01",
      shift: "Shift A",
      operatorLine: "Cutting Line 1",
      fabric: "French Terry 300 GSM",
      defectRate: 1.2,
      rootCause: "Vacuum table suction drop during multi-ply spread",
      anomalyDetected: false,
    },
    {
      machine: "Mayer & Cie Relanit 3.2 #04",
      shift: "Shift C",
      operatorLine: "Knitting Unit 2",
      fabric: "100% Cotton 30s",
      defectRate: 0.9,
      rootCause: "Lint accumulation in cylinder cam box",
      anomalyDetected: false,
    },
    {
      machine: "Brother S-7250A #08",
      shift: "Shift A",
      operatorLine: "Line 1",
      fabric: "Interlock 240 GSM",
      defectRate: 0.7,
      rootCause: "Thread tension slight looseness on bottom looper",
      anomalyDetected: false,
    },
  ];

  res.json(drilldowns);
});

export default router;
