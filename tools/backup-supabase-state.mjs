import {
  fetchCurrentStateRow,
  readAppConfig,
  removeOldBackups,
  saveBackupFile
} from "./supabase-state-utils.mjs";

const retentionArg = process.argv.find((arg) => arg.startsWith("--retention-days="));
const retentionDays = retentionArg ? Number(retentionArg.split("=")[1]) : 90;

const config = await readAppConfig();
const row = await fetchCurrentStateRow(config);

if (!row?.payload) {
  throw new Error("Supabase app_state/main row is empty. Backup stopped.");
}

const result = await saveBackupFile("auto", row, {
  source: "tools/backup-supabase-state.mjs"
});
const removed = await removeOldBackups(Number.isFinite(retentionDays) ? retentionDays : 90);

console.log(JSON.stringify({
  ok: true,
  backupFile: result.filePath,
  counts: result.backup.counts,
  removedOldBackups: removed.length
}, null, 2));
