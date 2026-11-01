import db from "../db/client";

export interface OperationalRisk {
  id: string;
  order_id: string;
  buyer: string;
  current_stage: string;
  score: number;
  severity: "critical" | "high" | "medium" | "low";
  progress: number;
  rejection_rate: number;
  reasons: string[];
  model: string;
  is_prediction: boolean;
}

/**
 * Computes deterministic, explainable risk score for a single order.
 */
export function computeRisk(orderId: string): OperationalRisk | null {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
  if (!order) {
    return null;
  }

  const stages = db
    .prepare("SELECT * FROM order_stages WHERE order_id = ? ORDER BY id ASC")
    .all(orderId) as any[];

  if (!stages || stages.length === 0) {
    return null;
  }

  const current =
    stages.find((s) => s.stage_key === order.current_stage) || stages[stages.length - 1];

  let completedDelta = 0;
  let rejectedDelta = 0;

  try {
    const deltas = db
      .prepare(
        `SELECT COALESCE(SUM(completed_delta), 0) AS completed,
                COALESCE(SUM(rejected_delta), 0) AS rejected
         FROM production_events
         WHERE order_id = ? AND stage = ?`
      )
      .get(orderId, current.stage_key) as { completed: number; rejected: number } | undefined;

    if (deltas) {
      completedDelta = deltas.completed;
      rejectedDelta = deltas.rejected;
    }
  } catch {
    // production_events table may be empty
  }

  const completed = Math.max(0, (current.completed || 0) + completedDelta);
  const target = Math.max(1, current.target || 1);
  const rejectionRate = ((current.rejected || 0) + rejectedDelta) / target;
  const progress = Math.min(100, Math.round((completed / target) * 1000) / 10);
  const remainingStages = stages.filter((s) => s.state !== "completed").length;

  let score = Math.min(
    100,
    Math.round((100 - progress) * 0.38 + rejectionRate * 100 * 1.5 + remainingStages * 4)
  );

  if (order.status === "Delayed") {
    score = Math.max(score, 85);
  } else if (order.status === "At Risk") {
    score = Math.max(score, 65);
  }

  const severity: "critical" | "high" | "medium" | "low" =
    score >= 80 ? "critical" : score >= 60 ? "high" : score >= 35 ? "medium" : "low";

  const reasons: string[] = [];
  if (order.status === "Delayed" || order.status === "At Risk") {
    reasons.push(`Order is currently marked ${order.status.toLowerCase()} in the operational plan.`);
  }
  if (progress < 50) {
    reasons.push(`${current.label || current.stage_key} is only ${progress}% complete.`);
  }
  if (rejectionRate >= 0.03) {
    reasons.push(
      `${current.label || current.stage_key} rejection rate is ${(rejectionRate * 100).toFixed(1)}%.`
    );
  }
  if (remainingStages >= 3) {
    reasons.push(`${remainingStages} production stages still require completion.`);
  }
  if (reasons.length === 0) {
    reasons.push(
      "Current stage progress and quality remain within the configured deterministic threshold."
    );
  }

  return {
    id: `risk-${order.id}`,
    order_id: order.id,
    buyer: order.buyer,
    current_stage: current.stage_key,
    score,
    severity,
    progress,
    rejection_rate: Math.round(rejectionRate * 10000) / 10000,
    reasons,
    model: "deterministic-fixture-v1",
    is_prediction: false,
  };
}

/**
 * Returns prioritized attention items (critical & high severity risks),
 * sorted descending by score.
 */
export function getAttentionItems(): OperationalRisk[] {
  const orders = db.prepare("SELECT id FROM orders").all() as { id: string }[];
  const risks: OperationalRisk[] = [];

  for (const o of orders) {
    const r = computeRisk(o.id);
    if (r) {
      risks.push(r);
    }
  }

  return risks
    .filter((r) => r.severity === "critical" || r.severity === "high")
    .sort((a, b) => b.score - a.score);
}
