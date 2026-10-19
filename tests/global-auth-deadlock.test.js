const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert(start >= 0, `${signature} should be present`);
  const bodyMarker = source.indexOf(") {", start);
  assert(bodyMarker >= 0, `${signature} body should be present`);
  const openingBrace = bodyMarker + 2;
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${signature}`);
}

const listenerStart = appJs.indexOf("function bindAdminAuthListener");
const listenerEnd = appJs.indexOf("async function fetchApiState", listenerStart);
const listenerBody = appJs.slice(listenerStart, listenerEnd);

assert(listenerStart >= 0 && listenerEnd > listenerStart, "auth listener should be present");
assert(
  listenerBody.includes("onAuthStateChange((event, session) =>"),
  "auth state callback must remain synchronous"
);
assert(
  !listenerBody.includes("onAuthStateChange(async"),
  "auth state callback must not await Supabase work"
);
assert(
  listenerBody.includes("setTimeout(() =>") && listenerBody.includes("initializeAppData().catch"),
  "post-auth data loading should be deferred outside the auth callback"
);
assert(indexHtml.includes("app.js?v=20261019-03"), "clients should request the fixed app script");
assert(swJs.includes("jhint-production-app-v20261019-03"), "service worker cache should refresh");

async function run() {
  const listenerContext = {
    console,
    setTimeout,
    clearTimeout,
    listener: null,
    initializationCalls: 0
  };
  vm.createContext(listenerContext);
  vm.runInContext(`
    let isAdminAuthListenerBound = false;
    let currentAdminEmail = "";
    let currentAdminRole = "";
    const REQUIRE_GLOBAL_LOGIN = true;
    const supabaseAuthClient = {
      auth: {
        onAuthStateChange(callback) { listener = callback; },
        signOut() { return Promise.resolve(); }
      }
    };
    let isPasswordRecoveryMode = false;
    function setPasswordRecoveryMode(value) { isPasswordRecoveryMode = value; }
    function setAdminSession(email, role) { currentAdminEmail = email; currentAdminRole = role; }
    function renderSecurityLoginGate() {}
    function switchSecurityAuthMode() {}
    function setSecurityAuthMessage() {}
    function isPasswordAuthenticatedSession() { return true; }
    function getSessionRole() { return "admin"; }
    function getSessionDisplayName() { return "Test"; }
    function renderAdminSession() {}
    function renderSopPage() {}
    function initializeAppData() { initializationCalls += 1; return Promise.resolve(); }
    ${extractFunction(appJs, "function bindAdminAuthListener")}
    bindAdminAuthListener();
  `, listenerContext);

  const callbackResult = listenerContext.listener("SIGNED_IN", {
    access_token: "test",
    user: { email: "test@example.com" }
  });
  assert.equal(callbackResult, undefined, "auth callback should return synchronously without waiting on Supabase");
  assert.equal(listenerContext.initializationCalls, 0, "data loading must not run while the auth callback is active");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(listenerContext.initializationCalls, 1, "data loading should run after the auth callback returns");

  const initializationContext = {
    console,
    setTimeout,
    loadCalls: 0,
    renderCalls: 0,
    pollingCalls: 0
  };
  vm.createContext(initializationContext);
  vm.runInContext(`
    let isAppDataInitialized = false;
    let appDataInitializationPromise = null;
    const REQUIRE_GLOBAL_LOGIN = false;
    function setStartupState() {}
    async function loadRemoteState() {
      loadCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    }
    function render() { renderCalls += 1; }
    function startStatePolling() { pollingCalls += 1; }
    ${extractFunction(appJs, "async function initializeAppData")}
    globalThis.firstInitialization = initializeAppData();
    globalThis.secondInitialization = initializeAppData();
  `, initializationContext);
  await Promise.all([initializationContext.firstInitialization, initializationContext.secondInitialization]);
  assert.equal(initializationContext.loadCalls, 1, "concurrent login paths should share one server data load");
  assert.equal(initializationContext.renderCalls, 1, "shared initialization should render once");
  assert.equal(initializationContext.pollingCalls, 1, "shared initialization should start polling once");

  console.log("global auth deadlock test passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
