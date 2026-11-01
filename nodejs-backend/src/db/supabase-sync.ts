import db from "./client";

const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const snapshotRowId = "main";

function getRestUrl() {
  if (!projectUrl) return null;
  const base = projectUrl.replace(/\/rest\/v1$/i, "");
  return `${base}/rest/v1/texmind_portal_state`;
}

function getTables() {
  return (db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all() as Array<{ name: string }>).map((row) => row.name);
}

function readSnapshot() {
  const snapshot: Record<string, unknown[]> = {};
  for (const table of getTables()) {
    snapshot[table] = db.prepare(`SELECT * FROM "${table.replaceAll('"', '""')}"`).all() as unknown[];
  }
  return snapshot;
}

async function requestSnapshot(method: "GET" | "POST", data?: Record<string, unknown[]>) {
  if (!projectUrl || !serviceKey) return null;
  const restUrl = getRestUrl();
  if (!restUrl) return null;
  const url = new URL(restUrl);
  if (method === "GET") {
    url.searchParams.set("id", `eq.${snapshotRowId}`);
    url.searchParams.set("select", "data");
  } else {
    url.searchParams.set("on_conflict", "id");
  }

  const response = await fetch(url, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    ...(method === "POST" ? { body: JSON.stringify({ id: snapshotRowId, data }) } : {}),
  });
  if (!response.ok) {
    throw new Error(`Supabase snapshot request failed (${response.status}): ${await response.text()}`);
  }
  if (method === "POST") return null;
  const rows = (await response.json()) as Array<{ data?: Record<string, unknown[]> }>;
  return rows[0]?.data ?? null;
}

function restoreSnapshot(snapshot: Record<string, unknown[]>) {
  const tables = getTables();
  const columnsByTable = new Map(tables.map((table) => [
    table,
    new Set((db.prepare(`PRAGMA table_info("${table.replaceAll('"', '""')}")`).all() as Array<{ name: string }>).map((column) => column.name)),
  ]));

  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      for (const table of [...tables].reverse()) {
        db.prepare(`DELETE FROM "${table.replaceAll('"', '""')}"`).run();
      }
      for (const table of tables) {
        const records = snapshot[table] ?? [];
        for (const rawRecord of records) {
          if (!rawRecord || typeof rawRecord !== "object" || Array.isArray(rawRecord)) continue;
          const record = rawRecord as Record<string, unknown>;
          const entries = Object.entries(record).filter(([column]) => columnsByTable.get(table)?.has(column));
          if (entries.length === 0) continue;
          const names = entries.map(([column]) => `"${column.replaceAll('"', '""')}"`).join(", ");
          const placeholders = entries.map(() => "?").join(", ");
          db.prepare(`INSERT OR REPLACE INTO "${table.replaceAll('"', '""')}" (${names}) VALUES (${placeholders})`)
            .run(...entries.map(([, value]) => value));
        }
      }
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
  return true;
}

let saveQueue = Promise.resolve();

export async function initializeSupabaseSync() {
  if (!projectUrl || !serviceKey) {
    console.warn("Supabase sync is disabled. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in nodejs-backend/.env.");
    return;
  }
  const snapshot = await requestSnapshot("GET");
  if (snapshot && restoreSnapshot(snapshot)) {
    console.log("Restored TexMind data from Supabase.");
  } else if (!snapshot) {
    await requestSnapshot("POST", readSnapshot());
    console.log("Initialized the Supabase snapshot with current TexMind data.");
  }
}

export function queueSupabaseSnapshotSave() {
  if (!projectUrl || !serviceKey) return;
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(async () => {
      await requestSnapshot("POST", readSnapshot());
    })
    .catch((error) => console.error("Could not save TexMind data to Supabase:", error));
}
