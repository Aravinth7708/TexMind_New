import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buyers, orders } from "@/lib/data";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const orderHits = orders
      .filter(
        (o) =>
          o.id.toLowerCase().includes(term) ||
          o.product.toLowerCase().includes(term) ||
          o.buyer.toLowerCase().includes(term),
      )
      .slice(0, 5)
      .map((o) => ({
        key: o.id,
        title: o.id,
        sub: `${o.product} · ${o.buyer}`,
        go: () => navigate({ to: "/orders/$id", params: { id: o.id } }),
      }));
    const buyerHits = buyers
      .filter((b) => b.company.toLowerCase().includes(term) || b.name.toLowerCase().includes(term))
      .slice(0, 3)
      .map((b) => ({
        key: b.id,
        title: b.company,
        sub: `Buyer · ${b.name}`,
        go: () => navigate({ to: "/buyers" }),
      }));
    return [...orderHits, ...buyerHits];
  }, [q, navigate]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Search orders, buyers, products..."
        className="h-9 rounded-lg bg-muted/60 pl-9 text-[13px]"
      />
      {open && results.length > 0 && (
        <div className="surface absolute left-0 top-11 z-50 w-full overflow-hidden p-1.5">
          {results.map((r) => (
            <button
              key={r.key + r.sub}
              onMouseDown={r.go}
              className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left hover:bg-muted"
            >
              <span className="text-[13px] font-semibold">{r.title}</span>
              <span className="text-[11.5px] text-muted-foreground">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="surface absolute left-0 top-11 z-50 w-full p-3 text-[13px] text-muted-foreground">
          No matches for “{q}”.
        </div>
      )}
    </div>
  );
}
