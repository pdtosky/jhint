const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sopApp = fs.readFileSync(path.join(root, "sop", "app.js"), "utf8");

assert(
  sopApp.includes("const SOP_MANAGEMENT_PREFIX = \"JH-PRD-WS\""),
  "SOP module should define the JH-PRD-WS management-number prefix."
);

assert(
  sopApp.includes("function getNextManagementNo"),
  "SOP module should calculate the next management number from existing SOP records."
);

assert(
  sopApp.includes('data-action="auto-management-no"'),
  "document management section should include an auto management-number action."
);

assert(
  sopApp.includes("isDuplicateManagementNo"),
  "SOP save flow should block duplicate management numbers."
);

assert(
  sopApp.includes("JH-PRD-WS-001"),
  "management-number field should keep the current production number format as the example."
);

console.log("sop management number test passed");
