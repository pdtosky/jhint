const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractActiveFunction(name) {
  const matches = [...appJs.matchAll(new RegExp(`^function ${name}\\b`, "gm"))];
  assert(matches.length, `${name} should exist`);
  const start = matches[matches.length - 1].index;
  const end = appJs.indexOf("\n}", start);
  assert(end > start, `${name} should have a complete body`);
  return appJs.slice(start, end + 2);
}

const clockSource = [
  "startDashboardClock", "getLiveWorkTimeText", "renderLiveWorkTime",
  "updateVisibleWorkTimes", "getWorkTimeLabel", "getCleanWorkTimeValue",
  "getAccumulatedElapsedMs", "formatElapsedMs", "escapeHtml"
].map(extractActiveFunction).join("\n");

function forbidRebuild(target) {
  Object.defineProperty(target, "innerHTML", {
    get() { throw new Error("clock must not read innerHTML"); },
    set() { throw new Error("clock must not rebuild DOM"); }
  });
  target.addEventListener = () => { throw new Error("clock must not rebind listeners"); };
  return target;
}

function makeTimeNode(id, label = "value", initial = "unchanged") {
  let text = initial;
  return forbidRebuild({
    dataset: { liveWorkTimeOrderId: id, liveWorkTimeLabel: label },
    writes: 0,
    get textContent() { return text; },
    set textContent(value) { this.writes += 1; text = value; }
  });
}

function createFixture() {
  let now = Date.parse("2026-10-27T01:01:02Z");
  const nodes = {
    progress: [makeTimeNode("running")],
    snapshot: [makeTimeNode("running")],
    worker: [makeTimeNode("running", "full"), makeTimeNode("break"), makeTimeNode("paused"), makeTimeNode("complete"), makeTimeNode("missing"), makeTimeNode("no-start")],
    calendar: [makeTimeNode("running")]
  };
  const queried = [];
  const root = (name) => forbidRebuild({
    querySelectorAll(selector) {
      assert.equal(selector, "[data-live-work-time-order-id]");
      queried.push(name);
      return nodes[name];
    }
  });
  const orders = [
    { id: "running", status: "working", startTime: "2026-10-27T01:00:00Z", elapsedMs: 1000 },
    { id: "break", status: "break", startTime: "", elapsedMs: 2000 },
    { id: "paused", status: "paused", startTime: "", elapsedMs: 3000 },
    { id: "complete", status: "complete", startTime: "", elapsedMs: 4000 },
    { id: "no-start", status: "working", startTime: "", elapsedMs: 5000 }
  ];
  let orderReads = 0;
  const state = {};
  Object.defineProperty(state, "orders", { get() { orderReads += 1; return orders; } });
  Object.defineProperty(state, "activities", { get() { throw new Error("clock must not scan history"); } });
  const intervals = new Map();
  const cleared = [];
  let intervalId = 0;
  const context = {
    state, document: { visibilityState: "visible" }, isAdminLoggedIn: true,
    activeViewId: "workerView", isDashboardProgressOpen: false,
    progressBoard: root("progress"), workerSnapshotBoard: root("snapshot"),
    workerLiveStatus: root("worker"), calendarDetailBody: root("calendar"),
    calendarDetailModal: { hidden: true }, selectedCalendarDateKey: "2026-10-27",
    dashboardTimerId: null,
    getActiveViewId() { return context.activeViewId; },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
    },
    formatDateTime(value) { return `formatted:${value}`; },
    setInterval(callback, delay) { intervals.set(++intervalId, { callback, delay }); return intervalId; },
    clearInterval(id) { cleared.push(id); intervals.delete(id); }
  };
  for (const name of ["renderProgress", "renderDashboardFilteredList", "renderWorkerSnapshotBoard", "renderWorkerLiveStatus", "renderCalendarDetail", "normalizeAppState", "getSortedOrders"]) {
    context[name] = () => { throw new Error(`${name} must not run during a tick`); };
  }
  vm.createContext(context);
  vm.runInContext(clockSource, context);
  return { context, nodes, orders, queried, intervals, cleared,
    orderReads: () => orderReads,
    advance: (ms) => { now += ms; },
    tick: () => context.updateVisibleWorkTimes()
  };
}

const fullLabel = "\uC791\uC5C5\uC2DC\uAC04 00:01:03";

{
  const f = createFixture();
  const controls = [{ action: "pause" }, { action: "complete" }];
  f.context.workerLiveStatus.controls = controls;
  f.tick();
  assert.deepEqual(f.queried, ["worker"]);
  assert.equal(f.nodes.worker[0].textContent, fullLabel);
  assert.equal(f.orderReads(), 1, "index orders once, not once per visible time");
  for (const node of f.nodes.worker.slice(1)) assert.equal(node.writes, 0, "non-running or deleted work must not tick");
  assert.equal(f.nodes.progress[0].writes + f.nodes.snapshot[0].writes + f.nodes.calendar[0].writes, 0);
  f.tick();
  assert.equal(f.nodes.worker[0].writes, 1, "identical time text should not be written again");
  f.advance(1000);
  f.tick();
  assert.equal(f.nodes.worker[0].textContent, fullLabel.replace("03", "04"));
  assert.strictEqual(f.context.workerLiveStatus.controls, controls, "controls must retain identity");
  f.orders[0] = { ...f.orders[0], elapsedMs: 11000 };
  f.tick();
  assert.equal(f.nodes.worker[0].textContent, fullLabel.replace("03", "14"), "use current state, not captured order objects");
}

for (const [view, expanded, expected] of [
  ["dashboardView", false, ["snapshot"]],
  ["dashboardView", true, ["progress", "snapshot"]],
  ["ordersView", false, []], ["adminView", false, []], ["sopView", false, []]
]) {
  const f = createFixture();
  f.context.activeViewId = view;
  f.context.isDashboardProgressOpen = expanded;
  f.tick();
  assert.deepEqual(f.queried, expected);
  assert.equal(f.orderReads(), expected.length ? 1 : 0);
  for (const name of expected) assert.equal(f.nodes[name][0].textContent, "00:01:03");
}

{
  const f = createFixture();
  f.context.activeViewId = "ordersView";
  f.context.calendarDetailModal.hidden = false;
  f.tick();
  assert.deepEqual(f.queried, ["calendar"], "open calendar detail ticks independently of the active panel");
  assert.equal(f.nodes.calendar[0].textContent, "00:01:03");
  f.queried.length = 0;
  f.context.selectedCalendarDateKey = "";
  f.tick();
  assert.deepEqual(f.queried, []);
}

for (const condition of ["hidden", "logged-out"]) {
  const f = createFixture();
  f.context.calendarDetailModal.hidden = false;
  if (condition === "hidden") f.context.document.visibilityState = "hidden";
  else f.context.isAdminLoggedIn = false;
  f.tick();
  assert.deepEqual(f.queried, []);
  assert.equal(f.orderReads(), 0, "hidden/logged-out ticks must not read application data");
}

{
  const f = createFixture();
  f.nodes.worker.length = 0;
  f.tick();
  assert.equal(f.orderReads(), 0, "no time spans means no state scan");
  f.context.startDashboardClock();
  f.context.startDashboardClock();
  assert.deepEqual(f.cleared, [1]);
  assert.equal(f.intervals.size, 1, "restarting the clock must not multiply callbacks");
  const interval = [...f.intervals.values()][0];
  assert.equal(interval.delay, 1000);
  assert.strictEqual(interval.callback, f.context.updateVisibleWorkTimes);
}

{
  const f = createFixture();
  const samples = [...f.orders, { id: "ready", status: "ready" }, { id: "dated", status: "ready", startTime: "2026-10-27T01:00:00Z" }];
  for (const order of samples) {
    assert.equal(f.context.getLiveWorkTimeText(order, true), f.context.getWorkTimeLabel(order), "full labels must remain unchanged");
    assert.equal(f.context.getLiveWorkTimeText(order), f.context.getCleanWorkTimeValue(order) || "-", "compact labels must remain unchanged");
    for (const full of [false, true]) {
      const html = f.context.renderLiveWorkTime(order, full);
      assert(html.includes(`data-live-work-time-label="${full ? "full" : "value"}"`));
      assert(html.endsWith(`>${f.context.escapeHtml(f.context.getLiveWorkTimeText(order, full))}</span>`));
    }
  }
  assert(f.context.renderLiveWorkTime({ id: 'a"<>&', status: "ready" }).includes('data-live-work-time-order-id="a&quot;&lt;&gt;&amp;"'));
}

for (const [name, marker] of [
  ["renderWorkerSnapshotBoard", "renderLiveWorkTime(order)"],
  ["renderProgressMetaGrid", "renderLiveWorkTime(order)"],
  ["renderCalendarDetail", "renderLiveWorkTime(order)"],
  ["renderWorkerLiveStatus", "renderLiveWorkTime(order, true)"]
]) {
  assert(extractActiveFunction(name).includes(marker), `${name}: final active renderer must expose a dedicated time span`);
}
assert(appJs.includes("renderProgress = renderDashboardProgressCollapsedOverride;"));
assert(extractActiveFunction("renderDashboardProgressCollapsedOverride").includes("renderProgressMetaGrid(order)"));

console.log("live clock test passed");
