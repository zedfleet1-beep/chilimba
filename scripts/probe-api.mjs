const url = 'https://chilimba.zedfleet.com/api/v1/auth/login';
for (const method of ['GET', 'POST', 'OPTIONS']) {
  const res = await fetch(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
    body: method === 'POST' ? JSON.stringify({ phone: '+260963285865', password: 'Prince' }) : undefined,
  });
  console.log(method, res.status, Object.fromEntries(res.headers.entries()));
}