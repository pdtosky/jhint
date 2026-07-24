const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("app.js", "utf8");
const deleteOrderBlock = source.slice(source.indexOf("async function deleteOrder"), source.indexOf("async function toggleOrderHold"));

assert.match(deleteOrderBlock, /const rollbackState = normalizeAppState\(state\)/, "delete should keep a rollback snapshot");
assert.match(deleteOrderBlock, /await persist\(\{ throwOnError: true \}\)/, "delete should wait for server save success");
assert.match(deleteOrderBlock, /assignNormalizedState\(rollbackState\)/, "delete should restore state when save fails");
assert.doesNotMatch(deleteOrderBlock, /await persist\(\);/, "delete should not treat a swallowed save error as success");

console.log("order delete persistence test passed");
