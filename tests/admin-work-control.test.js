const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert(appJs.includes("function canAdministratorControlWork"), "administrator work control should have an explicit permission check");
assert(appJs.includes('currentAdminRole === "admin"'), "only the administrator role should bypass worker ownership checks");
assert(
  appJs.includes('if (canAdministratorControlWork() && ["작업중지", "작업종료"].includes(actionLabel)) return true;'),
  "administrator should only bypass ownership for stop and completion actions"
);
assert(appJs.includes('selectedOrder?.workerName'), "administrator actions should preserve the assigned worker name");
assert(appJs.includes('performedByRole: administrativeActor ? "admin" : currentAdminRole'), "administrator work actions should be auditable");
assert(appJs.includes("관리자 작업중지"), "administrator should see a clear stop-work control");
assert(appJs.includes("관리자 완료처리"), "administrator should see a clear completion control");
assert(appJs.includes('["paused", "break"].includes(order.status)'), "administrator should be able to complete paused work safely");
assert.match(
  appJs,
  /function renderWorkerLiveStatus\(\)[\s\S]*?\.map\(\(order\) => \{[\s\S]*?const isAdministratorControl = canAdministratorControlWork\(\);/,
  "worker status cards should calculate administrator controls in their own render scope"
);
assert(styleCss.includes(".admin-work-control-btn"), "administrator work controls should be visually distinct");
assert(swJs.includes("v20260814-01"), "service worker cache should include the administrator work-control update");

console.log("admin work control test passed");
