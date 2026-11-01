import { useState } from "react";
import { Check, Copy, Code, Terminal, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CodeRenderer({
  language = "typescript",
  content,
  title,
  lineNumbers = true,
}: {
  language?: string;
  content: string;
  title?: string;
  lineNumbers?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const lines = content.trim().split("\n");

  const handleCopy = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title || "code"}.${language === "python" ? "py" : language === "javascript" ? "js" : "ts"}`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Code snippet downloaded");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-neutral-950 text-neutral-100 shadow-sm">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-neutral-400" />
          <span className="font-semibold text-neutral-200">
            {title || `${language.toUpperCase()} Snippet`}
          </span>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase font-mono text-neutral-400">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 text-[11px]"
          >
            <Download className="size-3.5 mr-1" />
            Download
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 text-[11px]"
          >
            {copied ? (
              <>
                <Check className="size-3.5 mr-1 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 mr-1" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-neutral-900/60">
                {lineNumbers && (
                  <td className="w-10 select-none pr-4 text-right text-[11px] text-neutral-600">
                    {idx + 1}
                  </td>
                )}
                <td className="whitespace-pre text-neutral-200">{line || " "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
