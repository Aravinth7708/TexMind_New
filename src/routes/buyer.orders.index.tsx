import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageSearch, Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  EmptyState,
  PageHeader,
  ProgressBar,
  StatusBadge,
  toneFor,
} from "@/components/kit/primitives";
import { StageStrip } from "@/components/kit/production";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGE_LABELS, buyerOrders } from "@/lib/data";

export const Route = createFileRoute("/buyer/orders/")({
  head: () => ({
    meta: [
      { title: "My Orders — TexMind Buyer Portal" },
      { name: "description", content: "Search and filter your garment orders and track their production stage." },
      { property: "og:title", content: "My Orders — TexMind Buyer Portal" },
      { property: "og:description", content: "Every order you placed, with live stage progress." },
    ],
  }),
  component: BuyerOrders,
});

function BuyerOrders() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const rows = buyerOrders.filter(
    (o) =>
      (status === "all" || o.status === status) &&
      (!q.trim() ||
        o.id.toLowerCase().includes(q.toLowerCase()) ||
        o.product.toLowerCase().includes(q.toLowerCase()) ||
        o.styleNo.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <AppShell variant="buyer">
      <PageHeader title="My Orders" subtitle="Track each order through the nine production stages." />

      <div className="surface mb-5 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order, product or style…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[160px] text-[13px]">
            <SelectValue />
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
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No orders found" body="Try a different search or status filter." />
      ) : (
        <div className="space-y-3">
          {rows.map((o) => (
            <Link key={o.id} to="/buyer/orders/$id" params={{ id: o.id }} className="surface lift block p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="metric text-[12px] text-muted-foreground">
                    {o.id} · PO {o.poNo}
                  </div>
                  <h3 className="text-[15px] font-semibold">{o.product}</h3>
                  <p className="text-[12px] text-muted-foreground">
                    {o.quantity.toLocaleString()} pcs · {o.color} · due {o.deliveryDate}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-muted-foreground">{STAGE_LABELS[o.currentStage]}</span>
                  <StatusBadge tone={toneFor(o.status)}>{o.status}</StatusBadge>
                </div>
              </div>
              <ProgressBar value={o.progress} className="mt-3.5" />
              <div className="mt-4">
                <StageStrip stages={o.stages} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
