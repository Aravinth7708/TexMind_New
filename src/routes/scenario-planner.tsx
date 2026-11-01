import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, PageHeader, ProgressBar, StatusBadge } from "@/components/kit/primitives";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orders, getDelayPrediction } from "@/lib/data";

export const Route = createFileRoute("/scenario-planner")({
  head: () => ({
    meta: [
      { title: "AI Scenario Planner & Recovery Simulator — TexMind" },
      {
        name: "description",
        content: "Simulate capacity adjustments, overtime shifts, and subcontracting to recover delayed production orders.",
      },
      { property: "og:title", content: "AI Scenario Planner — TexMind" },
      { property: "og:description", content: "Interactive factory recovery simulation with cost and date projections." },
    ],
  }),
  component: ScenarioPlannerPage,
});

function ScenarioPlannerPage() {
  if (orders.length === 0) {
    return (
      <AppShell>
        <PageHeader title="Scenario Planner" subtitle="Model recovery options for active production orders." />
        <EmptyState icon={PackageSearch} title="No orders to plan yet" body="Create an order to compare recovery scenarios." />
      </AppShell>
    );
  }
  return <ScenarioPlannerContent />;
}

function ScenarioPlannerContent() {
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]!.id);
  const [overtimeHours, setOvertimeHours] = useState(2);
  const [addedOperators, setAddedOperators] = useState(6);
  const [subcontractPercent, setSubcontractPercent] = useState(0);
  const [fastTrackFinishing, setFastTrackFinishing] = useState(true);
  const [isApproved, setIsApproved] = useState(false);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? orders[0]!;
  const prediction = getDelayPrediction(selectedOrderId);

  // Dynamic simulation logic
  const simulation = useMemo(() => {
    const baseDelayDays = prediction.predictedDelayDays || 5;

    // Days recovered from each lever:
    const otRecovery = overtimeHours * 0.9;
    const operatorRecovery = addedOperators * 0.45;
    const subconRecovery = (subcontractPercent / 10) * 0.8;
    const fastTrackRecovery = fastTrackFinishing ? 1.0 : 0;

    const totalDaysRecovered = Math.min(
      baseDelayDays + 1,
      Number((otRecovery + operatorRecovery + subconRecovery + fastTrackRecovery).toFixed(1)),
    );

    const netRemainingDelay = Math.max(0, Number((baseDelayDays - totalDaysRecovered).toFixed(1)));

    // Cost computation:
    const otCost = overtimeHours * 4 * 18 * 180; // 4 days * 18 workers * ₹180/hr
    const lineTransferCost = addedOperators * 800; // Setup & training
    const subcontractCost = (selectedOrder.quantity * (subcontractPercent / 100)) * 14; // ₹14/pc
    const fastTrackCost = fastTrackFinishing ? 8000 : 0;
    const totalCost = otCost + lineTransferCost + subcontractCost + fastTrackCost;

    // Delay penalty saved:
    const delayPenaltyPerDay = 24000;
    const penaltySaved = totalDaysRecovered * delayPenaltyPerDay;
    const netSavings = penaltySaved - totalCost;

    // Output rate boost
    const baseHourlyOutput = 128;
    const boostedHourlyOutput = Math.round(
      baseHourlyOutput + addedOperators * 11 + (overtimeHours > 0 ? 25 : 0),
    );

    return {
      baseDelayDays,
      totalDaysRecovered,
      netRemainingDelay,
      totalCost,
      penaltySaved,
      netSavings,
      boostedHourlyOutput,
      newDeliveryDate:
        netRemainingDelay === 0
          ? selectedOrder.deliveryDate
          : `+${netRemainingDelay} days from ${selectedOrder.deliveryDate}`,
      onTimeAchieved: netRemainingDelay === 0,
    };
  }, [
    prediction.predictedDelayDays,
    overtimeHours,
    addedOperators,
    subcontractPercent,
    fastTrackFinishing,
    selectedOrder.quantity,
    selectedOrder.deliveryDate,
  ]);

  const handleApplyScenario = () => {
    setIsApproved(true);
    toast.success("Recovery Scenario Approved & Staged!", {
      description: `Schedule change dispatched to ${selectedOrder.currentStage} manager. Target delivery confirmed.`,
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="AI Scenario Planner & Recovery Simulator"
        subtitle="Simulate what-if decisions: overtime, operator transfers, and subcontracting to eliminate delivery delays."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Select Order:</span>
            <Select value={selectedOrderId} onValueChange={(val) => { setSelectedOrderId(val); setIsApproved(false); }}>
              <SelectTrigger className="w-[180px] h-9 text-xs font-semibold">
                <SelectValue placeholder="Select Order" />
              </SelectTrigger>
              <SelectContent>
                {orders
                  .filter((o) => o.status !== "Completed")
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      {o.id} ({o.status})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Target Order Context Card */}
      <div className="surface mb-5 p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Sliders className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Simulating: {selectedOrder.id} — {selectedOrder.product}
                </h2>
                <StatusBadge tone={selectedOrder.status === "Delayed" ? "danger" : "warning"}>
                  {selectedOrder.status.toUpperCase()}
                </StatusBadge>
              </div>
              <p className="mt-0.5 text-muted-foreground">
                Buyer: <span className="font-medium text-foreground">{selectedOrder.buyer}</span> · Current
                Stage: <span className="font-semibold capitalize text-foreground">{selectedOrder.currentStage}</span> ·
                Quantity: {selectedOrder.quantity.toLocaleString()} pcs · Committed:{" "}
                <span className="font-semibold text-foreground">{selectedOrder.deliveryDate}</span>
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link to="/orders/$id" params={{ id: selectedOrder.id }}>
              View Order Details <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* LEVERS & CONTROLS (LEFT 5 COLS) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="surface p-5">
            <h3 className="text-sm font-semibold text-foreground">Recovery Levers & Parameters</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Adjust parameters below to immediately calculate cost and delivery changes.
            </p>

            <div className="mt-6 space-y-6">
              {/* Overtime Slider */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">Overtime Shift Extension</span>
                  <span className="font-semibold text-primary">{overtimeHours} Hours / Day</span>
                </div>
                <div className="mt-2.5">
                  <Slider
                    value={[overtimeHours]}
                    min={0}
                    max={4}
                    step={1}
                    onValueChange={(val) => { setOvertimeHours(val[0]!); setIsApproved(false); }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>Standard Shift (0h)</span>
                  <span>Max Overtime (4h)</span>
                </div>
              </div>

              {/* Operator Reallocation Slider */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">Reallocate Sewing Operators</span>
                  <span className="font-semibold text-primary">+{addedOperators} Operators</span>
                </div>
                <div className="mt-2.5">
                  <Slider
                    value={[addedOperators]}
                    min={0}
                    max={12}
                    step={1}
                    onValueChange={(val) => { setAddedOperators(val[0]!); setIsApproved(false); }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Source: Available from completed Line 1 & auxiliary training line.
                </p>
              </div>

              {/* Subcontracting Slider */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">External Subcontracting Lot</span>
                  <span className="font-semibold text-primary">{subcontractPercent}% of Volume</span>
                </div>
                <div className="mt-2.5">
                  <Slider
                    value={[subcontractPercent]}
                    min={0}
                    max={50}
                    step={5}
                    onValueChange={(val) => { setSubcontractPercent(val[0]!); setIsApproved(false); }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {Math.round((selectedOrder.quantity * subcontractPercent) / 100).toLocaleString()} pieces outsourced to Tirupur cluster.
                </p>
              </div>

              {/* Fast-Track Stenter Switch */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <div className="text-xs font-medium text-foreground">Fast-Track Stenter Finishing</div>
                  <div className="text-[11px] text-muted-foreground">Priority lane routing for heat-setting</div>
                </div>
                <Switch
                  checked={fastTrackFinishing}
                  onCheckedChange={(checked) => { setFastTrackFinishing(checked); setIsApproved(false); }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Controlled Approval Gate:</span>
                <p className="mt-0.5">
                  Simulated scenarios never adjust factory schedules automatically. Approval creates a formal change order signed with your manager credentials.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SIMULATED IMPACT DASHBOARD (RIGHT 7 COLS) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Simulated Impact & Outcome</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Real-time recalculated delivery, cost, and capacity metrics.
                </p>
              </div>
              {simulation.onTimeAchieved ? (
                <StatusBadge tone="success">100% ON-TIME RECOVERY</StatusBadge>
              ) : (
                <StatusBadge tone="warning">{`${simulation.netRemainingDelay} DAYS DELAY REMAINING`}</StatusBadge>
              )}
            </div>

            {/* Core Outcome KPI Tiles */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="size-3.5" />
                  Delivery Date
                </div>
                <div
                  className={`metric mt-1 text-base font-bold ${
                    simulation.onTimeAchieved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"
                  }`}
                >
                  {simulation.newDeliveryDate}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Committed: {selectedOrder.deliveryDate}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <TrendingDown className="size-3.5 text-emerald-600" />
                  Delay Recovered
                </div>
                <div className="metric mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
                  -{simulation.totalDaysRecovered} Days
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Base delay: {simulation.baseDelayDays} days
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Users className="size-3.5 text-primary" />
                  Sewing Pace
                </div>
                <div className="metric mt-1 text-base font-bold text-primary">
                  {simulation.boostedHourlyOutput} pcs/hr
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Baseline: 128 pcs/hr (+{Math.round(((simulation.boostedHourlyOutput - 128) / 128) * 100)}%)
                </div>
              </div>
            </div>

            {/* Financial Trade-off Analysis */}
            <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Financial Trade-off Analysis (Wages vs Penalties)
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Net Benefit: +₹{Math.max(0, simulation.netSavings).toLocaleString()}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Additional Operational Cost:</span>
                  <span className="font-semibold text-destructive">
                    ₹{simulation.totalCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buyer Delay Penalty Prevented:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ₹{simulation.penaltySaved.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between font-bold">
                  <span>Net Factory ROI:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{( (simulation.penaltySaved / Math.max(1, simulation.totalCost)) * 100 ).toFixed(0)}% Return
                  </span>
                </div>
              </div>
            </div>

            {/* Affected Orders Safeguard */}
            <div className="mt-4 rounded-lg border border-border bg-card p-3.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <AlertTriangle className="size-3.5 text-amber-500" />
                Cross-Order Capacity Impact Check
              </div>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                Review the active production schedule for downstream effects before applying this scenario.
              </p>
            </div>

            {/* Approval Action */}
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <div className="text-xs text-muted-foreground">
                Ready to execute this plan on the shop floor?
              </div>
              {isApproved ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white">
                  <CheckCircle2 className="size-4" />
                  Scenario Approved & Scheduled
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={handleApplyScenario}
                  className="gap-1.5 bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Send className="size-3.5" />
                  Submit Scenario for Manager Approval
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
