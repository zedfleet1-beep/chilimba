/**
 * Capture light/dark mode screenshots across main app pages.
 * Usage: node scripts/theme-audit.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'theme-audit-screenshots');
const BASE = 'http://localhost:5174';
const PHONE = '963285865';
const PASSWORD = 'sTBvg7U2YQLEdpJ';

const PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'invoices', path: '/invoices' },
  { name: 'groups', path: '/groups' },
  { name: 'help', path: '/help' },
  { name: 'group-settings', path: '/groups/e95209fb-b280-4210-ae17-801d9abb50ee/settings' },
  { name: 'group-detail', path: '/groups/e95209fb-b280-4210-ae17-801d9abb50ee' },
  { name: 'group-cycles', path: '/groups/e95209fb-b280-4210-ae17-801d9abb50ee/cycles' },
  { name: 'login', path: '/login', skipAuth: true },
];

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('97 712 3456').fill(PHONE);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

async function setTheme(page, mode) {
  await page.evaluate((m) => {
    localStorage.setItem('chilimba_theme', m);
    const isDark = m === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('app-light', !isDark);
  }, mode);
  await page.waitForTimeout(400);
}

async function capture(page, mode) {
  const dir = path.join(OUT, mode);
  fs.mkdirSync(dir, { recursive: true });

  for (const { name, path: route, skipAuth } of PAGES) {
    if (!skipAuth && mode === 'light' && route === '/login') continue;
    await page.goto(`${BASE}${route}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
    const file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ${mode}/${name}.png`);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in...');
  await login(page);

  console.log('Light mode:');
  await setTheme(page, 'light');
  await capture(page, 'light');

  console.log('Dark mode:');
  await setTheme(page, 'dark');
  await capture(page, 'dark');

  await browser.close();
  console.log(`\nScreenshots saved to: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});