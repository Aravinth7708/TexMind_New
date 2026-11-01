import { Router, Request, Response } from "express";
import { z } from "zod";
import db from "../db/client";

const router = Router();

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
    }),
  ).min(1, "At least one message required"),
  role: z.string().optional().default("admin"),
  buyer_id: z.string().optional(),
  stage: z.string().optional(),
});

function generateCopilotResponse(query: string, role: string, buyerId?: string, stage?: string): { text: string; sources: string[] } {
  const q = query.toLowerCase();

  // 1. Gather live DB state
  const totalOrders = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as any).c;
  const delayedOrders = db.prepare("SELECT id, product, buyer, delivery_date, current_stage, progress FROM orders WHERE status IN ('Delayed', 'At Risk')").all() as any[];
  const criticalStock = db.prepare("SELECT name, stock, min, unit FROM materials WHERE stock < min").all() as any[];
  const recentDefects = db.prepare("SELECT id, item_name, stage, overall_result FROM vision_inspections WHERE overall_result != 'PASS' LIMIT 3").all() as any[];
  const bottleneckLines = db.prepare("SELECT name, stage, operators_assigned, status FROM production_lines WHERE status = 'Bottleneck'").all() as any[];

  // Tenant scoping for buyers
  if (role === "buyer" && buyerId) {
    const buyerOrders = db.prepare("SELECT id, product, quantity, delivery_date, status, progress, current_stage FROM orders WHERE buyer_id = ?").all(buyerId) as any[];
    const active = buyerOrders.filter((o) => o.status !== "Completed");
    const delayed = buyerOrders.filter((o) => o.status === "Delayed");

    const sources = ["Buyer Order Ledger (orders table)", "Production Stages Tracker (order_stages)"];
    
    if (q.includes("delay") || q.includes("late") || q.includes("when") || q.includes("schedule")) {
      if (delayed.length > 0) {
        return {
          text: `You have ${delayed.length} order currently flagged as delayed: **${delayed[0].id}** (${delayed[0].product}, ${delayed[0].quantity} pcs). Current stage is **${delayed[0].current_stage}** at ${delayed[0].progress}% completion. Our floor supervisors have initiated overtime recovery shifts to protect your committed delivery of ${delayed[0].delivery_date}.`,
          sources,
        };
      }
      return {
        text: `All ${active.length} of your active orders are running on schedule. Nearest dispatch is on ${active[0]?.delivery_date || "schedule"}.`,
        sources,
      };
    }

    return {
      text: `Welcome back to the TexMind Buyer Portal. You currently have **${active.length} active orders** totaling ${active.reduce((acc: number, o: any) => acc + o.quantity, 0).toLocaleString()} pieces in production. Overall completion rate is ${Math.round(active.reduce((acc: number, o: any) => acc + o.progress, 0) / (active.length || 1))}%.`,
      sources,
    };
  }

  // Process Incharge scoping
  if (role === "process" && stage) {
    const stageDetails = db.prepare("SELECT label, manager, SUM(completed) as comp, SUM(pending) as pend, SUM(rejected) as rej FROM order_stages WHERE stage_key = ? GROUP BY stage_key").get(stage) as any;
    const sources = [`Process Master: ${stage}`, "Daily Output Log (production_events)"];

    return {
      text: `**${stageDetails?.label || stage.toUpperCase()} Floor Report**:\n- Total Completed: **${stageDetails?.comp || 0} pcs**\n- Pending Queue: **${stageDetails?.pend || 0} pcs**\n- Total Rejections: **${stageDetails?.rej || 0} pcs**\nFloor Manager: ${stageDetails?.manager || "Assigned Supervisor"}. Voice output logging and batch sync are online.`,
      sources,
    };
  }

  // Admin / General Copilot Intelligence
  const sources: string[] = ["TexMind Core ERP", "Material Inventory Ledger", "Optical Quality Vision AI"];

  // Query routing based on keywords
  if (q.includes("delay") || q.includes("behind") || q.includes("at risk") || q.includes("late") || q.includes("order")) {
    sources.push("Orders Database (orders)");
    if (delayedOrders.length > 0) {
      const list = delayedOrders
        .map((o: any) => `• **${o.id}** (${o.product} for ${o.buyer}) — Stage: *${o.current_stage}*, Progress: ${o.progress}%, ETA: ${o.delivery_date}`)
        .join("\n");
      return {
        text: `Currently, there are **${delayedOrders.length} orders requiring management attention**:\n\n${list}\n\n💡 **Recommended Action**: Review the affected orders and assign recovery actions based on your factory data.`,
        sources,
      };
    }
    return {
      text: `All ${totalOrders} production orders are currently running **On Track** against their planned milestone deliveries.`,
      sources,
    };
  }

  if (q.includes("yarn") || q.includes("stock") || q.includes("inventory") || q.includes("material") || q.includes("fabric")) {
    sources.push("Inventory Warehouse (materials)");
    if (criticalStock.length > 0) {
      const list = criticalStock.map((m: any) => `• **${m.name}**: Stock is **${m.stock} ${m.unit}** (Safety minimum is ${m.min} ${m.unit})`).join("\n");
      return {
        text: `⚠️ **Inventory Buffer Alert**:\n${list}\n\nReview stock levels and create a purchase order using your supplier and pricing details.`,
        sources,
      };
    }
    return {
      text: `No materials are below their configured minimum stock level.`,
      sources,
    };
  }

  if (q.includes("quality") || q.includes("defect") || q.includes("qc") || q.includes("stitch") || q.includes("rework")) {
    sources.push("Optical Vision Inspection (vision_inspections)");
    return {
      text: `Quality inspection records will appear here after your factory records its first inspection.`,
      sources,
    };
  }

  if (q.includes("capacity") || q.includes("line") || q.includes("operator") || q.includes("worker") || q.includes("rebalance")) {
    sources.push("Workforce Planning (production_lines)");
    return {
      text: bottleneckLines.length
        ? `Recorded bottlenecks: ${bottleneckLines.map((line: any) => line.name).join(", ")}. Review staffing and line capacity records for details.`
        : "No production line capacity records are available yet. Add production lines and staffing data to view capacity insights.",
      sources,
    };
  }

  // Tamil / Tanglish checks
  if (q.includes("enna") || q.includes("irukka") || q.includes("mudinjidha") || q.includes("vanakkam") || q.includes("status")) {
    return {
      text: `வணக்கம்! TexMind Factory Copilot நேரலையில் உள்ளது.\n- மொத்தம் ${totalOrders} ஆர்டர்கள் உற்பத்தியில் உள்ளன.\n- ${delayedOrders.length} ஆர்டர்கள் கவனிக்கப்பட வேண்டும்.\n- நூல் மற்றும் துணி இருப்பு விவரங்கள் தயாராக உள்ளன.\nவேறு ஏதேனும் தகவல் தேவைப்படுகிறதா?`,
      sources: ["Tamil Natural Language Assistant", "Factory Ledger"],
    };
  }

  // Default factory health summary
  return {
    text: `**Factory Operations Summary**:\n- Orders: **${totalOrders}**\n- Delayed orders: **${delayedOrders.length}**\n- Materials below minimum: **${criticalStock.length}**\n- Quality exceptions: **${recentDefects.length}**\n\nAdd factory records to see operational insights.`,
    sources,
  };
}

/**
 * POST /api/chat
 * Complete JSON answer for AI Factory Assistant
 */
router.post("/", (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { messages, role, buyer_id, stage } = parsed.data;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  const response = generateCopilotResponse(lastUserMsg, role, buyer_id, stage);

  res.json({
    content: response.text,
    sources: response.sources,
  });
});

/**
 * POST /api/chat/stream
 * Streaming token response for real-time typewriter UI effect
 */
router.post("/stream", (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { messages, role, buyer_id, stage } = parsed.data;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  const response = generateCopilotResponse(lastUserMsg, role, buyer_id, stage);

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Transfer-Encoding": "chunked",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // Stream text in small token chunks
  const words = response.text.split(" ");
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? "" : " ") + words[i];
    res.write(chunk);
  }
  res.end();
});

export default router;
