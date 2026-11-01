import { useState } from "react";
import { HelpCircle, AlertTriangle, Cpu, History, CheckCircle2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/kit/primitives";

export type RootCauseAnalysis = {
  title: string;
  category: "Machine" | "Quality" | "Capacity" | "Material" | "Process";
  severity: "critical" | "high" | "medium" | "low";
  primaryCause: string;
  telemetrySignals: string[];
  historicalPrecedent: string;
  immediateAction: string;
  permanentFix: string;
};

export const SAMPLE_ROOT_CAUSES: Record<string, RootCauseAnalysis> = {};

export function RootCauseModal({
  insightId,
  customAnalysis,
  triggerLabel = "Why?",
  className = "",
}: {
  insightId?: string | undefined;
  customAnalysis?: RootCauseAnalysis;
  triggerLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const data =
    customAnalysis ||
    (insightId && SAMPLE_ROOT_CAUSES[insightId]) || {
      title: "Root Cause Diagnostics",
      category: "Process" as const,
      severity: "medium" as const,
      primaryCause:
        "Throughput velocity deviation detected from telemetry signals and machine operational logs.",
      telemetrySignals: [
        "Cycle time tracking variance outside 1.5 sigma control limit.",
        "Operational telemetry logged stage pace deviation.",
      ],
      historicalPrecedent: "Matches previous seasonal variance patterns.",
      immediateAction: "Verify operator skill alignment and inspect machine calibration.",
      permanentFix: "Update standard operating procedure (SOP) threshold.",
    };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 gap-1 px-2.5 text-xs font-medium text-primary hover:bg-primary/10 ${className}`}
        >
          <HelpCircle className="size-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <AlertTriangle className="size-4" />
              </span>
              <DialogTitle className="text-base font-semibold">AI Root Cause Analysis</DialogTitle>
            </div>
            <StatusBadge tone={data.severity === "critical" ? "danger" : data.severity === "high" ? "warning" : "info"}>
              {data.category.toUpperCase()}
            </StatusBadge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {data.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Primary Cause */}
          <div className="rounded-lg border border-border bg-card p-3.5">
            <p className="text-xs font-semibold text-foreground">Identified Primary Cause</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{data.primaryCause}</p>
          </div>

          {/* Telemetry Evidence */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Cpu className="size-3.5" />
              Live Sensor & Telemetry Evidence
            </div>
            <ul className="mt-2 space-y-1.5 pl-4 text-xs text-foreground/80 list-disc">
              {data.telemetrySignals.map((signal, idx) => (
                <li key={idx}>{signal}</li>
              ))}
            </ul>
          </div>

          {/* Historical Precedent */}
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <History className="size-3.5" />
              Historical Pattern Correlation
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{data.historicalPrecedent}</p>
          </div>

          {/* Recovery Recommendations */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                Immediate Action
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{data.immediateAction}</p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <ArrowRight className="size-3.5" />
                Permanent Prevention Fix
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{data.permanentFix}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={() => setOpen(false)}>
            Close Analysis
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
