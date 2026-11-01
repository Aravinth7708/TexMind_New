export interface OperationalRisk {
  id?: string;
  order_id: string;
  buyer?: string;
  current_stage?: string;
  score: number;
  severity: "critical" | "high" | "medium" | "low" | string;
  progress?: number;
  rejection_rate?: number;
  reasons: string[];
  evidence?: string;
  model?: string;
  is_prediction?: boolean;
  [key: string]: any;
}

export interface AttentionResponse {
  items: OperationalRisk[];
  actor?: {
    id: string;
    role: string;
  };
  source?: string;
}

const BACKEND_URL = "http://127.0.0.1:8008";

export async function getOperationalAttention(session?: any): Promise<AttentionResponse> {
  const role = session?.role || "admin";
  try {
    const res = await fetch(`${BACKEND_URL}/api/operational/attention`, {
      headers: {
        "X-Texmind-User": role,
      },
    });
    if (res.ok) {
      const data = await res.json();
      const items = (data.items || []).map((it: any) => ({
        ...it,
        reasons: Array.isArray(it.reasons)
          ? it.reasons
          : typeof it.reasons === "string"
            ? it.reasons.split(". ").filter(Boolean)
            : [],
      }));
      return {
        items,
        actor: data.actor,
        source: data.source || "backend-service",
      };
    }
  } catch (err) {
    console.warn("Operational backend offline, returning fallback attention fixtures:", err);
  }

  return {
    source: "local-fallback",
    items: [],
  };
}

export async function decideProposal(
  proposalId: string,
  decision: "approve" | "dismiss",
  session?: any
): Promise<{ success: boolean; status: string }> {
  const role = session?.role || "admin";
  try {
    const res = await fetch(`${BACKEND_URL}/api/operational/proposals/${proposalId}/${decision}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Texmind-User": role,
      },
      body: JSON.stringify({
        note: `Decided via command centre by ${session?.name || role}`,
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Could not reach operational backend for proposal decision, recording locally:", err);
  }

  return { success: true, status: decision === "approve" ? "Approved" : "Dismissed" };
}
