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
  Map,
  Set,
  Array,
  JSON,
  String,
  normalizeAppState: (appState = {}) => ({
    orders: appState.orders || [],
    requisitions: appState.requisitions || [],
    sops: appState.sops || [],
    sopWorkRecords: appState.sopWorkRecords || [],
    sopDeletedIds: appState.sopDeletedIds || [],
    activities: appState.activities || []
  })
};

vm.runInNewContext(
  [
    extractFunction(source, "getStateRecordId"),
    extractFunction(source, "stringifyStateRecord"),
    extractFunction(source, "mapStateRecordsById"),
    extractFunction(source, "mergeStateArrayByLocalChanges"),
    extractFunction(source, "mergeStateByLocalChanges"),
    "result = { mergeStateByLocalChanges };"
  ].join("\n"),
  context
);

const previousState = {
  orders: [
    { id: "order-a", product: "Old Product", status: "ready" }
  ],
  requisitions: [],
  activities: []
};

const nextStateWithoutLocalOrderChange = {
  orders: [
    { id: "order-a", product: "Old Product", status: "ready" }
  ],
  requisitions: [],
  activities: [
    { id: "activity-local", type: "start", orderId: "order-a" }
  ]
};

const remoteStateWithNewerOrder = {
  orders: [
    { id: "order-a", product: "Old Product", status: "working", workerName: "Kim" },
    { id: "order-b", product: "Remote Product", status: "ready" }
  ],
  requisitions: [
    { id: "req-remote", company: "Remote Company" }
  ],
  activities: [
    { id: "activity-remote", type: "end", orderId: "order-b" }
  ]
};

const mergedWithoutLocalOrderChange = context.result.mergeStateByLocalChanges(
  previousState,
  nextStateWithoutLocalOrderChange,
  remoteStateWithNewerOrder
);

assert.equal(mergedWithoutLocalOrderChange.orders.length, 2);
assert.equal(mergedWithoutLocalOrderChange.orders.find((order) => order.id === "order-a").status, "working");
assert.equal(mergedWithoutLocalOrderChange.orders.find((order) => order.id === "order-a").workerName, "Kim");
assert.equal(mergedWithoutLocalOrderChange.requisitions.length, 1);
assert.equal(
  mergedWithoutLocalOrderChange.activities.map((activity) => activity.id).sort().join(","),
  "activity-local,activity-remote"
);

const nextStateWithLocalOrderChange = {
  orders: [
    { id: "order-a", product: "Locally Edited Product", status: "ready" }
  ],
  requisitions: [],
  activities: []
};

const mergedWithLocalOrderChange = context.result.mergeStateByLocalChanges(
  previousState,
  nextStateWithLocalOrderChange,
  remoteStateWithNewerOrder
);

assert.equal(mergedWithLocalOrderChange.orders.length, 2);
assert.equal(mergedWithLocalOrderChange.orders.find((order) => order.id === "order-a").product, "Locally Edited Product");
assert.equal(mergedWithLocalOrderChange.orders.find((order) => order.id === "order-b").product, "Remote Product");

const nextStateWithLocalDelete = {
  orders: [],
  requisitions: [],
  activities: []
};

const mergedWithLocalDelete = context.result.mergeStateByLocalChanges(
  previousState,
  nextStateWithLocalDelete,
  remoteStateWithNewerOrder
);

assert.equal(mergedWithLocalDelete.orders.some((order) => order.id === "order-a"), false);
assert.equal(mergedWithLocalDelete.orders.some((order) => order.id === "order-b"), true);

console.log("state merge conflict test passed");
