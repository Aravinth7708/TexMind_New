import { AlertTriangle, ExternalLink } from "lucide-react";
import { MarkdownResponse } from "./markdown-response";
import { ApprovalActionCard } from "./approval-action-card";
import { parseAiResponse, type AiResponseBlock } from "@/lib/ai-response";
import { CodeRenderer } from "./renderers/code-renderer";
import { TableRenderer } from "./renderers/table-renderer";
import { ChartRenderer } from "./renderers/chart-renderer";
import { JsonRenderer } from "./renderers/json-renderer";
import { MathRenderer } from "./renderers/math-renderer";
import { DiagramRenderer } from "./renderers/diagram-renderer";
import { StepsRenderer } from "./renderers/steps-renderer";
import { FileRenderer } from "./renderers/file-renderer";
import { FormRenderer } from "./renderers/form-renderer";
import { MediaRenderer } from "./renderers/media-renderer";

export function UniversalResponseRenderer({
  response,
  onActionDecided,
}: {
  response: unknown;
  onActionDecided?: () => void;
}) {
  const envelope = parseAiResponse(response);

  return (
    <div className="space-y-4">
      {envelope.blocks.map((rawBlock: AiResponseBlock, index: number) => {
        const block = rawBlock as any;
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case "markdown":
            return <MarkdownResponse key={key} content={block.content || ""} />;

          case "table":
            return (
              <TableRenderer
                key={key}
                title={block.title}
                columns={block.columns || []}
                rows={block.rows || []}
                searchable={block.searchable ?? true}
                exportable={block.exportable ?? true}
              />
            );

          case "code":
            return (
              <CodeRenderer
                key={key}
                title={block.title}
                language={block.language}
                content={block.content || ""}
                lineNumbers={block.lineNumbers}
              />
            );

          case "chart":
            return (
              <ChartRenderer
                key={key}
                title={block.title}
                description={block.description}
                chartType={block.chartType || "bar"}
                xKey={block.xKey || "name"}
                yKeys={block.yKeys || ["value"]}
                data={block.data || []}
              />
            );

          case "json":
            return <JsonRenderer key={key} title={block.title} data={block.data} />;

          case "math":
            return (
              <MathRenderer
                key={key}
                expression={block.expression || ""}
                displayMode={block.displayMode ? "block" : "inline"}
                explanation={block.explanation}
              />
            );

          case "diagram":
            return (
              <DiagramRenderer
                key={key}
                title={block.title}
                chartType={block.chartType}
                nodes={block.nodes || []}
                edges={block.edges}
              />
            );

          case "steps":
            return <StepsRenderer key={key} title={block.title} steps={block.steps || []} />;

          case "file":
            return (
              <FileRenderer
                key={key}
                name={block.name || "file"}
                size={block.size}
                extension={block.extension}
                url={block.url}
                description={block.description}
              />
            );

          case "media":
            return (
              <MediaRenderer
                key={key}
                mediaType={block.mediaType || "image"}
                url={block.url || ""}
                caption={block.caption}
                transcript={block.transcript}
              />
            );

          case "form":
            return (
              <FormRenderer
                key={key}
                title={block.title || "Form"}
                description={block.description}
                fields={block.fields || []}
                submitLabel={block.submitLabel}
              />
            );

          case "status":
            return (
              <span
                key={key}
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  block.tone === "danger"
                    ? "bg-destructive/15 text-destructive"
                    : block.tone === "warning"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : block.tone === "success"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-primary/10 text-primary"
                }`}
              >
                {block.label}
              </span>
            );

          case "warning":
            return (
              <div
                key={key}
                className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs"
              >
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">{block.title}</p>
                  <p className="mt-0.5 text-muted-foreground">{block.message}</p>
                </div>
              </div>
            );

          case "sources":
            return (
              <div key={key} className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                <p className="mb-1.5 font-semibold text-foreground">Verified References</p>
                <div className="space-y-1">
                  {(block.items || []).map((source: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                      <ExternalLink className="size-3 text-primary" />
                      <span className="font-medium text-foreground">{source.label}</span>
                      <span className="text-[10px] text-muted-foreground">({source.reference})</span>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "action":
            return (
              <ApprovalActionCard
                key={key}
                proposalId={block.proposalId || ""}
                title={block.title || "Proposal"}
                rationale={block.rationale}
                onDecided={onActionDecided ? onActionDecided : () => {}}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
