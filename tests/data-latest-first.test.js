const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

const orderSortStart = appJs.indexOf("function getSortedOrders");
const orderSortEnd = appJs.indexOf("function getScheduleSortedOrders", orderSortStart);
const orderSortBody = appJs.slice(orderSortStart, orderSortEnd);

assert(orderSortStart >= 0 && orderSortEnd > orderSortStart, "the shared order sorter should exist");
assert(
  orderSortBody.includes("getOrderLatestSortTime(right) - getOrderLatestSortTime(left)"),
  "orders should show the latest registered or updated data first"
);
assert(!orderSortBody.includes("leftDue - rightDue"), "orders should no longer show the oldest due date first");
assert(
  appJs.includes("getRequisitionLatestSortTime(right) - getRequisitionLatestSortTime(left)"),
  "requisitions should show the latest request first"
);
assert(
  appJs.includes("getSortableTimestamp(right.createdAt) - getSortableTimestamp(left.createdAt)"),
  "account management should show the latest account first"
);
assert(
  appJs.includes("getSortableTimestamp(right.createdAt) - getSortableTimestamp(left.createdAt)"),
  "shipment history should show the latest shipment first"
);
assert(
  appJs.includes("getScheduleSortedOrders(state.orders.filter"),
  "worker order selection should retain due-date priority"
);
assert(
  appJs.includes("const latestActivity = getLatestOrderActivity(order.id)"),
  "work history should resolve the latest activity by timestamp"
);
assert(appJs.includes('version: "2026-09-02-01"'), "the latest-first change should be recorded in the admin log");
assert(swJs.includes("jhint-production-app-v20260902-01"), "the service worker should publish the latest sorting update");

function extractFunction(name) {
  const start = appJs.indexOf(`function ${name}`);
  assert(start >= 0, `${name} should exist`);
  const parameterStart = appJs.indexOf("(", start);
  let parameterDepth = 0;
  let parameterEnd = -1;
  for (let index = parameterStart; index < appJs.length; index += 1) {
    if (appJs[index] === "(") parameterDepth += 1;
    if (appJs[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      parameterEnd = index;
      break;
    }
  }
  const braceStart = appJs.indexOf("{", parameterEnd);
  let depth = 0;
  for (let index = braceStart; index < appJs.length; index += 1) {
    if (appJs[index] === "{") depth += 1;
    if (appJs[index] === "}") depth -= 1;
    if (depth === 0) return appJs.slice(start, index + 1);
  }
  throw new Error(`${name} could not be extracted`);
}

const sortingContext = {
  state: {
    activities: [
      { orderId: "old-edited", type: "register", timestamp: "2026-09-02T02:00:00Z" },
      { orderId: "new", type: "register", timestamp: "2026-09-01T02:00:00Z" }
    ]
  },
  result: null
};
vm.createContext(sortingContext);
vm.runInContext([
  extractFunction("getSortableTimestamp"),
  extractFunction("getOrderLatestSortTime"),
  extractFunction("getSortedOrders"),
  extractFunction("getScheduleSortedOrders"),
  `result = {
    latest: getSortedOrders([
      { id: "new", orderDate: "2026-09-01", dueDate: "2026-09-03" },
      { id: "old-edited", orderDate: "2026-08-01", dueDate: "2026-09-10" },
      { id: "old", orderDate: "2026-07-01", dueDate: "2026-09-02" }
    ]).map((item) => item.id),
    schedule: getScheduleSortedOrders([
      { id: "new", orderDate: "2026-09-01", dueDate: "2026-09-03" },
      { id: "old-edited", orderDate: "2026-08-01", dueDate: "2026-09-10" },
      { id: "old", orderDate: "2026-07-01", dueDate: "2026-09-02" }
    ]).map((item) => item.id)
  };`
].join("\n"), sortingContext);

assert.deepEqual(Array.from(sortingContext.result.latest), ["old-edited", "new", "old"]);
assert.deepEqual(Array.from(sortingContext.result.schedule), ["old", "new", "old-edited"]);

console.log("data latest-first test passed");
