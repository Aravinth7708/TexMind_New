import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownResponseProps {
  content: string;
  className?: string;
}

export function MarkdownResponse({ content, className }: MarkdownResponseProps) {
  return (
    <div className={cn("text-[13px] leading-relaxed break-words space-y-2.5", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border shadow-xs">
              <table className="w-full text-left text-[12px] border-collapse bg-card/60">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/70 text-muted-foreground font-semibold border-b border-border text-[11px] uppercase tracking-wider">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold border-r border-border/50 last:border-r-0 whitespace-nowrap">
              {children}
            </th>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/60">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/40 transition-colors">{children}</tr>
          ),
          td: ({ children }) => {
            const text = String(children);
            const isDelayed = text.includes("Delayed") || text.includes("High Risk");
            const isAtRisk = text.includes("At Risk");
            const isOnTrack = text.includes("On Track");
            const isCompleted = text.includes("Completed");

            return (
              <td className="px-3 py-2 border-r border-border/50 last:border-r-0 whitespace-nowrap">
                {isDelayed ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                    {children}
                  </span>
                ) : isAtRisk ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    {children}
                  </span>
                ) : isOnTrack ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    {children}
                  </span>
                ) : isCompleted ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {children}
                  </span>
                ) : (
                  children
                )}
              </td>
            );
          },
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-foreground mt-3 mb-1.5 border-b border-border pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[14px] font-semibold text-foreground mt-2.5 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13px] font-semibold text-foreground mt-2 mb-1">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-4 space-y-1 my-1.5 text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-4 space-y-1 my-1.5 text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-[12.5px]">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-2">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11.5px] font-mono text-primary">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
