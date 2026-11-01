import { useEffect, useState } from "react";
import type { StageKey } from "@/lib/data";
import { API_BASE_URL } from "@/lib/order-costing";

export type Session =
  | { role: "admin"; email: string; name: string; title: string }
  | { role: "buyer"; email: string; name: string; title: string }
  | { role: "process"; email: string; name: string; title: string; stage: StageKey };

const KEY = "texmind-session";

export function saveSession(session: Session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("texmind-session-change"));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  void fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("texmind-session-change"));
}

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function homeFor(session: Session): string {
  if (session.role === "admin") return "/dashboard";
  if (session.role === "buyer") return "/buyer/dashboard";
  return `/production/${session.stage}`;
}

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    const sync = () => setSession(readSession());
    sync();
    window.addEventListener("texmind-session-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("texmind-session-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return session;
}
