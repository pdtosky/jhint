const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    let saved = { orders: [], requisitions: [], activities: [] };
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://127.0.0.1:4789') return route.abort();
      if (url.pathname === '/api/state') {
        if (route.request().method() !== 'GET') saved = JSON.parse(route.request().postData());
        return route.fulfill({ json: saved });
      }
      if (url.pathname === '/config.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.APP_CONFIG={backend:"api",requireGlobalLogin:false};' });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
      const file = path.join(process.cwd(), url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.abort();
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/json';
      return route.fulfill({ contentType: type, body: fs.readFileSync(file) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:4789');
    await page.waitForSelector('#requestItems, #requisitionItems', { state: 'attached' });
    await page.evaluate(() => {
      currentAdminRole = 'admin'; currentAdminEmail = 'synthetic@example.test'; isAdminLoggedIn = true; isRequisitionLoggedIn = true;
      render(); switchView('requisitionView');
    });
    const rows = page.locator('.request-item-row');
    await rows.first().locator('[name="requestItemName"]').fill('Synthetic full material');
    await rows.first().locator('[name="quantityMode"]').selectOption('all-material');
    await rows.first().locator('[name="materialLength"]').fill('100.5');
    await rows.first().locator('[name="priceStatus"]').selectOption('negotiable');
    assert.equal(await rows.first().locator('[name="requestItemQty"]').isDisabled(), true);
    assert.equal(await rows.first().locator('[name="requestItemUnitPrice"]').isDisabled(), true);
    await page.evaluate(() => addRequisitionItemRow({ name: 'Synthetic meters', quantity: '10.5', quantityUnit: 'm', unitPrice: '200', priceUnit: 'm' }));
    const collected = await page.evaluate(() => collectRequisitionItems());
    assert.equal(collected[0].quantityMode, 'all-material');
    assert.equal(collected[0].priceStatus, 'negotiable');
    assert.equal(collected[1].quantityUnit, 'm');
    await page.evaluate(() => {
      requisitionForm.elements.requestCompany.value = 'Synthetic test company';
      requisitionForm.elements.requesterName.value = 'Test';
      handleRequisitionSubmit();
    });
    await page.waitForTimeout(150);
    const request = saved.requisitions.find((r) => r.company === 'Synthetic test company');
    assert(request, 'submitted requisition persisted in mock only');
    assert.equal(request.items[0].priceStatus, 'negotiable');
    await page.evaluate(() => {
      document.querySelectorAll('.modal-backdrop').forEach((node) => node.hidden = true);
      const request = state.requisitions.find((r) => r.company === 'Synthetic test company');
      request.items.forEach((item) => createOrderFromRequisitionItem(request, item));
      render(); switchView('ordersView');
      openOrderEditPanel(state.orders.find((o) => o.quantityMode === 'all-material').id);
    });
    assert.equal(await page.locator('#editQuantity').isDisabled(), true);
    assert.equal(await page.locator('#orderEditForm [name="priceStatus"]').inputValue(), 'negotiable');
    await page.locator('#orderEditForm [name="priceStatus"]').selectOption('confirmed');
    await page.locator('#orderEditForm [name="commercialUnitPrice"]').fill('123');
    await page.locator('#orderEditForm button[type="submit"]').click();
    await page.waitForTimeout(100);
    assert.equal(saved.orders.find((o) => o.quantityMode === 'all-material').sourceUnitPrice, '123');
    await page.evaluate(() => { switchView('shippingView'); shippingFilter = 'all'; isShippingListOpen = true; renderShippingPage(); });
    const fullOrder = saved.orders.find((o) => o.quantityMode === 'all-material');
    await page.locator(`[data-ship-qty-order-id="${fullOrder.id}"]`).fill('500');
    await page.locator(`.shipping-action-btn[data-order-id="${fullOrder.id}"]`).click();
    await page.waitForTimeout(100);
    assert.equal(saved.orders.find((o) => o.id === fullOrder.id).shipped, false);
    await page.locator(`.shipping-complete-btn[data-order-id="${fullOrder.id}"]`).click();
    await page.locator('#appConfirmYesBtn').click();
    await page.waitForTimeout(100);
    const shipped = saved.orders.find((o) => o.id === fullOrder.id);
    assert.equal(shipped.shipped, true);
    assert.equal(shipped.shipments.length, 1, 'marking existing shipment complete does not duplicate quantity');
    assert.equal(shipped.status, 'ready', 'shipping does not fabricate production completion');
    const meterOrder = saved.orders.find((o) => o.quantityUnit === 'm');
    await page.locator(`[data-ship-qty-order-id="${meterOrder.id}"]`).fill('0.5');
    await page.locator(`.shipping-action-btn[data-order-id="${meterOrder.id}"]`).click();
    await page.waitForTimeout(100);
    assert.equal(saved.orders.find((o) => o.id === meterOrder.id).shipments[0].qty, 0.5);
    assert.equal(saved.orders.find((o) => o.id === meterOrder.id).shipments[0].quantityUnit, 'm');
    await page.reload();
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => state.orders.find((o) => o.quantityMode === 'all-material').allMaterialShipmentComplete), true);
    await page.evaluate(() => { currentAdminRole = 'admin'; currentAdminEmail = 'synthetic@example.test'; isAdminLoggedIn = true; isRequisitionLoggedIn = true; render(); });
    await page.evaluate(() => { switchView('requisitionView'); loadRequisitionForEdit(state.requisitions[0]); });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.querySelectorAll('.modal-backdrop').forEach((node) => node.hidden = true));
    const layout = await rows.first().locator('.commercial-fields').evaluate((node) => ({ width: node.getBoundingClientRect().width, scroll: node.scrollWidth }));
    assert(layout.scroll <= layout.width + 2, 'commercial controls fit mobile width');
    await page.screenshot({ path: path.join(process.cwd(), '..', 'outputs', 'commercial-mobile.png'), fullPage: true });
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    console.log('commercial browser smoke passed (isolated mock API; no real data accessed)');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
