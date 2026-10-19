const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "startup.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const loadingMessage = "\uc11c\ubc84\uc5d0 \uc5f0\uacb0\ud574 \ub85c\uadf8\uc778\uacfc \ucd5c\uc2e0 \ub370\uc774\ud130\ub97c \ud655\uc778\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.";
const delayMessage = "\uc11c\ubc84 \uc5f0\uacb0\uc774 \uc9c0\uc5f0\ub418\uace0 \uc788\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uac70\ub098 \ub2e4\uc2dc \uc5f0\uacb0\ud558\uae30\ub97c \ub20c\ub7ec \uc0c8\ub85c\uace0\uce68\ud574 \uc8fc\uc138\uc694.";

function createHarness({ beforeAppScript = false, hiddenContent = false } = {}) {
  let now = 0;
  let nextId = 0;
  const pending = new Map();
  const scheduled = [];
  const cleared = [];
  const classes = new Set(["app-loading", "security-auth-required", "unrelated-class"]);
  const screen = { hidden: false };
  const message = { textContent: loadingMessage };
  const login = Object.freeze({ hidden: hiddenContent, value: "existing-login-input" });
  const page = Object.freeze({ hidden: hiddenContent, value: "existing-page-content" });
  const elements = { appStartupScreen: screen, appStartupMessage: message };
  const attachContent = () => {
    elements.securityLoginGate = login;
    elements.pageShell = page;
  };
  if (!beforeAppScript) attachContent();

  const window = {
    setTimeout(callback, delay) {
      assert.equal(delay, 30000);
      const id = nextId++;
      const timer = { id, callback, due: now + delay };
      scheduled.push(timer);
      pending.set(id, timer);
      return id;
    },
    clearTimeout(id) {
      cleared.push(id);
      pending.delete(id);
    }
  };
  const context = {
    window,
    document: {
      body: {
        classList: {
          toggle(name, enabled) {
            if (enabled) classes.add(name);
            else classes.delete(name);
          }
        }
      },
      getElementById: (id) => elements[id] || null
    }
  };
  const preserved = {
    currentAdminEmail: "existing@example.com",
    currentAdminRole: "admin",
    isAppDataInitialized: false,
    state: Object.freeze({ orders: Object.freeze([{ id: "existing-order" }]) })
  };
  for (const [key, value] of Object.entries(preserved)) {
    Object.defineProperty(context, key, {
      enumerable: true,
      get: () => value,
      set() { throw new Error("Startup must not change " + key); }
    });
  }
  for (const key of ["localStorage", "sessionStorage", "supabase", "fetch", "XMLHttpRequest", "location", "setInterval"]) {
    for (const target of [context, window]) {
      Object.defineProperty(target, key, {
        get() { throw new Error("Startup must not access " + key); }
      });
    }
  }
  vm.runInNewContext(source, context, { filename: "startup.js" });

  function advance(milliseconds) {
    const end = now + milliseconds;
    while (true) {
      const timer = [...pending.values()]
        .filter((entry) => entry.due <= end)
        .sort((a, b) => a.due - b.due || a.id - b.id)[0];
      if (!timer) break;
      now = timer.due;
      pending.delete(timer.id);
      timer.callback();
    }
    now = end;
  }

  function assertBlocked() {
    assert.equal(classes.has("app-loading"), true);
    assert.equal(screen.hidden, false);
    assert.equal(login.hidden, hiddenContent, "the controller must preserve the login gate's hidden flag");
    assert.equal(page.hidden, hiddenContent, "the controller must preserve the page's hidden flag");
    assert.equal(classes.has("security-auth-required"), true);
    assert.equal(classes.has("unrelated-class"), true);
    for (const [key, value] of Object.entries(preserved)) assert.equal(context[key], value);
  }

  return {
    api: window.ProductionStartup, advance, attachContent, assertBlocked,
    classes, screen, message, login, page, pending, scheduled, cleared
  };
}

test("controller loads immediately after the startup section, before any app or remote script", () => {
  assert.match(html, /<\/section>\s*<script src="startup\.js\?v=20261019-01"><\/script>\s*<section id="securityLoginGate"/);
  const startupPosition = html.indexOf('<script src="startup.js?v=20261019-01"></script>');
  for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
    if (match[1].startsWith("startup.js")) continue;
    assert.ok(match.index > startupPosition, match[1] + " must load after the watchdog");
  }
  assert.match(html, /<body class="app-loading">/);
  assert.match(html, /body\.app-loading \.page-shell, body\.app-loading #securityLoginGate\s*\{\s*display: none !important;/);
  assert.match(html, /#appStartupScreen\[hidden\]\s*\{\s*display: none;/);
  assert.match(html, /<p id="appStartupMessage">\uc11c\ubc84\uc5d0 \uc5f0\uacb0\ud574 \ub85c\uadf8\uc778\uacfc \ucd5c\uc2e0 \ub370\uc774\ud130\ub97c \ud655\uc778\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4\.<\/p>/);
  assert.match(html, /<button type="button" onclick="location\.reload\(\)">\ub2e4\uc2dc \uc5f0\uacb0\ud558\uae30<\/button>/);
  assert.match(html, /style\.css\?v=20261019-02/);
  assert.match(html, /app\.js\?v=20261019-02/);
  assert.doesNotMatch(source, /Promise\.race|\b(?:fetch|setInterval)\s*\(|location\s*\./);
});

test("a pending startup times out at 30 seconds even before the app script runs", () => {
  const h = createHarness({ beforeAppScript: true });
  assert.equal(typeof h.api.setState, "function");
  assert.equal(h.pending.size, 1);
  h.assertBlocked();
  h.advance(29999);
  assert.equal(h.message.textContent, loadingMessage);
  h.advance(1);
  assert.equal(h.message.textContent, delayMessage);
  assert.equal(h.pending.size, 0);
  h.attachContent();
  h.assertBlocked();
  h.advance(120000);
  assert.equal(h.scheduled.length, 1, "a timeout must not start another attempt");
  assert.equal(h.message.textContent, delayMessage);
});

test("ready clears the watchdog and a stale queued callback cannot hide ready UI", () => {
  const h = createHarness();
  const staleTimeout = h.scheduled[0].callback;
  h.advance(29999);
  h.api.setState("ready");
  assert.equal(h.pending.size, 0);
  assert.deepEqual(h.cleared, [0], "timer ID zero must be canceled too");
  assert.equal(h.classes.has("app-loading"), false);
  assert.equal(h.screen.hidden, true);
  assert.equal(h.login.hidden, false, "existing auth gating remains in charge");
  assert.equal(h.page.hidden, false);
  staleTimeout();
  h.advance(120000);
  assert.equal(h.classes.has("app-loading"), false);
  assert.equal(h.screen.hidden, true);
  assert.notEqual(h.message.textContent, delayMessage);
  assert.equal(h.scheduled.length, 1);
});

test("an explicit failure clears the timer and keeps the page and login blocked", () => {
  const h = createHarness();
  const staleTimeout = h.scheduled[0].callback;
  h.advance(1000);
  h.api.setState("error");
  const failureMessage = h.message.textContent;
  assert.match(failureMessage, /\uc11c\ubc84\uc5d0 \uc5f0\uacb0\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4/);
  assert.equal(h.pending.size, 0);
  assert.deepEqual(h.cleared, [0]);
  h.assertBlocked();
  staleTimeout();
  h.advance(120000);
  assert.equal(h.message.textContent, failureMessage);
  h.api.setState("loading");
  h.api.setStage("should not replace an error");
  assert.equal(h.scheduled.length, 1);
  assert.equal(h.message.textContent, failureMessage);
  h.assertBlocked();
});

test("late success may reveal UI after a timeout without another attempt or reload", () => {
  const h = createHarness();
  const staleTimeout = h.scheduled[0].callback;
  h.advance(30000);
  h.api.setState("loading");
  h.api.setStage("should not replace timeout guidance");
  assert.equal(h.message.textContent, delayMessage);
  assert.equal(h.scheduled.length, 1);
  h.assertBlocked();
  h.api.setState("ready");
  staleTimeout();
  h.advance(120000);
  assert.equal(h.screen.hidden, true);
  assert.equal(h.classes.has("app-loading"), false);
  assert.equal(h.pending.size, 0);
  assert.equal(h.scheduled.length, 1);
});

test("repeated loading and stage updates cannot postpone the same attempt", () => {
  const h = createHarness();
  for (let index = 0; index < 5; index += 1) {
    h.advance(5000);
    h.api.setState("loading");
    h.api.setStage("stage " + index);
    assert.equal(h.message.textContent, "stage " + index);
    assert.equal(h.scheduled.length, 1);
    assert.equal(h.pending.size, 1);
    h.assertBlocked();
  }
  h.advance(4999);
  assert.notEqual(h.message.textContent, delayMessage);
  h.advance(1);
  assert.equal(h.message.textContent, delayMessage);
  h.assertBlocked();
});

test("a new loading phase after ready gets its own deadline and ignores old callbacks", () => {
  const h = createHarness();
  const staleTimeout = h.scheduled[0].callback;
  h.advance(1000);
  h.api.setState("ready");
  h.api.setState("loading");
  assert.equal(h.scheduled.length, 2);
  staleTimeout();
  assert.equal(h.message.textContent, loadingMessage);
  assert.equal(h.pending.size, 1);
  h.assertBlocked();
  h.advance(29999);
  assert.equal(h.message.textContent, loadingMessage);
  h.advance(1);
  assert.equal(h.message.textContent, delayMessage);
  h.assertBlocked();
});

test("existing hidden flags, auth state and storage remain untouched throughout", () => {
  const h = createHarness({ hiddenContent: true });
  h.api.setState("unrecognized");
  h.api.setStage(null);
  h.api.setStage("  ");
  assert.equal(h.message.textContent, loadingMessage);
  h.advance(30000);
  h.assertBlocked();
  h.api.setState("ready");
  h.api.setStage("must stay hidden");
  assert.equal(h.screen.hidden, true);
  assert.equal(h.login.hidden, true);
  assert.equal(h.page.hidden, true);
  assert.equal(h.classes.has("security-auth-required"), true);
  assert.equal(h.classes.has("unrelated-class"), true);
  h.api.setState("loading");
  h.api.setState("error");
  h.assertBlocked();
});

console.log("startup watchdog timer and markup checks loaded");
