const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert(indexHtml.includes('id="equipmentReportMachineSelect"'), "equipment report should allow selecting one machine");
assert(indexHtml.includes('id="equipmentReportPrintBtn"'), "equipment report should provide print/PDF output");
assert(indexHtml.includes('id="equipmentReportContent"'), "equipment report should have a dedicated document area");

assert(appJs.includes("function buildEquipmentDailyReport"), "daily equipment report data should be calculated separately");
assert(appJs.includes("function splitEquipmentIntervalByDay"), "work intervals should be split by calendar day");
assert(appJs.includes('["start", "pause", "temporaryPause", "end"]'), "start, pause, break, and completion events should define operating intervals");
assert(appJs.includes("interval[0] > last[1]"), "overlapping intervals for the same machine should be merged");
assert(appJs.includes("8 * 60 * 60 * 1000"), "daily utilization should use an eight-hour standard");
assert(appJs.includes("Math.min(100"), "daily and monthly utilization should be capped at 100 percent");
assert(appJs.includes("function getEquipmentReportWorkdayKeys"), "current-month reports should exclude future workdays");
assert(appJs.includes("getAdminWorkingDayKeys(monthKey)"), "monthly report should reuse weekend and holiday exclusions");
assert(appJs.includes("function printEquipmentMonthlyReport"), "monthly report should support printing");
assert(appJs.includes("A4 landscape"), "printed report should use an A4 landscape document");

assert(styleCss.includes(".equipment-report-table"), "equipment report should use an aligned table");
assert(styleCss.includes(".equipment-report-summary"), "equipment report should show monthly summary metrics");
assert(styleCss.includes("overflow-x: auto"), "the report table should stay usable on narrow screens");
assert(swJs.includes("v20260807-01"), "service worker cache should refresh for the equipment report release");

console.log("admin equipment monthly report test passed");
