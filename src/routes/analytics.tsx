import { createFileRoute } from "@tanstack/react-router";
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
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import {
  ChartCard,
  PageHeader,
  chartAxis,
  tooltipStyle,
} from "@/components/kit/primitives";
import { BottleneckCard } from "@/components/kit/production";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STAGES,
  STAGE_LABELS,
  bottlenecks,
  buyers,
  orderStatusSplit,
  orders,
  productionTrend,
  stagePerformance,
  targetVsActual,
} from "@/lib/data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Factory Analytics — TexMind" },
      {
        name: "description",
        content: "Interactive garment factory analytics: trends, stage performance, rejections and delivery.",
      },
      { property: "og:title", content: "Factory Analytics — TexMind" },
      { property: "og:description", content: "Deep-dive analytics across all nine production stages." },
    ],
  }),
  component: AnalyticsPage,
});

const rejection = STAGES.map((s, i) => ({
  name: STAGE_LABELS[s],
  rate: Number((0.8 + ((i * 7) % 19) / 10).toFixed(1)),
}));

const delivery = [
  { name: "May", onTime: 82, late: 18 },
  { name: "Jun", onTime: 85, late: 15 },
  { name: "Jul", onTime: 81, late: 19 },
  { name: "Aug", onTime: 88, late: 12 },
  { name: "Sep", onTime: 86, late: 14 },
];

const lines: { name: string; value: number }[] = [];

const completion = orders.slice(0, 10).map((o) => ({
  name: o.id,
  value: o.progress,
}));

function Filters() {
  const sel = (label: string, items: string[]) => (
    <Select defaultValue="all">
      <SelectTrigger className="h-9 w-[150px] text-[13px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {items.map((i) => (
          <SelectItem key={i} value={i}>
            {i}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  return (
    <div className="surface mb-5 flex flex-wrap gap-2 p-3">
      {sel("All dates", ["Last 7 days", "Last 30 days", "This quarter"])}
      {sel("All stages", STAGES.map((s) => STAGE_LABELS[s]))}
      {sel("All buyers", buyers.map((b) => b.company))}
      {sel("All orders", orders.slice(0, 8).map((o) => o.id))}
      {sel("All products", ["Cotton T-Shirt", "Polo T-Shirt", "Hoodie", "Track Pant", "Kids T-Shirt", "Casual Shirt"])}
    </div>
  );
}

function AnalyticsPage() {
  return (
    <AppShell>
      <PageHeader title="Factory Analytics" subtitle="Interactive performance analysis across the factory." />
      <Filters />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Production Trend" subtitle="Daily output vs target (pcs)" className="lg:col-span-2" height={300}>
          <AreaChart data={productionTrend}>
            <defs>
              <linearGradient id="anTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="day" {...chartAxis} />
            <YAxis {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="output" name="Output" stroke="var(--color-chart-1)" strokeWidth={2.4} fill="url(#anTrend)" />
            <Line type="monotone" dataKey="target" name="Target" stroke="var(--color-chart-4)" strokeDasharray="5 4" dot={false} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Stage Performance" subtitle="Completion percentage by stage" height={300}>
          <BarChart data={stagePerformance} layout="vertical" barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" {...chartAxis} />
            <YAxis type="category" dataKey="name" width={86} {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" name="Completion" radius={[0, 6, 6, 0]}>
              {stagePerformance.map((s, i) => (
                <Cell key={i} fill={s.value >= 80 ? "var(--color-chart-3)" : s.value >= 55 ? "var(--color-chart-1)" : "var(--color-chart-4)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Target vs Actual" subtitle="Weekly production comparison" height={300}>
          <BarChart data={targetVsActual} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="name" {...chartAxis} />
            <YAxis {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="target" name="Target" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} barSize={18} />
            <Bar dataKey="actual" name="Actual" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} barSize={18} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Order Completion" subtitle="Progress by order (%)" height={280}>
          <BarChart data={completion}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="name" {...chartAxis} />
            <YAxis domain={[0, 100]} unit="%" {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" name="Progress" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} barSize={20} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Rejection Analysis" subtitle="Rejection rate by stage (%)" height={280}>
          <LineChart data={rejection}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="name" {...chartAxis} />
            <YAxis unit="%" {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="rate" name="Rejection" stroke="var(--color-chart-5)" strokeWidth={2.4} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Delivery Performance" subtitle="On-time vs late deliveries (%)" height={280}>
          <BarChart data={delivery} stackOffset="expand">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="name" {...chartAxis} />
            <YAxis {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="onTime" name="On time" stackId="a" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} barSize={22} />
            <Bar dataKey="late" name="Late" stackId="a" fill="var(--color-chart-5)" barSize={22} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Machine / Line Efficiency" subtitle="Efficiency by line and machine (%)" height={280}>
          <BarChart data={lines} layout="vertical" barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" {...chartAxis} />
            <YAxis type="category" dataKey="name" width={92} {...chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" name="Efficiency" radius={[0, 6, 6, 0]}>
              {lines.map((l, i) => (
                <Cell key={i} fill={l.value >= 88 ? "var(--color-chart-3)" : l.value >= 80 ? "var(--color-chart-1)" : "var(--color-chart-4)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Order Status" subtitle="Distribution across the order book" height={280}>
          <PieChart>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Pie data={orderStatusSplit} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="none">
              {orderStatusSplit.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartCard>

        <BottleneckCard items={bottlenecks} />
      </div>
    </AppShell>
  );
}
