import { ArrowRight, GitFork, Workflow, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/kit/primitives";

export function DiagramRenderer({
  title,
  chartType = "flowchart",
  nodes,
  edges = [],
}: {
  title?: string;
  chartType?: "flowchart" | "sequence" | "architecture";
  nodes: {
    id: string;
    label: string;
    subtext?: string;
    tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  }[];
  edges?: {
    from: string;
    to: string;
    label?: string;
  }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs">
      {title && (
        <div className="mb-4 flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">{title}</span>
          </div>
          <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase font-mono font-semibold text-muted-foreground">
            {chartType}
          </span>
        </div>
      )}

      {/* Visual Flow Representation */}
      <div className="overflow-x-auto py-3">
        <div className="flex items-center gap-3 min-w-max px-2">
          {nodes.map((node, idx) => (
            <div key={node.id} className="flex items-center gap-3">
              <div
                className={`flex flex-col justify-between rounded-xl border p-3.5 shadow-xs transition-all w-48 ${
                  node.tone === "primary"
                    ? "border-primary/40 bg-primary/5"
                    : node.tone === "success"
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : node.tone === "warning"
                        ? "border-amber-500/40 bg-amber-500/5"
                        : node.tone === "danger"
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-border bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono text-muted-foreground">0{idx + 1}</span>
                  {node.tone && (
                    <StatusBadge
                      tone={
                        node.tone === "primary"
                          ? "info"
                          : node.tone === "neutral"
                            ? "muted"
                            : node.tone
                      }
                    >
                      {node.tone.toUpperCase()}
                    </StatusBadge>
                  )}
                </div>
                <div className="mt-2 text-xs font-bold text-foreground">{node.label}</div>
                {node.subtext && (
                  <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                    {node.subtext}
                  </p>
                )}
              </div>

              {idx < nodes.length - 1 && (
                <div className="flex flex-col items-center">
                  <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                  {edges[idx]?.label && (
                    <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                      {edges[idx]?.label}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
