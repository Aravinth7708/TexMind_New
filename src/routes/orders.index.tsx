import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PackageSearch, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, PageHeader } from "@/components/kit/primitives";
import {
  CreateOrderDialog,
  FilterBar,
  OrderTable,
  emptyFilters,
  filterOrders,
  type Filters,
} from "@/components/kit/orders";
import { Button } from "@/components/ui/button";
import { getStoredOrders, saveStoredOrders, type Order } from "@/lib/data";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — TexMind Factory Intelligence" },
      { name: "description", content: "Track and manage every garment order across the factory floor." },
      { property: "og:title", content: "Orders — TexMind" },
      { property: "og:description", content: "Search, filter and manage all factory production orders." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setOrders(getStoredOrders());
  }, []);

  const filtered = useMemo(() => filterOrders(orders, filters), [orders, filters]);

  const handleCreated = (newOrder: Order) => {
    const updated = [newOrder, ...orders];
    setOrders(updated);
    saveStoredOrders(updated);
  };

  return (
    <AppShell>
      <PageHeader
        title="Orders"
        subtitle="Track and manage all factory orders."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create Order
          </Button>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} />

      <div className="mb-3 text-[12.5px] text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {orders.length} orders
      </div>

      {filtered.length ? (
        <OrderTable orders={filtered} />
      ) : (
        <EmptyState
          icon={PackageSearch}
          title="No orders match these filters"
          body="Try clearing a filter or search for a different order, buyer or product."
          action={
            <Button variant="outline" size="sm" onClick={() => setFilters(emptyFilters)}>
              Clear filters
            </Button>
          }
        />
      )}

      <CreateOrderDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={handleCreated}
      />
    </AppShell>
  );
}
