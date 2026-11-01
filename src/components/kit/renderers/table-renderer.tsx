import { useState, useMemo } from "react";
import { Download, Search, ArrowUpDown, ChevronLeft, ChevronRight, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TableRenderer({
  title,
  columns,
  rows,
  searchable = true,
  exportable = true,
}: {
  title?: string;
  columns: (string | { key: string; label: string })[];
  rows: (any[] | Record<string, any>)[];
  searchable?: boolean;
  exportable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<number | string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  // Normalize columns
  const normalizedCols = useMemo(() => {
    return columns.map((col, idx) => {
      if (typeof col === "string") return { key: String(idx), label: col };
      return col;
    });
  }, [columns]);

  // Normalize rows to arrays
  const normalizedRows = useMemo(() => {
    return rows.map((row) => {
      if (Array.isArray(row)) return row;
      return normalizedCols.map((col) => row[col.key] ?? "—");
    });
  }, [rows, normalizedCols]);

  // Filter
  const filteredRows = useMemo(() => {
    if (!query.trim()) return normalizedRows;
    const q = query.toLowerCase();
    return normalizedRows.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(q)),
    );
  }, [normalizedRows, query]);

  // Sort
  const sortedRows = useMemo(() => {
    if (sortCol === null) return filteredRows;
    const colIdx = typeof sortCol === "number" ? sortCol : normalizedCols.findIndex((c) => c.key === sortCol);
    if (colIdx < 0) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const valA = a[colIdx];
      const valB = b[colIdx];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRows, sortCol, sortAsc, normalizedCols]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (idx: number) => {
    if (sortCol === idx) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(idx);
      setSortAsc(true);
    }
  };

  const handleExportCSV = () => {
    const header = normalizedCols.map((c) => `"${c.label}"`).join(",");
    const body = normalizedRows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
    const csvContent = `${header}\n${body}`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title || "table-export"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV file exported successfully!");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {/* Header with Title, Search, and Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 p-3 text-xs">
        <div className="flex items-center gap-2">
          <TableIcon className="size-4 text-primary" />
          <span className="font-semibold text-foreground">
            {title || "Data Table"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            ({sortedRows.length} {sortedRows.length === 1 ? "row" : "rows"})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative w-44">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search rows..."
                className="h-7 pl-8 text-xs bg-background"
              />
            </div>
          )}
          {exportable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-7 gap-1 text-xs"
            >
              <Download className="size-3" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 uppercase tracking-wide text-muted-foreground text-[10.5px]">
            <tr>
              {normalizedCols.map((col, idx) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(idx)}
                  className="cursor-pointer select-none px-4 py-2.5 font-semibold hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.label}</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {pagedRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-4 py-2.5 text-foreground/90">
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={normalizedCols.length} className="p-6 text-center text-muted-foreground">
                  No records match your search filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground bg-muted/20">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
