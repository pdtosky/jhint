const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const names = [
  "renderAdminOverview", "buildEquipmentSummary", "renderEquipmentList",
  "getWorkNumberFromActivity", "buildJournalOrderRow", "buildPauseJournalRows", "buildStartJournalRows",
  "renderJournalSummary", "renderJournalList", "renderWorkerEfficiency"
];
const code = names.map((name) => {
  const start = source.lastIndexOf(`function ${name}(`);
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}).join("\n");
const hour = 3600000;
function makeOrder(extra = {}) {
  return { id: "order", company: "Company", product: "Product", workerName: "Worker", machineName: "Machine", status: "complete", productionQty: "100", totalHitQty: "20", elapsedMs: 2 * hour, endTime: "2026-09-30T01:00:00Z", ...extra };
}
function harness(orders) {
  const ctx = {
    state: { orders, activities: [] }, adminSearchKeyword: "", adminMonthFilter: "all", adminJournalDateFilter: "",
    adminOverview: {}, equipmentList: {}, journalSummary: {}, journalList: {}, workerEfficiencyList: {}, journalRows: [],
    getFilteredAdminMonthOrders: () => orders,
    getAdminMonthlyAvailableMs: () => 160 * hour,
    getAdminWorkingDayKeys: () => ["2026-09-30"],
    buildEquipmentDailyReport: () => [], getEquipmentReportMonthKey: () => "2026-09",
    isActiveWorkStatus: () => false, getAccumulatedElapsedMs: (order) => order.elapsedMs,
    getEquipmentUtilTone: () => ({ className: "tone", label: "label" }), getSortedOrders: (rows) => rows,
    renderEquipmentDetailRows: () => "", renderEquipmentMonthlyReport: () => {},
    formatElapsedMs: (ms) => `${ms}ms`, escapeHtml: (text) => String(text),
    getOrderLastPauseAt: () => "", getJournalDateKey: () => "2026-09-30",
    getOrderStatusTextClean: (order) => order.status, getOrderFirstWorkStartAt: () => "",
    formatDateTime: (date) => date, formatDate: (date) => date, getKoreanWeekday: () => "Wednesday",
    getValidTimestamp: (date) => date, toKoreanDateKey: () => "2026-09-30", getPauseReasonFromActivity: () => "pause",
    getFilteredProductionJournalRows: () => ctx.journalRows,
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

const pieces = makeOrder();
const metres = makeOrder({ id: "meters", quantityUnit: "m", productionQty: "10.5", elapsedMs: hour });
let ctx = harness([pieces, metres]);
ctx.renderAdminOverview();
assert.match(ctx.adminOverview.innerHTML, /100개 \/ 10\.5m/);
assert.doesNotMatch(ctx.adminOverview.innerHTML, /110\.5/);
const equipment = ctx.buildEquipmentSummary()[0];
assert.equal(equipment.productionQty, 100);
assert.equal(typeof equipment.productionQty, "number");
assert.equal(equipment.productionMeters, 10.5);
assert.equal(equipment.productionLabel, "100개 / 10.5m");
assert.equal(equipment.hitQty, 40);
assert.equal(equipment.actualMs, 3 * hour);
ctx.renderEquipmentList();
assert.match(ctx.equipmentList.innerHTML, /100개 \/ 10\.5m/);
ctx.renderWorkerEfficiency();
assert.match(ctx.workerEfficiencyList.innerHTML, /시간당 50개 \/ 10\.5m/);
assert.match(ctx.workerEfficiencyList.innerHTML, /생산 100개 \/ 10\.5m/);

const pieceRow = ctx.buildJournalOrderRow(pieces);
const meterRow = ctx.buildJournalOrderRow(metres);
assert.equal(pieceRow.quantityUnit, "ea");
assert.equal(pieceRow.qty, 100);
assert.equal(meterRow.quantityUnit, "m");
assert.equal(meterRow.qty, 10.5);
ctx.journalRows = [pieceRow, meterRow, { ...meterRow, qty: 999, countInTotals: false }];
ctx.renderJournalList();
assert.match(ctx.journalSummary.innerHTML, /100개 \/ 10\.5m/);
assert.match(ctx.journalList.innerHTML, /생산 100개 \/ 10\.5m/);
assert.match(ctx.journalList.innerHTML, />10\.5m<\/div>/);
assert.match(ctx.journalList.innerHTML, />100개<\/div>/);
assert.match(ctx.journalList.innerHTML, />999m<\/div>/);

for (const [message, expected] of [["작업수량 1,234.5678m / 작업타수 30", 1234.5678], ["작업수량 .5m", 0.5], ["작업수량 42개", 42], ["unrelated", 0]]) {
  assert.equal(ctx.getWorkNumberFromActivity({ message }, "작업수량"), expected);
}
const paused = makeOrder({ ...metres, status: "paused" });
ctx.state.activities = [
  { orderId: "meters", type: "pause", timestamp: "2026-09-30", message: "작업수량 10.5m / 작업타수 20" },
  { orderId: "meters", type: "temporaryPause", timestamp: "2026-09-30", message: "" },
  { orderId: "meters", type: "start", timestamp: "2026-09-30", message: "" },
];
const pauseRows = ctx.buildPauseJournalRows(paused);
assert.equal(pauseRows[0].quantityUnit, "m");
assert.equal(pauseRows[0].qty, 10.5);
assert.equal(pauseRows[0].hitQty, 20);
assert.equal(pauseRows[0].countInTotals, true);
assert.equal(pauseRows[1].quantityUnit, "m");
assert.equal(pauseRows[1].countInTotals, false);
assert.equal(ctx.buildStartJournalRows(paused)[0].quantityUnit, "m");
assert.equal(ctx.buildStartJournalRows(paused)[0].countInTotals, false);
ctx.state.activities[0].quantityUnit = "ea";
assert.equal(ctx.buildPauseJournalRows(paused)[0].quantityUnit, "ea");

ctx = harness([metres]);
ctx.renderAdminOverview();
ctx.renderEquipmentList();
ctx.renderWorkerEfficiency();
ctx.journalRows = [ctx.buildJournalOrderRow(metres)];
ctx.renderJournalList();
for (const output of [ctx.adminOverview, ctx.equipmentList, ctx.workerEfficiencyList, ctx.journalList, ctx.journalSummary]) {
  assert.match(output.innerHTML, /10\.5m/);
  assert.doesNotMatch(output.innerHTML, /개/);
}

ctx = harness([pieces]);
assert.equal(ctx.buildEquipmentSummary()[0].productionQty, 100);
assert.equal(ctx.buildEquipmentSummary()[0].productionMeters, 0);
ctx.renderWorkerEfficiency();
assert.match(ctx.workerEfficiencyList.innerHTML, /시간당 50개/);
assert.doesNotMatch(ctx.workerEfficiencyList.innerHTML, /작업시간순/);
ctx.renderJournalSummary([{ ...pieceRow, quantityUnit: undefined }]);
assert.match(ctx.journalSummary.innerHTML, /100개/);

ctx = harness([makeOrder({ quantityUnit: "m", productionQty: "0.1" }), makeOrder({ quantityUnit: "m", productionQty: "0.2" })]);
ctx.renderAdminOverview();
assert.match(ctx.adminOverview.innerHTML, />0\.3m</);
assert.equal(ctx.buildEquipmentSummary()[0].productionLabel, "0.3m");
ctx.renderJournalSummary([{ ...meterRow, qty: 0.1 }, { ...meterRow, qty: 0.2 }]);
assert.match(ctx.journalSummary.innerHTML, />0\.3m</);

ctx = harness([]);
ctx.renderAdminOverview();
assert.match(ctx.adminOverview.innerHTML, />0개</);
assert.equal(ctx.buildEquipmentSummary().length, 0);
console.log("production quantity units tests passed");
