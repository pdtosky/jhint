const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert(indexHtml.includes('data-admin-section="logs"'), "admin page should include a logs tab");
assert(indexHtml.includes('data-admin-section="accounts"'), "admin page should include an account management tab");
assert(indexHtml.includes('data-admin-panel="logs"'), "admin page should include a logs panel");
assert(indexHtml.includes('data-admin-panel="accounts"'), "admin page should include an accounts panel");
assert(indexHtml.includes('id="adminLogList"'), "logs panel should render into adminLogList");
assert(indexHtml.includes('id="adminAccountList"'), "accounts panel should render into adminAccountList");
assert(indexHtml.includes('id="adminCreateUserForm"'), "accounts panel should include a create-user form");

assert(appJs.includes("const adminLogList"), "app.js should bind adminLogList");
assert(appJs.includes("function buildAdminLogEntries"), "app.js should build admin log entries");
assert(appJs.includes("function renderAdminLogs"), "app.js should render admin logs");
assert(appJs.includes("function renderAdminAccounts"), "app.js should render admin account management");
assert(appJs.includes("async function fetchAdminUsers"), "app.js should fetch users through the server API");
assert(appJs.includes("async function createAdminUser"), "app.js should create users through the server API");
assert(appJs.includes("async function deleteAdminUser"), "app.js should delete users through the server API");
assert(appJs.includes('"/api/admin-users"'), "app.js should call the admin users API route");
assert(!appJs.includes("SUPABASE_SERVICE_ROLE_KEY"), "service role key must never be referenced in browser code");

const apiPath = path.join(root, "api", "admin-users.js");
assert(fs.existsSync(apiPath), "api/admin-users.js should exist for safe server-side account management");
const apiSource = fs.readFileSync(apiPath, "utf8");
assert(apiSource.includes("SUPABASE_SERVICE_ROLE_KEY"), "API route should read the service role key from env only");
assert(apiSource.includes("/auth/v1/admin/users"), "API route should use Supabase Auth admin users endpoint");
assert(apiSource.includes("verifyAdminRequest"), "API route should verify the caller before admin actions");
assert(swJs.includes('pathname.startsWith("/api/")'), "service worker should not cache admin API responses");

const parsedPackage = JSON.parse(packageJson);
assert(
  parsedPackage.scripts.test.includes("tests/admin-tools.test.js"),
  "npm test should include the admin tools regression test"
);

console.log("admin tools test passed");
