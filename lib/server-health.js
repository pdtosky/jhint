const { getServiceRoleKey, getSupabaseUrl } = require("./push-server");

const TIMEOUT_MS = 10000;
const METRICS_MAX_BYTES = 2 * 1024 * 1024;
const METADATA_MAX_BYTES = 20 * 1024;
const METRICS_PATH = "/customer/v1/privileged/metrics";
const METADATA_PATH = "/rest/v1/app_state?id=eq.main&select=sync_revision&limit=1";
const METRIC_NAMES = new Set([
  "node_memory_MemTotal_bytes", "node_memory_MemAvailable_bytes",
  "node_memory_SwapTotal_bytes", "node_memory_SwapFree_bytes",
  "node_memory_CommitLimit_bytes", "node_memory_Committed_AS_bytes",
  "pg_stat_activity_count", "pg_settings_max_connections",
  "node_load1", "node_cpu_seconds_total",
  "node_filesystem_size_bytes", "node_filesystem_avail_bytes"
]);
const CPU_MODES = new Set(["idle", "user", "nice", "system", "iowait", "irq", "softirq", "steal", "guest", "guest_nice"]);

function labelKey(labels, omit = []) {
  return JSON.stringify(Object.keys(labels).filter((key) => !omit.includes(key)).sort().map((key) => [key, labels[key]]));
}

function parseLabels(text) {
  const labels = Object.create(null);
  if (!text.trim()) return labels;
  const pattern = /\s*([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\\n]|\\[\\"n])*)"\s*(?:,\s*|$)/gy;
  let offset = 0;
  while (offset < text.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(text);
    if (!match || Object.hasOwn(labels, match[1])) return null;
    labels[match[1]] = match[2].replace(/\\([\\"n])/g, (_, char) => char === "n" ? "\n" : char);
    offset = pattern.lastIndex;
  }
  return labels;
}

function parseMetrics(text) {
  const series = new Map();
  const invalid = new Set();
  for (const line of text.split(/\r?\n/)) {
    const name = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)/)?.[1];
    if (!METRIC_NAMES.has(name)) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?[\t ]+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?:[\t ]+[+-]?\d+)?[\t ]*$/);
    const labels = match && parseLabels(match[2] || "");
    const value = match ? Number(match[3]) : NaN;
    if (!labels || !Number.isFinite(value) || value < 0) {
      invalid.add(name);
      continue;
    }
    if (!series.has(name)) series.set(name, new Map());
    const samples = series.get(name);
    const key = labelKey(labels);
    if (samples.has(key)) invalid.add(name);
    samples.set(key, { labels, value });
  }
  for (const name of invalid) series.delete(name);
  return series;
}

function single(series, name) {
  const values = [...(series.get(name)?.values() || [])];
  return values.length === 1 ? values[0] : null;
}

function pair(series, first, second, bounded = true) {
  const left = single(series, first);
  const right = single(series, second);
  if (!left || !right || labelKey(left.labels) !== labelKey(right.labels)) return null;
  if (bounded && left.value > right.value) return null;
  return { left: left.value, right: right.value };
}

function rounded(value) {
  return Number.isFinite(value) ? Math.round(Math.min(value, 1000000) * 100) / 100 : null;
}

function evaluateMetrics(text) {
  const series = parseMetrics(text);
  const memory = pair(series, "node_memory_MemAvailable_bytes", "node_memory_MemTotal_bytes");
  const swap = pair(series, "node_memory_SwapFree_bytes", "node_memory_SwapTotal_bytes");
  const commit = pair(series, "node_memory_Committed_AS_bytes", "node_memory_CommitLimit_bytes", false);
  const memoryPercent = memory?.right > 0 ? memory.left / memory.right * 100 : null;
  const swapUsed = swap ? swap.right - swap.left : null;
  const swapPercent = swap ? (swap.right > 0 ? swapUsed / swap.right * 100 : 0) : null;
  const commitPercent = commit?.right > 0 ? commit.left / commit.right * 100 : null;

  const maxConnections = single(series, "pg_settings_max_connections");
  const activity = [...(series.get("pg_stat_activity_count")?.values() || [])];
  const activityDimensions = ["datname", "state", "usename", "backend_type"];
  const connectionsMatch = maxConnections?.value > 0 && activity.length > 0 && activity.every(
    (sample) => labelKey(sample.labels, activityDimensions) === labelKey(maxConnections.labels, activityDimensions)
  );
  const connectionPercent = connectionsMatch
    ? activity.reduce((sum, sample) => sum + sample.value, 0) / maxConnections.value * 100 : null;

  const load = single(series, "node_load1");
  const cpuSamples = [...(series.get("node_cpu_seconds_total")?.values() || [])];
  const cpuMatch = load && cpuSamples.length > 0 && cpuSamples.every((sample) =>
    /^\d+$/.test(sample.labels.cpu || "") && CPU_MODES.has(sample.labels.mode) &&
    labelKey(sample.labels, ["cpu", "mode"]) === labelKey(load.labels)
  );
  // A single scrape cannot turn cumulative CPU counters into utilization.
  const cores = cpuMatch ? new Set(cpuSamples.map((sample) => sample.labels.cpu)).size : 0;
  const loadPerCore = cores > 0 ? load.value / cores : null;

  const sizes = series.get("node_filesystem_size_bytes") || new Map();
  const available = series.get("node_filesystem_avail_bytes") || new Map();
  const diskPercentages = [];
  let disksComplete = true;
  for (const key of new Set([...sizes.keys(), ...available.keys()])) {
    const sample = sizes.get(key) || available.get(key);
    const { mountpoint = "", fstype } = sample.labels;
    const dataMount = mountpoint === "/data" || mountpoint.startsWith("/data/") ||
      mountpoint === "/var/lib/postgresql" || mountpoint.startsWith("/var/lib/postgresql/");
    if (!["ext4", "xfs"].includes(fstype) || (mountpoint !== "/" && !dataMount)) continue;
    const size = sizes.get(key)?.value;
    const free = available.get(key)?.value;
    if (!(size > 0) || free === undefined || free > size) {
      disksComplete = false;
      continue;
    }
    diskPercentages.push((size - free) / size * 100);
  }
  const diskPercent = diskPercentages.length ? Math.max(...diskPercentages) : null;
  const values = [memoryPercent, swapPercent, commitPercent, connectionPercent, loadPerCore, diskPercent];
  const complete = disksComplete && values.every((value) => value !== null && Number.isFinite(value));
  const warnings = [];
  if (memoryPercent !== null && memoryPercent <= 10 && swapUsed !== null && swapUsed >= 256 * 1024 * 1024) warnings.push("memory_pressure");
  if (commitPercent !== null && commitPercent >= 125 && memoryPercent !== null && memoryPercent <= 15) warnings.push("commit_pressure");
  if (connectionPercent !== null && connectionPercent >= 85) warnings.push("connection_pressure");
  if (diskPercent !== null && diskPercent >= 90) warnings.push("disk_pressure");
  if (loadPerCore !== null && loadPerCore >= 2) warnings.push("load_pressure");
  if (!complete) warnings.push("resource_metrics_incomplete");
  return {
    available: series.size > 0,
    resources: warnings.some((warning) => warning !== "resource_metrics_incomplete") ? "warning" : complete ? "ok" : "unknown",
    details: {
      availableMemoryPercent: rounded(memoryPercent),
      swapUsedPercent: rounded(swapPercent),
      committedPercent: rounded(commitPercent),
      connectionsPercent: rounded(connectionPercent),
      diskUsedPercent: rounded(diskPercent),
      loadPerCore: rounded(loadPerCore)
    },
    warnings
  };
}

function cancelBody(body) {
  try { Promise.resolve(body?.cancel()).catch(() => {}); } catch {}
}

function beforeAbort(operation, signal) {
  if (signal.aborted) return Promise.reject(new Error("health_deadline"));
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new Error("health_deadline"));
    };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw new Error("health_deadline");
      return operation();
    }).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

async function readLimitedText(response, maxBytes, signal) {
  const length = Number(response.headers?.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) {
    cancelBody(response.body);
    throw new Error("health_body_limit");
  }
  if (!response.body?.getReader) throw new Error("health_missing_body");
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await beforeAbort(() => reader.read(), signal);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("health_body_limit");
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, bytes).toString("utf8");
  } catch (error) {
    cancelBody(reader);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function fetchText(fetchImpl, url, headers, maxBytes, signal) {
  const response = await beforeAbort(async () => {
    const received = await fetchImpl(url, {
      method: "GET", headers, signal, cache: "no-store", redirect: "error"
    });
    if (signal.aborted) {
      cancelBody(received.body);
      throw new Error("health_deadline");
    }
    return received;
  }, signal);
  if (!response.ok || response.status !== 200 || response.redirected) {
    cancelBody(response.body);
    throw new Error("health_http_failure");
  }
  return readLimitedText(response, maxBytes, signal);
}

function validMetadata(text) {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  const row = rows[0];
  if (!row || typeof row !== "object" || Object.keys(row).length !== 1 || !Object.hasOwn(row, "sync_revision")) return false;
  return typeof row.sync_revision === "number" ? Number.isSafeInteger(row.sync_revision) && row.sync_revision >= 0
    : typeof row.sync_revision === "string" && /^\d+$/.test(row.sync_revision);
}

function createServerHealthMonitor(dependencies = {}) {
  const fetchImpl = dependencies.fetch || globalThis.fetch;
  const now = dependencies.now || Date.now;
  const schedule = dependencies.setTimeout || setTimeout;
  const unschedule = dependencies.clearTimeout || clearTimeout;
  const readUrl = dependencies.getSupabaseUrl || getSupabaseUrl;
  const readKey = dependencies.getServiceRoleKey || getServiceRoleKey;
  const log = dependencies.log || ((event) => console.log(JSON.stringify(event)));
  let cached = null;
  let inFlight = null;

  async function sample() {
    let database = "unavailable";
    let metrics = "unavailable";
    let assessment = evaluateMetrics("");
    let timer;
    try {
      const base = new URL(readUrl());
      const key = readKey();
      if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/" || !key) {
        throw new Error("health_configuration");
      }
      const controller = new AbortController();
      // One deadline covers BOTH requests, including streaming their bodies.
      timer = schedule(() => controller.abort(), TIMEOUT_MS);
      const dbHeaders = { apikey: key, Accept: "application/json" };
      if (!key.startsWith("sb_secret_")) dbHeaders.Authorization = `Bearer ${key}`;
      await Promise.all([
        (async () => {
          const startedAt = now();
          try {
            const text = await fetchText(fetchImpl, base.origin + METADATA_PATH, dbHeaders, METADATA_MAX_BYTES, controller.signal);
            if (validMetadata(text)) database = now() - startedAt >= 3000 ? "slow" : "ok";
          } catch {}
        })(),
        (async () => {
          try {
            const text = await fetchText(fetchImpl, base.origin + METRICS_PATH, {
              Authorization: `Basic ${Buffer.from(`service_role:${key}`).toString("base64")}`,
              Accept: "text/plain"
            }, METRICS_MAX_BYTES, controller.signal);
            assessment = evaluateMetrics(text);
            if (assessment.available) metrics = "ok";
          } catch {}
        })()
      ]);
    } catch {
      // Never forward provider errors, response bodies, credentials, or URLs.
    } finally {
      if (timer !== undefined) unschedule(timer);
    }
    const signals = Object.freeze({ database, resources: assessment.resources, metrics });
    const status = database === "unavailable" ? "unavailable"
      : database === "slow" || metrics === "unavailable" || assessment.resources !== "ok" ? "degraded" : "healthy";
    const payload = Object.freeze({ ok: status === "healthy", status, checkedAt: new Date(now()).toISOString(), signals });
    try {
      log({
        event: "jhint_server_health", status, checkedAt: payload.checkedAt, signals,
        resources: assessment.details,
        warnings: [...assessment.warnings, ...(metrics === "unavailable" ? ["metrics_unavailable"] : [])]
      });
    } catch {}
    return payload;
  }

  async function getHealth() {
    if (!cached || now() >= cached.expiresAt) {
      if (!inFlight) {
        inFlight = sample().then((payload) => {
          cached = { payload, expiresAt: now() + (payload.ok ? 60000 : 15000) };
          return cached;
        }).finally(() => { inFlight = null; });
      }
      await inFlight;
    }
    // A cache hit must not restart the CDN's TTL and extend stale health.
    return { payload: cached.payload, cacheSeconds: Math.max(0, Math.floor((cached.expiresAt - now()) / 1000)) };
  }

  return { getHealth };
}

module.exports = { createServerHealthMonitor, evaluateMetrics };
