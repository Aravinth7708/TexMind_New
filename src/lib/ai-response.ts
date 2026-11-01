export interface AiResponseBlockBase {
  type: string;
}

export interface MarkdownBlock extends AiResponseBlockBase {
  type: "markdown";
  content: string;
}

export interface TableBlock extends AiResponseBlockBase {
  type: "table";
  title?: string;
  columns: (string | { key: string; label: string })[];
  rows: (any[] | Record<string, any>)[];
  searchable?: boolean;
  exportable?: boolean;
}

export interface CodeBlock extends AiResponseBlockBase {
  type: "code";
  title?: string;
  language?: string;
  content: string;
  lineNumbers?: boolean;
}

export interface ChartBlock extends AiResponseBlockBase {
  type: "chart";
  title?: string;
  description?: string;
  chartType: "bar" | "line" | "area" | "pie";
  xKey: string;
  yKeys: string[];
  data: any[];
}

export interface JsonBlock extends AiResponseBlockBase {
  type: "json";
  title?: string;
  data: any;
}

export interface MathBlock extends AiResponseBlockBase {
  type: "math";
  expression: string;
  displayMode?: boolean;
  explanation?: string;
}

export interface DiagramBlock extends AiResponseBlockBase {
  type: "diagram";
  title?: string;
  chartType?: string;
  nodes: any[];
  edges?: any[];
}

export interface StepsBlock extends AiResponseBlockBase {
  type: "steps";
  title?: string;
  steps: Array<{ title: string; description: string; status?: "completed" | "in-progress" | "pending" }>;
}

export interface FileBlock extends AiResponseBlockBase {
  type: "file";
  name: string;
  size?: string;
  extension?: string;
  url?: string;
  description?: string;
}

export interface MediaBlock extends AiResponseBlockBase {
  type: "media";
  mediaType: "image" | "audio" | "video";
  url: string;
  caption?: string;
  transcript?: string;
}

export interface FormBlock extends AiResponseBlockBase {
  type: "form";
  title?: string;
  description?: string;
  fields: Array<{
    id?: string;
    name?: string;
    label: string;
    type: any;
    required?: boolean;
    defaultValue?: any;
    options?: string[];
  }>;
  submitLabel?: string;
}

export interface StatusBlock extends AiResponseBlockBase {
  type: "status";
  label: string;
  tone?: "danger" | "warning" | "success" | "neutral" | string;
}

export interface AiResponseBlock {
  type: string;
  title?: string;
  content?: string;
  description?: string;
  name?: string;
  size?: string;
  extension?: string;
  url?: string;
  mediaType?: "image" | "audio" | "video" | string;
  caption?: string;
  transcript?: string;
  fields?: Array<{
    id?: string;
    name?: string;
    label: string;
    type: any;
    required?: boolean;
    defaultValue?: any;
    options?: string[];
  }>;
  submitLabel?: string;
  tone?: "danger" | "warning" | "success" | "neutral" | string;
  label?: string;
  message?: string;
  items?: Array<{ label?: string; reference?: string; [k: string]: any }>;
  proposalId?: string;
  rationale?: string;
  expression?: string;
  displayMode?: boolean;
  explanation?: string;
  chartType?: any;
  xKey?: string;
  yKeys?: string[];
  data?: any;
  columns?: any;
  rows?: any;
  steps?: any;
  language?: string;
  lineNumbers?: boolean;
  searchable?: boolean;
  exportable?: boolean;
  nodes?: any[];
  edges?: any[];
  [key: string]: any;
}

export interface AiResponseEnvelope {
  version?: string;
  blocks: AiResponseBlock[];
  meta?: Record<string, any>;
  sources?: string[];
  [key: string]: any;
}

export function parseAiResponse(response: unknown): AiResponseEnvelope {
  if (!response) {
    return {
      blocks: [{ type: "markdown", content: "No response received." }],
    };
  }

  if (typeof response === "string") {
    try {
      const parsed = JSON.parse(response);
      return parseAiResponse(parsed);
    } catch {
      return {
        blocks: [{ type: "markdown", content: response }],
      };
    }
  }

  if (typeof response === "object") {
    const obj = response as any;
    if (Array.isArray(obj["blocks"])) {
      const env: AiResponseEnvelope = {
        blocks: obj["blocks"],
      };
      if (obj["meta"]) env.meta = obj["meta"];
      if (Array.isArray(obj["sources"])) env.sources = obj["sources"];
      return env;
    }
    if (typeof obj["text"] === "string") {
      const env: AiResponseEnvelope = {
        blocks: [{ type: "markdown", content: obj["text"] }],
      };
      if (Array.isArray(obj["sources"])) env.sources = obj["sources"];
      return env;
    }
    if (typeof obj["content"] === "string") {
      return {
        blocks: [{ type: "markdown", content: obj["content"] }],
      };
    }
  }

  return {
    blocks: [{ type: "markdown", content: String(response) }],
  };
}
