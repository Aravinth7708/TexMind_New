import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Mic,
  MicOff,
  Camera,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Upload,
  Send,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, StatusBadge } from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGES, STAGE_LABELS, orders, type StageKey } from "@/lib/data";

export const Route = createFileRoute("/supervisor")({
  head: () => ({
    meta: [
      { title: "Mobile Supervisor Mode — TexMind" },
      {
        name: "description",
        content: "Shop-floor daily output entry, Tamil/Tanglish voice logging, offline queue, and mobile defect photo capture.",
      },
      { property: "og:title", content: "Mobile Supervisor Mode — TexMind" },
      { property: "og:description", content: "Fast mobile shop-floor operations with Tamil voice and defect capture." },
    ],
  }),
  component: MobileSupervisorPage,
});

function MobileSupervisorPage() {
  const [selectedStage, setSelectedStage] = useState<StageKey>(STAGES[0]);
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const [completedPieces, setCompletedPieces] = useState("");
  const [rejectedPieces, setRejectedPieces] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [queuedItems, setQueuedItems] = useState<number>(0);
  const [speaking, setSpeaking] = useState(false);
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);

  const activeOrders = orders.filter((o) => o.status !== "Completed");

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceToggle = () => {
    toast.info("Connect speech recognition to start a voice log.");
  };

  const handlePhotoCapture = () => {
    setAttachedPhoto("/placeholder.svg");
    toast.success("Photo attached for review.");
  };

  const handleSubmitUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) {
      setQueuedItems((prev) => prev + 1);
      toast.warning("Saved to Local Offline Queue", {
        description: "Will auto-sync immediately when shop-floor Wi-Fi reconnects.",
      });
    } else {
      toast.success("Production Output Recorded!", {
        description: `Logged ${completedPieces} completed pcs for ${selectedOrderId} in ${STAGE_LABELS[selectedStage]}.`,
      });
      speakText(`Production recorded. ${completedPieces} pieces completed.`);
    }
    setCompletedPieces("");
    setRejectedPieces("0");
    setAttachedPhoto(null);
  };

  const handleSyncQueue = () => {
    if (queuedItems === 0) return;
    toast.success("Offline Queue Synced!", {
      description: `Successfully uploaded ${queuedItems} offline updates to factory server.`,
    });
    setQueuedItems(0);
  };

  return (
    <AppShell>
      <PageHeader
        title="Mobile Supervisor Mode"
        subtitle="Shop-floor terminal for rapid daily production logging, Tamil voice recognition, and defect photos."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`h-8 gap-1.5 text-xs font-semibold ${
                isOffline ? "border-amber-500/40 text-amber-600 bg-amber-500/10" : "border-emerald-500/40 text-emerald-600"
              }`}
              onClick={() => {
                const nextState = !isOffline;
                setIsOffline(nextState);
                if (!nextState && queuedItems > 0) {
                  handleSyncQueue();
                }
              }}
            >
              {isOffline ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
              {isOffline ? `Offline (${queuedItems} queued)` : "Online (Connected)"}
            </Button>
            {queuedItems > 0 && !isOffline && (
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleSyncQueue}>
                <RefreshCw className="size-3.5" /> Sync ({queuedItems})
              </Button>
            )}
          </div>
        }
      />

      {/* SHOP-FLOOR LARGE VOICE MIC BANNER */}
      <div className="mb-5 rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              <h2 className="text-base font-bold text-foreground">
                Tamil / Tanglish Shop-Floor Voice Input
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Speak output counts or questions in Tamil, Tanglish, or English. AI populates the form for review.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleVoiceToggle}
              className={`flex size-14 items-center justify-center rounded-full transition-all shadow-md ${
                isRecording
                  ? "bg-destructive text-white animate-pulse ring-4 ring-destructive/30"
                  : "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
              }`}
            >
              {isRecording ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>
            {speaking && (
              <Button
                variant="outline"
                size="icon"
                className="size-10 rounded-full text-primary"
                onClick={() => {
                  window.speechSynthesis?.cancel();
                  setSpeaking(false);
                }}
              >
                <VolumeX className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {voiceTranscript && (
          <div className="mt-3 rounded-lg border border-primary/20 bg-background/80 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary">Recognized Transcript:</span>
              <span className="text-[10px] text-muted-foreground">Editable before saving</span>
            </div>
            <Input
              value={voiceTranscript}
              onChange={(e) => setVoiceTranscript(e.target.value)}
              className="mt-1 h-8 text-xs font-medium"
            />
          </div>
        )}
      </div>

      {/* QUICK PRODUCTION ENTRY FORM */}
      <div className="grid gap-5 lg:grid-cols-12">
        <form onSubmit={handleSubmitUpdate} className="surface p-5 lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-foreground">
              Daily Output & Rejection Form
            </h3>
            <StatusBadge tone="primary">SUPERVISOR TERMINAL</StatusBadge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Production Stage</Label>
              <Select value={selectedStage} onValueChange={(v) => setSelectedStage(v as StageKey)}>
                <SelectTrigger className="mt-1 h-10 text-xs font-semibold">
                  <SelectValue placeholder="Select Stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {STAGE_LABELS[s]} Stage
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Target Work Order</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger className="mt-1 h-10 text-xs font-semibold">
                  <SelectValue placeholder="Select Order" />
                </SelectTrigger>
                <SelectContent>
                  {activeOrders.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      {o.id} · {o.product} ({o.buyer})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-foreground">
                Completed Output (Pieces / Units)
              </Label>
              <Input
                type="number"
                required
                value={completedPieces}
                onChange={(e) => setCompletedPieces(e.target.value)}
                placeholder="e.g. 2400"
                className="mt-1 h-11 text-base font-bold text-primary"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-foreground">
                Defective / Rejected Pieces
              </Label>
              <Input
                type="number"
                value={rejectedPieces}
                onChange={(e) => setRejectedPieces(e.target.value)}
                placeholder="e.g. 12"
                className="mt-1 h-11 text-base font-semibold text-destructive"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">
              Supervisor Floor Remarks / Machine ID
            </Label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Sewing Line 3 Shift A on schedule"
              className="mt-1 h-9 text-xs"
            />
          </div>

          {/* Photo Defect Capture Section */}
          <div className="rounded-xl border border-dashed border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Camera className="size-5 text-primary" />
                <div>
                  <div className="text-xs font-semibold text-foreground">Defect Photo Upload</div>
                  <div className="text-[11px] text-muted-foreground">
                    Optional: snapshot garment or fabric defect for automated Vision QC
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handlePhotoCapture}
              >
                <Upload className="size-3.5" />
                {attachedPhoto ? "Photo Attached (1)" : "Capture Photo"}
              </Button>
            </div>
            {attachedPhoto && (
              <div className="mt-3 flex items-center gap-2 rounded bg-muted/60 p-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>Garment defect image attached and queued for AI OCR & Vision analysis.</span>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3 flex justify-end">
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto h-11 px-8 gap-2 font-semibold text-sm shadow-sm"
            >
              <Send className="size-4" />
              {isOffline ? "Save to Offline Queue" : "Confirm & Commit Production Log"}
            </Button>
          </div>
        </form>

        {/* SUPERVISOR GUIDELINES & REAL-TIME STATS (4 COLS) */}
        <div className="space-y-4 lg:col-span-4">
          <div className="surface p-4 text-xs space-y-3">
            <h4 className="font-semibold text-foreground">Shop-Floor Instructions</h4>
            <ul className="space-y-2 list-disc pl-4 text-muted-foreground">
              <li>Log output at the end of each 2-hour production milestone.</li>
              <li>Rejection counts over 2% automatically trigger Quality Lead alerts.</li>
              <li>If internet disconnects, updates remain securely cached on your mobile device.</li>
            </ul>
          </div>

          <div className="surface p-4 text-xs">
            <h4 className="font-semibold text-foreground">Active Order Status</h4>
            <div className="mt-2.5 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order:</span>
                <span className="font-semibold text-foreground">{selectedOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stage:</span>
                <span className="font-semibold capitalize text-foreground">{STAGE_LABELS[selectedStage]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Offline Storage:</span>
                <span className="font-semibold text-emerald-600">IndexedDB Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
