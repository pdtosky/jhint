const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert(indexHtml.includes('id="globalSessionBar"'), "logged-in users should have a common session bar");
assert(indexHtml.includes('id="globalLogoutBtn"'), "all roles should have a visible logout button");
assert(indexHtml.includes('id="workerNameInput"'), "worker-name input should have a stable identity hook");
assert(indexHtml.includes('id="workerAccountNameHelp"'), "worker-name auto-fill should explain its source");

assert(appJs.includes("function getSessionDisplayName"), "Supabase display name should be normalized for UI use");
assert(appJs.includes("async function getFreshSessionUser"), "account metadata should be refreshed from Supabase after login and session restore");
assert(appJs.includes("supabaseAuthClient.auth.getUser()"), "latest user metadata should come from the authenticated Supabase user endpoint");
assert(
  appJs.includes('const canUseWorkerInput = isAdminLoggedIn && canAccessView("workerView")'),
  "automatic worker identity should apply to every signed-in account that can use worker input"
);
assert(
  appJs.includes("if (currentAdminDisplayName) {") && appJs.includes("workerNameInput.value = currentAdminDisplayName"),
  "registered account names should be copied into the worker-name field"
);
assert(
  appJs.includes('workerNameInput.value = accountWorkerName || order.workerName || ""'),
  "selecting an existing work item should not replace the signed-in account name"
);
assert(
  (appJs.match(/syncWorkerAccountIdentity\(\);/g) || []).length >= 5,
  "worker identity should be reapplied before start, pause, temporary pause, and completion actions"
);
assert(
  appJs.includes('!["ready", "paused", "break"].includes(order.status)'),
  "paused work should remain restartable"
);
assert(
  appJs.includes('nextStatus === "working" && isTemporarilyPaused(order)'),
  "same-worker and same-machine restrictions should apply only to temporary pauses"
);
assert(
  appJs.includes("다른 작업자도 자신의 로그인 계정으로 이어서 시작할 수 있습니다."),
  "paused work should explain that another signed-in worker can take over"
);
assert(appJs.includes("function canCurrentWorkerControlActiveOrder"), "active work controls should verify the current worker");
assert(
  appJs.includes('canCurrentWorkerControlActiveOrder(order, workerName, "작업중지")') &&
    appJs.includes('canCurrentWorkerControlActiveOrder(order, workerName, "일시정지")') &&
    appJs.includes('canCurrentWorkerControlActiveOrder(order, workerName, "작업종료")'),
  "another worker must not pause, temporarily pause, or complete someone else's active work"
);
assert(appJs.includes("machineName: activity.machineName || order.machineName"), "pause journal rows should keep the machine used at pause time");
assert(appJs.includes("workerNameInput.readOnly = shouldLockWorkerName"), "registered worker identity should not be editable");
assert(appJs.includes('globalLogoutBtn?.addEventListener("click"'), "global logout button should end the current session");
assert(appJs.includes('setSecurityAuthMessage("로그아웃되었습니다.", "success")'), "logout should return a clear login-screen message");

assert(styleCss.includes(".global-session-bar"), "common session controls should have a responsive layout");
assert(styleCss.includes(".worker-form input.account-identity-input"), "automatic worker identity should be visually distinct");
assert(swJs.includes("v20260710-14"), "service worker cache should include the latest active-work ownership update");

console.log("worker account session test passed");
