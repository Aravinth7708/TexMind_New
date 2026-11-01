import { useState } from "react";
import { Copy, Check, Calculator, Sigma } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MathRenderer({
  expression,
  displayMode = "block",
  explanation,
}: {
  expression: string;
  displayMode?: "inline" | "block";
  explanation?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(expression);
    setCopied(true);
    toast.success("LaTeX expression copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (displayMode === "inline") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-mono text-xs text-foreground">
        <Sigma className="size-3 text-primary" />
        {expression}
      </span>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Mathematical Formulation</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-3.5 mr-1 text-emerald-500" /> : <Copy className="size-3.5 mr-1" />}
          {copied ? "Copied" : "Copy LaTeX"}
        </Button>
      </div>

      <div className="my-4 flex items-center justify-center rounded-lg bg-muted/30 p-6">
        <div className="font-serif text-lg tracking-wide text-foreground font-medium select-all">
          {expression}
        </div>
      </div>

      {explanation && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-2">
          <span className="font-semibold text-foreground">Explanation: </span>
          {explanation}
        </p>
      )}
    </div>
  );
}
