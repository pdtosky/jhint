const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("app.js", "utf8");
const deleteOrderBlock = source.slice(source.indexOf("async function deleteOrder"), source.indexOf("async function toggleOrderHold"));

assert.match(deleteOrderBlock, /const rollbackState = normalizeAppState\(state\)/, "delete should keep a rollback snapshot");
assert.match(deleteOrderBlock, /await persist\(\{ throwOnError: true \}\)/, "delete should wait for server save success");
assert.match(deleteOrderBlock, /assignNormalizedState\(rollbackState\)/, "delete should restore state when save fails");
assert.match(deleteOrderBlock, /state\.orderDeletedIds = Array\.from\(new Set/, "delete should save a persistent order tombstone");
assert.match(deleteOrderBlock, /type: "orderDelete"/, "delete should append an audit log");
assert.doesNotMatch(
  deleteOrderBlock,
  /state\.activities = state\.activities\.filter/,
  "delete should preserve activity history so the shrink guard does not block the save"
);
assert.doesNotMatch(deleteOrderBlock, /await persist\(\);/, "delete should not treat a swallowed save error as success");

console.log("order delete persistence test passed");
