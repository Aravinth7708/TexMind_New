import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { chartAxis, tooltipStyle } from "@/components/kit/primitives";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function ChartRenderer({
  chartType = "bar",
  title,
  description,
  xKey,
  yKeys,
  data,
}: {
  chartType?: "bar" | "line" | "area" | "pie";
  title?: string;
  description?: string;
  xKey: string;
  yKeys: string[];
  data: Record<string, any>[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs">
      {title && (
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <BarChart3 className="size-4 text-primary" />
              {title}
            </div>
            {description && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
          <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase font-mono font-semibold text-muted-foreground">
            {chartType} chart
          </span>
        </div>
      )}

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey={xKey} {...chartAxis} />
              <YAxis {...chartAxis} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {yKeys.map((yKey, idx) => (
                <Line
                  key={yKey}
                  type="monotone"
                  dataKey={yKey}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2.2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey={xKey} {...chartAxis} />
              <YAxis {...chartAxis} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {yKeys.map((yKey, idx) => (
                <Area
                  key={yKey}
                  type="monotone"
                  dataKey={yKey}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          ) : chartType === "pie" ? (
            <PieChart>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={data}
                dataKey={yKeys[0]!}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={4}
              >
                {data.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <BarChart data={data} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey={xKey} {...chartAxis} />
              <YAxis {...chartAxis} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {yKeys.map((yKey, idx) => (
                <Bar
                  key={yKey}
                  dataKey={yKey}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
