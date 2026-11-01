import { useState } from "react";
import { CheckCircle2, Circle, ListOrdered, Check } from "lucide-react";

export function StepsRenderer({
  title,
  steps,
}: {
  title?: string;
  steps: {
    number: number;
    title: string;
    description: string;
    status?: "completed" | "current" | "pending";
  }[];
}) {
  const [completedMap, setCompletedMap] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    steps.forEach((s) => {
      if (s.status === "completed") init[s.number] = true;
    });
    return init;
  });

  const toggleStep = (num: number) => {
    setCompletedMap((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs">
      {title && (
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-2.5">
          <ListOrdered className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">{title}</span>
        </div>
      )}

      <div className="space-y-3">
        {steps.map((step) => {
          const isDone = completedMap[step.number];
          return (
            <div
              key={step.number}
              onClick={() => toggleStep(step.number)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-xs transition-colors cursor-pointer select-none ${
                isDone
                  ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground"
                  : "border-border bg-muted/20 hover:border-primary/40 text-foreground"
              }`}
            >
              <div
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isDone
                    ? "bg-emerald-600 text-white"
                    : "bg-primary/10 text-primary border border-primary/30"
                }`}
              >
                {isDone ? <Check className="size-3.5" /> : step.number}
              </div>

              <div className="space-y-0.5">
                <div
                  className={`font-semibold ${
                    isDone ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {step.title}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
