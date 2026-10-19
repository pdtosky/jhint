const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServerHealthMonitor, evaluateMetrics } = require("../lib/server-health");
const handler = require("../api/server-health");
const { createServerHealthHandler } = handler._test;

const BASE = "https://synthetic.supabase.co";
const SECRET = "sb_secret_synthetic_do_not_log";
const METADATA_URL = `${BASE}/rest/v1/app_state?id=eq.main&select=sync_revision&limit=1`;
const METRICS_URL = `${BASE}/customer/v1/privileged/metrics`;
const MIB = 1024 * 1024;
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

function metrics(overrides = {}, extra = "") {
  const values = {
    node_memory_MemTotal_bytes: 1024 * MIB,
    node_memory_MemAvailable_bytes: 400 * MIB,
    node_memory_SwapTotal_bytes: 1024 * MIB,
    node_memory_SwapFree_bytes: 1024 * MIB,
    node_memory_CommitLimit_bytes: 2048 * MIB,
    node_memory_Committed_AS_bytes: 1024 * MIB,
    'pg_stat_activity_count{datname="postgres",state="idle"}': 10,
    'pg_stat_activity_count{datname="postgres",state="active"}': 10,
    pg_settings_max_connections: 100,
    node_load1: 1,
    'node_cpu_seconds_total{cpu="0",mode="idle"}': 10000000,
    'node_cpu_seconds_total{cpu="0",mode="user"}': 90000000,
    'node_cpu_seconds_total{cpu="1",mode="idle"}': 10000000,
    'node_cpu_seconds_total{cpu="1",mode="user"}': 90000000,
    'node_filesystem_size_bytes{device="/dev/root",fstype="ext4",mountpoint="/"}': 1000,
    'node_filesystem_avail_bytes{mountpoint="/",fstype="ext4",device="/dev/root"}': 500,
    ...overrides
  };
  return Object.entries(values).filter(([, value]) => value !== null).map(([name, value]) => `${name} ${value}`).join("\n") + "\n" + extra;
}

function setup(options = {}) {
  let time = Date.parse("2026-10-19T00:00:00Z");
  const timers = new Map();
  const logs = [];
  const calls = [];
  let timerId = 0;
  const dependencies = {
    getSupabaseUrl: () => BASE,
    getServiceRoleKey: () => SECRET,
    now: () => time,
    setTimeout(fn, delay) {
      assert.equal(delay, 10000, "one fixed 10s deadline");
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout(id) { timers.delete(id); },
    log: (event) => logs.push(event),
    fetch: async (url, init) => {
      calls.push({ url, init });
      return options.fetch ? options.fetch(url, init) : new Response(url === METADATA_URL ? '[{"sync_revision":7}]' : metrics());
    },
    ...options.dependencies
  };
  return {
    dependencies, logs, calls, timers,
    advance(ms) { time += ms; },
    expire() { time += 10000; for (const fn of timers.values()) fn(); }
  };
}

async function invoke(api, request = {}) {
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = body || ""; }
  };
  const input = Object.defineProperties({ method: "GET", headers: {}, url: "/api/server-health" }, Object.getOwnPropertyDescriptors(request));
  await api(input, response);
  return response;
}

function assertPublic(payload) {
  assert.deepEqual(Object.keys(payload).sort(), ["checkedAt", "ok", "signals", "status"]);
  assert.equal(typeof payload.ok, "boolean");
  assert(["healthy", "degraded", "unavailable"].includes(payload.status));
  assert.equal(payload.ok, payload.status === "healthy");
  assert.equal(new Date(payload.checkedAt).toISOString(), payload.checkedAt);
  assert.deepEqual(Object.keys(payload.signals).sort(), ["database", "metrics", "resources"]);
  assert(["ok", "slow", "unavailable"].includes(payload.signals.database));
  assert(["ok", "warning", "unknown"].includes(payload.signals.resources));
  assert(["ok", "unavailable"].includes(payload.signals.metrics));
}

test("healthy metrics use MemAvailable, not free RAM, cache, high commit alone, or CPU cumulative counters", () => {
  const result = evaluateMetrics(metrics({
    node_memory_Committed_AS_bytes: 4096 * MIB,
    node_memory_SwapFree_bytes: 500 * MIB
  }, "node_memory_MemFree_bytes 0\nnode_memory_Cached_bytes 900000000\n"));
  assert.equal(result.resources, "ok");
  assert.deepEqual(result.warnings, []);
  assert.equal(result.details.availableMemoryPercent, 39.06);
  assert.equal(result.details.committedPercent, 200);
  assert.equal(result.details.loadPerCore, 0.5);
  assert.equal(Object.hasOwn(result.details, "cpuPercent"), false);
});

test("memory warnings require conservative combined evidence and include exact boundaries", () => {
  const check = (available, swapUsed, committed) => evaluateMetrics(metrics({
    node_memory_MemTotal_bytes: 1000 * MIB,
    node_memory_MemAvailable_bytes: available * MIB,
    node_memory_SwapFree_bytes: (1024 - swapUsed) * MIB,
    node_memory_Committed_AS_bytes: committed * MIB,
    node_memory_CommitLimit_bytes: 1000 * MIB
  }));
  assert.equal(check(100, 255, 1249).resources, "ok");
  assert.equal(check(101, 256, 1249).resources, "ok");
  assert.deepEqual(check(100, 256, 1249).warnings, ["memory_pressure"]);
  assert.equal(check(151, 0, 1250).resources, "ok");
  assert.deepEqual(check(150, 0, 1250).warnings, ["commit_pressure"]);
  assert.deepEqual(check(100, 256, 1250).warnings, ["memory_pressure", "commit_pressure"]);
});

test("connection, disk and load warnings use >= boundaries and never divide by CPU modes", () => {
  const result = evaluateMetrics(metrics({
    'pg_stat_activity_count{datname="postgres",state="active"}': 75,
    node_load1: 4,
    'node_filesystem_avail_bytes{mountpoint="/",fstype="ext4",device="/dev/root"}': 100
  }));
  assert.equal(result.resources, "warning");
  assert.deepEqual(result.warnings, ["connection_pressure", "disk_pressure", "load_pressure"]);
  assert.equal(result.details.connectionsPercent, 85);
  assert.equal(result.details.diskUsedPercent, 90);
  assert.equal(result.details.loadPerCore, 2);
  assert.equal(evaluateMetrics(metrics({
    'pg_stat_activity_count{datname="postgres",state="active"}': 74,
    node_load1: 3.99,
    'node_filesystem_avail_bytes{mountpoint="/",fstype="ext4",device="/dev/root"}': 101
  })).resources, "ok");
});

test("only ext4/xfs root or data disks are assessed, with no filesystem labels in diagnostics", () => {
  const irrelevant = 'node_filesystem_size_bytes{fstype="tmpfs",mountpoint="/data"} 100\n' +
    'node_filesystem_avail_bytes{fstype="tmpfs",mountpoint="/data"} 0\n' +
    'node_filesystem_size_bytes{fstype="ext4",mountpoint="/tmp"} 100\n' +
    'node_filesystem_avail_bytes{fstype="ext4",mountpoint="/tmp"} 0';
  assert.equal(evaluateMetrics(metrics({}, irrelevant)).resources, "ok");
  const result = evaluateMetrics(metrics({}, irrelevant + '\nnode_filesystem_size_bytes{fstype="xfs",mountpoint="/var/lib/postgresql/data"} 100\n' +
    'node_filesystem_avail_bytes{fstype="xfs",mountpoint="/var/lib/postgresql/data"} 5'));
  assert.equal(result.resources, "warning");
  assert.equal(result.details.diskUsedPercent, 95);
  assert(!JSON.stringify(result).includes("/var/lib"));
  const partial = evaluateMetrics(metrics({
    'node_filesystem_size_bytes{device="/dev/root",fstype="ext4",mountpoint="/"}': null
  }, 'node_filesystem_size_bytes{fstype="xfs",mountpoint="/data"} 100\n' +
    'node_filesystem_avail_bytes{fstype="xfs",mountpoint="/data"} 50'));
  assert.equal(partial.resources, "unknown", "an unpaired root disk cannot be hidden by complete data disk metrics");
});

test("missing, invalid, ambiguous, or mismatched metrics remain unknown, never zero/healthy", () => {
  for (const name of ["node_memory_MemAvailable_bytes", "node_memory_MemTotal_bytes", "node_memory_SwapFree_bytes",
    "node_memory_SwapTotal_bytes", "node_memory_CommitLimit_bytes", "node_memory_Committed_AS_bytes",
    "pg_settings_max_connections", "node_load1",
    'node_filesystem_avail_bytes{mountpoint="/",fstype="ext4",device="/dev/root"}']) {
    assert.equal(evaluateMetrics(metrics({ [name]: null })).resources, "unknown", name);
  }
  for (const value of ["NaN", "+Inf", "-Inf", -1, "invalid", "1e999"]) {
    const result = evaluateMetrics(metrics({ node_memory_MemAvailable_bytes: value }));
    assert.equal(result.resources, "unknown");
    assert.equal(result.details.availableMemoryPercent, null);
  }
  assert.equal(evaluateMetrics(metrics({ node_memory_MemTotal_bytes: 0 })).resources, "unknown");
  assert.equal(evaluateMetrics(metrics({}, "node_memory_MemTotal_bytes 10")).resources, "unknown");
  assert.equal(evaluateMetrics(metrics({ node_memory_MemAvailable_bytes: null }, 'node_memory_MemAvailable_bytes{instance="other"} 1')).resources, "unknown");
  const disabledSwap = evaluateMetrics(metrics({ node_memory_SwapTotal_bytes: 0, node_memory_SwapFree_bytes: 0 }));
  assert.equal(disabledSwap.resources, "ok");
  assert.equal(disabledSwap.details.swapUsedPercent, 0);
  const empty = evaluateMetrics("# HELP unknown comment\nnode_memory_MemFree_bytes 0\nnode_load10 200\n");
  assert.equal(empty.available, false);
  assert.equal(empty.resources, "unknown");
  assert(Object.values(empty.details).every((value) => value === null));
});

test("missing CPU labels cannot manufacture cores; missing metric families keep known warnings", () => {
  const withoutCpu = metrics().split("\n").filter((line) => !line.startsWith("node_cpu_seconds_total")).join("\n");
  const result = evaluateMetrics(withoutCpu);
  assert.equal(result.resources, "unknown");
  assert.equal(result.details.loadPerCore, null);
  assert.equal(evaluateMetrics(withoutCpu + '\nnode_cpu_seconds_total{mode="idle"} 20').resources, "unknown");
  const partial = evaluateMetrics("pg_settings_max_connections 100\npg_stat_activity_count 85\n");
  assert.equal(partial.resources, "warning");
  assert.deepEqual(partial.warnings, ["connection_pressure", "resource_metrics_incomplete"]);
});

test("public GET needs no app authorization and returns only coarse signals; fixed GET URLs cannot be overridden", async () => {
  const s = setup();
  const api = createServerHealthHandler(s.dependencies);
  const response = await invoke(api, {
    url: "/api/server-health",
    headers: { authorization: "Bearer untrusted-user", cookie: "untrusted-cookie" },
    body: { url: "https://attacker.test", method: "POST", select: "payload" }
  });
  const payload = JSON.parse(response.body);
  assertPublic(payload);
  assert.equal(payload.status, "healthy");
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "public, max-age=0, s-maxage=60, must-revalidate, proxy-revalidate");
  assert.equal(response.headers["Content-Type"], "application/json; charset=utf-8");
  assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
  assert.deepEqual(s.calls.map((call) => call.url).sort(), [METADATA_URL, METRICS_URL].sort());
  for (const { url, init } of s.calls) {
    assert.equal(init.method, "GET");
    assert.equal(init.body, undefined);
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert(!url.includes(SECRET));
    assert(!url.includes("payload"));
    assert(!JSON.stringify(init).includes("untrusted"));
  }
  assert.strictEqual(s.calls[0].init.signal, s.calls[1].init.signal);
  assert.equal(s.timers.size, 0);
  assert.equal(handler.config.maxDuration, 15);
  assert.equal(s.logs.length, 1);
});

test("Basic service_role authentication and DB headers support existing secret or legacy keys without logging them", async () => {
  for (const key of [SECRET, "eyJ.synthetic.legacy_service_key"]) {
    const s = setup({ dependencies: { getServiceRoleKey: () => key } });
    const response = await invoke(createServerHealthHandler(s.dependencies));
    const db = s.calls.find((call) => call.url === METADATA_URL);
    const scrape = s.calls.find((call) => call.url === METRICS_URL);
    assert.equal(scrape.init.headers.Authorization, `Basic ${Buffer.from(`service_role:${key}`).toString("base64")}`);
    assert.equal(scrape.init.headers.apikey, undefined);
    assert.equal(db.init.headers.apikey, key);
    assert.equal(db.init.headers.Authorization, key.startsWith("sb_secret_") ? undefined : `Bearer ${key}`);
    for (const secret of [key, Buffer.from(`service_role:${key}`).toString("base64"), BASE]) {
      assert(!response.body.includes(secret));
      assert(!JSON.stringify(s.logs).includes(secret));
    }
  }
});

test("non-GET methods never fetch, read request bodies, or reveal diagnostics", async () => {
  const s = setup();
  const api = createServerHealthHandler(s.dependencies);
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
    const response = await invoke(api, { method, get body() { throw new Error("must not read"); } });
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, "GET");
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(response.body, "");
  }
  assert.equal(s.calls.length, 0);
  assert.equal(s.logs.length, 0);
});

test("cache-busting query strings are rejected without probing the server", async () => {
  const s = setup();
  const api = createServerHealthHandler(s.dependencies);
  for (const url of ["/api/server-health?nonce=1", "/api/server-health?nonce=2", "/api/server-health?", "/api/server-health?url=https://attacker.test&select=payload"]) {
    const response = await invoke(api, { method: "GET", url });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body, "");
  }
  assert.equal(s.calls.length, 0);
  assert.equal(s.logs.length, 0);
});

test("in-flight checks are shared; healthy cache expires at 60s and CDN TTL cannot restart on hits", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const s = setup({ fetch: async (url) => {
    await gate;
    return new Response(url === METADATA_URL ? '[{"sync_revision":0}]' : metrics());
  } });
  const api = createServerHealthHandler(s.dependencies);
  const first = invoke(api);
  const second = invoke(api);
  await flush();
  assert.equal(s.calls.length, 2);
  assert.equal(s.timers.size, 1);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.body, b.body);
  assert.equal(s.logs.length, 1);
  s.advance(59000);
  const cached = await invoke(api);
  assert.equal(cached.body, a.body);
  assert(cached.headers["Cache-Control"].includes("s-maxage=1,"));
  assert.equal(s.calls.length, 2);
  s.advance(1000);
  const fresh = await invoke(api);
  assert.equal(s.calls.length, 4);
  assert.notEqual(JSON.parse(fresh.body).checkedAt, JSON.parse(a.body).checkedAt);
  assert.equal(s.logs.length, 2);
});

test("failures and degradation cache for only 15s, never serve stale success after expiry, then recover", async () => {
  let failing = false;
  const s = setup({ fetch: async (url) => new Response(url === METADATA_URL
    ? (failing ? "sensitive failure" : '[{"sync_revision":1}]') : metrics(),
  { status: failing && url === METADATA_URL ? 500 : 200 }) });
  const api = createServerHealthHandler(s.dependencies);
  assert.equal((await invoke(api)).statusCode, 200);
  failing = true;
  s.advance(60000);
  const failed = await invoke(api);
  assert.equal(failed.statusCode, 200);
  assert.equal(JSON.parse(failed.body).status, "unavailable");
  assert(failed.headers["Cache-Control"].includes("s-maxage=15,"));
  s.advance(14999);
  assert.equal((await invoke(api)).body, failed.body);
  assert.equal(s.calls.length, 4);
  failing = false;
  s.advance(1);
  assert.equal((await invoke(api)).statusCode, 200);
  assert.equal(s.calls.length, 6);
});

test("DB latency includes the response body and 3000ms is slow, not unavailable", async () => {
  for (const delay of [2999, 3000]) {
    let release;
    const s = setup({ fetch: async (url) => url === METADATA_URL ? new Response(new ReadableStream({
      start(controller) { release = () => { controller.enqueue(Buffer.from('[{"sync_revision":1}]')); controller.close(); }; }
    })) : new Response(metrics()) });
    const pending = invoke(createServerHealthHandler(s.dependencies));
    await flush();
    s.advance(delay);
    release();
    const response = await pending;
    const payload = JSON.parse(response.body);
    assert.equal(payload.signals.database, delay === 3000 ? "slow" : "ok");
    assert.equal(payload.status, delay === 3000 ? "degraded" : "healthy");
    assert.equal(response.statusCode, 200);
  }
});

test("DB HTTP failures, malformed/empty metadata and unexpected payload fields are unavailable", async () => {
  for (const [status, body] of [[401, SECRET], [403, SECRET], [429, SECRET], [500, SECRET], [302, SECRET],
    [204, null], [200, "not json"], [200, "[]"], [200, "{}"], [200, '[{"sync_revision":null}]'],
    [200, '[{"sync_revision":-1}]'], [200, '[{"sync_revision":1,"payload":"PRIVATE"}]']]) {
    const s = setup({ fetch: async (url) => url === METADATA_URL ? new Response(body, { status }) : new Response(metrics()) });
    const response = await invoke(createServerHealthHandler(s.dependencies));
    const payload = JSON.parse(response.body);
    assertPublic(payload);
    assert.equal(payload.status, "unavailable", `${status} ${body}`);
    assert.equal(payload.signals.database, "unavailable");
    assert.equal(response.statusCode, 200);
    assert(!JSON.stringify(s.logs).includes(SECRET));
    assert(!JSON.stringify(s.logs).includes("PRIVATE"));
  }
});

test("metrics auth/HTTP failures, bad text, or partial metrics degrade instead of creating healthy zeros", async () => {
  for (const [status, body] of [[401, SECRET], [403, SECRET], [429, SECRET], [500, SECRET], [302, SECRET],
    [200, "<html>error</html>"], [200, ""], [200, "node_memory_MemTotal_bytes 100"]]) {
    const s = setup({ fetch: async (url) => url === METRICS_URL ? new Response(body, { status }) : new Response('[{"sync_revision":"8"}]') });
    const response = await invoke(createServerHealthHandler(s.dependencies));
    const payload = JSON.parse(response.body);
    assertPublic(payload);
    assert.equal(payload.status, "degraded");
    assert.equal(payload.signals.resources, "unknown");
    assert.equal(payload.signals.metrics, body.startsWith("node_") ? "ok" : "unavailable");
    assert.equal(response.statusCode, 200);
    assert(response.headers["Cache-Control"].includes("s-maxage=15,"));
  }
});

test("resource warnings yield a cacheable public degraded result and the short cache, while details remain server-only", async () => {
  const s = setup({ fetch: async (url) => new Response(url === METADATA_URL ? '[{"sync_revision":1}]' : metrics({ node_load1: 4 })) });
  const api = createServerHealthHandler(s.dependencies);
  const response = await invoke(api);
  const payload = JSON.parse(response.body);
  assertPublic(payload);
  assert.deepEqual(payload.signals, { database: "ok", resources: "warning", metrics: "ok" });
  assert.equal(payload.status, "degraded");
  assert.equal(response.statusCode, 200);
  assert(response.headers["Cache-Control"].includes("s-maxage=15,"));
  assert(!response.body.includes("loadPerCore"));
  assert(!response.body.includes("load_pressure"));
  assert.deepEqual(s.logs[0].warnings, ["load_pressure"]);
  s.advance(15000);
  await invoke(api);
  assert.equal(s.calls.length, 4);
});

test("fetch and body stalls share one bounded abort, release in-flight state, and ignore late completion", async () => {
  for (const endpoint of [METADATA_URL, METRICS_URL]) {
    for (const phase of ["fetch", "body"]) {
      let release;
      let cancelled = false;
      const s = setup({ fetch: async (url) => {
        if (url !== endpoint) return new Response(url === METADATA_URL ? '[{"sync_revision":1}]' : metrics());
        if (phase === "fetch") return new Promise((resolve) => { release = () => resolve(new Response("late sensitive data")); });
        return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
      } });
      const api = createServerHealthHandler(s.dependencies);
      const first = invoke(api);
      const second = invoke(api);
      await flush();
      assert.equal(s.calls.length, 2);
      assert.equal(s.timers.size, 1);
      s.expire();
      const [a, b] = await Promise.all([first, second]);
      assert.equal(a.body, b.body);
      assert.equal(a.statusCode, 200);
      assert.equal(JSON.parse(a.body).status, endpoint === METADATA_URL ? "unavailable" : "degraded");
      assert(s.calls.every((call) => call.init.signal.aborted));
      assert.equal(s.timers.size, 0);
      assert.equal(s.logs.length, 1);
      if (phase === "body") assert(cancelled);
      if (release) release();
      await flush();
      assert.equal((await invoke(api)).body, a.body);
      assert.equal(s.logs.length, 1);
    }
  }
});

test("streaming caps enforce metrics 2MiB and metadata 20KiB without relying on content-length", async () => {
  for (const [endpoint, max] of [[METRICS_URL, 2 * 1024 * 1024], [METADATA_URL, 20 * 1024]]) {
    for (const advertised of [false, true]) {
      let cancelled = false;
      const s = setup({ fetch: async (url) => {
        if (url !== endpoint) return new Response(url === METADATA_URL ? '[{"sync_revision":1}]' : metrics());
        const body = new ReadableStream({
          start(controller) { controller.enqueue(Buffer.alloc(max + 1, 65)); },
          cancel() { cancelled = true; }
        });
        return new Response(body, { headers: advertised ? { "Content-Length": String(max + 1) } : {} });
      } });
      const response = await invoke(createServerHealthHandler(s.dependencies));
      assert.equal(response.statusCode, 200);
      assert.equal(JSON.parse(response.body).status, endpoint === METADATA_URL ? "unavailable" : "degraded");
      assert(cancelled);
      assert.equal(s.calls.length, 2, "no retries");
      assert.equal(s.timers.size, 0);
    }
  }
});

test("exact body byte limits are accepted, including split UTF-8 sequences", async () => {
  const metricText = metrics();
  const metricBytes = Buffer.concat([
    Buffer.from(metricText + "# "), Buffer.from([0xc3, 0xa9]),
    Buffer.alloc(2 * 1024 * 1024 - Buffer.byteLength(metricText) - 4, 65)
  ]);
  const metadataBytes = Buffer.from('[{"sync_revision":1}]'.padEnd(20 * 1024, " "));
  const s = setup({ fetch: async (url) => {
    const bytes = url === METADATA_URL ? metadataBytes : metricBytes;
    const split = url === METADATA_URL ? 10 : Buffer.byteLength(metricText) + 3;
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(bytes.subarray(0, split));
      controller.enqueue(bytes.subarray(split));
      controller.close();
    } }));
  } });
  assert.equal((await invoke(createServerHealthHandler(s.dependencies))).statusCode, 200);
  assert.equal(s.calls.length, 2);
});

test("network rejection, stream read rejection, and redirected successes fail without retries or diagnostics", async () => {
  for (const endpoint of [METADATA_URL, METRICS_URL]) {
    for (const failure of ["network", "stream", "redirect"]) {
      const s = setup({ fetch: async (url) => {
        if (url !== endpoint) return new Response(url === METADATA_URL ? '[{"sync_revision":1}]' : metrics());
        if (failure === "network") throw new Error(SECRET);
        if (failure === "stream") return new Response(new ReadableStream({ start(controller) { controller.error(new Error(SECRET)); } }));
        return { ok: true, status: 200, redirected: true, body: new ReadableStream() };
      } });
      const response = await invoke(createServerHealthHandler(s.dependencies));
      assert.equal(response.statusCode, 200);
      assert.equal(JSON.parse(response.body).status, endpoint === METADATA_URL ? "unavailable" : "degraded");
      assert.equal(s.calls.length, 2);
      assert.equal(s.timers.size, 0);
      assert(!response.body.includes(SECRET));
      assert(!JSON.stringify(s.logs).includes(SECRET));
    }
  }
});

test("failed HTTP responses are cancelled without reading an unauthorized/error payload", async () => {
  let cancelled = 0;
  const s = setup({ fetch: async () => ({
    ok: false, status: 401,
    body: {
      cancel() { cancelled++; },
      getReader() { assert.fail("unauthorized bodies must not be read"); }
    },
    text() { assert.fail("unauthorized text must not be read"); },
    json() { assert.fail("unauthorized json must not be read"); }
  }) });
  const response = await invoke(createServerHealthHandler(s.dependencies));
  assertPublic(JSON.parse(response.body));
  assert.equal(JSON.parse(response.body).status, "unavailable");
  assert.equal(cancelled, 2);
  assert.equal(s.calls.length, 2);
});

test("both stalled probes still share just one deadline and a cached failure expires into recovery", async () => {
  let failing = true;
  const s = setup({ fetch: async (url) => {
    if (failing) return new Promise(() => {});
    return new Response(url === METADATA_URL ? '[{"sync_revision":1}]' : metrics());
  } });
  const api = createServerHealthHandler(s.dependencies);
  const pending = invoke(api);
  await flush();
  assert.equal(s.timers.size, 1);
  s.expire();
  const response = await pending;
  assert.equal(JSON.parse(response.body).status, "unavailable");
  assert.equal(s.timers.size, 0);
  failing = false;
  s.advance(15000);
  const recovery = await invoke(api);
  assert.equal(recovery.statusCode, 200);
  assert.equal(s.calls.length, 4);
  assert.equal(s.logs.length, 2);
});

test("logs allow only sanitized derived values and static warnings, never raw text, labels, secrets, schema, or errors", async () => {
  const privateText = 'PRIVATE_SCHEMA_SQL select payload from private_table /private/data';
  const s = setup({ fetch: async (url) => {
    if (url === METADATA_URL) throw new Error(`${SECRET} ${privateText}`);
    return new Response(metrics({ node_load1: 4 }, `# HELP ${SECRET} ${privateText}\nunknown_metric{sql="${privateText}"} 999`));
  } });
  const response = await invoke(createServerHealthHandler(s.dependencies));
  assertPublic(JSON.parse(response.body));
  assert.equal(s.logs.length, 1);
  const event = s.logs[0];
  assert.deepEqual(Object.keys(event).sort(), ["checkedAt", "event", "resources", "signals", "status", "warnings"]);
  assert.equal(event.event, "jhint_server_health");
  assert.deepEqual(event.warnings, ["load_pressure"]);
  assert(Object.values(event.resources).every((value) => value === null || typeof value === "number"));
  for (const disallowed of [SECRET, Buffer.from(`service_role:${SECRET}`).toString("base64"), privateText,
    "/dev/root", "node_load1", "sync_revision", "app_state", "stack", "message", "headers", BASE]) {
    assert(!JSON.stringify(event).includes(disallowed), disallowed);
    assert(!response.body.includes(disallowed), disallowed);
  }
});

test("missing credentials and unsafe configured URLs fail closed without requests or secret diagnostics", async () => {
  for (const dependencies of [
    { getServiceRoleKey: () => "" },
    { getSupabaseUrl: () => "http://synthetic.supabase.co" },
    { getSupabaseUrl: () => "https://user:password@synthetic.supabase.co" },
    { getSupabaseUrl: () => "https://synthetic.supabase.co/other?secret=private" },
    { getServiceRoleKey: () => { throw new Error(SECRET); } }
  ]) {
    const s = setup({ dependencies });
    const response = await invoke(createServerHealthHandler(s.dependencies));
    const payload = JSON.parse(response.body);
    assertPublic(payload);
    assert.equal(payload.status, "unavailable");
    assert.equal(s.calls.length, 0);
    assert.equal(s.timers.size, 0);
    assert(!JSON.stringify(s.logs).includes(SECRET));
  }
});

test("monitor payload is immutable and logger errors cannot break coarse health responses", async () => {
  const s = setup({ dependencies: { log() { throw new Error(SECRET); } } });
  const monitor = createServerHealthMonitor(s.dependencies);
  const first = await monitor.getHealth();
  assert(Object.isFrozen(first.payload));
  assert(Object.isFrozen(first.payload.signals));
  assert.equal(first.payload.status, "healthy");
  assert.equal((await monitor.getHealth()).payload.status, "healthy");
  assert.equal(s.calls.length, 2);
});
