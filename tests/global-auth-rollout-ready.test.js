const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const configJs = fs.readFileSync(path.join(root, "config.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const apiSource = fs.readFileSync(path.join(root, "api", "admin-users.js"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const checklistPath = path.join(root, "docs", "global-login-rollout-checklist.md");

assert(configJs.includes("requireGlobalLogin: true"), "global login switch should be enabled on rollout morning");
assert(
  configJs.includes('authRedirectUrl: "https://jhint.vercel.app/"'),
  "email verification and password reset should have an explicit production redirect URL"
);

assert(appJs.includes("function getSecurityAuthErrorMessage"), "signup failures should be translated into clear Korean messages");
assert(
  appJs.includes("회원가입 제한 설정") && appJs.includes("관리자에게 문의"),
  "signup error helper should explain an unexpected server-side signup restriction"
);
assert(
  appJs.includes('errorCode === "over_email_send_rate_limit"') &&
    appJs.includes("현재 인증 메일 발송 한도를 초과했으므로 잠시 후 같은 이메일로 다시 시도해 주세요."),
  "signup error helper should clearly explain the email delivery rate limit"
);
assert(
  appJs.includes("setSecurityAuthSubmitBusy(globalSignupForm, true)") &&
    appJs.includes("setSecurityAuthSubmitBusy(globalSignupForm, false)"),
  "signup should lock its submit button while the request is in progress"
);

const normalizeAdminUserStart = appJs.indexOf("function normalizeAdminUser");
const requestAdminUsersStart = appJs.indexOf("async function requestAdminUsersApi", normalizeAdminUserStart);
const normalizeAdminUserBody = appJs.slice(normalizeAdminUserStart, requestAdminUsersStart);
assert(
  normalizeAdminUserBody.includes('normalizeAccountRole(appMetadata.jhint_role, "")'),
  "email-confirmed signup requests without app_metadata role must stay unapproved, not default to production"
);

const renderAdminAccountsStart = appJs.indexOf("function renderAdminAccounts");
const renderAdminAccountRoleOptionsStart = appJs.indexOf("function renderAdminAccountRoleOptions", renderAdminAccountsStart);
const renderAdminAccountsBody = appJs.slice(renderAdminAccountsStart, renderAdminAccountRoleOptionsStart);
assert(renderAdminAccountsBody.includes("isApproved"), "account rows should distinguish email confirmation from admin approval");
assert(renderAdminAccountsBody.includes("승인 대기"), "account rows should show pending admin approval clearly");
assert(!renderAdminAccountsBody.includes('user.confirmedAt ? "사용 가능" : "확인 대기"'), "confirmed email alone should not be shown as fully usable");

const roleOptionsStart = appJs.indexOf("function renderAdminAccountRoleOptions");
const resetAdminAccountListStart = appJs.indexOf("function resetAdminAccountListState", roleOptionsStart);
const roleOptionsBody = appJs.slice(roleOptionsStart, resetAdminAccountListStart);
assert(roleOptionsBody.includes("권한 선택"), "pending signup requests should show a role-select placeholder");
assert(roleOptionsBody.includes('normalizeAccountRole(role, "")'), "role option rendering should not default pending users to production");

assert(apiSource.includes("관리자 로그인 토큰이 없습니다."), "account API should return readable Korean auth errors");
assert(apiSource.includes("계정 권한을 선택해 주세요."), "account API should return readable Korean validation errors");
assert(
  apiSource.includes("SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_SECRET_KEY 환경변수가 설정되지 않았습니다."),
  "account API should explain the required server secret environment variable in Korean"
);
assert(!/[-�]/.test(apiSource), "account API messages should not contain mojibake or replacement characters");

assert(fs.existsSync(checklistPath), "rollout checklist should exist for tomorrow morning switch-on");
const checklist = fs.readFileSync(checklistPath, "utf8");
assert(checklist.includes("requireGlobalLogin: true"), "checklist should show the exact switch to turn on");
assert(checklist.includes("일반 회원가입을 허용"), "checklist should include Supabase signup setting");
assert(checklist.includes("관리자 승인"), "checklist should include admin approval verification");
assert(swJs.includes("v20260710-10"), "service worker cache should include the latest permission update");

console.log("global auth rollout readiness test passed");
