const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function extractFunction(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
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
  state: {
    activities: [
      { orderId: "ORDER-1", type: "end", timestamp: "2026-06-22T10:10:00.000Z" },
      { orderId: "ORDER-1", type: "start", timestamp: "2026-06-22T08:30:00.000Z" },
      { orderId: "ORDER-1", type: "end", timestamp: "2026-06-22T09:15:00.000Z" },
      { orderId: "ORDER-1", type: "start", timestamp: "2026-06-22T07:45:00.000Z" }
    ]
  }
};

vm.runInNewContext(
  [
    extractFunction(source, "getValidTimestamp"),
    extractFunction(source, "getOrderActivityTimestamps"),
    extractFunction(source, "getOrderFirstWorkStartAt"),
    extractFunction(source, "getOrderLastWorkEndAt"),
    extractFunction(source, "formatDetailDateTime"),
    "result = { getOrderFirstWorkStartAt, getOrderLastWorkEndAt, formatDetailDateTime };"
  ].join("\n"),
  context
);

const { getOrderFirstWorkStartAt, getOrderLastWorkEndAt, formatDetailDateTime } = context.result;
const order = {
  id: "ORDER-1",
  startTime: "2026-06-22T08:00:00.000Z",
  endTime: "2026-06-22T10:05:00.000Z"
};

assert.equal(getOrderFirstWorkStartAt(order), "2026-06-22T07:45:00.000Z");
assert.equal(getOrderLastWorkEndAt(order), "2026-06-22T10:10:00.000Z");
assert.match(formatDetailDateTime(getOrderFirstWorkStartAt(order)), /^2026\. 06\. 22\. \d{2}:\d{2}$/);
assert.equal(formatDetailDateTime(""), "-");

console.log("calendar work datetime test passed");
