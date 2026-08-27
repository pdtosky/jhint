const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert(appJs.includes('login: "로그인"'), "admin logs should label successful login events");
assert(appJs.includes('login: "account"'), "login events should use the account/security color tone");
assert(appJs.includes("async function recordSuccessfulLogin"), "successful login logging should have a dedicated function");
assert(appJs.includes('type: "login"'), "successful login should be stored as a login activity");
assert(appJs.includes('target: "생산일정관리"'), "login activity should identify the target system");
assert(appJs.includes("로그인 유지 ${rememberLogin ? \"사용\" : \"미사용\"}" ), "login activity should retain the persistence choice");

const loginStart = appJs.indexOf("async function handleGlobalLogin");
const recorderStart = appJs.indexOf("async function recordSuccessfulLogin", loginStart);
const loginBody = appJs.slice(loginStart, recorderStart);
assert(loginBody.includes("await initializeAppData();"), "remote state should load before a login event is appended");
assert(loginBody.includes("await recordSuccessfulLogin({"), "successful password login should append an operation log");
assert(
  loginBody.indexOf("await initializeAppData();") < loginBody.indexOf("await recordSuccessfulLogin({"),
  "login logging must happen only after the latest remote state is loaded"
);
assert(!appJs.slice(recorderStart, appJs.indexOf("async function handleGlobalSignup", recorderStart)).includes("password"), "login activities must never store passwords");
assert(swJs.includes("v20260827-01"), "service worker cache should include the latest update");

console.log("global auth login-log test passed");
