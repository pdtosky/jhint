const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const origin = 'http://127.0.0.1:4791';
const baseline = execFileSync('git', ['show', '98ad059:app.js'], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
function fixture() {
  const today = new Date().toISOString().slice(0, 10);
  const orders = Array.from({ length: 600 }, (_, i) => ({
    id: `test-order-${i}`, company: `Synthetic company ${i % 40}`, product: `Synthetic product ${i}`,
    orderDate: today, dueDate: today, quantity: '1000', status: i < 8 ? 'working' : 'complete',
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: i < 8 ? '' : new Date().toISOString(), elapsedMs: 3600000,
    workerName: `Test worker ${i % 8}`, machineName: `${i % 7 + 1} test machine`,
    productionQty: i < 8 ? '0' : '1000', totalHitQty: '1000', shipped: i >= 8, shippedDate: i >= 8 ? today : '',
    orderNote: 'Synthetic note: check direction before production', deliveryType: 'Test'
  }));
  return {
    orders,
    requisitions: Array.from({ length: 200 }, (_, i) => ({
      id: `test-request-${i}`, requestNo: `REQ-TEST-${i}`, company: `Synthetic company ${i % 40}`,
      requesterName: 'Test requester', orderDate: today, dueDate: today, createdAt: new Date().toISOString(),
      status: i < 3 ? 'pending' : 'converted', items: orders.slice(i * 3, i * 3 + 3).map(o => ({ id: `item-${o.id}`, name: o.product, quantity: '1000', orderId: i < 3 ? '' : o.id }))
    })),
    activities: orders.flatMap(o => ['start', 'pause', 'start', 'end'].map((type, i) => ({
      id: `activity-${o.id}-${i}`, orderId: o.id, type, workerName: o.workerName,
      machineName: o.machineName, timestamp: new Date(Date.now() - (4 - i) * 3600000).toISOString(),
      message: 'Synthetic work record', workQty: '1000', workHitQty: '1000', elapsedMs: 3600000
    })))
  };
}

async function run(browser, useBaseline) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let saved = fixture();
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/state') {
      if (route.request().method() !== 'GET') saved = JSON.parse(route.request().postData());
      return route.fulfill({ json: saved });
    }
    if (url.pathname === '/config.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.APP_CONFIG={backend:"api",requireGlobalLogin:false};' });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    const file = path.join(process.cwd(), url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.abort();
    return route.fulfill({
      contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/json',
      body: useBaseline && url.pathname === '/app.js' ? baseline : fs.readFileSync(file)
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const started = Date.now();
  await page.goto(origin);
  await page.locator('#appStartupScreen').waitFor({ state: 'hidden' });
  const startupMs = Date.now() - started;
  await page.evaluate(() => {
    clearInterval(dashboardTimerId);
    stopStatePolling();
    currentAdminEmail = 'synthetic@example.test'; currentAdminRole = 'admin';
    currentAdminDisplayName = 'Test worker'; isAdminLoggedIn = true; isRequisitionLoggedIn = true;
    switchView('workerView'); render();
  });
  const metrics = await page.evaluate(() => {
    const samples = [];
    for (let i = 0; i < 3; i++) { const start = performance.now(); render(); samples.push(performance.now() - start); }
    return { elements: document.querySelectorAll('*').length, workerRenderMs: samples.sort((a, b) => a - b)[1] };
  });
  metrics.startupMs = startupMs;
  if (!useBaseline) {
    assert.equal(await page.locator('.sop-module-frame').count(), 0, 'SOP frame is not loaded until opened');
    assert.equal(await page.locator('#adminLogList article').count(), 0, 'hidden admin logs not built');
    await page.locator('.page-tabs [data-view-target="ordersView"]').click();
    assert(await page.locator('#ordersTableBody tr').count() > 0, 'opened orders view renders immediately');
    await page.locator('.page-tabs [data-view-target="workerView"]').click();
    await page.locator('#workerForm [name="machineName"]').fill('Draft machine');
    await page.locator('.page-tabs [data-view-target="dashboardView"]').click();
    await page.locator('.page-tabs [data-view-target="workerView"]').click();
    assert.equal(await page.locator('#workerForm [name="machineName"]').inputValue(), 'Draft machine', 'draft preserved across tabs');
    await page.locator('.page-tabs [data-view-target="shippingView"]').click();
    await page.evaluate(() => { isShippingListOpen = true; renderShippingPage(); });
    const draftNote = page.locator('[data-note-order-id="test-order-0"]');
    const draftQuantity = page.locator('[data-ship-qty-order-id="test-order-0"]');
    const draftDate = page.locator('[data-ship-date-order-id="test-order-0"]');
    await draftNote.fill('Unsaved shipping note');
    await draftQuantity.fill('123');
    await draftDate.fill('2026-11-10');
    await page.locator('.page-tabs [data-view-target="dashboardView"]').click();
    await page.locator('.page-tabs [data-view-target="shippingView"]').click();
    assert.equal(await draftNote.inputValue(), 'Unsaved shipping note', 'navigation retains unsaved note');
    assert.equal(await draftQuantity.inputValue(), '123', 'navigation retains unsaved quantity');
    assert.equal(await draftDate.inputValue(), '2026-11-10', 'navigation retains unsaved date');
    await page.evaluate(() => render());
    assert.equal(await draftQuantity.inputValue(), '123', 'background render retains unsaved quantity');
    await page.locator('.page-tabs [data-view-target="adminView"]').click();
    await page.locator('[data-admin-section="logs"]').click();
    assert(await page.locator('#adminLogList article').count() > 0, 'selected logs rendered');
    await page.locator('[data-admin-section="equipment"]').click();
    assert(await page.locator('#equipmentList').innerText(), 'equipment section remains available');
    await page.locator('.page-tabs [data-view-target="sopView"]').click();
    assert.equal(await page.locator('.sop-module-frame').count(), 1, 'SOP loads on demand');
    await page.locator('.page-tabs [data-view-target="workerView"]').click();
    await page.clock.install();
    const identity = await page.evaluate(() => {
      startDashboardClock();
      window.testLiveButton = document.querySelector('#workerLiveStatus button');
      return Boolean(window.testLiveButton);
    });
    assert(identity, 'fixture has live work controls');
    await page.clock.fastForward(2000);
    assert(await page.evaluate(() => window.testLiveButton === document.querySelector('#workerLiveStatus button')), 'clock ticks must preserve live control nodes');
    assert.equal(await page.locator('#workerForm [name="machineName"]').inputValue(), 'Draft machine');
  }
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  await context.close();
  return metrics;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const before = await run(browser, true);
    const after = await run(browser, false);
    console.log(JSON.stringify({ fixture: { orders: 600, activities: 2400, requisitions: 200 }, before, after }));
    assert(after.elements < before.elements / 3, 'initial hidden DOM reduced by at least two thirds');
    console.log('performance browser checks passed; isolated synthetic data, no live requests');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
