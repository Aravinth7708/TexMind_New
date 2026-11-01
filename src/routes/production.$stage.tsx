import { createFileRoute, Link } from "@tanstack/react-router";
import { Factory } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/kit/primitives";
import { StageDashboard } from "@/components/kit/stage-dashboard";
import { Button } from "@/components/ui/button";
import { STAGES, STAGE_LABELS, type StageKey } from "@/lib/data";

export const Route = createFileRoute("/production/$stage")({
  head: ({ params }) => {
    const key = params.stage as StageKey;
    const label = STAGE_LABELS[key] ?? "Production";
    return {
      meta: [
        { title: `${label} Production — TexMind` },
        {
          name: "description",
          content: `${label} stage dashboard: output, pending quantity, rejections and order allocation.`,
        },
        { property: "og:title", content: `${label} Production — TexMind` },
        {
          property: "og:description",
          content: `Live ${label.toLowerCase()} performance across all active garment orders.`,
        },
      ],
    };
  },
  component: StagePage,
});

function StagePage() {
  const { stage } = Route.useParams();
  if (!STAGES.includes(stage as StageKey)) {
    return (
      <AppShell>
        <EmptyState
          icon={Factory}
          title="Unknown production stage"
          body={`“${stage}” is not one of the nine factory stages.`}
          action={
            <Button asChild size="sm">
              <Link to="/production">Back to production</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }
  return <StageDashboard stage={stage as StageKey} />;
}
