import { Router, Request, Response } from "express";
import { waManager } from "../lib/whatsapp";

const router = Router();

// ──────────────────────────────────────────────────────────────
//  GET /api/whatsapp/status
//  Returns current connection status + groups list
// ──────────────────────────────────────────────────────────────
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    status: waManager.getStatus(),
    groups: waManager.getGroups(),
  });
});

// ──────────────────────────────────────────────────────────────
//  GET /api/whatsapp/qr
//  Returns the QR code as a base64 data URL (poll this endpoint)
// ──────────────────────────────────────────────────────────────
router.get("/qr", (_req: Request, res: Response) => {
  const qr = waManager.getQRDataUrl();
  const status = waManager.getStatus();

  if (status === "connected") {
    return res.json({ status: "connected", qr: null });
  }

  if (!qr) {
    return res.json({ status, qr: null, message: "QR not yet available, try again shortly" });
  }

  return res.json({ status, qr });
});

// ──────────────────────────────────────────────────────────────
//  POST /api/whatsapp/connect
//  Initiates WhatsApp connection (call once on server start or on demand)
// ──────────────────────────────────────────────────────────────
router.post("/connect", async (_req: Request, res: Response) => {
  try {
    await waManager.connect();
    res.json({ success: true, status: waManager.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
//  POST /api/whatsapp/send-staffing
//  Sends a staffing request message to a WhatsApp group
//
//  Body: {
//    groupId: string,
//    unit: string,
//    workersNeeded: number,
//    date: string,
//    shift: string,
//    location: string,
//    contact: string,
//    orderId: string
//  }
// ──────────────────────────────────────────────────────────────
router.post("/send-staffing", async (req: Request, res: Response) => {
  const {
    groupId,
    unit,
    workersNeeded,
    date,
    shift,
    location,
    contact,
    orderId,
  } = req.body;

  const targetGroupId =
    groupId ||
    process.env.WA_GROUP_ID ||
    "120363428921921565@g.us";

  if (!unit || workersNeeded === undefined || !orderId) {
    return res.status(400).json({
      error: "unit, workersNeeded, and orderId are required",
    });
  }

  try {
    const message = await waManager.sendStaffingMessage({
      groupId: targetGroupId,
      unit,
      workersNeeded: Number(workersNeeded),
      date: date || new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      shift: shift || "8:00 AM – 5:00 PM",
      location: location || "TexMind Factory",
      contact: contact || "+91XXXXXXXXXX",
      orderId,
    });

    res.json({ success: true, message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
//  GET /api/whatsapp/groups
//  Returns the list of WhatsApp groups the account is part of
// ──────────────────────────────────────────────────────────────
router.get("/groups", (_req: Request, res: Response) => {
  res.json({ groups: waManager.getGroups() });
});

export default router;
