import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Scale, Send, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/kit/primitives";
import {
  KG_PER_PIECE,
  STAGES,
  STAGE_LABELS,
  buyers,
  kgForPieces,
  orders,
  stageManagers,
  stageQuantity,
  unitFor,
  type StageKey,
} from "@/lib/data";

/* ---------------- shared plan table ---------------- */

export type StagePlan = { key: StageKey; label: string; qty: number; unit: "kg" | "pcs"; incharge: string };

export function buildStagePlan(pieces: number): StagePlan[] {
  return STAGES.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    qty: stageQuantity(key, pieces),
    unit: unitFor(key),
    incharge: stageManagers[key],
  }));
}

function PlanTable({ plan, showIncharge = true }: { plan: StagePlan[]; showIncharge?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* mobile: stacked cards */}
      <div className="divide-y divide-border sm:hidden">
        {plan.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div>
              <div className="text-[13px] font-semibold">{p.label}</div>
              {showIncharge && <div className="text-[11.5px] text-muted-foreground">{p.incharge}</div>}
            </div>
            <div className="text-right">
              <div className="metric text-[13px] font-semibold">{p.qty.toLocaleString()}</div>
              <div className="text-[11px] uppercase text-muted-foreground">{p.unit}</div>
            </div>
          </div>
        ))}
      </div>

      {/* desktop / tablet: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Process</th>
              <th className="px-3 py-2.5 font-semibold">Assigned quantity</th>
              <th className="px-3 py-2.5 font-semibold">Unit</th>
              {showIncharge && <th className="px-3 py-2.5 font-semibold">Incharge</th>}
            </tr>
          </thead>
          <tbody>
            {plan.map((p) => (
              <tr key={p.key} className="border-t border-border/70">
                <td className="px-3 py-2.5 font-medium">{p.label}</td>
                <td className="metric px-3 py-2.5">{p.qty.toLocaleString()}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge tone={p.unit === "kg" ? "info" : "success"}>{p.unit}</StatusBadge>
                </td>
                {showIncharge && <td className="px-3 py-2.5 text-muted-foreground">{p.incharge}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UnitNote({ pieces }: { pieces: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold">
          <Scale className="size-4 text-primary" /> Yarn → Compacting
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Measured in kilograms · {kgForPieces(pieces).toLocaleString()} kg at {KG_PER_PIECE} kg per piece
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold">
          <Boxes className="size-4 text-primary" /> Cutting → Packing
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Counted in pieces · {pieces.toLocaleString()} pcs
        </p>
      </div>
    </div>
  );
}

/* ---------------- ADMIN: assign an order to the nine processes ---------------- */

export type Assignment = {
  id: string;
  orderId: string;
  buyer: string;
  pieces: number;
  kg: number;
  startStage: StageKey;
  dueDate: string;
  plan: StagePlan[];
};

export function AssignOrderCard() {
  const [open, setOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  return (
    <div className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Assign order to processes</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Release an order to the nine process teams — kilograms up to compacting, pieces from cutting onwards.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" disabled={orders.length === 0}>
              <ClipboardCheck className="size-4" /> Assign order
            </Button>
          </DialogTrigger>
          {orders.length > 0 ? (
            <AssignOrderDialog
              onAssign={(a) => {
                setAssignments((prev) => [a, ...prev]);
                setOpen(false);
              }}
            />
          ) : (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>No orders available</DialogTitle>
                <DialogDescription>Create an order before assigning it to process teams.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          )}
        </Dialog>
      </div>

      {assignments.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-[12.5px] text-muted-foreground">
          No order assigned yet. Pick an order and the quantity for each process team.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="metric text-[13px] font-semibold">{a.orderId}</span>
                  <span className="ml-2 text-[12.5px] text-muted-foreground">{a.buyer}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <StatusBadge tone="info">{`${a.kg.toLocaleString()} kg`}</StatusBadge>
                  <StatusBadge tone="success">{`${a.pieces.toLocaleString()} pcs`}</StatusBadge>
                  <span className="text-muted-foreground">
                    Starts at {STAGE_LABELS[a.startStage]} · due {a.dueDate}
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <PlanTable plan={a.plan} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignOrderDialog({ onAssign }: { onAssign: (a: Assignment) => void }) {
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const order = orders.find((o) => o.id === orderId) ?? orders[0];
  if (!order) return null;
  const [pieces, setPieces] = useState(String(order.quantity));
  const [startStage, setStartStage] = useState<StageKey>("yarn");
  const [dueDate, setDueDate] = useState(order.deliveryDate);
  const [note, setNote] = useState("");

  const pcs = Math.max(0, Number(pieces) || 0);
  const plan = useMemo(() => buildStagePlan(pcs), [pcs]);

  function selectOrder(id: string) {
    const o = orders.find((x) => x.id === id)!;
    setOrderId(id);
    setPieces(String(o.quantity));
    setDueDate(o.deliveryDate);
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Assign order to process teams</DialogTitle>
        <DialogDescription>
          Choose the order and quantity. Each process gets the quantity in its own unit.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Order</Label>
            <Select value={orderId} onValueChange={selectOrder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.id} · {o.product}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-qty">Order quantity (pieces)</Label>
            <Input
              id="assign-qty"
              inputMode="numeric"
              value={pieces}
              onChange={(e) => setPieces(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Start from process</Label>
            <Select value={startStage} onValueChange={(v) => setStartStage(v as StageKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABELS[s]} ({unitFor(s)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-due">Delivery date</Label>
            <Input id="assign-due" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <UnitNote pieces={pcs} />
        <PlanTable plan={plan} />

        <div className="space-y-1.5">
          <Label htmlFor="assign-note">Instructions for the teams (optional)</Label>
          <Textarea
            id="assign-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Keep shade approval before dyeing"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          className="w-full sm:w-auto"
          disabled={pcs === 0}
          onClick={() => {
            onAssign({
              id: `${orderId}-${Date.now()}`,
              orderId,
              buyer: order.buyer,
              pieces: pcs,
              kg: kgForPieces(pcs),
              startStage,
              dueDate,
              plan: buildStagePlan(pcs),
            });
            toast.success(`${orderId} assigned to all nine processes`, {
              description: `${kgForPieces(pcs).toLocaleString()} kg for yarn–compacting · ${pcs.toLocaleString()} pcs from cutting onwards`,
            });
          }}
        >
          Assign to processes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- BUYER: place a new order request ---------------- */

export type OrderRequest = {
  id: string;
  product: string;
  pieces: number;
  kg: number;
  color: string;
  deliveryDate: string;
  plan: StagePlan[];
};

const PRODUCTS = ["Cotton T-Shirt", "Polo T-Shirt", "Hoodie", "Track Pant", "Kids T-Shirt", "Casual Shirt"];

export function BuyerAssignOrderCard() {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<OrderRequest[]>([]);

  return (
    <div className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Place a new order</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Submit an order request to the factory. Quantities are shown in kilograms for fabric processes and pieces for garment processes.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Send className="size-4" /> New order
            </Button>
          </DialogTrigger>
          <BuyerRequestDialog
            onSubmit={(r) => {
              setRequests((prev) => [r, ...prev]);
              setOpen(false);
            }}
          />
        </Dialog>
      </div>

      {requests.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-[12.5px] text-muted-foreground">
          No new order requests yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="metric text-[13px] font-semibold">{r.id}</span>
                  <span className="ml-2 text-[12.5px] text-muted-foreground">
                    {r.product} · {r.color}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <StatusBadge tone="info">{`${r.kg.toLocaleString()} kg fabric`}</StatusBadge>
                  <StatusBadge tone="success">{`${r.pieces.toLocaleString()} pcs`}</StatusBadge>
                  <span className="text-muted-foreground">due {r.deliveryDate}</span>
                </div>
              </div>
              <div className="mt-3">
                <PlanTable plan={r.plan} showIncharge={false} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BuyerRequestDialog({ onSubmit }: { onSubmit: (r: OrderRequest) => void }) {
  const [product, setProduct] = useState(PRODUCTS[0]!);
  const [pieces, setPieces] = useState("5000");
  const [color, setColor] = useState("Navy Blue");
  const [deliveryDate, setDeliveryDate] = useState("30 Oct 2026");

  const pcs = Math.max(0, Number(pieces) || 0);
  const plan = useMemo(() => buildStagePlan(pcs), [pcs]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>New order request</DialogTitle>
        <DialogDescription>
          Enter what you need in pieces — the fabric stages are planned in kilograms automatically.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-qty">Quantity (pieces)</Label>
            <Input
              id="req-qty"
              inputMode="numeric"
              value={pieces}
              onChange={(e) => setPieces(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-color">Colour</Label>
            <Input id="req-color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-due">Required by</Label>
            <Input id="req-due" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
        </div>

        <UnitNote pieces={pcs} />
        <PlanTable plan={plan} showIncharge={false} />
      </div>

      <DialogFooter>
        <Button
          className="w-full sm:w-auto"
          disabled={pcs === 0}
          onClick={() => {
            const id = `REQ-${1000 + Math.floor(Math.random() * 9000)}`;
            onSubmit({
              id,
              product,
              pieces: pcs,
              kg: kgForPieces(pcs),
              color,
              deliveryDate,
              plan: buildStagePlan(pcs),
            });
            toast.success(`Order request ${id} sent to TexMind`, {
              description: `${pcs.toLocaleString()} pcs ${product} · ${kgForPieces(pcs).toLocaleString()} kg fabric planned`,
            });
          }}
        >
          Send request
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
