import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TexMind Factory Intelligence" },
      { name: "description", content: "Factory profile, stage configuration, alert preferences and appearance." },
      { property: "og:title", content: "Settings — TexMind" },
      { property: "og:description", content: "Configure the factory profile, alerts and appearance." },
    ],
  }),
  component: SettingsPage,
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px]">{label}</Label>
      <Input defaultValue={value} className="h-9 text-[13px]" />
    </div>
  );
}

function Row({ label, hint, defaultChecked = true }: { label: string; hint: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 py-3.5 last:border-0">
      <div>
        <div className="text-[13.5px] font-medium">{label}</div>
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      </div>
      <Switch defaultChecked={defaultChecked} onCheckedChange={() => toast.success(`${label} updated`)} />
    </div>
  );
}

function SettingsPage() {
  const { theme, toggle } = useTheme();

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Factory configuration and personal preferences." />

      <Tabs defaultValue="factory">
        <TabsList className="flex-wrap">
          <TabsTrigger value="factory" className="text-[12.5px]">Factory Profile</TabsTrigger>
          <TabsTrigger value="stages" className="text-[12.5px]">Stage Configuration</TabsTrigger>
          <TabsTrigger value="alerts" className="text-[12.5px]">Alerts</TabsTrigger>
          <TabsTrigger value="appearance" className="text-[12.5px]">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="factory" className="mt-4">
          <div className="surface max-w-2xl p-5">
            <h3 className="text-[15px] font-semibold">Factory profile</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Factory name" value="" />
              <Field label="Location" value="" />
              <Field label="GST number" value="" />
              <Field label="Daily capacity (pcs)" value="" />
              <Field label="Contact email" value="" />
              <Field label="Contact phone" value="" />
            </div>
            <Button size="sm" className="mt-4" onClick={() => toast.success("Factory profile saved")}>
              Save changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="stages" className="mt-4">
          <div className="surface max-w-2xl p-5">
            <h3 className="text-[15px] font-semibold">Stage configuration</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enable the stages tracked in your production flow.
            </p>
            <div className="mt-3">
              {["Yarn", "Knitting", "Dyeing", "Compacting", "Cutting", "Printing", "Sewing", "Ironing", "Packing"].map((s) => (
                <Row key={s} label={s} hint={`Track ${s.toLowerCase()} progress, rejections and manpower.`} />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <div className="surface max-w-2xl p-5">
            <h3 className="text-[15px] font-semibold">Alert preferences</h3>
            <div className="mt-3">
              <Row label="Delay alerts" hint="Notify when an order slips behind its committed date." />
              <Row label="Stage completion" hint="Notify when a stage is completed on any order." />
              <Row label="Low stock warnings" hint="Notify when a material falls below minimum level." />
              <Row label="Buyer messages" hint="Notify when a buyer sends a message or query." />
              <Row label="AI daily digest" hint="Receive an AI summary of factory health each morning." defaultChecked={false} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          <div className="surface max-w-2xl p-5">
            <h3 className="text-[15px] font-semibold">Appearance</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Currently using {theme === "dark" ? "dark" : "light"} mode.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={toggle}>
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              Switch to {theme === "dark" ? "light" : "dark"} mode
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
