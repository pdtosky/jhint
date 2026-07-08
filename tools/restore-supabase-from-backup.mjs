import fs from "node:fs/promises";
import path from "node:path";
import {
  extractPayloadFromBackup,
  fetchCurrentStateRow,
  normalizeStatePayload,
  readAppConfig,
  saveBackupFile,
  summarizePayload,
  writeStatePayload
} from "./supabase-state-utils.mjs";

function getArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function addRestoreLog(payload, backupPath) {
  const restored = normalizeStatePayload(payload);
  const logId = `restore-2026-06-15-${new Date().toISOString()}`;
  restored.activities = [
    {
      id: logId,
      type: "systemRestore",
      actor: "Codex",
      workerName: "Codex",
      target: "Restore from 2026-06-15 backup",
      timestamp: new Date().toISOString(),
      message: `Supabase data was restored from the 2026-06-15 local backup. / File ${path.basename(backupPath)}`
    },
    ...restored.activities
  ];
  return restored;
}

const backupPath = getArg("backup");
const confirmed = process.argv.includes("--yes");

if (!backupPath) {
  throw new Error("Usage: node tools/restore-supabase-from-backup.mjs --backup=backup-file-path --yes");
}

if (!confirmed) {
  throw new Error("Restore overwrites the database. Add --yes to continue.");
}

const config = await readAppConfig();
const currentRow = await fetchCurrentStateRow(config);
const beforeBackup = await saveBackupFile("before-restore", currentRow || { payload: {} }, {
  source: "tools/restore-supabase-from-backup.mjs"
});

const backupText = (await fs.readFile(backupPath, "utf8")).replace(/^\uFEFF/, "");
const rawBackup = JSON.parse(backupText);
const currentPayload = currentRow?.payload || {};
const backupPayload = extractPayloadFromBackup(rawBackup);
const normalizedBackup = normalizeStatePayload(backupPayload, currentPayload);
const restorePayload = addRestoreLog(normalizedBackup, backupPath);
const restoredRow = await writeStatePayload(config, restorePayload);
const verifyRow = await fetchCurrentStateRow(config);

console.log(JSON.stringify({
  ok: true,
  beforeRestoreBackupFile: beforeBackup.filePath,
  backupSource: backupPath,
  sourceCounts: summarizePayload(backupPayload),
  restoredCounts: summarizePayload(restoredRow?.payload || restorePayload),
  verifiedCounts: summarizePayload(verifyRow?.payload || {}),
  restoredAt: new Date().toISOString()
}, null, 2));
