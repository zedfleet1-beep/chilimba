import { chromium } from 'playwright';

const BASE = 'http://localhost:5174';
const GROUP_ID = '6d1c3fd5-90cf-482e-97d3-f2b665f9fcaf';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const apiCalls = [];

  page.on('response', async (res) => {
    if (res.url().includes('/api/v1/')) {
      let body = '';
      try {
        body = (await res.text()).slice(0, 400);
      } catch {}
      apiCalls.push({ url: res.url(), status: res.status(), body });
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') apiCalls.push({ console: msg.text() });
  });

  await page.goto(`${BASE}/login?next=/groups/${GROUP_ID}/cycles`);
  await page.getByRole('textbox', { name: /97 712/ }).fill('963285865');
  await page.locator('input[autocomplete=current-password]').first().fill('sTBvg7U2YQLEdpJ');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`**/groups/${GROUP_ID}/cycles`, { timeout: 20000 });
  await page.waitForTimeout(5000);

  const bodyText = await page.locator('body').innerText();
  console.log(JSON.stringify({
    url: page.url(),
    bodySnippet: bodyText.slice(0, 800),
    apiCalls,
  }, null, 2));

  await browser.close();
}

main();