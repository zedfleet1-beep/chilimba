const BASE = 'http://localhost:4500/api/v1';

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+260963285865', password: 'sTBvg7U2YQLEdpJ' }),
  });
  const body = await res.json();
  return { status: res.status, token: body.data?.accessToken, user: body.data?.user };
}

const { status, token, user } = await login();
console.log('login', status, user?.role);

const headers = { Authorization: `Bearer ${token}` };

for (const path of ['/groups', '/admin/groups', '/admin/stats', `/groups/6d1c3fd5-90cf-482e-97d3-f2b665f9fcaf`]) {
  const res = await fetch(`${BASE}${path}`, { headers });
  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  console.log(path, res.status, JSON.stringify(body).slice(0, 300));
}