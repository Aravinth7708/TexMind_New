import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { buyerNotifications, type Notification } from "@/lib/data";

export const Route = createFileRoute("/buyer/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — TexMind Buyer Portal" },
      { name: "description", content: "Updates on your order stages, shipments and factory messages." },
      { property: "og:title", content: "Notifications — TexMind Buyer Portal" },
      { property: "og:description", content: "Stay informed on every update for your orders." },
    ],
  }),
  component: BuyerNotifications,
});

function BuyerNotifications() {
  const [items, setItems] = useState<Notification[]>(buyerNotifications);
  const unread = items.filter((n) => !n.read).length;

  return (
    <AppShell variant="buyer">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread update${unread === 1 ? "" : "s"} on your orders.`}
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

      {items.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications" body="You're all caught up." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}
              className={`surface lift flex w-full items-start gap-3 p-4 text-left ${n.read ? "opacity-70" : ""}`}
            >
              <span className="mt-1.5">
                <StatusBadge
                  tone={n.type === "delay" ? "danger" : n.type === "stage" ? "success" : "info"}
                  dot={false}
                >
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
