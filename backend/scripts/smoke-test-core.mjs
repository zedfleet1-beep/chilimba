/**
 * Quick smoke test for cycles, contributions, reports, loans.
 * Uses test numbers from seed: +260963285865 (owner), +260770172220 (treasurer).
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4500/api/v1';
const PASSWORD = process.env.TEST_PASSWORD ?? 'sTBvg7U2YQLEdpJ';

async function login(phone) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login ${phone} failed: ${JSON.stringify(body)}`);
  return body.data.accessToken;
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`GET ${path} failed: ${JSON.stringify(body)}`);
  return body.data;
}

async function post(path, token, payload = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`POST ${path} failed: ${JSON.stringify(body)}`);
  return body.data;
}

async function main() {
  const ownerPhone = '+260963285865';
  const treasPhone = '+260770172220';

  console.log('1. Login test owner…');
  const ownerToken = await login(ownerPhone);

  console.log('2. Find test group…');
  const groups = await get('/groups', ownerToken);
  const group = groups.find((g) => g.name === 'Prince Test Chilimba');
  if (!group) throw new Error('Test group not found');
  console.log(`   Group: ${group.name} (${group.id})`);

  console.log('3. List cycles…');
  const cycles = await get(`/groups/${group.id}/cycles`, ownerToken);
  const cycle = cycles[0];
  if (!cycle) throw new Error('No cycle found');
  const detail = await get(`/groups/${group.id}/cycles/${cycle.id}`, ownerToken);
  const round = detail.rounds[0];
  if (!round) throw new Error('No round found');
  console.log(`   Cycle #${cycle.cycleNumber}, round ${round.roundNumber}`);

  console.log('4. Treasurer records contribution for owner…');
  const treasToken = await login(treasPhone);
  const members = await get(`/groups/${group.id}/members`, treasToken);
  const ownerMember = members.find((m) => m.user?.phone === ownerPhone);
  if (!ownerMember) throw new Error('Owner member row not found');
  await post(
    `/groups/${group.id}/cycles/${cycle.id}/rounds/${round.id}/contributions/${ownerMember.id}/record`,
    treasToken,
    { notes: 'Cash payment smoke test' },
  );
  console.log('   Contribution recorded');

  console.log('5. Reports…');
  const summary = await get(`/groups/${group.id}/reports/cycle-summary`, ownerToken);
  const outstanding = await get(`/groups/${group.id}/reports/outstanding`, ownerToken);
  console.log(`   Collected: ${summary.totalCollectedNgwe} ngwe, outstanding: ${outstanding.members.length} members`);

  console.log('6. Loan request + approve…');
  const eligibility = await get(`/groups/${group.id}/loans/eligibility`, ownerToken);
  console.log(`   Max loan: ${eligibility.maxLoanNgwe} ngwe`);
  const loan = await post(`/groups/${group.id}/loans`, ownerToken, {
    amountNgwe: '25000',
    purpose: 'Smoke test loan',
  });
  await post(`/groups/${group.id}/loans/${loan.id}/approve`, treasToken);
  console.log(`   Loan ${loan.id} approved`);

  const book = await get(`/groups/${group.id}/reports/loan-book`, ownerToken);
  console.log(`   Loan book: ${book.activeCount} active, ${book.totalOutstandingNgwe} ngwe outstanding`);

  console.log('\n✅ All core flows passed for test numbers.');
}

main().catch((e) => {
  console.error('\n❌ Smoke test failed:', e.message);
  process.exit(1);
});