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
assert(sopApp.includes("loadWorkerCatalog"), "Worker view should load the published SOP catalog without requiring a search.");
assert(sopApp.includes("renderWorkerCatalogCard"), "Worker view should render a compact card for each published SOP.");
assert(sopApp.includes("작성된 작업표준서 ${sops.length}건"), "Worker catalog should show how many SOPs have been written.");
assert(sopApp.includes('data-action=\"select-worker-sop\"'), "Worker search candidates should be selectable.");
assert(sopApp.includes('data-action=\"back-worker-search\"'), "Detailed worker SOP view should provide a return action.");
assert(sopApp.includes("renderWorker([sop], { detail: true })"), "Selecting a candidate should open only its detailed SOP.");
assert(styles.includes(".worker-search-candidate"), "Worker search candidates should have a compact visual layout.");
assert(styles.includes(".worker-result-toolbar"), "Worker search should have a clear result/detail toolbar.");
assert(styles.includes(".worker-catalog-grid"), "Worker catalog should use a responsive card grid.");
assert(styles.includes(".worker-catalog-card"), "Worker catalog cards should have a dedicated compact layout.");
assert(appJs.includes('version: "2026-08-11-01"'), "Codex release notes should include the worker catalog improvement.");
assert(packageJson.includes("tests/sop-worker-search.test.js"), "The worker search regression test should run in the test suite.");

console.log("sop worker search test passed");
