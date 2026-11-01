import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, StatusBadge } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buyerOrders, buyers } from "@/lib/data";

export const Route = createFileRoute("/buyer/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — TexMind Buyer Portal" },
      { name: "description", content: "Buyer company details, contact information and order summary." },
      { property: "og:title", content: "My Profile — TexMind Buyer Portal" },
      { property: "og:description", content: "Manage your buyer account details with TexMind." },
    ],
  }),
  component: BuyerProfile,
});

function BuyerProfile() {
  const buyer = buyers[0]!;

  return (
    <AppShell variant="buyer">
      <PageHeader title="My Profile" subtitle="Your company and contact details." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <h3 className="text-[15px] font-semibold">Company details</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Contact name", buyer.name],
                ["Company", buyer.company],
                ["Country", buyer.country],
                ["Email", buyer.contact],
                ["Buyer code", buyer.id],
                ["Last order", buyer.lastOrder],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="space-y-1.5">
                <Label className="text-[12px]">{label}</Label>
                <Input defaultValue={value} className="h-9 text-[13px]" />
              </div>
            ))}
          </div>
          <Button size="sm" className="mt-4" onClick={() => toast.success("Profile updated")}>
            Save changes
          </Button>
        </div>

        <div className="surface p-5">
          <h3 className="text-[15px] font-semibold">Order summary</h3>
          <div className="mt-4 space-y-2.5 text-[13px]">
            {[
              ["Total orders", buyerOrders.length],
              ["Active", buyerOrders.filter((o) => o.status !== "Completed").length],
              ["Completed", buyerOrders.filter((o) => o.status === "Completed").length],
              ["Delayed", buyerOrders.filter((o) => o.status === "Delayed").length],
              [
                "Total pieces",
                buyerOrders.reduce((a, o) => a + o.quantity, 0).toLocaleString(),
              ],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between border-b border-border/60 pb-2 last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="metric font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <StatusBadge tone="success" className="mt-4">
            Verified buyer account
          </StatusBadge>
        </div>
      </div>
    </AppShell>
  );
}
