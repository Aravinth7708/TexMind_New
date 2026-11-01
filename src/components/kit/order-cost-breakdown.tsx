import { useEffect, useRef, useState } from "react";
import { BadgeIndianRupee, Calculator, CircleCheck, Info } from "lucide-react";
import { STAGES, type StageKey } from "@/lib/data";
import {
  emptyOrderCosting,
  fetchOrderCosting,
  formatINR,
  getManufacturingCost,
  getStageLabel,
  readOrderCosting,
  saveOrderCosting,
  saveOrderCostingToServer,
  subscribeOrderCosting,
  type OrderCosting,
} from "@/lib/order-costing";

function useOrderCosting(orderId: string, buyerView = false) {
  const [costing, setCosting] = useState<OrderCosting>(() => emptyOrderCosting());
  const [savedToServer, setSavedToServer] = useState(false);
  const hydrated = useRef(false);
  const lastLoaded = useRef("");

  useEffect(() => {
    hydrated.current = false;
    const refresh = async () => {
      const remote = await fetchOrderCosting(orderId, buyerView);
      const next = remote ?? readOrderCosting(orderId);
      lastLoaded.current = JSON.stringify(next);
      setSavedToServer(Boolean(remote));
      setCosting(next);
      hydrated.current = true;
    };
    void refresh();
    const unsubscribe = subscribeOrderCosting(orderId, refresh);
    const poll = window.setInterval(() => void refresh(), 5000);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [orderId, buyerView]);

  useEffect(() => {
    if (!hydrated.current || buyerView) return;
    const serialized = JSON.stringify(costing);
    if (serialized === lastLoaded.current) return;
    const timeout = window.setTimeout(() => {
      void saveOrderCostingToServer(orderId, costing).then((ok) => setSavedToServer(ok));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [buyerView, costing, orderId]);

  const update = (next: OrderCosting) => {
    setCosting(next);
    saveOrderCosting(orderId, next);
  };

  return [costing, update, savedToServer] as const;
}

function CostInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex h-10 items-center rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
        <span className="mr-2 text-sm text-muted-foreground">₹</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value || ""}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          placeholder="0"
          className="w-full min-w-0 bg-transparent text-sm outline-none"
          aria-label={label}
        />
      </span>
    </label>
  );
}

export function ManagerOrderCostBreakdown({ orderId }: { orderId: string }) {
  const [costing, update, savedToServer] = useOrderCosting(orderId);
  const manufacturingCost = getManufacturingCost(costing);
  const profit = costing.buyerOrderTotal - manufacturingCost;
  const margin = costing.buyerOrderTotal > 0 ? (profit / costing.buyerOrderTotal) * 100 : 0;

  const updateStage = (stage: StageKey, value: number) =>
    update({ ...costing, stageCosts: { ...costing.stageCosts, [stage]: value } });

  return (
    <section className="surface mt-5 p-4 sm:p-5" aria-labelledby="order-cost-heading">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calculator className="size-5" />
          </span>
          <div>
            <h2 id="order-cost-heading" className="text-base font-semibold">Order cost & profit</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Enter estimated or actual costs. Totals save automatically on this device.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CircleCheck className="size-4" /> {savedToServer ? "Saved to factory" : "Saved on this device"}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Production stage costs</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage) => (
            <CostInput
              key={stage}
              label={getStageLabel(stage)}
              value={costing.stageCosts[stage]}
              onChange={(value) => updateStage(stage, value)}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other order costs</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CostInput label="Fabric & materials" value={costing.materialCost} onChange={(value) => update({ ...costing, materialCost: value })} />
          <CostInput label="Packaging" value={costing.packagingCost} onChange={(value) => update({ ...costing, packagingCost: value })} />
          <CostInput label="Logistics" value={costing.logisticsCost} onChange={(value) => update({ ...costing, logisticsCost: value })} />
          <CostInput label="Other costs" value={costing.otherCost} onChange={(value) => update({ ...costing, otherCost: value })} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs text-muted-foreground">Total making cost</div>
          <div className="mt-1.5 text-lg font-semibold tabular-nums">{formatINR(manufacturingCost)}</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs text-muted-foreground">Buyer order total</div>
          <CostInput label="Amount charged to buyer" value={costing.buyerOrderTotal} onChange={(value) => update({ ...costing, buyerOrderTotal: value })} />
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs text-muted-foreground">Estimated profit</div>
          <div className={`mt-1.5 text-lg font-semibold tabular-nums ${profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
            {formatINR(profit)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs text-muted-foreground">Profit margin</div>
          <div className={`mt-1.5 text-lg font-semibold tabular-nums ${margin < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
            {margin.toFixed(1)}%
          </div>
        </div>
      </div>
      {profit < 0 && costing.buyerOrderTotal > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          <Info className="mt-0.5 size-4 shrink-0" /> The buyer order total is below the entered making cost. Review the figures before confirming the quote.
        </p>
      )}
    </section>
  );
}

export function BuyerOrderCost({ orderId }: { orderId: string }) {
  const [costing] = useOrderCosting(orderId, true);

  return (
    <section className="surface mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-labelledby="buyer-order-total-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BadgeIndianRupee className="size-5" />
        </span>
        <div>
          <h2 id="buyer-order-total-heading" className="text-[15px] font-semibold">Order total</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Total amount for this order · updates automatically</p>
        </div>
      </div>
      <div className="text-left sm:text-right">
        <div className="text-xl font-bold tabular-nums sm:text-2xl">
          {costing.buyerOrderTotal > 0 ? formatINR(costing.buyerOrderTotal) : "Pending"}
        </div>
        {costing.buyerOrderTotal <= 0 && <p className="mt-0.5 text-xs text-muted-foreground">The factory will share the order total when it is ready.</p>}
      </div>
    </section>
  );
}
