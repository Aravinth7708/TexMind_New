// @ts-nocheck
import { useState } from "react";
import { Braces, Copy, Check, ChevronRight, ChevronDown, Code2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function JsonNode({
  keyName,
  value,
  depth = 0,
}: {
  keyName?: string;
  value: any;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isObject = typeof value === "object" && value !== null;
  const isArray = Array.isArray(value);

  if (!isObject) {
    let valueColor = "text-amber-500 dark:text-amber-400"; // string
    if (typeof value === "number") valueColor = "text-blue-500 dark:text-blue-400";
    if (typeof value === "boolean") valueColor = "text-emerald-500 dark:text-emerald-400";
    if (value === null) valueColor = "text-rose-500";

    return (
      <div className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: `${depth * 16}px` }}>
        {keyName && <span className="text-neutral-400 font-mono">"{keyName}":</span>}
        <span className={`font-mono ${valueColor}`}>
          {typeof value === "string" ? `"${value}"` : String(value)}
        </span>
      </div>
    );
  }

  const keys = Object.keys(value);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  return (
    <div className="py-0.5" style={{ paddingLeft: `${depth * 16}px` }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 font-mono hover:text-primary transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="size-3 text-neutral-400" />
        ) : (
          <ChevronRight className="size-3 text-neutral-400" />
        )}
        {keyName && <span className="text-neutral-300">"{keyName}":</span>}
        <span className="text-neutral-400">
          {openBracket}
          {!expanded && ` ${keys.length} ${isArray ? "items" : "keys"} ${closeBracket}`}
        </span>
      </button>

      {expanded && (
        <div>
          {keys.map((k) => (
            <JsonNode
              key={k}
              keyName={isArray ? undefined : k}
              value={value[k]}
              depth={depth + 1}
            />
          ))}
          <div className="font-mono text-neutral-400" style={{ paddingLeft: `${depth * 16}px` }}>
            {closeBracket}
          </div>
        </div>
      )}
    </div>
  );
}

export function JsonRenderer({ title, data }: { title?: string; data: any }) {
  const [copied, setCopied] = useState(false);
  const [rawView, setRawView] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    void navigator.clipboard.writeText(jsonString);
    setCopied(true);
    toast.success("JSON copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-neutral-950 text-neutral-200 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Braces className="size-3.5 text-primary" />
          <span className="font-mono font-medium text-neutral-300">{title || "JSON Document"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px] text-neutral-400 hover:text-neutral-100"
            onClick={() => setRawView(!rawView)}
          >
            <Code2 className="size-3" />
            {rawView ? "Tree View" : "Raw Text"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px] text-neutral-400 hover:text-neutral-100"
            onClick={handleCopy}
          >
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-96 overflow-y-auto p-4 text-xs font-mono">
        {rawView ? (
          <pre className="whitespace-pre-wrap text-neutral-300">{jsonString}</pre>
        ) : (
          <JsonNode value={data} depth={0} />
        )}
      </div>
    </div>
  );
}
