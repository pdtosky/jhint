const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert(appJs.includes("function createCompatibleRandomId"), "older iOS should have a UUID fallback");
assert(!/(?<!window\.)crypto\.randomUUID\(\)/.test(appJs), "business records should not call unsupported randomUUID directly");
assert(appJs.includes("function readBrowserStorage"), "auth storage reads should be guarded");
assert(appJs.includes("function writeBrowserStorage"), "auth storage writes should be guarded");
assert(appJs.includes("authMemoryStorage.set(key, value)"), "auth should keep working when Safari blocks both storages");
assert(appJs.includes("setSecurityAuthSubmitBusy(globalLoginForm, true)"), "login should expose a busy state");
assert(appJs.includes("로그인 처리 중 브라우저 오류가 발생했습니다."), "unexpected iOS login errors should be caught");
assert(appJs.includes("브라우저 로그인 세션을 복원하지 못했습니다."), "session restore errors should not stop app startup");

assert(indexHtml.includes("@supabase/supabase-js@2.112.4"), "Supabase browser dependency should use an exact version");
assert(indexHtml.includes("app.js?v=20260901-05"), "the app script should use the current cache version");
assert(indexHtml.includes("config.js?v=20260901-05"), "the config script should use the current cache version");

assert(swJs.includes('requestUrl.origin !== self.location.origin'), "the service worker should not cache third-party auth scripts");
assert(swJs.includes('event.request.mode === "navigate"'), "only page navigations should fall back to index.html");
assert(swJs.includes("return Response.error()"), "failed JavaScript requests should not receive HTML");

console.log("iOS auth compatibility test passed");
