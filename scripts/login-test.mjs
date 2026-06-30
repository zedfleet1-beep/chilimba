import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('https://chilimba.zedfleet.com/login?next=/dashboard', { waitUntil: 'networkidle' });

  const phoneInput = page.locator('input[type="tel"], input[inputmode="tel"], input[placeholder*="3456"]').first();
  await phoneInput.fill('963285865');
  await page.locator('input[type="password"]').fill('Prince');

  const signIn = page.getByRole('button', { name: /sign in/i });
  await signIn.waitFor({ state: 'visible', timeout: 10000 });
  const disabled = await signIn.isDisabled();
  if (disabled) {
    console.log('SIGN_IN_DISABLED', await page.content());
    process.exit(2);
  }

  await signIn.click();
  await page.waitForTimeout(4000);

  const url = page.url();
  const title = await page.title();
  const bodyText = (await page.locator('body').innerText()).slice(0, 2000);
  const errorText = await page.locator('[class*="red"], [role="alert"], .text-red-600').allTextContents().catch(() => []);

  console.log(JSON.stringify({ url, title, errorText, bodyPreview: bodyText }, null, 2));
} finally {
  await browser.close();
}