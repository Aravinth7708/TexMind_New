import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const updateMaterialSchema = z.object({
  stock: z.number().min(0).optional(),
  reserved: z.number().min(0).optional(),
  min: z.number().min(0).optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
});

const reorderSchema = z.object({
  material_name: z.string().optional(),
  material_id: z.string().optional(),
  quantity: z.number().min(1),
  unit: z.string().optional(),
  supplier: z.string().min(1),
  estimated_cost: z.union([z.string(), z.number().transform((n) => "₹" + n.toLocaleString("en-IN"))]).optional(),
  unit_cost: z.number().optional(),
  delivery_date: z.string().optional(),
  notes: z.string().optional(),
  note: z.string().optional(),
}).transform((val) => ({
  material_name: val.material_name || val.material_id || "",
  quantity: val.quantity,
  unit: val.unit || "kg",
  supplier: val.supplier,
  estimated_cost: val.estimated_cost || (val.unit_cost ? "₹" + (val.quantity * val.unit_cost).toLocaleString("en-IN") : undefined),
}));

// GET /api/inventory/forecasts
router.get("/forecasts", (_req: Request, res: Response) => {
  const materials = db.prepare("SELECT * FROM materials ORDER BY category, name").all() as any[];

  const forecasts = materials.map((m) => {
    const freeStock = Math.max(0, m.stock - m.reserved);
    const dailyBurnRate = 0;
    const leadTimeDays = 0;
    const supplier = "";
    const supplierRisk: "Low" | "Medium" | "High" = "Low";
    const suggestedPoQty = Math.max(0, m.min - freeStock);

    const daysOfCover = dailyBurnRate > 0 ? Number((m.stock / dailyBurnRate).toFixed(1)) : 0;
    const isCritical = m.stock < m.min;

    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + Math.max(1, Math.round(daysOfCover)));
    const projectedStockoutDate = projectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    return {
      materialName: m.name,
      category: m.category,
      currentStock: m.stock,
      reservedStock: m.reserved,
      freeStock,
      dailyBurnRate,
      unit: m.unit,
      daysOfCoverRemaining: daysOfCover,
      projectedStockoutDate,
      leadTimeDays,
      supplier,
      supplierRisk,
      safetyThreshold: m.min,
      status: isCritical ? "CRITICAL" : freeStock < m.min ? "LOW_BUFFER" : "OPTIMAL",
      suggestedPoQty,
      suggestedPoCost: null,
      activeOrdersDependent: [],
    };
  });

  res.json(forecasts);
});

// POST /api/inventory/reorder — create replenishment PO
router.post("/reorder", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const d = parsed.data;
  const poId = `PO-MAT-${Date.now().toString().slice(-6)}`;
  const userName = (req as any).user?.name || "Inventory Manager";

  db.transaction(() => {
    db.prepare(`
      INSERT INTO inventory_reorders (
        id, material_name, quantity, unit, supplier, estimated_cost, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?)
    `).run(poId, d.material_name, d.quantity, d.unit, d.supplier, d.estimated_cost || null, userName);

    // Notify procurement
    db.prepare(`
      INSERT INTO notifications (id, type, title, body, time, read, tone, target_role)
      VALUES (?, 'inventory_reorder', ?, ?, datetime('now'), 0, 'info', 'admin')
    `).run(
      uuidv4(),
      `Draft PO Generated: ${poId}`,
      `Created purchase order for ${d.quantity.toLocaleString()} ${d.unit} of ${d.material_name} from ${d.supplier}.`,
    );
  })();

  const created = db.prepare("SELECT * FROM inventory_reorders WHERE id = ?").get(poId);
  res.status(201).json({
    success: true,
    message: "Replenishment Purchase Order draft created successfully",
    purchaseOrder: created,
  });
});

// GET /api/inventory/reorders
router.get("/reorders", (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM inventory_reorders ORDER BY created_at DESC").all();
  res.json(rows);
});

// GET /api/inventory
router.get("/", (_req: Request, res: Response) => {
  const materials = db.prepare("SELECT * FROM materials ORDER BY category, name").all() as Record<string, unknown>[];

  const withStatus = materials.map((m) => {
    const available = (m.stock as number) - (m.reserved as number);
    return {
      ...m,
      available,
      status: available < (m.min as number) ? "critical" : available < (m.min as number) * 1.5 ? "low" : "ok",
    };
  });

  res.json(withStatus);
});

// PATCH /api/inventory/:name
router.patch("/:name", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const name = decodeURIComponent(String(req.params.name));
  const material = db.prepare("SELECT * FROM materials WHERE name = ?").get(name) as Record<string, unknown> | undefined;
  if (!material) { res.status(404).json({ error: "Material not found" }); return; }

  const parsed = updateMaterialSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const fields = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (sets.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  sets.push("updated_at = datetime('now')");
  vals.push(name);
  db.prepare(`UPDATE materials SET ${sets.join(", ")} WHERE name = ?`).run(...vals as []);

  const updated = db.prepare("SELECT * FROM materials WHERE name = ?").get(name) as Record<string, unknown>;
  const available = (updated.stock as number) - (updated.reserved as number);
  res.json({
    ...updated,
    available,
    status: available < (updated.min as number) ? "critical" : available < (updated.min as number) * 1.5 ? "low" : "ok",
  });
});

export default router;
