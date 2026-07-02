const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function extractFunction(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.lastIndexOf(marker);
  if (start < 0) {
    throw new Error(`${functionName} was not found in app.js`);
  }

  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  throw new Error(`${functionName} could not be extracted`);
}

const source = fs.readFileSync("app.js", "utf8");
const context = {
  Intl,
  Date,
  Number,
  String,
  RegExp,
  Object,
  Array,
  state: {
    activities: [
      {
        id: "ACT-END",
        type: "end",
        workerName: "Worker A",
        orderId: "ORDER-1",
        timestamp: "2026-07-01T23:25:00.000Z",
        message: "done"
      },
      {
        id: "ACT-START",
        type: "start",
        workerName: "Worker A",
        orderId: "ORDER-1",
        timestamp: "2026-07-01T00:30:00.000Z",
        message: "start"
      },
      {
        id: "ACT-PAUSE",
        type: "pause",
        workerName: "Worker A",
        orderId: "ORDER-1",
        timestamp: "2026-07-01T12:00:00.000Z",
        message: "pause"
      }
    ]
  },
  formatDateTime: (value) => value,
  escapeHtml: (value) => String(value || "")
};

vm.runInNewContext(
  [
    extractFunction(source, "getValidTimestamp"),
    extractFunction(source, "toKoreanDateKey"),
    extractFunction(source, "getOrderActivityTimestamps"),
    extractFunction(source, "getOrderLastPauseAt"),
    extractFunction(source, "getJournalDateKey"),
    extractFunction(source, "buildStartJournalRows"),
    "result = { toKoreanDateKey, getJournalDateKey, buildStartJournalRows };"
  ].join("\n"),
  context
);

const order = {
  id: "ORDER-1",
  company: "Company",
  product: "Product",
  dueDate: "2026-07-02",
  workerName: "Worker A",
  machineName: "Machine 1",
  status: "complete",
  startTime: "",
  endTime: "2026-07-01T23:25:00.000Z",
  productionQty: "61",
  totalHitQty: "61",
  elapsedMs: 9233000
};

const startRows = context.result.buildStartJournalRows(order);
const completeDate = context.result.getJournalDateKey(order);

assert.equal(context.result.toKoreanDateKey("2026-07-01T00:30:00.000Z"), "2026-07-01");
assert.equal(context.result.toKoreanDateKey("2026-07-01T23:25:00.000Z"), "2026-07-02");
assert.equal(startRows.length, 1);
assert.equal(startRows[0].date, "2026-07-01");
assert.equal(startRows[0].statusKey, "started");
assert.equal(startRows[0].countInTotals, false);
assert.equal(completeDate, "2026-07-02");

console.log("admin journal event dates test passed");
