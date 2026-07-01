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
assert(appJs.includes("function isAdminAccountEditorFocused"), "account management should preserve in-progress name and role edits during background renders");
assert(appJs.includes("function shouldRenderAdminAccountsInPageRender"), "admin page renders should not redraw account lists during normal polling");
const renderAdminPageStart = appJs.indexOf("function renderAdminPage");
const nextAdminPageFunction = appJs.indexOf("function renderSopPage", renderAdminPageStart);
const renderAdminPageBody = appJs.slice(renderAdminPageStart, nextAdminPageFunction);
assert(
  renderAdminPageBody.includes("shouldRenderAdminAccountsInPageRender(options)") &&
    renderAdminPageBody.includes("renderAdminAccounts(options.accountOptions || {})"),
  "renderAdminPage should guard account list redraws during automatic background renders"
);
const renderAdminAccountsStart = appJs.indexOf("function renderAdminAccounts");
const nextAdminAccountsFunction = appJs.indexOf("function getShortAdminUserId", renderAdminAccountsStart);
const renderAdminAccountsBody = appJs.slice(renderAdminAccountsStart, nextAdminAccountsFunction);
assert(!renderAdminAccountsBody.includes("fetchAdminUsers"), "renderAdminAccounts should not trigger account list network requests while rendering");
assert(
  renderAdminAccountsBody.includes("isAdminAccountEditorFocused()") && renderAdminAccountsBody.includes("!options.force"),
  "renderAdminAccounts should not replace focused account editor fields during polling renders"
);
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
  activeAdminLoginBody.includes("getSessionRole(sessionUser, sessionEmail)") && activeAdminLoginBody.includes("!sessionRole"),
  "the active final admin login handler should accept any configured jhint role"
);
assert(
  activeAdminLoginBody.includes('canAccessView("adminView")'),
  "the active final admin login handler should only open account management for roles with admin page access"
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
  renderAdminAccountsBody.includes('class="admin-account-table"') &&
    renderAdminAccountsBody.includes('class="admin-account-head"') &&
    renderAdminAccountsBody.includes('class="admin-account-row"'),
  "account list should render as a table with a header and aligned rows"
);
assert(styleCss.includes(".admin-account-table"), "account list should have a table shell");
assert(
  styleCss.includes(".admin-account-head,") && styleCss.includes(".admin-account-row {"),
  "account table header and rows should share the same grid structure"
);
assert(
  styleCss.includes("grid-template-columns: minmax(190px, 1.15fr) minmax(150px, 0.8fr) minmax(120px, 0.62fr) minmax(90px, 0.5fr) minmax(150px, 0.72fr) minmax(190px, 0.9fr) minmax(150px, 0.68fr);"),
  "account rows should use compact table columns for identity, name, role, status, dates, and actions"
);
assert(styleCss.includes(".admin-account-cell + .admin-account-cell"), "account cells should have vertical dividers like a table");

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
const updateUserStart = apiSource.indexOf("async function updateUser");
const deleteUserStart = apiSource.indexOf("async function deleteUser", updateUserStart);
const updateUserBody = apiSource.slice(updateUserStart, deleteUserStart);
assert(updateUserBody.includes('method: "PUT"'), "profile updates should forward to Supabase Auth Admin with PUT");
assert(!updateUserBody.includes('method: "PATCH"'), "profile updates should not forward PATCH to Supabase Auth Admin");
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
