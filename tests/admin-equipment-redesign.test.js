const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");

assert(!indexHtml.includes('data-admin-section="overview"'), "admin summary tab should be removed");
assert(!indexHtml.includes('data-admin-panel="overview"'), "admin summary panel should be removed");
assert(indexHtml.includes('class="tab-btn active" data-admin-section="accounts"'), "account tab should remain the default admin tab");

assert(appJs.includes("function getEquipmentUtilTone"), "equipment utilization should have clear status tone rules");
assert(appJs.includes("function renderEquipmentDetailRows"), "equipment cards should include expandable job details");
assert(appJs.includes("equipment-card-grid"), "equipment list should render in the new compact card grid");
assert(appJs.includes("equipment-tone-over"), "equipment utilization should mark over-100 percent values for review");
assert(appJs.includes("productionQty"), "equipment cards should include production quantity aggregation");
assert(appJs.includes("totalHitQty"), "equipment cards should include hit quantity aggregation");
assert(appJs.includes("plannedMs"), "equipment cards should show monthly available-time basis");
assert(appJs.includes("item.orders"), "equipment cards should keep source orders for details");

assert(styleCss.includes(".equipment-card-grid"), "equipment cards should have a dedicated responsive grid");
assert(styleCss.includes(".equipment-metrics"), "equipment cards should use compact metric cells");
assert(styleCss.includes(".equipment-detail-row"), "equipment expanded details should have compact rows");
assert(styleCss.includes(".equipment-tone-high"), "equipment utilization should have a high/normal color");
assert(styleCss.includes(".equipment-tone-good"), "equipment utilization should have a moderate color");
assert(styleCss.includes(".equipment-tone-low"), "equipment utilization should have a low color");
assert(styleCss.includes(".equipment-tone-over"), "equipment utilization should have an over-limit color");

console.log("admin equipment redesign test passed");
