const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("app.js", "utf8");

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

console.log("state persistence safety test passed");
