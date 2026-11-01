import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Factory,
  HeartPulse,
  Timer,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Sliders,
  Mic,
  Volume2,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  ChartCard,
  KpiCard,
  PageHeader,
  ProgressBar,
  RadialScore,
  StatusBadge,
  chartAxis,
  tooltipStyle,
} from "@/components/kit/primitives";
import {
  AIInsightCard,
  BottleneckCard,
  LiveOrderRow,
  ProductionStageCard,
} from "@/components/kit/production";
import { AssignOrderCard } from "@/components/kit/assign-order";
import { VoiceOrbModal } from "@/components/kit/voice-orb-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bottlenecks,
  healthBreakdown,
  insights,
  orderStatusSplit,
  orders,
  productionTrend,
  sparkline,
  stageSummaries,
  totals,
} from "@/lib/data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      {
        title: "Factory Dashboard | TexMind ERP",
      },
      {
        name: "description",
        content:
          "Real-time textile manufacturing operations dashboard with production tracking, bottlenecks, and KPIs.",
      },
    ],
  }),
  component: DashboardPage,
});

const RANGES = ["Today", "Last 7 Days", "Last 30 Days"] as const;

function DashboardPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("Last 7 Days");
  const [voiceOrbOpen, setVoiceOrbOpen] = useState(false);
  const [briefingPrompt, setBriefingPrompt] = useState<string | undefined>(undefined);
  const activeOrders = orders.filter((o) => o.status !== "Completed").slice(0, 6);

  const handlePlayBriefing = () => {
    setBriefingPrompt(
      "Give me a concise factory operations briefing based on the current portal data."
    );
    setVoiceOrbOpen(true);
  };

  return (
    <AppShell>
      <PageHeader
        title="Factory dashboard"
        subtitle="Your factory orders, production, and capacity overview."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 shadow-xs"
              onClick={handlePlayBriefing}
            >
              <Volume2 className="size-3.5 text-primary animate-pulse" />
              <span>Voice Briefing</span>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Link to="/command-centre">
                <ShieldAlert className="size-3.5 text-primary" /> Command Centre
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 text-xs font-semibold">
              <Link to="/scenario-planner">
                <Sliders className="size-3.5" /> Scenario Planner
              </Link>
            </Button>
            <div className="flex rounded-lg border border-border bg-card p-0.5 ml-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    range === r
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard index={0} label="Total Orders" value={totals.orders} hint="Active production orders" icon={ClipboardList} spark={sparkline(1)} />
        <KpiCard index={1} label="In Production" value={totals.inProduction} hint="Currently running" icon={Factory} spark={sparkline(3)} />
        <KpiCard index={2} label="Completed" value={totals.completed} hint="Orders completed" icon={CheckCircle2} spark={sparkline(5)} />
        <KpiCard index={3} label="Delayed" value={totals.delayed} hint="Require attention" icon={AlertTriangle} spark={sparkline(7, false)} />
        <KpiCard index={4} label="On-Time Rate" value={`${totals.onTimeRate}%`} hint="Delivery performance" icon={Timer} spark={sparkline(2)} />
        <KpiCard index={5} label="Production Quantity" value={totals.producedQty.toLocaleString()} unit="pieces" hint="Current output" icon={Activity} spark={sparkline(4)} />
        <KpiCard index={6} label="Pending Quantity" value={totals.pendingQty.toLocaleString()} unit="pieces" hint="Remaining production" icon={Clock} spark={sparkline(6, false)} />
        <KpiCard index={7} label="Factory Health" value={`${totals.health}/100`} hint="Overall factory score" icon={HeartPulse} spark={sparkline(8)} />
      </div>

      {/* Factory health + production trend */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5">
          <h3 className="text-[15px] font-semibold">Factory Health</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Composite score across five signals.</p>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <RadialScore score={totals.health} />
            <div className="w-full space-y-2.5">
              <StatusBadge tone="success">Healthy</StatusBadge>
              {healthBreakdown.map((h) => (
                <div key={h.label}>
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="text-muted-foreground">{h.label}</span>
                    <span className="metric font-semibold">{h.value}%</span>
                  </div>
                  <ProgressBar
                    value={h.value}
                    tone={h.value >= 90 ? "success" : h.value >= 85 ? "primary" : "warning"}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <ChartCard
          title="Daily Output vs Target"
          subtitle="Pieces produced across all active stages"
          className="lg:col-span-2"
        >
          <div className="h-64">
            <AreaChart data={productionTrend} className="size-full">
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" {...chartAxis} />
              <YAxis {...chartAxis} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area
                type="monotone"
                dataKey="output"
                name="Actual Output"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#actualGrad)"
              />
              <Line
                type="monotone"
                dataKey="target"
                name="Target"
                stroke="var(--chart-3)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </div>
        </ChartCard>
      </div>

      {/* Live Orders + Stage throughput */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold">Active Orders</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Showing {activeOrders.length} orders requiring monitoring
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/orders">View all orders</Link>
            </Button>
          </div>
          <div className="mt-3 divide-y divide-border/60">
            {activeOrders.map((order) => (
              <LiveOrderRow key={order.id} order={order} />
            ))}
          </div>
        </div>

        <ChartCard title="Orders by Status" subtitle="Active pipeline breakdown">
          <div className="flex h-64 items-center justify-center">
            <PieChart width={220} height={220}>
              <Pie
                data={orderStatusSplit}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {orderStatusSplit.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
            {orderStatusSplit.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="metric font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Production pipeline stages */}
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold">Production Pipeline</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Current load, throughput, and scrap rate across all 8 stages
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/production">Open stage detail</Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stageSummaries.map((s) => (
            <ProductionStageCard key={s.key} stage={s} />
          ))}
        </div>
      </div>

      {/* Bottlenecks & AI Insights */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <BottleneckCard items={bottlenecks} />

        <div className="surface p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-[15px] font-semibold">AI Insights &amp; Recommendations</h3>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">Updated live</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Prescriptive optimizations generated by TexMind's scheduling engine
          </p>
          <div className="mt-4 space-y-3">
            {insights.map((ins) => (
              <AIInsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        </div>
      </div>

      {/* Assign Order Modal */}
      <AssignOrderCard />

      {/* Fullscreen Voice Mode Modal */}
      <VoiceOrbModal
        open={voiceOrbOpen}
        onClose={() => {
          setVoiceOrbOpen(false);
          setBriefingPrompt(undefined);
        }}
        initialPrompt={briefingPrompt}
      />
    </AppShell>
  );
}
