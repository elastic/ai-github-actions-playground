import { chromium } from 'playwright';

const OUTPUT_DIR = '/tmp/playwright-logs';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Mock the ES /_query endpoint to return fake trace results
  await page.route('**/mock-es:9200/**', async route => {
    const url = route.request().url();
    if (url.includes('/_query')) {
      const mockResponse = {
        columns: [
          { name: 'trace.id', type: 'keyword' },
          { name: 'service.name', type: 'keyword' },
          { name: 'name', type: 'keyword' },
          { name: 'attributes.span.duration.us', type: 'long' },
          { name: 'status', type: 'keyword' },
          { name: '@timestamp', type: 'date' }
        ],
        values: [
          ['trace-abc123', 'frontend', 'GET /api/checkout', 250000, 'OK', '2026-02-22T12:00:00.000Z'],
          ['trace-def456', 'order-service', 'POST /orders', 180000, 'OK', '2026-02-22T12:00:01.000Z'],
          ['trace-ghi789', 'payment-service', 'chargeCard', 95000, 'Error', '2026-02-22T12:00:02.000Z'],
        ]
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResponse) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
  });

  await page.goto('http://127.0.0.1:3000/ai-github-actions-playground/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Set connected + connection URL via Zustand store, then navigate to traces
  await page.evaluate(async () => {
    const { useConnectionStore } = await import('/ai-github-actions-playground/src/store/useConnectionStore.ts');
    useConnectionStore.getState().setConnection({ url: 'http://mock-es:9200' });
    useConnectionStore.getState().setConnected(true);
    window.location.hash = '#/traces';
  });

  await page.waitForTimeout(1500);
  
  // Check what's on the page
  const title = await page.title();
  const bodyText = await page.locator('body').innerText();
  console.log('Page title:', title);
  console.log('Body preview:', bodyText.substring(0, 200));

  // Take screenshot 1: Traces page with view mode buttons
  await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-traces-overview.png` });
  console.log('Saved traces overview screenshot');

  // Click Search Traces button
  const searchBtn = page.getByRole('button', { name: 'Search Traces' });
  await searchBtn.waitFor({ timeout: 10000 });
  await searchBtn.click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-traces-list-results.png` });
  console.log('Saved list with results screenshot');

  // Click Service Map tab
  await page.getByRole('button', { name: 'Service Map' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-service-map-no-trace.png` });
  console.log('Saved service map (no trace selected) screenshot');

  // Inject span data
  await page.evaluate(async () => {
    const { useTracesStore } = await import('/ai-github-actions-playground/src/store/useTracesStore.ts');
    const mockSpans = [
      { 'span.id': 'span-001', 'trace.id': 'trace-abc123', 'parent.id': null, 'service.name': 'frontend', name: 'GET /api/checkout', '@timestamp': '2026-02-22T12:00:00.000Z', 'attributes.span.duration.us': 250000, kind: 'SERVER', status: 'OK', labels: {} },
      { 'span.id': 'span-002', 'trace.id': 'trace-abc123', 'parent.id': 'span-001', 'service.name': 'order-service', name: 'processOrder', '@timestamp': '2026-02-22T12:00:00.020Z', 'attributes.span.duration.us': 200000, kind: 'CLIENT', status: 'OK', labels: {} },
      { 'span.id': 'span-003', 'trace.id': 'trace-abc123', 'parent.id': 'span-002', 'service.name': 'inventory-service', name: 'checkInventory', '@timestamp': '2026-02-22T12:00:00.040Z', 'attributes.span.duration.us': 80000, kind: 'CLIENT', status: 'OK', labels: {} },
      { 'span.id': 'span-004', 'trace.id': 'trace-abc123', 'parent.id': 'span-002', 'service.name': 'payment-service', name: 'chargeCard', '@timestamp': '2026-02-22T12:00:00.130Z', 'attributes.span.duration.us': 60000, kind: 'CLIENT', status: 'OK', labels: {} },
      { 'span.id': 'span-005', 'trace.id': 'trace-abc123', 'parent.id': 'span-004', 'service.name': 'fraud-detection', name: 'analyzeTransaction', '@timestamp': '2026-02-22T12:00:00.135Z', 'attributes.span.duration.us': 30000, kind: 'INTERNAL', status: 'OK', labels: {} },
      { 'span.id': 'span-006', 'trace.id': 'trace-abc123', 'parent.id': 'span-002', 'service.name': 'notification-service', name: 'sendEmail', '@timestamp': '2026-02-22T12:00:00.200Z', 'attributes.span.duration.us': 15000, kind: 'PRODUCER', status: 'OK', labels: {} },
      { 'span.id': 'span-007', 'trace.id': 'trace-abc123', 'parent.id': 'span-001', 'service.name': 'user-service', name: 'getProfile', '@timestamp': '2026-02-22T12:00:00.010Z', 'attributes.span.duration.us': 25000, kind: 'CLIENT', status: 'OK', labels: {} },
    ];
    useTracesStore.getState().setSelectedTraceId('trace-abc123');
    useTracesStore.getState().setSelectedTraceSpans(mockSpans);
  });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-service-map-with-trace.png` });
  console.log('Saved service map with trace screenshot');

  await browser.close();
  console.log('Done!');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
