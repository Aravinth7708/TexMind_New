export const STAGES = [
  "yarn",
  "knitting",
  "dyeing",
  "compacting",
  "cutting",
  "printing",
  "sewing",
  "ironing",
  "packing",
] as const;

export type StageKey = (typeof STAGES)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  yarn: "Yarn",
  knitting: "Knitting",
  dyeing: "Dyeing",
  compacting: "Compacting",
  cutting: "Cutting",
  printing: "Printing",
  sewing: "Sewing",
  ironing: "Ironing",
  packing: "Packing",
};

export type OrderStatus = "On Track" | "Delayed" | "Completed" | "At Risk";
export type Priority = "High" | "Medium" | "Low";
export type StageState = "completed" | "current" | "pending" | "delayed";

export type StageRecord = {
  key: StageKey;
  label: string;
  state: StageState;
  target: number;
  completed: number;
  pending: number;
  rejected: number;
  progress: number;
  rate: number;
  manager: string;
  expected: string;
};

export type Order = {
  id: string;
  buyerId: string;
  buyer: string;
  product: string;
  category: string;
  styleNo: string;
  poNo: string;
  quantity: number;
  fabric: string;
  color: string;
  startDate: string;
  deliveryDate: string;
  priority: Priority;
  status: OrderStatus;
  currentStage: StageKey;
  progress: number;
  stages: StageRecord[];
};

export type Buyer = {
  id: string;
  name: string;
  company: string;
  country: string;
  contact: string;
  active: number;
  completed: number;
  delayed: number;
  total: number;
  lastOrder: string;
};

const BUYERS_STORAGE_KEY = "texmind_buyers";

export function getStoredBuyers(): Buyer[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(BUYERS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return [];
}

export function saveStoredBuyers(list: Buyer[]): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(BUYERS_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event("texmind-buyers-change"));
    } catch {}
  }
}

export const buyers: Buyer[] = typeof window !== "undefined" ? getStoredBuyers() : [];

const ORDERS_STORAGE_KEY = "texmind_orders";

export function getStoredOrders(): Order[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return [];
}

export function saveStoredOrders(list: Order[]): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event("texmind-orders-change"));
    } catch {}
  }
}

export const orders: Order[] = typeof window !== "undefined" ? getStoredOrders() : [];

export const getOrder = (id: string) => orders.find((o) => o.id.toLowerCase() === id.toLowerCase());

export const totals = {
  orders: orders.length,
  inProduction: orders.filter((o) => o.status !== "Completed").length,
  completed: orders.filter((o) => o.status === "Completed").length,
  delayed: orders.filter((o) => o.status === "Delayed").length,
  producedQty: 0,
  pendingQty: 0,
  onTimeRate: 0,
  health: 0,
};

export const healthBreakdown = [] as any[];

export type StageSummary = {
  key: StageKey;
  label: string;
  orders: number;
  completedQty: number;
  pendingQty: number;
  progress: number;
  load: "High Load" | "Balanced" | "Light";
};

export const stageSummaries: StageSummary[] = STAGES.map((key) => {
  const active = orders.filter((o) => o.status !== "Completed");
  const inStage = active.filter((o) => o.currentStage === key);
  const completedQty = active.reduce((sum, o) => {
    const rec = o.stages.find((s) => s.key === key)!;
    return sum + rec.completed;
  }, 0);
  const pendingQty = active.reduce((sum, o) => {
    const rec = o.stages.find((s) => s.key === key)!;
    return sum + rec.pending;
  }, 0);
  const progress = Math.round((completedQty / Math.max(1, completedQty + pendingQty)) * 100);
  return {
    key,
    label: STAGE_LABELS[key],
    orders: inStage.length,
    completedQty,
    pendingQty,
    progress,
    load: inStage.length >= 3 ? "High Load" : inStage.length >= 2 ? "Balanced" : "Light",
  };
});

export const productionTrend = [] as any[];

export const targetVsActual = [] as any[];

export const stagePerformance = [] as any[];

export const orderStatusSplit = [] as any[];

export type Bottleneck = {
  stage: string;
  pending: number;
  capacity: number;
  required: number;
  risk: "HIGH" | "MEDIUM" | "LOW";
};

export const bottlenecks: Bottleneck[] = [] as any[];

export type Insight = {
  id: string;
  icon: string;
  kind: string;
  title: string;
  body: string;
  action?: string;
  cta: string;
  to: string;
  risk: "HIGH" | "MEDIUM" | "LOW";
  impact: string;
};

export const insights: Insight[] = [] as any[];

export type Material = {
  name: string;
  category: string;
  stock: number;
  reserved: number;
  min: number;
  unit: string;
};

export const materials: Material[] = [] as any[];

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  tone: "info" | "success" | "warning" | "danger";
};

export const adminNotifications: Notification[] = [] as any[];

export const buyerNotifications: Notification[] = [] as any[];

export const BUYER_ID = "BUY-01";
export const buyerOrders = orders.filter((o) => o.buyerId === BUYER_ID);

export const users = [] as any[];

export function sparkline(seed: number, trendUp = true) {
  void seed;
  void trendUp;
  return [];
}

/* ---------- Units: yarn → compacting are weighed in kg, cutting → packing counted in pieces ---------- */

export const KG_STAGES: StageKey[] = ["yarn", "knitting", "dyeing", "compacting"];
export const PIECE_STAGES: StageKey[] = ["cutting", "printing", "sewing", "ironing", "packing"];

export type StageUnit = "kg" | "pcs";

export function unitFor(stage: StageKey): StageUnit {
  return (KG_STAGES as string[]).includes(stage) ? "kg" : "pcs";
}

/* Average fabric consumption per garment including cutting wastage. */
export const KG_PER_PIECE = 0.24;

export function kgForPieces(pieces: number) {
  return Math.round(pieces * KG_PER_PIECE);
}

/* Quantity a stage should receive, in that stage's own unit. */
export function stageQuantity(stage: StageKey, pieces: number) {
  return unitFor(stage) === "kg" ? kgForPieces(pieces) : pieces;
}

export function formatStageQty(stage: StageKey, value: number) {
  return `${value.toLocaleString()} ${unitFor(stage)}`;
}

export const stageManagers: Record<StageKey, string> = {
  yarn: "Unassigned",
  knitting: "Unassigned",
  dyeing: "Unassigned",
  compacting: "Unassigned",
  cutting: "Unassigned",
  printing: "Unassigned",
  sewing: "Unassigned",
  ironing: "Unassigned",
  packing: "Unassigned",
};

export const STAGE_WORKFORCE_CONFIGS: Record<
  StageKey,
  {
    label: string;
    maxCapacity: number;
    requiredOperators: number;
    pieceRate: number;
    unit: string;
    roles: string[];
    hourlyRunRateTarget: number;
    dailyBaseWage: number;
  }
> = Object.fromEntries(STAGES.map((stage) => [stage, { label: STAGE_LABELS[stage], maxCapacity: 0, requiredOperators: 0, pieceRate: 0, unit: unitFor(stage), roles: [], hourlyRunRateTarget: 0, dailyBaseWage: 0 }])) as Record<StageKey, { label: string; maxCapacity: number; requiredOperators: number; pieceRate: number; unit: string; roles: string[]; hourlyRunRateTarget: number; dailyBaseWage: number }>;

export const FACTORY_COMMUNITY_PROFILE = {
  name: "Your Factory",
  cluster: "",
  whatsappCommunityName: "",
  contactPerson: "",
  contactPhone: "",
  landmark: "",
  address: "",
  googleMapsUrl: "",
};

export type EmployeeSkill = "Single Needle" | "Overlock" | "Flatlock" | "Pattern Cutting" | "Dye Dispensing" | "Inspection" | "Skilled Operator" | string;
export type EmployeeShift = "Shift A (Day)" | "Shift B (Evening)" | "Shift C (Night)" | "Shift A (08:00 - 17:00)" | string;
export type EmployeeAttendance = "Present" | "Absent" | "On Leave" | "Overtime" | string;

export interface Employee {
  id: string;
  name: string;
  stage: StageKey;
  role: string;
  skill: EmployeeSkill;
  shift: EmployeeShift;
  attendance: EmployeeAttendance;
  todayOutput: number;
  phone: string;
  experienceYears?: number;
  overtimeHours: number;
  joinedDate?: string;
  [key: string]: any;
}

export const initialEmployees: Employee[] = [] as any[];

export function getStoredEmployees(): Employee[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("texmind_employees");
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return [];
}

export function saveStoredEmployees(emps: Employee[]): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("texmind_employees", JSON.stringify(emps));
    } catch {}
  }
}

export interface ProductionLine {
  id: string;
  name: string;
  stage: StageKey;
  activeOrder: string;
  activeOrderId?: string;
  activeStyle?: string;
  assignedOperators: number;
  maxOperators: number;
  operatorsAssigned: number;
  operatorsOptimal: number;
  targetHourly: number;
  actualHourly: number;
  efficiency: number;
  efficiencyPercent: number;
  status: "running" | "idle" | "bottleneck" | "Optimal" | "Bottleneck" | "Underloaded" | string;
  skillCoverage: {
    singleNeedle: number;
    overlock: number;
    flatlock: number;
  };
  aiRecommendation: string;
  [key: string]: any;
}

export const productionLines: ProductionLine[] = [] as any[];

export interface FactoryAgent {
  id: string;
  name: string;
  domain: string;
  model: string;
  status: "idle" | "active" | "alert" | "awaiting_approval" | string;
  confidence: number;
  lastAction: string;
  lastActive: string;
  role: string;
  currentTask: string;
  keyFinding: string;
  proposals: Array<{
    id: string;
    title: string;
    urgency: "HIGH" | "MEDIUM" | "LOW" | string;
    description: string;
    actionLabel: string;
    action: string;
    impact: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export const factoryAgents: FactoryAgent[] = [] as any[];

export interface ExtractedDocument {
  id: string;
  filename: string;
  buyer: string;
  date: string;
  type: string;
  poNumber: string;
  status: "CONFIRMED" | "NEEDS_REVIEW" | "PROCESSING" | string;
  itemCount: number;
  confidence: number;
  confidenceScore: number;
  uploadedAt: string;
  specs: Record<string, string>;
  extractedFields: {
    buyerName: string;
    styleNumber: string;
    styleCode: string;
    productName: string;
    fabric: string;
    poNumber: string;
    season: string;
    fabricComposition: string;
    gsm: number;
    totalQuantity: number;
    deliveryDate: string;
    specialInstructions: string;
    sizeBreakdown: Array<{ size: string; quantity: number }>;
    colorways: Array<{ color: string; qty: number }>;
    [key: string]: any;
  };
  [key: string]: any;
}

export const sampleDocuments: ExtractedDocument[] = [] as any[];

export interface InventoryForecastItem {
  id: string;
  name: string;
  materialName: string;
  category: string;
  currentStock: number;
  freeStock: number;
  reservedStock: number;
  dailyBurnRate: number;
  daysOfCover: number;
  daysOfCoverRemaining: number;
  stockoutDate: string;
  projectedStockoutDate: string;
  supplier: string;
  activeOrdersDependent: string[];
  suggestedPoQty: number;
  suggestedPoCost: string | number;
  unit: string;
  status: "HEALTHY" | "REORDER_SOON" | "CRITICAL" | "WARNING" | string;
  leadTimeDays: number;
  recommendedOrderQty: number;
  [key: string]: any;
}

export const inventoryForecasts: InventoryForecastItem[] = [] as any[];

export interface DefectHeatmapCell {
  stage: string;
  hour: string;
  defectCount: number;
  defectType: string;
  count: number;
  rate: number;
  severity: "critical" | "major" | "minor" | "high" | "med" | "low" | string;
}

export const defectHeatmapData: DefectHeatmapCell[] = [] as any[];

export interface QualityDrilldown {
  id: string;
  issue: string;
  stage: string;
  frequency: number;
  riskScore: number;
  rootCause: string;
  action: string;
  machine?: string;
  shift?: string;
  operatorLine?: string;
  fabric?: string;
  defectRate: number;
  anomalyDetected?: boolean;
}

export const qualityDrilldowns: QualityDrilldown[] = [] as any[];

export const paretoDefects = [] as any[];

export interface VisionQCSample {
  id: string;
  orderId: string;
  sampleImg: string;
  defectLabel: string;
  confidence: number;
  result: "PASS" | "FAIL" | "REWORK" | string;
  overallResult: "PASS" | "FAIL" | "REWORK" | string;
  timestamp: string;
  itemName?: string;
  stage?: string;
  inspectionTime?: string;
  defects: Array<{
    id: string;
    type: string;
    severity: string;
    label: string;
    confidence: number;
    category: string;
    recommendedAction: string;
    coordinates: { x: number; y: number; width: number; height: number };
    [key: string]: any;
  }>;
}

export const sampleVisionQC: VisionQCSample[] = [] as any[];

export function getDelayPrediction(orderId: string) {
  const order = orders.find((candidate) => candidate.id.toLowerCase() === orderId.toLowerCase());
  if (!order) {
    return {
      orderId,
      predictedDelayDays: 0,
      confidenceScore: 0,
      riskLevel: "LOW",
      confidenceLevel: "No production data",
      stagePaceGapPercent: 0,
      committedDelivery: "",
      predictedCompletion: "",
      buyerCommunicationDraft: { proposedEta: "", recipient: "", buyerCompany: "", subject: "", body: "", approved: false, message: "" },
      stagePaceGaps: [],
      rootCauses: [],
      recoveryScenarios: [],
    };
  }
  return {
    orderId,
    predictedDelayDays: 0,
    confidenceScore: 0,
    riskLevel: "LOW",
    confidenceLevel: "No live prediction available",
    stagePaceGapPercent: 0,
    committedDelivery: order.deliveryDate,
    predictedCompletion: order.deliveryDate,
    buyerCommunicationDraft: { proposedEta: order.deliveryDate, recipient: order.buyer, buyerCompany: order.buyer, subject: "", body: "", approved: false, message: "" },
    stagePaceGaps: [],
    rootCauses: [],
    recoveryScenarios: [],
  };
}

export type DelayPrediction = ReturnType<typeof getDelayPrediction>;
