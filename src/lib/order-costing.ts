import { STAGES, STAGE_LABELS, type StageKey } from "@/lib/data";

export type OrderCosting = {
  stageCosts: Record<StageKey, number>;
  materialCost: number;
  packagingCost: number;
  logisticsCost: number;
  otherCost: number;
  buyerOrderTotal: number;
};

const STORAGE_KEY = "texmind-order-costing";
const CHANGE_EVENT = "texmind-order-costing-change";
export const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const emptyStageCosts = (): Record<StageKey, number> =>
  Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<StageKey, number>;

export function emptyOrderCosting(): OrderCosting {
  return {
    stageCosts: emptyStageCosts(),
    materialCost: 0,
    packagingCost: 0,
    logisticsCost: 0,
    otherCost: 0,
    buyerOrderTotal: 0,
  };
}

export function readOrderCosting(orderId: string): OrderCosting {
  if (typeof window === "undefined") return emptyOrderCosting();
  try {
    const all = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, Partial<OrderCosting>>;
    const saved = all[orderId];
    if (!saved) return emptyOrderCosting();
    return {
      ...emptyOrderCosting(),
      ...saved,
      stageCosts: { ...emptyStageCosts(), ...saved.stageCosts },
    };
  } catch {
    return emptyOrderCosting();
  }
}

export function saveOrderCosting(orderId: string, costing: OrderCosting) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, OrderCosting>;
    all[orderId] = costing;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { orderId } }));
  } catch {
    // Keep the UI usable if browser storage is unavailable.
  }
}

export async function fetchOrderCosting(orderId: string, buyerView = false): Promise<OrderCosting | null> {
  try {
    const route = buyerView ? `/api/buyer/orders/${encodeURIComponent(orderId)}/costing` : `/api/orders/${encodeURIComponent(orderId)}/costing`;
    const response = await fetch(`${API_BASE_URL}${route}`, { credentials: "include" });
    if (!response.ok) return null;
    const data = await response.json();
    if (buyerView) return { ...emptyOrderCosting(), buyerOrderTotal: Number(data.buyerOrderTotal) || 0 };
    if (!data) return emptyOrderCosting();
    return {
      ...emptyOrderCosting(),
      ...data,
      stageCosts: { ...emptyStageCosts(), ...data.stageCosts },
    };
  } catch {
    return null;
  }
}

export async function saveOrderCostingToServer(orderId: string, costing: OrderCosting) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}/costing`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(costing),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function subscribeOrderCosting(orderId: string, callback: () => void) {
  const onChange = (event: Event) => {
    if ((event as CustomEvent<{ orderId?: string }>).detail?.orderId === orderId) callback();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getManufacturingCost(costing: OrderCosting) {
  return Object.values(costing.stageCosts).reduce((sum, cost) => sum + Number(cost || 0), 0)
    + Number(costing.materialCost || 0)
    + Number(costing.packagingCost || 0)
    + Number(costing.logisticsCost || 0)
    + Number(costing.otherCost || 0);
}

export function getStageLabel(stage: StageKey) {
  return STAGE_LABELS[stage];
}

export const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
