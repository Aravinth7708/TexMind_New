import { Router, Request, Response } from "express";
import db from "../db/client";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

/**
 * GET /api/search?q=:query
 * Fast indexed global search across orders, buyers, inventory, and quality scans
 */
router.get("/", (req: Request, res: Response) => {
  const query = String(req.query.q || "").trim();
  if (!query || query.length < 2) {
    res.json({
      query,
      results: [],
      counts: { orders: 0, buyers: 0, inventory: 0, inspections: 0 },
    });
    return;
  }

  const user = (req as any).user;
  const isBuyer = user?.role === "buyer";
  const buyerId = user?.buyer_id;

  const like = `%${query}%`;

  // 1. Orders
  let orderQuery = `
    SELECT id, product, buyer, style_no, po_no, status, current_stage
    FROM orders
    WHERE (id LIKE ? OR product LIKE ? OR buyer LIKE ? OR style_no LIKE ? OR po_no LIKE ?)
  `;
  const orderParams: any[] = [like, like, like, like, like];

  if (isBuyer && buyerId) {
    orderQuery += ` AND buyer_id = ?`;
    orderParams.push(buyerId);
  }
  orderQuery += ` LIMIT 6`;

  const orderHits = (db.prepare(orderQuery).all(...orderParams) as any[]).map((o) => ({
    category: "Orders",
    id: o.id,
    title: o.id,
    subtitle: `${o.product} · ${o.buyer} (${o.status})`,
    badge: o.current_stage,
    link: isBuyer ? `/buyer/orders/${o.id}` : `/orders/${o.id}`,
  }));

  // 2. Buyers (hidden for buyer role)
  let buyerHits: any[] = [];
  if (!isBuyer) {
    buyerHits = (
      db.prepare(`
        SELECT id, name, company, country, active, total
        FROM buyers
        WHERE name LIKE ? OR company LIKE ? OR country LIKE ?
        LIMIT 4
      `).all(like, like, like) as any[]
    ).map((b) => ({
      category: "Buyers",
      id: b.id,
      title: b.company,
      subtitle: `${b.name} · ${b.country} (${b.active} active orders)`,
      badge: b.id,
      link: "/buyers",
    }));
  }

  // 3. Inventory / Materials
  const inventoryHits = (
    db.prepare(`
      SELECT name, category, stock, unit
      FROM materials
      WHERE name LIKE ? OR category LIKE ?
      LIMIT 4
    `).all(like, like) as any[]
  ).map((m) => ({
    category: "Inventory",
    id: m.name,
    title: m.name,
    subtitle: `${m.category} · Stock: ${m.stock} ${m.unit}`,
    badge: m.category,
    link: "/inventory",
  }));

  // 4. Vision Inspections
  const qcHits = (
    db.prepare(`
      SELECT id, item_name, stage, overall_result
      FROM vision_inspections
      WHERE id LIKE ? OR item_name LIKE ? OR stage LIKE ?
      LIMIT 4
    `).all(like, like, like) as any[]
  ).map((q) => ({
    category: "Quality Inspections",
    id: q.id,
    title: q.id,
    subtitle: `${q.item_name} · Stage: ${q.stage}`,
    badge: q.overall_result,
    link: "/quality",
  }));

  const combined = [
    ...orderHits,
    ...buyerHits,
    ...inventoryHits,
    ...qcHits,
  ];

  res.json({
    query,
    totalHits: combined.length,
    results: combined,
    counts: {
      orders: orderHits.length,
      buyers: buyerHits.length,
      inventory: inventoryHits.length,
      inspections: qcHits.length,
    },
  });
});

export default router;
