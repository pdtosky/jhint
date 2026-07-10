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
assert(appJs.includes('currentAdminRole === "production"'), "automatic worker identity should be limited to production accounts");
assert(appJs.includes("workerNameInput.readOnly = shouldLockWorkerName"), "registered worker identity should not be editable");
assert(appJs.includes('globalLogoutBtn?.addEventListener("click"'), "global logout button should end the current session");
assert(appJs.includes('setSecurityAuthMessage("로그아웃되었습니다.", "success")'), "logout should return a clear login-screen message");

assert(styleCss.includes(".global-session-bar"), "common session controls should have a responsive layout");
assert(styleCss.includes(".worker-form input.account-identity-input"), "automatic worker identity should be visually distinct");
assert(swJs.includes("v20260710-09"), "service worker cache should include the worker-session update");

console.log("worker account session test passed");
