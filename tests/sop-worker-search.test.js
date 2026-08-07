const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const sopApp = fs.readFileSync(path.join(root, "sop", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "sop", "styles.css"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert(sopApp.includes("workerSearchResults"), "Worker search should keep the current candidate list for selection.");
assert(sopApp.includes("renderWorkerSearchResults"), "Worker search should render candidates before detailed SOP content.");
assert(sopApp.includes('data-action=\"select-worker-sop\"'), "Worker search candidates should be selectable.");
assert(sopApp.includes('data-action=\"back-worker-search\"'), "Detailed worker SOP view should provide a return action.");
assert(sopApp.includes("renderWorker([sop], { detail: true })"), "Selecting a candidate should open only its detailed SOP.");
assert(styles.includes(".worker-search-candidate"), "Worker search candidates should have a compact visual layout.");
assert(styles.includes(".worker-result-toolbar"), "Worker search should have a clear result/detail toolbar.");
assert(appJs.includes('version: "2026-07-21-04"'), "Codex release notes should include the worker search improvement.");
assert(packageJson.includes("tests/sop-worker-search.test.js"), "The worker search regression test should run in the test suite.");

console.log("sop worker search test passed");
