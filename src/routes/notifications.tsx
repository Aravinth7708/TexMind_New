import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminNotifications, type Notification } from "@/lib/data";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Centre — TexMind" },
      { name: "description", content: "Delay alerts, stage completions, inventory warnings and buyer messages." },
      { property: "og:title", content: "Notification Centre — TexMind" },
      { property: "og:description", content: "All factory alerts in one prioritised feed." },
    ],
  }),
  component: NotificationsPage,
});

const toneFor = (t: Notification["type"]) =>
  t === "delay" ? "danger" : t === "inventory" ? "warning" : t === "stage" ? "success" : "info";

function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>(adminNotifications);
  const [tab, setTab] = useState("all");

  const rows = items.filter((n) => (tab === "all" ? true : tab === "unread" ? !n.read : n.type === tab));
  const unread = items.filter((n) => !n.read).length;

  return (
    <AppShell>
      <PageHeader
        title="Notification Centre"
        subtitle={`${unread} unread alert${unread === 1 ? "" : "s"} across the factory.`}
        actions={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setItems((p) => p.map((n) => ({ ...n, read: true })));
              toast.success("All notifications marked as read");
            }}
          >
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="flex-wrap">
          {(
            [
              ["all", "All"],
              ["unread", `Unread (${unread})`],
              ["delay", "Delays"],
              ["stage", "Stage updates"],
              ["inventory", "Inventory"],
              ["buyer", "Buyer"],
            ] as const
          ).map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="text-[12.5px]">
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {rows.length === 0 ? (
        <EmptyState icon={BellOff} title="Nothing here" body="No notifications match this filter." />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <button
              key={n.id}
              onClick={() => setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}
              className={`surface lift flex w-full items-start gap-3 p-4 text-left ${n.read ? "opacity-70" : ""}`}
            >
              <span className="mt-1.5">
                <StatusBadge tone={toneFor(n.type) as never} dot={false}>
                  {n.type}
                </StatusBadge>
              </span>
              <span className="flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold">{n.title}</span>
                  {!n.read && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span className="mt-1 block text-[13px] text-muted-foreground">{n.body}</span>
                <span className="mt-1.5 block text-[11.5px] text-muted-foreground">{n.time}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}
