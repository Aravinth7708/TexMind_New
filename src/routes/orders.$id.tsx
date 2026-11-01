import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileDown,
  PackageSearch,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  Cpu,
  ChevronRight,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import {
  EmptyState,
  PageHeader,
  ProgressBar,
  StatusBadge,
} from "@/components/kit/primitives";
import { ProductionTimeline, StageDot } from "@/components/kit/production";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getOrder, getDelayPrediction, type StageRecord } from "@/lib/data";
import { RootCauseModal } from "@/components/kit/root-cause-modal";
import { BuyerCopilotModal } from "@/components/kit/buyer-copilot-modal";
import { ManagerOrderCostBreakdown } from "@/components/kit/order-cost-breakdown";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/orders/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.id} — TexMind` },
      {
        name: "description",
        content: `Production command centre for order ${params.id}: stage timeline, delay prediction and recovery scenarios.`,
      },
      { property: "og:title", content: `Order ${params.id} — TexMind` },
      { property: "og:description", content: "AI delivery risk prediction and production tracking." },
    ],
  }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { id } = Route.useParams();
  const session = useSession();
  const order = getOrder(id);
  const prediction = getDelayPrediction(id);
  const [selected, setSelected] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [approvedScenarios, setApprovedScenarios] = useState<Record<string, boolean>>({});

  if (!order) {
    return (
      <AppShell>
        <EmptyState
          icon={PackageSearch}
          title="Order not found"
          body={`No order matches “${id}”. It may have been archived or the link is incorrect.`}
          action={
            <Button asChild size="sm">
              <Link to="/orders">Back to orders</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const current: StageRecord =
    order.stages.find((s) => s.key === (selected ?? order.currentStage)) ?? order.stages[0]!;

  const handleApproveScenario = (scId: string, title: string) => {
    setApprovedScenarios((prev) => ({ ...prev, [scId]: true }));
    toast.success("Recovery Action Approved!", {
      description: `${title} has been logged to the factory operations schedule.`,
    });
  };

  return (
    <AppShell>
      <Link
        to="/orders"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All orders
      </Link>

      <PageHeader
        title={`Order #${order.id}`}
        subtitle={`${order.product} · ${order.styleNo} · ${order.poNo}`}
        actions={
          <>
            <StatusBadge>{order.status}</StatusBadge>
            <BuyerCopilotModal
              prediction={prediction}
              orderId={order.id}
              buyerName={order.buyer}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setSyncing(true);
                setTimeout(() => {
                  setSyncing(false);
                  toast.success("Production data refreshed", {
                    description: `${order.id} synced with the shop floor.`,
                  });
                }, 900);
              }}
            >
              <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} /> Sync
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => toast.success("Order sheet exported")}>
              <FileDown className="size-3.5" /> Export
            </Button>
          </>
        }
      />

      {/* KPI Overview Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Buyer", order.buyer],
          ["Quantity", `${order.quantity.toLocaleString()} pieces`],
          ["Committed Delivery", order.deliveryDate],
          ["Priority", order.priority],
        ].map(([k, v]) => (
          <div key={k} className="surface p-4">
            <div className="text-[11.5px] uppercase tracking-wide text-muted-foreground">{k}</div>
            <div className="mt-1.5 text-[15px] font-semibold">{v}</div>
          </div>
        ))}
        <div className="surface p-4">
          <div className="text-[11.5px] uppercase tracking-wide text-muted-foreground">Progress</div>
          <div className="metric mt-1.5 text-[15px] font-semibold">{order.progress}%</div>
          <ProgressBar
            value={order.progress}
            tone={order.status === "Delayed" ? "danger" : "primary"}
            className="mt-2"
          />
        </div>
      </div>

      {session?.role === "admin" && <ManagerOrderCostBreakdown orderId={order.id} />}

      {/* AI DELIVERY RISK & RECOVERY PANEL */}
      <div className="mt-5 rounded-xl border border-primary/25 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-xl",
                prediction.riskLevel === "CRITICAL"
                  ? "bg-destructive/15 text-destructive"
                  : prediction.riskLevel === "HIGH"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              )}
            >
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold">AI Delivery Risk & Predictive Analysis</h2>
                <StatusBadge
                  tone={
                    prediction.riskLevel === "CRITICAL"
                      ? "danger"
                      : prediction.riskLevel === "HIGH"
                        ? "warning"
                        : "success"
                  }
                >
                  {`${prediction.riskLevel} RISK`}
                </StatusBadge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Model confidence: {prediction.confidenceScore}% · Run rate pace:{" "}
                <span
                  className={cn(
                    "font-medium",
                    prediction.stagePaceGapPercent < 0 ? "text-destructive" : "text-emerald-600",
                  )}
                >
                  {prediction.stagePaceGapPercent > 0 ? "+" : ""}
                  {prediction.stagePaceGapPercent}% vs engineered target
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BuyerCopilotModal
              prediction={prediction}
              orderId={order.id}
              buyerName={order.buyer}
            />
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <Link to="/scenario-planner">
                <Sliders className="size-3.5 text-primary" />
                Scenario Simulator
              </Link>
            </Button>
          </div>
        </div>

        {/* Prediction Metrics Bar */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Committed Delivery
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="size-4 text-muted-foreground" />
              {prediction.committedDelivery}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Predicted Handover Date
            </div>
            <div
              className={cn(
                "mt-1 flex items-center gap-1.5 text-sm font-semibold",
                prediction.predictedDelayDays > 0 ? "text-destructive" : "text-emerald-600",
              )}
            >
              <TrendingUp className="size-4" />
              {prediction.predictedCompletion}{" "}
              {prediction.predictedDelayDays > 0 && `(+${prediction.predictedDelayDays} days delay)`}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Primary Bottleneck Stage
            </div>
            <div className="mt-1 text-sm font-semibold capitalize text-foreground">
              {order.currentStage} Stage
            </div>
          </div>
        </div>

        {/* Root Causes Section with "Why?" trigger */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Root Causes & Identified Constraints
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Validated against shop-floor telemetry
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {prediction.rootCauses.map((rc, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/80 bg-background/60 p-3.5 text-xs shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {rc.category}
                    </span>
                    <span className="font-semibold text-foreground">{rc.title}</span>
                  </div>
                  <RootCauseModal
                    triggerLabel="Why?"
                    customAnalysis={{
                      title: rc.title,
                      category: rc.category as never,
                      severity: prediction.riskLevel === "CRITICAL" ? "critical" : "high",
                      primaryCause: rc.description,
                      telemetrySignals: [
                        rc.evidence,
                        `Throughput impact: ${rc.impact}`,
                        `Order target quantity: ${order.quantity.toLocaleString()} pcs`,
                      ],
                      historicalPrecedent:
                        "Similar operational friction logged across seasonal styles in Q3.",
                      immediateAction: "Deploy recovery action from the scenarios below.",
                      permanentFix: "Update line balancing configuration and maintenance SOP.",
                    }}
                  />
                </div>
                <p className="mt-2 text-muted-foreground">{rc.description}</p>
                <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Impact:</span> {rc.impact}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recovery Scenarios */}
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recommended Recovery Options
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Compare trade-offs between overtime wages, line transfers, and subcontracting before approval.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {prediction.recoveryScenarios.map((sc) => {
              const isApproved = approvedScenarios[sc.id];
              return (
                <div
                  key={sc.id}
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-4 text-xs transition-colors",
                    isApproved
                      ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground">{sc.title}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          sc.feasibility === "High"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600",
                        )}
                      >
                        {sc.feasibility} Feasibility
                      </span>
                    </div>
                    <p className="mt-2 text-muted-foreground leading-relaxed">{sc.action}</p>
                    <div className="mt-3 space-y-1 rounded-md bg-muted/50 p-2.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delay reduction:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          -{sc.delayReductionDays} days
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estimated cost:</span>
                        <span className="font-medium">{sc.additionalCost}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-2">
                    {isApproved ? (
                      <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white">
                        <CheckCircle2 className="size-3.5" />
                        Approved & Staged
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full text-xs font-medium"
                        onClick={() => handleApproveScenario(sc.id, sc.title)}
                      >
                        Approve Plan
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Standard Production Timeline */}
      <div className="surface mt-5 p-5">
        <h2 className="text-[15px] font-semibold">Production Timeline</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Nine-stage journey from yarn to packing. Select a stage to inspect it.
        </p>
        <div className="mt-6 overflow-x-auto pb-1">
          <div className="min-w-[720px]">
            <ProductionTimeline stages={order.stages} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          {order.stages.map((s) => (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors",
                current.key === s.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <StageDot state={s.state} size="sm" /> {s.label}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="stage" className="mt-5">
        <TabsList>
          <TabsTrigger value="stage">Stage details</TabsTrigger>
          <TabsTrigger value="specs">Order specification</TabsTrigger>
          <TabsTrigger value="stages">All stages</TabsTrigger>
        </TabsList>

        <TabsContent value="stage" className="mt-4">
          <div className="surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold">Current Stage: {current.label}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Manager {current.manager} · Expected completion {current.expected}
                </p>
              </div>
              <StatusBadge>
                {current.state === "completed"
                  ? "Completed"
                  : current.state === "delayed"
                    ? "Delayed"
                    : current.state === "current"
                      ? "In Production"
                      : "Pending"}
              </StatusBadge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ["Target", current.target.toLocaleString()],
                ["Completed", current.completed.toLocaleString()],
                ["Pending", current.pending.toLocaleString()],
                ["Rejected", current.rejected.toLocaleString()],
                ["Completion", `${current.progress}%`],
                ["Production rate", `${current.rate.toLocaleString()} /day`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border bg-muted/40 p-3">
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className="metric mt-1 text-[15px] font-semibold">{v}</div>
                </div>
              ))}
            </div>
            <ProgressBar
              value={current.progress}
              tone={current.state === "delayed" ? "danger" : current.progress === 100 ? "success" : "primary"}
              className="mt-4"
            />
          </div>
        </TabsContent>

        <TabsContent value="specs" className="mt-4">
          <div className="surface p-5">
            <dl className="grid gap-y-3 sm:grid-cols-2">
              {[
                ["Buyer", order.buyer],
                ["Category", order.category],
                ["Fabric", order.fabric],
                ["Colour", order.color],
                ["Style number", order.styleNo],
                ["PO number", order.poNo],
                ["Production start", order.startDate],
                ["Expected delivery", order.deliveryDate],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 border-b border-border/60 pb-2 text-[13px]">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="stages" className="mt-4">
          <div className="surface overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Stage", "Status", "Target", "Completed", "Pending", "Rejected", "Progress", "Manager"].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.stages.map((s) => (
                  <tr key={s.key} className="border-t border-border/70">
                    <td className="px-4 py-3 font-medium">{s.label}</td>
                    <td className="px-4 py-3">
                      <StatusBadge>
                        {s.state === "completed"
                          ? "Completed"
                          : s.state === "delayed"
                            ? "Delayed"
                            : s.state === "current"
                              ? "In Production"
                              : "Pending"}
                      </StatusBadge>
                    </td>
                    <td className="metric px-4 py-3">{s.target.toLocaleString()}</td>
                    <td className="metric px-4 py-3">{s.completed.toLocaleString()}</td>
                    <td className="metric px-4 py-3">{s.pending.toLocaleString()}</td>
                    <td className="metric px-4 py-3">{s.rejected.toLocaleString()}</td>
                    <td className="metric px-4 py-3">{s.progress}%</td>
                    <td className="px-4 py-3">{s.manager}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
