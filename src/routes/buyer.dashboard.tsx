import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Clock, Package, Truck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  ChartCard,
  KpiCard,
  PageHeader,
  ProgressBar,
  StatusBadge,
  chartAxis,
  toneFor,
  tooltipStyle,
} from "@/components/kit/primitives";
import { StageStrip } from "@/components/kit/production";
import { BuyerAssignOrderCard } from "@/components/kit/assign-order";
import { STAGE_LABELS, buyerOrders, productionTrend, sparkline } from "@/lib/data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/buyer/dashboard")({
  head: () => ({
    meta: [
      { title: "Buyer Portal — Track Your Orders | TexMind" },
      { name: "description", content: "Live production tracking for your garment orders, stage by stage." },
      { property: "og:title", content: "Buyer Portal — TexMind" },
      { property: "og:description", content: "Follow your orders from yarn to packing in real time." },
    ],
  }),
  component: BuyerDashboard,
});

function BuyerDashboard() {
  const session = useSession();
  const active = buyerOrders.filter((o) => o.status !== "Completed");
  const completed = buyerOrders.filter((o) => o.status === "Completed");
  const delayed = buyerOrders.filter((o) => o.status === "Delayed");

  return (
    <AppShell variant="buyer">
      <PageHeader title={`Welcome, ${session?.name || "Buyer"}`} subtitle="Live status of orders linked to your account." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard index={0} label="My Orders" value={buyerOrders.length} hint="Total placed with TexMind" icon={Package} spark={sparkline(2)} />
        <KpiCard index={1} label="In Production" value={active.length} hint="Currently on the floor" icon={Clock} spark={sparkline(4)} />
        <KpiCard index={2} label="Completed" value={completed.length} hint="Shipped and closed" icon={CheckCircle2} spark={sparkline(6)} />
        <KpiCard index={3} label="Delayed" value={delayed.length} hint="Behind committed date" icon={Truck} spark={sparkline(8, false)} />
      </div>

      <div className="mt-5">
        <BuyerAssignOrderCard />
      </div>

      <div className="mt-5">
        <ChartCard title="Your Production Trend" subtitle="Daily pieces produced against plan" height={280}>
          <AreaChart data={productionTrend}>
            <defs>
              <linearGradient id="buyerTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="day" {...chartAxis} />
            <YAxis {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="output" name="Produced" stroke="var(--color-chart-2)" strokeWidth={2.4} fill="url(#buyerTrend)" />
          </AreaChart>
        </ChartCard>
      </div>

      <h2 className="mb-3 mt-7 text-lg font-semibold">Your orders</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {buyerOrders.map((o) => (
          <Link
            key={o.id}
            to="/buyer/orders/$id"
            params={{ id: o.id }}
            className="surface lift block p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="metric text-[12px] text-muted-foreground">{o.id}</div>
                <h3 className="text-[15px] font-semibold">{o.product}</h3>
                <p className="text-[12px] text-muted-foreground">
                  {o.quantity.toLocaleString()} pcs · due {o.deliveryDate}
                </p>
              </div>
              <StatusBadge tone={toneFor(o.status)}>{o.status}</StatusBadge>
            </div>
            <div className="mt-3.5 flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Current stage: {STAGE_LABELS[o.currentStage]}</span>
              <span className="metric font-semibold">{o.progress}%</span>
            </div>
            <ProgressBar value={o.progress} className="mt-1.5" />
            <div className="mt-4">
              <StageStrip stages={o.stages} />
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
