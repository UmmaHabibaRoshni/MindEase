// T17.6 - API checks for the BL-17 payment APIs (the Thunder Client collection,
// as a runnable script so the results can be reproduced).
//
// Covers what T17.1, T17.3 and T17.4 merged:
//   - POST /api/workshops            (T17.1)  price accepted, validated
//   - POST /api/workshops/:id/pay    (T17.3)  access control and every refusal
//   - POST /api/workshops/:id/enroll (T17.3)  free-only guard on a paid workshop
//   - POST /api/payments/success     (T17.4)  refuses an unverifiable callback
//   - POST /api/payments/fail        (T17.4)
//   - POST /api/payments/cancel      (T17.4)
//
// The one path this script cannot prove on its own is a real payment going
// through: that needs SSLC_STORE_ID / SSLC_STORE_PASSWD in server/.env and a
// human on the sandbox card form. That is T17.13 (Tanjila). When those keys are
// missing the start-payment happy path is reported as "waiting", not as a pass.
//
// Run from the project root with the backend running on port 5000:
//     node test/t17.6-payment-api-qa.js
//
// Side effects on the shared database: creates two workshops titled
// "QA T17.6 ..." and cancels them again at the end.
//
// Needs Node 18+ (built-in fetch). No packages to install.

const BASE = process.env.API_URL || 'http://localhost:5000';
const FAKE_ID = '000000000000000000000000';

const ACCOUNTS = {
  facilitator: {
    email: process.env.E2E_FACILITATOR_EMAIL || 'facilitator@test.com',
    password: process.env.E2E_FACILITATOR_PASSWORD || 'Facilitator@12345',
  },
  seeker: {
    email: process.env.E2E_SEEKER_EMAIL || 'seeker@test.com',
    password: process.env.E2E_SEEKER_PASSWORD || 'Seeker@12345',
  },
};

const MARK = 'QA T17.6';
const rows = [];

async function call(method, url, { token, body, form, redirect = 'manual' } = {}) {
  const headers = {};
  let payload;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + url, { method, headers, body: payload, redirect });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* a redirect has no JSON body */
  }
  return { status: res.status, json, location: res.headers.get('location') };
}

const login = async (role) => {
  const r = await call('POST', '/api/auth/login', { body: ACCOUNTS[role] });
  return r.status === 200 ? r.json.token : null;
};

const futureDate = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

const workshopBody = (extra = {}) => ({
  title: `${MARK} ${extra.price ? 'paid' : 'free'} workshop`,
  description: 'Temporary workshop created by the T17.6 payment API checks.',
  date: futureDate(),
  time: '10:30 AM',
  mode: 'Online',
  locationOrLink: 'https://meet.example.com/qa-t17-6',
  capacity: 20,
  ...extra,
});

// id, what we expect, what happened
function check(id, expected, got, ok) {
  rows.push({ id, expected, got, ok });
  const mark = ok === null ? 'WAIT' : ok ? 'pass' : 'FAIL';
  console.log(`  ${mark.padEnd(5)} ${id.padEnd(8)} ${expected.padEnd(52)} ${got}`);
}

const expectStatus = (id, expected, res, expectedText) => {
  const statusOk = res.status === expected;
  const textOk =
    expectedText === undefined ||
    (res.json && new RegExp(expectedText, 'i').test(res.json.message || ''));
  check(
    id,
    `${expected}${expectedText ? ` "${expectedText}"` : ''}`,
    `${res.status} ${res.json?.message ?? res.location ?? ''}`.trim(),
    statusOk && textOk
  );
};

const expectRedirect = (id, expectedPath, res) => {
  const ok = res.status === 303 && (res.location || '').includes(expectedPath);
  check(id, `303 -> ${expectedPath}`, `${res.status} ${res.location || '(no Location)'}`, ok);
};

(async () => {
  console.log(`\nT17.6 payment API checks against ${BASE}\n`);

  const fac = await login('facilitator');
  const seeker = await login('seeker');
  if (!fac || !seeker) {
    console.error('Could not log in. Is the backend running and are the accounts seeded?');
    process.exit(1);
  }

  let freeId = null;
  let paidId = null;

  try {
    // ---------- T17.1: price on the create API ----------
    console.log('T17.1  price field');

    const freeRes = await call('POST', '/api/workshops', { token: fac, body: workshopBody() });
    freeId = freeRes.json?.workshop?._id || null;
    check(
      'P-01',
      '201, a workshop with no price is free',
      `${freeRes.status} price=${JSON.stringify(freeRes.json?.workshop?.price)} isPaid=${freeRes.json?.workshop?.isPaid}`,
      freeRes.status === 201 && !freeRes.json?.workshop?.isPaid
    );

    const paidRes = await call('POST', '/api/workshops', {
      token: fac,
      body: workshopBody({ price: 500 }),
    });
    paidId = paidRes.json?.workshop?._id || null;
    check(
      'P-02',
      '201, price 500 is stored and isPaid is true',
      `${paidRes.status} price=${JSON.stringify(paidRes.json?.workshop?.price)} isPaid=${paidRes.json?.workshop?.isPaid}`,
      paidRes.status === 201 &&
        paidRes.json?.workshop?.price === 500 &&
        paidRes.json?.workshop?.isPaid === true
    );

    expectStatus(
      'P-03',
      400,
      await call('POST', '/api/workshops', { token: fac, body: workshopBody({ price: -5 }) }),
      'price must be a number'
    );

    // ---------- T17.3: start payment ----------
    console.log('\nT17.3  POST /api/workshops/:id/pay');

    expectStatus('P-04', 401, await call('POST', `/api/workshops/${paidId}/pay`), 'no token');
    expectStatus(
      'P-05',
      403,
      await call('POST', `/api/workshops/${paidId}/pay`, { token: fac }),
      'not allowed'
    );
    expectStatus(
      'P-06',
      400,
      await call('POST', '/api/workshops/not-an-id/pay', { token: seeker }),
      'invalid workshop id'
    );
    // startPayment checks the gateway configuration BEFORE it looks the
    // workshop up, so on a machine without the sandbox keys every call below
    // answers 500 and the real rule underneath cannot be observed. Those checks
    // are reported as waiting rather than failed - see the note in docs/qa.
    const notConfigured = (res) =>
      res.status === 500 && /not configured/i.test(res.json?.message || '');

    const unknown = await call('POST', `/api/workshops/${FAKE_ID}/pay`, { token: seeker });
    if (notConfigured(unknown)) {
      check('P-07', '404 "not found"', '500 gateway not configured, rule not reachable', null);
    } else {
      expectStatus('P-07', 404, unknown, 'not found');
    }

    const onFree = await call('POST', `/api/workshops/${freeId}/pay`, { token: seeker });
    if (notConfigured(onFree)) {
      check('P-08', '400 "free"', '500 gateway not configured, rule not reachable', null);
    } else {
      expectStatus('P-08', 400, onFree, 'free');
    }

    // the happy path needs the sandbox keys
    const start = await call('POST', `/api/workshops/${paidId}/pay`, { token: seeker });
    if (start.status === 500 && /not configured/i.test(start.json?.message || '')) {
      check(
        'P-09',
        '200 with a gatewayUrl',
        '500 Payment gateway is not configured - SSLC keys missing from server/.env',
        null
      );
    } else {
      check(
        'P-09',
        '200 with a gatewayUrl',
        `${start.status} ${start.json?.gatewayUrl || start.json?.message || ''}`,
        start.status === 200 && typeof start.json?.gatewayUrl === 'string'
      );
    }

    // ---------- the free-only guard on enroll ----------
    console.log('\nT17.3  POST /api/workshops/:id/enroll (free only)');

    expectStatus(
      'P-10',
      400,
      await call('POST', `/api/workshops/${paidId}/enroll`, { token: seeker }),
      'paid workshop'
    );

    const freeEnroll = await call('POST', `/api/workshops/${freeId}/enroll`, { token: seeker });
    check(
      'P-11',
      '201, a free workshop still enrolls directly',
      `${freeEnroll.status} ${freeEnroll.json?.message || ''}`,
      freeEnroll.status === 201
    );
    await call('DELETE', `/api/workshops/${freeId}/enroll`, { token: seeker }); // put it back

    // ---------- T17.4: the callbacks ----------
    console.log('\nT17.4  payment callbacks');

    expectRedirect(
      'P-12',
      '/payment/fail?reason=invalid',
      await call('POST', '/api/payments/success', { form: {} })
    );
    expectRedirect(
      'P-13',
      '/payment/fail?reason=invalid',
      await call('POST', '/api/payments/success', {
        form: { tran_id: 'ME-does-not-exist', val_id: 'nope' },
      })
    );
    expectRedirect(
      'P-14',
      '/payment/fail?reason=gateway',
      await call('POST', '/api/payments/fail', { form: { tran_id: 'ME-does-not-exist' } })
    );
    expectRedirect(
      'P-15',
      '/payment/cancel',
      await call('POST', '/api/payments/cancel', { form: { tran_id: 'ME-does-not-exist' } })
    );
    expectRedirect(
      'P-16',
      '/payment/fail?reason=invalid',
      await call('POST', '/api/payments/success', { form: { tran_id: 'only-tran-id' } })
    );
  } finally {
    // ---------- cleanup ----------
    for (const id of [freeId, paidId]) {
      if (id) await call('PATCH', `/api/workshops/${id}/cancel`, { token: fac });
    }
    console.log('\ncleanup: the two QA workshops were cancelled');
  }

  const pass = rows.filter((r) => r.ok === true).length;
  const fail = rows.filter((r) => r.ok === false).length;
  const wait = rows.filter((r) => r.ok === null).length;
  console.log(`\n${pass} passed, ${fail} failed, ${wait} waiting on the sandbox keys\n`);
  if (wait > 0) {
    console.log('Waiting (need SSLC_STORE_ID / SSLC_STORE_PASSWD / BACKEND_URL in server/.env):');
    rows.filter((r) => r.ok === null).forEach((r) => console.log(`  ${r.id}  ${r.expected}`));
    console.log('');
  }
  if (fail > 0) {
    console.log('Failures:');
    rows.filter((r) => r.ok === false).forEach((r) => console.log(`  ${r.id}  expected ${r.expected}, got ${r.got}`));
  }
  process.exit(fail > 0 ? 1 : 0);
})();
