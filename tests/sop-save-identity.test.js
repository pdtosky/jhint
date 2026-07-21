const assert = require("assert");
const path = require("path");

const { inspectSopSaveIdentity } = require(path.join(__dirname, "..", "sop", "identity.js"));

const records = [
  { id: "sop-a", document: { managementNo: "JH-PRD-WS-001" }, basic: { product: "기존 제품" } }
];

assert.deepStrictEqual(
  inspectSopSaveIdentity({ id: "sop-a", document: { managementNo: "JH-PRD-WS-001" } }, records).mode,
  "update",
  "same id and management number should update the existing SOP"
);
assert.strictEqual(
  inspectSopSaveIdentity({ id: "sop-a", document: { managementNo: "JH-PRD-WS-002" } }, records).reason,
  "management-number-changed",
  "an old client must not overwrite an existing SOP after changing its management number"
);
assert.strictEqual(
  inspectSopSaveIdentity({ document: { managementNo: "JH-PRD-WS-001" } }, records).reason,
  "duplicate-management-number",
  "a new SOP must not reuse an existing management number"
);
assert.strictEqual(
  inspectSopSaveIdentity({ document: { managementNo: "JH-PRD-WS-002" } }, records).mode,
  "create",
  "a new unique management number should create a separate SOP"
);
assert.strictEqual(records[0].basic.product, "기존 제품", "identity checks must not mutate existing SOP data");

console.log("sop save identity test passed");
