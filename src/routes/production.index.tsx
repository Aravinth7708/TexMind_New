import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/kit/primitives";
import { LiveOrderRow, ProductionStageCard } from "@/components/kit/production";
import { orders, stageSummaries } from "@/lib/data";

export const Route = createFileRoute("/production/")({
  head: () => ({
    meta: [
      { title: "Live Production Flow — TexMind" },
      {
        name: "description",
        content: "Live nine-stage garment production pipeline with per-stage load and order progress.",
      },
      { property: "og:title", content: "Live Production Flow — TexMind" },
      { property: "og:description", content: "Yarn to packing pipeline monitoring for every active order." },
    ],
  }),
  component: ProductionPage,
});

function ProductionPage() {
  return (
    <AppShell>
      <PageHeader
        title="Live Production Flow"
        subtitle="Monitor every active order across the factory."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stageSummaries.map((s) => (
          <ProductionStageCard key={s.key} stage={s} />
        ))}
      </div>

      <h2 className="mb-3 mt-7 text-lg font-semibold">Live Order Flow</h2>
      <div className="grid gap-3 xl:grid-cols-2">
        {orders
          .filter((o) => o.status !== "Completed")
          .map((o) => (
            <LiveOrderRow key={o.id} order={o} />
          ))}
      </div>
    </AppShell>
  );
}
