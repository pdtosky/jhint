const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert(indexHtml.includes('id="globalRememberLogin"'), "login form should include a remember-login checkbox");
assert(indexHtml.includes('name="rememberLogin"'), "remember-login choice should be submitted with the login form");
assert(indexHtml.includes("개인 휴대폰이나 개인 컴퓨터에서만 선택해 주세요."), "shared-device warning should be visible");

assert(appJs.includes('const AUTH_REMEMBER_KEY = "production-auth-remember-v1"'), "remember-login preference should have a stable key");
assert(appJs.includes("function createSupabaseAuthStorage"), "Supabase auth should use a selectable storage adapter");
assert(appJs.includes("shouldRememberLogin() ? window.localStorage : window.sessionStorage"), "persistent and current-tab storage should be selected explicitly");
assert(appJs.includes("setAuthPersistencePreference(rememberLogin)"), "login should apply the selected persistence before signing in");
assert(appJs.includes("window.localStorage.removeItem(key)"), "logout should be able to remove persistent sessions");
assert(appJs.includes("window.sessionStorage.removeItem(key)"), "logout should be able to remove current-tab sessions");

assert(styleCss.includes(".security-remember-option"), "remember-login option should have a dedicated compact layout");
assert(swJs.includes("v20260724-02"), "service worker cache should include the latest update");

console.log("global auth remember-login test passed");
