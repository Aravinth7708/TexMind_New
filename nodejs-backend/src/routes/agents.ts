import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const decisionSchema = z.object({
  note: z.string().optional(),
});

/**
 * GET /api/agents
 * Returns factory multi-agents and their active operational proposals
 */
router.get("/", (_req: Request, res: Response) => {
  const agents = db.prepare("SELECT * FROM factory_agents ORDER BY id ASC").all() as any[];
  const allProposals = db.prepare("SELECT * FROM agent_proposals ORDER BY created_at DESC").all() as any[];

  const proposalMap = new Map<string, any[]>();
  for (const p of allProposals) {
    const list = proposalMap.get(p.agent_id) || [];
    list.push({
      id: p.id,
      title: p.title,
      action: p.action,
      impact: p.impact,
      urgency: p.urgency,
      approved: Boolean(p.approved),
      dismissed: Boolean(p.dismissed),
      decidedBy: p.decided_by || null,
      decidedAt: p.decided_at || null,
      decisionNote: p.decision_note || null,
    });
    proposalMap.set(p.agent_id, list);
  }

  const result = agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    icon: a.icon,
    status: a.status,
    lastActive: a.last_active,
    currentTask: a.current_task,
    keyFinding: a.key_finding,
    confidence: a.confidence,
    proposals: proposalMap.get(a.id) || [],
  }));

  res.json(result);
});

/**
 * POST /api/agents/proposals/:proposalId/approve
 * Human-in-the-loop approval of an agent's proposal
 */
router.post("/proposals/:proposalId/approve", (req: Request, res: Response) => {
  const proposalId = String(req.params.proposalId);
  const parsed = decisionSchema.safeParse(req.body);
  const note = parsed.success ? parsed.data.note : undefined;

  const proposal = db.prepare("SELECT * FROM agent_proposals WHERE id = ?").get(proposalId) as any;
  if (!proposal) {
    res.status(404).json({ error: `Agent proposal '${proposalId}' not found` });
    return;
  }

  if (proposal.approved) {
    res.status(409).json({ error: "Proposal has already been approved" });
    return;
  }
  if (proposal.dismissed) {
    res.status(409).json({ error: "Cannot approve a dismissed proposal" });
    return;
  }

  const userName = (req as any).user?.name || "Factory Manager";

  const txn = db.transaction(() => {
    db.prepare(`
      UPDATE agent_proposals
      SET approved = 1, dismissed = 0, decided_by = ?, decided_at = datetime('now'), decision_note = ?
      WHERE id = ?
    `).run(userName, note || "Approved by human in the loop", proposalId);

    // Update agent status if all proposals resolved
    db.prepare(`
      UPDATE factory_agents
      SET status = 'active', updated_at = datetime('now')
      WHERE id = ?
    `).run(proposal.agent_id);

    // Create system notification
    db.prepare(`
      INSERT INTO notifications (id, type, title, body, time, read, tone, target_role)
      VALUES (?, ?, ?, ?, datetime('now'), 0, ?, ?)
    `).run(
      uuidv4(),
      "agent_approved",
      "Agent Recommendation Approved",
      `Action: "${proposal.title}" approved by ${userName}.`,
      "info",
      "admin",
    );
  });

  txn();

  const updated = db.prepare("SELECT * FROM agent_proposals WHERE id = ?").get(proposalId);
  res.json({
    success: true,
    message: "Agent recommendation approved successfully",
    proposal: updated,
  });
});

/**
 * POST /api/agents/proposals/:proposalId/dismiss
 * Dismiss an agent's operational proposal
 */
router.post("/proposals/:proposalId/dismiss", (req: Request, res: Response) => {
  const proposalId = String(req.params.proposalId);
  const parsed = decisionSchema.safeParse(req.body);
  const note = parsed.success ? parsed.data.note : undefined;

  const proposal = db.prepare("SELECT * FROM agent_proposals WHERE id = ?").get(proposalId) as any;
  if (!proposal) {
    res.status(404).json({ error: `Agent proposal '${proposalId}' not found` });
    return;
  }

  if (proposal.dismissed) {
    res.status(409).json({ error: "Proposal is already dismissed" });
    return;
  }

  const userName = (req as any).user?.name || "Factory Manager";

  db.prepare(`
    UPDATE agent_proposals
    SET dismissed = 1, approved = 0, decided_by = ?, decided_at = datetime('now'), decision_note = ?
    WHERE id = ?
  `).run(userName, note || "Dismissed by operator", proposalId);

  const updated = db.prepare("SELECT * FROM agent_proposals WHERE id = ?").get(proposalId);
  res.json({
    success: true,
    message: "Agent recommendation dismissed",
    proposal: updated,
  });
});

export default router;
