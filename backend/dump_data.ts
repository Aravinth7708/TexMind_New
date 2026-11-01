import * as data from "../src/lib/data.ts";
import { writeFileSync } from "fs";
import { join } from "path";

const payload = {
  orders: data.orders,
  buyers: data.buyers,
  materials: data.materials,
  bottlenecks: data.bottlenecks,
  insights: data.insights,
  adminNotifications: data.adminNotifications,
  buyerNotifications: data.buyerNotifications,
  totals: data.totals,
  healthBreakdown: data.healthBreakdown,
  targetVsActual: data.targetVsActual,
  stagePerformance: data.stagePerformance,
  stageManagers: data.stageManagers,
  stageSummaries: data.stageSummaries,
};

const outPath = join(__dirname, "factory_data.json");
writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
console.log("Successfully dumped factory data to", outPath);
