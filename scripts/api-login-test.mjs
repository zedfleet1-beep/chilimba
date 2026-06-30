const passwords = ['Prince', 'sTBvg7U2YQLEdpJ'];
const credsList = passwords.map((password) => ({ phone: '+260963285865', password }));
const bases = [
  'https://chilimba.zedfleet.com/api/v1',
  'https://chilimba-production.up.railway.app/api/v1',
];

for (const base of bases) {
  for (const creds of credsList) {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    const text = await res.text();
    console.log(JSON.stringify({ base, password: creds.password, status: res.status, body: text.slice(0, 500) }, null, 2));
  }
}