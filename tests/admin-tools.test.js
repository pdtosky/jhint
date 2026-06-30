const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert(indexHtml.includes('data-admin-section="logs"'), "admin page should include a logs tab");
assert(indexHtml.includes('data-admin-section="accounts"'), "admin page should include an account management tab");
assert(indexHtml.includes('class="tab-btn active" data-admin-section="accounts"'), "account management tab should be the initial active admin tab");
assert(!indexHtml.includes('class="tab-btn active" data-admin-section="overview"'), "overview tab should not be the initial active admin tab");
assert(indexHtml.includes('data-admin-panel="logs"'), "admin page should include a logs panel");
assert(indexHtml.includes('data-admin-panel="accounts"'), "admin page should include an accounts panel");
assert(indexHtml.includes('id="adminLogList"'), "logs panel should render into adminLogList");
assert(indexHtml.includes('id="adminAccountList"'), "accounts panel should render into adminAccountList");
assert(indexHtml.includes('id="adminCreateUserForm"'), "accounts panel should include a create-user form");

assert(appJs.includes("const adminLogList"), "app.js should bind adminLogList");
assert(appJs.includes("function buildAdminLogEntries"), "app.js should build admin log entries");
assert(appJs.includes("function renderAdminLogs"), "app.js should render admin logs");
assert(appJs.includes("function renderAdminAccounts"), "app.js should render admin account management");
const renderAdminAccountsStart = appJs.indexOf("function renderAdminAccounts");
const nextAdminAccountsFunction = appJs.indexOf("function getShortAdminUserId", renderAdminAccountsStart);
const renderAdminAccountsBody = appJs.slice(renderAdminAccountsStart, nextAdminAccountsFunction);
assert(!renderAdminAccountsBody.includes("fetchAdminUsers"), "renderAdminAccounts should not trigger account list network requests while rendering");
assert(appJs.includes("function ensureAdminUsersLoaded"), "app.js should load admin users from explicit tab/login/refresh events");
assert(appJs.includes("ensureAdminUsersLoaded();"), "opening the account tab should request users explicitly");
assert(
  appJs.includes("ensureAdminUsersLoaded({ force: Boolean(options.reset) })"),
  "admin login should force-refresh the account list outside the render cycle"
);
assert(appJs.includes('let adminActiveSection = "accounts"'), "admin page should open to account management by default");
assert(appJs.includes("function resetAdminAccountListState"), "admin logout/login should reset account list state");
assert(appJs.includes("activateAdminAccountsTab({ reset: true })"), "admin login should immediately show and refresh account management");
const lastAdminLoginStart = appJs.lastIndexOf("async function handleAdminLogin");
assert(lastAdminLoginStart >= 0, "app.js should define handleAdminLogin");
const nextCalendarAfterAdminLogin = appJs.indexOf("function renderCalendar", lastAdminLoginStart);
const activeAdminLoginBody = appJs.slice(lastAdminLoginStart, nextCalendarAfterAdminLogin);
assert(
  activeAdminLoginBody.includes("activateAdminAccountsTab({ reset: true })"),
  "the active final admin login handler should immediately show and refresh account management"
);
assert(
  activeAdminLoginBody.includes('jhint_role') && activeAdminLoginBody.includes('sessionRole !== "admin"'),
  "the active final admin login handler should allow users with the admin role"
);
assert(appJs.includes("async function fetchAdminUsers"), "app.js should fetch users through the server API");
assert(appJs.includes("async function createAdminUser"), "app.js should create users through the server API");
assert(appJs.includes("async function updateAdminUserProfile"), "app.js should update user names and roles through the server API");
assert(appJs.includes("async function deleteAdminUser"), "app.js should delete users through the server API");
assert(appJs.includes("ADMIN_ACCOUNT_ROLES"), "app.js should define account role options");
assert(appJs.includes('data-admin-user-action="saveProfile"'), "account list should include a compact save action for name and role");
assert(appJs.includes('"/api/admin-users"'), "app.js should call the admin users API route");
assert(!appJs.includes("SUPABASE_SERVICE_ROLE_KEY"), "service role key must never be referenced in browser code");
assert(
  styleCss.includes("grid-template-columns: minmax(190px, 0.95fr) minmax(280px, 1.1fr) minmax(0, 1.35fr);"),
  "account rows should reserve flexible space for status metadata without overlapping action buttons"
);
assert(styleCss.includes(".admin-account-row .admin-account-actions"), "account actions should occupy their own full-width grid area");
assert(styleCss.includes("flex-wrap: wrap;"), "account status metadata should wrap instead of overlapping controls");

const apiPath = path.join(root, "api", "admin-users.js");
assert(fs.existsSync(apiPath), "api/admin-users.js should exist for safe server-side account management");
const apiSource = fs.readFileSync(apiPath, "utf8");
assert(apiSource.includes("SUPABASE_SERVICE_ROLE_KEY"), "API route should read the service role key from env only");
assert(apiSource.includes("SUPABASE_SECRET_KEY"), "API route should also accept the current Supabase secret key env name");
assert(
  apiSource.includes("SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_SECRET_KEY"),
  "missing secret-key message should explain both supported env names"
);
assert(apiSource.includes("/auth/v1/admin/users"), "API route should use Supabase Auth admin users endpoint");
assert(apiSource.includes('"PATCH"'), "API route should support profile and role updates");
assert(apiSource.includes("app_metadata"), "API route should store roles in app_metadata");
assert(apiSource.includes("user_metadata"), "API route should store display names in user_metadata");
assert(apiSource.includes("verifyAdminRequest"), "API route should verify the caller before admin actions");
assert(swJs.includes('pathname.startsWith("/api/")'), "service worker should not cache admin API responses");

const parsedPackage = JSON.parse(packageJson);
assert(
  parsedPackage.scripts.test.includes("tests/admin-tools.test.js"),
  "npm test should include the admin tools regression test"
);

console.log("admin tools test passed");
