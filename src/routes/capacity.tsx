import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Activity,
  Send,
  MessageSquare,
  MapPin,
  Phone,
  Clock,
  IndianRupee,
  Layers,
  ArrowRight,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, ProgressBar, StatusBadge, KpiCard } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STAGES,
  STAGE_WORKFORCE_CONFIGS,
  FACTORY_COMMUNITY_PROFILE,
  productionLines,
  sparkline,
  getStoredEmployees,
  saveStoredEmployees,
  type ProductionLine,
  type StageKey,
  type Employee,
} from "@/lib/data";
import {
  evaluateStageStaffing,
  dispatchWhatsAppCommunity,
  getStoredDispatchLogs,
  calculateFactoryWidePayroll,
  formatWhatsAppSosMessage,
  type StaffingAssessment,
  type WhatsAppCommunityDispatchLog,
} from "@/lib/workforce-prediction";

export const Route = createFileRoute("/capacity")({
  head: () => ({
    meta: [
      { title: "Workforce & Capacity Planning Board — TexMind" },
      {
        name: "description",
        content: "9-stage operator staffing, AI deficit prediction, emergency WhatsApp community dispatch, and piece-rate payroll.",
      },
      { property: "og:title", content: "Workforce & Capacity Planning Board — TexMind" },
      { property: "og:description", content: "AI-assisted operator allocation and WhatsApp community recruitment." },
    ],
  }),
  component: CapacityPlanningPage,
});

function CapacityPlanningPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>(productionLines);
  const [approvedRebalances, setApprovedRebalances] = useState<Record<string, boolean>>({});
  const [dispatchLogs, setDispatchLogs] = useState<WhatsAppCommunityDispatchLog[]>([]);

  // Modal State for WhatsApp Community Dispatch
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<StageKey>("yarn");
  const [customWorkerCount, setCustomWorkerCount] = useState<number>(10);
  const [customReason, setCustomReason] = useState<string>("");

  useEffect(() => {
    const loaded = getStoredEmployees();
    setEmployees(loaded);
    setDispatchLogs(getStoredDispatchLogs());
  }, []);

  // Compute live assessments across all 9 stages
  const stageAssessments: StaffingAssessment[] = STAGES.map((s) =>
    evaluateStageStaffing(s, employees),
  );

  const totalCapacityCeiling = STAGES.reduce(
    (acc, s) => acc + STAGE_WORKFORCE_CONFIGS[s].maxCapacity,
    0,
  );
  const totalActiveWorkers = employees.filter((e) => e.attendance === "Present").length;
  const totalDeficitCount = stageAssessments.reduce((acc, a) => acc + a.deficit, 0);
  const criticalStages = stageAssessments.filter((a) => a.criticality === "CRITICAL");

  // Payroll Calculation
  const factoryPayroll = calculateFactoryWidePayroll(employees);
  const totalDailyWages = factoryPayroll.reduce((acc, p) => acc + p.totalPayrollPayable, 0);

  const handleOpenSosModal = (stage: StageKey, defaultDeficit: number) => {
    setSelectedStage(stage);
    setCustomWorkerCount(Math.max(1, defaultDeficit));
    setCustomReason(`Urgent shortage of operators in ${STAGE_WORKFORCE_CONFIGS[stage].label} to clear pending line backlog`);
    setSosModalOpen(true);
  };

  const handleExecuteDispatch = () => {
    const log = dispatchWhatsAppCommunity({
      stage: selectedStage,
      workersNeeded: customWorkerCount,
      reason: customReason,
      triggerType: "MANUAL",
      actorName: "Factory Manager",
    });

    setDispatchLogs((prev) => [log, ...prev]);
    setSosModalOpen(false);
  };

  const handleApproveRebalance = (lineId: string, _recommendation: string) => {
    setApprovedRebalances((prev) => ({ ...prev, [lineId]: true }));
    toast.success("Workforce Reallocation Approved!", {
      description: "Transfer instructions sent to Floor Supervisor and Biometric Shift Manager.",
    });

    setLines((prev) =>
      prev.map((l) => {
        if (l.id === lineId) {
          return {
            ...l,
            operatorsAssigned: l.operatorsOptimal,
            actualHourly: l.targetHourly,
            efficiency: 91,
            status: "Optimal",
          };
        }
        if (l.id === "line-1") {
          return { ...l, operatorsAssigned: l.operatorsAssigned - 6 };
        }
        return l;
      }),
    );
  };

  const currentPreviewMessage = formatWhatsAppSosMessage({
    stage: selectedStage,
    workersNeeded: customWorkerCount,
    reason: customReason,
  });

  return (
    <AppShell>
      <PageHeader
        title="Workforce, 9-Stage Capacity & WhatsApp Community Dispatch"
        subtitle="Real-time operator headcount, AI shortage prediction, emergency Tiruppur community broadcasts, and piece-rate payroll."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                const refreshed = getStoredEmployees();
                setEmployees(refreshed);
                toast.info("Refreshed workforce biometric attendance data.");
              }}
            >
              <RefreshCw className="size-3.5" /> Refresh Roster
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-[#25D366] text-black hover:bg-[#20bd5a] font-semibold text-xs"
              onClick={() => handleOpenSosModal("yarn", 10)}
            >
              <Send className="size-3.5" /> Emergency WhatsApp Broadcast
            </Button>
          </div>
        }
      />

      {/* Top Overview KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          index={0}
          label="Active Floor Workforce"
          value={`${totalActiveWorkers} / ${totalCapacityCeiling}`}
          hint={`${Math.round((totalActiveWorkers / totalCapacityCeiling) * 100)}% total capacity occupancy`}
          trend={1.8}
          icon={Users}
          spark={sparkline(2)}
        />
        <KpiCard
          index={1}
          label="Total Operator Deficit"
          value={`${totalDeficitCount} Workers`}
          hint={`${criticalStages.length} stages in critical shortage`}
          trend={-2.4}
          icon={AlertTriangle}
          spark={sparkline(4, false)}
        />
        <KpiCard
          index={2}
          label="Daily Piece-Rate Payroll"
          value={`₹${totalDailyWages.toLocaleString("en-IN")}`}
          hint="Calculated across 9 production stages"
          trend={3.2}
          icon={IndianRupee}
          spark={sparkline(6)}
        />
        <KpiCard
          index={3}
          label="WhatsApp Community Reach"
          value="6.8K Members"
          hint="Tiruppur Freelance & Job Seekers Hub"
          trend={5.0}
          icon={MessageSquare}
          spark={sparkline(8)}
        />
      </div>

      {/* AI Intelligence Alert Banner */}
      {criticalStages.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="size-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  AI Critical Staffing Warning ({criticalStages.length} Stages at Deficit Risk):
                </span>{" "}
                {criticalStages.map((cs) => `${cs.label} (${cs.deficit} needed)`).join(", ")}. Stage throughput is operating under engineered pace. Immediate WhatsApp recruitment broadcast recommended.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-500/40 bg-amber-500/20 text-xs font-semibold hover:bg-amber-500/30"
              onClick={() => criticalStages[0] && handleOpenSosModal(criticalStages[0].stage, criticalStages[0].deficit)}
            >
              Broadcast for {criticalStages[0]?.label ?? "Critical Stage"} ({criticalStages[0]?.deficit ?? 0} Ops)
            </Button>
          </div>
        </div>
      )}

      {/* Main Tabbed Interface */}
      <Tabs defaultValue="stages" className="mt-6">
        <TabsList className="grid w-full grid-cols-4 bg-muted/60 p-1">
          <TabsTrigger value="stages" className="text-xs font-medium">
            9-Stage Staffing & WhatsApp SOS Hub
          </TabsTrigger>
          <TabsTrigger value="lines" className="text-xs font-medium">
            Production Lines Balancing
          </TabsTrigger>
          <TabsTrigger value="payroll" className="text-xs font-medium">
            Piece-Rate Payroll & Payouts
          </TabsTrigger>
          <TabsTrigger value="dispatches" className="text-xs font-medium">
            WhatsApp Dispatch Audit ({dispatchLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* ───────────────────────────────────────────────────────────────────
            TAB 1: 9-STAGE WORKFORCE STAFFING & WHATSAPP SOS HUB
            ─────────────────────────────────────────────────────────────────── */}
        <TabsContent value="stages" className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                9 Production Stages — Worker Allocation vs Maximum Engineered Capacity
              </h3>
              <p className="text-xs text-muted-foreground">
                Monitor live present workers against engineered ceilings (e.g. Yarn: 50, Sewing: 100). Trigger automatic or manual WhatsApp recruitment broadcasts to freelance communities.
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
              Factory Cluster: {FACTORY_COMMUNITY_PROFILE.cluster}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stageAssessments.map((assessment) => {
              const config = STAGE_WORKFORCE_CONFIGS[assessment.stage];
              const isCritical = assessment.criticality === "CRITICAL";
              const isModerate = assessment.criticality === "MODERATE";

              return (
                <div
                  key={assessment.stage}
                  className={`surface flex flex-col justify-between p-5 text-xs transition-all border ${
                    isCritical
                      ? "border-rose-500/40 bg-rose-500/[0.03] shadow-sm"
                      : isModerate
                        ? "border-amber-500/30 bg-amber-500/[0.02]"
                        : "border-border hover:border-primary/40"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          STAGE 0{STAGES.indexOf(assessment.stage) + 1} • {config.unit.toUpperCase()} UNIT
                        </span>
                        <h4 className="mt-0.5 text-base font-bold text-foreground">
                          {config.label}
                        </h4>
                      </div>
                      <StatusBadge
                        tone={
                          isCritical
                            ? "danger"
                            : isModerate
                              ? "warning"
                              : "success"
                        }
                      >
                        {assessment.criticality}
                      </StatusBadge>
                    </div>

                    {/* Headcount Gauge */}
                    <div className="mt-3.5 rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Active Staffing:</span>
                        <span className="font-bold text-foreground">
                          {assessment.presentCount} / {config.maxCapacity} Operators
                        </span>
                      </div>
                      <ProgressBar
                        value={assessment.occupancyPercent}
                        tone={isCritical ? "danger" : isModerate ? "warning" : "primary"}
                        className="mt-2"
                      />
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Ceiling Capacity: <strong className="text-foreground">{config.maxCapacity}</strong>
                        </span>
                        {assessment.deficit > 0 ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            Deficit: -{assessment.deficit} Workers
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            Full Capacity (0 Deficit)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Run-rate & Rates */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                      <div className="rounded border border-border/70 p-2 bg-background/50">
                        <div className="text-[10px] text-muted-foreground">Hourly Run Rate</div>
                        <div className="font-semibold text-foreground">
                          {assessment.currentEffectiveRunRate} / {config.hourlyRunRateTarget} {config.unit}/hr
                        </div>
                      </div>
                      <div className="rounded border border-border/70 p-2 bg-background/50">
                        <div className="text-[10px] text-muted-foreground">Piece Rate / Base Pay</div>
                        <div className="font-semibold text-foreground">
                          ₹{config.pieceRate}/{config.unit} • ₹{config.dailyBaseWage}/shift
                        </div>
                      </div>
                    </div>

                    {/* AI Assessment Verdict */}
                    <div className="mt-3 rounded border border-border/60 bg-muted/30 p-2.5 text-[11px] leading-relaxed">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Sparkles className="size-3 text-primary shrink-0" />
                        <span>AI Staffing Assessment ({assessment.aiConfidence}% conf):</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{assessment.aiVerdict}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 border-t border-border pt-3">
                    <Button
                      size="sm"
                      className={`w-full gap-1.5 text-xs font-semibold ${
                        isCritical
                          ? "bg-[#25D366] text-black hover:bg-[#20bd5a]"
                          : "border-border"
                      }`}
                      variant={isCritical ? "default" : "outline"}
                      onClick={() => handleOpenSosModal(assessment.stage, assessment.deficit || 5)}
                    >
                      <MessageSquare className="size-3.5" />
                      {isCritical
                        ? `Broadcast WhatsApp SOS for ${assessment.deficit} Workers`
                        : "Manual WhatsApp Broadcast"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ───────────────────────────────────────────────────────────────────
            TAB 2: PRODUCTION LINES BALANCING (ORIGINAL BOARD)
            ─────────────────────────────────────────────────────────────────── */}
        <TabsContent value="lines" className="mt-5 space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">
                  AI Capacity Line Rebalancing Recommendation:
                </span>{" "}
                Add staffing and production line records to view capacity recommendations.
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {lines.map((line) => {
              const isRebalanced = approvedRebalances[line.id];
              return (
                <div
                  key={line.id}
                  className="surface flex flex-col justify-between p-5 text-xs transition-colors hover:border-primary/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {line.stage} stage
                        </span>
                        <h4 className="mt-0.5 text-base font-semibold text-foreground">{line.name}</h4>
                        <p className="text-muted-foreground">
                          Running: <span className="font-medium text-foreground">{line.activeStyle}</span> ({line.activeOrderId})
                        </p>
                      </div>
                      <StatusBadge
                        tone={
                          line.status === "Bottleneck"
                            ? "danger"
                            : line.status === "Underloaded"
                              ? "warning"
                              : "success"
                        }
                      >
                        {line.status.toUpperCase()}
                      </StatusBadge>
                    </div>

                    <div className="mt-4 rounded-lg bg-muted/40 p-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Throughput Rate:</span>
                        <span className="font-semibold text-foreground">
                          {line.actualHourly} / {line.targetHourly} pcs/hr ({line.efficiency}% Efficiency)
                        </span>
                      </div>
                      <ProgressBar
                        value={line.efficiency}
                        tone={line.status === "Bottleneck" ? "danger" : "primary"}
                        className="mt-2"
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded border border-border/70 p-2">
                        <div className="text-[10px] text-muted-foreground">Operators</div>
                        <div className="font-semibold text-foreground">
                          {line.operatorsAssigned} / {line.operatorsOptimal} opt
                        </div>
                      </div>
                      <div className="rounded border border-border/70 p-2">
                        <div className="text-[10px] text-muted-foreground">Single Needle</div>
                        <div className="font-semibold text-foreground">{line.skillCoverage.singleNeedle}</div>
                      </div>
                      <div className="rounded border border-border/70 p-2">
                        <div className="text-[10px] text-muted-foreground">Overlock</div>
                        <div className="font-semibold text-foreground">{line.skillCoverage.overlock}</div>
                      </div>
                      <div className="rounded border border-border/70 p-2">
                        <div className="text-[10px] text-muted-foreground">Flatlock</div>
                        <div className="font-semibold text-foreground">{line.skillCoverage.flatlock}</div>
                      </div>
                    </div>

                    {line.aiRecommendation && !isRebalanced && (
                      <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-3 text-[11.5px]">
                        <div className="flex items-start gap-2">
                          <Sparkles className="size-3.5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-foreground">Suggested Reallocation:</span>
                            <p className="mt-0.5 text-muted-foreground">{line.aiRecommendation}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-[11px] text-muted-foreground">
                      Supervised by Process Lead
                    </span>
                    {line.status === "Bottleneck" && !isRebalanced ? (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs font-semibold"
                        onClick={() => handleApproveRebalance(line.id, line.aiRecommendation || "")}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Approve Operator Transfer (+6)
                      </Button>
                    ) : isRebalanced ? (
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-4" />
                        Rebalanced to Optimal (26 Ops)
                      </div>
                    ) : (
                      <StatusBadge tone="success">RUNNING OPTIMAL</StatusBadge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ───────────────────────────────────────────────────────────────────
            TAB 3: PIECE-RATE WAGE & SHIFT PAYROLL ENGINE
            ─────────────────────────────────────────────────────────────────── */}
        <TabsContent value="payroll" className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Shift A Piece-Rate Wage & Operator Payout Ledger
              </h3>
              <p className="text-xs text-muted-foreground">
                Automated calculation: Gross Pay = Max(Base Shift Pay, Output × Piece Rate) + Overtime Allowance.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs font-semibold"
              onClick={() => {
                toast.success("Shift A Payroll Exported & Approved!", {
                  description: `Generated payout voucher of ₹${totalDailyWages.toLocaleString("en-IN")} across all 9 departments.`,
                });
              }}
            >
              <CheckCircle2 className="size-3.5" /> Approve & Export Shift Payroll
            </Button>
          </div>

          {/* Department Breakdown Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {factoryPayroll.map((p) => (
              <div key={p.stage} className="surface p-3.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">{p.stageLabel}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {p.activeWorkers}/{p.maxCapacity} Ops
                  </span>
                </div>
                <div className="mt-2 text-muted-foreground flex justify-between">
                  <span>Shift Output:</span>
                  <span className="font-semibold text-foreground">
                    {p.totalOutput.toLocaleString()} {p.unit}
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground flex justify-between">
                  <span>Total Payroll:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{p.totalPayrollPayable.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground flex justify-between text-[11px]">
                  <span>Avg Worker Wage:</span>
                  <span>₹{p.averageDailyWage}/day</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Worker Wage Slips */}
          <div className="surface overflow-hidden mt-4">
            <div className="border-b border-border p-3.5">
              <h4 className="text-xs font-semibold text-foreground">Individual Operator Wage Slips (Shift A)</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2.5">ID & Name</th>
                    <th className="px-3.5 py-2.5">Stage / Department</th>
                    <th className="px-3.5 py-2.5">Role</th>
                    <th className="px-3.5 py-2.5">Today Output</th>
                    <th className="px-3.5 py-2.5">Piece Rate</th>
                    <th className="px-3.5 py-2.5">Base Pay</th>
                    <th className="px-3.5 py-2.5">Piece Earnings</th>
                    <th className="px-3.5 py-2.5">OT Pay</th>
                    <th className="px-3.5 py-2.5 text-right">Gross Daily Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {factoryPayroll
                    .flatMap((p) => p.wageSlips)
                    .map((slip) => (
                      <tr key={slip.employeeId} className="hover:bg-muted/20">
                        <td className="px-3.5 py-2.5 font-medium text-foreground">
                          {slip.name}{" "}
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({slip.employeeId})
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">{slip.stageLabel}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">{slip.role}</td>
                        <td className="px-3.5 py-2.5 font-semibold">
                          {slip.todayOutput} {slip.unit}
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">
                          ₹{slip.pieceRate}/{slip.unit}
                        </td>
                        <td className="px-3.5 py-2.5">₹{slip.baseShiftPay}</td>
                        <td className="px-3.5 py-2.5">₹{slip.pieceRateEarnings}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">
                          {slip.overtimeHours > 0
                            ? `+₹${slip.overtimeEarnings} (${slip.overtimeHours}h)`
                            : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{slip.grossDailyPay.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ───────────────────────────────────────────────────────────────────
            TAB 4: WHATSAPP DISPATCH AUDIT LOGS
            ─────────────────────────────────────────────────────────────────── */}
        <TabsContent value="dispatches" className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                WhatsApp Community Dispatch Broadcast Logs
              </h3>
              <p className="text-xs text-muted-foreground">
                Historical record of emergency recruitment announcements sent to Tiruppur freelance & job seeker WhatsApp communities.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Total Dispatches: <strong>{dispatchLogs.length}</strong>
            </span>
          </div>

          {dispatchLogs.length === 0 ? (
            <div className="surface p-8 text-center text-xs text-muted-foreground">
              <MessageSquare className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              <p>No WhatsApp community broadcasts sent yet.</p>
              <p className="mt-1">
                Click <strong>"Emergency WhatsApp Broadcast"</strong> above to send your first dispatch.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dispatchLogs.map((log) => (
                <div key={log.id} className="surface p-4 text-xs space-y-3 border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] font-bold px-2 py-0.5 rounded text-[11px]">
                        <MessageSquare className="size-3" /> {log.status}
                      </span>
                      <span className="font-bold text-foreground text-sm">
                        {log.stageLabel} — {log.workersRequested} Operators Needed
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        ({log.id})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>{log.dispatchedAt}</span>
                      <span>•</span>
                      <span>Dispatched by <strong>{log.dispatchedBy}</strong></span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11.5px] text-muted-foreground">
                    <div>
                      <strong>Community:</strong> {log.destinationCommunity}
                    </div>
                    <div>
                      <strong>Contact:</strong> {log.contactManager} ({log.contactPhone})
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <a
                        href={log.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline flex items-center gap-0.5"
                      >
                        Location Map <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>

                  <div className="rounded bg-muted/50 p-3 font-mono text-[11px] whitespace-pre-wrap text-foreground/90 leading-relaxed border border-border/50">
                    {log.messageText}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-7"
                      onClick={() => {
                        navigator.clipboard.writeText(log.messageText);
                        toast.success("Copied WhatsApp Broadcast Text to Clipboard!");
                      }}
                    >
                      <Copy className="size-3" /> Copy Message
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ───────────────────────────────────────────────────────────────────
          MODAL: EMERGENCY WHATSAPP COMMUNITY DISPATCH PREVIEW & TRIGGER
          ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={sosModalOpen} onOpenChange={setSosModalOpen}>
        <DialogContent className="max-w-2xl text-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="size-6 rounded-full bg-[#25D366] text-black flex items-center justify-center text-xs font-bold">
                WA
              </span>
              Emergency WhatsApp Community Broadcast
            </DialogTitle>
            <DialogDescription className="text-xs">
              Prepare and send a direct recruitment broadcast to the Tiruppur Freelancers & Textile Job Seekers WhatsApp Community.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Stage & Count Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Target Department / Stage:
                </label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value as StageKey)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_WORKFORCE_CONFIGS[s].label} (Cap: {STAGE_WORKFORCE_CONFIGS[s].maxCapacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Number of Operators Needed:
                </label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={customWorkerCount}
                  onChange={(e) => setCustomWorkerCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Reason / Urgency Note for WhatsApp Group:
              </label>
              <Textarea
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="e.g. Critical 420 pcs/day deficit on active European polo work order..."
                className="text-xs resize-none"
              />
            </div>

            {/* Live Message Preview */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Live WhatsApp Message Preview (Includes Factory Address, Phone & Maps):
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                  Ready to Dispatch
                </span>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground max-h-56 overflow-y-auto">
                {currentPreviewMessage}
              </div>
            </div>

            {/* Destination Verification */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-[11.5px] space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Send className="size-3 text-primary" /> Target WhatsApp Destination:
              </div>
              <div className="text-muted-foreground">
                • Community: <strong>{FACTORY_COMMUNITY_PROFILE.whatsappCommunityName}</strong>
                <br />
                • Contact: <strong>{FACTORY_COMMUNITY_PROFILE.contactPerson}</strong> ({FACTORY_COMMUNITY_PROFILE.contactPhone})
                <br />
                • Landmark: {FACTORY_COMMUNITY_PROFILE.landmark}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setSosModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-[#25D366] text-black hover:bg-[#20bd5a] font-bold"
              onClick={handleExecuteDispatch}
            >
              <Send className="size-3.5" /> Dispatch to Manager & Log Console
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
