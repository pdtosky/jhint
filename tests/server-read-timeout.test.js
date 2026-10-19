const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
const extract = (name) => {
  const at = source.indexOf(`function ${name}(`);
  return (source.slice(at - 6, at) === 'async ' ? 'async ' : '') + source.slice(at, source.indexOf('\n}', at) + 2);
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function setup(phase) {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const payload = { orders: [{ id: 'synthetic' }] };
  const response = { ok: true, json: () => phase === 'body' ? pending : Promise.resolve([{ payload }]) };
  const ctx = {
    AbortController, Promise, pending, payload, response, phase,
    fetchCalls: 0, applied: 0, cleared: 0, deadline: null,
    console: { error() {} },
    setTimeout(fn, ms) { assert.equal(ms, 25000); ctx.deadline = fn; return 7; },
    clearTimeout(id) { assert.equal(id, 7); ctx.cleared++; },
    hasSupabaseConfig: () => true,
    getSupabaseStateUrl: () => 'https://synthetic.test/state',
    getSupabaseHeaders: () => phase === 'headers' ? pending : Promise.resolve({}),
    fetch(url, options) {
      ctx.fetchCalls++;
      ctx.signal = options.signal;
      return phase === 'response' ? pending : Promise.resolve(response);
    },
    isSupabaseBackend: () => true,
    applyIncomingState() { ctx.applied++; },
    showAppAlert() {}
  };
  vm.createContext(ctx);
  vm.runInContext(`let remoteStateLoadedSuccessfully = false;
    ${extract('waitForServerRead')}
    ${extract('fetchSupabaseState')}
    ${extract('loadRemoteState')}
  `, ctx);
  return { ctx, release, response, payload };
}

(async () => {
  for (const phase of ['headers', 'response', 'body']) {
    const { ctx, release, response, payload } = setup(phase);
    vm.runInContext('globalThis.result = loadRemoteState();', ctx);
    await flush();
    ctx.deadline();
    assert.equal(await ctx.result, false, `${phase} stall must fail without applying data`);
    assert.equal(ctx.applied, 0);
    assert.equal(ctx.cleared, 1);
    if (ctx.signal) assert.equal(ctx.signal.aborted, true);
    release(phase === 'headers' ? {} : phase === 'response' ? response : [{ payload }]);
    await flush();
    assert.equal(ctx.applied, 0, 'late response must not change application data');
    if (phase === 'headers') assert.equal(ctx.fetchCalls, 0, 'late auth lookup must not start a request');
  }
  const { ctx } = setup('success');
  vm.runInContext('globalThis.result = loadRemoteState();', ctx);
  assert.equal(await ctx.result, true);
  assert.equal(ctx.applied, 1);
  assert.equal(ctx.signal.aborted, false);
  assert.equal(ctx.cleared, 1);
  console.log('server read deadlines: stalled auth headers, HTTP, body, late responses and success passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
