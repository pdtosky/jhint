const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");

assert(indexHtml.includes('id="adminJournalDateInput"'), "admin journal should include a day selector");
assert(indexHtml.includes('id="adminJournalTodayBtn"'), "admin journal should include a quick today button");
assert(indexHtml.includes('id="adminJournalClearDayBtn"'), "admin journal should allow returning to the whole month");
assert(indexHtml.includes('id="journalSummary"'), "admin journal should render daily worker summary cards");

assert(appJs.includes("let adminJournalDateFilter"), "app.js should track the selected journal day");
assert(appJs.includes("const adminJournalDateInput"), "app.js should bind the journal day input");
assert(appJs.includes("function getFilteredProductionJournalRows"), "journal rows should be filtered by selected month and day");
assert(appJs.includes("function renderJournalSummary"), "journal should render a capture-friendly daily worker summary");
assert(appJs.includes("function setAdminJournalDateFilter"), "journal day selection should keep month and day filters in sync");
assert(!appJs.includes("adminJournalDateInput.min"), "journal date picker should not block past months with a min date");
assert(!appJs.includes("adminJournalDateInput.max"), "journal date picker should not block future/past month navigation with a max date");

const finalRenderJournalStart = appJs.lastIndexOf("function renderJournalList");
const finalRenderWorkerEfficiencyStart = appJs.indexOf("function renderWorkerEfficiency", finalRenderJournalStart);
const finalRenderJournalBody = appJs.slice(finalRenderJournalStart, finalRenderWorkerEfficiencyStart);

assert(finalRenderJournalBody.includes("renderJournalSummary(rows)"), "renderJournalList should update the daily worker summary");
assert(finalRenderJournalBody.includes("journal-day-group"), "renderJournalList should group work by day for capture");
assert(finalRenderJournalBody.includes("journal-day-title"), "renderJournalList should show the selected date heading");
assert(!appJs.includes("journal-summary-worker"), "journal should not render separate worker summary cards");
assert(finalRenderJournalBody.includes("journal-report-table"), "journal details should render as a report-style table/list");
assert(finalRenderJournalBody.includes("journal-report-row"), "journal details should use compact report rows");
assert(!finalRenderJournalBody.includes("item.note"), "journal rows should avoid repeated completion note text in the executive report view");

assert(styleCss.includes(".journal-filter-bar"), "journal day controls should have dedicated layout styles");
assert(styleCss.includes(".journal-summary-grid"), "daily worker summary should use a compact grid");
assert(styleCss.includes(".journal-day-group"), "daily journal details should have grouped capture styles");
assert(styleCss.includes(".journal-report-table"), "journal report table should have dedicated styles");
assert(styleCss.includes(".journal-report-row"), "journal report rows should have dedicated styles");

console.log("admin journal test passed");
