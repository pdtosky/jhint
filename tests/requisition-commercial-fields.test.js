const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const { webcrypto } = require("node:crypto");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = source.search(new RegExp(`^function ${name}\\(`, "m"));
  assert.notEqual(start, -1, `${name} must exist in app.js`);
  // Top-level closing braces avoid counting default-object parameters or template braces.
  const tail = source.slice(start);
  const end = /^\}/m.exec(tail);
  assert.ok(end, `${name} must have a top-level closing brace`);
  const code = tail.slice(0, end.index + 1);
  new vm.Script(`(${code})`);
  return code;
}

const functionNames = [
  "normalizeCommercialFields", "normalizeOrderRecord", "normalizeRequisitionRecord",
  "buildOrderFromRequisitionItem", "getRequisitionProductText", "getRequisitionOrderNote",
  "getQuantityUnitLabel", "formatRequestedQuantity", "getCommercialPriceLabel",
  "formatUnitPrice", "parseMoneyValue", "getRequisitionItemAmount", "validateCommercialRecord",
  "getRequisitionPrintFit", "renderRequisitionPrintSheet", "escapeHtml",
  "formatDate", "formatDateTime", "getRequisitionStatusLabel", "getEffectiveRequisitionStatus",
  "createCompatibleRandomId", "generateRequisitionNo", "getTodayKey", "toDateKey",
  "readCommercialControls", "collectRequisitionItems"
];
const context = vm.createContext({ window: { crypto: webcrypto }, requisitionItems: null });
vm.runInContext(functionNames.map(extractFunction).join("\n"), context);
const plain = (value) => JSON.parse(JSON.stringify(value));
const keys = ["quantityMode", "quantityUnit", "priceStatus", "priceUnit", "materialLength"];
const commercial = (value) => Object.fromEntries(keys.map((key) => [key, value[key]]));
const defaults = {
  quantityMode: "fixed", quantityUnit: "ea", priceStatus: "confirmed", priceUnit: "ea", materialLength: ""
};
const item = (overrides = {}) => ({
  id: "item-1", name: "Synthetic product", spec: "Synthetic specification",
  quantity: "4", unitPrice: "10", sampleFee: "", ...defaults, ...overrides
});
const request = (items) => ({
  id: "request-1", requestNo: "REQ-TEST", company: "Synthetic company",
  orderDate: "2026-09-30", dueDate: "2026-10-01", createdAt: "2026-09-30T00:00:00Z",
  status: "pending", items
});

test("commercial defaults and invalid enums normalize without losing material length", () => {
  assert.deepEqual(plain(context.normalizeCommercialFields()), defaults);
  assert.deepEqual(plain(context.normalizeCommercialFields({
    quantityMode: "invalid", quantityUnit: "invalid", priceStatus: "invalid", priceUnit: "invalid"
  })), defaults);
  assert.equal(context.normalizeCommercialFields({ quantityUnit: "m" }).priceUnit, "m");
  assert.equal(context.normalizeCommercialFields({ materialLength: 12.75 }).materialLength, "12.75");
  assert.equal(context.normalizeCommercialFields({ materialLength: 0 }).materialLength, "0");
});

for (const quantityMode of ["fixed", "all-material"]) {
  for (const quantityUnit of ["ea", "m"]) {
    for (const priceStatus of ["confirmed", "undecided", "negotiable"]) {
      for (const priceUnit of ["ea", "m"]) {
        test(`normalization and conversion preserve ${quantityMode}/${quantityUnit}/${priceStatus}/${priceUnit}`, () => {
          const fields = { quantityMode, quantityUnit, priceStatus, priceUnit, materialLength: "123.75" };
          const original = item({ ...fields, quantity: quantityMode === "fixed" ? "4" : "" });
          const before = JSON.stringify(original);
          assert.deepEqual(plain(context.normalizeCommercialFields(original)), fields);
          assert.deepEqual(commercial(context.normalizeOrderRecord(original)), fields);
          const normalized = context.normalizeRequisitionRecord(request([original]));
          assert.deepEqual(commercial(normalized.items[0]), fields);
          const order = context.buildOrderFromRequisitionItem(normalized, normalized.items[0]);
          assert.ok(order.id);
          assert.deepEqual(commercial(order), fields);
          assert.equal(order.quantity, original.quantity);
          assert.equal(order.sourceUnitPrice, original.unitPrice);
          assert.equal(order.sourceRequisitionId, normalized.id);
          assert.equal(order.sourceRequisitionItemId, original.id);
          const reloaded = context.normalizeOrderRecord(plain(order));
          assert.deepEqual(commercial(reloaded), fields);
          assert.deepEqual(plain(context.normalizeRequisitionRecord(plain(normalized))), plain(normalized));
          assert.equal(JSON.stringify(original), before, "normalization must not mutate its input");
        });
      }
    }
  }
}

for (const zero of [0, "0"]) {
  test(`explicit ${typeof zero} zero price survives normalization, conversion and calculation`, () => {
    const original = item({ unitPrice: zero, price: "999" });
    const normalized = context.normalizeRequisitionRecord(request([original]));
    assert.equal(normalized.items[0].unitPrice, zero, "legacy price must not override explicit zero");
    assert.equal(context.normalizeOrderRecord(original).unitPrice, zero);
    const order = context.buildOrderFromRequisitionItem(normalized, normalized.items[0], "order-zero");
    assert.equal(order.sourceUnitPrice, zero);
    assert.equal(context.normalizeOrderRecord(plain(order)).sourceUnitPrice, zero);
    assert.equal(context.getRequisitionItemAmount(normalized.items[0]), 0);
    assert.equal(context.validateCommercialRecord(normalized.items[0]), "");
  });
}

test("legacy zero price fallback remains a known zero", () => {
  const normalized = context.normalizeRequisitionRecord(request([item({ unitPrice: undefined, price: 0 })]));
  assert.equal(normalized.items[0].unitPrice, 0);
  assert.equal(context.getRequisitionItemAmount(normalized.items[0]), 0);
});

const unknownCases = [
  ["undecided", { priceStatus: "undecided", unitPrice: "10" }],
  ["negotiable", { priceStatus: "negotiable", unitPrice: "0" }],
  ["empty price", { unitPrice: "" }],
  ["missing price", { unitPrice: undefined }],
  ["null price", { unitPrice: null }],
  ["whitespace price", { unitPrice: "  " }],
  ["all material", { quantityMode: "all-material", quantity: "100", materialLength: "100" }],
  ["ea quantity / m price", { quantityUnit: "ea", priceUnit: "m" }],
  ["m quantity / ea price", { quantityUnit: "m", priceUnit: "ea" }]
];
for (const [label, overrides] of unknownCases) {
  test(`amount stays unknown for ${label}, even with a sample fee`, () => {
    assert.equal(context.getRequisitionItemAmount(item(overrides)), null);
    assert.equal(context.getRequisitionItemAmount(item({ ...overrides, sampleFee: "50" })), null);
  });
}

test("fixed matched-unit amounts include decimal quantities and sample fees", () => {
  assert.equal(context.getRequisitionItemAmount(item()), 40);
  assert.equal(context.getRequisitionItemAmount(item({
    quantityUnit: "m", priceUnit: "m", quantity: "2.5", unitPrice: "12.5", sampleFee: "5"
  })), 36.25);
  assert.equal(context.getRequisitionItemAmount(item({ unitPrice: 0, sampleFee: "5" })), 5);
});

test("validation accepts decimal meters but rejects fractional pieces and invalid fixed quantities", () => {
  assert.equal(context.validateCommercialRecord(item({ quantityUnit: "m", quantity: "0.125" })), "");
  assert.notEqual(context.validateCommercialRecord(item({ quantityUnit: "ea", quantity: "0.125" })), "");
  assert.equal(context.validateCommercialRecord(item({ quantity: "2.0" })), "");
  for (const quantity of ["", "0", "-1", "NaN", "Infinity"]) {
    for (const quantityUnit of ["ea", "m"]) {
      assert.notEqual(context.validateCommercialRecord(item({ quantity, quantityUnit })), "", `${quantityUnit}:${quantity}`);
    }
  }
  assert.equal(context.validateCommercialRecord(item({ quantityMode: "all-material", quantity: "", materialLength: "1.25" })), "");
  for (const materialLength of ["0", "-1", "bad", "Infinity"]) {
    assert.notEqual(context.validateCommercialRecord(item({ materialLength })), "");
  }
  for (const unitPrice of ["-1", "bad", "Infinity"]) {
    assert.notEqual(context.validateCommercialRecord(item({ unitPrice })), "");
  }
});

function printSections(items) {
  const html = context.renderRequisitionPrintSheet(request(items));
  const table = html.match(/<table class="print-item-table">([\s\S]*?)<\/table>/);
  assert.ok(table, "print item table must exist");
  const footer = table[1].match(/<tfoot>([\s\S]*?)<\/tfoot>/);
  assert.ok(footer, "print totals must exist");
  const cells = [...footer[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1].trim());
  return { html, table: table[1], quantity: cells[0], amount: cells[3] };
}

test("print totals keep pieces and meters separate and mark all-material totals unknown", () => {
  const result = printSections([
    item({ id: "ea-1", quantity: "2" }),
    item({ id: "ea-2", quantity: "3" }),
    item({ id: "m-1", quantityUnit: "m", priceUnit: "m", quantity: "1.25" }),
    item({ id: "m-2", quantityUnit: "m", priceUnit: "m", quantity: "2.5" }),
    item({ id: "all", quantityMode: "all-material", quantity: "999", materialLength: "123.5" })
  ]);
  assert.equal(result.quantity, "5\uac1c / 3.75m / \uc804\ub7c9 \uc791\uc5c5 \ubcc4\ub3c4");
  assert.equal(result.amount, "\ubbf8\uc815 \ud3ec\ud568");
  assert.match(result.table, /123\.5m/);
});

for (const [label, overrides] of unknownCases) {
  test(`print total is unknown rather than a partial numeric total for ${label}`, () => {
    const result = printSections([item({ id: "known" }), item({ id: "unknown", ...overrides })]);
    assert.equal(result.amount, "\ubbf8\uc815 \ud3ec\ud568");
    assert.match(result.table, />\ubbf8\uc815<\/td>/);
  });
}

test("print known mixed-unit amount and explicit zero remain numeric", () => {
  const mixed = printSections([item({ quantity: "2" }), item({ quantityUnit: "m", priceUnit: "m", quantity: "1.5" })]);
  assert.equal(mixed.quantity, "2\uac1c / 1.5m");
  assert.equal(mixed.amount, "35");
  const zero = printSections([item({ unitPrice: 0 })]);
  assert.equal(zero.amount, "0");
  assert.match(zero.table, />0<\/td>/);
});

function formRow(record) {
  const values = {
    ...record, requestItemName: record.name, requestItemSpec: record.spec,
    requestItemQty: record.quantity, requestItemUnitPrice: record.unitPrice,
    requestItemSampleFee: record.sampleFee
  };
  return {
    dataset: { itemId: record.id },
    querySelector(selector) {
      const name = selector.match(/^\[name="([^"]+)"\]$/)?.[1];
      return Object.hasOwn(values, name) ? { value: String(values[name] ?? "") } : null;
    }
  };
}

test("edit-form collection roundtrips commercial fields, IDs and zero price", () => {
  const originals = [
    item({ id: "fixed-m", quantityUnit: "m", priceUnit: "m", quantity: "2.75", unitPrice: 0, materialLength: "12.5" }),
    item({ id: "all-ea", quantityMode: "all-material", priceStatus: "negotiable", priceUnit: "m", quantity: "999", materialLength: "100.5" }),
    item({ id: "undecided", priceStatus: "undecided", materialLength: "20" })
  ];
  context.requisitionItems = { querySelectorAll: () => originals.map(formRow) };
  try {
    const collected = context.collectRequisitionItems();
    assert.equal(collected.length, originals.length);
    const reloaded = context.normalizeRequisitionRecord(plain(request(collected)));
    reloaded.items.forEach((record, index) => {
      assert.deepEqual(commercial(record), commercial(originals[index]));
      assert.equal(record.id, originals[index].id);
      assert.equal(record.name, originals[index].name);
    });
    assert.equal(reloaded.items[0].unitPrice, "0");
    assert.equal(reloaded.items[0].quantity, "2.75");
    assert.equal(reloaded.items[1].quantity, "", "disabled stale quantity must not become an all-material target");
    assert.equal(reloaded.items[1].unitPrice, "");
    assert.equal(reloaded.items[2].unitPrice, "", "unknown status must not submit a stale numeric price");
  } finally {
    context.requisitionItems = null;
  }
});
