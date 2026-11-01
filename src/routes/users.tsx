import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  ArrowRightLeft,
  Users,
  Shield,
  Phone,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, StatusBadge } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  users,
  getStoredEmployees,
  saveStoredEmployees,
  type StageKey,
  type Employee,
  type EmployeeSkill,
  type EmployeeShift,
  type EmployeeAttendance,
} from "@/lib/data";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "User & Workforce Management — TexMind" },
      {
        name: "description",
        content: "Factory managers, stage supervisors, and shop-floor operator rosters across all 9 production departments.",
      },
      { property: "og:title", content: "User & Workforce Management — TexMind" },
      { property: "og:description", content: "Control accounts, departments, and attendance across the factory floor." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<"workforce" | "system">("workforce");

  // Filter States for Workforce
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [attendanceFilter, setAttendanceFilter] = useState<string>("all");

  // Employee Modal (Create / Edit)
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    stage: StageKey;
    role: string;
    skill: EmployeeSkill;
    shift: EmployeeShift;
    attendance: EmployeeAttendance;
    todayOutput: number;
    overtimeHours: number;
  }>({
    name: "",
    phone: "",
    stage: "yarn",
    role: "Ring Frame Operator",
    skill: "Skilled Operator",
    shift: "Shift A (08:00 - 17:00)",
    attendance: "Present",
    todayOutput: 150,
    overtimeHours: 0,
  });

  // Reassign Modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignEmp, setReassignEmp] = useState<Employee | null>(null);
  const [targetStage, setTargetStage] = useState<StageKey>("sewing");

  useEffect(() => {
    setEmployees(getStoredEmployees());
  }, []);

  const handleOpenAddEmployee = () => {
    setEditingEmpId(null);
    setFormData({
      name: "",
      phone: "+91 9842X XXXXX",
      stage: "yarn",
      role: STAGE_WORKFORCE_CONFIGS.yarn.roles[0] ?? "Operator",
      skill: "Skilled Operator",
      shift: "Shift A (08:00 - 17:00)",
      attendance: "Present",
      todayOutput: 160,
      overtimeHours: 0,
    });
    setEmpModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setFormData({
      name: emp.name,
      phone: emp.phone,
      stage: emp.stage,
      role: emp.role,
      skill: emp.skill,
      shift: emp.shift,
      attendance: emp.attendance,
      todayOutput: emp.todayOutput,
      overtimeHours: emp.overtimeHours,
    });
    setEmpModalOpen(true);
  };

  const handleSaveEmployee = () => {
    if (!formData.name.trim()) {
      toast.error("Please enter employee name.");
      return;
    }

    let updated: Employee[];
    if (editingEmpId) {
      updated = employees.map((e) =>
        e.id === editingEmpId ? { ...e, ...formData } : e,
      );
      toast.success(`Updated details for employee ${formData.name}`);
    } else {
      const stageCode = formData.stage.slice(0, 3).toUpperCase();
      const count = employees.filter((e) => e.stage === formData.stage).length + 1;
      const newId = `EMP-${stageCode}-${String(count).padStart(2, "0")}`;

      const newEmp: Employee = {
        id: newId,
        ...formData,
        joinedDate: "Today",
        performanceScore: 90,
      };
      updated = [newEmp, ...employees];
      toast.success(`Added new operator ${newEmp.name} (ID: ${newId})`);
    }

    setEmployees(updated);
    saveStoredEmployees(updated);
    setEmpModalOpen(false);
  };

  const handleToggleAttendance = (id: string) => {
    const updated = employees.map((e) => {
      if (e.id === id) {
        const nextAttendance: EmployeeAttendance =
          e.attendance === "Present" ? "Absent" : "Present";
        const nextOutput = nextAttendance === "Present" ? (e.todayOutput || 150) : 0;
        return { ...e, attendance: nextAttendance, todayOutput: nextOutput };
      }
      return e;
    });

    setEmployees(updated);
    saveStoredEmployees(updated);
    const emp = employees.find((e) => e.id === id);
    toast.info(`Updated attendance for ${emp?.name}: ${emp?.attendance === "Present" ? "Absent" : "Present"}`);
  };

  const handleOpenReassign = (emp: Employee) => {
    setReassignEmp(emp);
    setTargetStage(emp.stage === "yarn" ? "sewing" : "yarn");
    setReassignModalOpen(true);
  };

  const handleExecuteReassign = () => {
    if (!reassignEmp) return;
    const targetConfig = STAGE_WORKFORCE_CONFIGS[targetStage];
    const updated = employees.map((e) =>
      e.id === reassignEmp.id
        ? {
            ...e,
            stage: targetStage,
            role: targetConfig.roles[0] ?? "Operator",
          }
        : e,
    );

    setEmployees(updated);
    saveStoredEmployees(updated);
    setReassignModalOpen(false);
    toast.success(`Reallocated ${reassignEmp.name} from ${STAGE_WORKFORCE_CONFIGS[reassignEmp.stage].label} to ${targetConfig.label}`);
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    const updated = employees.filter((e) => e.id !== id);
    setEmployees(updated);
    saveStoredEmployees(updated);
    toast.success(`Removed operator ${name}`);
  };

  // Filtered employees list
  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      !searchQuery.trim() ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.phone.includes(searchQuery);

    const matchesStage = stageFilter === "all" || e.stage === stageFilter;
    const matchesAttendance =
      attendanceFilter === "all" || e.attendance === attendanceFilter;

    return matchesSearch && matchesStage && matchesAttendance;
  });

  return (
    <AppShell>
      <PageHeader
        title="User & Shop-Floor Workforce Management"
        subtitle="Manage factory managers, department supervisors, and production workers across all 9 stages."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5 text-xs font-semibold"
              onClick={handleOpenAddEmployee}
            >
              <Plus className="size-3.5" /> Add Floor Operator
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="workforce" className="text-xs font-semibold gap-1.5">
            <Users className="size-3.5" /> 9-Stage Floor Operators ({employees.length})
          </TabsTrigger>
          <TabsTrigger value="system" className="text-xs font-semibold gap-1.5">
            <Shield className="size-3.5" /> System Roles & Stage Incharges ({users.length})
          </TabsTrigger>
        </TabsList>

        {/* ───────────────────────────────────────────────────────────────────
            TAB 1: SHOP-FLOOR WORKFORCE (ALL 9 STAGES)
            ─────────────────────────────────────────────────────────────────── */}
        <TabsContent value="workforce" className="mt-4 space-y-4">
          <div className="surface p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search operator, ID, role or phone..."
                  className="h-8.5 pl-8.5 text-xs"
                />
              </div>

              {/* Stage Filter */}
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="h-8.5 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="all">All 9 Stages</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_WORKFORCE_CONFIGS[s].label}
                  </option>
                ))}
              </select>

              {/* Attendance Filter */}
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                className="h-8.5 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="all">All Attendance</option>
                <option value="Present">Present Only</option>
                <option value="Absent">Absent Only</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>

            <div className="text-xs text-muted-foreground font-mono">
              Showing <strong>{filteredEmployees.length}</strong> of {employees.length} operators
            </div>
          </div>

          {/* Table */}
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Operator ID & Name</th>
                    <th className="px-4 py-3">Department (Stage)</th>
                    <th className="px-4 py-3">Role & Skill</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Shift</th>
                    <th className="px-4 py-3">Today Output</th>
                    <th className="px-4 py-3">Attendance</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEmployees.map((emp) => {
                    const isPresent = emp.attendance === "Present";
                    const config = STAGE_WORKFORCE_CONFIGS[emp.stage];

                    return (
                      <tr key={emp.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{emp.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{emp.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{config.label}</span>
                          <div className="text-[10px] text-muted-foreground">
                            Max Cap: {config.maxCapacity}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{emp.role}</div>
                          <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                            {emp.skill}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">{emp.phone}</td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.shift}</td>
                        <td className="px-4 py-3 font-semibold">
                          {emp.todayOutput} {config.unit}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(emp.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                              isPresent
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25"
                            }`}
                            title="Click to toggle attendance"
                          >
                            {isPresent ? (
                              <>
                                <UserCheck className="size-3" /> Present
                              </>
                            ) : (
                              <>
                                <UserX className="size-3" /> Absent
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px] gap-1"
                              onClick={() => handleOpenReassign(emp)}
                              title="Reassign to another production stage"
                            >
                              <ArrowRightLeft className="size-3" /> Reassign
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => handleOpenEditEmployee(emp)}
                              title="Edit operator details"
                            >
                              <Edit2 className="size-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                              onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                              title="Remove operator"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ───────────────────────────────────────────────────────────────────
            TAB 2: SYSTEM ROLES & STAGE INCHARGES
            ─────────────────────────────────────────────────────────────────── */}
        <TabsContent value="system" className="mt-4">
          <div className="surface overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground">
                Executive Admins & Certified Stage Incharges
              </h3>
              <Button
                size="sm"
                className="gap-1.5 text-xs font-semibold"
                onClick={() => toast.success("Invitation link sent to user")}
              >
                <Plus className="size-3" /> Invite Manager
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["User", "Role", "Assigned Department", "Email", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.email} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.role}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.stage}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">{u.email}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={u.status === "Active" ? "success" : "muted"}>
                          {u.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ───────────────────────────────────────────────────────────────────
          MODAL: ADD / EDIT OPERATOR
          ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={empModalOpen} onOpenChange={setEmpModalOpen}>
        <DialogContent className="max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingEmpId ? "Edit Operator Details" : "Add New Production Operator"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure department assignment, skill qualification, and shift output.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Full Name:
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. K. Senthil Kumar"
                className="h-8.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Department (Stage):
                </label>
                <select
                  value={formData.stage}
                  onChange={(e) => {
                    const stage = e.target.value as StageKey;
                    setFormData({
                      ...formData,
                      stage,
                      role: STAGE_WORKFORCE_CONFIGS[stage].roles[0] ?? "Operator",
                    });
                  }}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_WORKFORCE_CONFIGS[s].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Role / Specialization:
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs"
                >
                  {STAGE_WORKFORCE_CONFIGS[formData.stage].roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Phone Number:
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9842X XXXXX"
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Skill Grade:
                </label>
                <select
                  value={formData.skill}
                  onChange={(e) => setFormData({ ...formData, skill: e.target.value as any })}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="Senior Master">Senior Master</option>
                  <option value="Skilled Operator">Skilled Operator</option>
                  <option value="Semi-Skilled">Semi-Skilled</option>
                  <option value="Trainee">Trainee</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Shift:
                </label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="Shift A (08:00 - 17:00)">Shift A (08:00 - 17:00)</option>
                  <option value="Shift B (17:00 - 01:00)">Shift B (17:00 - 01:00)</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Initial Attendance:
                </label>
                <select
                  value={formData.attendance}
                  onChange={(e) => setFormData({ ...formData, attendance: e.target.value as any })}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Today Output ({STAGE_WORKFORCE_CONFIGS[formData.stage].unit}):
                </label>
                <Input
                  type="number"
                  value={formData.todayOutput}
                  onChange={(e) => setFormData({ ...formData, todayOutput: parseInt(e.target.value) || 0 })}
                  className="h-8.5 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Overtime (Hours):
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.overtimeHours}
                  onChange={(e) => setFormData({ ...formData, overtimeHours: parseFloat(e.target.value) || 0 })}
                  className="h-8.5 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEmpModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEmployee}>
              Save Operator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────────────
          MODAL: REASSIGN OPERATOR TO ANOTHER STAGE
          ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
        <DialogContent className="max-w-sm text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Reassign Production Department</DialogTitle>
            <DialogDescription className="text-xs">
              Transfer operator to balance deficits in another stage.
            </DialogDescription>
          </DialogHeader>

          {reassignEmp && (
            <div className="space-y-3 py-2">
              <div className="rounded bg-muted/40 p-2.5">
                <div className="font-semibold text-foreground">{reassignEmp.name}</div>
                <div className="text-muted-foreground">
                  Current Department:{" "}
                  <strong>{STAGE_WORKFORCE_CONFIGS[reassignEmp.stage].label}</strong>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Destination Department (Stage):
                </label>
                <select
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value as StageKey)}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs"
                >
                  {STAGES.filter((s) => s !== reassignEmp.stage).map((s) => (
                    <option key={s} value={s}>
                      {STAGE_WORKFORCE_CONFIGS[s].label} (Cap: {STAGE_WORKFORCE_CONFIGS[s].maxCapacity})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReassignModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleExecuteReassign}>
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
