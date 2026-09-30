const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const root = path.join(__dirname, "..");
const handlerPath = path.join(root, "api", "push-reminders.js");
const handlerSource = fs.readFileSync(handlerPath, "utf8");
const dateKey = "2026-09-30";
const slots = [
  { kind: "morning-early", time: "08:40", utc: "2026-09-29T23:40:00.000Z", cron: "40 23 * * 0-4" },
  { kind: "morning", time: "09:00", utc: "2026-09-30T00:00:00.000Z", cron: "0 0 * * 1-5" },
  { kind: "evening-early", time: "20:10", utc: "2026-09-30T11:10:00.000Z", cron: "10 11 * * 1-5" },
  { kind: "evening", time: "21:00", utc: "2026-09-30T12:00:00.000Z", cron: "0 12 * * 1-5" }
];
const clone = (value) => JSON.parse(JSON.stringify(value));

function createHarness(role = "production") {
  let now = Date.parse(slots[0].utc);
  const users = [
    { id: "worker-1", app_metadata: { jhint_role: "production" }, user_metadata: { display_name: "Worker One" } },
    { id: "admin-1", app_metadata: { jhint_role: "admin" }, user_metadata: { display_name: "Admin One" } }
  ];
  const userId = role === "admin" ? "admin-1" : "worker-1";
  const subscriptions = [{
    id: "subscription-1", user_id: userId, role,
    endpoint: "https://push.invalid/subscription-1", p256dh: "fake-key", auth: "fake-auth"
  }];
  const state = {
    orders: [{ id: "order-1", status: "ready", workerUserId: "worker-1", workerName: "Worker One" }],
    activities: []
  };
  const pushes = [];
  const claims = [];
  const finishes = [];
  const requests = [];
  const deliveries = new Map();
  const config = { cronSecret: "test-only-secret" };

  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
    static now() { return now; }
  }

  const mockServer = {
    getBearerToken(request) {
      return String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    },
    async getPushServerConfig() { return config; },
    sendJson(response, statusCode, body) {
      response.statusCode = statusCode;
      response.body = clone(body);
    },
    async sendWebPush(subscription, payload, receivedConfig) {
      assert.equal(receivedConfig, config);
      pushes.push(clone({ subscription, payload }));
    },
    async supabaseRequest(resource, options = {}) {
      requests.push({ resource, method: options.method });
      const url = new URL(resource, "https://database.invalid");
      if (options.method === "GET" && url.pathname === "/rest/v1/app_state") {
        return [{ payload: clone(state) }];
      }
      if (options.method === "GET" && url.pathname === "/auth/v1/admin/users") {
        return { users: clone(users) };
      }
      if (options.method === "GET" && url.pathname === "/rest/v1/push_subscriptions") {
        return clone(subscriptions);
      }
      if (options.method === "POST" && url.pathname === "/rest/v1/rpc/claim_jhint_push_delivery") {
        const body = JSON.parse(options.body);
        claims.push(body);
        const key = JSON.stringify([body.p_user_id, body.p_kind, body.p_delivery_date]);
        if (deliveries.has(key)) return false;
        deliveries.set(key, "pending");
        return true;
      }
      if (options.method === "PATCH" && url.pathname === "/rest/v1/push_delivery_log") {
        const finish = {
          userId: url.searchParams.get("user_id"),
          kind: url.searchParams.get("kind"),
          date: url.searchParams.get("delivery_date"),
          body: JSON.parse(options.body)
        };
        const key = JSON.stringify([
          finish.userId.replace(/^eq\./, ""),
          finish.kind.replace(/^eq\./, ""),
          finish.date.replace(/^eq\./, "")
        ]);
        assert.equal(deliveries.get(key), "pending", "finish must update the exact reserved slot");
        deliveries.set(key, finish.body.status);
        finishes.push(finish);
        return null;
      }
      if (options.method === "PATCH" && url.pathname === "/rest/v1/push_subscriptions") {
        assert.ok(JSON.parse(options.body).last_success_at, "admin-test should record subscription success");
        return null;
      }
      throw new Error(`Unexpected mocked database request: ${options.method} ${resource}`);
    }
  };
  const sandbox = {
    module: { exports: {} }, URL, Intl, Date: FakeDate,
    require(name) {
      assert.equal(name, "../lib/push-server", "no real dependencies or network access are allowed");
      return mockServer;
    }
  };
  vm.runInNewContext(handlerSource, sandbox, { filename: handlerPath });

  return {
    state, pushes, claims, finishes, requests, deliveries, userId, subscriptions,
    async invoke(kind, utc, authorization = `Bearer ${config.cronSecret}`) {
      now = Date.parse(utc);
      assert.ok(Number.isFinite(now));
      const response = { setHeader() {} };
      await sandbox.module.exports({
        method: "POST", url: `/api/push-reminders?kind=${encodeURIComponent(kind)}`,
        headers: { authorization }
      }, response);
      return response;
    }
  };
}

function assertOk(response) {
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.ok, true);
}

for (const role of ["production", "admin"]) {
  test(`${role}: all four Wednesday KST slots send once with independent delivery identities`, async () => {
    const harness = createHarness(role);
    for (const [index, slot] of slots.entries()) {
      const logicalKind = slot.kind.startsWith("morning") ? "morning" : "evening";
      harness.state.orders[0].status = logicalKind === "morning" ? "ready" : "working";
      const response = await harness.invoke(slot.kind, slot.utc);
      assertOk(response);
      assert.equal(response.body.dateKey, dateKey, `${slot.time} must use Wednesday in KST`);
      assert.equal(harness.pushes.length, index + 1, `${slot.time} must send exactly one push`);
      assert.equal(response.body.results.find((item) => item.userId === harness.userId).successCount, 1);
      assert.equal(harness.claims.at(-1).p_kind, slot.kind, "RPC must retain the original delivery kind");
      assert.equal(harness.claims.at(-1).p_user_id, harness.userId);
      assert.equal(harness.claims.at(-1).p_delivery_date, dateKey);
      const finish = harness.finishes.at(-1);
      assert.equal(finish.kind, `eq.${slot.kind}`, "completion filter must retain the original delivery kind");
      assert.equal(finish.userId, `eq.${harness.userId}`);
      assert.equal(finish.date, `eq.${dateKey}`);
      assert.equal(finish.body.status, "success");
      assert.equal(finish.body.detail.successCount, 1);
      assert.equal(finish.body.sent_at, slot.utc);
      const payload = harness.pushes.at(-1).payload;
      assert.equal(payload.tag, `jhint-${role}-${slot.kind}-${dateKey}`);
      assert.equal(payload.view, role === "admin" ? "dashboardView" : "workerView");
      assert.match(payload.title, logicalKind === "morning" ? /\uC791\uC5C5 \uC2DC\uC791/ : /\uC791\uC5C5 \uC885\uB8CC/);

      const repeat = await harness.invoke(slot.kind, slot.utc);
      assertOk(repeat);
      assert.equal(repeat.body.results.find((item) => item.userId === harness.userId).skipped, true);
      assert.equal(harness.pushes.length, index + 1, "repeating a slot must not send again");
      assert.equal(harness.finishes.length, index + 1, "duplicates must not finish another delivery");
    }
    assert.equal(harness.claims.length, 8);
    assert.equal(harness.deliveries.size, 4);
    assert.deepEqual([...harness.deliveries.values()], Array(4).fill("success"));
    assert.equal(new Set(harness.pushes.map(({ payload }) => payload.tag)).size, 4);
  });

  for (const startedStatus of ["working", "paused"]) {
    test(`${role}: starting at 08:50 suppresses 09:00 even when status becomes ${startedStatus}`, async () => {
      const harness = createHarness(role);
      assertOk(await harness.invoke(slots[0].kind, slots[0].utc));
      assert.equal(harness.pushes.length, 1);
      harness.state.orders[0].status = startedStatus;
      harness.state.activities.push({
        type: "start", workerUserId: "worker-1", workerName: "Worker One",
        timestamp: "2026-09-30T08:50:00+09:00"
      });
      assertOk(await harness.invoke(slots[1].kind, slots[1].utc));
      assert.equal(harness.pushes.length, 1, "later morning must re-check today's start activity");
      assert.equal(harness.claims.length, 1, "ineligible later slot must not reserve a delivery");
      assert.equal(harness.finishes.length, 1);
    });
  }

  for (const finalStatus of ["complete", "paused"]) {
    test(`${role}: ${finalStatus} between evening slots suppresses 21:00`, async () => {
      const harness = createHarness(role);
      harness.state.orders[0].status = "working";
      assertOk(await harness.invoke(slots[2].kind, slots[2].utc));
      assert.equal(harness.pushes.length, 1);
      harness.state.orders[0].status = finalStatus;
      assertOk(await harness.invoke(slots[3].kind, slots[3].utc));
      assert.equal(harness.pushes.length, 1, "finished or stopped work must not receive a later evening push");
      assert.equal(harness.claims.length, 1);
      assert.equal(harness.finishes.length, 1);
    });
  }
}

test("all slots reject missing or incorrect authorization before loading data or sending", async () => {
  for (const slot of slots) {
    for (const authorization of ["", "Bearer wrong-secret"]) {
      const harness = createHarness();
      const response = await harness.invoke(slot.kind, slot.utc, authorization);
      assert.equal(response.statusCode, 401);
      assert.equal(harness.pushes.length, 0);
      assert.equal(harness.requests.length, 0);
    }
  }
});

test("invalid or missing kinds send no push and do not access stored data", async () => {
  for (const kind of ["", "midday", "morning-late", "evening-late", "admin-test-early"]) {
    const harness = createHarness();
    const response = await harness.invoke(kind, slots[0].utc);
    assert.equal(response.statusCode, 400);
    assert.equal(harness.pushes.length, 0);
    assert.equal(harness.requests.length, 0);
  }
});

test("all four slots skip KST weekends, including the previous UTC date for 08:40", async () => {
  for (const day of ["2026-10-03", "2026-10-04"]) {
    for (const slot of slots) {
      const harness = createHarness();
      const response = await harness.invoke(slot.kind, `${day}T${slot.time}:00+09:00`);
      assertOk(response);
      assert.equal(response.body.skipped, "weekend");
      assert.equal(response.body.dateKey, day);
      assert.equal(harness.pushes.length, 0);
      assert.equal(harness.requests.length, 0);
    }
  }
});

test("admin-test remains administrator-only, bypasses slot deduplication, and uses one device", async () => {
  const harness = createHarness("admin");
  harness.subscriptions.push(
    { ...harness.subscriptions[0], id: "older-admin-device", endpoint: "https://push.invalid/older" },
    { ...harness.subscriptions[0], id: "worker-device", user_id: "worker-1", role: "production" }
  );
  for (let run = 1; run <= 2; run += 1) {
    const response = await harness.invoke("admin-test", "2026-10-03T09:00:00+09:00");
    assertOk(response);
    assert.equal(response.body.successCount, 1);
    assert.equal(harness.pushes.length, run);
    assert.equal(harness.pushes.at(-1).payload.kind, "admin-test");
    assert.equal(harness.pushes.at(-1).subscription.endpoint, harness.subscriptions[0].endpoint);
  }
  assert.equal(harness.claims.length, 0);
  assert.equal(harness.finishes.length, 0);
});

test("SQL schedules the four matching delivery kinds at the exact weekday UTC times", () => {
  const sql = fs.readFileSync(path.join(root, "supabase-push-notifications.sql"), "utf8")
    .replace(/--[^\r\n]*/g, "");
  const schedules = [...sql.matchAll(
    /\bcron\.schedule\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\$\$([\s\S]*?)\$\$\s*\)/gi
  )].map((match) => ({
    job: match[1], cron: match[2].trim().replace(/\s+/g, " "),
    kind: /\/api\/push-reminders\?kind=([^'\s]+)/.exec(match[3])?.[1]
  })).filter((schedule) => schedule.kind);
  assert.equal(schedules.length, 4, "exactly four reminder jobs must be scheduled");
  assert.equal(new Set(schedules.map(({ job }) => job)).size, 4, "each slot needs a distinct job");
  for (const slot of slots) {
    const matching = schedules.filter(({ kind }) => kind === slot.kind);
    assert.equal(matching.length, 1, `${slot.kind} must be scheduled exactly once`);
    assert.equal(matching[0].cron, slot.cron, `${slot.time} KST requires ${slot.cron} UTC`);
  }
});
