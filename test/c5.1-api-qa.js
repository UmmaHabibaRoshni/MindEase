// C5.1 - API checks for BL-4 (crisis request) and BL-6 (NGO referral).
//
// Runs the same checks as docs/thunder-client/C5.1-BL-4-BL-6.json, for anyone
// who cannot use Thunder Client. It calls the real running backend and prints
// each result as a filled-in row for the QA notes in docs/qa/.
//
// Run from the project root, with the backend running on port 5000:
//     node test/c5.1-api-qa.js
//
// It does NOT edit any file. It creates one crisis request (description starts
// with "QA C5.1 by Fairoz") and one referral to Test NGO Organisation in the
// database, exactly like the Thunder Client collection does.
//
// Needs Node 18+ (uses the built-in fetch). No packages to install.

const fs = require('fs');
const path = require('path');

const BASE = process.env.API_URL || 'http://localhost:5000';
const ROOT = path.join(__dirname, '..');
const NOTES = {
  bl4: path.join(ROOT, 'docs/qa/BL-4-crisis-request-qa-by-fairoz.md'),
  bl6: path.join(ROOT, 'docs/qa/BL-6-referral-qa-by-fairoz.md'),
};
const FAKE_ID = '000000000000000000000000';

const vars = {};
const results = {}; // id -> { actual, pass }

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
const listOf = (r, key) => (r.json && Array.isArray(r.json[key]) ? r.json[key] : []);

// One check: send the request, compare the status, then run any extra checks.
async function check(id, expected, method, url, opts = {}, extra) {
  if (opts.needs && opts.needs.some((v) => !vars[v])) {
    const missing = opts.needs.filter((v) => !vars[v]).join(', ');
    results[id] = { actual: `Not run: ${missing} missing (an earlier check failed)`, pass: null };
    console.log(`  ${id}  SKIPPED (${missing} missing)`);
    return null;
  }
  let r;
  try {
    r = await call(method, url, opts);
  } catch (err) {
    results[id] = { actual: `Could not reach server: ${err.message}`, pass: false };
    console.log(`  ${id}  ERROR ${err.message}`);
    return null;
  }
  let pass = r.status === expected;
  let actual = `${r.status}${msgOf(r)}`;
  if (extra) {
    const e = extra(r);
    if (e) {
      actual += `; ${e.note}`;
      if (e.ok === false) pass = false;
    }
  }
  results[id] = { actual, pass };
  console.log(`  ${id}  ${pass ? 'PASS' : 'FAIL'}  ${actual}`);
  return r;
}

async function login(name, email, password) {
  const r = await call('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200 || !r.json || !r.json.token) {
    console.log(`  Login ${name} (${email}) FAILED: ${r.status}${msgOf(r)}`);
    return null;
  }
  console.log(`  Login ${name} OK`);
  return r.json.token;
}

async function main() {
  console.log(`\nC5.1 API checks against ${BASE}\n`);

  // Is the backend up?
  try {
    await fetch(BASE + '/api/auth/me');
  } catch {
    console.log('Cannot reach the backend. Start it first:  cd server  then  npm run dev');
    process.exit(1);
  }

  console.log('Setup: logging in the test accounts');
  vars.seeker = await login('seeker', 'seeker@test.com', 'Seeker@12345');
  vars.volunteer = await login('volunteer', 'volunteer@test.com', 'Test@1234');
  vars.ngo = await login('test NGO', 'ngo@test.com', 'Ngo@12345');
  vars.otherNgo = await login('other NGO', 'ngo1@example.org', 'Ngo@12345');
  if (!vars.seeker || !vars.volunteer) {
    console.log('\nThe seeker and volunteer logins are required. Run the seed scripts (README section 7) and try again.');
    process.exit(1);
  }

  const S = vars.seeker;
  const V = vars.volunteer;
  const good = {
    category: 'mental_health',
    urgency: 'medium',
    description: 'QA C5.1 by Fairoz - API test request, please ignore.',
  };

  console.log('\nBL-4 crisis request');
  await check('A01', 401, 'POST', '/api/requests', { body: good });
  await check('A02', 401, 'POST', '/api/requests', { body: good, token: 'not-a-real-token' });
  await check('A03', 403, 'POST', '/api/requests', { body: good, token: V });
  await check('A04', 400, 'POST', '/api/requests', {
    body: { category: 'mental_health', description: 'QA C5.1 missing urgency test' }, token: S,
  });
  await check('A05', 400, 'POST', '/api/requests', { body: { ...good, category: 'food' }, token: S });
  await check('A06', 400, 'POST', '/api/requests', { body: { ...good, urgency: 'extreme' }, token: S });
  await check('A07', 400, 'POST', '/api/requests', { body: { ...good, description: 'help' }, token: S });
  await check('A08', 400, 'POST', '/api/requests', { body: { ...good, description: '            ' }, token: S });

  await check('A09', 201, 'POST', '/api/requests',
    { body: { ...good, status: 'accepted', acceptedBy: FAKE_ID }, token: S },
    (r) => {
      const req = r.json && r.json.request;
      if (!req) return { ok: false, note: 'no request in response' };
      vars.requestId = req._id;
      const ok = req.status === 'pending' && req.acceptedBy === null;
      return { ok, note: `saved as status ${req.status}, acceptedBy ${req.acceptedBy} (id ${req._id})` };
    });

  await check('A10', 200, 'GET', '/api/requests/mine', { token: S }, (r) => {
    const list = listOf(r, 'requests');
    const found = list.some((x) => x._id === vars.requestId);
    return { ok: found, note: `${list.length} requests, new A09 request ${found ? 'is listed' : 'NOT listed'}` };
  });
  await check('A11', 403, 'GET', '/api/requests/mine', { token: V });
  await check('A12', 200, 'GET', '/api/requests/pending', { token: V }, (r) => {
    const list = listOf(r, 'requests');
    const leak = list.some((x) => 'seeker' in x);
    return { ok: !leak, note: `${list.length} pending, ${leak ? 'SEEKER FIELD PRESENT' : 'no seeker field'}` };
  });
  await check('A13', 403, 'GET', '/api/requests/pending', { token: S });

  console.log('\nBL-6 NGO list');
  await check('B01', 200, 'GET', '/api/ngos?category=mental_health', { token: V }, (r) => {
    const list = listOf(r, 'ngos');
    const testNgo = list.find((n) => n.organizationName === 'Test NGO Organisation');
    if (testNgo) vars.ngoId = testNgo._id;
    const contactKeys = ['contactPhone', 'contactEmail', 'phone', 'email', 'user'];
    const leak = list.some((n) => contactKeys.some((k) => k in n));
    const wrongCat = list.some((n) => Array.isArray(n.categories) && !n.categories.includes('mental_health'));
    const ok = !!testNgo && !leak && !wrongCat;
    return {
      ok,
      note: `${list.length} NGOs (${list.map((n) => n.organizationName).join(', ')}); ` +
        `${testNgo ? 'Test NGO found' : 'Test NGO NOT found'}; ` +
        `${leak ? 'CONTACT DETAILS PRESENT' : 'no phone/email'}` +
        `${wrongCat ? '; an NGO without mental_health is listed' : ''}`,
    };
  });
  await check('B02', 200, 'GET', '/api/ngos?category=legal_aid', { token: V }, (r) => {
    const list = listOf(r, 'ngos');
    const wrong = list.find((n) => Array.isArray(n.categories) && !n.categories.includes('mental_health'));
    if (wrong) vars.wrongNgoId = wrong._id;
    return {
      ok: list.length > 0,
      note: list.length ? `${list.map((n) => n.organizationName).join(', ')}` : 'EMPTY list (run seeds/seedNgos.js)',
    };
  });
  await check('B03', 403, 'GET', '/api/ngos', { token: S });

  const ref = () => ({ requestId: vars.requestId, ngoId: vars.ngoId, consent: true });
  const needRef = ['requestId', 'ngoId'];

  await check('B04', 403, 'POST', '/api/referrals', { body: ref(), token: V, needs: needRef });

  console.log('\nBL-4 accept');
  await check('A14', 400, 'PATCH', '/api/requests/123/accept', { body: {}, token: V });
  await check('A15', 404, 'PATCH', `/api/requests/${FAKE_ID}/accept`, { body: {}, token: V });
  await check('A16', 403, 'PATCH', `/api/requests/${vars.requestId}/accept`, { body: {}, token: S, needs: ['requestId'] });
  await check('A17', 200, 'PATCH', `/api/requests/${vars.requestId}/accept`, { body: {}, token: V, needs: ['requestId'] },
    (r) => {
      const st = r.json && r.json.request && r.json.request.status;
      return { ok: st === 'accepted', note: `status ${st}` };
    });
  await check('A18', 409, 'PATCH', `/api/requests/${vars.requestId}/accept`, { body: {}, token: V, needs: ['requestId'] });

  console.log('\nBL-6 referral');
  await check('B05', 401, 'POST', '/api/referrals', { body: ref(), needs: needRef });
  await check('B06', 403, 'POST', '/api/referrals', { body: ref(), token: S, needs: needRef });
  await check('B07', 400, 'POST', '/api/referrals', {
    body: { requestId: vars.requestId, ngoId: vars.ngoId }, token: V, needs: needRef,
  });
  await check('B08', 400, 'POST', '/api/referrals', { body: { ...ref(), consent: false }, token: V, needs: needRef });
  await check('B09', 400, 'POST', '/api/referrals', { body: { ...ref(), consent: 'true' }, token: V, needs: needRef });
  await check('B10', 400, 'POST', '/api/referrals', { body: { requestId: 'abc', ngoId: 'xyz', consent: true }, token: V });
  await check('B11', 404, 'POST', '/api/referrals', { body: { ...ref(), ngoId: FAKE_ID }, token: V, needs: ['requestId'] });
  await check('B12', 400, 'POST', '/api/referrals', {
    body: { ...ref(), ngoId: vars.wrongNgoId }, token: V, needs: ['requestId', 'wrongNgoId'],
  });
  await check('B13', 201, 'POST', '/api/referrals', { body: ref(), token: V, needs: needRef }, (r) => {
    const rf = r.json && r.json.referral;
    if (!rf) return { ok: false, note: 'no referral in response' };
    vars.referralId = rf._id;
    const ok = rf.consentGiven === true && !!rf.consentAt && rf.status === 'pending';
    return { ok, note: `consentGiven ${rf.consentGiven}, consentAt ${rf.consentAt ? 'set' : 'MISSING'}, status ${rf.status}` };
  });
  await check('B14', 403, 'POST', '/api/referrals', { body: ref(), token: V, needs: needRef });

  await check('B15', 200, 'GET', '/api/requests/mine', { token: S }, (r) => {
    const x = listOf(r, 'requests').find((q) => q._id === vars.requestId);
    return { ok: !!x && x.status === 'referred', note: x ? `QA request status ${x.status}` : 'QA request not found' };
  });
  await check('B16', 200, 'GET', '/api/requests/accepted', { token: V }, (r) => {
    const x = listOf(r, 'requests').find((q) => q._id === vars.requestId);
    return { ok: !!x && x.status === 'referred', note: x ? `listed, status ${x.status}` : 'QA request NOT listed' };
  });

  console.log('\nBL-6 NGO side');
  const noSeeker = (r) => !/"seeker"/.test(r.text);
  await check('B17', 200, 'GET', '/api/referrals/mine', { token: vars.ngo, needs: ['ngo'] }, (r) => {
    const list = listOf(r, 'referrals');
    const found = list.some((x) => x._id === vars.referralId);
    const ok = found && noSeeker(r);
    return { ok, note: `${list.length} referrals, QA referral ${found ? 'listed' : 'NOT listed'}, ${noSeeker(r) ? 'no seeker data' : 'SEEKER DATA PRESENT'}` };
  });
  await check('B18', 200, 'GET', `/api/referrals/${vars.referralId}`, { token: vars.ngo, needs: ['ngo', 'referralId'] }, (r) => {
    const keys = r.json && r.json.referral && r.json.referral.request ? Object.keys(r.json.referral.request).join(', ') : '';
    return { ok: noSeeker(r), note: `request fields: ${keys}; ${noSeeker(r) ? 'no seeker data' : 'SEEKER DATA PRESENT'}` };
  });
  await check('B19', 404, 'GET', `/api/referrals/${vars.referralId}`, { token: vars.otherNgo, needs: ['otherNgo', 'referralId'] });
  await check('B20', 403, 'GET', '/api/referrals/mine', { token: V });
  await check('B21', 400, 'GET', '/api/referrals/mine?status=bogus', { token: vars.ngo, needs: ['ngo'] });
  results.B22 = { actual: 'Not run: needs a second approved volunteer (optional)', pass: null };

  printRows();
}

// Take each row from the QA note, fill in Actual and Result, and print it.
function printRows() {
  const all = Object.values(results);
  const passed = all.filter((x) => x.pass === true).length;
  const failed = all.filter((x) => x.pass === false).length;
  const notRun = all.filter((x) => x.pass === null).length;
  console.log(`\nTotal: ${passed} passed, ${failed} failed, ${notRun} not run`);

  for (const [key, file] of Object.entries(NOTES)) {
    const label = key === 'bl4' ? 'BL-4 note, section 3 (rows A01-A18)' : 'BL-6 note, section 2 (rows B01-B22)';
    console.log('\n' + '='.repeat(78));
    console.log(`Copy these rows into ${label}`);
    console.log('='.repeat(78));
    if (!fs.existsSync(file)) {
      console.log(`(QA note not found at ${path.relative(ROOT, file)}; results only)`);
    }
    const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : [];
    const prefix = key === 'bl4' ? 'A' : 'B';
    const ids = Object.keys(results).filter((id) => id.startsWith(prefix)).sort();
    for (const id of ids) {
      const { actual, pass } = results[id];
      const mark = pass === true ? '✅' : pass === false ? '❌' : 'Not run';
      const cleanActual = actual.replace(/\|/g, '/');
      const row = lines.find((l) => l.startsWith(`| ${id} |`));
      if (row) {
        const cells = row.split('|');
        // cells: ['', ' ID ', ' Request ', ' Expected ', ' Actual ', ' Result ', '']
        cells[4] = ` ${cleanActual} `;
        cells[5] = ` ${mark} `;
        console.log(cells.join('|'));
      } else {
        console.log(`| ${id} | | | ${cleanActual} | ${mark} |`);
      }
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
