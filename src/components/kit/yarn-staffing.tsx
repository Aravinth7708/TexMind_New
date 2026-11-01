import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  Briefcase,
  Send,
  Shuffle,
  RefreshCw,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Flame,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Clock,
  Layers,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  STAGE_WORKFORCE_CONFIGS,
  orders,
  type StageKey,
} from "@/lib/data";

export interface OrderStaffing {
  id: string;
  buyer: string;
  product: string;
  targetPcs: number;
  priority: "Critical" | "High" | "Normal";
  requiredWorkers: number;
  assignedWorkers: number;
}

export interface StageStaffingSectionProps {
  stage?: StageKey;
}

// Generate realistic active staffing lines for each of the 9 production stages
function getInitialOrdersForStage(stage: StageKey, maxCap: number): OrderStaffing[] {
  // Find real orders that match or are relevant to this stage
  const matching = orders.filter((o) => {
    const st = o.stages.find((s) => s.key === stage);
    return o.currentStage === stage || (st && st.state !== "completed");
  });

  const selected = (matching.length >= 2 ? matching : orders).slice(0, 3);
  
  // Proportions of max capacity (always <= 100)
  const req1 = Math.max(2, Math.round(maxCap * 0.4));
  const req2 = Math.max(2, Math.round(maxCap * 0.35));
  const req3 = Math.max(1, maxCap - req1 - req2);

  const priorities: Array<"Critical" | "High" | "Normal"> = ["Critical", "High", "Normal"];

  return selected.map((ord, idx) => {
    const req = idx === 0 ? req1 : idx === 1 ? req2 : req3;
    // Initial assigned: keep a realistic shortage on the second order
    const shortage = idx === 1 ? Math.min(req, Math.max(2, Math.round(maxCap * 0.2))) : 0;
    const assigned = Math.max(0, req - shortage);

    return {
      id: ord.id,
      buyer: ord.buyer,
      product: ord.product,
      targetPcs: ord.quantity,
      priority: (ord.priority as "Critical" | "High" | "Normal") || priorities[idx] || "Normal",
      requiredWorkers: req,
      assignedWorkers: assigned,
    };
  });
}

export function StageStaffingSection({ stage = "yarn" }: StageStaffingSectionProps) {
  const config = STAGE_WORKFORCE_CONFIGS[stage] ?? STAGE_WORKFORCE_CONFIGS.yarn;

  // STRICT GUARANTEE: Maximum capacity ceiling can NEVER exceed 100 for any section
  const MAX_CAPACITY = useMemo(() => {
    return Math.min(100, Math.max(1, config.maxCapacity ?? 50));
  }, [config.maxCapacity]);

  // Selected factory shift
  const [selectedShift, setSelectedShift] = useState<string>("Shift A (08:00 - 17:00)");

  // Active staffing orders
  const [staffOrders, setStaffOrders] = useState<OrderStaffing[]>(() =>
    getInitialOrdersForStage(stage, Math.min(100, config.maxCapacity ?? 50))
  );

  // Live present workers on the floor today
  const [presentWorkers, setPresentWorkers] = useState<number>(() => {
    const initial = getInitialOrdersForStage(stage, Math.min(100, config.maxCapacity ?? 50));
    return Math.min(
      Math.min(100, config.maxCapacity ?? 50),
      initial.reduce((acc, o) => acc + o.assignedWorkers, 0)
    );
  });

  // Re-synchronize when stage changes
  useEffect(() => {
    const cap = Math.min(100, config.maxCapacity ?? 50);
    const initial = getInitialOrdersForStage(stage, cap);
    setStaffOrders(initial);
    const assignedSum = initial.reduce((acc, o) => acc + o.assignedWorkers, 0);
    setPresentWorkers(Math.min(cap, assignedSum));
    setBroadcastActive(false);
  }, [stage, config.maxCapacity]);

  // Derived totals with strict mathematical guarantees
  const totalAssigned = useMemo(
    () => staffOrders.reduce((acc, o) => acc + o.assignedWorkers, 0),
    [staffOrders]
  );

  const totalRequired = useMemo(
    () => staffOrders.reduce((acc, o) => acc + o.requiredWorkers, 0),
    [staffOrders]
  );

  // Workforce target cannot exceed physical factory ceiling (max 100)
  const targetWorkforce = useMemo(
    () => Math.min(MAX_CAPACITY, totalRequired),
    [MAX_CAPACITY, totalRequired]
  );

  // Floor buffer pool: present workers on floor not yet assigned to machines
  const floorAvailable = useMemo(
    () => Math.max(0, presentWorkers - totalAssigned),
    [presentWorkers, totalAssigned]
  );

  // Shortage: How many more workers are needed to reach the target workforce.
  // Crucial invariant: If presentWorkers >= targetWorkforce, shortage is strictly 0!
  const calculatedShortage = useMemo(
    () => Math.max(0, targetWorkforce - presentWorkers),
    [targetWorkforce, presentWorkers]
  );

  // Live estimated run-rate based on active assigned staff
  const liveRunRateEstimate = useMemo(() => {
    if (MAX_CAPACITY <= 0) return 0;
    const ratio = totalAssigned / MAX_CAPACITY;
    return Math.round(config.hourlyRunRateTarget * ratio);
  }, [totalAssigned, MAX_CAPACITY, config.hourlyRunRateTarget]);

  // WhatsApp broadcast state
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastActive, setBroadcastActive] = useState<boolean>(false);
  const [lastSentTime, setLastSentTime] = useState<string | null>(null);
  const [waConnected, setWaConnected] = useState<boolean>(true);

  // Check WhatsApp server connection on mount
  useEffect(() => {
    fetch("http://localhost:3001/api/whatsapp/status")
      .then((res) => res.json())
      .then((data) => {
        setWaConnected(data.status === "connected");
      })
      .catch(() => setWaConnected(false));
  }, []);

  // Adjust Present Workers (+ / - Attendance)
  // Strictly capped between 0 and MAX_CAPACITY (never exceeding 100).
  const handlePresentWorkersChange = useCallback(
    (delta: number) => {
      setPresentWorkers((prev) => {
        const next = Math.max(0, Math.min(MAX_CAPACITY, prev + delta));

        if (next < totalAssigned) {
          const toTrim = totalAssigned - next;
          setStaffOrders((currentOrders) => {
            let remainingTrim = toTrim;
            const priorityOrder: Array<"Normal" | "High" | "Critical"> = [
              "Normal",
              "High",
              "Critical",
            ];
            const updated = [...currentOrders];

            for (const p of priorityOrder) {
              for (let i = 0; i < updated.length; i++) {
                const target = updated[i];
                if (target && target.priority === p && remainingTrim > 0) {
                  const deduct = Math.min(target.assignedWorkers, remainingTrim);
                  updated[i] = {
                    ...target,
                    assignedWorkers: target.assignedWorkers - deduct,
                  };
                  remainingTrim -= deduct;
                }
              }
            }
            return updated;
          });
        }

        return next;
      });
    },
    [MAX_CAPACITY, totalAssigned]
  );

  // Stepper: Manual Assign to Order
  const updateOrderStaff = useCallback(
    (orderId: string, delta: number) => {
      setStaffOrders((prev) => {
        const currentAssigned = prev.reduce((acc, o) => acc + o.assignedWorkers, 0);
        const available = Math.max(0, presentWorkers - currentAssigned);

        return prev.map((order) => {
          if (order.id !== orderId) return order;

          if (delta > 0) {
            const roomInOrder = Math.max(0, order.requiredWorkers - order.assignedWorkers);
            const maxCanAdd = Math.min(delta, available, roomInOrder);

            if (maxCanAdd <= 0) {
              if (roomInOrder <= 0) {
                toast.warning(`Order ${order.id} staff requirement is already fulfilled.`);
              } else {
                toast.warning("No buffer workers available on floor. Check in more workers.");
              }
              return order;
            }
            return { ...order, assignedWorkers: order.assignedWorkers + maxCanAdd };
          } else {
            return { ...order, assignedWorkers: Math.max(0, order.assignedWorkers + delta) };
          }
        });
      });
    },
    [presentWorkers]
  );

  // Direct Input / Preset Assign
  const setOrderStaffDirect = useCallback(
    (orderId: string, count: number) => {
      setStaffOrders((prev) => {
        const otherAssigned = prev
          .filter((o) => o.id !== orderId)
          .reduce((acc, o) => acc + o.assignedWorkers, 0);
        const targetOrder = prev.find((o) => o.id === orderId);
        if (!targetOrder) return prev;

        const maxAvailableFromFloor = Math.max(0, presentWorkers - otherAssigned);
        const maxAllowed = Math.min(targetOrder.requiredWorkers, maxAvailableFromFloor);
        const clampedCount = Math.max(0, Math.min(count, maxAllowed));

        if (count > maxAllowed) {
          toast.warning(
            `Capped at ${maxAllowed} workers (${
              maxAllowed === targetOrder.requiredWorkers
                ? "order requirement met"
                : "no more buffer workers"
            }).`
          );
        }

        return prev.map((order) => {
          if (order.id !== orderId) return order;
          return { ...order, assignedWorkers: clampedCount };
        });
      });
    },
    [presentWorkers]
  );

  // Priority Auto-Assign
  const handlePriorityAssign = useCallback(() => {
    let pool = presentWorkers;
    const priorityWeight = { Critical: 1, High: 2, Normal: 3 };
    const sorted = [...staffOrders].sort(
      (a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]
    );

    const allocationMap = new Map<string, number>();
    sorted.forEach((order) => {
      const toAssign = Math.min(pool, order.requiredWorkers);
      allocationMap.set(order.id, toAssign);
      pool = Math.max(0, pool - toAssign);
    });

    setStaffOrders((prev) =>
      prev.map((order) => ({
        ...order,
        assignedWorkers: allocationMap.get(order.id) ?? 0,
      }))
    );

    toast.success(`Priority staff allocation applied for ${config.label}!`, {
      description: `Critical orders prioritized across ${presentWorkers} present operators.`,
    });
  }, [presentWorkers, staffOrders, config.label]);

  // Balanced / Random Auto-Assign
  const handleRandomAssign = useCallback(() => {
    let pool = presentWorkers;
    const criticals = staffOrders.filter((o) => o.priority === "Critical");
    const others = staffOrders.filter((o) => o.priority !== "Critical");

    const allocationMap = new Map<string, number>();

    criticals.forEach((order) => {
      const assign = Math.min(pool, order.requiredWorkers);
      allocationMap.set(order.id, assign);
      pool = Math.max(0, pool - assign);
    });

    const shuffled = [...others].sort(() => Math.random() - 0.5);
    shuffled.forEach((order) => {
      const assign = Math.min(pool, order.requiredWorkers);
      allocationMap.set(order.id, assign);
      pool = Math.max(0, pool - assign);
    });

    setStaffOrders((prev) =>
      prev.map((order) => ({
        ...order,
        assignedWorkers: allocationMap.get(order.id) ?? 0,
      }))
    );

    toast.success(`Random priority staff distribution applied for ${config.label}!`, {
      description: `Distributed present workers respecting order capacities.`,
    });
  }, [presentWorkers, staffOrders, config.label]);

  // Reset All Assignments to 0
  const handleResetAssignments = useCallback(() => {
    setStaffOrders((prev) => prev.map((o) => ({ ...o, assignedWorkers: 0 })));
    toast.info("All order assignments reset to 0 (workers moved to floor buffer).");
  }, []);

  // WhatsApp Notification Sender
  const sendWhatsAppNotification = useCallback(
    async (count: number) => {
      setIsBroadcasting(true);
      try {
        const today = new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

        const response = await fetch("http://localhost:3001/api/whatsapp/send-staffing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unit: config.label,
            workersNeeded: count,
            date: today,
            shift: selectedShift,
            location: `TexMind Factory — ${config.label} Department`,
            contact: "+91 6383667872",
            orderId: `${stage.toUpperCase()}-UNIT`,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          const nowStr = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          setLastSentTime(nowStr);

          if (count > 0) {
            setBroadcastActive(true);
            toast.success(`WhatsApp Shortage Broadcast Sent for ${config.label}!`, {
              description: `Broadcasted shortage request for ${count} workers to Texmind Group.`,
            });
          } else {
            setBroadcastActive(false);
            toast.success(`All Positions Filled Notice Sent for ${config.label}!`, {
              description: "Sent 'Staff Request Filled' completion notice to WhatsApp Group.",
            });
          }
        } else {
          throw new Error(result.error || "Failed to send WhatsApp message");
        }
      } catch (err: any) {
        toast.error("Failed to send WhatsApp notification", {
          description:
            err.message || "Ensure nodejs-backend is running with active WhatsApp session.",
        });
      } finally {
        setIsBroadcasting(false);
      }
    },
    [config.label, selectedShift, stage]
  );

  // Decremental Arrival (+1 / +5 Worker Confirmed via WhatsApp)
  const handleWorkerJoined = useCallback(
    (joinedCount = 1) => {
      if (presentWorkers >= MAX_CAPACITY || calculatedShortage <= 0) {
        toast.info(
          `${config.label} is already operating at maximum capacity (${MAX_CAPACITY}/${MAX_CAPACITY} present).`
        );
        return;
      }

      const actualJoined = Math.min(
        joinedCount,
        MAX_CAPACITY - presentWorkers,
        calculatedShortage
      );
      const nextPresent = presentWorkers + actualJoined;
      const nextShortage = Math.max(0, targetWorkforce - nextPresent);

      handlePresentWorkersChange(actualJoined);
      sendWhatsAppNotification(nextShortage);
    },
    [
      presentWorkers,
      MAX_CAPACITY,
      calculatedShortage,
      targetWorkforce,
      config.label,
      handlePresentWorkersChange,
      sendWhatsAppNotification,
    ]
  );

  return (
    <div className="mt-8 space-y-6">
      {/* ──────────────── Section Header ──────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {config.label} — Staffing & Workforce Allocation
            </h2>
            <Badge variant="outline" className="text-[11px] font-semibold text-primary border-primary/30">
              Strict Ceiling: {MAX_CAPACITY} Max (≤ 100)
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              Target: {config.hourlyRunRateTarget} {config.unit}/hr
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            <span>Live floor line allocation, buffer management, and emergency WhatsApp contractor dispatch.</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-foreground font-medium">Unit: {config.unit.toUpperCase()}</span>
          </p>

          {/* Department Roles Bar */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mr-1">
              <Layers className="size-3 text-muted-foreground" /> Specialized Roles:
            </span>
            {config.roles.map((role) => (
              <span
                key={role}
                className="inline-flex items-center rounded-md bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-foreground/80 border border-border/50"
              >
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Right Header Controls: Shift Selector & WhatsApp Status */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs font-medium">
            <Clock className="size-3.5 text-muted-foreground ml-1" />
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="bg-transparent text-xs font-medium focus:outline-hidden cursor-pointer pr-1"
            >
              <option value="Shift A (08:00 - 17:00)">Shift A (08:00 - 17:00)</option>
              <option value="Shift B (17:00 - 01:00)">Shift B (17:00 - 01:00)</option>
              <option value="General Shift (09:00 - 18:00)">General (09:00 - 18:00)</option>
            </select>
          </div>

          {waConnected ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>
                WhatsApp Group: <strong>Texmind</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
              <AlertCircle className="size-3.5 text-amber-600" />
              <span>WhatsApp Offline (Check port 3001)</span>
            </div>
          )}
        </div>
      </div>

      {/* ──────────────── 4 Top Stat Cards ──────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Max Employed Capacity */}
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Max Section Capacity
            </span>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {MAX_CAPACITY}
            </span>
            <span className="text-xs font-medium text-muted-foreground">max ceiling (≤ 100)</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Engineered Ceiling</span>
              <span className="font-semibold text-foreground">100%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "100%" }} />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Strict floor rule: department ceiling is capped at {MAX_CAPACITY} operators.
          </p>
        </div>

        {/* Card 2: Today Live Present Workers */}
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Today Present Workers
            </span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <UserCheck className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                {presentWorkers}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                / {MAX_CAPACITY} workers
              </span>
            </div>
            {/* Quick attendance adjuster */}
            <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
              <button
                onClick={() => handlePresentWorkersChange(-1)}
                disabled={presentWorkers <= 0}
                className="size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="1 absent (Decrements present count)"
              >
                <Minus className="size-3" />
              </button>
              <button
                onClick={() => handlePresentWorkersChange(1)}
                disabled={presentWorkers >= MAX_CAPACITY}
                className="size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
                title={`1 checked-in (Cannot exceed ${MAX_CAPACITY})`}
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Attendance Rate</span>
              <span className="font-semibold text-emerald-600">
                {MAX_CAPACITY > 0 ? Math.round((presentWorkers / MAX_CAPACITY) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{
                  width: `${MAX_CAPACITY > 0 ? (presentWorkers / MAX_CAPACITY) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {MAX_CAPACITY - presentWorkers === 0
              ? `All ${MAX_CAPACITY} operators present (0 absent / 100% full).`
              : `${MAX_CAPACITY - presentWorkers} operators absent / on approved leave.`}
          </p>
        </div>

        {/* Card 3: Assigned on Floor & Run-Rate */}
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assigned On Floor
            </span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <Briefcase className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {totalAssigned}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                / {presentWorkers} present
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-primary flex items-center gap-0.5">
                <Activity className="size-3" /> {liveRunRateEstimate} {config.unit}/h
              </span>
              <span className="text-[10px] text-muted-foreground block">effective run rate</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Floor Utilization</span>
              <span className="font-semibold text-foreground">
                {presentWorkers > 0
                  ? Math.min(100, Math.round((totalAssigned / presentWorkers) * 100))
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    presentWorkers > 0
                      ? Math.min(100, (totalAssigned / presentWorkers) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {floorAvailable} present workers unassigned / available on buffer.
          </p>
        </div>

        {/* Card 4: Staff Balance Needed (Shortage) */}
        <div
          className={`relative overflow-hidden rounded-xl border p-4 shadow-xs transition hover:shadow-sm ${
            calculatedShortage > 0
              ? "border-amber-500/40 bg-gradient-to-br from-amber-50/50 to-orange-50/20 dark:from-amber-950/20 dark:to-orange-950/10"
              : "border-emerald-500/40 bg-gradient-to-br from-emerald-50/60 to-emerald-100/20 dark:from-emerald-950/20 dark:to-emerald-900/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                calculatedShortage > 0
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              Staff Balance Needed
            </span>
            <div
              className={`rounded-lg p-2 ${
                calculatedShortage > 0
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-500/20 text-emerald-600"
              }`}
            >
              {calculatedShortage > 0 ? (
                <Flame className="size-4" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-extrabold tracking-tight ${
                  calculatedShortage > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600"
                }`}
              >
                {calculatedShortage}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {calculatedShortage > 0 ? "workers needed" : "fully staffed"}
              </span>
            </div>
            {calculatedShortage > 0 ? (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Shortage
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3" /> Fully Staffed
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {calculatedShortage > 0 ? (
              <Button
                size="sm"
                className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                disabled={isBroadcasting}
                onClick={() => sendWhatsAppNotification(calculatedShortage)}
              >
                {isBroadcasting ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Broadcasting…
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    Send WhatsApp Shortage ({calculatedShortage})
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5 border-emerald-500/50 bg-emerald-50/50 hover:bg-emerald-100/50 text-emerald-700 dark:text-emerald-300 font-semibold text-xs shadow-xs"
                disabled={isBroadcasting}
                onClick={() => sendWhatsAppNotification(0)}
              >
                {isBroadcasting ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Broadcasting…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    Broadcast All-Filled Notice (0)
                  </>
                )}
              </Button>
            )}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground truncate">
            {calculatedShortage === 0
              ? `All positions filled for ${config.label}. No more workers needed.`
              : broadcastActive && lastSentTime
              ? `Last broadcast sent at ${lastSentTime}`
              : `Broadcasts shortage to WhatsApp Texmind group for ${config.label}`}
          </p>
        </div>
      </div>

      {/* ──────────────── Active WhatsApp Broadcast Card (Interactive Decrement) ──────────────── */}
      {broadcastActive && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <MessageCircle className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-foreground">
                    Active WhatsApp Staff Broadcast in{" "}
                    <span className="text-emerald-600 font-bold">Texmind Group</span>
                  </h4>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                    Live Broadcast • {config.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current Shortage: <strong>{calculatedShortage} workers needed</strong> (Floor:{" "}
                  {presentWorkers}/{MAX_CAPACITY} present). As workers confirm, click below to auto-notify the WhatsApp group.
                </p>
              </div>
            </div>

            {/* Decremental Arrival Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
                disabled={isBroadcasting || calculatedShortage <= 0 || presentWorkers >= MAX_CAPACITY}
                onClick={() => handleWorkerJoined(1)}
              >
                <Plus className="size-3.5" />
                +1 Worker Confirmed (Auto-Notify WA)
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={isBroadcasting || calculatedShortage <= 0 || presentWorkers >= MAX_CAPACITY}
                onClick={() => handleWorkerJoined(5)}
              >
                +5 Confirmed
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="text-xs"
                disabled={isBroadcasting}
                onClick={() => {
                  setBroadcastActive(false);
                  sendWhatsAppNotification(0);
                }}
              >
                Close & Mark Filled (0)
              </Button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-emerald-500/20 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">Current Shortage Status:</span>
              <span
                className={`font-bold text-sm ${
                  calculatedShortage > 0 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {calculatedShortage} Workers Required
              </span>
              {calculatedShortage === 0 && (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Fully Filled
                </span>
              )}
            </div>
            <span>
              Auto-synced with WhatsApp group <code>120363428921921565@g.us</code>
            </span>
          </div>
        </div>
      )}

      {/* ──────────────── Manual Order Staff Assignment Panel ──────────────── */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b bg-muted/20">
          <div>
            <h3 className="font-semibold text-base text-foreground">
              {config.label} — Order-Wise Staff Allocation
            </h3>
            <p className="text-xs text-muted-foreground">
              Manually assign operators per order line. Assignments are strictly capped by order requirements and present floor workers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-medium"
              onClick={handlePriorityAssign}
            >
              <Sparkles className="size-3.5 text-primary" />
              Priority Auto-Assign
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-medium"
              onClick={handleRandomAssign}
            >
              <Shuffle className="size-3.5 text-primary" />
              Random Auto-Assign
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleResetAssignments}
            >
              <RotateCcw className="size-3" />
              Reset All
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Buyer & Product</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3 text-right">Target ({config.unit})</th>
                <th className="px-4 py-3 text-center">Required Staff</th>
                <th className="px-4 py-3 text-center">Assigned Workers</th>
                <th className="px-4 py-3 text-right">Quick Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staffOrders.map((order) => {
                const percent = Math.min(
                  100,
                  Math.round(
                    (order.assignedWorkers / Math.max(1, order.requiredWorkers)) * 100
                  )
                );
                const isFullyAssigned = order.assignedWorkers >= order.requiredWorkers;
                const canAddMore = !isFullyAssigned && floorAvailable > 0;

                return (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    {/* Order ID */}
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {order.id}
                    </td>

                    {/* Buyer & Product */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{order.buyer}</div>
                      <div className="text-xs text-muted-foreground">{order.product}</div>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3">
                      {order.priority === "Critical" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                          <Flame className="size-3" /> Critical
                        </span>
                      ) : order.priority === "High" ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          High
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Normal
                        </span>
                      )}
                    </td>

                    {/* Target pcs / kg */}
                    <td className="px-4 py-3 text-right font-medium">
                      {order.targetPcs.toLocaleString()} {config.unit}
                    </td>

                    {/* Required Staff */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-foreground">{order.requiredWorkers}</span>
                      <span className="text-xs text-muted-foreground ml-1">staff</span>
                    </td>

                    {/* Assigned Workers Stepper */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => updateOrderStaff(order.id, -1)}
                          disabled={order.assignedWorkers <= 0}
                          className="size-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs"
                          title="Unassign 1 worker (returns to buffer)"
                        >
                          <Minus className="size-3.5" />
                        </button>

                        <div className="relative">
                          <Input
                            type="number"
                            value={order.assignedWorkers}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setOrderStaffDirect(order.id, isNaN(val) ? 0 : val);
                            }}
                            onBlur={(e) => {
                              e.target.value = String(order.assignedWorkers);
                            }}
                            className="w-16 h-8 text-center font-bold text-sm"
                            min={0}
                            max={order.requiredWorkers}
                          />
                        </div>

                        <button
                          onClick={() => updateOrderStaff(order.id, 1)}
                          disabled={!canAddMore}
                          className="size-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs"
                          title={
                            isFullyAssigned
                              ? "Order staff requirement fulfilled (Max)"
                              : floorAvailable <= 0
                              ? "No buffer workers available on floor"
                              : "Assign 1 worker from floor buffer"
                          }
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>

                      {/* Mini progress bar */}
                      <div className="mt-1.5 h-1.5 w-24 mx-auto rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            percent >= 100
                              ? "bg-emerald-500"
                              : percent >= 50
                              ? "bg-blue-500"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </td>

                    {/* Quick Preset Buttons (Strictly Clamped) */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          disabled={order.assignedWorkers === 0}
                          onClick={() => setOrderStaffDirect(order.id, 0)}
                          title="Reset this order to 0"
                        >
                          0
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled={
                            order.assignedWorkers === Math.round(order.requiredWorkers / 2) ||
                            (floorAvailable <= 0 &&
                              order.assignedWorkers < Math.round(order.requiredWorkers / 2))
                          }
                          onClick={() =>
                            setOrderStaffDirect(
                              order.id,
                              Math.round(order.requiredWorkers / 2)
                            )
                          }
                          title={`Assign 50% (${Math.round(order.requiredWorkers / 2)} workers)`}
                        >
                          50%
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 px-2 text-[11px] font-semibold"
                          disabled={
                            isFullyAssigned ||
                            (floorAvailable <= 0 && order.assignedWorkers >= order.requiredWorkers)
                          }
                          onClick={() =>
                            setOrderStaffDirect(
                              order.id,
                              order.assignedWorkers +
                                Math.min(
                                  floorAvailable,
                                  order.requiredWorkers - order.assignedWorkers
                                )
                            )
                          }
                          title={`Fill up to Max requirement (${order.requiredWorkers})`}
                        >
                          Max ({order.requiredWorkers})
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary with Live Mathematical Invariants */}
        <div className="p-4 border-t bg-muted/10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <span>
              Total Assigned:{" "}
              <strong className="text-foreground">{totalAssigned}</strong> / {presentWorkers} present
            </span>
            <span>•</span>
            <span>
              Present Pool:{" "}
              <strong className="text-emerald-600">{presentWorkers}</strong> / {MAX_CAPACITY} max (≤ 100)
            </span>
            <span>•</span>
            <span>
              Idle / Floor Buffer:{" "}
              <strong className="text-foreground">{floorAvailable}</strong> workers
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Shortage Balance:</span>
            <span
              className={`font-bold text-sm ${
                calculatedShortage > 0 ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {calculatedShortage}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={isBroadcasting}
              className={`h-7 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 ${
                calculatedShortage === 0 ? "bg-emerald-50/50" : ""
              }`}
              onClick={() => sendWhatsAppNotification(calculatedShortage)}
            >
              <Send className="size-3" />
              {calculatedShortage > 0
                ? `Notify Texmind Group (${calculatedShortage})`
                : "Notify Texmind Group (0 - Filled)"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Backwards-compatible export so existing imports never break
export function YarnStaffingSection({ stage = "yarn" }: { stage?: StageKey } = {}) {
  return <StageStaffingSection stage={stage} />;
}
