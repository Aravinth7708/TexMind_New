import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarRange,
  ClipboardCheck,
  FileDown,
  Gauge,
  Loader2,
  PackageSearch,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Insights — TexMind" },
      {
        name: "description",
        content: "Generate daily, weekly, delay, inventory and efficiency reports for the factory.",
      },
      { property: "og:title", content: "Reports & Insights — TexMind" },
      { property: "og:description", content: "Export production and performance reports in one click." },
    ],
  }),
  component: ReportsPage,
});

const REPORTS: { title: string; body: string; icon: LucideIcon }[] = [
  { title: "Daily Production Report", body: "Stage-wise output, rejections and manpower for the selected day.", icon: CalendarRange },
  { title: "Weekly Production Report", body: "Seven-day production trend against plan, by stage and line.", icon: TrendingDown },
  { title: "Order Performance Report", body: "Progress, lead time and stage cycle time for every live order.", icon: ClipboardCheck },
  { title: "Delay Report", body: "Delayed orders, root-cause stage and recovery recommendations.", icon: PackageSearch },
  { title: "Inventory Report", body: "Material cover, reservations and reorder requirements.", icon: FileDown },
  { title: "Factory Efficiency Report", body: "Line, machine and stage efficiency with utilisation gaps.", icon: Gauge },
];

function ReportCard({ title, body, icon: Icon }: { title: string; body: string; icon: LucideIcon }) {
  const [busy, setBusy] = useState<"gen" | "pdf" | null>(null);

  function run(kind: "gen" | "pdf") {
    setBusy(kind);
    setTimeout(() => {
      setBusy(null);
      toast.success(kind === "gen" ? `${title} generated` : `${title} exported as PDF`, {
        description: "Covering 01 – 08 Sep 2026 across all nine production stages.",
      });
    }, 1200);
  }

  return (
    <div className="surface lift flex flex-col p-5">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-3.5 text-[15px] font-semibold">{title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={() => run("gen")} disabled={busy !== null}>
          {busy === "gen" ? <Loader2 className="size-4 animate-spin" /> : "Generate Report"}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => run("pdf")} disabled={busy !== null}>
          {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-3.5" />}
          Export PDF
        </Button>
      </div>
    </div>
  );
}

function ReportsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Reports & Insights"
        subtitle="Generate and export factory performance reports."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <ReportCard key={r.title} {...r} />
        ))}
      </div>
    </AppShell>
  );
}
