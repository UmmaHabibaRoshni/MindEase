// T16.11 - API checks for the BL-16 admin APIs (Thunder Client tests, as a script).
//
// Covers what is merged today:
//   - GET  /api/admin/summary            (T16.3)  access control, shape, totals, live counts
//   - GET  /api/admin/pending-users      (T8.4)   the source of "Pending approvals"
//   - PATCH /api/admin/users/:id/approve (T8.5)
//   - PATCH /api/admin/users/:id/reject  (T8.5)
// The users list and suspend / reactivate checks (T16.5, T16.1) are listed but
// marked "waiting" until those routes exist; they run automatically once they do.
//
// Run from the project root, with the backend running on port 5000:
//     node test/t16.11-admin-api-qa.js
// Add --fill-note to also write the results into docs/qa/BL-16-admin-qa-by-fairoz.md
//     node test/t16.11-admin-api-qa.js --fill-note
//
// Side effects on the database: registers two volunteer accounts named
// "QA T16.11 ..." (one gets approved, one rejected).
// The database is shared, so if a teammate creates users at the same moment a
// "count went up by 1" check can be off. Run again if that happens.
//
// Needs Node 18+ (built-in fetch). No packages to install.

const fs = require('fs');
const path = require('path');

const BASE = process.env.API_URL || 'http://localhost:5000';
const NOTE = path.join(__dirname, '..', 'docs/qa/BL-16-admin-qa-by-fairoz.md');
const FAKE_ID = '000000000000000000000000';
const ADMIN = {
  email: process.env.ADMIN_TEST_EMAIL || 'admin.test@mindease.com',
  password: process.env.ADMIN_TEST_PASSWORD || 'Admin@12345',
};

const ROLES = ['seeker', 'volunteer', 'psychologist', 'ngo', 'facilitator', 'admin'];
const USER_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];
const REQUEST_STATUSES = ['pending', 'accepted', 'escalated', 'referred', 'closed'];
const CATEGORIES = ['mental_health', 'abuse_violence', 'legal_aid', 'medical', 'substance_use', 'other'];
const WORKSHOP_STATUSES = ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'];
const REFERRAL_STATUSES = ['pending', 'in_progress', 'resolved', 'closed'];

const results = {}; // id -> { actual, pass }  (pass: true / false / null = not run)
const t = {}; // tokens and ids

async function call(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

const short = (s, n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const msgOf = (r) => (r.json && typeof r.json.message === 'string' ? ` "${short(r.json.message)}"` : '');

function record(id, pass, actual) {
  results[id] = { actual, pass };
  const label = pass === true ? 'PASS' : pass === false ? 'FAIL' : 'NOT RUN';
  console.log(`  ${id}  ${label}  ${actual}`);
}

// Send a request, compare the status, then run optional extra checks.
async function check(id, expected, method, url, opts = {}, extra) {
  if (opts.needs && opts.needs.some((k) => !t[k])) {
    record(id, null, `Not run: ${opts.needs.filter((k) => !t[k]).join(', ')} missing (an earlier step failed)`);
    return null;
  }
  let r;
  try {
    r = await call(method, url, opts);
  } catch (err) {
    record(id, false, `Could not reach server: ${err.message}`);
    return null;
  }
  let pass = r.status === expected;
  let actual = `${r.status}${msgOf(r)}`;
  if (extra && r.json) {
    const e = extra(r);
    if (e) {
      actual += `; ${e.note}`;
      if (e.ok === false) pass = false;
    }
  }
  record(id, pass, actual);
  return r;
}

async function login(email, password) {
  const r = await call('POST', '/api/auth/login', { body: { email, password } });
  return r.status === 200 && r.json && r.json.token ? r.json.token : null;
}

const sum = (obj) => Object.values(obj || {}).reduce((a, n) => a + n, 0);
const missingKeys = (obj, keys) => keys.filter((k) => !(obj && typeof obj[k] === 'number'));

async function summary() {
  const r = await call('GET', '/api/admin/summary', { token: t.admin });
  return r.status === 200 ? r.json : null;
}

async function main() {
  console.log(`\nT16.11 admin API checks against ${BASE}\n`);
  try {
    await fetch(BASE + '/api/auth/me');
  } catch {
    console.log('Cannot reach the backend. Start it first:  cd server  then  npm run dev');
    process.exit(1);
  }

  console.log('Setup: logging in the test accounts');
  t.admin = await login(ADMIN.email, ADMIN.password);
  t.seeker = await login('seeker@test.com', 'Seeker@12345');
  t.volunteer = await login('volunteer@test.com', 'Test@1234');
  t.ngo = (await login('ngo@test.com', 'Ngo@12345')) || (await login('ngo1@example.org', 'Ngo@12345'));
  for (const k of ['admin', 'seeker', 'volunteer', 'ngo']) console.log(`  ${k}: ${t[k] ? 'OK' : 'LOGIN FAILED'}`);
  if (!t.admin) {
    console.log('\nThe admin login is required. Run:  cd server && node seeds/seedTestAdmin.js');
    process.exit(1);
  }

  // ------------------------------------------------------------ summary
  console.log('\nGET /api/admin/summary (T16.3)');
  await check('D01', 401, 'GET', '/api/admin/summary');
  await check('D02', 401, 'GET', '/api/admin/summary', { token: 'not-a-real-token' });
  await check('D03', 403, 'GET', '/api/admin/summary', { token: t.seeker, needs: ['seeker'] });
  await check('D04', 403, 'GET', '/api/admin/summary', { token: t.volunteer, needs: ['volunteer'] });
  await check('D05', 403, 'GET', '/api/admin/summary', { token: t.ngo, needs: ['ngo'] });

  const s0r = await check('D06', 200, 'GET', '/api/admin/summary', { token: t.admin }, (r) => {
    const j = r.json;
    const gaps = [
      ...missingKeys(j.users && j.users.byRole, ROLES).map((k) => `users.byRole.${k}`),
      ...missingKeys(j.users && j.users.byStatus, USER_STATUSES).map((k) => `users.byStatus.${k}`),
      ...missingKeys(j.requests && j.requests.byStatus, REQUEST_STATUSES).map((k) => `requests.byStatus.${k}`),
      ...missingKeys(j.requests && j.requests.byCategory, CATEGORIES).map((k) => `requests.byCategory.${k}`),
      ...missingKeys(j.workshops && j.workshops.byStatus, WORKSHOP_STATUSES).map((k) => `workshops.byStatus.${k}`),
      ...missingKeys(j.referrals && j.referrals.byStatus, REFERRAL_STATUSES).map((k) => `referrals.byStatus.${k}`),
    ];
    if (!(j.workshops && typeof j.workshops.activeEnrollments === 'number')) gaps.push('workshops.activeEnrollments');
    if (Number.isNaN(Date.parse(j.generatedAt))) gaps.push('generatedAt');
    return gaps.length
      ? { ok: false, note: `missing: ${gaps.join(', ')}` }
      : { ok: true, note: 'every bucket present (6 roles, 4 user statuses incl. suspended, 5 request statuses, 6 categories, 4 workshop, 4 referral statuses), activeEnrollments and generatedAt present' };
  });
  const s0 = s0r && s0r.status === 200 ? s0r.json : null;

  if (s0) {
    const problems = [];
    if (s0.users.total !== sum(s0.users.byRole)) problems.push('users.total ≠ sum by role');
    if (sum(s0.users.byRole) !== sum(s0.users.byStatus)) problems.push('users by role ≠ users by status');
    if (s0.requests.total !== sum(s0.requests.byStatus)) problems.push('requests.total ≠ sum by status');
    if (sum(s0.requests.byStatus) !== sum(s0.requests.byCategory)) problems.push('requests by status ≠ by category');
    if (s0.workshops.total !== sum(s0.workshops.byStatus)) problems.push('workshops.total ≠ sum');
    if (s0.referrals.total !== sum(s0.referrals.byStatus)) problems.push('referrals.total ≠ sum');
    record('D07', problems.length === 0, problems.length
      ? problems.join('; ')
      : `totals add up: users ${s0.users.total}, requests ${s0.requests.total}, workshops ${s0.workshops.total}, referrals ${s0.referrals.total}`);
  } else {
    record('D07', null, 'Not run: D06 failed');
  }

  // A fresh pending volunteer, so the counts and the approve flow can be checked.
  const stamp = Date.now();
  const reg = await call('POST', '/api/auth/register', {
    body: { name: 'QA T16.11 Approve', email: `qa.t1611.approve.${stamp}@test.com`, password: 'Qa@123456', role: 'volunteer' },
  });
  t.newId = reg.json && reg.json.user && reg.json.user.id;
  t.newEmail = `qa.t1611.approve.${stamp}@test.com`;
  console.log(`  (setup: registered ${t.newEmail} -> ${reg.status})`);

  const s1 = t.newId ? await summary() : null;
  if (s0 && s1) {
    const d = (a, b) => b - a;
    const ok = d(s0.users.total, s1.users.total) === 1
      && d(s0.users.byStatus.pending, s1.users.byStatus.pending) === 1
      && d(s0.users.byRole.volunteer, s1.users.byRole.volunteer) === 1;
    record('D08', ok, `after registering a volunteer: total ${s0.users.total}→${s1.users.total}, pending ${s0.users.byStatus.pending}→${s1.users.byStatus.pending}, volunteers ${s0.users.byRole.volunteer}→${s1.users.byRole.volunteer}`);
  } else {
    record('D08', null, `Not run: registration returned ${reg.status}${msgOf(reg)}`);
  }

  // ------------------------------------------------------------ verification
  console.log('\nVerification APIs (T8.4, T8.5) behind "Pending approvals"');
  await check('D09', 200, 'GET', '/api/admin/pending-users', { token: t.admin, needs: ['newId'] }, (r) => {
    const list = r.json.users || [];
    const found = list.some((u) => u._id === t.newId);
    const leak = list.some((u) => 'password' in u);
    return { ok: found && !leak, note: `${list.length} pending; new volunteer ${found ? 'listed' : 'NOT listed'}; ${leak ? 'PASSWORD FIELD PRESENT' : 'no password field'}` };
  });
  if (s1) {
    const r = await call('GET', '/api/admin/pending-users', { token: t.admin });
    const n = r.json && Array.isArray(r.json.users) ? r.json.users.length : -1;
    record('D10', n === s1.users.byStatus.pending, `pending list has ${n}, summary says ${s1.users.byStatus.pending} pending`);
  } else {
    record('D10', null, 'Not run: summary not available');
  }
  await check('D11', 403, 'GET', '/api/admin/pending-users', { token: t.seeker, needs: ['seeker'] });
  await check('D12', 400, 'PATCH', '/api/admin/users/123/approve', { token: t.admin, body: {} });
  await check('D13', 404, 'PATCH', `/api/admin/users/${FAKE_ID}/approve`, { token: t.admin, body: {} });
  await check('D14', 403, 'PATCH', `/api/admin/users/${t.newId}/approve`, { token: t.volunteer, body: {}, needs: ['newId', 'volunteer'] });
  await check('D15', 400, 'PATCH', `/api/admin/users/${t.newId}/reject`, { token: t.admin, body: { reason: '   ' }, needs: ['newId'] });
  await check('D16', 200, 'PATCH', `/api/admin/users/${t.newId}/approve`, { token: t.admin, body: {}, needs: ['newId'] }, (r) => {
    const u = r.json.user || {};
    const ok = u.status === 'approved' && !!u.verifiedAt && !('password' in u);
    return { ok, note: `status ${u.status}, verifiedAt ${u.verifiedAt ? 'set' : 'MISSING'}, ${'password' in u ? 'PASSWORD RETURNED' : 'no password'}` };
  });
  await check('D17', 400, 'PATCH', `/api/admin/users/${t.newId}/approve`, { token: t.admin, body: {}, needs: ['newId'] });

  const s2 = s1 && t.newId ? await summary() : null;
  if (s1 && s2) {
    const ok = s2.users.byStatus.pending === s1.users.byStatus.pending - 1
      && s2.users.byStatus.approved === s1.users.byStatus.approved + 1;
    record('D18', ok, `after approving: pending ${s1.users.byStatus.pending}→${s2.users.byStatus.pending}, approved ${s1.users.byStatus.approved}→${s2.users.byStatus.approved}`);
  } else {
    record('D18', null, 'Not run: summary not available');
  }

  const newLogin = t.newId ? await call('POST', '/api/auth/login', { body: { email: t.newEmail, password: 'Qa@123456' } }) : null;
  if (newLogin) record('D19', newLogin.status === 200, `approved volunteer login: ${newLogin.status}${msgOf(newLogin)}`);
  else record('D19', null, 'Not run: no new volunteer');

  // Reject flow, with a second fresh volunteer.
  const rejEmail = `qa.t1611.reject.${stamp}@test.com`;
  const reg2 = await call('POST', '/api/auth/register', {
    body: { name: 'QA T16.11 Reject', email: rejEmail, password: 'Qa@123456', role: 'volunteer' },
  });
  t.rejId = reg2.json && reg2.json.user && reg2.json.user.id;
  console.log(`  (setup: registered ${rejEmail} -> ${reg2.status})`);
  await check('D20', 200, 'PATCH', `/api/admin/users/${t.rejId}/reject`, {
    token: t.admin, body: { reason: 'QA T16.11 test rejection' }, needs: ['rejId'],
  }, (r) => {
    const u = r.json.user || {};
    return { ok: u.status === 'rejected' && u.rejectionReason === 'QA T16.11 test rejection', note: `status ${u.status}, reason "${u.rejectionReason}"` };
  });
  const rejLogin = t.rejId ? await call('POST', '/api/auth/login', { body: { email: rejEmail, password: 'Qa@123456' } }) : null;
  if (rejLogin) record('D21', rejLogin.status === 403, `rejected volunteer login: ${rejLogin.status}${msgOf(rejLogin)}`);
  else record('D21', null, 'Not run: no second volunteer');

  // ------------------------------------------------------------ T16.5 / T16.1
  console.log('\nUsers list and suspend / reactivate (T16.5, T16.1)');
  const probe = await call('GET', '/api/admin/users', { token: t.admin });
  if (probe.status === 404) {
    for (const id of ['D22', 'D23', 'D24', 'D25', 'D26', 'D27', 'D28']) {
      record(id, null, 'Waiting for T16.5 (GET /api/admin/users returns 404, not merged yet)');
    }
  } else {
    await check('D22', 200, 'GET', '/api/admin/users', { token: t.admin }, (r) => {
      const list = Array.isArray(r.json) ? r.json : r.json.users || [];
      return { ok: !list.some((u) => 'password' in u), note: `${list.length} users; ${list.some((u) => 'password' in u) ? 'PASSWORD FIELD PRESENT' : 'no password field'}` };
    });
    await check('D23', 200, 'GET', '/api/admin/users?role=volunteer&status=approved', { token: t.admin }, (r) => {
      const list = Array.isArray(r.json) ? r.json : r.json.users || [];
      const wrong = list.filter((u) => u.role !== 'volunteer' || u.status !== 'approved').length;
      return { ok: wrong === 0, note: `${list.length} returned, ${wrong} outside the filter` };
    });
    await check('D24', 403, 'GET', '/api/admin/users', { token: t.seeker, needs: ['seeker'] });
    await check('D25', 400, 'PATCH', `/api/admin/users/${t.newId}/suspend`, { token: t.admin, body: {}, needs: ['newId'] });
    await check('D26', 200, 'PATCH', `/api/admin/users/${t.newId}/suspend`, {
      token: t.admin, body: { reason: 'QA T16.11 test suspension' }, needs: ['newId'],
    }, (r) => {
      const u = r.json.user || r.json;
      return { ok: u.status === 'suspended', note: `status ${u.status}` };
    });
    const susLogin = t.newId ? await call('POST', '/api/auth/login', { body: { email: t.newEmail, password: 'Qa@123456' } }) : null;
    if (susLogin) record('D27', susLogin.status === 403, `suspended volunteer login: ${susLogin.status}${msgOf(susLogin)}`);
    else record('D27', null, 'Not run: no new volunteer');
    await check('D28', 200, 'PATCH', `/api/admin/users/${t.newId}/reactivate`, { token: t.admin, body: {}, needs: ['newId'] }, (r) => {
      const u = r.json.user || r.json;
      return { ok: u.status === 'approved', note: `status ${u.status}` };
    });
  }

  report();
}

function report() {
  const all = Object.entries(results);
  const passed = all.filter(([, x]) => x.pass === true).length;
  const failed = all.filter(([, x]) => x.pass === false).length;
  const notRun = all.filter(([, x]) => x.pass === null).length;
  console.log(`\nTotal: ${passed} passed, ${failed} failed, ${notRun} not run / waiting`);

  if (!process.argv.includes('--fill-note')) {
    console.log('\n(Run again with --fill-note to write these results into the BL-16 QA note.)\n');
    return;
  }
  if (!fs.existsSync(NOTE)) {
    console.log(`\nQA note not found at ${path.relative(process.cwd(), NOTE)}; nothing written.\n`);
    return;
  }
  let filled = 0;
  const lines = fs.readFileSync(NOTE, 'utf8').split('\n').map((line) => {
    const m = line.match(/^\| (D\d\d) \|/);
    if (m === null || !results[m[1]]) return line;
    const { actual, pass } = results[m[1]];
    const cells = line.split('|');
    // ['', ' ID ', ' Request ', ' Expected ', ' Actual ', ' Result ', '']
    if (cells.length < 7) return line;
    cells[4] = ` ${actual.replace(/\|/g, '/')} `;
    cells[5] = ` ${pass === true ? '✅' : pass === false ? '❌' : 'Waiting'} `;
    filled += 1;
    return cells.join('|');
  });
  fs.writeFileSync(NOTE, lines.join('\n'));
  console.log(`\nWrote ${filled} rows into ${path.relative(process.cwd(), NOTE)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
