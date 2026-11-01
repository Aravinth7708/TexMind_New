import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function VoiceComposer({
  value,
  onChange,
  onSend,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend?: (value: string) => void;
}) {
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const Ctor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
    return () => recognition.current?.stop();
  }, []);
  const toggle = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Ctor) return;
    const next = new Ctor();
    next.lang = "ta-IN";
    next.continuous = false;
    next.interimResults = false;
    next.onresult = (event) =>
      onChange(
        `${value}${value ? " " : ""}${Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")}`.trim(),
      );
    next.onend = () => setListening(false);
    next.onerror = () => setListening(false);
    recognition.current = next;
    setListening(true);
    next.start();
  };
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Speak or type in Tamil, Tanglish, or English. Review before sending."
        className="min-h-20"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={toggle} disabled={!supported}>
          {listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          {listening ? "Stop listening" : "Tamil voice draft"}
        </Button>
        {onSend && (
          <Button type="button" size="sm" disabled={!value.trim()} onClick={() => onSend(value)}>
            Use in AI chat
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">
          {supported
            ? "Speech stays an editable draft; it never updates factory data directly."
            : "Voice input is unavailable in this browser; type your request instead."}
        </span>
      </div>
    </div>
  );
}
