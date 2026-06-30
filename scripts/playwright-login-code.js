async page => {
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('auth/login')) requests.push({ method: req.method(), url: req.url() });
  });
  const responses = [];
  page.on('response', async res => {
    if (res.url().includes('auth/login')) {
      let body = '';
      try { body = await res.text(); } catch {}
      responses.push({ status: res.status(), url: res.url(), body: body.slice(0, 500) });
    }
  });

  await page.goto('https://chilimba.zedfleet.com/login?next=/dashboard', { waitUntil: 'networkidle' });
  await page.locator('input[type="password"]').fill('Prince');
  const phone = page.locator('input').filter({ hasNot: page.locator('[type=password]') }).last();
  await phone.fill('963285865');
  const signIn = page.getByRole('button', { name: /sign in/i });
  await signIn.click();
  await page.waitForTimeout(5000);

  return {
    finalUrl: page.url(),
    title: await page.title(),
    requests,
    responses,
    alerts: await page.locator('[role="alert"], .text-red-600, p.text-red-600').allTextContents().catch(() => []),
    bodySnippet: (await page.locator('body').innerText()).slice(0, 1200),
  };
}