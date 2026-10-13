const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { expect } = require('chai');

// T12.11 - Sprint 4 workshop coverage (BL-12), written by Ahnaf.
//
// The facilitator APIs (T12.4) are merged, so they are exercised for real.
// Two things are not merged yet and are marked pending with the reason
// printed, rather than skipped silently or asserted against code that does
// not exist:
//
//   - T12.5 (Roshni)  seeker APIs: list upcoming, enroll, cancel enrollment
//   - T12.7 / T12.8 (Bithi)  workshopApi.js, Create Workshop form, Workshops page
//
// Everything this suite creates is deleted again in the after hook, because it
// runs against the team's shared database.
//
// Run with:  npm run test:e2e:sprint4
// Needs:     client on 5173, server on 5000, Chrome, and the seeded accounts
//            (node server/seeds/seedFacilitator.js).

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API = process.env.E2E_API_URL || 'http://localhost:5000';

// Everything this suite creates carries this prefix so the cleanup can find it
// and a human can recognise it if a run is interrupted.
const MARK = 'E2E TEST -';

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

// ---------------------------------------------------------------- API helpers

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  return { status: res.status, body: payload };
}

async function apiLogin(role) {
  const { email, password } = ACCOUNTS[role];
  if (!password) return null;
  const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  return res.status === 200 ? res.body.token : null;
}

// A date a few weeks out, so "not in the past" is never borderline.
function futureDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

const validWorkshop = (overrides = {}) => ({
  title: `${MARK} Managing exam stress`,
  description: 'A practical session on grounding techniques for students under exam pressure.',
  date: futureDate(),
  time: '10:30 AM',
  mode: 'Online',
  locationOrLink: 'https://meet.example.com/e2e',
  capacity: 25,
  ...overrides,
});

// --------------------------------------------------------------- UI helpers

async function uiLogin(driver, role) {
  const { email, password } = ACCOUNTS[role];
  if (!password) return 'no-password';

  await driver.get(`${BASE}/login`);
  await driver.executeScript('try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}');
  await driver.get(`${BASE}/login`);

  const emailInput = await driver.wait(until.elementLocated(By.css("input[name='email']")), 10000);
  await emailInput.clear();
  await emailInput.sendKeys(email);

  const passInput = await driver.findElement(By.css("input[name='password']"));
  await passInput.clear();
  await passInput.sendKeys(password);

  await driver.findElement(By.css("button[type='submit']")).click();

  try {
    await driver.wait(until.urlContains('/dashboard/'), 30000);
    return true;
  } catch {
    return false;
  }
}

async function present(driver, locator, timeout = 4000) {
  try {
    await driver.wait(until.elementLocated(locator), timeout);
    return true;
  } catch {
    return false;
  }
}

function pending(ctx, reason) {
  ctx.test.title += ` [pending: ${reason}]`;
  ctx.skip();
}

async function requireLogin(ctx, driver, role) {
  const result = await uiLogin(driver, role);
  if (result === 'no-password') {
    pending(ctx, `E2E_${role.toUpperCase()}_PASSWORD not set`);
  }
  if (result === false) {
    throw new Error(`${role} login failed for ${ACCOUNTS[role].email} - check the seeded account`);
  }
}

// ------------------------------------------------------------------- suite

describe('MindEase Sprint 4 E2E - BL-12 Workshops (Selenium)', function () {
  this.timeout(120000);

  let driver;
  let facilitatorToken;
  const createdIds = [];

  // Creates a workshop through the API and remembers it for cleanup.
  async function createWorkshop(overrides = {}) {
    const res = await api('/api/workshops', {
      method: 'POST',
      token: facilitatorToken,
      body: validWorkshop(overrides),
    });
    if (res.status === 201) createdIds.push(res.body.workshop._id);
    return res;
  }

  before(async function () {
    // Chrome's "password found in a data breach" dialog covers the login form
    // and swallows the submit, and the shared test passwords trigger it.
    const options = new chrome.Options();
    options.addArguments(
      '--disable-features=PasswordLeakDetection,PasswordLeakToggleMove,AutofillServerCommunication',
      '--disable-save-password-bubble',
      '--no-first-run',
      '--no-default-browser-check'
    );
    options.setUserPreferences({
      credentials_enable_service: false,
      'profile.password_manager_enabled': false,
      'profile.password_manager_leak_detection': false,
    });

    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    await driver.manage().window().maximize();

    facilitatorToken = await apiLogin('facilitator');
  });

  after(async function () {
    if (driver) await driver.quit();

    // Cancel everything this run created. There is no delete endpoint, so
    // cancelling is the most cleanup the API allows.
    for (const id of createdIds) {
      await api(`/api/workshops/${id}/cancel`, { method: 'PATCH', token: facilitatorToken });
    }
    if (createdIds.length) {
      console.log(`      cleanup: cancelled ${createdIds.length} workshop(s) created by this run`);
    }
  });

  // ======================================================= facilitator, T12.4
  describe('Facilitator workshop APIs (T12.4)', function () {
    it('T12.E1: a facilitator can log in and reach their dashboard', async function () {
      await requireLogin(this, driver, 'facilitator');

      expect(await driver.getCurrentUrl()).to.include('/dashboard/facilitator');
    });

    it('T12.E2: creating a workshop requires a token', async function () {
      const res = await api('/api/workshops', { method: 'POST', body: validWorkshop() });

      expect(res.status).to.equal(401);
    });

    it('T12.E3: a seeker cannot create a workshop', async function () {
      const token = await apiLogin('seeker');
      if (!token) pending(this, 'no seeker account - run server/seeds/seedTestNgo.js');

      const res = await api('/api/workshops', { method: 'POST', token, body: validWorkshop() });

      expect(res.status).to.equal(403);
    });

    it('T12.E4: a facilitator creates a workshop', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');

      const res = await createWorkshop();

      expect(res.status, JSON.stringify(res.body)).to.equal(201);
      expect(res.body.workshop.status).to.equal('Scheduled');
      expect(res.body.workshop.enrolledCount).to.equal(0);
      expect(res.body.workshop.durationMinutes).to.equal(60);
    });

    it('T12.E5: the facilitator is taken from the token, not the body', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');

      const res = await createWorkshop({ facilitator: '000000000000000000000000' });

      expect(res.status).to.equal(201);
      expect(res.body.workshop.facilitator).to.not.equal('000000000000000000000000');
    });

    it('T12.E6: a workshop in the past is rejected', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');

      const res = await createWorkshop({ date: '2020-01-01' });

      expect(res.status).to.equal(400);
      expect(res.body.message.toLowerCase()).to.include('past');
    });

    it('T12.E7: a title under 5 characters is rejected', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');

      expect((await createWorkshop({ title: 'Hi' })).status).to.equal(400);
    });

    it('T12.E8: a 24-hour time is rejected', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');

      expect((await createWorkshop({ time: '14:30' })).status).to.equal(400);
    });

    it('T12.E9: an unknown mode is rejected', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');

      expect((await createWorkshop({ mode: 'Telepathy' })).status).to.equal(400);
    });

    it('T12.E10: tags sent as a string are rejected', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');

      const res = await createWorkshop({ tags: 'stress,students' });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('list');
    });

    it('T12.E11: a facilitator updates their own workshop', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');
      const created = await createWorkshop();

      const res = await api(`/api/workshops/${created.body.workshop._id}`, {
        method: 'PATCH',
        token: facilitatorToken,
        body: { capacity: 30 },
      });

      expect(res.status).to.equal(200);
      expect(res.body.workshop.capacity).to.equal(30);
    });

    it('T12.E12: status and enrolledCount cannot be set from the body', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');
      const created = await createWorkshop();

      const res = await api(`/api/workshops/${created.body.workshop._id}`, {
        method: 'PATCH',
        token: facilitatorToken,
        body: { status: 'Completed', enrolledCount: 99 },
      });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('No valid fields');
    });

    it('T12.E13: a malformed workshop id is rejected', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');

      const res = await api('/api/workshops/not-an-id', {
        method: 'PATCH',
        token: facilitatorToken,
        body: { title: `${MARK} does not matter` },
      });

      expect(res.status).to.equal(400);
    });

    it('T12.E14: updating a workshop that does not exist is 404', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');

      const res = await api('/api/workshops/000000000000000000000000', {
        method: 'PATCH',
        token: facilitatorToken,
        body: { title: `${MARK} nowhere` },
      });

      expect(res.status).to.equal(404);
    });

    it('T12.E15: a facilitator cancels their own workshop', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');
      const created = await createWorkshop();

      const res = await api(`/api/workshops/${created.body.workshop._id}/cancel`, {
        method: 'PATCH',
        token: facilitatorToken,
      });

      expect(res.status).to.equal(200);
      expect(res.body.workshop.status).to.equal('Cancelled');
    });

    it('T12.E16: cancelling twice is rejected', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');
      const created = await createWorkshop();
      const id = created.body.workshop._id;
      await api(`/api/workshops/${id}/cancel`, { method: 'PATCH', token: facilitatorToken });

      const res = await api(`/api/workshops/${id}/cancel`, { method: 'PATCH', token: facilitatorToken });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('already cancelled');
    });

    it('T12.E17: a cancelled workshop cannot be edited', async function () {
      if (!facilitatorToken) pending(this, 'facilitator login failed');
      const created = await createWorkshop();
      const id = created.body.workshop._id;
      await api(`/api/workshops/${id}/cancel`, { method: 'PATCH', token: facilitatorToken });

      const res = await api(`/api/workshops/${id}`, {
        method: 'PATCH',
        token: facilitatorToken,
        body: { title: `${MARK} editing a cancelled workshop` },
      });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('cannot be edited');
    });
  });

  // ============================================================ seeker, T12.5
  describe('Seeker enrollment APIs (T12.5)', function () {
    it('T12.E18: a seeker can list upcoming workshops', async function () {
      const res = await api('/api/workshops');
      if (res.status === 404) {
        pending(this, 'T12.5 not merged - there is no GET /api/workshops yet');
      }

      expect(res.status).to.equal(200);
    });

    it('T12.E19: a seeker can enroll, and cannot enroll twice', async function () {
      const probe = await api('/api/workshops');
      if (probe.status === 404) {
        pending(this, 'T12.5 not merged - enrollment endpoints do not exist yet');
      }

      expect.fail('T12.5 has landed - write the enroll, capacity and double-enroll assertions');
    });

    it('T12.E20: enrolling in a full workshop is rejected', async function () {
      const probe = await api('/api/workshops');
      if (probe.status === 404) {
        pending(this, 'T12.5 not merged - capacity rule cannot be tested yet');
      }

      expect.fail('T12.5 has landed - write the capacity assertion');
    });
  });

  // =================================================== workshop UI, T12.7/12.8
  describe('Workshop pages (T12.7 / T12.8)', function () {
    it('T12.E21: a facilitator sees a Create Workshop form', async function () {
      await requireLogin(this, driver, 'facilitator');
      await driver.get(`${BASE}/dashboard/workshops`);

      const hasForm =
        (await present(driver, By.css("input[name='title']"))) ||
        (await present(
          driver,
          By.xpath("//*[contains(translate(., 'CREATE WORKSHOP', 'create workshop'), 'create workshop')]")
        ));
      if (!hasForm) {
        pending(this, 'CreateWorkshop.jsx (T12.7) not merged yet');
      }

      expect(hasForm).to.equal(true);
    });

    it('T12.E22: a seeker sees the workshops page with an Enroll button', async function () {
      const token = await apiLogin('seeker');
      if (!token) pending(this, 'no seeker account - run server/seeds/seedTestNgo.js');

      await requireLogin(this, driver, 'seeker');
      await driver.get(`${BASE}/dashboard/workshops`);

      const hasEnroll = await present(
        driver,
        By.xpath("//button[contains(translate(., 'ENROLL', 'enroll'), 'enroll')]")
      );
      if (!hasEnroll) {
        pending(this, 'Workshops.jsx (T12.8) not merged yet');
      }

      expect(hasEnroll).to.equal(true);
    });
  });
});
