import { useState } from "react";
import { CheckCircle2, Send, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FormRenderer({
  title,
  description,
  fields,
  submitLabel = "Submit",
}: {
  title: string;
  description?: string;
  fields: {
    id: string;
    label: string;
    type: "text" | "number" | "select" | "switch";
    defaultValue?: any;
    options?: string[];
  }[];
  submitLabel?: string;
}) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    fields.forEach((f) => {
      init[f.id] = f.defaultValue ?? (f.type === "switch" ? false : "");
    });
    return init;
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast.success("Form Submitted Successfully!", {
      description: `Dispatched parameters: ${Object.keys(formData).length} fields recorded.`,
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <h4 className="text-xs font-semibold text-foreground">{title}</h4>
        </div>
        {description && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>

      {submitted ? (
        <div className="py-6 text-center space-y-2">
          <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
          <p className="text-xs font-semibold text-foreground">Configuration Applied</p>
          <p className="text-[11px] text-muted-foreground">Parameters logged to system memory.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-xs">
          {fields.map((f) => (
            <div key={f.id} className="space-y-1">
              {f.type === "switch" ? (
                <div className="flex items-center justify-between rounded-lg border border-border/70 p-2.5">
                  <Label htmlFor={f.id} className="text-xs font-medium text-foreground cursor-pointer">
                    {f.label}
                  </Label>
                  <Switch
                    id={f.id}
                    checked={Boolean(formData[f.id])}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, [f.id]: checked }))
                    }
                  />
                </div>
              ) : f.type === "select" ? (
                <div>
                  <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
                  <Select
                    value={String(formData[f.id])}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, [f.id]: val }))}
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options?.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
                  <Input
                    type={f.type === "number" ? "number" : "text"}
                    value={formData[f.id] ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [f.id]: f.type === "number" ? Number(e.target.value) : e.target.value,
                      }))
                    }
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              )}
            </div>
          ))}

          <div className="pt-2 flex justify-end">
            <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs font-medium">
              <Send className="size-3.5" />
              {submitLabel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
