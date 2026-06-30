import { chromium } from 'playwright';

const BASE = 'http://localhost:5174';
const PHONE = '963285865';
const PASSWORD = 'sTBvg7U2YQLEdpJ';
const OUT = 'C:/Users/prince/WebstormProjects/chilimba';
const GROUP_ID = process.env.GROUP_ID || '6d1c3fd5-90cf-482e-97d3-f2b665f9fcaf';

async function login(page, next = '/admin') {
  await page.goto(`${BASE}/login?next=${next}`);
  await page.getByRole('textbox', { name: /97 712/ }).fill(PHONE);
  await page.locator('input[autocomplete=current-password]').first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForFunction(
    () => !!localStorage.getItem('chilimba_refresh_token'),
    null,
    { timeout: 10000 },
  );
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const report = { steps: [], issues: [] };

  try {
    await login(page);
    const loginBody = await page.locator('body').innerText();
    report.steps.push({
      step: 'login',
      url: page.url(),
      ok: !page.url().includes('/login'),
      role: loginBody.includes('Admin\n') ? 'super_admin' : 'member',
    });

    const adminBody = await page.locator('body').innerText();
    report.steps.push({
      step: 'admin-dashboard',
      url: page.url(),
      hasStats: adminBody.includes('Active groups'),
      activeGroups: (adminBody.match(/Active groups\s+(\d+)/) || [])[1] ?? null,
    });
    await page.screenshot({ path: `${OUT}/ui-test-01-admin.png`, fullPage: true });

    await page.getByRole('link', { name: 'All groups' }).click();
    await page.waitForURL('**/admin/groups**', { timeout: 10000 });
    await page.getByText('Loading…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const groupsBody = await page.locator('body').innerText();
    report.steps.push({
      step: 'admin-groups',
      url: page.url(),
      sessionOk: !groupsBody.includes('Sign in'),
      listsPrinceGroup: groupsBody.includes('Prince Test'),
    });
    await page.screenshot({ path: `${OUT}/ui-test-02-admin-groups.png`, fullPage: true });

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const cyclesCard = page.locator('button').filter({ hasText: 'Cycles' });
    await cyclesCard.first().click();
    await page.waitForURL('**/cycles**', { timeout: 10000 });
    await page.waitForTimeout(2000);

    let cyclesBody = await page.locator('body').innerText();
    report.steps.push({
      step: 'cycles-page',
      url: page.url(),
      hasSavingsPoolBadge: cyclesBody.includes('Savings pool · loans'),
      hasSavingsPoolPanel: cyclesBody.includes('stay in the group pot'),
      hasRecordPayout: cyclesBody.includes('Record payout'),
      hasViewLoans: cyclesBody.includes('View loans'),
    });
    await page.screenshot({ path: `${OUT}/ui-test-04-cycles.png`, fullPage: true });

    const openCycleBtn = page.getByRole('button', { name: /open cycle/i });
    if ((await openCycleBtn.count()) > 0) {
      await openCycleBtn.first().click();
      await page.waitForTimeout(3000);
      cyclesBody = await page.locator('body').innerText();
      report.steps.push({
        step: 'after-open-cycle',
        roundCount: (cyclesBody.match(/Month \d+/g) || []).length,
        hasSavingsPool: cyclesBody.includes('Savings pool'),
        hasRecordPayout: cyclesBody.includes('Record payout'),
        errorText: cyclesBody.includes('Set payout') ? 'payout settings error' : null,
      });
      await page.screenshot({ path: `${OUT}/ui-test-05-cycles-after-open.png`, fullPage: true });

      const startBtn = page.getByRole('button', { name: /^start$/i });
      if ((await startBtn.count()) > 0) {
        await startBtn.first().click();
        await page.waitForTimeout(2000);
        cyclesBody = await page.locator('body').innerText();
        report.steps.push({
          step: 'after-start-cycle',
          hasMakeContribution: cyclesBody.includes('Make contribution'),
          hasSavingsPool: cyclesBody.includes('Savings pool'),
          hasRecordPayout: cyclesBody.includes('Record payout'),
        });
        await page.screenshot({ path: `${OUT}/ui-test-06-cycles-in-progress.png`, fullPage: true });
      }
    } else {
      report.issues.push('Open cycle button not visible — cycle may already be open or completed.');
    }
  } catch (err) {
    report.issues.push(String(err));
    await page.screenshot({ path: `${OUT}/ui-test-error.png`, fullPage: true });
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(report, null, 2));
}

main();