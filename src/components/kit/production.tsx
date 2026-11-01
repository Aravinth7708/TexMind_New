import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Circle, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProgressBar, StatusBadge } from "@/components/kit/primitives";
import type { Bottleneck, Insight, Order, StageRecord, StageSummary } from "@/lib/data";

export function StageDot({ state, size = "md" }: { state: StageRecord["state"]; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "size-5" : "size-7";
  if (state === "completed")
    return (
      <span className={cn("flex items-center justify-center rounded-full bg-success/15 text-success", cls)}>
        <Check className={size === "sm" ? "size-3" : "size-4"} strokeWidth={3} />
      </span>
    );
  if (state === "current")
    return (
      <span
        className={cn(
          "pulse-dot flex items-center justify-center rounded-full bg-primary text-primary-foreground",
          cls,
        )}
      >
        <Loader2 className={cn("animate-spin", size === "sm" ? "size-3" : "size-3.5")} />
      </span>
    );
  if (state === "delayed")
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-destructive/15 text-destructive",
          cls,
        )}
      >
        <TriangleAlert className={size === "sm" ? "size-3" : "size-3.5"} />
      </span>
    );
  return (
    <span className={cn("flex items-center justify-center rounded-full bg-muted text-muted-foreground", cls)}>
      <Circle className={size === "sm" ? "size-2" : "size-2.5"} />
    </span>
  );
}

/* Compact inline stage chips used inside order rows */
export function StageStrip({ stages }: { stages: StageRecord[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stages.map((s) => (
        <span
          key={s.key}
          title={`${s.label} — ${s.progress}%`}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
            s.state === "completed" && "border-success/25 bg-success/10 text-success",
            s.state === "current" && "border-primary/30 bg-primary/10 text-primary",
            s.state === "delayed" && "border-destructive/25 bg-destructive/10 text-destructive",
            s.state === "pending" && "border-border bg-muted/60 text-muted-foreground",
          )}
        >
          {s.state === "completed" ? "✓" : s.state === "pending" ? "○" : "●"} {s.label}
        </span>
      ))}
    </div>
  );
}

/* Large vertical/horizontal timeline for order details */
export function ProductionTimeline({ stages }: { stages: StageRecord[] }) {
  return (
    <div className="flex flex-col gap-0 md:flex-row md:items-start">
      {stages.map((s, i) => (
        <div key={s.key} className="flex flex-1 gap-3 md:flex-col md:items-center md:text-center">
          <div className="flex flex-col items-center md:w-full md:flex-row">
            <span className="hidden h-0.5 flex-1 bg-border md:block" style={{ opacity: i === 0 ? 0 : 1 }} />
            <StageDot state={s.state} />
            <span
              className="w-0.5 flex-1 bg-border md:h-0.5 md:w-auto"
              style={{ opacity: i === stages.length - 1 ? 0 : 1, minHeight: 22 }}
            />
          </div>
          <div className="pb-5 md:pb-0">
            <div
              className={cn(
                "text-[13px] font-semibold",
                s.state === "pending" && "text-muted-foreground",
              )}
            >
              {s.label}
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              {s.state === "pending" ? "Not started" : `${s.progress}% · ${s.completed.toLocaleString()} pcs`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductionStageCard({ stage }: { stage: StageSummary }) {
  const tone =
    stage.load === "High Load" ? "warning" : stage.load === "Balanced" ? "info" : "neutral";
  return (
    <Link
      to="/production/$stage"
      params={{ stage: stage.key }}
      className="surface lift block min-w-[186px] flex-1 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold">{stage.label}</span>
        <StatusBadge tone={tone as any} dot={false}>
          {stage.load}
        </StatusBadge>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="metric text-xl font-semibold">{stage.orders}</span>
        <span className="text-xs text-muted-foreground">orders</span>
      </div>
      <dl className="mt-2 space-y-0.5 text-[11.5px] text-muted-foreground">
        <div className="flex justify-between">
          <dt>Completed</dt>
          <dd className="font-medium text-foreground">{(stage.completedQty ?? 0).toLocaleString()} pcs</dd>
        </div>
        <div className="flex justify-between">
          <dt>Pending</dt>
          <dd className="font-medium text-foreground">{(stage.pendingQty ?? 0).toLocaleString()} pcs</dd>
        </div>
      </dl>
      <ProgressBar
        value={stage.progress}
        tone={stage.progress > 70 ? "success" : stage.progress > 40 ? "primary" : "warning"}
        className="mt-3"
      />
      <div className="mt-1.5 text-[11px] text-muted-foreground">{stage.progress}% avg progress</div>
    </Link>
  );
}

export function LiveOrderRow({ order }: { order: Order }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/orders/$id"
              params={{ id: order.id }}
              className="font-mono text-[13px] font-semibold hover:text-primary"
            >
              {order.id}
            </Link>
            <StatusBadge>{order.status}</StatusBadge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.product} · {order.quantity.toLocaleString()} pcs · {order.buyer}
          </p>
        </div>
        <div className="text-right">
          <div className="metric text-lg font-semibold">{order.progress}%</div>
          <div className="text-[11px] text-muted-foreground">Delivery {order.deliveryDate}</div>
        </div>
      </div>
      <div className="mt-3">
        <StageStrip stages={order.stages} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar
          value={order.progress}
          tone={order.status === "Delayed" ? "danger" : order.progress === 100 ? "success" : "primary"}
        />
        <span className="shrink-0 text-[11px] text-muted-foreground">
          Current: <span className="font-medium text-foreground">{order.stages.find((s) => s.key === order.currentStage)?.label}</span>
        </span>
      </div>
    </div>
  );
}

export function BottleneckCard({ items }: { items: Bottleneck[] }) {
  const top = items[0];
  if (!top) return null;
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[15px] font-semibold">Production Bottlenecks</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Stages constraining factory throughput.</p>
        </div>
        <StatusBadge tone="danger">HIGH</StatusBadge>
      </div>

      <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-semibold">{top.stage}</span>
          <span className="metric text-sm font-semibold text-destructive">
            {top.pending.toLocaleString()} pcs pending
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Current capacity</div>
            <div className="metric text-sm font-semibold">{top.capacity.toLocaleString()} pcs/day</div>
          </div>
          <div>
            <div className="text-muted-foreground">Required</div>
            <div className="metric text-sm font-semibold">{top.required.toLocaleString()} pcs/day</div>
          </div>
        </div>
        <ProgressBar value={(top.capacity / top.required) * 100} tone="danger" className="mt-3" />
        <Button asChild size="sm" className="mt-4">
          <Link to="/production/$stage" params={{ stage: "sewing" }}>
            View Details <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <ul className="mt-4 space-y-3">
        {items.slice(1).map((b) => (
          <li key={b.stage} className="space-y-1.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium">{b.stage}</span>
              <StatusBadge dot={false}>{b.risk === "MEDIUM" ? "Medium" : "Low"}</StatusBadge>
            </div>
            <ProgressBar
              value={(b.capacity / b.required) * 100}
              tone={b.risk === "MEDIUM" ? "warning" : "success"}
            />
            <div className="text-[11px] text-muted-foreground">
              {b.pending.toLocaleString()} pcs pending · {b.capacity.toLocaleString()}/{b.required.toLocaleString()} pcs/day
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AIInsightCard({ insight, detailed = false }: { insight: Insight; detailed?: boolean }) {
  const tone = insight.risk === "HIGH" ? "danger" : insight.risk === "MEDIUM" ? "warning" : "success";
  return (
    <div className="surface lift flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <span aria-hidden>{insight.icon}</span> {insight.kind}
        </span>
        <StatusBadge tone={tone as any} dot={false}>
          {insight.risk}
        </StatusBadge>
      </div>
      <h4 className="mt-3 text-sm font-semibold">{insight.title}</h4>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{insight.body}</p>
      {insight.action && (
        <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recommended action
          </div>
          <p className="mt-1 text-[13px]">{insight.action}</p>
        </div>
      )}
      {detailed && (
        <p className="mt-3 text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">Impact:</span> {insight.impact}
        </p>
      )}
      <Button asChild variant="outline" size="sm" className="mt-4 self-start">
        <Link to={insight.to}>
          {insight.cta} <ChevronRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
