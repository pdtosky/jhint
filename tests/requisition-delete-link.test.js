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
const context = {};
vm.runInNewContext(
  `${extractFunction(source, "clearRequisitionLinkForDeletedOrder")}\nresult = clearRequisitionLinkForDeletedOrder;`,
  context
);

const clearRequisitionLinkForDeletedOrder = context.result;
const appState = {
  requisitions: [
    {
      id: "REQ-1",
      status: "converted",
      convertedAt: "2026-06-16T00:00:00.000Z",
      items: [
        {
          id: "ITEM-1",
          name: "샘플",
          status: "converted",
          orderId: "ORDER-1",
          convertedAt: "2026-06-16T00:00:00.000Z"
        },
        {
          id: "ITEM-2",
          name: "다른 샘플",
          status: "converted",
          orderId: "ORDER-2",
          convertedAt: "2026-06-16T00:00:00.000Z"
        }
      ]
    }
  ]
};

const deletedOrder = {
  id: "ORDER-1",
  sourceRequisitionId: "REQ-1",
  sourceRequisitionItemId: "ITEM-1"
};

const changed = clearRequisitionLinkForDeletedOrder(appState, deletedOrder);
assert.equal(changed, true);
assert.equal(appState.requisitions[0].items[0].orderId, "");
assert.equal(appState.requisitions[0].items[0].status, "");
assert.equal(appState.requisitions[0].items[0].convertedAt, "");
assert.equal(appState.requisitions[0].items[1].orderId, "ORDER-2");
assert.equal(appState.requisitions[0].status, "approved");

console.log("requisition delete link test passed");
