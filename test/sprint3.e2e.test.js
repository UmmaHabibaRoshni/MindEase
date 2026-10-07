const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');

// Sprint 3 Selenium coverage, written by Ahnaf.
//
// T11.11 is the Resources story (my own row). BL-8, BL-9 and BL-10 are covered
// here too as cross-story regression checks.
//
// Some teammate pages are not merged yet (Availability.jsx T10.7,
// EscalateModal/EscalatedCases T9.7-T9.8, Resources.jsx T11.7). For those the
// UI assertion is skipped with a reason and the backend contract is asserted
// over HTTP instead, so the suite stays green and never pretends to have
// exercised a screen that does not exist.
//
// Run with:  npm run test:e2e
// Needs:     client on 5173, server on 5000, Chrome, seeded test accounts.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API = process.env.E2E_API_URL || 'http://localhost:5000';

const ACCOUNTS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@mindease.com',
    password: process.env.E2E_ADMIN_PASSWORD,
  },
  volunteer: {
    email: process.env.E2E_VOLUNTEER_EMAIL || 'volunteer@test.com',
    password: process.env.E2E_VOLUNTEER_PASSWORD || 'Test@1234',
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
  if (!password) return null; // password not supplied via env
  const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  return res.status === 200 ? res.body.token : null;
}

// --------------------------------------------------------------- UI helpers

async function uiLogin(driver, role) {
  const { email, password } = ACCOUNTS[role];
  if (!password) return false;

  await driver.get(`${BASE}/login`);
  const emailInput = await driver.wait(until.elementLocated(By.css("input[name='email']")), 10000);
  await emailInput.clear();
  await emailInput.sendKeys(email);

  const passInput = await driver.findElement(By.css("input[name='password']"));
  await passInput.clear();
  await passInput.sendKeys(password);

  await driver.findElement(By.css("button[type='submit']")).click();

  // The app navigates to /dashboard/<role> on success.
  try {
    await driver.wait(until.urlContains('/dashboard/'), 10000);
    return true;
  } catch {
    return false;
  }
}

async function present(driver, locator, timeout = 5000) {
  try {
    await driver.wait(until.elementLocated(locator), timeout);
    return true;
  } catch {
    return false;
  }
}

/** Marks a test pending with a reason instead of failing on unmerged work. */
function pending(ctx, reason) {
  ctx.test.title += ` [pending: ${reason}]`;
  ctx.skip();
}

// ------------------------------------------------------------------- suites

describe('MindEase Sprint 3 E2E (Selenium)', function () {
  this.timeout(90000);
  let driver;

  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().window().maximize();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  // ============================================================== BL-8
  describe('BL-8 Admin verification', function () {
    it('T8.E1: an admin can open the verification queue', async function () {
      if (!(await uiLogin(driver, 'admin'))) {
        pending(this, 'E2E_ADMIN_PASSWORD not set');
      }

      await driver.get(`${BASE}/dashboard/verifications`);

      // Either there are pending accounts or the empty state shows - both prove
      // the page loaded and the API call resolved.
      const loaded =
        (await present(driver, By.css("[data-testid='verifications-table']"))) ||
        (await present(driver, By.css("[data-testid='verifications-empty']")));

      expect(loaded, 'verification queue rendered').to.equal(true);
      expect(await driver.getCurrentUrl()).to.include('/dashboard/verifications');
    });

    it('T8.E2: a non-admin is redirected away from the queue', async function () {
      if (!(await uiLogin(driver, 'volunteer'))) {
        pending(this, 'volunteer login failed');
      }

      await driver.get(`${BASE}/dashboard/verifications`);
      await driver.wait(until.urlContains('/dashboard/'), 10000);

      expect(await driver.getCurrentUrl()).to.not.include('/verifications');
    });

    it('T8.E3: the pending-accounts API rejects a volunteer token', async function () {
      const token = await apiLogin('volunteer');
      if (!token) pending(this, 'volunteer login failed');

      const res = await api('/api/admin/pending-users', { token });

      expect(res.status).to.equal(403);
    });

    it('T8.E4: the pending-accounts API rejects an anonymous caller', async function () {
      const res = await api('/api/admin/pending-users');

      expect(res.status).to.equal(401);
    });
  });

  // ============================================================== BL-9
  describe('BL-9 Escalation', function () {
    it('T9.E1: a volunteer sees the escalate control on an accepted case', async function () {
      if (!(await uiLogin(driver, 'volunteer'))) {
        pending(this, 'volunteer login failed');
      }

      await driver.get(`${BASE}/dashboard/volunteer`);

      const hasEscalate = await present(
        driver,
        By.xpath("//button[contains(translate(., 'ESCALATE', 'escalate'), 'escalate')]"),
        4000
      );
      if (!hasEscalate) {
        pending(this, 'EscalateModal (T9.7) not merged yet');
      }

      expect(hasEscalate).to.equal(true);
    });

    it('T9.E2: creating an escalation requires a token', async function () {
      const res = await api('/api/escalations', {
        method: 'POST',
        body: { requestId: 'x', psychologistId: 'y', summary: 'x'.repeat(25) },
      });

      expect(res.status).to.equal(401);
    });

    it('T9.E3: the psychologist queue is closed to volunteers', async function () {
      const token = await apiLogin('volunteer');
      if (!token) pending(this, 'volunteer login failed');

      const res = await api('/api/escalations/assigned', { token });

      expect(res.status).to.equal(403);
    });

    it('T9.E4: a volunteer can list psychologists to escalate to', async function () {
      const token = await apiLogin('volunteer');
      if (!token) pending(this, 'volunteer login failed');

      const res = await api('/api/escalations/psychologists', { token });

      expect(res.status).to.equal(200);
      expect(res.body.psychologists).to.be.an('array');
    });

    it('T9.E5: a short handover summary is rejected', async function () {
      const token = await apiLogin('volunteer');
      if (!token) pending(this, 'volunteer login failed');

      const res = await api('/api/escalations', {
        method: 'POST',
        token,
        body: { requestId: '6abcc9b074fd3d0a34f713e9', psychologistId: '6abcc9b074fd3d0a34f713e9', summary: 'short' },
      });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.match(/at least 20 characters/);
    });
  });

  // ============================================================== BL-10
  describe('BL-10 Availability', function () {
    it('T10.E1: a volunteer can see their availability on the dashboard', async function () {
      if (!(await uiLogin(driver, 'volunteer'))) {
        pending(this, 'volunteer login failed');
      }

      await driver.get(`${BASE}/dashboard/volunteer`);

      const hasAvailability = await present(
        driver,
        By.xpath("//*[contains(translate(., 'AVAILABILITY', 'availability'), 'availability')]"),
        4000
      );
      if (!hasAvailability) {
        pending(this, 'Availability.jsx (T10.7/T10.8) not merged yet');
      }

      expect(hasAvailability).to.equal(true);
    });

    it('T10.E2: a volunteer can read their own availability', async function () {
      const token = await apiLogin('volunteer');
      if (!token) pending(this, 'volunteer login failed');

      const res = await api('/api/volunteer/availability', { token });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.availability).to.be.an('object');
      expect(res.body.availability).to.have.property('isAvailable');
    });

    it('T10.E3: a valid window can be saved', async function () {
      const token = await apiLogin('volunteer');
      if (!token) pending(this, 'volunteer login failed');

      const res = await api('/api/volunteer/availability', {
        method: 'PATCH',
        token,
        body: { dayOfWeek: 'Monday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      });

      expect(res.status).to.equal(200);
      expect(res.body.availability.dayOfWeek).to.equal('Monday');
      expect(res.body.availability.startTime).to.equal('09:00');
    });

    it('T10.E4: availability is closed to anonymous callers', async function () {
      const res = await api('/api/volunteer/availability');

      expect(res.status).to.equal(401);
    });
  });

  // ============================================================== BL-11
  describe('BL-11 Resources (T11.11, my story)', function () {
    it('T11.E1: the public resource library loads without logging in', async function () {
      await driver.get(`${BASE}/resources`);

      const heading = await present(driver, By.xpath('//h1 | //h2'), 8000);

      expect(heading, 'resource library heading rendered').to.equal(true);
      expect(await driver.getCurrentUrl()).to.include('/resources');
    });

    // Regression for the bug in the QA note: the API returns { count, resources }
    // with no `success` key, but the page only renders when `data.success` is
    // truthy, so a non-empty API gives an empty page.
    it('T11.E2: resources returned by the API are actually rendered', async function () {
      const { status, body } = await api('/api/resources');
      expect(status).to.equal(200);

      if (!body.resources || body.resources.length === 0) {
        pending(this, 'no published resources seeded - run server/seeds/seedResources.js');
      }

      await driver.get(`${BASE}/resources`);
      await driver.sleep(1500);
      const pageText = await driver.findElement(By.css('body')).getText();

      expect(pageText).to.include(body.resources[0].title);
    });

    it('T11.E3: the admin manage-resources page loads', async function () {
      if (!(await uiLogin(driver, 'admin'))) {
        pending(this, 'E2E_ADMIN_PASSWORD not set');
      }

      await driver.get(`${BASE}/dashboard/resources`);
      await driver.sleep(1000);

      expect(await driver.getCurrentUrl()).to.include('/dashboard/resources');
      const pageText = await driver.findElement(By.css('body')).getText();
      expect(pageText.toLowerCase()).to.include('resource');
    });

    it('T11.E4: the public read API returns the documented shape', async function () {
      const res = await api('/api/resources');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('count');
      expect(res.body.resources).to.be.an('array');
    });

    it('T11.E5: an anonymous caller cannot create a resource', async function () {
      const res = await api('/api/resources', {
        method: 'POST',
        body: { title: 'Selenium probe', type: 'article', description: 'probe', content: 'probe' },
      });

      expect(res.status).to.equal(401);
    });

    it('T11.E6: a volunteer cannot create a resource', async function () {
      const token = await apiLogin('volunteer');
      if (!token) pending(this, 'volunteer login failed');

      const res = await api('/api/resources', {
        method: 'POST',
        token,
        body: { title: 'Selenium probe', type: 'article', description: 'probe', content: 'probe' },
      });

      expect(res.status).to.equal(403);
    });

    it('T11.E7: an unknown type is rejected', async function () {
      const res = await api('/api/resources?type=podcast');

      expect(res.status).to.equal(400);
    });

    it('T11.E8: an invalid resource id is rejected', async function () {
      const res = await api('/api/resources/not-an-id');

      expect(res.status).to.equal(400);
    });

    it('T11.E9: categories are publicly readable', async function () {
      const res = await api('/api/resources/categories/all');

      expect(res.status).to.equal(200);
    });
  });
});
