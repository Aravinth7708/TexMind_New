import { useState } from "react";
import { Play, Pause, Volume2, VolumeX, Image as ImageIcon, Download, FileAudio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MediaRenderer({
  mediaType,
  url,
  caption,
  transcript,
}: {
  mediaType: "image" | "audio" | "video";
  url: string;
  caption?: string;
  transcript?: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const toggleAudio = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      toast.info("Audio playback started", {
        description: transcript ? `Transcript: "${transcript.slice(0, 50)}..."` : undefined,
      });
    }
  };

  if (mediaType === "audio") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileAudio className="size-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                {caption || "Audio Message / Voice Note"}
              </h4>
              <span className="text-[10px] text-muted-foreground">Voice stream · 0:24</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleAudio}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {isPlaying ? "Pause" : "Play Audio"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMuted(!muted)}
              className="size-8 text-muted-foreground"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Simulated Waveform */}
        <div className="flex items-center gap-1 h-7 rounded bg-muted/30 px-3">
          {Array.from({ length: 32 }, (_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all ${
                isPlaying && i < 14 ? "bg-primary" : "bg-muted-foreground/30"
              }`}
              style={{ height: `${20 + Math.sin(i * 0.7) * 60}%` }}
            />
          ))}
        </div>

        {transcript && (
          <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Transcript:
            </span>
            <p className="mt-0.5 text-foreground/90 italic">“{transcript}”</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-900 flex items-center justify-center">
        <img
          src={url || "/placeholder.svg"}
          alt={caption || "Media preview"}
          className="h-full w-full object-cover"
        />
      </div>
      {caption && (
        <div className="p-3 text-xs text-muted-foreground border-t border-border flex items-center justify-between">
          <span>{caption}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toast.success("Media downloaded")}
            className="h-6 gap-1 px-2 text-[11px]"
          >
            <Download className="size-3" /> Save
          </Button>
        </div>
      )}
    </div>
  );
}
