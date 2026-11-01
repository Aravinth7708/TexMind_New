import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, StatusBadge } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getStoredBuyers,
  saveStoredBuyers,
  type Buyer,
} from "@/lib/data";

export const Route = createFileRoute("/buyers")({
  head: () => ({
    meta: [
      { title: "Buyers — TexMind Factory Intelligence" },
      { name: "description", content: "Buyer accounts with active, completed and delayed order counts." },
      { property: "og:title", content: "Buyers — TexMind" },
      { property: "og:description", content: "Manage buyer relationships and their order history." },
    ],
  }),
  component: BuyersPage,
});

function BuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", country: "", contact: "" });

  useEffect(() => {
    setBuyers(getStoredBuyers());
  }, []);

  const rows = buyers.filter(
    (b) =>
      !q.trim() ||
      b.company.toLowerCase().includes(q.toLowerCase()) ||
      b.name.toLowerCase().includes(q.toLowerCase()),
  );

  const handleDeleteBuyer = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete buyer "${name}"?`)) return;
    const updated = buyers.filter((b) => b.id !== id);
    setBuyers(updated);
    saveStoredBuyers(updated);
    toast.success(`Buyer ${name} deleted`);
  };

  return (
    <AppShell>
      <PageHeader
        title="Buyers"
        subtitle="Buyer accounts and their order performance."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Create Buyer
          </Button>
        }
      />

      <div className="surface mb-5 p-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search buyer or company…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="surface flex flex-col items-center justify-center p-12 text-center">
          <p className="text-[14px] font-medium text-foreground">No buyers found</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Create your first buyer account to start linking orders and tracking performance.
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Create Buyer
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => (
            <div key={b.id} className="surface lift group relative p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold">{b.company}</h3>
                  <p className="text-xs text-muted-foreground">
                    {b.name} · {b.country}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge tone={b.delayed ? "warning" : "success"} dot={false}>
                    {b.delayed ? `${b.delayed} delayed` : "All on track"}
                  </StatusBadge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    title="Delete buyer"
                    onClick={() => handleDeleteBuyer(b.id, b.company)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  ["Active", b.active],
                  ["Completed", b.completed],
                  ["Delayed", b.delayed],
                  ["Total", b.total],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg border border-border bg-muted/40 p-2">
                    <div className="metric text-[15px] font-semibold">{v}</div>
                    <div className="text-[10.5px] text-muted-foreground">{k}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
                <span>{b.contact}</span>
                <span>Last order {b.lastOrder}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Create Buyer</DialogTitle>
            <DialogDescription>Add a buyer account to the factory order book.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(
              [
                ["Contact name", "name"],
                ["Company", "company"],
                ["Country", "country"],
                ["Email", "contact"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[12px]">{label}</Label>
                <Input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="h-9 text-[13px]"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!form.company.trim()) {
                  toast.error("Company name is required");
                  return;
                }
                const newBuyer: Buyer = {
                  id: `BUY-${String(Date.now()).slice(-4)}`,
                  name: form.name || "New contact",
                  company: form.company.trim(),
                  country: form.country || "—",
                  contact: form.contact || "—",
                  active: 0,
                  completed: 0,
                  delayed: 0,
                  total: 0,
                  lastOrder: "—",
                };
                const updated = [newBuyer, ...buyers];
                setBuyers(updated);
                saveStoredBuyers(updated);
                setForm({ name: "", company: "", country: "", contact: "" });
                setOpen(false);
                toast.success("Buyer created and saved");
              }}
            >
              Create Buyer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
