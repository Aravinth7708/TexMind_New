import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/lib/theme";

/* ---------------- Page header ---------------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="rise-in">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------- Status badge ---------------- */
const toneMap: Record<string, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/12 text-destructive border-destructive/25",
  info: "bg-info/12 text-info border-info/25",
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/25",
};

export type Tone = keyof typeof toneMap;

export function toneFor(value: string): Tone {
  const v = value.toLowerCase();
  if (["completed", "on track", "healthy", "ready for shipment", "shipped", "low", "active", "passed"].includes(v))
    return "success";
  if (["delayed", "high", "critical", "danger"].includes(v)) return "danger";
  if (["at risk", "medium", "high load", "low stock", "pending", "warning", "in progress"].includes(v))
    return "warning";
  if (["in production", "current", "balanced", "invited"].includes(v)) return "info";
  return "neutral";
}

export function StatusBadge({
  children,
  tone,
  className,
  dot = true,
}: {
  children: string;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  const t = tone ?? toneFor(children);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap",
        toneMap[t],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------------- KPI card ---------------- */
export function KpiCard({
  label,
  value,
  unit,
  hint,
  trend,
  icon: Icon,
  spark,
  badge,
  index = 0,
}: {
  label: string;
  value: string | number;
  unit?: string | undefined;
  hint?: string | undefined;
  trend?: number | undefined;
  icon: LucideIcon;
  spark?: { i: number; v: number }[] | undefined;
  badge?: string | undefined;
  index?: number | undefined;
}) {
  const up = (trend ?? 0) >= 0;
  const mounted = useMounted();
  return (
    <div
      className="surface lift rise-in p-4"
      style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold",
              up ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {up ? "+" : ""}
            {trend}%
          </span>
        )}
        {badge && <StatusBadge>{badge}</StatusBadge>}
      </div>
      <div className="mt-3.5 flex items-end gap-1.5">
        <span className="metric text-2xl font-semibold">{value}</span>
        {unit && <span className="pb-0.5 text-xs text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-0.5 text-[13px] font-medium">{label}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {spark && (
        <div className="mt-2 h-8">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs>
                  <linearGradient id={`sp-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--color-primary)"
                  strokeWidth={1.8}
                  fill={`url(#sp-${label.replace(/\s/g, "")})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Chart card ---------------- */
export function ChartCard({
  title,
  subtitle,
  action,
  height = 260,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  const mounted = useMounted();
  return (
    <div className={cn("surface p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ height }}>
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            {children as any}
          </ResponsiveContainer>
        ) : (
          <Skeleton className="h-full w-full" />
        )}
      </div>
    </div>
  );
}

export const chartAxis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

export const tooltipStyle = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--color-popover-foreground)",
    boxShadow: "var(--shadow-card)",
  },
  labelStyle: { color: "var(--color-muted-foreground)", fontSize: 11 },
};

/* ---------------- Progress card ---------------- */
export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "success" | "warning" | "danger" | "teal" | undefined;
  className?: string | undefined;
}) {
  const bg = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    teal: "bg-teal",
  }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bg)}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export function ProgressCard({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: number;
  caption?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "teal";
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="metric text-lg font-semibold">{value}%</span>
      </div>
      <ProgressBar value={value} tone={tone} className="mt-2.5" />
      {caption && <p className="mt-2 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

/* ---------------- Radial score ---------------- */
export function RadialScore({ score, size = 168 }: { score: number; size?: number }) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={12}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="metric text-3xl font-semibold">{score}</span>
        <span className="text-[11px] text-muted-foreground">out of 100</span>
      </div>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Loading skeletons ---------------- */
export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-xs font-semibold text-primary hover:underline">
      {children}
    </Link>
  );
}
