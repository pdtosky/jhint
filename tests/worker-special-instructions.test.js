const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const requestPrefix = "\ubc1c\uc8fc\uc758\ub8b0 ";
const marker = "\ud2b9\uc774\uc0ac\ud56d";

function extractFunction(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  assert.notEqual(start, -1, `${name} must exist in app.js`);
  const tail = source.slice(start);
  const end = /^\}/m.exec(tail);
  assert.ok(end, `${name} must have a top-level closing brace`);
  const code = tail.slice(0, end.index + 1);
  new vm.Script(`(${code})`);
  return code;
}

function load(context, names) {
  vm.createContext(context);
  vm.runInContext(names.map(extractFunction).join("\n"), context);
  return context;
}

const helpers = ["escapeHtml", "getWorkerSpecialInstructions", "renderWorkerSpecialInstructions"];
const context = load({}, helpers);

for (const [label, orderNote, expected] of [
  ["manual note", "  Handle with care  ", "Handle with care"],
  ["manual multiline", " \nFirst line\nSecond line\n ", "First line\nSecond line"],
  ["manual marker is preserved", ` ${marker} manual text `, `${marker} manual text`],
  ["newline metadata", `${requestPrefix}REQ-1\nQuantity 10\n${marker} First line\nSecond line`, "First line\nSecond line"],
  ["legacy inline metadata", `${requestPrefix}REQ-1 / Quantity 10 / ${marker} Careful / Keep dry`, "Careful / Keep dry"],
  ["CRLF content", `${requestPrefix}REQ-1\r\n${marker}\r\nFirst\r\nSecond`, "First\r\nSecond"],
  ["generated metadata only", `${requestPrefix}REQ-1 / Quantity 10 / Price 20`, ""],
  ["empty generated instructions", `${requestPrefix}REQ-1\n${marker} \n `, ""],
  ["repeated marker in content", `${requestPrefix}REQ-1\n${marker} First\n${marker} second`, `First\n${marker} second`],
  ["empty", "", ""],
  ["whitespace", " \r\n\t ", ""],
  ["missing", undefined, ""],
  ["null", null, ""]
]) {
  test(`instruction extraction: ${label}`, () => {
    const order = { orderNote };
    assert.equal(context.getWorkerSpecialInstructions(order), expected);
    assert.equal(order.orderNote, orderNote, "extraction must not mutate the order");
  });
}

test("missing order has no special instructions or markup", () => {
  for (const order of [undefined, null, {}]) {
    assert.equal(context.getWorkerSpecialInstructions(order), "");
    assert.equal(context.renderWorkerSpecialInstructions(order), "");
  }
});

test("renderer escapes malicious note and product while preserving the full multiline content", () => {
  const note = `<img src=x onerror="alert('x')"> & <script>alert(1)</script>\n${"Long instruction. ".repeat(600)}END`;
  const product = '<svg onload="alert(2)"> & product';
  const html = context.renderWorkerSpecialInstructions({ orderNote: note, product });
  assert.ok(html.includes(context.escapeHtml(note)), "full note, including newline and final text, must survive");
  assert.ok(html.includes(context.escapeHtml(product)), "product must also be escaped");
  assert.doesNotMatch(html, /<(?:img|script|svg)\b/i);
  assert.match(html, /<section\b[^>]*class="worker-special-instructions"/);
  assert.match(html, /aria-label=/);
  assert.match(html, /<strong\b[^>]*class="worker-special-title"/);
  assert.match(html, /class="worker-special-content"/);
});

test("metadata without instructions does not render an empty warning", () => {
  assert.equal(context.renderWorkerSpecialInstructions({ orderNote: `${requestPrefix}REQ-1 / Quantity 10` }), "");
});

// Minimal DOM events execute the real modal callbacks without loading the whole app.
function element() {
  const listeners = new Map();
  const children = new Map();
  return {
    hidden: false, checked: false, disabled: false, dataset: {}, innerHTML: "", textContent: "",
    addEventListener(type, callback) { listeners.set(type, callback); },
    dispatch(type) { return listeners.get(type)?.({ target: this }); },
    querySelector(selector) {
      if (!children.has(selector)) children.set(selector, element());
      return children.get(selector);
    }
  };
}

function harness(orderNote = "Keep dry", realUpdate = false) {
  const nodes = new Map();
  const calls = { updates: [], alerts: [], saved: 0, locks: [] };
  const order = { id: "order-1", company: "Company", product: "Product", status: "ready", orderNote };
  const ctx = {
    state: { orders: [order], activities: [] }, pendingStartSnapshot: null,
    workerForm: { workerName: "Worker", machineName: "Machine", orderId: order.id },
    FormData: class { constructor(form) { this.form = form; } get(key) { return this.form[key]; } },
    document: {
      getElementById: (id) => nodes.get(id) || null,
      createElement: () => element(),
      body: { appendChild(node) { nodes.set(node.id, node); } }
    },
    canAccessView: () => true, showPermissionDenied: () => {}, syncWorkerAccountIdentity: () => {},
    showWorkerAlert: (message) => calls.alerts.push(message), showAppAlert: (message) => calls.alerts.push(message),
    getCleanDisplayText: (value) => value, render: () => {},
    setWorkStartConfirmationLocked: (locked) => calls.locks.push(locked),
    updateWorkState: (status, snapshot) => calls.updates.push({ status, snapshot: { ...snapshot } }),
    clearWorkerAlert: () => {}, enableWorkerStartInputs: () => {}, disableWorkerStartInputs: () => {},
    isActiveWorkStatus: (item) => item.status === "working", isTemporarilyPaused: () => false,
    currentAdminRole: "production", supabaseAuthClient: null,
    normalizeAppState: (value) => JSON.parse(JSON.stringify(value)),
    createCompatibleRandomId: () => "activity-1", TEXT: { startMessage: "Started", endMessage: "Ended" },
    persist: async () => { calls.saved += 1; }
  };
  load(ctx, [...helpers, "confirmWorkStart", ...(realUpdate ? ["updateWorkState"] : [])]);
  const control = (id) => nodes.get("workStartConfirmModal").querySelector(`#${id}`);
  const acknowledge = () => {
    control("workStartNoteAck").checked = true;
    control("workStartNoteAck").dispatch("change");
  };
  return { ctx, order, calls, control, acknowledge, nodes };
}

test("nonempty instructions require acknowledgement and store it in the start snapshot", () => {
  const h = harness();
  h.ctx.confirmWorkStart();
  assert.equal(h.ctx.pendingStartSnapshot.specialInstructions, "Keep dry");
  assert.equal(h.control("workStartNoteAck").checked, false);
  assert.equal(h.control("workStartNoteAckLabel").hidden, false);
  assert.equal(h.control("workStartConfirmYesBtn").disabled, true);
  h.control("workStartConfirmYesBtn").dispatch("click");
  assert.equal(h.calls.updates.length, 0, "callback itself must guard unchecked acknowledgement");
  h.acknowledge();
  assert.equal(h.control("workStartConfirmYesBtn").disabled, false);
  h.control("workStartConfirmYesBtn").dispatch("click");
  assert.equal(h.calls.updates.length, 1);
  assert.equal(h.calls.updates[0].status, "working");
  assert.equal(h.calls.updates[0].snapshot.specialInstructions, "Keep dry");
  assert.equal(h.calls.updates[0].snapshot.specialInstructionsAcknowledged, true);
  assert.equal(h.ctx.pendingStartSnapshot, null);
});

test("unchecking disables start and every modal opening resets acknowledgement", () => {
  const h = harness();
  h.ctx.confirmWorkStart();
  h.acknowledge();
  h.control("workStartNoteAck").checked = false;
  h.control("workStartNoteAck").dispatch("change");
  assert.equal(h.control("workStartConfirmYesBtn").disabled, true);
  h.acknowledge();
  h.ctx.confirmWorkStart();
  assert.equal(h.control("workStartNoteAck").checked, false);
  assert.equal(h.control("workStartConfirmYesBtn").disabled, true);
  h.acknowledge();
  h.control("workStartConfirmNoBtn").dispatch("click");
  assert.equal(h.ctx.pendingStartSnapshot, null);
  h.ctx.confirmWorkStart();
  assert.equal(h.control("workStartNoteAck").checked, false);
  assert.equal(h.control("workStartConfirmYesBtn").disabled, true);
  assert.equal(h.calls.updates.length, 0);
});

test("metadata-only orders can start without acknowledgement", () => {
  const h = harness(`${requestPrefix}REQ-1 / Quantity 10`);
  h.ctx.confirmWorkStart();
  assert.equal(h.control("workStartNoteAckLabel").hidden, true);
  assert.equal(h.control("workStartConfirmYesBtn").disabled, false);
  assert.equal(h.control("workStartSpecialInstructions").innerHTML, "");
  h.control("workStartConfirmYesBtn").dispatch("click");
  assert.equal(h.calls.updates.length, 1);
});

for (const initial of ["Old instructions", ""]) {
  test(`modal rechecks changed instructions before starting (initial: ${initial || "empty"})`, () => {
    const h = harness(initial);
    h.ctx.confirmWorkStart();
    if (initial) h.acknowledge();
    h.order.orderNote = "New instructions\nSecond line";
    h.control("workStartConfirmYesBtn").dispatch("click");
    assert.equal(h.calls.updates.length, 0);
    assert.equal(h.ctx.pendingStartSnapshot.specialInstructions, h.order.orderNote);
    assert.equal(h.control("workStartNoteAck").checked, false);
    assert.equal(h.control("workStartConfirmYesBtn").disabled, true);
    assert.equal(h.control("workStartNoteAckLabel").hidden, false);
    assert.ok(h.control("workStartSpecialInstructions").innerHTML.includes(h.order.orderNote));
    h.acknowledge();
    h.control("workStartConfirmYesBtn").dispatch("click");
    assert.equal(h.calls.updates[0].snapshot.specialInstructions, h.order.orderNote);
    assert.equal(h.calls.updates[0].snapshot.specialInstructionsAcknowledged, true);
  });
}

for (const [label, snapshot] of [
  ["missing acknowledgement", { specialInstructions: "Keep dry" }],
  ["stale acknowledged text", { specialInstructions: "Old instructions", specialInstructionsAcknowledged: true }]
]) {
  test(`updateWorkState rejects ${label} without saving`, async () => {
    const h = harness("Keep dry", true);
    await h.ctx.updateWorkState("working", snapshot);
    assert.equal(h.order.status, "ready");
    assert.equal(h.calls.saved, 0);
    assert.equal(h.ctx.state.activities.length, 0);
  });
}

test("updateWorkState starts with matching acknowledged instructions", async () => {
  const h = harness("Keep dry", true);
  await h.ctx.updateWorkState("working", { specialInstructions: "Keep dry", specialInstructionsAcknowledged: true });
  assert.equal(h.order.status, "working");
  assert.equal(h.calls.saved, 1);
  assert.equal(h.ctx.state.activities.length, 1);
});

for (const replaceOrder of [false, true]) {
  test(`updateWorkState rechecks instructions after asynchronous session lookup (${replaceOrder ? "replaced order" : "mutated order"})`, async () => {
    const h = harness("Keep dry", true);
    let finishSession;
    h.ctx.supabaseAuthClient = { auth: { getSession: () => new Promise((resolve) => { finishSession = resolve; }) } };
    const pending = h.ctx.updateWorkState("working", { specialInstructions: "Keep dry", specialInstructionsAcknowledged: true });
    assert.equal(typeof finishSession, "function", "must reach the asynchronous session boundary");
    if (replaceOrder) h.ctx.state.orders = [{ ...h.order, orderNote: "New safety instructions" }];
    else h.order.orderNote = "New safety instructions";
    finishSession({ data: { session: { user: { id: "worker-user" } } } });
    await pending;
    assert.equal(h.ctx.state.orders[0].status, "ready");
    assert.equal(h.order.status, "ready", "must not mutate a stale order object either");
    assert.equal(h.calls.saved, 0);
    assert.equal(h.ctx.state.activities.length, 0);
  });
}
