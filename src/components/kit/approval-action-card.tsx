import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { decideProposal } from "@/lib/operational-client";
import { useSession } from "@/lib/session";

export function ApprovalActionCard({
  proposalId,
  title,
  rationale,
  onDecided,
}: {
  proposalId: string;
  title: string;
  rationale: string;
  onDecided?: () => void;
}) {
  const session = useSession();
  const [saving, setSaving] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const decide = async (decision: "approve" | "dismiss") => {
    setSaving(true);
    try {
      await decideProposal(proposalId, decision, session);
      setResolved(decision === "approve" ? "Approved" : "Dismissed");
      toast.success(`Proposal ${decision === "approve" ? "approved" : "dismissed"}`);
      onDecided?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update proposal");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 p-3.5">
      <p className="text-[13px] font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{rationale}</p>
      {resolved ? (
        <p className="mt-3 text-xs font-medium text-primary">
          {resolved} — recorded in the operational ledger.
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={saving}>
                <Check className="size-3.5" />
                Approve
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve this recovery action?</AlertDialogTitle>
                <AlertDialogDescription>
                  This records an approval only. It does not automatically change production,
                  purchasing, or buyer communications.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => decide("approve")}>
                  Approve proposal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={saving}>
                <X className="size-3.5" />
                {saving ? <Loader2 className="size-3 animate-spin" /> : "Dismiss"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Dismiss this recovery action?</AlertDialogTitle>
                <AlertDialogDescription>
                  This records a one-way decision in the operational ledger. It will not change
                  production data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => decide("dismiss")}>
                  Dismiss proposal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
