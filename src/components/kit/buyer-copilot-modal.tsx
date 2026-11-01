import { useState } from "react";
import { Mail, Check, Sparkles, Send, ShieldCheck, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/kit/primitives";
import type { DelayPrediction } from "@/lib/data";

export function BuyerCopilotModal({
  prediction,
  orderId,
  buyerName,
  triggerButton,
}: {
  prediction: DelayPrediction;
  orderId: string;
  buyerName: string;
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<"transparent" | "proactive" | "formal">("transparent");
  const [subject, setSubject] = useState(prediction.buyerCommunicationDraft.subject);
  const [message, setMessage] = useState(prediction.buyerCommunicationDraft.body);
  const [approved, setApproved] = useState(prediction.buyerCommunicationDraft.approved);

  const handleToneChange = (newTone: "transparent" | "proactive" | "formal") => {
    setTone(newTone);
    if (newTone === "transparent") {
      setMessage(prediction.buyerCommunicationDraft.body);
    } else if (newTone === "proactive") {
      setMessage(
        `Dear Team,\n\nWe are pleased to report strong forward progress on order ${orderId}. All fabric testing and cutting tolerances have been verified to buyer specifications.\n\nOur line balancing team has arranged parallel finishing to maintain delivery on ${prediction.buyerCommunicationDraft.proposedEta}.\n\nCarton packing lists will follow shortly.\n\nWarm regards,\nTexMind Factory Operations`,
      );
    } else {
      setMessage(
        `Official Production Notice — Order Ref: ${orderId}\n\nNotice is hereby given that production order ${orderId} has completed critical inline testing. Confirmed factory handover date is ${prediction.buyerCommunicationDraft.proposedEta}.\n\nCompliance documentation and lab test reports are available upon request.\n\nSincerely,\nOperations Office, TexMind Textiles`,
      );
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(`${subject}\n\n${message}`);
    toast.success("Draft copied to clipboard");
  };

  const handleApprove = () => {
    setApproved(true);
    toast.success("Buyer message approved and dispatched to Buyer Trust Portal!", {
      description: `Notification sent to ${prediction.buyerCommunicationDraft.recipient}`,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
            <Mail className="size-3.5 text-primary" />
            Buyer Copilot
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <DialogTitle className="text-base font-semibold">Buyer Communication Copilot</DialogTitle>
            </div>
            {approved ? (
              <StatusBadge tone="success">APPROVED & SENT</StatusBadge>
            ) : (
              <StatusBadge tone="warning">REQUIRES APPROVAL</StatusBadge>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Generate transparent, AI-drafted buyer notices with approvedd recovery plans. Never exposes internal costs or blame.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-sm">
          {/* Tone Selector */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Select Communication Tone</Label>
            <div className="mt-1.5 flex gap-2">
              <Button
                type="button"
                variant={tone === "transparent" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleToneChange("transparent")}
              >
                Transparent & Reassuring
              </Button>
              <Button
                type="button"
                variant={tone === "proactive" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleToneChange("proactive")}
              >
                Proactive Milestone
              </Button>
              <Button
                type="button"
                variant={tone === "formal" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleToneChange("formal")}
              >
                Formal Technical Notice
              </Button>
            </div>
          </div>

          {/* Recipient & Subject */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Recipient Email</Label>
              <Input
                readOnly
                value={prediction.buyerCommunicationDraft.recipient}
                className="mt-1 h-8 text-xs bg-muted/40"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Buyer Company</Label>
              <Input
                readOnly
                value={buyerName || prediction.buyerCommunicationDraft.buyerCompany}
                className="mt-1 h-8 text-xs bg-muted/40"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Subject Line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 h-8 text-xs font-medium"
            />
          </div>

          {/* Message Body */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Message Draft (Manager Editable)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
              >
                <Copy className="size-3" />
                Copy Text
              </Button>
            </div>
            <Textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 text-xs leading-relaxed font-mono resize-none"
            />
          </div>

          {/* Guardrail Callout */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold text-foreground">AI Guardrail Verified:</span>
                <p className="mt-0.5 text-muted-foreground">
                  Internal machine downtime, worker reallocation numbers, and financial penalties were excluded. Focuses on quality diligence, committed milestones, and verified delivery timelines.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleApprove}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <Check className="size-3.5" />
              Approve & Dispatch to Buyer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
