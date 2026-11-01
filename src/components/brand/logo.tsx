import { cn } from "@/lib/utils";

export function TexMindMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="11" fill="var(--color-primary)" />
      <path
        d="M8 27c5-1.5 6.5-9 12-9s7 7.5 12 6"
        stroke="var(--color-primary-foreground)"
        strokeOpacity="0.55"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 20c5-1.5 6.5-9 12-9s7 7.5 12 6"
        stroke="var(--color-primary-foreground)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="14" cy="15.4" r="2.4" fill="var(--color-teal)" />
      <circle cx="26" cy="24.6" r="2.4" fill="var(--color-teal)" />
      <rect x="18.6" y="30" width="2.6" height="4" rx="1.2" fill="var(--color-primary-foreground)" />
    </svg>
  );
}

export function TexMindLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <TexMindMark />
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold tracking-tight">TexMind</div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            AI Factory Intelligence
          </div>
        </div>
      )}
    </div>
  );
}
