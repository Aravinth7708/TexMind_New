import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, Filter, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ProgressBar, StatusBadge } from "@/components/kit/primitives";
import { STAGES, STAGE_LABELS, buyers, type Order } from "@/lib/data";

export type Filters = {
  q: string;
  buyer: string;
  status: string;
  stage: string;
  priority: string;
};

export const emptyFilters: Filters = {
  q: "",
  buyer: "all",
  status: "all",
  stage: "all",
  priority: "all",
};

export function filterOrders(orders: Order[], f: Filters) {
  const term = f.q.trim().toLowerCase();
  return orders.filter(
    (o) =>
      (!term ||
        o.id.toLowerCase().includes(term) ||
        o.product.toLowerCase().includes(term) ||
        o.buyer.toLowerCase().includes(term) ||
        o.styleNo.toLowerCase().includes(term)) &&
      (f.buyer === "all" || o.buyer === f.buyer) &&
      (f.status === "all" || o.status === f.status) &&
      (f.stage === "all" || o.currentStage === f.stage) &&
      (f.priority === "all" || o.priority === f.priority),
  );
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const dirty = JSON.stringify(filters) !== JSON.stringify(emptyFilters);
  return (
    <div className="surface mb-5 flex flex-wrap items-center gap-2 p-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search order, product, style…"
          className="h-9 pl-9 text-[13px]"
        />
      </div>
      <Select value={filters.buyer} onValueChange={(v) => set({ buyer: v })}>
        <SelectTrigger className="h-9 w-[160px] text-[13px]">
          <SelectValue placeholder="Buyer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All buyers</SelectItem>
          {buyers.map((b) => (
            <SelectItem key={b.id} value={b.company}>
              {b.company}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
        <SelectTrigger className="h-9 w-[140px] text-[13px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {["On Track", "At Risk", "Delayed", "Completed"].map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.stage} onValueChange={(v) => set({ stage: v })}>
        <SelectTrigger className="h-9 w-[140px] text-[13px]">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {STAGE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.priority} onValueChange={(v) => set({ priority: v })}>
        <SelectTrigger className="h-9 w-[130px] text-[13px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priority</SelectItem>
          {["High", "Medium", "Low"].map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[13px]">
        <Filter className="size-3.5" /> 01 – 30 Sep
      </Button>
      {dirty && (
        <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => onChange(emptyFilters)}>
          <X className="size-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}

export function OrderTable({ orders }: { orders: Order[] }) {
  return (
    <>
      {/* Desktop table */}
      <div className="surface hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {[
                  "Order ID",
                  "Buyer",
                  "Product",
                  "Quantity",
                  "Current Stage",
                  "Progress",
                  "Delivery",
                  "Priority",
                  "Status",
                  "",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/orders/$id"
                      params={{ id: o.id }}
                      className="font-mono text-[12.5px] font-semibold hover:text-primary"
                    >
                      {o.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{o.buyer}</td>
                  <td className="px-4 py-3">{o.product}</td>
                  <td className="px-4 py-3 metric">{o.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3">{STAGE_LABELS[o.currentStage]}</td>
                  <td className="px-4 py-3">
                    <div className="flex w-28 items-center gap-2">
                      <ProgressBar
                        value={o.progress}
                        tone={o.status === "Delayed" ? "danger" : o.progress === 100 ? "success" : "primary"}
                      />
                      <span className="metric text-[12px] font-semibold">{o.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{o.deliveryDate}</td>
                  <td className="px-4 py-3">
                    <StatusBadge dot={false}>{o.priority}</StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge>{o.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <Button asChild variant="ghost" size="icon" className="size-8">
                      <Link to="/orders/$id" params={{ id: o.id }} aria-label={`View ${o.id}`}>
                        <Eye className="size-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>
    </>
  );
}

export function OrderCard({ order: o }: { order: Order }) {
  return (
    <Link to="/orders/$id" params={{ id: o.id }} className="surface lift block p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[13px] font-semibold">{o.id}</div>
          <div className="text-xs text-muted-foreground">
            {o.buyer} · {o.product}
          </div>
        </div>
        <StatusBadge>{o.status}</StatusBadge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <div className="text-muted-foreground">Quantity</div>
          <div className="metric font-semibold">{o.quantity.toLocaleString()} pcs</div>
        </div>
        <div>
          <div className="text-muted-foreground">Stage</div>
          <div className="font-semibold">{STAGE_LABELS[o.currentStage]}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Delivery</div>
          <div className="font-semibold">{o.deliveryDate}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Priority</div>
          <div className="font-semibold">{o.priority}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <ProgressBar value={o.progress} tone={o.status === "Delayed" ? "danger" : "primary"} />
        <span className="metric text-[12px] font-semibold">{o.progress}%</span>
      </div>
    </Link>
  );
}

/* ---------------- Create order (multi-step) ---------------- */
export function CreateOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (order: Order) => void;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: "",
    buyer: "",
    product: "",
    styleNo: "",
    poNo: "",
    quantity: "",
    category: "",
    fabric: "",
    color: "",
    sizes: "",
    start: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    delivery: "",
    priority: "Medium",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function submit() {
    if (!form.buyer || !form.product.trim() || !Number(form.quantity)) {
      toast.error("Select a buyer and enter a product and quantity first.");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      const qty = Number(form.quantity);
      const order: Order = {
        id: `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
        buyerId: buyers.find((b) => b.company === form.buyer)?.id ?? "",
        buyer: form.buyer,
        product: form.product,
        category: form.category,
        styleNo: form.styleNo,
        poNo: form.poNo,
        quantity: qty,
        fabric: form.fabric,
        color: form.color,
        startDate: form.start,
        deliveryDate: form.delivery,
        priority: form.priority as Order["priority"],
        status: "On Track",
        currentStage: "yarn",
        progress: 0,
        stages: STAGES.map((key, i) => ({
          key,
          label: STAGE_LABELS[key],
          state: i === 0 ? "current" : "pending",
          target: qty,
          completed: 0,
          pending: qty,
          rejected: 0,
          progress: 0,
          rate: 0,
          manager: "Unassigned",
          expected: "—",
        })),
      };
      onCreated(order);
      setSaving(false);
      setStep(1);
      onOpenChange(false);
      toast.success(`${order.id} created`, {
        description: "All 9 production stages initialised for this order.",
      });
    }, 900);
  }

  const field = (label: string, key: keyof typeof form, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label className="text-[12px]">{label}</Label>
      <Input
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => set({ [key]: e.target.value } as Partial<typeof form>)}
        className="h-9 text-[13px]"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Create Order</DialogTitle>
          <DialogDescription>
            Step {step} of 3 ·{" "}
            {step === 1 ? "Order information" : step === 2 ? "Production information" : "Confirmation"}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-1 flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {field("Order ID", "id")}
            <div className="space-y-1.5">
              <Label className="text-[12px]">Buyer</Label>
              <Select value={form.buyer} onValueChange={(v) => set({ buyer: v })}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {buyers.map((b) => (
                    <SelectItem key={b.id} value={b.company}>
                      {b.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("Product", "product")}
            {field("Style Number", "styleNo")}
            {field("PO Number", "poNo")}
            {field("Quantity (pcs)", "quantity")}
            {field("Product Category", "category")}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {field("Fabric Type", "fabric")}
            {field("Color", "color")}
            <div className="sm:col-span-2">{field("Size Breakdown", "sizes")}</div>
            {field("Production Start Date", "start")}
            {field("Expected Delivery Date", "delivery")}
            <div className="space-y-1.5">
              <Label className="text-[12px]">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set({ priority: v })}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["High", "Medium", "Low"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <dl className="grid grid-cols-2 gap-y-2.5 text-[13px]">
                {[
                  ["Order ID", form.id],
                  ["Buyer", form.buyer],
                  ["Product", `${form.product} (${form.category})`],
                  ["Style / PO", `${form.styleNo} · ${form.poNo}`],
                  ["Quantity", `${Number(form.quantity).toLocaleString()} pcs`],
                  ["Fabric", form.fabric],
                  ["Color", form.color],
                  ["Sizes", form.sizes],
                  ["Start", form.start],
                  ["Delivery", form.delivery],
                  ["Priority", form.priority],
                ].map(([k, v]) => (
                  <div key={k as string} className="col-span-2 flex justify-between gap-4">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="text-[12px] text-muted-foreground">
              All 9 production stages (Yarn → Packing) will be initialised for this order.
            </p>
          </div>
        )}

        <div className="mt-2 flex justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => (step === 1 ? onOpenChange(false) : setStep(step - 1))}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>Continue</Button>
          ) : (
            <Button onClick={submit} disabled={saving}>
              {saving ? "Creating…" : "Create Order"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
