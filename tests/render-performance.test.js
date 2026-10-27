const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const renders = [
  'renderStats', 'renderProgress', 'renderDashboardFilteredList', 'renderCalendar',
  'renderWorkerSnapshotBoard', 'renderOrdersTable', 'renderOrderSuggestions',
  'renderRequisitionPage', 'renderOrderOptions', 'renderActivities', 'renderWorkerLiveStatus',
  'renderShippingPage', 'renderAdminPage', 'renderSopPage'
];
const calls = [];
const ctx = {
  REQUIRE_GLOBAL_LOGIN: true, currentAdminEmail: 'synthetic@example.test',
  canAccessView: () => true, getActiveViewId: () => 'workerView',
  captureShippingDrafts: () => new Map(), restoreShippingDrafts() {}
};
for (const name of renders) ctx[name] = () => calls.push(name);
vm.createContext(ctx);
vm.runInContext(extract('renderActiveView'), ctx);
const expected = {
  dashboardView: ['renderStats', 'renderProgress', 'renderDashboardFilteredList', 'renderCalendar', 'renderWorkerSnapshotBoard'],
  ordersView: ['renderOrdersTable', 'renderOrderSuggestions'],
  requisitionView: ['renderRequisitionPage', 'renderOrderSuggestions'],
  workerView: ['renderOrderOptions', 'renderActivities', 'renderWorkerLiveStatus'],
  shippingView: ['renderShippingPage'], adminView: ['renderAdminPage'], sopView: ['renderSopPage'], chatView: []
};
for (const [view, wanted] of Object.entries(expected)) {
  calls.length = 0;
  ctx.renderActiveView(view);
  assert.deepEqual(calls, wanted, `${view} must not build hidden lists`);
}
calls.length = 0;
ctx.currentAdminEmail = '';
ctx.renderActiveView('workerView');
assert.deepEqual(calls, [], 'logged-out sessions cannot build data panels');
ctx.currentAdminEmail = 'synthetic@example.test';
ctx.canAccessView = () => false;
ctx.renderActiveView('adminView');
assert.deepEqual(calls, [], 'unauthorized views cannot render');

const sections = ['overview', 'equipment', 'mold', 'journal', 'worker', 'logs', 'accounts'];
const adminCalls = [];
const adminCtx = {
  adminMonthInput: {}, adminMonthFilter: 'all', adminAllMonthsBtn: null,
  adminSearchInput: null, adminJournalDateInput: null, adminLogSearchInput: null,
  adminActiveSection: '', renderAdminSections() {}, shouldRenderAdminAccountsInPageRender: () => true
};
const sectionRenders = {
  overview: 'renderAdminOverview', equipment: 'renderEquipmentList', mold: 'renderMoldList',
  journal: 'renderJournalList', worker: 'renderWorkerEfficiency', logs: 'renderAdminLogs', accounts: 'renderAdminAccounts'
};
for (const name of Object.values(sectionRenders)) adminCtx[name] = () => adminCalls.push(name);
vm.createContext(adminCtx);
vm.runInContext(extract('renderAdminPage'), adminCtx);
for (const section of sections) {
  adminCalls.length = 0;
  adminCtx.adminActiveSection = section;
  adminCtx.renderAdminPage();
  assert.deepEqual(adminCalls, [sectionRenders[section]], 'only selected admin section is computed');
}
adminCalls.length = 0;
adminCtx.shouldRenderAdminAccountsInPageRender = () => false;
adminCtx.renderAdminPage();
assert.deepEqual(adminCalls, [], 'account editor redraw guard stays active');
assert.match(extract('switchView'), /renderActiveView\(targetId\)/, 'switching views refreshes previously hidden data');
assert.match(extract('render'), /updateRequisitionPendingBadge\(\)/, 'navigation badge remains current');
assert.match(extract('render'), /!calendarDetailModal.hidden && selectedCalendarDateKey/, 'data changes refresh open calendar detail outside the timer');
const activeActivitiesStart = source.lastIndexOf('function renderActivities(');
const activeActivities = source.slice(activeActivitiesStart, source.indexOf('\n}', activeActivitiesStart) + 2);
assert(activeActivities.indexOf('if (!isActivityFeedOpen)') < activeActivities.indexOf('getSortedOrders(state.orders)'), 'closed history must not sort records before returning');
const makeField = (attribute, id, value, baseline, disabled = false) => ({
  value, defaultValue: baseline, disabled, focused: false,
  hasAttribute: name => name === attribute, getAttribute: () => id,
  focus() { this.focused = true; }
});
let fields = [
  makeField('data-ship-qty-order-id', 'one', '7', ''),
  makeField('data-note-order-id', 'one', 'draft', 'saved'),
  makeField('data-note-order-id', 'locked', 'draft', '', true)
];
const draftCtx = { shippingTableBody: { querySelectorAll: () => fields }, document: { activeElement: fields[0] } };
vm.createContext(draftCtx);
vm.runInContext(extract('captureShippingDrafts') + '\n' + extract('restoreShippingDrafts'), draftCtx);
const drafts = draftCtx.captureShippingDrafts();
assert.equal(drafts.size, 2, 'only editable dirty fields are captured');
fields = [makeField('data-ship-qty-order-id', 'one', '', ''), makeField('data-note-order-id', 'one', 'remote', 'remote')];
draftCtx.restoreShippingDrafts(drafts);
assert.equal(fields[0].value, '7');
assert.equal(fields[0].focused, true);
assert.equal(fields[1].value, 'remote', 'saved changes from other users are not overwritten by drafts');
fields[0].value = ''; fields[0].disabled = true;
draftCtx.restoreShippingDrafts(drafts);
assert.equal(fields[0].value, '', 'newly locked fields cannot restore a draft');
console.log('active view rendering, permissions, admin sections and account editor guards passed');
