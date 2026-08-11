const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sopApp = fs.readFileSync(path.join(root, "sop", "app.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert(
  sopApp.includes('data-action="new-sop"') && sopApp.includes("async function startNewSopDocument"),
  "SOP editor should expose an explicit new-document action."
);
assert(
  sopApp.includes("createNewSopDraft(nextManagementNo)"),
  "Auto management-number action should clear the persisted document identity before starting the next SOP."
);
assert(
  sopApp.includes("const managementNoChanged = persistedRecord") &&
    sopApp.includes('currentSop = hydrateSop({ ...currentSop, id: "", createdAt: "" })'),
  "Save flow should convert a changed management number into a new SOP instead of overwriting the existing record."
);
assert(
  appJs.includes('version: "2026-07-21-01"'),
  "Codex release notes should include the SOP overwrite fix."
);
assert(
  swJs.includes("jhint-production-app-v20260811-01"),
  "Service worker cache should be bumped for the latest update."
);

console.log("sop new document overwrite protection test passed");
