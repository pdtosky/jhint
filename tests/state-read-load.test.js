const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const extract = (name) => {
  const at = source.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, name);
  return (source.slice(at - 6, at) === "async " ? "async " : "") + source.slice(at, source.indexOf("\n}", at) + 2);
};
const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const response = (row) => ({ ok: true, json: async () => row ? [row] : [] });

function setup() {
  let now = Date.parse("2026-10-19T12:00:00+09:00");
  let timerId = 0;
  const timers = new Map();
  const requests = [];
  const steps = [];
  const listeners = [];
  const server = { payload: { orders: [{ id: "synthetic", status: "ready" }] }, revision: 0 };
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const ctx = {
    AbortController, Date: FakeDate, console: { error() {} },
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    APP_CONFIG: { supabaseUrl: "https://synthetic.test", holidayDates: [] },
    BACKEND_MODE: "supabase", REQUIRE_GLOBAL_LOGIN: true,
    POLL_INTERVAL_MS: 60000, DASHBOARD_POLL_INTERVAL_MS: 120000, HOLIDAY_POLL_INTERVAL_MS: 300000,
    VISIBILITY_POLL_COOLDOWN_MS: 60000,
    currentAdminEmail: "first@example.test", currentAdminRole: "production",
    isPasswordRecoveryMode: false, isAppDataInitialized: true, appDataInitializationPromise: null,
    dashboard: false, applied: 0, renders: 0, normalizations: 0, state: null,
    revisionsDuringApply: [], safetyReads: [], alerts: 0, startupStates: [],
    navigator: { onLine: true },
    document: {
      visibilityState: "visible",
      getElementById() { return { classList: { contains: () => ctx.dashboard } }; },
      addEventListener(name, listener) { assert.equal(name, "visibilitychange"); listeners.push(listener); }
    },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { at: now + ms, ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    hasSupabaseConfig: () => true,
    isSupabaseBackend: () => true,
    getSupabaseHeaders: async () => ({ Authorization: "Bearer synthetic" }),
    fetch(url, options) {
      const request = { url, fields: new URL(url).searchParams.get("select"), signal: options.signal };
      assert.equal(options.cache, "no-store");
      assert.equal(options.method, undefined, "read-load tests must never write");
      requests.push(request);
      if (steps.length) return steps.shift()(request);
      return Promise.resolve(response(request.fields === "sync_revision"
        ? { sync_revision: server.revision }
        : { payload: server.payload, sync_revision: server.revision }));
    },
    normalizeAppState(value) { ctx.normalizations++; return value; },
    showAppAlert() { ctx.alerts++; },
    normalizeAccountRole: (role) => role,
    isAllowedAdminEmail: () => false,
    canAccessView: () => true,
    toDateKey: (date) => date.toISOString().slice(0, 10),
    resetAdminAccountListState() {}, switchSecurityAuthMode() {}, setSecurityAuthMessage() {},
    setStartupState(value) { ctx.startupStates.push(value); },
    renderSecurityLoginGate() {}, renderAdminSession() {}, renderSopPage() {},
    supabaseAuthClient: { auth: { signOut: async () => ({}) } }
  };
  vm.createContext(ctx);
  const names = [
    "getSupabaseStateUrl", "waitForServerRead", "fetchSupabaseStateRow", "normalizeStateRevision",
    "fetchSupabaseState", "fetchSupabaseStateRevision", "canReadRemoteState", "readRemoteStateForDisplay",
    "loadRemoteState", "syncStateFromRemote", "getHolidayDateSet", "isWeekendOrHoliday",
    "getCurrentPollIntervalMs", "stopStatePolling", "scheduleNextStatePoll", "runStatePoll", "startStatePolling",
    "setAdminSession", "createRemoteStateNotReadyError", "prepareSupabaseStateForSave", "handleAdminLogout",
    "initializeAppData"
  ];
  vm.runInContext(`
    ${source.slice(source.indexOf('let lastStateSnapshot ='), source.indexOf('let isAdminAuthListenerBound ='))}
    function applyIncomingState(value) {
      if (globalThis.applyError) throw new Error("synthetic apply failure");
      revisionsDuringApply.push(lastAppliedStateRevision);
      applied++; state = value; lastStateSnapshot = JSON.stringify(value);
    }
    function render() { renders++; }
    function parseLastStateSnapshot() { return lastStateSnapshot ? JSON.parse(lastStateSnapshot) : null; }
    function mergeStateByLocalChanges(previous, next, remote) { return { ...remote, ...next }; }
    function assertSafeStateToSave(next, remote) { safetyReads.push(remote); return next; }
    ${names.map(extract).join("\n")}
  `, ctx);
  const run = (code) => vm.runInContext(code, ctx);
  async function advance(ms) {
    const target = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.at;
      timers.delete(id);
      const result = timer.fn();
      if (result?.catch) result.catch((error) => { ctx.timerError = error; });
      await flush();
      if (ctx.timerError) throw ctx.timerError;
    }
    now = target;
    await flush();
  }
  return {
    ctx, server, requests, steps, timers, run, advance,
    visible() { listeners.forEach((listener) => listener()); },
    fields: () => requests.map((request) => request.fields),
    revision: () => run("lastAppliedStateRevision"),
    remainingRetry: () => run("statePollRetryAt - Date.now()"),
    pollTimers: () => [...timers.values()].filter((timer) => timer.ms !== 25000),
    listeners: () => listeners.length
  };
}

async function main() {
  let passed = 0;
  async function test(name, check) { await check(); passed++; console.log(`read-load: ${name}`); }

  await test("full and metadata URLs, bigint validation and configured intervals", async () => {
    const h = setup();
    assert.equal(new URL(h.run("getSupabaseStateUrl()")).searchParams.get("select"), "payload,sync_revision");
    assert.equal(new URL(h.run('getSupabaseStateUrl("sync_revision")')).searchParams.get("select"), "sync_revision");
    for (const [value, expected] of [[0, "0"], [42, "42"], ["0002", "2"], ["9223372036854775807", "9223372036854775807"]]) {
      h.ctx.value = value;
      assert.equal(h.run("normalizeStateRevision(value)"), expected);
    }
    for (const value of [undefined, null, "", " ", "-1", "1.2", "1e3", -1, 1.5, NaN, Infinity, false, {}, Number.MAX_SAFE_INTEGER + 1, "9223372036854775808"]) {
      h.ctx.value = value;
      assert.equal(h.run("normalizeStateRevision(value)"), null, String(value));
    }
    assert.equal(h.run("getCurrentPollIntervalMs()"), 60000);
    h.ctx.dashboard = true;
    assert.equal(h.run("getCurrentPollIntervalMs()"), 120000);
    assert.equal(h.run('getCurrentPollIntervalMs(new Date("2026-10-18T12:00:00+09:00"))'), 300000);
    h.ctx.APP_CONFIG.holidayDates = ["2026-10-19"];
    assert.equal(h.run("getCurrentPollIntervalMs()"), 300000);
    const config = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, "config.js"), "utf8"), config);
    assert.equal(config.window.APP_CONFIG.pollIntervalMs, 60000);
    assert.equal(config.window.APP_CONFIG.dashboardPollIntervalMs, 120000);
    assert.equal(config.window.APP_CONFIG.holidayPollIntervalMs, 300000);
  });

  await test("first load is full; unchanged polls never load or normalize payload", async () => {
    const h = setup();
    assert.equal(await h.run("loadRemoteState()"), true);
    assert.deepEqual(h.fields(), ["payload,sync_revision"]);
    assert.equal(h.revision(), "0");
    assert.deepEqual(h.ctx.revisionsDuringApply, [null], "revision is assigned after apply");
    const normalizations = h.ctx.normalizations;
    for (let i = 0; i < 3; i++) assert.equal(await h.run("syncStateFromRemote()"), true);
    assert.deepEqual(h.fields().slice(1), ["sync_revision", "sync_revision", "sync_revision"]);
    assert.equal(h.ctx.applied, 1);
    assert.equal(h.ctx.renders, 0);
    assert.equal(h.ctx.normalizations, normalizations);
  });

  await test("changed revisions apply the full response's atomic version, not metadata's", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    h.steps.push(async () => response({ sync_revision: 1 }));
    h.steps.push(async () => response({ payload: { orders: [{ id: "newer" }] }, sync_revision: 2 }));
    assert.equal(await h.run("syncStateFromRemote()"), true);
    assert.deepEqual(h.fields(), ["payload,sync_revision", "sync_revision", "payload,sync_revision"]);
    assert.equal(h.revision(), "2");
    assert.equal(h.ctx.state.orders[0].id, "newer");
    assert.equal(h.ctx.revisionsDuringApply[1], "0");
    assert.equal(h.ctx.renders, 1);
  });

  await test("identical snapshots still advance the applied revision without rendering", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    h.server.revision = 1;
    assert.equal(await h.run("syncStateFromRemote()"), true);
    assert.equal(h.revision(), "1");
    assert.equal(h.ctx.applied, 1);
    assert.equal(h.ctx.renders, 0);
    await h.run("syncStateFromRemote()");
    assert.deepEqual(h.fields().slice(1), ["sync_revision", "payload,sync_revision", "sync_revision"]);
  });

  await test("invalid metadata falls back to full; missing full revisions never enable shortcuts", async () => {
    for (const revision of [undefined, null, "invalid", -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const h = setup();
      await h.run("loadRemoteState()");
      h.steps.push(async () => response({ sync_revision: revision }));
      assert.equal(await h.run("syncStateFromRemote()"), true);
      assert.deepEqual(h.fields().slice(1), ["sync_revision", "payload,sync_revision"]);
    }
    const h = setup();
    h.server.revision = undefined;
    await h.run("loadRemoteState()");
    await h.run("syncStateFromRemote()");
    assert.equal(h.revision(), null);
    assert.deepEqual(h.fields(), ["payload,sync_revision", "payload,sync_revision"]);
    h.server.revision = 3;
    await h.run("syncStateFromRemote()");
    assert.equal(h.revision(), "3");
    await h.run("syncStateFromRemote()");
    assert.equal(h.fields().at(-1), "sync_revision");
  });

  await test("failed full fetches and failed applies never advance the version", async () => {
    for (const failure of ["http", "apply", "payload"]) {
      const h = setup();
      await h.run("loadRemoteState()");
      h.server.revision = 1;
      h.server.payload = { orders: [{ id: "changed" }] };
      if (failure === "http") {
        h.steps.push(async () => response({ sync_revision: 1 }), async () => ({ ok: false }));
      } else if (failure === "apply") h.ctx.applyError = true;
      else h.server.payload = { orders: "invalid" };
      assert.equal(await h.run("syncStateFromRemote()"), false);
      assert.equal(h.revision(), "0", failure);
      assert.equal(h.ctx.applied, 1);
      assert.equal(h.remainingRetry(), 60000);
    }
    const h = setup();
    h.steps.push(async () => response(null));
    assert.equal(await h.run("loadRemoteState()"), false);
    assert.equal(h.revision(), null);
    assert.equal(h.run("remoteStateLoadedSuccessfully"), false);
    await h.run("syncStateFromRemote()");
    assert.deepEqual(h.fields(), ["payload,sync_revision", "payload,sync_revision"]);
  });

  await test("pre-save safety always fetches latest full state and never marks it applied", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    h.server.payload = { orders: [{ id: "latest-for-save" }] };
    h.server.revision = 7;
    h.ctx.next = { orders: [{ id: "local" }] };
    await h.run("prepareSupabaseStateForSave(next)");
    await h.run("prepareSupabaseStateForSave(next)");
    assert.equal(h.revision(), "0");
    assert.equal(h.ctx.applied, 1);
    assert.equal(h.ctx.safetyReads.length, 2);
    assert.equal(h.ctx.safetyReads[0].orders[0].id, "latest-for-save");
    assert.deepEqual(h.fields(), ["payload,sync_revision", "payload,sync_revision", "payload,sync_revision"]);
    const payload = await h.run("fetchSupabaseState()");
    assert.equal(payload.orders[0].id, "latest-for-save");
    assert.equal(h.revision(), "0");
    const fresh = setup();
    await fresh.run("fetchSupabaseState({ withRevision: true })");
    assert.equal(fresh.revision(), null, "fetching an envelope alone must not trust a revision");
    await fresh.run("loadRemoteState()");
    assert.deepEqual(fresh.fields(), ["payload,sync_revision", "payload,sync_revision"]);
  });

  await test("timeouts back off 60/120/240/480/600 seconds and success resets", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    for (const delay of [60000, 120000, 240000, 480000, 600000, 600000]) {
      h.steps.push(() => new Promise(() => {}));
      const pending = h.run("syncStateFromRemote()");
      await flush();
      await h.advance(25000);
      assert.equal(await pending, false);
      assert.equal(h.requests.at(-1).signal.aborted, true);
      assert.equal(h.remainingRetry(), delay);
      const count = h.requests.length;
      await h.run("syncStateFromRemote({ force: true })");
      assert.equal(h.requests.length, count, "force must not bypass failure backoff");
      await h.advance(delay);
    }
    assert.equal(await h.run("syncStateFromRemote()"), true);
    assert.equal(h.run("statePollFailureCount"), 0);
    assert.equal(h.run("statePollRetryAt"), 0);
    h.run("startStatePolling()");
    assert.equal(h.pollTimers()[0].ms, 60000);
  });

  await test("healthy worker, dashboard and holiday polls use positive jitter bounded by ten percent", async () => {
    for (const [mode, interval] of [["worker", 60000], ["dashboard", 120000], ["holiday", 300000]]) {
      for (const random of [0, 0.5, 0.999999]) {
        const h = setup();
        h.ctx.dashboard = mode === "dashboard";
        if (mode === "holiday") h.ctx.APP_CONFIG.holidayDates = ["2026-10-19"];
        await h.run("loadRemoteState()");
        let randomCalls = 0;
        h.ctx.Math.random = () => { randomCalls++; return random; };
        h.run("startStatePolling(); startStatePolling()");
        const delay = h.pollTimers()[0].ms;
        assert.equal(delay, interval + Math.floor(interval * random * 0.1));
        assert(delay >= interval && delay <= interval * 1.1, mode);
        assert.equal(randomCalls, 1, "repeated starts must not reroll or postpone the timer");
        await h.advance(delay - 1);
        assert.equal(h.requests.length, 1, "positive jitter must not run an early request");
        await h.advance(1);
        assert.deepEqual(h.fields(), ["payload,sync_revision", "sync_revision"]);
        assert.equal(h.pollTimers().length, 1);
        assert.equal(h.pollTimers()[0].ms, delay, "every healthy cycle must apply jitter");
        assert.equal(randomCalls, 2);
      }
    }
  });

  await test("healthy jitter is not added to failure deadlines or their ten-minute cap", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    h.ctx.Math.random = () => 0.999999;
    h.run("statePollFailureCount = 5; statePollRetryAt = Date.now() + 600000; startStatePolling()");
    assert.equal(h.pollTimers()[0].ms, 600000);
    await h.advance(599999);
    h.visible();
    await h.run("syncStateFromRemote({ force: true })");
    assert.equal(h.requests.length, 1, "neither visibility nor force can bypass retryAt");
    await h.advance(1);
    assert.equal(h.requests.length, 2);
    assert.equal(h.run("statePollFailureCount"), 0);
    assert.equal(h.pollTimers()[0].ms, 65999, "successful recovery restores healthy jitter");
  });

  await test("failure jitter is bounded and visibility cannot bypass its deadline", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    h.run("startStatePolling()");
    h.ctx.Math.random = () => 0.5;
    h.steps.push(async () => ({ ok: false }));
    await h.advance(60000);
    assert.equal(h.remainingRetry(), 66000);
    await h.advance(60000);
    h.visible();
    await flush();
    assert.equal(h.requests.length, 2);
    await h.advance(6000);
    assert.equal(h.requests.length, 3);
    assert.equal(h.run("statePollFailureCount"), 0);
    assert.equal(h.pollTimers().length, 1);
    assert.equal(h.pollTimers()[0].ms, 63000);
  });

  await test("hidden and offline tabs skip even forced polls without counting failures", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    h.run("startStatePolling()");
    h.ctx.document.visibilityState = "hidden";
    await h.run("syncStateFromRemote({ force: true })");
    await h.advance(120000);
    h.ctx.document.visibilityState = "visible";
    h.ctx.navigator.onLine = false;
    h.visible();
    await h.run("syncStateFromRemote()");
    await h.advance(120000);
    assert.equal(h.requests.length, 1);
    assert.equal(h.run("statePollFailureCount"), 0);
    h.ctx.navigator.onLine = true;
    h.visible();
    await flush();
    assert.equal(h.requests.length, 2);
  });

  await test("tabs becoming hidden or offline during metadata reads do not launch full fetches", async () => {
    for (const mode of ["hidden", "offline"]) {
      const h = setup();
      await h.run("loadRemoteState()");
      const blocked = deferred();
      h.steps.push(() => blocked.promise);
      const pending = h.run("syncStateFromRemote()");
      await flush();
      if (mode === "hidden") h.ctx.document.visibilityState = "hidden";
      else h.ctx.navigator.onLine = false;
      blocked.resolve(response({ sync_revision: 1 }));
      assert.equal(await pending, false);
      assert.deepEqual(h.fields(), ["payload,sync_revision", "sync_revision"]);
      assert.equal(h.revision(), "0");
      assert.equal(h.run("statePollFailureCount"), 0);
    }
  });

  await test("visibility has one cooldown shared with scheduled polling", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    h.run("startStatePolling(); startStatePolling(); startStatePolling()");
    assert.equal(h.pollTimers().length, 1);
    assert.equal(h.listeners(), 1);
    h.visible();
    h.visible();
    await flush();
    h.visible();
    await flush();
    assert.equal(h.requests.length, 1, "initial full load also starts the visibility cooldown");
    await h.advance(59999);
    h.visible();
    await flush();
    assert.equal(h.requests.length, 1);
    await h.advance(1);
    h.visible();
    await flush();
    assert.equal(h.requests.length, 2);
    assert.equal(h.pollTimers().length, 1);
  });

  await test("dashboard visibility refreshes use a single cooldown and replace the old timer", async () => {
    const h = setup();
    h.ctx.dashboard = true;
    await h.run("loadRemoteState()");
    h.run("startStatePolling()");
    await h.advance(60000);
    h.visible();
    h.visible();
    await flush();
    assert.equal(h.requests.length, 2);
    assert.equal(h.pollTimers().length, 1);
    await h.advance(59999);
    h.visible();
    await flush();
    assert.equal(h.requests.length, 2);
    await h.advance(1);
    h.visible();
    await flush();
    assert.equal(h.requests.length, 3);
    assert.equal(h.pollTimers().length, 1);
  });

  await test("pending polls serialize and repeated starts never create overlapping loops", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    const blocked = deferred();
    h.steps.push(() => blocked.promise);
    h.run("startStatePolling()");
    await h.advance(60000);
    assert.equal(h.requests.length, 2);
    h.run("startStatePolling(); startStatePolling()");
    h.visible();
    const joined = h.run("syncStateFromRemote()");
    await flush();
    assert.equal(h.requests.length, 2);
    assert.equal(h.pollTimers().length, 0);
    blocked.resolve(response({ sync_revision: 0 }));
    await joined;
    await flush();
    assert.equal(h.pollTimers().length, 1);
    await h.advance(60000);
    assert.equal(h.requests.length, 3);
    assert.equal(h.pollTimers().length, 1);
  });

  await test("full display loads serialize with each other and concurrent polling", async () => {
    const h = setup();
    const blocked = deferred();
    h.steps.push(() => blocked.promise);
    const first = h.run("loadRemoteState()");
    const second = h.run("loadRemoteState()");
    const poll = h.run("syncStateFromRemote()");
    await flush();
    assert.equal(h.requests.length, 1);
    blocked.resolve(response({ payload: h.server.payload, sync_revision: 0 }));
    assert.equal(await first, true);
    assert.equal(await second, true);
    assert.equal(await poll, true);
    assert.deepEqual(h.fields(), ["payload,sync_revision", "payload,sync_revision"]);
    assert.equal(h.ctx.applied, 2);
  });

  await test("concurrent poll failures all resolve safely without retrying or rejecting", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    const blocked = deferred();
    h.steps.push(() => blocked.promise);
    const first = h.run("syncStateFromRemote()");
    const second = h.run("syncStateFromRemote()");
    const third = h.run("syncStateFromRemote()");
    await flush();
    blocked.resolve({ ok: false });
    assert.deepEqual(await Promise.all([first, second, third]), [false, false, false]);
    assert.equal(h.requests.length, 2);
    assert.equal(h.run("statePollFailureCount"), 1);
    assert.equal(h.remainingRetry(), 60000);
  });

  await test("a cancelled timer callback cannot steal a restarted polling loop's timer", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    h.run("startStatePolling()");
    const stale = h.pollTimers()[0];
    h.run("stopStatePolling(); startStatePolling()");
    const current = h.run("syncTimerId");
    await stale.fn();
    assert.equal(h.run("syncTimerId"), current);
    assert.equal(h.pollTimers().length, 1);
    await h.advance(60000);
    assert.equal(h.requests.length, 2);
    assert.equal(h.pollTimers().length, 1);
  });

  await test("account changes cancel pending reads, invalidate versions and require a new full load", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    h.run("startStatePolling()");
    h.run('setAdminSession("first@example.test", "production", "Updated name")');
    assert.equal(h.revision(), "0", "same account updates must not restart polling");
    const blocked = deferred();
    h.steps.push(() => blocked.promise);
    await h.advance(60000);
    const oldSignal = h.requests.at(-1).signal;
    h.run('setAdminSession("second@example.test", "production")');
    await flush();
    assert.equal(oldSignal.aborted, true);
    assert.equal(h.revision(), null);
    assert.equal(h.run("remoteStateLoadedSuccessfully"), false);
    assert.equal(h.ctx.isAppDataInitialized, false);
    assert.equal(h.timers.size, 0);
    blocked.resolve(response({ sync_revision: 9 }));
    await flush();
    assert.equal(h.ctx.applied, 1);
    await h.run("loadRemoteState()");
    assert.equal(h.fields().at(-1), "payload,sync_revision");
    h.run("startStatePolling()");
    assert.equal(h.listeners(), 1);
    h.run('setAdminSession("")');
    h.visible();
    h.run("startStatePolling()");
    await h.run("syncStateFromRemote({ force: true })");
    await h.advance(600000);
    assert.equal(h.requests.length, 3);
    assert.equal(h.timers.size, 0);
    assert.equal(h.revision(), null);
  });

  await test("logout cancels stalled auth headers before they can start an unauthenticated fetch", async () => {
    const h = setup();
    const headers = deferred();
    h.ctx.getSupabaseHeaders = () => headers.promise;
    const pending = h.run("loadRemoteState()");
    h.run('setAdminSession("")');
    assert.equal(await pending, false);
    headers.resolve({});
    await flush();
    assert.equal(h.requests.length, 0);
    assert.equal(h.ctx.applied, 0);
    assert.equal(h.ctx.alerts, 0, "cancelled account reads must not show stale load errors");
    assert.equal(h.timers.size, 0);
  });

  await test("account switches during initial loading start a fresh serialized load without stale UI errors", async () => {
    const h = setup();
    h.ctx.isAppDataInitialized = false;
    const blocked = deferred();
    h.steps.push(() => blocked.promise);
    const oldInitialization = h.run("initializeAppData()");
    await flush();
    const oldSignal = h.requests[0].signal;
    h.run('setAdminSession("second@example.test", "production")');
    h.server.revision = 2;
    h.server.payload = { orders: [{ id: "new-account-load" }] };
    const newInitialization = h.run("initializeAppData()");
    assert.equal(await oldInitialization, false);
    assert.equal(await newInitialization, true);
    assert.equal(oldSignal.aborted, true);
    assert.deepEqual(h.fields(), ["payload,sync_revision", "payload,sync_revision"]);
    assert.equal(h.ctx.startupStates.includes("error"), false);
    assert.equal(h.ctx.startupStates.at(-1), "ready");
    assert.equal(h.ctx.state.orders[0].id, "new-account-load");
    assert.equal(h.revision(), "2");
    blocked.resolve(response({ payload: { orders: [{ id: "stale" }] }, sync_revision: 99 }));
    await flush();
    assert.equal(h.ctx.applied, 1);
    assert.equal(h.revision(), "2");
    assert.equal(h.pollTimers().length, 1);
  });

  await test("logout stops polling immediately, before sign-out finishes", async () => {
    const h = setup();
    await h.run("loadRemoteState()");
    const blocked = deferred();
    const signout = deferred();
    h.steps.push(() => blocked.promise);
    h.ctx.supabaseAuthClient.auth.signOut = () => signout.promise;
    h.run("startStatePolling()");
    await h.advance(60000);
    const pending = h.run("handleAdminLogout()");
    assert.equal(h.requests.at(-1).signal.aborted, true);
    assert.equal(h.run("isStatePolling"), false);
    signout.resolve({});
    await pending;
    blocked.resolve(response({ sync_revision: 5 }));
    await flush();
    await h.advance(600000);
    assert.equal(h.requests.length, 2);
    assert.equal(h.ctx.applied, 1);
    assert.equal(h.revision(), null);
    assert.equal(h.timers.size, 0);
  });

  console.log(`state read-load tests passed (${passed} scenarios; synthetic data only)`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
