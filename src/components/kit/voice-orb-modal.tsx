import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  RefreshCw,
  Radio,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { askAiAssistant } from "@/lib/ai-client";
import { voiceManager, VoiceLanguage } from "@/lib/voice-manager";

type SpeechRecognitionResultItem = {
  transcript: string;
  confidence: number;
};

type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionResultItem> & {
  isFinal?: boolean;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<SpeechRecognitionResultLike>;
  }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export interface VoiceOrbModalProps {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string | undefined;
}

export function VoiceOrbModal({ open, onClose, initialPrompt }: VoiceOrbModalProps) {
  const session = useSession();
  const [lang, setLang] = useState<VoiceLanguage>("en-IN");
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [aiText, setAiText] = useState("");
  const [volumeLevels, setVolumeLevels] = useState<number[]>([12, 24, 18, 32, 16, 28, 20]);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isListeningRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Audio Visualizer loop
  const startVisualizer = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // sample 7 bars
        const bars: number[] = [];
        const step = Math.floor(bufferLength / 7) || 1;
        for (let i = 0; i < 7; i++) {
          const val = dataArray[i * step] || 10;
          bars.push(Math.max(10, Math.min(60, Math.round(val / 3.5))));
        }
        setVolumeLevels(bars);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn("Could not start visualizer mic stream:", e);
    }
  }, []);

  const stopVisualizer = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Voice manager listener
  useEffect(() => {
    const unsub = voiceManager.subscribe((state) => {
      if (state.isSpeaking) {
        setStatus("speaking");
      } else if (status === "speaking") {
        // Once done speaking, immediately re-arm mic for continuous ChatGPT-like hands-free turn taking
        setStatus("idle");
        if (open && isListeningRef.current) {
          startListening();
        }
      }
    });
    return unsub;
  }, [open, status]);

  // Handle interrupting AI speaking
  const handleInterrupt = useCallback(() => {
    voiceManager.cancel();
    setStatus("idle");
    startListening();
  }, []);

  // Submit query to TexMind Gemma RAG backend and synthesize speech
  const processQuery = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      // Stop speech & recognition
      voiceManager.cancel();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      setStatus("thinking");
      setUserQuery(query);
      setLiveTranscript("");
      setAiText("");

      let spokenSentencesCount = 0;
      let buffer = "";

      try {
        const result = await askAiAssistant({
          messages: [{ role: "user", content: query }],
          session,
          onChunk: (chunk) => {
            setAiText((prev) => prev + chunk);
            buffer += chunk;

            // Stream TTS sentence-by-sentence in real time if audio is enabled
            if (audioEnabled) {
              const sentences = voiceManager.splitIntoSentences(buffer);
              if (sentences.length > spokenSentencesCount + 1) {
                // We have a full new sentence ready to speak
                const sentenceToSpeak = sentences[spokenSentencesCount];
                if (sentenceToSpeak) {
                  voiceManager.speakSentence(sentenceToSpeak, lang, () => {
                    // on sentence end
                  });
                  spokenSentencesCount++;
                }
              }
            }
          },
        });

        // Speak any remaining sentence at the end
        if (audioEnabled) {
          const finalSentences = voiceManager.splitIntoSentences(result.text || buffer);
          while (spokenSentencesCount < finalSentences.length) {
            const nextSentence = finalSentences[spokenSentencesCount];
            if (nextSentence) {
              voiceManager.speakSentence(nextSentence, lang, () => {
                // When final sentence finishes, continuous hands-free kicks back in via voiceManager.subscribe
              });
            }
            spokenSentencesCount++;
          }
        } else {
          setStatus("idle");
        }
      } catch (err) {
        console.error("AI Error:", err);
        setAiText("I encountered an issue retrieving operational data. Please verify the AI backend.");
        if (audioEnabled) {
          voiceManager.speakSentence("Sorry, I could not retrieve factory data at this moment.", lang);
        }
        setStatus("idle");
      }
    },
    [session, lang, audioEnabled]
  );

  // Start Speech Recognition
  const startListening = useCallback(() => {
    const Ctor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;

    if (!Ctor) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    // Cancel current speaking if user starts talking
    voiceManager.cancel();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item && item[0]) {
          const transcript = item[0].transcript;
          if (item.isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
      }
      setLiveTranscript(interim || final);

      if (final.trim()) {
        isListeningRef.current = false;
        processQuery(final.trim());
      }
    };

    recognition.onerror = (e) => {
      console.warn("Speech recognition error:", e);
      setStatus("idle");
      isListeningRef.current = false;
    };

    recognition.onend = () => {
      if (status === "listening") {
        setStatus("idle");
        isListeningRef.current = false;
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      isListeningRef.current = true;
      setStatus("listening");
    } catch (e) {
      console.warn("Recognition start failed:", e);
    }
  }, [lang, processQuery, status]);

  // Initial prompt or auto-listening on open
  useEffect(() => {
    if (open) {
      startVisualizer();
      if (initialPrompt) {
        processQuery(initialPrompt);
      } else {
        const timer = setTimeout(() => {
          startListening();
        }, 400);
        return () => clearTimeout(timer);
      }
    } else {
      stopVisualizer();
      voiceManager.cancel();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      setStatus("idle");
      setLiveTranscript("");
      setAiText("");
    }
    return () => {
      stopVisualizer();
      voiceManager.cancel();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [open, initialPrompt]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl transition-all duration-300">
      {/* Top action bar */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1 font-mono text-xs uppercase bg-background/50 border-primary/20 backdrop-blur">
            <Radio className={cn("size-3", status === "listening" ? "text-red-500 animate-pulse" : "text-primary")} />
            {status === "listening"
              ? "Listening..."
              : status === "thinking"
              ? "Analyzing factory data..."
              : status === "speaking"
              ? "Speaking (Tap to interrupt)"
              : "Ready"}
          </Badge>

          {/* Language selector */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-full border border-border">
            <Button
              size="sm"
              variant={lang === "en-IN" ? "default" : "ghost"}
              className="h-7 rounded-full px-2.5 text-xs font-semibold"
              onClick={() => {
                setLang("en-IN");
                if (status === "listening") startListening();
              }}
            >
              English (IN)
            </Button>
            <Button
              size="sm"
              variant={lang === "ta-IN" ? "default" : "ghost"}
              className="h-7 rounded-full px-2.5 text-xs font-semibold"
              onClick={() => {
                setLang("ta-IN");
                if (status === "listening") startListening();
              }}
            >
              Tamil (தமிழ்)
            </Button>
            <Button
              size="sm"
              variant={lang === "hi-IN" ? "default" : "ghost"}
              className="h-7 rounded-full px-2.5 text-xs font-semibold"
              onClick={() => {
                setLang("hi-IN");
                if (status === "listening") startListening();
              }}
            >
              Hindi
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full size-10 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (audioEnabled) voiceManager.cancel();
            }}
            title={audioEnabled ? "Mute Voice Response" : "Unmute Voice"}
          >
            {audioEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5 text-destructive" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="rounded-full size-10 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {/* Main Center Stage: Pulsing Glowing Voice Orb */}
      <div className="flex flex-col items-center justify-center max-w-2xl w-full px-6 text-center space-y-8">
        <div className="relative flex items-center justify-center">
          {/* Outer glowing pulsing rings */}
          <div
            className={cn(
              "absolute rounded-full transition-all duration-700 ease-out",
              status === "listening" && "size-64 bg-primary/20 blur-2xl animate-pulse scale-125",
              status === "speaking" && "size-72 bg-emerald-500/20 blur-3xl animate-pulse scale-150",
              status === "thinking" && "size-60 bg-amber-500/20 blur-2xl animate-spin duration-3000",
              status === "idle" && "size-48 bg-primary/10 blur-xl"
            )}
          />

          {/* Middle Orb */}
          <button
            onClick={() => {
              if (status === "speaking") {
                handleInterrupt();
              } else if (status === "listening") {
                if (recognitionRef.current) recognitionRef.current.stop();
                setStatus("idle");
              } else {
                startListening();
              }
            }}
            className={cn(
              "relative z-10 flex items-center justify-center size-36 sm:size-44 rounded-full shadow-2xl transition-all duration-500 cursor-pointer outline-none focus:ring-4 focus:ring-primary/40",
              status === "listening" &&
                "bg-gradient-to-tr from-primary via-indigo-500 to-purple-600 scale-105 shadow-primary/40",
              status === "speaking" &&
                "bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 scale-110 shadow-emerald-500/50",
              status === "thinking" &&
                "bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-500 animate-pulse shadow-amber-500/40",
              status === "idle" &&
                "bg-gradient-to-tr from-card via-muted to-card border border-primary/30 shadow-lg hover:scale-105"
            )}
          >
            {/* Visualizer audio bars when speaking or listening */}
            {(status === "listening" || status === "speaking") && (
              <div className="flex items-center gap-1.5 h-16">
                {volumeLevels.map((lvl, idx) => (
                  <span
                    key={idx}
                    className="w-1.5 rounded-full bg-white transition-all duration-100 ease-out"
                    style={{
                      height: `${lvl}px`,
                      opacity: status === "speaking" ? 0.95 : 0.85,
                    }}
                  />
                ))}
              </div>
            )}

            {status === "thinking" && (
              <RefreshCw className="size-10 text-white animate-spin" />
            )}

            {status === "idle" && (
              <Mic className="size-10 text-primary animate-bounce duration-1000" />
            )}
          </button>
        </div>

        {/* Dynamic status helper text */}
        <div className="space-y-2">
          {status === "listening" && (
            <p className="text-sm font-medium text-primary animate-pulse">
              Listening to you... Speak in English or Tamil
            </p>
          )}
          {status === "speaking" && (
            <p className="text-sm font-medium text-emerald-500 flex items-center justify-center gap-1.5">
              <Sparkles className="size-4 animate-spin" /> Speaking response aloud &middot; Tap orb anytime to interrupt
            </p>
          )}
          {status === "thinking" && (
            <p className="text-sm font-medium text-amber-500">
              Querying factory knowledge base &amp; calculating schedule impact...
            </p>
          )}
          {status === "idle" && (
            <p className="text-sm text-muted-foreground">
              Tap the orb to ask anything about production, delays, inventory, or line recovery.
            </p>
          )}
        </div>

        {/* Live spoken query transcription */}
        {(liveTranscript || userQuery) && (
          <div className="surface rounded-2xl p-4 max-w-xl w-full border border-border/80 shadow-md">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 text-left flex items-center gap-1">
              <Mic className="size-3 text-primary" /> You said
            </div>
            <p className="text-sm text-left text-foreground font-medium">
              {liveTranscript || userQuery}
            </p>
          </div>
        )}

        {/* AI response display (with live text streaming simultaneously with speech) */}
        {aiText && (
          <div className="surface rounded-2xl p-5 max-w-xl w-full border border-primary/20 shadow-xl max-h-56 overflow-y-auto text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="size-3" /> TexMind AI Intelligence
              </span>
              {status === "speaking" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 gap-1 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={handleInterrupt}
                >
                  <Square className="size-2.5 fill-destructive" /> Stop voice
                </Button>
              )}
            </div>
            <p className="text-[13.5px] leading-relaxed text-foreground whitespace-pre-wrap">
              {aiText}
            </p>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
          {[
            "Summarize current factory operations.",
            "Show orders that need attention.",
            "Summarize today's production output.",
            "Give me a factory briefing.",
          ].map((promptText) => (
            <Button
              key={promptText}
              variant="outline"
              size="sm"
              className="rounded-full text-xs bg-background/50 border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
              onClick={() => processQuery(promptText)}
            >
              {promptText}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
