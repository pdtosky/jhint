const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const configJs = fs.readFileSync(path.join(root, "config.js"), "utf8");

assert(indexHtml.includes('id="securityLoginGate"'), "global login gate should exist but stay hidden until enabled");
assert(indexHtml.includes('id="globalLoginForm"'), "global login form should be prepared");
assert(indexHtml.includes('id="globalSignupForm"'), "email-verification signup form should be prepared");
assert(indexHtml.includes('id="globalPasswordResetForm"'), "password reset form should be prepared");
assert(indexHtml.includes('data-security-auth-tab="signup"'), "signup tab should be available");
assert(indexHtml.includes('data-security-auth-tab="reset"'), "password reset tab should be available");

assert(configJs.includes("requireGlobalLogin: false"), "global login should be explicitly disabled until rollout day");
assert(appJs.includes("const REQUIRE_GLOBAL_LOGIN = APP_CONFIG.requireGlobalLogin === true"), "app should only enforce global login when the flag is true");
assert(appJs.includes("function renderSecurityLoginGate"), "app should render the prepared global login gate");
assert(appJs.includes("function handleGlobalSignup"), "app should handle email-verification signup");
assert(appJs.includes("supabaseAuthClient.auth.signUp"), "signup should use Supabase Auth signUp");
assert(appJs.includes("emailRedirectTo: getAuthRedirectUrl()"), "signup should use an email verification redirect URL");
assert(appJs.includes("function handleGlobalPasswordReset"), "app should handle password reset requests");
assert(appJs.includes("supabaseAuthClient.auth.resetPasswordForEmail"), "password reset should use Supabase Auth resetPasswordForEmail");
assert(appJs.includes("관리자 승인"), "signup flow should explain that admin approval is still required after email verification");
assert(!appJs.includes("SUPABASE_SERVICE_ROLE_KEY"), "browser code must not expose the service-role key");

assert(styleCss.includes(".security-login-gate"), "global login gate should have a dedicated layout");
assert(styleCss.includes(".security-auth-tabs"), "auth mode tabs should be styled");
assert(styleCss.includes(".security-auth-form"), "auth forms should be styled");

console.log("global auth gate test passed");
