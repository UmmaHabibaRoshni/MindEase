const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { expect } = require('chai');

// T17.12 - Selenium E2E for the paid workshop flow (BL-17), written by Ahnaf.
//
// The journey: a facilitator creates a priced workshop through the Create
// Workshop form, a seeker sees the price on the card and a Pay & Enroll button,
// and clicking it leaves the app for the SSLCommerz sandbox.
//
// The last step needs SSLC_STORE_ID / SSLC_STORE_PASSWD / BACKEND_URL in
// server/.env. Without them the backend answers 500 "Payment gateway is not
// configured", so that spec is marked pending with the reason printed instead
// of failing - the same way the Sprint 4 suite handles work that is not merged.
// A real sandbox card payment is checked by hand in T17.13.
//
// The result pages (T17.9) are visited directly, because the only way to reach
// them for real is through the gateway.
//
// Run with:  npx mocha test/t17.12-payment.e2e.test.js --timeout 120000
// Needs:     client on 5173, server on 5000, Chrome, and the seeded accounts.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API = process.env.E2E_API_URL || 'http://localhost:5000';

const MARK = 'E2E T17.12 -';
const PRICE = 500;

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

function futureDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------------------- UI helpers

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

function pending(ctx, reason) {
  ctx.test.title += ` [pending: ${reason}]`;
  console.log(`      pending: ${reason}`);
  ctx.skip();
}

async function requireLogin(ctx, driver, role) {
  const result = await uiLogin(driver, role);
  if (result === 'no-password') pending(ctx, `E2E_${role.toUpperCase()}_PASSWORD not set`);
  if (result === false) {
    throw new Error(`${role} login failed for ${ACCOUNTS[role].email} - check the seeded account`);
  }
}

// Finds the card for a workshop by its title and returns the surrounding box.
async function cardFor(driver, title) {
  const heading = await driver.wait(
    until.elementLocated(By.xpath(`//h3[normalize-space()=${JSON.stringify(title)}]`)),
    20000
  );
  return heading.findElement(By.xpath('./ancestor::div[contains(@style,"border")][1]'));
}

// ------------------------------------------------------------------- suite

describe('MindEase T17.12 E2E - BL-17 paid workshop flow (Selenium)', function () {
  this.timeout(120000);

  let driver;
  let facilitatorToken;
  let gatewayConfigured = null; // decided once, in before()
  const createdIds = [];
  const paidTitle = `${MARK} Paid exam stress workshop`;

  before(async function () {
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
    for (const id of createdIds) {
      await api(`/api/workshops/${id}/cancel`, { method: 'PATCH', token: facilitatorToken });
    }
    if (createdIds.length) {
      console.log(`      cleanup: cancelled ${createdIds.length} workshop(s) created by this run`);
    }
  });

  // ---------- T17.7: the facilitator sets a price ----------

  describe('Facilitator creates a paid workshop (T17.7)', function () {
    it('E17.1 the create form has a price field that is blank by default', async function () {
      await requireLogin(this, driver, 'facilitator');
      await driver.get(`${BASE}/dashboard/workshops/new`);

      const price = await driver.wait(until.elementLocated(By.id('price')), 15000);
      expect(await price.getAttribute('value')).to.equal('');
    });

    it('E17.2 a workshop created with a price is stored as paid', async function () {
      await requireLogin(this, driver, 'facilitator');
      await driver.get(`${BASE}/dashboard/workshops/new`);

      await driver.wait(until.elementLocated(By.id('title')), 15000);
      await driver.findElement(By.id('title')).sendKeys(paidTitle);
      await driver
        .findElement(By.id('description'))
        .sendKeys('A practical session on grounding techniques, created by the T17.12 E2E run.');
      await driver.executeScript(
        `const set = (id, v) => {
           const el = document.getElementById(id);
           const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
           setter.call(el, v);
           el.dispatchEvent(new Event('input', { bubbles: true }));
         };
         set('date', arguments[0]);
         set('time', '10:30');`,
        futureDate()
      );
      await driver.findElement(By.id('locationOrLink')).sendKeys('https://meet.example.com/e2e-t17');
      await driver.findElement(By.id('price')).sendKeys(String(PRICE));
      await driver.findElement(By.css("form button[type='submit']")).click();

      const notice = await driver.wait(until.elementLocated(By.css("p[role='status']")), 20000);
      expect(await notice.getText()).to.match(/500 BDT/);

      // confirm through the API, and remember it for cleanup
      const list = await api('/api/workshops/available', {
        token: await apiLogin('seeker'),
      });
      const made = (list.body || []).find((w) => w.title === paidTitle);
      expect(made, 'the paid workshop should appear in the seeker list').to.exist;
      expect(made.price).to.equal(PRICE);
      expect(made.isPaid).to.equal(true);
      createdIds.push(made._id);

      // one API probe decides whether the gateway specs below can run at all
      const probe = await api(`/api/workshops/${made._id}/pay`, {
        method: 'POST',
        token: await apiLogin('seeker'),
      });
      gatewayConfigured = !(
        probe.status === 500 && /not configured/i.test(probe.body?.message || '')
      );
    });
  });

  // ---------- T17.8: the seeker sees the price and Pay & Enroll ----------

  describe('Seeker sees the price and Pay & Enroll (T17.8)', function () {
    it('E17.3 the workshop card shows the amount, not Free', async function () {
      await requireLogin(this, driver, 'seeker');
      await driver.get(`${BASE}/dashboard/workshops`);

      const card = await cardFor(driver, paidTitle);
      expect(await card.getText()).to.match(/500 BDT/);
      expect(await card.getText()).to.not.match(/\bFree\b/);
    });

    it('E17.4 the action is Pay & Enroll, not plain Enroll', async function () {
      await requireLogin(this, driver, 'seeker');
      await driver.get(`${BASE}/dashboard/workshops`);

      const card = await cardFor(driver, paidTitle);
      const button = await card.findElement(By.css('button'));
      expect(await button.getText()).to.match(/Pay 500 BDT & Enroll/i);
    });

    it('E17.5 a free workshop still offers plain Enroll', async function () {
      await requireLogin(this, driver, 'seeker');

      const freeTitle = `${MARK} Free companion workshop`;
      const created = await api('/api/workshops', {
        method: 'POST',
        token: facilitatorToken,
        body: {
          title: freeTitle,
          description: 'A free workshop created by the T17.12 E2E run for comparison.',
          date: futureDate(),
          time: '02:30 PM',
          mode: 'Online',
          locationOrLink: 'https://meet.example.com/e2e-t17-free',
          capacity: 25,
        },
      });
      expect(created.status).to.equal(201);
      createdIds.push(created.body.workshop._id);

      await driver.get(`${BASE}/dashboard/workshops`);
      const card = await cardFor(driver, freeTitle);
      expect(await card.getText()).to.match(/\bFree\b/);
      expect(await card.findElement(By.css('button')).getText()).to.match(/^Enroll$/i);
    });

    it('E17.6 clicking Pay & Enroll leaves the app for the gateway', async function () {
      if (gatewayConfigured === false) {
        pending(
          this,
          'SSLC_STORE_ID / SSLC_STORE_PASSWD / BACKEND_URL are not in server/.env, so the backend cannot open a gateway session'
        );
      }
      await requireLogin(this, driver, 'seeker');
      await driver.get(`${BASE}/dashboard/workshops`);

      const card = await cardFor(driver, paidTitle);
      await card.findElement(By.css('button')).click();

      // the app navigates away to SSLCommerz
      await driver.wait(async () => {
        const url = await driver.getCurrentUrl();
        return url.includes('sslcommerz');
      }, 30000);

      expect(await driver.getCurrentUrl()).to.match(/sslcommerz/);
    });

    it('E17.7 a failed start shows the server message and stays on the page', async function () {
      if (gatewayConfigured === true) {
        pending(this, 'the gateway is configured, so the failure path cannot be produced here');
      }
      await requireLogin(this, driver, 'seeker');
      await driver.get(`${BASE}/dashboard/workshops`);

      const card = await cardFor(driver, paidTitle);
      await card.findElement(By.css('button')).click();

      const notice = await driver.wait(until.elementLocated(By.css("p[role='status']")), 20000);
      expect(await notice.getText()).to.match(/payment|try again/i);
      expect(await driver.getCurrentUrl()).to.include('/dashboard/workshops');
    });
  });

  // ---------- T17.9: the result pages ----------

  describe('Payment result pages (T17.9)', function () {
    it('E17.8 /payment/success says the seeker is enrolled', async function () {
      await driver.get(`${BASE}/payment/success?workshop=${createdIds[0] || 'w1'}`);
      const heading = await driver.wait(until.elementLocated(By.css('h1')), 15000);
      expect(await heading.getText()).to.match(/enrolled/i);
    });

    it('E17.9 /payment/fail?reason=gateway says nothing was charged', async function () {
      await driver.get(`${BASE}/payment/fail?reason=gateway`);
      const body = await driver.wait(until.elementLocated(By.css("div[role='status']")), 15000);
      expect(await body.getText()).to.match(/not been charged/i);
    });

    it('E17.10 /payment/fail?reason=unavailable warns that a human must step in', async function () {
      await driver.get(`${BASE}/payment/fail?reason=unavailable`);
      const body = await driver.wait(until.elementLocated(By.css("div[role='status']")), 15000);
      const text = await body.getText();
      expect(text).to.match(/do not pay again/i);
      expect(text).to.match(/cannot issue refunds/i);
    });

    it('E17.11 /payment/cancel says no seat was taken', async function () {
      await driver.get(`${BASE}/payment/cancel`);
      const body = await driver.wait(until.elementLocated(By.css("div[role='status']")), 15000);
      expect(await body.getText()).to.match(/no seat was taken/i);
    });

    it('E17.12 the result pages are reachable without being logged in', async function () {
      await driver.get(`${BASE}/payment/cancel`);
      await driver.executeScript('try { localStorage.clear(); } catch (e) {}');
      await driver.get(`${BASE}/payment/fail?reason=verify`);

      const heading = await driver.wait(until.elementLocated(By.css('h1')), 15000);
      expect(await heading.getText()).to.match(/did not complete/i);
      expect(await driver.getCurrentUrl()).to.include('/payment/fail');
    });
  });
});
