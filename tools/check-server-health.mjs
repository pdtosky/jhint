import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const HEALTH_URL = 'https://jhint.vercel.app/api/server-health';

export function validateHealth(payload, now = Date.now()) {
  if (!payload || payload.ok !== true || payload.status !== 'healthy') return false;
  const checkedAt = Date.parse(payload.checkedAt);
  return Number.isFinite(checkedAt) && checkedAt <= now + 60000 && now - checkedAt <= 300000;
}

export async function checkServerHealth({ fetchImpl = fetch, now = Date.now, attempts = 2, wait = delay, log = console.log } = {}) {
  const count = Math.max(1, Math.min(2, attempts));
  for (let attempt = 1; attempt <= count; attempt++) {
    try {
      const response = await fetchImpl(HEALTH_URL, {
        signal: AbortSignal.timeout(12000),
        headers: { Accept: 'application/json' },
        redirect: 'error'
      });
      // Do not print arbitrary responses into the public workflow log.
      const raw = await response.text();
      const payload = raw.length <= 8192 ? JSON.parse(raw) : null;
      if (response.ok && validateHealth(payload, now())) {
        log(JSON.stringify({ event: 'server_monitor', status: 'healthy', checkedAt: new Date(Date.parse(payload.checkedAt)).toISOString(), attempt }));
        return true;
      }
      log(JSON.stringify({ event: 'server_monitor', status: 'check_failed', httpStatus: response.status, attempt }));
    } catch {
      log(JSON.stringify({ event: 'server_monitor', status: 'unreachable_or_invalid', attempt }));
    }
    if (attempt < count) await wait(65000);
  }
  return false;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ok = await checkServerHealth({ attempts: process.argv.includes('--once') ? 1 : 2 });
  if (!ok) process.exitCode = 1;
}
