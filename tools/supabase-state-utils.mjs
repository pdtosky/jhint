import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function getTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function getBackupDir(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return path.join(projectRoot, "backups", "supabase", yyyy, mm);
}

function readConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
  return match ? match[1] : "";
}

export async function readAppConfig() {
  const source = await fs.readFile(path.join(projectRoot, "config.js"), "utf8");
  const config = {
    supabaseUrl: readConfigValue(source, "supabaseUrl"),
    supabaseAnonKey: readConfigValue(source, "supabaseAnonKey"),
    supabaseTable: readConfigValue(source, "supabaseTable") || "app_state",
    supabaseRowId: readConfigValue(source, "supabaseRowId") || "main"
  };

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase URL or API key was not found in config.js.");
  }

  return config;
}

export function getSupabaseHeaders(config, extra = {}) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

export function getStateUrl(config, select = "*") {
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const rowId = encodeURIComponent(config.supabaseRowId || "main");
  return `${baseUrl}/rest/v1/${config.supabaseTable || "app_state"}?id=eq.${rowId}&select=${encodeURIComponent(select)}`;
}

export function getTableUrl(config) {
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  return `${baseUrl}/rest/v1/${config.supabaseTable || "app_state"}`;
}

export function normalizeStatePayload(payload = {}, fallback = {}) {
  return {
    orders: Array.isArray(payload.orders) ? payload.orders : [],
    requisitions: Array.isArray(payload.requisitions)
      ? payload.requisitions
      : Array.isArray(payload.purchaseRequests)
        ? payload.purchaseRequests
        : [],
    sops: Array.isArray(payload.sops)
      ? payload.sops
      : Array.isArray(payload.workStandards)
        ? payload.workStandards
        : Array.isArray(fallback.sops)
          ? fallback.sops
          : [],
    sopWorkRecords: Array.isArray(payload.sopWorkRecords)
      ? payload.sopWorkRecords
      : Array.isArray(payload.workRecords)
        ? payload.workRecords
        : Array.isArray(fallback.sopWorkRecords)
          ? fallback.sopWorkRecords
          : [],
    sopDeletedIds: Array.isArray(payload.sopDeletedIds)
      ? payload.sopDeletedIds
      : Array.isArray(fallback.sopDeletedIds)
        ? fallback.sopDeletedIds
        : [],
    activities: Array.isArray(payload.activities) ? payload.activities : []
  };
}

export function summarizePayload(payload = {}) {
  const normalized = normalizeStatePayload(payload);
  return {
    orders: normalized.orders.length,
    requisitions: normalized.requisitions.length,
    activities: normalized.activities.length,
    sops: normalized.sops.length,
    sopWorkRecords: normalized.sopWorkRecords.length
  };
}

export async function fetchCurrentStateRow(config) {
  const response = await fetch(getStateUrl(config), {
    headers: getSupabaseHeaders(config),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase state fetch failed: ${response.status} ${await response.text()}`);
  }

  const rows = await response.json();
  return rows[0] || null;
}

export async function writeStatePayload(config, payload) {
  const response = await fetch(getTableUrl(config), {
    method: "POST",
    headers: getSupabaseHeaders(config, {
      Prefer: "resolution=merge-duplicates,return=representation"
    }),
    body: JSON.stringify([
      {
        id: config.supabaseRowId || "main",
        payload,
        updated_at: new Date().toISOString()
      }
    ])
  });

  if (!response.ok) {
    throw new Error(`Supabase state save failed: ${response.status} ${await response.text()}`);
  }

  const rows = await response.json();
  return rows[0] || null;
}

export async function saveBackupFile(label, rowOrPayload, extra = {}) {
  const now = new Date();
  const backupDir = getBackupDir(now);
  await fs.mkdir(backupDir, { recursive: true });

  const payload = rowOrPayload?.payload ? rowOrPayload.payload : rowOrPayload;
  const backup = {
    exportedAt: now.toISOString(),
    exportedAtLocal: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    label,
    type: "jhint-supabase-local-backup",
    counts: summarizePayload(payload || {}),
    ...extra,
    row: rowOrPayload?.payload ? rowOrPayload : undefined,
    payload: payload || {}
  };

  const filePath = path.join(backupDir, `jhint-supabase-${label}-${getTimestampForFile(now)}.json`);
  await fs.writeFile(filePath, JSON.stringify(backup, null, 2), "utf8");
  return { filePath, backup };
}

export function extractPayloadFromBackup(raw) {
  if (raw?.payload?.payload) return raw.payload.payload;
  if (raw?.payload && typeof raw.payload === "object") return raw.payload;
  if (raw?.row?.payload) return raw.row.payload;
  return raw || {};
}

export async function removeOldBackups(retentionDays = 90) {
  const root = path.join(projectRoot, "backups", "supabase");
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];

  async function walk(dir) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        return;
      }
      if (!entry.name.endsWith(".json")) return;
      const stat = await fs.stat(entryPath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(entryPath);
        removed.push(entryPath);
      }
    }));
  }

  await walk(root);
  return removed;
}
