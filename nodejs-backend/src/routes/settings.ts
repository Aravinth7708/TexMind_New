import { Router, Request, Response } from "express";
import { z } from "zod";
import db from "../db/client";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const updateSettingsSchema = z.object({
  factory_name: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  gst_number: z.string().min(1).optional(),
  daily_capacity: z.number().int().min(100).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().min(5).optional(),
  stages_config: z.record(z.string(), z.boolean()).optional(),
  alerts_config: z.record(z.string(), z.boolean()).optional(),
});

function getSettingsRecord() {
  let settings = db.prepare("SELECT * FROM factory_settings WHERE id = 'default'").get() as any;
  if (!settings) {
    db.prepare(`
      INSERT OR IGNORE INTO factory_settings (
        id, factory_name, location, gst_number, daily_capacity, contact_email, contact_phone,
        stages_config, alerts_config
      ) VALUES (
        'default', 'Your Factory', '', '', 0,
        '', '',
        '{"yarn":true,"knitting":true,"dyeing":true,"compacting":true,"cutting":true,"printing":true,"sewing":true,"ironing":true,"packing":true}',
        '{"delayAlerts":true,"stageCompletion":true,"lowStockWarnings":true,"buyerMessages":true,"aiDailyDigest":false}'
      )
    `).run();
    settings = db.prepare("SELECT * FROM factory_settings WHERE id = 'default'").get() as any;
  }
  return {
    id: settings.id,
    factoryName: settings.factory_name,
    location: settings.location,
    gstNumber: settings.gst_number,
    dailyCapacity: settings.daily_capacity,
    contactEmail: settings.contact_email,
    contactPhone: settings.contact_phone,
    stagesConfig: (() => {
      try {
        return JSON.parse(settings.stages_config);
      } catch {
        return {};
      }
    })(),
    alertsConfig: (() => {
      try {
        return JSON.parse(settings.alerts_config);
      } catch {
        return {};
      }
    })(),
    updatedAt: settings.updated_at,
  };
}

/**
 * GET /api/settings
 * Retrieves factory profile, stage enablements, and system notification preferences
 */
router.get("/", (_req: Request, res: Response) => {
  const settings = getSettingsRecord();
  res.json(settings);
});

/**
 * PATCH /api/settings
 * Updates factory profile parameters (Admin & Manager only)
 */
router.patch("/", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const existing = getSettingsRecord();
  const data = parsed.data;

  const newFactoryName = data.factory_name ?? existing.factoryName;
  const newLocation = data.location ?? existing.location;
  const newGst = data.gst_number ?? existing.gstNumber;
  const newCapacity = data.daily_capacity ?? existing.dailyCapacity;
  const newEmail = data.contact_email ?? existing.contactEmail;
  const newPhone = data.contact_phone ?? existing.contactPhone;
  const newStagesConfig = data.stages_config ? JSON.stringify(data.stages_config) : JSON.stringify(existing.stagesConfig);
  const newAlertsConfig = data.alerts_config ? JSON.stringify(data.alerts_config) : JSON.stringify(existing.alertsConfig);

  db.prepare(`
    UPDATE factory_settings
    SET factory_name = ?,
        location = ?,
        gst_number = ?,
        daily_capacity = ?,
        contact_email = ?,
        contact_phone = ?,
        stages_config = ?,
        alerts_config = ?,
        updated_at = datetime('now')
    WHERE id = 'default'
  `).run(
    newFactoryName,
    newLocation,
    newGst,
    newCapacity,
    newEmail,
    newPhone,
    newStagesConfig,
    newAlertsConfig,
  );

  res.json({
    success: true,
    message: "Factory settings updated successfully",
    settings: getSettingsRecord(),
  });
});

export default router;
