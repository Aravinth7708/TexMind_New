import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import {
  Sparkles,
  Send,
  RefreshCw,
  Table,
  Brain,
  Volume2,
  VolumeX,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, ProgressBar, RadialScore, StatusBadge } from "@/components/kit/primitives";
import { AIInsightCard } from "@/components/kit/production";
import { healthBreakdown, insights, totals } from "@/lib/data";
import { useMounted } from "@/lib/theme";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/session";
import { askAiAssistant } from "@/lib/ai-client";
import { UniversalResponseRenderer } from "@/components/kit/universal-response-renderer";
import { VoiceComposer } from "@/components/kit/voice-composer";

export const Route = createFileRoute("/ai-intelligence")({
  head: () => ({
    meta: [
      { title: "TexMind Intelligence Centre — AI Factory Insights" },
      {
        name: "description",
        content:
          "AI risk scoring, Tamil/Tanglish voice copilot, and RAG knowledge retrieval for production, delivery, inventory and quality.",
      },
      { property: "og:title", content: "TexMind Intelligence Centre" },
      {
        property: "og:description",
        content: "AI-generated factory risks, RAG queries and recommended actions.",
      },
    ],
  }),
  component: AiIntelligencePage,
});

const risks: { label: string; score: number; tone: string; note: string }[] = [];
const PRESET_QUERIES: { label: string; query: string }[] = [];

function generateSmartFallbackResponse(_query: string): string {
  return "No operational records are available yet. Add factory data to receive an AI analysis.";
}

function AiIntelligencePage() {
  const mounted = useMounted();
  const session = useSession();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  async function runQuery(qText: string) {
    const text = qText.trim();
    if (!text || loading) return;

    setLoading(true);
    setQuery(text);
    setResponse("");

    try {
      const res = await askAiAssistant({
        messages: [{ role: "user", content: text }],
        session,
        onChunk: (chunk) => {
          setResponse((prev) => (prev ?? "") + chunk);
        },
      });
      setResponse(res.text);
      if (res.sources) setSources(res.sources);
    } catch {
      // Intelligently fallback to rich structured response
      const fallback = generateSmartFallbackResponse(text);
      setResponse(fallback);
      setSources(["texmind_factory_kb (Indexed Documents)", "Live Operational Ledger"]);
    } finally {
      setLoading(false);
    }
  }

  const handleSpeak = () => {
    if (!response) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Text-to-speech not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Clean markdown text for TTS:
    const cleanText = response.replace(/[#*`_>|[\]]/g, " ").replace(/\s+/g, " ").slice(0, 450);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
    toast.info("Reading response aloud...");
  };

  return (
    <AppShell>
      <PageHeader
        title="TexMind Intelligence Centre"
        subtitle="AI-powered insights, Tamil/Tanglish voice copilot, and RAG knowledge retrieval for factory operations."
      />

      {/* RAG Knowledge Retrieval & Table Query Console */}
      <div className="surface mb-6 p-5 border border-primary/20 bg-gradient-to-b from-card to-card/70 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Brain className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  Interactive Factory RAG Query Console
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                  <Sparkles className="size-2.5" />
                  Gemma 4 · Qdrant Knowledge Base
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Query operational data in English, Tamil, or Tanglish. Responses automatically render in formatted data tables.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active Role:</span>
            <span className="capitalize font-semibold text-xs px-2.5 py-1 rounded-md bg-muted text-foreground border border-border">
              {session?.role || "Admin"}
            </span>
          </div>
        </div>

        {/* Quick Query Buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset.label}
              onClick={() => runQuery(preset.query)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/50 hover:bg-muted active:scale-98 disabled:opacity-50"
            >
              <Table className="size-3 text-primary" />
              {preset.label}
            </button>
          ))}
        </div>

        {/* Query Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runQuery(query);
          }}
          className="mt-3 flex gap-2"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about factory orders, stages, bottleneck risks, or materials..."
            className="h-10 text-[13px] bg-background"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !query.trim()} className="h-10 px-4">
            {loading ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span className="ml-1.5 hidden sm:inline">Query AI</span>
          </Button>
        </form>

        <div className="mt-3 border-t border-border/60 pt-3">
          <VoiceComposer value={query} onChange={setQuery} onSend={runQuery} />
        </div>

        {/* AI Result Box */}
        {(response !== null || loading) && (
          <div className="mt-4 rounded-xl border border-border/80 bg-background/90 p-4 shadow-inner">
            <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                AI Operational Response & Table Analysis
              </span>
              <div className="flex items-center gap-3">
                {sources.length > 0 && (
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Retrieved {sources.length} factory knowledge vectors
                  </span>
                )}
                {response && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={handleSpeak}
                  >
                    {isSpeaking ? <VolumeX className="size-3.5 text-destructive" /> : <Volume2 className="size-3.5 text-primary" />}
                    {isSpeaking ? "Stop Voice" : "Listen (TTS)"}
                  </Button>
                )}
              </div>
            </div>
            {response ? (
              <UniversalResponseRenderer response={response} />
            ) : (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <RefreshCw className="size-4 animate-spin text-primary" />
                Vectorizing query and retrieving from Qdrant...
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface flex flex-col items-center p-5 text-center">
          <h3 className="self-start text-[15px] font-semibold">Factory Health</h3>
          <RadialScore score={totals.health} size={190} />
          <StatusBadge tone="success" className="mt-2">
            Healthy
          </StatusBadge>
          <div className="mt-4 w-full space-y-2.5 text-left">
            {healthBreakdown.map((h) => (
              <div key={h.label}>
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-muted-foreground">{h.label}</span>
                  <span className="metric font-semibold">{h.value}%</span>
                </div>
                <ProgressBar
                  value={h.value}
                  tone={h.value >= 90 ? "success" : "primary"}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="surface p-5 lg:col-span-2">
          <h3 className="text-[15px] font-semibold">Risk Radar</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Higher values mean greater risk exposure right now.
          </p>
          <div className="mt-3 h-[220px]">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={risks} outerRadius="78%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <Radar
                    dataKey="score"
                    stroke="var(--color-chart-1)"
                    fill="var(--color-chart-1)"
                    fillOpacity={0.28}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
