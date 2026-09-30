const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const names = ["renderShippingPageCardOverride", "normalizeShipmentRecord", "getOrderQuantity", "getShipmentRecords", "getShippedQuantity", "getRemainingShippingQuantity", "getLatestShipmentDate", "syncOrderShippingState", "getShippingStatus", "getFilteredShippingOrders"];
const code = names.map((name) => {
  const start = source.lastIndexOf(`function ${name}(`);
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}).join("\n");

function harness(order) {
  let id = 0;
  const inputs = {};
  const buttons = {};
  const context = {
    state: { orders: [order], activities: [] }, shippingFilter: "all", shippingSearchKeyword: "", isShippingListOpen: true,
    allowed: true, confirmed: true, alerts: [], denied: 0, confirmations: 0, saves: 0, errors: [], failSave: false,
    normalizeCommercialFields: (record = {}) => ({ quantityMode: record.quantityMode === "all-material" ? "all-material" : "fixed", quantityUnit: record.quantityUnit === "m" ? "m" : "ea" }),
    getQuantityUnitLabel: (record) => record.quantityUnit === "m" ? "m" : "개",
    formatRequestedQuantity: (record) => record.quantityMode === "all-material" ? "원단 전량 작업" : `${record.quantity}${record.quantityUnit === "m" ? "m" : "개"}`,
    getCommercialPriceLabel: () => "추후 협의",
    createCompatibleRandomId: () => `id-${++id}`,
    getSortableTimestamp: (value) => Date.parse(value) || 0,
    getSortedOrders: (orders) => orders,
    daysUntil: (date) => date === "2026-09-01" ? -1 : 1,
    formatDate: (date) => date, getOrderNoteText: () => "", statusBadgeClean: () => "", escapeHtml: (text) => String(text),
    canAccessView: () => context.allowed,
    showPermissionDenied: () => context.denied++, showAppAlert: (message) => context.alerts.push(message),
    showAppConfirm: async (_message, options) => { assert(options.yesText); context.confirmations++; return context.confirmed; },
    persist: () => { context.saves++; return context.failSave ? Promise.reject(new Error("save failed")) : Promise.resolve(); },
    handlePersistError: (error) => context.errors.push(error.message),
    renderShippingPage: () => {}, render: () => {}, TEXT: { noOrders: "empty" },
    shippingSummary: {}, shippingSearchInput: {},
  };
  for (const name of ["shippingFilterAllBtn", "shippingFilterPendingBtn", "shippingFilterDoneBtn"]) context[name] = { classList: { toggle() {} } };
  context.shippingTableBody = {
    innerHTML: "",
    querySelector(selector) {
      if (selector.startsWith("input")) return inputs[selector] ||= { value: selector.includes("ship-date") ? "2026-09-02" : "" };
      return null;
    },
    querySelectorAll(selector) {
      if (!this.innerHTML.includes(selector.slice(1))) return [];
      const button = { dataset: { orderId: order.id }, addEventListener: (_event, handler) => { button.click = handler; } };
      buttons[selector] = button;
      return [button];
    },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  context.draw = () => context.renderShippingPageCardOverride();
  context.click = async (selector, quantity = "") => {
    context.draw();
    inputs[`input[data-ship-qty-order-id="${order.id}"]`] = { value: String(quantity) };
    assert(buttons[selector], selector);
    await buttons[selector].click();
    await Promise.resolve();
  };
  return context;
}

const makeOrder = (extra = {}) => ({ id: "order", company: "Company", product: "Product", quantity: "10", dueDate: "2026-10-10", status: "working", shipments: [], ...extra });

async function run() {
  const legacy = makeOrder({ shipped: true, shippedDate: "2026-09-02" });
  let ctx = harness(legacy);
  ctx.syncOrderShippingState(legacy);
  assert.equal(ctx.getShippedQuantity(legacy), 10);
  assert.equal(legacy.shipments[0].quantityUnit, "ea");
  assert.equal(legacy.shipped, true);

  const metres = makeOrder({ quantity: "0.3", quantityUnit: "m", shipments: [{ qty: 0.1 }, { qty: 0.2 }] });
  ctx = harness(metres);
  ctx.syncOrderShippingState(metres);
  assert.equal(ctx.getShippedQuantity(metres), 0.3);
  assert.equal(ctx.getRemainingShippingQuantity(metres), 0);
  assert.equal(metres.shipped, true);
  assert.equal(ctx.normalizeShipmentRecord({ qty: 1, quantityUnit: "ea" }, metres).quantityUnit, "ea");
  assert.equal(ctx.normalizeShipmentRecord({ qty: 1 }).quantityUnit, "ea");

  const unknown = makeOrder({ quantityMode: "all-material", quantityUnit: "m", quantity: "", dueDate: "2026-09-01", shipped: true });
  ctx = harness(unknown);
  ctx.draw();
  assert.equal(ctx.getOrderQuantity(unknown), null);
  assert.equal(ctx.getRemainingShippingQuantity(unknown), null);
  assert.equal(unknown.shipped, false);
  assert.equal(unknown.shipments.length, 0);
  for (const filter of ["pending", "today"]) {
    ctx.shippingFilter = filter;
    assert.equal(ctx.getFilteredShippingOrders().length, 1);
  }
  ctx.shippingFilter = "done";
  assert.equal(ctx.getFilteredShippingOrders().length, 0);
  ctx.shippingFilter = "all";
  assert.match(ctx.shippingTableBody.innerHTML, /<strong>잔량<\/strong>미정/);
  assert.match(ctx.shippingTableBody.innerHTML, /추후 협의/);
  assert.match(ctx.shippingTableBody.innerHTML, /step="any"/);
  assert.match(ctx.shippingSummary.innerHTML, /<span>출하 대기<\/span>\s*<strong>1/);
  await ctx.click(".shipping-complete-btn");
  assert.equal(unknown.shipped, false);
  assert.equal(ctx.saves, 0);
  await ctx.click(".shipping-action-btn", "12.3456");
  assert.equal(ctx.getShippedQuantity(unknown), 12.3456);
  assert.equal(unknown.shipments[0].quantityUnit, "m");
  assert.equal(unknown.shipped, false);
  assert.match(ctx.getShippingStatus(unknown).label, /부분 출하/);
  ctx.confirmed = false;
  await ctx.click(".shipping-complete-btn");
  assert.equal(unknown.shipped, false);
  ctx.confirmed = true;
  ctx.allowed = false;
  const confirmations = ctx.confirmations;
  await ctx.click(".shipping-complete-btn");
  assert.equal(ctx.confirmations, confirmations);
  assert.equal(unknown.shipped, false);
  ctx.allowed = true;
  await ctx.click(".shipping-complete-btn");
  assert.equal(unknown.allMaterialShipmentComplete, true);
  assert.equal(unknown.shipments.length, 1);
  assert.equal(ctx.getRemainingShippingQuantity(unknown), 0);
  assert.equal(unknown.status, "working");
  assert.match(ctx.state.activities[0].message, /전량 출하 완료/);
  ctx.shippingFilter = "done";
  assert.equal(ctx.getFilteredShippingOrders().length, 1);
  ctx.shippingFilter = "all";
  await ctx.click(".shipping-reopen-btn");
  assert.equal(unknown.allMaterialShipmentComplete, false);
  assert.equal(unknown.shipments.length, 1);
  await ctx.click(".shipping-complete-btn", "0.5");
  assert.equal(unknown.shipments.length, 2);
  assert.equal(unknown.shipped, true);
  await ctx.click(".shipping-action-btn", "0.25");
  assert.equal(unknown.allMaterialShipmentComplete, false);
  assert.equal(unknown.shipments.length, 3);

  const pieces = makeOrder();
  ctx = harness(pieces);
  for (const value of ["", "0", "-1", "0.5", "Infinity", "NaN"]) await ctx.click(".shipping-action-btn", value);
  assert.equal(pieces.shipments.length, 0);
  await ctx.click(".shipping-action-btn", "3");
  assert.equal(ctx.getRemainingShippingQuantity(pieces), 7);
  await ctx.click(".shipping-complete-btn");
  assert.equal(pieces.shipped, true);
  await ctx.click(".shipping-edit-btn", "8");
  assert.equal(ctx.getShippedQuantity(pieces), 8);
  assert.equal(pieces.shipped, false);
  assert.equal(ctx.state.activities[0].previousShipments.length, 2);
  assert.equal(pieces.status, "working");
  ctx.failSave = true;
  await ctx.click(".shipping-action-btn", "1");
  assert.deepEqual(ctx.errors, ["save failed"]);

  const preserved = makeOrder({ quantityMode: "all-material", shipments: [{ id: "old", qty: 0, custom: "keep" }, { id: "real", qty: 2, quantityUnit: "ea" }] });
  ctx = harness(preserved);
  await ctx.click(".shipping-complete-btn");
  assert.equal(preserved.shipments.length, 2);
  assert.equal(preserved.shipments[0].custom, "keep");
  assert.equal(preserved.shipments[0].id, "old");

  const newFinal = makeOrder({ quantityMode: "all-material", quantity: "" });
  ctx = harness(newFinal);
  await ctx.click(".shipping-complete-btn", "1.5");
  assert.equal(newFinal.shipped, false);
  assert.equal(newFinal.shipments.length, 0);
  await ctx.click(".shipping-complete-btn", "5");
  assert.equal(newFinal.shipped, true);
  assert.equal(newFinal.shipments.length, 1);
  assert.equal(newFinal.shipments[0].qty, 5);
  assert.equal(newFinal.status, "working");
  console.log("shipping quantity modes tests passed");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
