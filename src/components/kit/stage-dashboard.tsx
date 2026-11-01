import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Gauge,
  Package,
  Target,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  ChartCard,
  KpiCard,
  PageHeader,
  ProgressBar,
  ProgressCard,
  StatusBadge,
  chartAxis,
  tooltipStyle,
} from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import {
  STAGES,
  STAGE_LABELS,
  orders,
  sparkline,
  stageSummaries,
  type StageKey,
} from "@/lib/data";
import { StageStaffingSection, YarnStaffingSection } from "@/components/kit/yarn-staffing";

const KPI_SETS: Record<StageKey, { label: string; icon: LucideIcon; kind: string }[]> = {
  yarn: [
    { label: "Yarn Required", icon: Target, kind: "target" },
    { label: "Yarn Received", icon: CheckCircle2, kind: "done" },
    { label: "Yarn Used", icon: Activity, kind: "used" },
    { label: "Yarn Pending", icon: Clock, kind: "pending" },
  ],
  knitting: [
    { label: "Target Production", icon: Target, kind: "target" },
    { label: "Actual Production", icon: CheckCircle2, kind: "done" },
    { label: "Pending", icon: Clock, kind: "pending" },
    { label: "Rejected", icon: AlertTriangle, kind: "rejected" },
    { label: "Efficiency", icon: Gauge, kind: "efficiency" },
  ],
  dyeing: [
    { label: "Fabric Received", icon: Boxes, kind: "target" },
    { label: "Processed", icon: CheckCircle2, kind: "done" },
    { label: "Pending", icon: Clock, kind: "pending" },
    { label: "Rejected", icon: AlertTriangle, kind: "rejected" },
    { label: "Quality Pass Rate", icon: Gauge, kind: "quality" },
  ],
  compacting: [
    { label: "Fabric Received", icon: Boxes, kind: "target" },
    { label: "Processed", icon: CheckCircle2, kind: "done" },
    { label: "Pending", icon: Clock, kind: "pending" },
    { label: "Shrinkage", icon: Activity, kind: "shrinkage" },
    { label: "Quality Status", icon: Gauge, kind: "quality" },
  ],
  cutting: [
    { label: "Target", icon: Target, kind: "target" },
    { label: "Cut Quantity", icon: CheckCircle2, kind: "done" },
    { label: "Pending", icon: Clock, kind: "pending" },
    { label: "Rejected", icon: AlertTriangle, kind: "rejected" },
    { label: "Efficiency", icon: Gauge, kind: "efficiency" },
  ],
  printing: [
    { label: "Target", icon: Target, kind: "target" },
    { label: "Printed", icon: CheckCircle2, kind: "done" },
    { label: "Pending", icon: Clock, kind: "pending" },
    { label: "Rejected", icon: AlertTriangle, kind: "rejected" },
    { label: "Quality Rate", icon: Gauge, kind: "quality" },
  ],
  sewing: [
    { label: "Target", icon: Target, kind: "target" },
    { label: "Completed", icon: CheckCircle2, kind: "done" },
    { label: "Pending", icon: Clock, kind: "pending" },
    { label: "Rejected", icon: AlertTriangle, kind: "rejected" },
    { label: "Efficiency", icon: Gauge, kind: "efficiency" },
  ],
  ironing: [
    { label: "Received", icon: Boxes, kind: "target" },
    { label: "Ironed", icon: CheckCircle2, kind: "done" },
    { label: "Pending", icon: Clock, kind: "pending" },
    { label: "Rejected", icon: AlertTriangle, kind: "rejected" },
    { label: "Quality Rate", icon: Gauge, kind: "quality" },
  ],
  packing: [
    { label: "Target", icon: Target, kind: "target" },
    { label: "Packed", icon: Package, kind: "done" },
    { label: "Pending", icon: Clock, kind: "pending" },
    { label: "Cartons", icon: Boxes, kind: "cartons" },
    { label: "Shipment Ready", icon: Truck, kind: "shipment" },
  ],
};

const SECONDARY_CHART: Record<StageKey, { title: string; subtitle: string }> = {
  yarn: { title: "Supplier Split", subtitle: "Yarn received by supplier (kg)" },
  knitting: { title: "Machine Utilisation", subtitle: "Circular knitting machines" },
  dyeing: { title: "Machine Performance", subtitle: "Output by dyeing machine (kg)" },
  compacting: { title: "Shrinkage Analysis", subtitle: "Shrinkage % by fabric lot" },
  cutting: { title: "Rejection Rate", subtitle: "Daily rejection percentage" },
  printing: { title: "Design-wise Quantity", subtitle: "Printed pieces per design" },
  sewing: { title: "Line Performance", subtitle: "Efficiency by sewing line" },
  ironing: { title: "Pending Quantity", subtitle: "Pending pieces by order" },
  packing: { title: "Shipment Readiness", subtitle: "Cartons ready by order" },
};

const SUPPLIER_LIKE = Object.fromEntries(
  STAGES.map((stage) => [stage, [] as { name: string; value: number }[]]),
) as Record<StageKey, { name: string; value: number }[]>;

type Override = { completed: number; state: "in-progress" | "completed" | "delayed" };

export function StageDashboard({ stage }: { stage: StageKey }) {
  const session = useSession();
  const isProcess = session?.role === "process";
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const summary = stageSummaries.find((s) => s.key === stage)!;
  const label = STAGE_LABELS[stage];
  const records = orders.map((o) => {
    const base = o.stages.find((s) => s.key === stage)!;
    const ov = overrides[o.id];
    const rec = ov
      ? {
          ...base,
          completed: ov.completed,
          state: ov.state,
          pending: Math.max(0, base.target - ov.completed),
          progress: Math.min(100, Math.round((ov.completed / Math.max(1, base.target)) * 100)),
        }
      : base;
    return { order: o, rec };
  });
  const active = records.filter((r) => r.rec.state !== "pending");
  const editingRow = active.find((r) => r.order.id === editing) ?? null;

  const target = active.reduce((a, r) => a + r.rec.target, 0);
  const done = active.reduce((a, r) => a + r.rec.completed, 0);
  const rejected = active.reduce((a, r) => a + r.rec.rejected, 0);
  const pending = Math.max(0, target - done);
  const efficiency = Math.round((done / Math.max(1, target)) * 100);
  const quality = Math.round(100 - (rejected / Math.max(1, done)) * 100);


  const values: Record<string, { value: string | number; unit?: string; hint: string; trend?: number; badge?: string }> = {
    target: { value: target.toLocaleString(), unit: "pcs", hint: `Planned for ${label.toLowerCase()}`,  },
    done: { value: done.toLocaleString(), unit: "pcs", hint: "Cleared this stage",  },
    used: { value: Math.round(done * 0.94).toLocaleString(), unit: "kg", hint: "Consumed in production",  },
    pending: { value: pending.toLocaleString(), unit: "pcs", hint: "Remaining at this stage",  },
    rejected: { value: rejected.toLocaleString(), unit: "pcs", hint: "Rework or scrap",  },
    efficiency: { value: `${efficiency}%`, hint: "Stage efficiency",  },
    quality: { value: `${quality}%`, hint: "Quality pass rate",  },
    shrinkage: { value: "3.4%", hint: "Average shrinkage",  },
    cartons: { value: "1,420", hint: "Cartons packed",  },
    shipment: { value: "3", hint: "Orders ready to ship", badge: "Ready for Shipment" },
  };

  const trend: { day: string; actual: number; target: number }[] = [];

  const secondary = SUPPLIER_LIKE[stage] ?? [];
  const secondaryIsPercent = ["knitting", "compacting", "cutting", "sewing"].includes(stage);

  return (
    <AppShell>
      <PageHeader
        title={isProcess ? `${label} Process Updates` : `${label} Production`}
        subtitle={
          isProcess
            ? `Update ${label.toLowerCase()} progress for the orders assigned to your team.`
            : `Live ${label.toLowerCase()} performance across all active factory orders.`
        }
        actions={
          <>
            <StatusBadge tone={summary.load === "High Load" ? "warning" : "info"}>
              {summary.load}
            </StatusBadge>
            {!isProcess && (
              <>
                <Button variant="outline" size="sm">
                  Export stage report
                </Button>
                <Button size="sm">Update production</Button>
              </>
            )}
          </>

        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {KPI_SETS[stage].map((k, i) => {
          const v = values[k.kind]!;
          return (
            <KpiCard
              key={k.label}
              index={i}
              label={k.label}
              icon={k.icon}
              value={v.value}
              unit={v.unit}
              hint={v.hint}
              trend={v.trend}
              badge={v.badge}
              spark={sparkline(i + stage.length)}
            />
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title={`Daily ${label} Output`}
          subtitle="Actual output against daily target (pcs)"
          className="lg:col-span-2"
          height={280}
        >
          <AreaChart data={trend}>
            <defs>
              <linearGradient id={`g-${stage}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="day" {...chartAxis} />
            <YAxis {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Area
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="var(--color-chart-1)"
              strokeWidth={2.4}
              fill={`url(#g-${stage})`}
            />
            <Line type="monotone" dataKey="target" name="Target" stroke="var(--color-chart-4)" strokeDasharray="5 4" dot={false} />
          </AreaChart>
        </ChartCard>

        <ChartCard
          title={SECONDARY_CHART[stage].title}
          subtitle={SECONDARY_CHART[stage].subtitle}
          height={280}
        >
          <BarChart data={secondary} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" {...chartAxis} unit={secondaryIsPercent ? "%" : ""} />
            <YAxis type="category" dataKey="name" width={92} {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {secondary.map((_, i) => (
                <Cell key={i} fill={`var(--color-chart-${(i % 4) + 1})`} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      {stage === "sewing" && (
        <div className="mt-5">
          <h2 className="mb-3 text-[15px] font-semibold">Sewing Line Performance</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SUPPLIER_LIKE.sewing.map((l) => (
              <ProgressCard
                key={l.name}
                label={l.name}
                value={l.value}
                caption={`${(l.value * 34).toLocaleString()} pcs/day · ${l.value >= 90 ? "Ahead of plan" : l.value >= 80 ? "On plan" : "Needs attention"}`}
                tone={l.value >= 90 ? "success" : l.value >= 80 ? "primary" : "warning"}
              />
            ))}
          </div>
        </div>
      )}


      <StageStaffingSection stage={stage} />

      <div className="surface mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold">
              {isProcess ? "Orders assigned to you" : "Order allocation"}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isProcess
                ? `Update your ${label.toLowerCase()} progress on the orders the factory manager assigned.`
                : `Orders currently allocated to ${label.toLowerCase()}.`}
            </p>
          </div>
          {!isProcess && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/orders">All orders</Link>
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {[
                  "Order",
                  ...(isProcess ? [] : ["Buyer"]),
                  "Target",
                  "Completed",
                  "Pending",
                  "Rejected",
                  "Progress",
                  ...(isProcess ? ["Status", "Update"] : ["Manager", "Status"]),
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map(({ order, rec }) => (
                <tr key={order.id} className="border-t border-border/70 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    {isProcess ? (
                      <span className="font-mono text-[12.5px] font-semibold">{order.id}</span>
                    ) : (
                      <Link
                        to="/orders/$id"
                        params={{ id: order.id }}
                        className="font-mono text-[12.5px] font-semibold hover:text-primary"
                      >
                        {order.id}
                      </Link>
                    )}
                  </td>
                  {!isProcess && <td className="px-4 py-3">{order.buyer}</td>}
                  <td className="metric px-4 py-3">{rec.target.toLocaleString()}</td>
                  <td className="metric px-4 py-3">{rec.completed.toLocaleString()}</td>
                  <td className="metric px-4 py-3">{rec.pending.toLocaleString()}</td>
                  <td className="metric px-4 py-3">{rec.rejected.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex w-24 items-center gap-2">
                      <ProgressBar value={rec.progress} tone={rec.state === "delayed" ? "danger" : "primary"} />
                      <span className="metric text-[12px] font-semibold">{rec.progress}%</span>
                    </div>
                  </td>
                  {!isProcess && <td className="px-4 py-3">{rec.manager}</td>}
                  <td className="px-4 py-3">
                    <StatusBadge>
                      {rec.state === "completed" ? "Completed" : rec.state === "delayed" ? "Delayed" : "In Production"}
                    </StatusBadge>
                  </td>
                  {isProcess && (
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" onClick={() => setEditing(order.id)}>
                        Update
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingRow && (
        <UpdateStageDialog
          key={editingRow.order.id}
          orderId={editingRow.order.id}
          label={label}
          target={editingRow.rec.target}
          completed={editingRow.rec.completed}
          state={editingRow.rec.state === "pending" ? "in-progress" : (editingRow.rec.state as Override["state"])}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setOverrides((prev) => ({ ...prev, [editingRow.order.id]: next }));
            setEditing(null);
            toast.success(`${label} updated for ${editingRow.order.id}`, {
              description: `${next.completed.toLocaleString()} pcs completed · ${
                next.state === "completed" ? "Completed" : next.state === "delayed" ? "Delayed" : "In Production"
              }`,
            });
          }}
        />
      )}
    </AppShell>
  );
}

function UpdateStageDialog({
  orderId,
  label,
  target,
  completed,
  state,
  onClose,
  onSave,
}: {
  orderId: string;
  label: string;
  target: number;
  completed: number;
  state: Override["state"];
  onClose: () => void;
  onSave: (next: Override) => void;
}) {
  const [qty, setQty] = useState(String(completed));
  const [status, setStatus] = useState<Override["state"]>(state);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update {label.toLowerCase()} — {orderId}</DialogTitle>
          <DialogDescription>
            Enter today&apos;s completed quantity and the current status of your process.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qty">Completed quantity (of {target.toLocaleString()} pcs)</Label>
            <Input
              id="qty"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Process status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Override["state"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-progress">In Production</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({ completed: Math.min(target, Math.max(0, Number(qty) || 0)), state: status })
            }
          >
            Save update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export { Legend };
