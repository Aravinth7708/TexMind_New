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

type DocRow = {
  id: string;
  filename: string;
  type: string;
  uploaded_at: string;
  confidence_score: number;
  status: string;
  buyer_name: string;
  po_number: string;
  style_code: string;
  product_name: string;
  fabric: string;
  gsm: number;
  total_quantity: number;
  delivery_date: string;
  size_breakdown: string;
  colorways: string;
  special_instructions: string | null;
  created_order_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function formatDoc(row: DocRow) {
  let sizeBreakdown = [];
  let colorways = [];
  try {
    sizeBreakdown = JSON.parse(row.size_breakdown);
  } catch {
    sizeBreakdown = [];
  }
  try {
    colorways = JSON.parse(row.colorways);
  } catch {
    colorways = [];
  }

  return {
    id: row.id,
    filename: row.filename,
    type: row.type,
    uploadedAt: row.uploaded_at,
    confidenceScore: row.confidence_score,
    status: row.status,
    createdOrderId: row.created_order_id,
    extractedFields: {
      buyerName: row.buyer_name,
      poNumber: row.po_number,
      styleCode: row.style_code,
      productName: row.product_name,
      fabric: row.fabric,
      gsm: row.gsm,
      totalQuantity: row.total_quantity,
      deliveryDate: row.delivery_date,
      sizeBreakdown,
      colorways,
      specialInstructions: row.special_instructions ?? "",
    },
  };
}

const ingestSchema = z.object({
  filename: z.string().min(1).max(255),
  type: z.enum(["Tech-Pack", "Purchase Order (PO)", "Goods Receipt Note (GRN)"]).default("Tech-Pack"),
  buyer_name: z.string().optional().default(""),
  po_number: z.string().optional().default("PO-9280"),
  style_code: z.string().optional().default("STY-505"),
  product_name: z.string().optional().default("Crew Neck Sweatshirt"),
  fabric: z.string().optional().default("100% Combed Cotton Fleece 300 GSM"),
  gsm: z.number().int().min(50).max(1000).optional().default(300),
  total_quantity: z.number().int().min(1).optional().default(5000),
  delivery_date: z.string().optional().default("25 Oct 2026"),
  size_breakdown: z.array(z.object({ size: z.string(), quantity: z.number().int() })).optional().default([
    { size: "S", quantity: 1000 },
    { size: "M", quantity: 2000 },
    { size: "L", quantity: 1500 },
    { size: "XL", quantity: 500 },
  ]),
  colorways: z.array(z.object({ color: z.string(), qty: z.number().int() })).optional().default([
    { color: "Black Heather", qty: 3000 },
    { color: "Forest Green", qty: 2000 },
  ]),
  special_instructions: z.string().optional().default("Double needle cover-stitch on neck and hem. AQL 1.5 pass."),
});

const updateFieldsSchema = z.object({
  buyerName: z.string().min(1).optional(),
  poNumber: z.string().min(1).optional(),
  styleCode: z.string().min(1).optional(),
  productName: z.string().min(1).optional(),
  fabric: z.string().min(1).optional(),
  gsm: z.number().int().min(50).max(1000).optional(),
  totalQuantity: z.number().int().min(1).optional(),
  deliveryDate: z.string().min(1).optional(),
  specialInstructions: z.string().optional(),
  sizeBreakdown: z.array(z.object({ size: z.string(), quantity: z.number().int() })).optional(),
  colorways: z.array(z.object({ color: z.string(), qty: z.number().int() })).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/documents — list all ingested documents
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", (req: Request, res: Response) => {
  const { status, type } = req.query as { status?: string; type?: string };
  let sql = "SELECT * FROM documents WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " ORDER BY created_at DESC";
  const rows = db.prepare(sql).all(...params as []) as DocRow[];

  res.json({
    data: rows.map(formatDoc),
    total: rows.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/documents/:id — get single document
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(formatDoc(row));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/documents/ingest — upload & simulate AI extraction
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ingest", requireRoles("admin", "manager", "supervisor"), (req: Request, res: Response) => {
  const parsed = ingestSchema.safeParse({
    ...req.body,
    buyer_name: req.body?.buyer_name ?? req.body?.buyerName,
    po_number: req.body?.po_number ?? req.body?.poNumber,
    style_code: req.body?.style_code ?? req.body?.styleCode,
    product_name: req.body?.product_name ?? req.body?.productName,
    total_quantity: req.body?.total_quantity ?? req.body?.totalQuantity,
    delivery_date: req.body?.delivery_date ?? req.body?.deliveryDate,
    size_breakdown: req.body?.size_breakdown ?? req.body?.sizeBreakdown,
    special_instructions: req.body?.special_instructions ?? req.body?.specialInstructions,
  });
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const d = parsed.data;
  const id = `doc-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;
  const confidence = Math.round((93.5 + Math.random() * 5.0) * 10) / 10; // 93.5 - 98.5% confidence
  const createdBy = req.identity!.userId;

  db.prepare(`
    INSERT INTO documents (
      id, filename, type, confidence_score, status,
      buyer_name, po_number, style_code, product_name, fabric, gsm,
      total_quantity, delivery_date, size_breakdown, colorways, special_instructions, created_by
    ) VALUES (?, ?, ?, ?, 'Needs Review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    d.filename,
    d.type,
    confidence,
    d.buyer_name,
    d.po_number,
    d.style_code,
    d.product_name,
    d.fabric,
    d.gsm,
    d.total_quantity,
    d.delivery_date,
    JSON.stringify(d.size_breakdown),
    JSON.stringify(d.colorways),
    d.special_instructions,
    createdBy,
  );

  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocRow;
  res.status(201).json({
    message: "Document ingested and analyzed with AI OCR",
    document: formatDoc(row),
  });
});

// Storage-agnostic file hand-off. Upload the binary to the configured object store,
// then submit its metadata and optional extraction hints through the normal ingest flow.
router.post("/ingest-file", requireRoles("admin", "manager", "supervisor"), (req: Request, res: Response) => {
  const parsed = ingestSchema.safeParse({ ...req.body, filename: req.body?.filename || req.body?.fileName });
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }
  const d = parsed.data;
  const id = `doc-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;
  db.prepare(`INSERT INTO documents (id, filename, type, confidence_score, status, buyer_name, po_number, style_code, product_name, fabric, gsm, total_quantity, delivery_date, size_breakdown, colorways, special_instructions, created_by)
    VALUES (?, ?, ?, ?, 'Needs Review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, d.filename, d.type, 95, d.buyer_name, d.po_number, d.style_code, d.product_name, d.fabric, d.gsm, d.total_quantity, d.delivery_date, JSON.stringify(d.size_breakdown), JSON.stringify(d.colorways), d.special_instructions, req.identity!.userId);
  res.status(201).json({ message: "File metadata ingested; OCR review required", document: formatDoc(db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocRow) });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PATCH /api/documents/:id — operator review-and-edit
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id", requireRoles("admin", "manager", "supervisor"), (req: Request, res: Response) => {
  const id = String(req.params.id);
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const parsed = updateFieldsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const f = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (f.buyerName) { sets.push("buyer_name = ?"); vals.push(f.buyerName); }
  if (f.poNumber) { sets.push("po_number = ?"); vals.push(f.poNumber); }
  if (f.styleCode) { sets.push("style_code = ?"); vals.push(f.styleCode); }
  if (f.productName) { sets.push("product_name = ?"); vals.push(f.productName); }
  if (f.fabric) { sets.push("fabric = ?"); vals.push(f.fabric); }
  if (f.gsm !== undefined) { sets.push("gsm = ?"); vals.push(f.gsm); }
  if (f.totalQuantity !== undefined) { sets.push("total_quantity = ?"); vals.push(f.totalQuantity); }
  if (f.deliveryDate) { sets.push("delivery_date = ?"); vals.push(f.deliveryDate); }
  if (f.specialInstructions !== undefined) { sets.push("special_instructions = ?"); vals.push(f.specialInstructions); }
  if (f.sizeBreakdown) { sets.push("size_breakdown = ?"); vals.push(JSON.stringify(f.sizeBreakdown)); }
  if (f.colorways) { sets.push("colorways = ?"); vals.push(JSON.stringify(f.colorways)); }

  if (sets.length === 0) {
    res.status(400).json({ error: "No fields provided to update" });
    return;
  }

  sets.push("updated_at = datetime('now')");
  vals.push(id);

  db.prepare(`UPDATE documents SET ${sets.join(", ")} WHERE id = ?`).run(...vals as []);
  const updated = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocRow;

  res.json({
    message: "Document specs updated",
    document: formatDoc(updated),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/documents/:id/confirm — Review-and-Confirm Guardrail Action
//    Creates production order from tech-pack
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/confirm", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const id = String(req.params.id);
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  if (row.created_order_id) {
    const existingOrder = db.prepare("SELECT * FROM orders WHERE id = ?").get(row.created_order_id);
    res.json({
      message: "Order was already created for this document",
      document: formatDoc(row),
      order: existingOrder,
    });
    return;
  }

  // 1. Resolve Buyer ID
  let buyerId = "BUY-01";
  const matchedBuyer = db.prepare("SELECT id FROM buyers WHERE LOWER(company) LIKE ? OR LOWER(name) LIKE ? LIMIT 1").get(
    `%${row.buyer_name.toLowerCase()}%`,
    `%${row.buyer_name.toLowerCase()}%`,
  ) as { id: string } | undefined;

  if (matchedBuyer) {
    buyerId = matchedBuyer.id;
  }

  // 2. Generate new Order ID
  const orderId = `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

  // Parse color for order
  let color = "Multi";
  try {
    const cw = JSON.parse(row.colorways);
    if (Array.isArray(cw) && cw.length > 0 && cw[0].color) {
      color = cw[0].color;
    }
  } catch {
    color = "Multi";
  }

  db.transaction(() => {
    // 3. Insert order
    db.prepare(`
      INSERT INTO orders (
        id, buyer_id, buyer, product, category, style_no, po_no,
        quantity, fabric, color, start_date, delivery_date, priority, status, current_stage, progress
      ) VALUES (?, ?, ?, ?, 'Knitwear', ?, ?, ?, ?, ?, datetime('now'), ?, 'Medium', 'On Track', 'yarn', 0)
    `).run(
      orderId,
      buyerId,
      row.buyer_name,
      row.product_name,
      row.style_code,
      row.po_number,
      row.total_quantity,
      row.fabric,
      color,
      row.delivery_date,
    );

    // 4. Create initial 9 stages
    const insertStage = db.prepare(`
      INSERT INTO order_stages (
        order_id, stage_key, label, state, target, completed, pending, rejected, progress, rate, manager, expected
      ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, 0, 'Unassigned', ?)
    `);

    for (let i = 0; i < STAGES.length; i++) {
      const stageKey = STAGES[i];
      const stageLabel = stageKey.charAt(0).toUpperCase() + stageKey.slice(1);
      insertStage.run(
        orderId,
        stageKey,
        stageLabel,
        i === 0 ? "current" : "pending",
        row.total_quantity,
        row.total_quantity,
        row.delivery_date,
      );
    }

    // 5. Update document status and link order
    db.prepare(`
      UPDATE documents
      SET status = 'Verified',
          created_order_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(orderId, id);
  })();

  const updatedDoc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocRow;
  const createdOrder = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  const stages = db.prepare("SELECT * FROM order_stages WHERE order_id = ?").all(orderId);

  res.status(201).json({
    message: "Production Work Order Initialized from Tech-Pack successfully!",
    document: formatDoc(updatedDoc),
    order: {
      ...createdOrder as Record<string, unknown>,
      stages,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DELETE /api/documents/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", requireRoles("admin"), (req: Request, res: Response) => {
  const id = String(req.params.id);
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  if (row.created_order_id) {
    res.status(400).json({ error: "Cannot delete document with active Work Order committed to it" });
    return;
  }

  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  res.json({ message: "Document deleted successfully" });
});

export default router;
