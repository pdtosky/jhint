import assert from 'node:assert/strict';
import { checkServerHealth, validateHealth } from '../tools/check-server-health.mjs';

const time = Date.parse('2026-10-19T04:00:00Z');
const healthy = { ok: true, status: 'healthy', checkedAt: new Date(time).toISOString() };
assert.equal(validateHealth(healthy, time), true);
assert.equal(validateHealth({ ...healthy, checkedAt: new Date(time - 301000).toISOString() }, time), false);
assert.equal(validateHealth({ ...healthy, checkedAt: new Date(time + 61000).toISOString() }, time), false);
assert.equal(validateHealth({ ...healthy, ok: false }, time), false);
assert.equal(validateHealth({ ...healthy, status: 'degraded' }, time), false);

let calls = 0;
let waits = 0;
const logs = [];
assert.equal(await checkServerHealth({
  now: () => time,
  fetchImpl: async (url, options) => {
    assert.equal(url, 'https://jhint.vercel.app/api/server-health');
    assert.equal(options.redirect, 'error');
    assert(options.signal);
    calls++;
    return calls === 1
      ? { ok: false, status: 503, text: async () => JSON.stringify({ sensitive: 'do-not-log' }) }
      : { ok: true, status: 200, text: async () => JSON.stringify(healthy) };
  },
  wait: async ms => { assert.equal(ms, 65000); waits++; },
  log: value => logs.push(value)
}), true);
assert.equal(calls, 2);
assert.equal(waits, 1);
assert.equal(logs.some(line => line.includes('do-not-log')), false);

const sanitized = [];
assert.equal(await checkServerHealth({
  now: () => time, attempts: 1,
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ ...healthy, checkedAt: 'Mon, 19 Oct 2026 04:00:00 GMT (do-not-log)' }) }),
  log: value => sanitized.push(value)
}), true);
assert.equal(sanitized.some(line => line.includes('do-not-log')), false);
assert.equal(JSON.parse(sanitized[0]).checkedAt, healthy.checkedAt);

assert.equal(await checkServerHealth({
  now: () => time, attempts: 1,
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ ok: false, status: 'unavailable', checkedAt: healthy.checkedAt }) }),
  log() {}
}), false, 'a cacheable HTTP 200 must never hide a failed health result');

calls = 0;
assert.equal(await checkServerHealth({
  now: () => time, attempts: 10,
  fetchImpl: async () => { calls++; throw new Error('do-not-log'); },
  wait: async () => {}, log: value => logs.push(value)
}), false);
assert.equal(calls, 2);
assert.equal(logs.some(line => line.includes('do-not-log')), false);
console.log('cloud monitor: fresh health, stale and invalid replies, recovery, retry cap and log privacy passed');
