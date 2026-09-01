const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const rlsSql = fs.readFileSync(path.join(root, "supabase-app-state-auth-rls.sql"), "utf8");

assert(indexHtml.includes('id="globalPasswordUpdateForm"'), "recovery links should open a dedicated password form");
assert(indexHtml.includes('name="newPassword"'), "the recovery form should collect a new password");
assert(indexHtml.includes('name="confirmNewPassword"'), "the recovery form should confirm the new password");

assert(appJs.includes("let isPasswordRecoveryMode = hasPasswordRecoveryRequest()"), "recovery mode should be detected before session restoration");
assert(appJs.includes("hasStoredPasswordRecoveryRequest()"), "recovery mode should survive a refresh in the same browser tab");
assert(appJs.includes('writeBrowserStorage("sessionStorage", AUTH_RECOVERY_KEY, "true")'), "recovery mode should be stored only for the current tab");
assert(appJs.includes("function isPasswordAuthenticatedSession"), "restored sessions should verify their authentication method");
assert(appJs.includes('includes("password")'), "only password-authenticated sessions should open the application");
assert(appJs.includes('event === "PASSWORD_RECOVERY"'), "Supabase password recovery events should be handled separately");
assert(appJs.includes("!isPasswordRecoveryMode && currentAdminEmail && currentAdminRole"), "a recovery session must not satisfy the app login gate");
assert(appJs.includes('const activeMode = isPasswordRecoveryMode ? "update" : requestedMode'), "recovery users should remain on the update form");

const updateStart = appJs.indexOf("async function handleGlobalPasswordUpdate");
const updateEnd = appJs.indexOf("async function handleAdminLogout", updateStart);
const updateBody = appJs.slice(updateStart, updateEnd);
assert(updateStart >= 0 && updateEnd > updateStart, "the password update handler should exist");
assert(updateBody.includes("newPassword !== confirmNewPassword"), "new password confirmation should be validated");
assert(updateBody.includes("auth.updateUser({ password: newPassword })"), "the new password should be saved through Supabase Auth");
assert(updateBody.includes('auth.signOut({ scope: "global" })'), "the temporary recovery session should be closed after updating");
assert(updateBody.indexOf('auth.signOut({ scope: "global" })') < updateBody.indexOf("setPasswordRecoveryMode(false)"), "recovery mode should stay locked until sign-out finishes");
assert(updateBody.includes("clearPasswordRecoveryUrl()"), "recovery tokens should be removed from the browser address");
assert(indexHtml.includes('id="globalPasswordRecoveryCancelBtn"'), "users should be able to cancel and close a recovery session safely");

assert(appJs.includes("async function getSupabaseHeaders"), "database requests should resolve the signed-in access token");
assert(appJs.includes("Authorization: `Bearer ${accessToken || APP_CONFIG.supabaseAnonKey}`"), "authenticated database requests should use the user access token");
assert(appJs.includes("authenticated Supabase session required"), "protected database requests should reject missing sessions");
assert.match(rlsSql, /revoke all on table public\.app_state from anon/i, "anonymous users must not access production state");
assert.match(rlsSql, /to authenticated[\s\S]*jhint_role/i, "RLS should require an approved account role");
assert.match(rlsSql, /auth\.jwt\(\) -> 'amr'[\s\S]*method' = 'password'/i, "RLS should reject recovery and magic-link sessions");

assert(styleCss.includes(".security-login-gate.password-recovery-mode .security-auth-tabs"), "normal login tabs should be hidden during recovery");
assert(indexHtml.includes("app.js?v=20260901-07"), "the recovery fix should use a fresh app cache version");
assert(swJs.includes("jhint-production-app-v20260901-07"), "the service worker cache should refresh for the recovery fix");

console.log("password recovery flow test passed");
