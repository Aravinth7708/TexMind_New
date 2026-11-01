import { FileText, Download, FileSpreadsheet, FileArchive, FileCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function FileRenderer({
  name,
  size = "2.4 MB",
  extension = "pdf",
  description,
}: {
  name: string;
  size?: string;
  extension?: string;
  url?: string;
  description?: string;
}) {
  const ext = (extension || name.split(".").pop() || "pdf").toLowerCase();

  const getFileIcon = () => {
    if (["xlsx", "xls", "csv"].includes(ext)) {
      return <FileSpreadsheet className="size-6 text-emerald-600 dark:text-emerald-400" />;
    }
    if (["zip", "tar", "gz"].includes(ext)) {
      return <FileArchive className="size-6 text-amber-600 dark:text-amber-400" />;
    }
    if (["json", "ts", "js", "py"].includes(ext)) {
      return <FileCode className="size-6 text-blue-600 dark:text-blue-400" />;
    }
    return <FileText className="size-6 text-rose-600 dark:text-rose-400" />;
  };

  const handleDownload = () => {
    toast.success(`Downloading file: ${name}`, {
      description: `Verified document (${size}) transfer started.`,
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-muted/60">
          {getFileIcon()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-foreground">{name}</h4>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono uppercase text-muted-foreground">
              {ext}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{size}</span>
            {description && (
              <>
                <span>·</span>
                <span>{description}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={handleDownload}
        className="h-8 gap-1.5 text-xs font-medium"
      >
        <Download className="size-3.5 text-primary" />
        Download
      </Button>
    </div>
  );
}
