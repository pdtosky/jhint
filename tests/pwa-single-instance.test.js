const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert.equal(manifest.display, "standalone", "production schedule should remain an installed standalone app");
assert.deepEqual(
  manifest.launch_handler,
  { client_mode: "focus-existing" },
  "relaunching the installed app should focus the existing window instead of opening a duplicate"
);
assert(
  indexHtml.includes('manifest.webmanifest?v=20260827-01'),
  "the page should request the updated manifest instead of a cached copy"
);
assert(swJs.includes("jhint-production-app-v20260831-01"), "the service worker cache should refresh for this release");

console.log("pwa single-instance test passed");
