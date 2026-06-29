const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert(
  appJs.includes("window.smartSopBridge"),
  "parent app should expose window.smartSopBridge for the embedded SOP module"
);

assert(
  appJs.includes('src="sop/index.html'),
  "renderSopPage should embed the Smart SOP module instead of rebuilding a separate lookup screen"
);

assert(
  !appJs.includes("sop-lite-notice"),
  "the temporary lookup-only SOP notice should be removed"
);

const sopIndexPath = path.join(root, "sop", "index.html");
const sopBridgePath = path.join(root, "sop", "bridge.js");
const sopAppPath = path.join(root, "sop", "app.js");
const sopStylesPath = path.join(root, "sop", "styles.css");

assert(fs.existsSync(sopIndexPath), "sop/index.html should exist");
assert(fs.existsSync(sopBridgePath), "sop/bridge.js should exist");
assert(fs.existsSync(sopAppPath), "sop/app.js should exist");
assert(fs.existsSync(sopStylesPath), "sop/styles.css should exist");

const sopIndex = fs.readFileSync(sopIndexPath, "utf8");
assert(
  sopIndex.indexOf("bridge.js") >= 0 && sopIndex.indexOf("bridge.js") < sopIndex.indexOf("app.js"),
  "sop/bridge.js should load before sop/app.js so API calls are intercepted"
);

assert(
  indexHtml.includes("작업표준서"),
  "main navigation should keep the 작업표준서 tab"
);

console.log("sop module embed test passed");
