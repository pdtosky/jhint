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

console.log("state persistence safety test passed");
