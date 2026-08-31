const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const sopApp = fs.readFileSync(path.join(root, "sop", "app.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert(sopApp.includes('data-action="copy-sop"'), "SOP search results should offer copy-as-new-document.");
assert(sopApp.includes('data-action="copy-current-sop"'), "The active SOP should offer copy-as-new-document.");
assert(sopApp.includes("async function copyAdminSop"), "SOP copy action should load the selected source document.");
assert(sopApp.includes("async function startSopCopy"), "SOP copy action should prepare a new draft.");
assert(sopApp.includes('copied.id = ""'), "Copied SOPs must receive a new server identity when saved.");
assert(/managementNo,\s+rev: "0"/.test(sopApp), "Copied SOPs must receive a new management number and revision baseline.");
assert(sopApp.includes('status: "임시저장"'), "Copied SOPs must start as an editable temporary draft.");
assert(sopApp.includes('copied.revisionHistory = [blankRow("revisionHistory")]'), "Copied SOPs must start a fresh revision history.");
assert(appJs.includes('version: "2026-07-21-03"'), "Codex release notes should retain the SOP copy update.");
assert(swJs.includes("jhint-production-app-v20260901-01"), "Service worker cache should be bumped for the latest update.");
assert(packageJson.includes("tests/sop-copy.test.js"), "The SOP copy regression test should run in the test suite.");

console.log("sop copy test passed");
