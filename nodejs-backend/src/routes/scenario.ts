import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const simulateSchema = z.object({
  order_id: z.string().min(1, "Order ID required"),
  overtime_hours: z.number().min(0).max(8).default(0),
  added_operators: z.number().int().min(0).max(30).default(0),
  subcontract_qty: z.number().int().min(0).default(0),
});

/**
 * POST /api/scenario/simulate
 * Simulates recovery plan by adjusting OT hours, additional manpower, and subcontracting.
 */
router.post("/simulate", (req: Request, res: Response) => {
  const parsed = simulateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { order_id, overtime_hours, added_operators, subcontract_qty } = parsed.data;

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(order_id) as any;
  if (!order) {
    res.status(404).json({ error: `Order '${order_id}' not found` });
    return;
  }

  const stages = db.prepare("SELECT * FROM order_stages WHERE order_id = ?").all(order_id) as any[];
  const currentStage = stages.find((s) => s.stage_key === order.current_stage) || stages[0];

  const totalQty = order.quantity;
  const currentPending = currentStage ? currentStage.pending : Math.round(totalQty * (1 - order.progress / 100));
  const effectivePending = Math.max(0, currentPending - subcontract_qty);

  // Base standard throughput (pcs/day) across an 8-hour shift
  const standardDailyThroughput = Math.max(250, currentStage?.rate ? currentStage.rate * 8 : 400);

  // Manpower & OT boosts
  const otDailyBoost = (overtime_hours / 8) * standardDailyThroughput * 0.9;
  const operatorDailyBoost = added_operators * 28; // ~28 pcs/operator/day
  const combinedDailyRate = standardDailyThroughput + otDailyBoost + operatorDailyBoost;

  // Days needed
  const baselineDays = Math.ceil(currentPending / standardDailyThroughput);
  const simulatedDays = Math.max(1, Math.ceil(effectivePending / combinedDailyRate));
  const daysSaved = Math.max(0, baselineDays - simulatedDays);

  // Financial Costing (INR)
  const otLaborCost = Math.round(overtime_hours * simulatedDays * 160 * (18 + added_operators)); // ₹160/hr OT rate
  const addOperatorCost = Math.round(added_operators * 650 * simulatedDays); // ₹650/day wage
  const subcontractCost = Math.round(subcontract_qty * 38); // ₹38/pc CMT fee
  const totalAddedCost = otLaborCost + addOperatorCost + subcontractCost;

  // Calculate projected date
  const baseDelivery = new Date();
  baseDelivery.setDate(baseDelivery.getDate() + simulatedDays);
  const projectedDeliveryDate = baseDelivery.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Risk Classification
  let feasibilityRisk: "Low" | "Medium" | "High" = "Low";
  if (totalAddedCost > 150000 || added_operators > 10 || overtime_hours >= 3) {
    feasibilityRisk = "Medium";
  }
  if (totalAddedCost > 300000 || (overtime_hours >= 4 && added_operators >= 12)) {
    feasibilityRisk = "High";
  }

  const simId = `sim-${uuidv4().slice(0, 8)}`;
  const userName = (req as any).user?.name || "System Simulator";

  db.prepare(`
    INSERT INTO scenario_simulations (
      id, order_id, overtime_hours, added_operators, subcontract_qty,
      projected_delivery, days_saved, added_cost, feasibility_risk, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    simId,
    order_id,
    overtime_hours,
    added_operators,
    subcontract_qty,
    projectedDeliveryDate,
    daysSaved,
    totalAddedCost,
    feasibilityRisk,
    userName,
  );

  res.json({
    simulationId: simId,
    orderId: order_id,
    orderProduct: order.product,
    buyer: order.buyer,
    committedDeliveryDate: order.delivery_date,
    projectedDeliveryDate,
    baselineDaysNeeded: baselineDays,
    simulatedDaysNeeded: simulatedDays,
    daysSaved,
    financials: {
      overtimeLaborCost: otLaborCost,
      addedManpowerCost: addOperatorCost,
      subcontractingCost: subcontractCost,
      totalAddedCost,
    },
    throughput: {
      standardDailyRate: Math.round(standardDailyThroughput),
      boostedDailyRate: Math.round(combinedDailyRate),
      effectivePendingQty: effectivePending,
    },
    feasibilityRisk,
  });
});

// Approval is separate from simulation so planners can compare alternatives safely.
router.post("/:id/approve", (req: Request, res: Response) => {
  const simulation = db.prepare("SELECT * FROM scenario_simulations WHERE id = ?").get(req.params.id) as any;
  if (!simulation) { res.status(404).json({ error: "Simulation not found" }); return; }
  if (simulation.approved_at) { res.status(409).json({ error: "Simulation already approved" }); return; }
  db.transaction(() => {
    db.prepare("UPDATE scenario_simulations SET approved_by = ?, approved_at = datetime('now') WHERE id = ?").run(req.identity!.userId, simulation.id);
    db.prepare(`INSERT INTO proposals (id, order_id, title, action_type, rationale, status, created_by, decided_by, decided_at)
      VALUES (?, ?, ?, 'scenario_simulation', ?, 'approved', ?, ?, datetime('now'))`)
      .run(`prop-${uuidv4().slice(0, 8)}`, simulation.order_id, `Approved recovery simulation ${simulation.id}`, "Approved through Scenario Planner", req.identity!.userId, req.identity!.userId);
  })();
  res.json({ success: true, simulation: db.prepare("SELECT * FROM scenario_simulations WHERE id = ?").get(simulation.id) });
});

export default router;
