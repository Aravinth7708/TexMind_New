import { useEffect, useRef, useState } from "react";
import { Brain, Send, X, Maximize2, Minimize2, Trash2, Sparkles, CheckCircle2, Mic, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TexMindMark } from "@/components/brand/logo";
import { useSession } from "@/lib/session";
import { askAiAssistant, getRolePromptSuggestions, checkAiBackendHealth } from "@/lib/ai-client";
import { MarkdownResponse } from "@/components/kit/markdown-response";
import { voiceManager } from "@/lib/voice-manager";

type Msg = {
  id: string;
  role: "user" | "ai";
  text: string;
  sources?: string[] | undefined;
};

export function AiAssistant({
  open,
  onOpenChange,
  onOpenVoiceOrb,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenVoiceOrb?: () => void;
}) {
  const session = useSession();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [autoSpeechEnabled, setAutoSpeechEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to voiceManager speaking state
  useEffect(() => {
    const unsub = voiceManager.subscribe((state) => {
      setIsSpeaking(state.isSpeaking);
    });
    return unsub;
  }, []);

  // Initialize welcome message based on role
  useEffect(() => {
    if (messages.length === 0) {
      let welcome = "Good day. I am your TexMind AI Factory Assistant powered by local Gemma 4 31B & Qdrant RAG. How can I assist you with factory operations today?";
      if (session?.role === "buyer") {
        welcome = `Welcome, ${session.name}. I am your AI Order Tracking Assistant. Ask me about your purchase orders, production stages, or delivery schedules.`;
      } else if (session?.role === "process") {
        welcome = `Greetings. Ready to monitor the ${session.stage.toUpperCase()} stage. Ask about active lots, throughput rates, delays, or reject metrics.`;
      }
      setMessages([{ id: "welcome-1", role: "ai", text: welcome }]);
    }
  }, [session]);

  // Check health periodically when open
  useEffect(() => {
    if (open) {
      checkAiBackendHealth().then(setBackendOnline);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const suggestions = getRolePromptSuggestions(session);

  async function handleSend(text: string) {
    const q = text.trim();
    if (!q || typing) return;

    // Cancel existing speech if user sends new prompt
    voiceManager.cancel();

    const userMsgId = `user-${Date.now()}`;
    const aiMsgId = `ai-${Date.now() + 1}`;

    const newMessages = [...messages, { id: userMsgId, role: "user" as const, text: q }];
    setMessages(newMessages);
    setInput("");
    setTyping(true);

    // Placeholder for AI streaming
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: "ai", text: "" },
    ]);

    const chatHistory: Array<{ role: "user" | "assistant" | "system"; content: string }> =
      newMessages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

    let spokenSentencesCount = 0;
    let streamAccumulated = "";

    try {
      const result = await askAiAssistant({
        messages: chatHistory,
        session,
        onChunk: (chunk) => {
          streamAccumulated += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, text: m.text + chunk } : m))
          );

          // Sentence-by-sentence streaming TTS
          if (autoSpeechEnabled) {
            const sentences = voiceManager.splitIntoSentences(streamAccumulated);
            if (sentences.length > spokenSentencesCount + 1) {
              const sentenceToSpeak = sentences[spokenSentencesCount];
              if (sentenceToSpeak) {
                voiceManager.speakSentence(sentenceToSpeak, "en-IN");
                spokenSentencesCount++;
              }
            }
          }
        },
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, text: result.text || m.text, sources: result.sources }
            : m
        )
      );

      // Speak remaining sentences if auto speech enabled
      if (autoSpeechEnabled) {
        const finalSentences = voiceManager.splitIntoSentences(result.text || streamAccumulated);
        while (spokenSentencesCount < finalSentences.length) {
          const next = finalSentences[spokenSentencesCount];
          if (next) {
            voiceManager.speakSentence(next, "en-IN");
          }
          spokenSentencesCount++;
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, text: "Apologies, an error occurred while connecting to the local AI engine." }
            : m
        )
      );
    } finally {
      setTyping(false);
    }
  }

  function handleClear() {
    voiceManager.cancel();
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "ai",
        text: "Conversation cleared. How can I assist you with factory operations?",
      },
    ]);
  }

  function toggleSpeechSynthesis() {
    if (autoSpeechEnabled) {
      voiceManager.cancel();
      setAutoSpeechEnabled(false);
    } else {
      setAutoSpeechEnabled(true);
      // Speak last AI message if present
      const lastAi = [...messages].reverse().find((m) => m.role === "ai");
      if (lastAi && lastAi.text) {
        const sentences = voiceManager.splitIntoSentences(lastAi.text);
        sentences.slice(0, 3).forEach((s) => voiceManager.speakSentence(s, "en-IN"));
      }
    }
  }

  return (
    <>
      {!open && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
          {onOpenVoiceOrb && (
            <button
              onClick={onOpenVoiceOrb}
              className="flex size-13 items-center justify-center rounded-full bg-linear-to-tr from-purple-600 to-indigo-600 text-white shadow-xl ring-4 ring-primary/20 transition-all duration-300 hover:scale-110 active:scale-95 animate-pulse"
              style={{ width: 52, height: 52 }}
              title="Open ChatGPT-Style Voice Mode"
              aria-label="Open Live Voice Mode"
            >
              <Mic className="size-6 text-white" />
            </button>
          )}

          <button
            onClick={() => onOpenChange(true)}
            className="flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ width: 52, height: 52 }}
            title="Open TexMind AI Assistant Chat"
            aria-label="Open TexMind AI Assistant"
          >
            <Brain className="size-6 animate-pulse" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "surface fixed z-50 flex flex-col overflow-hidden transition-all duration-300 shadow-2xl border border-border/80 backdrop-blur-md",
          isExpanded
            ? "bottom-4 right-4 w-[min(900px,calc(100vw-2rem))] h-[min(780px,calc(100vh-2rem))]"
            : "bottom-4 right-4 w-[min(460px,calc(100vw-2rem))] h-[min(650px,calc(100vh-2rem))]",
          open
            ? "pointer-events-auto translate-y-0 opacity-100 scale-100"
            : "pointer-events-none translate-y-6 opacity-0 scale-95"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-border bg-card/90 px-4 py-3">
          <TexMindMark className="size-8" />
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[13.5px] font-semibold text-foreground">TexMind RAG AI</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] font-medium bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="size-2.5" />
                Gemma 4 31B
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>Role: <strong className="capitalize text-foreground font-medium">{session?.role || "Admin"}</strong></span>
              <span>&bull;</span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    backendOnline ? "bg-emerald-500" : "bg-amber-500"
                  )}
                />
                {backendOnline ? "Qdrant RAG Online" : "Connecting..."}
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            {/* Launch Voice Orb directly from assistant header */}
            {onOpenVoiceOrb && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  onOpenVoiceOrb();
                }}
                className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                title="Switch to ChatGPT-Style Fullscreen Voice Mode"
                aria-label="Switch to Voice Mode"
              >
                <Mic className="size-4" />
              </button>
            )}

            {/* Read Aloud Toggle */}
            <button
              onClick={toggleSpeechSynthesis}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                autoSpeechEnabled ? "text-primary bg-primary/10" : "hover:text-foreground"
              )}
              title={autoSpeechEnabled ? "Turn Read-Aloud Off" : "Turn Read-Aloud On (Sentence-by-sentence TTS)"}
              aria-label="Toggle speech synthesis"
            >
              {autoSpeechEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4" />}
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:text-foreground rounded-md transition-colors"
              title={isExpanded ? "Collapse window" : "Expand to wide view for tables"}
              aria-label="Toggle window size"
            >
              {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button
              onClick={handleClear}
              className="p-1.5 hover:text-destructive rounded-md transition-colors"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              onClick={() => {
                voiceManager.cancel();
                onOpenChange(false);
              }}
              className="p-1.5 hover:text-foreground rounded-md transition-colors"
              aria-label="Close assistant"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 bg-muted/15">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}
            >
              {m.role === "ai" ? (
                <div className="w-full max-w-[96%] rounded-xl bg-card border border-border/70 p-3.5 shadow-xs">
                  <div className="mb-2 flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-primary">
                    <span className="flex items-center gap-1">
                      <Brain className="size-3" />
                      TexMind Assistant
                    </span>
                    <div className="flex items-center gap-2">
                      {isSpeaking && (
                        <span className="text-[10px] lowercase text-emerald-500 font-normal flex items-center gap-1 animate-pulse">
                          <Volume2 className="size-3" /> speaking...
                        </span>
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <span className="text-[10px] lowercase font-normal text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-500" />
                          {m.sources.length} sources retrieved
                        </span>
                      )}
                    </div>
                  </div>
                  {m.text ? (
                    <MarkdownResponse content={m.text} />
                  ) : (
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground py-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
                      <span className="ml-1">Retrieving factory vectors &amp; analyzing...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-[85%] rounded-2xl rounded-br-xs bg-primary px-4 py-2.5 text-[13px] text-primary-foreground shadow-xs">
                  {m.text}
                </div>
              )}
            </div>
          ))}
          {typing && messages[messages.length - 1]?.text !== "" && (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground px-2">
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
              <span className="ml-1">Streaming from Gemma 4 31B...</span>
            </div>
          )}
        </div>

        {/* Suggestion Chips & Input */}
        <div className="border-t border-border bg-card px-3 py-3">
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                disabled={typing}
                className="shrink-0 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-2"
          >
            {onOpenVoiceOrb && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  onOpenChange(false);
                  onOpenVoiceOrb();
                }}
                className="size-10 shrink-0 text-primary border-primary/30 hover:bg-primary/10 rounded-lg"
                title="Tap for ChatGPT Voice Mode"
              >
                <Mic className="size-4" />
              </Button>
            )}

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                session?.role === "buyer"
                  ? "Ask about your orders, milestones, or delivery dates..."
                  : session?.role === "process"
                  ? `Ask about ${session.stage.toUpperCase()} orders, capacity, or reject rate...`
                  : "Ask about factory orders, bottlenecks, or safety stock..."
              }
              disabled={typing}
              className="h-10 text-[13px] focus-visible:ring-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={typing || !input.trim()}
              className="size-10 shrink-0 shadow-xs"
              aria-label="Send"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
