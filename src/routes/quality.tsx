import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldAlert,
  Sparkles,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, StatusBadge, ProgressBar, chartAxis, tooltipStyle } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  defectHeatmapData,
  qualityDrilldowns,
  paretoDefects,
  sampleVisionQC,
  type VisionQCSample,
  type DefectHeatmapCell,
} from "@/lib/data";
import { RootCauseModal } from "@/components/kit/root-cause-modal";

export const Route = createFileRoute("/quality")({
  head: () => ({
    meta: [
      { title: "Quality Intelligence & Vision QC — TexMind" },
      {
        name: "description",
        content: "Defect pattern detection, machine drift correlation, and AI vision-based garment inspection.",
      },
      { property: "og:title", content: "Quality Intelligence & Vision QC — TexMind" },
      { property: "og:description", content: "AI quality heatmaps, defect drilldowns, and automated fabric inspection." },
    ],
  }),
  component: QualityIntelligencePage,
});

function QualityIntelligencePage() {
  const [selectedSample, setSelectedSample] = useState<VisionQCSample | null>(sampleVisionQC[0] ?? null);
  const [activeDefectFilter, setActiveDefectFilter] = useState<string>("all");
  const [inspectingImage, setInspectingImage] = useState(false);
  const [customLoggedDecision, setCustomLoggedDecision] = useState<string | null>(null);

  const handleSimulateScan = () => {
    if (!selectedSample) return;
    setInspectingImage(true);
    setTimeout(() => {
      setInspectingImage(false);
      toast.success("AI Visual Defect Scan Complete!", {
        description: `Identified ${selectedSample.defects.length} defects with ${selectedSample.confidence}% confidence.`,
      });
    }, 800);
  };

  const handleLogResult = (decision: "PASS" | "FAIL" | "REWORK") => {
    if (!selectedSample) return;
    setCustomLoggedDecision(decision);
    toast.success(`QC Decision Recorded: ${decision}`, {
      description: `Logged to Order ${selectedSample.orderId} batch history.`,
    });
  };

  if (!selectedSample) {
    return (
      <AppShell>
        <PageHeader
          title="Quality Intelligence & Vision QC"
          subtitle="Review quality inspections and defect records from your factory."
        />
        <div className="surface mt-5 flex min-h-56 flex-col items-center justify-center gap-2 p-6 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">No quality records yet</h2>
          <p className="max-w-md text-xs text-muted-foreground">
            Quality inspection results will appear here after your factory records its first inspection.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Quality Intelligence & Vision QC"
        subtitle="Detect recurring defect patterns by machine, shift, and fabric, with automated vision defect identification."
      />

      <Tabs defaultValue="heatmap" className="mt-2">
        <TabsList>
          <TabsTrigger value="heatmap">Quality Heatmap & Drilldowns</TabsTrigger>
          <TabsTrigger value="vision">AI Vision-Based QC</TabsTrigger>
        </TabsList>

        {/* QUALITY HEATMAP & DRILLDOWNS TAB */}
        <TabsContent value="heatmap" className="mt-4 space-y-5">
          {/* Top Alert Banner */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-muted-foreground">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="size-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Quality alerts will appear here when inspection data is available.
                  </span>
                  <p className="mt-0.5">
                    Record quality inspections to see defect patterns and root cause analysis.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            {/* DEFECT HEATMAP (7 COLS) */}
            <div className="surface p-5 lg:col-span-7">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Defect Frequency Heatmap</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Stage-by-stage defect distribution across live production orders.
                  </p>
                </div>
                <StatusBadge tone="neutral">NO DATA</StatusBadge>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Stage</th>
                      <th className="px-3 py-2.5 font-semibold">Defect Type</th>
                      <th className="px-3 py-2.5 font-semibold">Count</th>
                      <th className="px-3 py-2.5 font-semibold">Defect Rate</th>
                      <th className="px-3 py-2.5 font-semibold">Severity</th>
                      <th className="px-3 py-2.5 font-semibold">Analysis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {defectHeatmapData.map((d, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium capitalize text-foreground">{d.stage}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.defectType}</td>
                        <td className="metric px-3 py-2 font-semibold">{d.count}</td>
                        <td className="metric px-3 py-2 font-semibold">
                          <span
                            className={
                              d.rate > 2.0
                                ? "text-destructive font-bold"
                                : d.rate > 1.0
                                  ? "text-amber-600 font-semibold"
                                  : "text-muted-foreground"
                            }
                          >
                            {d.rate}%
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={
                              d.severity === "critical"
                                ? "danger"
                                : d.severity === "major"
                                  ? "warning"
                                  : "info"
                            }
                          >
                            {d.severity.toUpperCase()}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2">
                          <RootCauseModal
                            triggerLabel="Why?"
                            customAnalysis={{
                              title: `${d.defectType} in ${d.stage}`,
                              category: "Quality",
                              severity: d.severity === "critical" ? "critical" : "high",
                              primaryCause: `Elevated defect frequency in ${d.stage} reached ${d.rate}% with ${d.count} recorded instances in current production batch.`,
                              telemetrySignals: [
                                `Inline inspection logged ${d.count} units flagged.`,
                                `Threshold limit for ${d.stage} is 1.2% maximum acceptable defect rate.`,
                              ],
                              historicalPrecedent: "Complies with AQL 1.5 standard corrective cycle.",
                              immediateAction: "Inspect tooling and recalibrate machine tolerances.",
                              permanentFix: "Update QC checkpoint frequency for this stage.",
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PARETO ANALYSIS (5 COLS) */}
            <div className="surface p-5 lg:col-span-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Pareto 80/20 Defect Analysis</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Top 3 defects account for 69% of all garment rejections.
                  </p>
                </div>
              </div>

              <div className="mt-4 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paretoDefects}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="defect" {...chartAxis} tick={{ fontSize: 9 }} interval={0} angle={-15} height={42} textAnchor="end" />
                    <YAxis {...chartAxis} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]}>
                      {paretoDefects.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={index < 2 ? "var(--color-chart-5)" : "var(--color-chart-1)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 p-3 text-xs">
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Primary Defect:</span>
                  <span className="font-semibold text-destructive">Skipped Stitch (32%)</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Secondary Defect:</span>
                  <span className="font-semibold text-amber-600">Seam Puckering (20%)</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Cumulative 80% Cutoff:</span>
                  <span className="font-semibold text-foreground">Top 4 Defects</span>
                </div>
              </div>
            </div>
          </div>

          {/* DRILLDOWNS BY MACHINE, SHIFT & FABRIC */}
          <div className="surface p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Granular Machine & Shift Correlation Ledger
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cross-correlates telemetry across machines, shifts, operator lines, and fabric lots.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Machine / Workstation</th>
                    <th className="px-3 py-2.5 font-semibold">Shift</th>
                    <th className="px-3 py-2.5 font-semibold">Line / Department</th>
                    <th className="px-3 py-2.5 font-semibold">Fabric Type</th>
                    <th className="px-3 py-2.5 font-semibold">Defect Rate</th>
                    <th className="px-3 py-2.5 font-semibold">Identified Root Cause</th>
                    <th className="px-3 py-2.5 font-semibold">Anomaly Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {qualityDrilldowns.map((q, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium text-foreground">{q.machine}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{q.shift}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{q.operatorLine}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{q.fabric}</td>
                      <td className="metric px-3 py-2.5 font-semibold">
                        <span className={q.defectRate > 2.0 ? "text-destructive font-bold" : "text-foreground"}>
                          {q.defectRate}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{q.rootCause}</td>
                      <td className="px-3 py-2.5">
                        {q.anomalyDetected ? (
                          <StatusBadge tone="danger">ANOMALY SPIKE</StatusBadge>
                        ) : (
                          <StatusBadge tone="success">NORMAL</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* AI VISION-BASED QC TAB */}
        <TabsContent value="vision" className="mt-4 space-y-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <Camera className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">
                  Automated Edge Vision Defect Detection:
                </span>{" "}
                Analyzes fabric surface, stitch alignment, shade consistency (Delta E), and contamination spots in real time.
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            {/* SAMPLE SELECTOR & CONTROLS (4 COLS) */}
            <div className="space-y-4 lg:col-span-4">
              <div className="surface p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Inspection Sample
                </h3>
                <div className="mt-3 space-y-2">
                  {sampleVisionQC.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => {
                        setSelectedSample(sample);
                        setCustomLoggedDecision(null);
                      }}
                      className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                        selectedSample.id === sample.id
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{sample.id}</span>
                        <StatusBadge
                          tone={
                            sample.overallResult === "FAIL"
                              ? "danger"
                              : sample.overallResult === "REWORK"
                                ? "warning"
                                : "success"
                          }
                        >
                          {sample.overallResult}
                        </StatusBadge>
                      </div>
                      <div className="mt-1 text-foreground/80">{sample.itemName}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        Order: {sample.orderId} · Stage: {sample.stage}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <Button
                    size="sm"
                    className="w-full gap-1.5 text-xs font-semibold"
                    disabled={inspectingImage}
                    onClick={handleSimulateScan}
                  >
                    <Sparkles className="size-3.5" />
                    {inspectingImage ? "Scanning Texture..." : "Run AI Visual Scan"}
                  </Button>
                </div>
              </div>

              {/* Inspector Decision Controls */}
              <div className="surface p-4 text-xs">
                <h3 className="font-semibold text-foreground">Manager QC Disposition</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Confirm or override AI recommendation for this inspection batch.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-[11px]"
                    onClick={() => handleLogResult("PASS")}
                  >
                    <CheckCircle2 className="size-3" /> Pass
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 text-[11px]"
                    onClick={() => handleLogResult("REWORK")}
                  >
                    <RotateCcw className="size-3" /> Rework
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 text-[11px]"
                    onClick={() => handleLogResult("FAIL")}
                  >
                    <XCircle className="size-3" /> Reject
                  </Button>
                </div>
                {customLoggedDecision && (
                  <div className="mt-2.5 rounded bg-muted/60 p-2 text-center text-[11px] font-medium text-foreground">
                    Logged Status: <span className="font-bold">{customLoggedDecision}</span>
                  </div>
                )}
              </div>
            </div>

            {/* VISUAL INSPECTION VIEWER (8 COLS) */}
            <div className="surface p-5 lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Live Optical Feed: {selectedSample.itemName}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Captured at {selectedSample.inspectionTime} · Confidence: {selectedSample.confidence}%
                  </p>
                </div>
                <StatusBadge
                  tone={
                    (customLoggedDecision || selectedSample.overallResult) === "FAIL"
                      ? "danger"
                      : (customLoggedDecision || selectedSample.overallResult) === "REWORK"
                        ? "warning"
                        : "success"
                  }
                >
                  {(customLoggedDecision || selectedSample.overallResult)}
                </StatusBadge>
              </div>

              {/* SIMULATED CAMERA VIEW WITH BOUNDING BOXES */}
              <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 flex items-center justify-center text-white">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

                {/* Simulated Target Reticle */}
                <div className="absolute inset-4 rounded-lg border border-dashed border-white/20 pointer-events-none" />
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded bg-black/60 px-2 py-1 text-[10px] font-mono text-emerald-400 backdrop-blur-sm">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  SENSOR: 4K OPTICAL MACRO · 60 FPS
                </div>

                {/* DEFECT BOUNDING BOXES */}
                {selectedSample.defects.map((defect) => (
                  <div
                    key={defect.id}
                    className="absolute border-2 border-destructive bg-destructive/15 rounded flex flex-col justify-between p-1 transition-all"
                    style={{
                      left: `${defect.coordinates.x}%`,
                      top: `${defect.coordinates.y}%`,
                      width: `${defect.coordinates.width}%`,
                      height: `${defect.coordinates.height}%`,
                    }}
                  >
                    <span className="rounded bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs w-fit">
                      {defect.label} ({defect.confidence}%)
                    </span>
                    <span className="text-[8px] font-mono text-white/90 bg-black/70 px-1 rounded w-fit">
                      SEV: {defect.severity.toUpperCase()}
                    </span>
                  </div>
                ))}

                {selectedSample.defects.length === 0 && (
                  <div className="text-center">
                    <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
                    <p className="mt-2 text-sm font-semibold">100% Quality Pass</p>
                    <p className="text-xs text-white/60">No structural or optical anomalies identified.</p>
                  </div>
                )}
              </div>

              {/* DETECTED DEFECT CARDS */}
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Detected Defect Diagnostics ({selectedSample.defects.length})
                </h4>
                {selectedSample.defects.map((defect) => (
                  <div
                    key={defect.id}
                    className="rounded-lg border border-border bg-muted/30 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-3.5 text-destructive" />
                        <span className="font-semibold text-foreground">{defect.label}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {defect.category}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-semibold text-destructive">
                        {defect.confidence}% Confidence
                      </span>
                    </div>
                    <p className="mt-1.5 text-muted-foreground">
                      <span className="font-medium text-foreground">Corrective Disposition:</span>{" "}
                      {defect.recommendedAction}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
