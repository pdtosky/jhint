const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("app.js", "utf8");

function extractFunction(functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const signatureEnd = source.indexOf(") {", start);
  assert.notEqual(signatureEnd, -1, `${functionName} signature should be complete`);
  const braceStart = signatureEnd + 2;
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} could not be extracted`);
}

assert.ok(
  !source.includes("prepareSupabaseStateForSave(nextState).catch(() => nextState)"),
  "Supabase merge failures must not fall back to saving a stale local state."
);

assert.ok(
  !/catch\s*\{\s*applyIncomingState\(createEmptyState\(\)\);?\s*\}/.test(source),
  "Remote load failures must not apply and persist an empty state."
);

assert.ok(
  source.includes("STATE_SHRINK_BLOCKED"),
  "Saving should include a guard against unexpectedly shrinking remote state."
);

assert.ok(
  source.includes("REMOTE_STATE_NOT_READY"),
  "Saving should be blocked until the latest remote state has been loaded successfully."
);

assert.ok(
  source.includes("STATE_SHRINK_RULES"),
  "State shrink protection should use explicit per-collection safety rules."
);

assert.ok(
  /requisitions:\s*\{[^}]*maxAllowedDrop:\s*0/s.test(source),
  "Requisition records should not be allowed to disappear during normal browser saves."
);

assert.ok(
  /activities:\s*\{[^}]*maxAllowedDrop:\s*0/s.test(source),
  "Activity logs should not be allowed to shrink during normal browser saves."
);

assert.ok(
  source.includes("isOrderDropCoveredByTombstones(nextState, remoteState)"),
  "Intentional order deletions should be allowed only when a persistent tombstone explains the drop."
);

const tombstoneContext = {
  Set,
  normalizeAppState: (appState = {}) => {
    const deletedIds = new Set(appState.orderDeletedIds || []);
    return {
      orders: (appState.orders || []).filter((order) => !deletedIds.has(order.id)),
      orderDeletedIds: appState.orderDeletedIds || []
    };
  }
};
vm.runInNewContext(
  `${extractFunction("isOrderDropCoveredByTombstones")}\nresult = isOrderDropCoveredByTombstones;`,
  tombstoneContext
);

assert.equal(
  tombstoneContext.result(
    { orders: [], orderDeletedIds: ["order-1"] },
    { orders: [{ id: "order-1" }], orderDeletedIds: [] }
  ),
  true,
  "a tombstoned order should be recognized as an intentional deletion"
);
assert.equal(
  tombstoneContext.result(
    { orders: [], orderDeletedIds: [] },
    { orders: [{ id: "order-1" }], orderDeletedIds: [] }
  ),
  false,
  "an unexplained order wipe should remain blocked"
);

console.log("state persistence safety test passed");
