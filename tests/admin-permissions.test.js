const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const apiSource = fs.readFileSync(path.join(root, "api", "admin-users.js"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

const expectedRoles = [
  ['value: "admin"', 'label: "관리자"'],
  ['value: "production"', 'label: "생산"'],
  ['value: "sales"', 'label: "영업"'],
  ['value: "office"', 'label: "총무"'],
  ['value: "quality"', 'label: "품질"'],
  ['value: "shipping"', 'label: "출하"']
];

expectedRoles.forEach(([value, label]) => {
  assert(appJs.includes(value) && appJs.includes(label), `role option should include ${label}`);
});

assert(appJs.includes("const ROLE_VIEW_PERMISSIONS"), "app.js should define page permissions by role");
assert(appJs.includes("function canAccessView"), "app.js should check view access before switching pages");
assert(appJs.includes("function canAccessAdminSection"), "app.js should check admin section access separately");
assert(appJs.includes('accounts: ["admin"]'), "account management should be admin-only");
assert(appJs.includes('production: ["dashboardView", "workerView"]'), "production role should only access dashboard and worker input");
assert(appJs.includes('sales: ["dashboardView", "requisitionView", "ordersView", "shippingView"]'), "sales role should access sales workflow pages");
assert(appJs.includes('shipping: ["dashboardView", "shippingView"]'), "shipping role should only access dashboard and shipping");
assert(appJs.includes('quality: ["dashboardView", "ordersView", "requisitionView", "workerView", "shippingView", "sopView"]'), "quality role should access all non-admin pages");
assert(appJs.includes("canAccessAdminSection(button.dataset.adminSection"), "admin section clicks should be permission-checked");
assert(appJs.includes("filterAdminSectionsByRole()"), "admin page should hide inaccessible admin tabs");
assert(appJs.includes("currentAdminRole"), "app.js should track the current login role");
assert(appJs.includes("getSessionRole"), "app.js should read jhint_role from Supabase session metadata");
assert(appJs.includes("normalizeAccountRole"), "app.js should normalize legacy and new account roles");
assert(appJs.includes("showPermissionDenied"), "app.js should show a clear message when a user opens a blocked page");

assert(apiSource.includes('"production"'), "account API should accept production role");
assert(apiSource.includes('"office"'), "account API should accept office role");
assert(apiSource.includes('"quality"'), "account API should accept quality role");
assert(apiSource.includes('"shipping"'), "account API should accept shipping role");
assert(!apiSource.includes('new Set(["admin", "sales", "worker", "viewer"])'), "account API should stop using the old limited role set");

const parsedPackage = JSON.parse(packageJson);
assert(parsedPackage.scripts.test.includes("tests/admin-permissions.test.js"), "npm test should include admin permissions regression test");

console.log("admin permissions test passed");
