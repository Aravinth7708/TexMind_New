import {
  STAGES,
  STAGE_WORKFORCE_CONFIGS,
  FACTORY_COMMUNITY_PROFILE,
  STAGE_LABELS,
  type StageKey,
} from "./data";

export interface StaffingAssessment {
  stage: StageKey;
  label: string;
  maxCapacity: number;
  presentCount: number;
  assignedCount: number;
  deficit: number;
  criticality: "CRITICAL" | "HIGH" | "MODERATE" | "OPTIMAL";
  actionRequired: "WHATSAPP_BROADCAST_NOW" | "LINE_REBALANCE" | "NORMAL_SUPERVISION";
  aiConfidence: number;
  occupancyPercent: number;
  currentEffectiveRunRate: number | string;
  aiVerdict: string;
  evaluatedAt: number;
  [key: string]: any;
}

export interface WhatsAppCommunityDispatchLog {
  id: string;
  timestamp: string;
  dispatchedAt: string;
  dispatchedBy: string;
  stage: string;
  stageLabel: string;
  workersRequested: number;
  reason: string;
  triggerType: "MANUAL" | "AUTO_AI";
  actorName: string;
  status: "SENT_TO_COMMUNITY" | "CONFIRMED" | string;
  destinationCommunity: string;
  contactManager: string;
  contactPhone: string;
  mapsUrl: string;
  messageText: string;
  [key: string]: any;
}

const memoryCache = new Map<string, StaffingAssessment>();

const initialDispatchLogs: WhatsAppCommunityDispatchLog[] = [];
let dispatchLogs: WhatsAppCommunityDispatchLog[] = [...initialDispatchLogs];

export function evaluateStageStaffing(
  stage: StageKey | string,
  employees: any[] = []
): StaffingAssessment {
  const stageKey = (STAGES.includes(stage as StageKey) ? stage : "yarn") as StageKey;
  const cached = memoryCache.get(stageKey);
  if (cached) {
    return cached;
  }

  const config = (STAGE_WORKFORCE_CONFIGS as any)[stageKey] || {
    label: stageKey,
    maxCapacity: 50,
    requiredOperators: 20,
    pieceRate: 4.5,
  };

  const label = config.label || STAGE_LABELS[stageKey] || stageKey;
  const stageEmps = employees.filter((e) => e.stage === stageKey);
  const presentEmps = stageEmps.filter((e) => e.attendance === "Present");
  const presentCount = presentEmps.length;
  const maxCapacity = config.maxCapacity || 0;
  const deficit = Math.max(0, maxCapacity - presentCount);
  const occupancyPercent = maxCapacity > 0 ? Math.round((presentCount / maxCapacity) * 100) : 0;
  const currentEffectiveRunRate = `${Math.round(presentCount * 7.5)} units/hr`;
  const aiVerdict = deficit > 15
    ? `Deficit of ${deficit} operators detected. Urgent recruitment broadcast needed.`
    : deficit > 5
      ? `Moderate shortfall of ${deficit} operators. Recommend cross-line balance.`
      : `Staffing balanced at ${occupancyPercent}% capacity.`;

  const assessment: StaffingAssessment = {
    stage: stageKey,
    label,
    maxCapacity,
    presentCount,
    assignedCount: presentCount,
    deficit,
    occupancyPercent,
    currentEffectiveRunRate,
    aiVerdict,
    criticality: deficit > 15 ? "CRITICAL" : deficit > 5 ? "HIGH" : "OPTIMAL",
    actionRequired: deficit > 15 ? "WHATSAPP_BROADCAST_NOW" : deficit > 5 ? "LINE_REBALANCE" : "NORMAL_SUPERVISION",
    aiConfidence: 0,
    evaluatedAt: Date.now(),
  };

  memoryCache.set(stageKey, assessment);
  return assessment;
}

export function getCachedPrediction(stage: string): StaffingAssessment | undefined {
  return memoryCache.get(stage);
}

export function formatWhatsAppSosMessage(params: {
  stage: string;
  workersNeeded: number;
  reason: string;
}): string {
  const profile = FACTORY_COMMUNITY_PROFILE;
  return `📢 *URGENT WORKFORCE SOS: ${profile.whatsappCommunityName || "TEXMIND KNITS"}*\n\n` +
    `🏭 *Factory:* ${profile.address}\n` +
    `📍 *Google Maps:* ${profile.googleMapsUrl}\n` +
    `📞 *Lead Contact:* ${profile.contactPhone}\n\n` +
    `⚡ *Requirement:* *${params.workersNeeded} Workers* for *${params.stage.toUpperCase()}* stage\n` +
    `📝 *Operational Reason:* ${params.reason}\n` +
    `💰 *Rate:* Daily spot wages with OT bonus payable at shift close.\n` +
    `_Please report directly to Gate #2 immediately._`;
}

export function dispatchWhatsAppCommunity(params: {
  stage: string;
  workersNeeded: number;
  reason: string;
  triggerType?: "MANUAL" | "AUTO_AI";
  actorName?: string;
}): WhatsAppCommunityDispatchLog {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const stageConfig = (STAGE_WORKFORCE_CONFIGS as any)[params.stage];
  const stageLabel = stageConfig?.label || params.stage.toUpperCase();
  const messageText = formatWhatsAppSosMessage(params);

  const log: WhatsAppCommunityDispatchLog = {
    id: `sos-${Date.now()}`,
    timestamp: timeStr,
    dispatchedAt: `Today, ${timeStr}`,
    dispatchedBy: params.actorName || "Shift Incharge",
    stage: params.stage,
    stageLabel,
    workersRequested: params.workersNeeded,
    reason: params.reason,
    triggerType: params.triggerType || "MANUAL",
    actorName: params.actorName || "Shift Incharge",
    status: "SENT_TO_COMMUNITY",
    destinationCommunity: FACTORY_COMMUNITY_PROFILE.whatsappCommunityName || "Tiruppur Apparel Guild",
    contactManager: FACTORY_COMMUNITY_PROFILE.contactPerson || "M. Subramaniam",
    contactPhone: FACTORY_COMMUNITY_PROFILE.contactPhone || "+91 98421 77201",
    mapsUrl: FACTORY_COMMUNITY_PROFILE.googleMapsUrl,
    messageText,
  };

  dispatchLogs.unshift(log);
  console.log(`[WHATSAPP SOS DISPATCH] Broadcast to ${log.destinationCommunity}:`, messageText);
  return log;
}

export function getStoredDispatchLogs(): WhatsAppCommunityDispatchLog[] {
  return dispatchLogs;
}

export function calculateEmployeeWageSlip(employee: any, config: any) {
  const rate = config?.pieceRate || 4.5;
  const unit = config?.unit || "pcs";
  const output = Number(employee.todayOutput) || 0;
  const pieceEarnings = Math.round(output * rate);
  const baseShiftPay = 350;
  const overtimeHours = Number(employee.overtimeHours) || 0;
  const overtimeEarnings = Math.round(overtimeHours * 75);
  const grossPay = baseShiftPay + pieceEarnings + overtimeEarnings;

  return {
    employeeId: employee.id,
    name: employee.name,
    stage: employee.stage,
    stageLabel: config?.label || employee.stage,
    role: employee.role || "Operator",
    todayOutput: output,
    output,
    unit,
    pieceRate: rate,
    baseShiftPay,
    baseAllowance: baseShiftPay,
    pieceRateEarnings: pieceEarnings,
    overtimeHours,
    overtimeEarnings,
    grossDailyPay: grossPay,
  };
}

export function calculateStageShiftPayroll(stage: string, employees: any[]) {
  const config = (STAGE_WORKFORCE_CONFIGS as any)[stage] || { pieceRate: 5.0, unit: "pcs", label: stage, maxCapacity: 50 };
  const stageEmps = employees.filter((e) => e.stage === stage && e.attendance === "Present");
  const slips = stageEmps.map((emp) => calculateEmployeeWageSlip(emp, config));
  const totalPay = slips.reduce((sum, s) => sum + s.grossDailyPay, 0);
  const totalOutput = slips.reduce((sum, s) => sum + s.todayOutput, 0);
  const averageDailyWage = slips.length ? Math.round(totalPay / slips.length) : 0;

  return {
    stage,
    stageLabel: config.label || stage,
    unit: config.unit || "pcs",
    operatorCount: stageEmps.length,
    activeWorkers: stageEmps.length,
    maxCapacity: config.maxCapacity || 50,
    totalOutput,
    averageDailyWage,
    wageSlips: slips,
    totalPayrollPayable: totalPay,
  };
}

export function calculateFactoryWidePayroll(employees: any[]) {
  return STAGES.map((stage) => calculateStageShiftPayroll(stage, employees));
}
