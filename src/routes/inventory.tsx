import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  Boxes,
  Lock,
  PackageMinus,
  Search,
  TrendingDown,
  Calendar,
  Truck,
  CheckCircle2,
  FilePlus2,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import {
  ChartCard,
  KpiCard,
  PageHeader,
  StatusBadge,
  ProgressBar,
  chartAxis,
  tooltipStyle,
} from "@/components/kit/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  materials,
  sparkline,
  inventoryForecasts,
  type InventoryForecastItem,
} from "@/lib/data";
import { RootCauseModal } from "@/components/kit/root-cause-modal";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory Intelligence & AI Forecasting — TexMind" },
      {
        name: "description",
        content: "Predictive material burn rates, shortage countdowns, and automated purchase-order recommendations.",
      },
      { property: "og:title", content: "Inventory Intelligence & AI Forecasting — TexMind" },
      { property: "og:description", content: "Track material cover, supplier lead times and shortage risks." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const [q, setQ] = useState("");
  const [selectedPoItem, setSelectedPoItem] = useState<InventoryForecastItem | null>(null);
  const [approvedPos, setApprovedPos] = useState<Record<string, boolean>>({});

  const rows = materials
    .map((m) => ({
      ...m,
      available: m.stock - m.reserved,
      status: m.stock < m.min ? "Low Stock" : m.stock < m.min * 1.25 ? "Watch" : "Healthy",
    }))
    .filter(
      (m) =>
        !q.trim() ||
        m.name.toLowerCase().includes(q.toLowerCase()) ||
        m.category.toLowerCase().includes(q.toLowerCase()),
    );

  const low = rows.filter((r) => r.status === "Low Stock").length;

  const handleApprovePo = (item: InventoryForecastItem) => {
    setApprovedPos((prev) => ({ ...prev, [item.materialName]: true }));
    toast.success(`Draft Purchase Order Approved!`, {
      description: `PO for ${item.suggestedPoQty.toLocaleString()} ${item.unit} sent to ${item.supplier}.`,
    });
    setSelectedPoItem(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="Inventory Intelligence & AI Forecasting"
        subtitle="Predictive material consumption, supplier lead times, and automated purchase orders."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          index={0}
          label="Tracked Materials"
          value={materials.length}
          hint="SKUs in database"
          trend={2.1}
          icon={Boxes}
          spark={sparkline(1)}
        />
        <KpiCard
          index={1}
          label="Stock-Out Risks"
          value={inventoryForecasts.filter((f) => f.status === "CRITICAL").length}
          hint="Critical within 7 days"
          trend={-1.4}
          icon={AlertTriangle}
          spark={sparkline(3, false)}
        />
        <KpiCard
          index={2}
          label="Reserved for Orders"
          value="66,780"
          hint="Locked in production"
          trend={6.8}
          icon={Lock}
          spark={sparkline(5)}
        />
        <KpiCard
          index={3}
          label="Daily Burn Velocity"
          value="1,645 kg/day"
          hint="Across active lines"
          trend={4.2}
          icon={PackageMinus}
          spark={sparkline(7)}
        />
      </div>

      <Tabs defaultValue="forecast" className="mt-5">
        <TabsList>
          <TabsTrigger value="forecast">AI Demand & Shortage Forecast</TabsTrigger>
          <TabsTrigger value="stock">Current Stock Levels</TabsTrigger>
        </TabsList>

        {/* AI SHORTAGE & DEMAND FORECAST TAB */}
        <TabsContent value="forecast" className="mt-4 space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">
                  Dynamic Lead-Time & Stock-Out Intelligence:
                </span>{" "}
                Forecasts are calculated by projecting active sewing, knitting, and dyeing queue velocities against real supplier transit times. Smart PO action cards require human authorization.
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {inventoryForecasts.map((item) => {
              const isApproved = approvedPos[item.materialName];
              return (
                <div
                  key={item.materialName}
                  className="surface flex flex-col justify-between p-5 text-xs transition-colors hover:border-primary/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {item.category}
                        </span>
                        <h3 className="mt-0.5 text-base font-semibold text-foreground">
                          {item.materialName}
                        </h3>
                      </div>
                      <StatusBadge
                        tone={
                          item.status === "CRITICAL"
                            ? "danger"
                            : item.status === "WARNING"
                              ? "warning"
                              : "success"
                        }
                      >
                        {item.daysOfCoverRemaining < 7
                          ? `${item.daysOfCoverRemaining} DAYS COVER`
                          : "HEALTHY BUFFER"}
                      </StatusBadge>
                    </div>

                    {/* Stock Cover Progress */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Days of cover remaining</span>
                        <span className="font-semibold text-foreground">
                          {item.daysOfCoverRemaining} days
                        </span>
                      </div>
                      <ProgressBar
                        value={Math.min(100, (item.daysOfCoverRemaining / 20) * 100)}
                        tone={item.status === "CRITICAL" ? "danger" : item.status === "WARNING" ? "warning" : "success"}
                        className="mt-1.5"
                      />
                    </div>

                    {/* Key Metrics Matrix */}
                    <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-lg bg-muted/40 p-3 sm:grid-cols-4">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Daily Burn</div>
                        <div className="mt-0.5 font-semibold text-foreground">
                          {item.dailyBurnRate} {item.unit}/day
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Free Stock</div>
                        <div className="mt-0.5 font-semibold text-foreground">
                          {item.freeStock.toLocaleString()} {item.unit}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Stock-Out Date</div>
                        <div className="mt-0.5 font-semibold text-destructive">
                          {item.projectedStockoutDate}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Lead Time</div>
                        <div className="mt-0.5 font-semibold text-foreground">
                          {item.leadTimeDays} days
                        </div>
                      </div>
                    </div>

                    {/* Supplier & Dependent Orders */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Truck className="size-3.5 text-muted-foreground" />
                        <span>Supplier:</span>
                        <span className="font-medium text-foreground">{item.supplier}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Orders at risk:</span>
                        <span className="font-semibold text-foreground">
                          {item.activeOrdersDependent.join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                    <RootCauseModal
                      triggerLabel="Why Shortage?"
                      customAnalysis={{
                        title: `${item.materialName} Stock-Out Forecast`,
                        category: "Material",
                        severity: item.status === "CRITICAL" ? "critical" : "high",
                        primaryCause: `Consumption pace increased to ${item.dailyBurnRate} ${item.unit}/day due to active orders (${item.activeOrdersDependent.join(", ")}). Unallocated stock is currently ${item.freeStock} ${item.unit}, breaching safety reserve.`,
                        telemetrySignals: [
                          `Current inventory in warehouse: ${item.currentStock.toLocaleString()} ${item.unit}.`,
                          `Committed to active orders: ${item.reservedStock.toLocaleString()} ${item.unit}.`,
                          `Supplier delivery lead time: ${item.leadTimeDays} days transit.`,
                        ],
                        historicalPrecedent: `Average replenishment cycle from ${item.supplier} is ${item.leadTimeDays} business days.`,
                        immediateAction: `Issue purchase order for ${item.suggestedPoQty.toLocaleString()} ${item.unit} immediately.`,
                        permanentFix: `Implement automated ERP reorder point triggering when cover drops below ${item.leadTimeDays + 3} days.`,
                      }}
                    />

                    {isApproved ? (
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-4" />
                        PO Approved & Dispatched
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-semibold"
                        onClick={() => setSelectedPoItem(item)}
                      >
                        <FilePlus2 className="size-3.5" />
                        Suggested PO ({item.suggestedPoQty.toLocaleString()} {item.unit})
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* CURRENT STOCK TAB */}
        <TabsContent value="stock" className="mt-4 space-y-4">
          <ChartCard title="Stock vs Minimum Level" subtitle="Current stock against minimum required" height={300}>
            <BarChart data={rows.slice(0, 8)} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" {...chartAxis} tick={{ fontSize: 10 }} interval={0} angle={-14} height={54} textAnchor="end" />
              <YAxis {...chartAxis} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="stock" name="Current stock" radius={[6, 6, 0, 0]} barSize={16}>
                {rows.slice(0, 8).map((r, i) => (
                  <Cell key={i} fill={r.status === "Low Stock" ? "var(--color-chart-5)" : "var(--color-chart-1)"} />
                ))}
              </Bar>
              <Bar dataKey="min" name="Minimum level" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} barSize={16} />
            </BarChart>
          </ChartCard>

          <div className="surface overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <h3 className="text-[15px] font-semibold">Materials Ledger</h3>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search material or category…"
                  className="h-9 pl-9 text-[13px]"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["Material", "Category", "Current Stock", "Reserved", "Available", "Minimum Level", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.name} className="border-t border-border/70 hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.category}</td>
                      <td className="metric px-4 py-3">
                        {m.stock.toLocaleString()} {m.unit}
                      </td>
                      <td className="metric px-4 py-3">
                        {m.reserved.toLocaleString()} {m.unit}
                      </td>
                      <td className="metric px-4 py-3">
                        {m.available.toLocaleString()} {m.unit}
                      </td>
                      <td className="metric px-4 py-3">
                        {m.min.toLocaleString()} {m.unit}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={m.status === "Low Stock" ? "danger" : m.status === "Watch" ? "warning" : "success"}>
                          {m.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* SUGGESTED PO APPROVAL DIALOG */}
      {selectedPoItem && (
        <Dialog open={!!selectedPoItem} onOpenChange={() => setSelectedPoItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FilePlus2 className="size-4" />
                </span>
                <DialogTitle className="text-base font-semibold">
                  Approve Suggested Purchase Order
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Authorizing this draft will generate PO-2026-X and dispatch it to the supplier.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Material Name:</span>
                  <span className="font-semibold text-foreground">{selectedPoItem.materialName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recommended Quantity:</span>
                  <span className="font-bold text-primary">
                    {selectedPoItem.suggestedPoQty.toLocaleString()} {selectedPoItem.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preferred Supplier:</span>
                  <span className="font-medium text-foreground">{selectedPoItem.supplier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier Lead Time:</span>
                  <span className="font-medium text-foreground">{selectedPoItem.leadTimeDays} business days</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-muted-foreground">Estimated PO Value:</span>
                  <span className="font-bold text-foreground">{selectedPoItem.suggestedPoCost}</span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-amber-800 dark:text-amber-300">
                <p className="font-semibold">Urgency Note</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  Projected stockout date is {selectedPoItem.projectedStockoutDate}. Issuing today ensures delivery before sewing/knitting line starvation.
                </p>
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedPoItem(null)}>
                Dismiss
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                onClick={() => handleApprovePo(selectedPoItem)}
              >
                Approve & Issue PO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}
