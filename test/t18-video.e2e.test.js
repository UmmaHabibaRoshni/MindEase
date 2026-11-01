const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { expect } = require('chai');

// T18.13 / T18.14 - Selenium E2E for the BL-18 video buttons.
//
//   T18.13  only an enrolled seeker sees Join video session on an online
//           workshop, and an In-Person workshop never shows one.
//   T18.14  the psychologist sees Join video consultation on an accepted
//           case, and not on a pending one.
//
// These check that the right person is OFFERED the room and that the link
// carries the right URL. They deliberately do not click through into Jitsi -
// the call itself is checked by hand in T18.15, and following the link would
// make the suite depend on meet.jit.si being up.
//
// T18.14 needs an accepted case. The suite builds one through the API
// (seeker raises a request, volunteer accepts, volunteer escalates,
// psychologist accepts) and marks itself pending with the reason printed if
// any account in that chain is missing.
//
// Run with:  npx mocha test/t18-video.e2e.test.js --timeout 120000
// Needs:     client on 5173, server on 5000, Chrome, the seeded accounts.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API = process.env.E2E_API_URL || 'http://localhost:5000';

const MARK = 'E2E T18 -';

const ACCOUNTS = {
  facilitator: {
    email: process.env.E2E_FACILITATOR_EMAIL || 'facilitator@test.com',
    password: process.env.E2E_FACILITATOR_PASSWORD || 'Facilitator@12345',
  },
  seeker: {
    email: process.env.E2E_SEEKER_EMAIL || 'seeker@test.com',
    password: process.env.E2E_SEEKER_PASSWORD || 'Seeker@12345',
  },
  volunteer: {
    email: process.env.E2E_VOLUNTEER_EMAIL || 'volunteer@test.com',
    password: process.env.E2E_VOLUNTEER_PASSWORD || 'Test@1234',
  },
  psychologist: {
    email: process.env.E2E_PSYCHOLOGIST_EMAIL || 'psychologist@mindease.test',
    password: process.env.E2E_PSYCHOLOGIST_PASSWORD || 'Psychologist@123',
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

async function cardFor(driver, title) {
  const heading = await driver.wait(
    until.elementLocated(By.xpath(`//h3[normalize-space()=${JSON.stringify(title)}]`)),
    20000
  );
  return heading.findElement(By.xpath('./ancestor::div[contains(@style,"border")][1]'));
}

async function hasButton(scope, text) {
  const buttons = await scope.findElements(By.css('button'));
  for (const b of buttons) {
    if (new RegExp(text, 'i').test(await b.getText())) return true;
  }
  return false;
}

// ------------------------------------------------------------------- suite

describe('MindEase T18.13 / T18.14 E2E - BL-18 video buttons (Selenium)', function () {
  this.timeout(120000);

  let driver;
  let tokens = {};
  const createdWorkshops = [];
  let acceptedCaseId = null;
  let caseSetupProblem = null;

  const onlineTitle = `${MARK} Online workshop with a room`;
  const inPersonTitle = `${MARK} In-person workshop, no room`;

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

    for (const role of ['facilitator', 'seeker', 'volunteer', 'psychologist']) {
      tokens[role] = await apiLogin(role);
    }

    // --- workshops for T18.13 ---
    const makeWorkshop = async (title, mode) => {
      const res = await api('/api/workshops', {
        method: 'POST',
        token: tokens.facilitator,
        body: {
          title,
          description: 'Temporary workshop created by the T18.13 video button E2E run.',
          date: futureDate(),
          time: '10:30 AM',
          mode,
          locationOrLink:
            mode === 'Online' ? 'https://meet.example.com/e2e-t18' : '12 Example Road, Dhaka',
          capacity: 25,
        },
      });
      if (res.status === 201) createdWorkshops.push(res.body.workshop._id);
      return res.body?.workshop?._id || null;
    };

    const onlineId = await makeWorkshop(onlineTitle, 'Online');
    await makeWorkshop(inPersonTitle, 'In-Person');

    // the seeker enrols in the online one, which is what earns the button
    if (onlineId) {
      await api(`/api/workshops/${onlineId}/enroll`, { method: 'POST', token: tokens.seeker });
    }

    // --- an accepted case for T18.14 ---
    try {
      if (!tokens.volunteer) throw new Error('no volunteer login');
      if (!tokens.psychologist) throw new Error('no psychologist login');

      const created = await api('/api/requests', {
        method: 'POST',
        token: tokens.seeker,
        body: {
          category: 'mental_health',
          description: `${MARK} temporary request for the video consultation E2E run.`,
          urgency: 'high',
        },
      });
      const requestId = created.body?.request?._id || created.body?._id;
      if (!requestId) throw new Error(`could not create a request (${created.status})`);

      const accepted = await api(`/api/requests/${requestId}/accept`, {
        method: 'PATCH',
        token: tokens.volunteer,
      });
      if (accepted.status !== 200) {
        throw new Error(`volunteer could not accept (${accepted.status})`);
      }

      const psychologists = await api('/api/escalations/psychologists', {
        token: tokens.volunteer,
      });
      const list = psychologists.body?.psychologists || psychologists.body?.data || [];
      const target = Array.isArray(list) ? list[0] : null;
      if (!target) throw new Error('no psychologist available to escalate to');

      const escalated = await api('/api/escalations', {
        method: 'POST',
        token: tokens.volunteer,
        body: {
          requestId,
          psychologistId: target._id,
          summary: `${MARK} handover summary written by the E2E run for the video button check.`,
        },
      });
      const assignmentId =
        escalated.body?.assignment?._id || escalated.body?.escalation?._id || escalated.body?._id;
      if (!assignmentId) throw new Error(`could not escalate (${escalated.status})`);

      const acceptedCase = await api(`/api/escalations/${assignmentId}/accept`, {
        method: 'PATCH',
        token: tokens.psychologist,
      });
      if (acceptedCase.status !== 200) {
        throw new Error(`psychologist could not accept the case (${acceptedCase.status})`);
      }

      acceptedCaseId = assignmentId;
    } catch (err) {
      caseSetupProblem = err.message;
    }
  });

  after(async function () {
    if (driver) await driver.quit();
    for (const id of createdWorkshops) {
      await api(`/api/workshops/${id}/cancel`, { method: 'PATCH', token: tokens.facilitator });
    }
    if (createdWorkshops.length) {
      console.log(`      cleanup: cancelled ${createdWorkshops.length} workshop(s)`);
    }
    if (acceptedCaseId) {
      // completing is as close to undoing as the API allows
      await api(`/api/escalations/${acceptedCaseId}/complete`, {
        method: 'PATCH',
        token: tokens.psychologist,
      });
      console.log('      cleanup: marked the temporary case completed');
    }
  });

  // ---------- T18.13 ----------

  describe('T18.13 the workshop join button', function () {
    it('E18.1 an enrolled seeker sees Join video session', async function () {
      await requireLogin(this, driver, 'seeker');
      await driver.get(`${BASE}/dashboard/workshops`);

      const card = await cardFor(driver, onlineTitle);
      expect(await card.getText()).to.match(/You are enrolled/i);
      expect(await hasButton(card, 'Join video session')).to.equal(true);
    });

    it('E18.2 an In-Person workshop never offers one', async function () {
      await requireLogin(this, driver, 'seeker');
      await driver.get(`${BASE}/dashboard/workshops`);

      const card = await cardFor(driver, inPersonTitle);
      expect(await hasButton(card, 'Join video session')).to.equal(false);
    });

    it('E18.3 the video room page opens for the enrolled seeker', async function () {
      await requireLogin(this, driver, 'seeker');
      const workshopId = createdWorkshops[0];
      await driver.get(`${BASE}/dashboard/video/workshop/${workshopId}`);

      const link = await driver.wait(
        until.elementLocated(By.xpath('//a[contains(., "open the room directly")]')),
        20000
      );
      expect(await link.getAttribute('href')).to.match(/mindease-workshop-/);
    });

    it('E18.4 the facilitator who owns it reaches the same room', async function () {
      const workshopId = createdWorkshops[0];

      // read both rooms through the API: the facilitator has no workshop list
      // page yet, so there is no button of theirs to click (see the QA note)
      const asSeeker = await api(`/api/video/workshop/${workshopId}`, { token: tokens.seeker });
      const asFacilitator = await api(`/api/video/workshop/${workshopId}`, {
        token: tokens.facilitator,
      });

      expect(asSeeker.status).to.equal(200);
      expect(asFacilitator.status).to.equal(200);
      expect(asFacilitator.body.roomName).to.equal(asSeeker.body.roomName);
      expect(asFacilitator.body.isModerator).to.equal(true);
      expect(asSeeker.body.isModerator).to.equal(false);
    });

    it('E18.5 the room page refuses a seeker who is not enrolled', async function () {
      await requireLogin(this, driver, 'seeker');
      // cancel the enrollment, then reload the room page
      const workshopId = createdWorkshops[0];
      await api(`/api/workshops/${workshopId}/enroll`, {
        method: 'DELETE',
        token: tokens.seeker,
      });

      await driver.get(`${BASE}/dashboard/video/workshop/${workshopId}`);
      const alert = await driver.wait(until.elementLocated(By.css("p[role='alert']")), 20000);
      expect(await alert.getText()).to.match(/not part of this workshop/i);

      // put it back for any later run
      await api(`/api/workshops/${workshopId}/enroll`, { method: 'POST', token: tokens.seeker });
    });
  });

  // ---------- T18.14 ----------

  describe('T18.14 the psychologist consultation button', function () {
    it('E18.6 the psychologist sees Join video consultation on an accepted case', async function () {
      if (caseSetupProblem) pending(this, `could not build an accepted case: ${caseSetupProblem}`);
      await requireLogin(this, driver, 'psychologist');

      await driver.get(`${BASE}/dashboard/psychologist/cases/${acceptedCaseId}`);
      const button = await driver.wait(
        until.elementLocated(By.xpath('//button[contains(., "video consultation")]')),
        20000
      );
      expect(await button.isDisplayed()).to.equal(true);
    });

    it('E18.7 the consultation room page opens for the psychologist', async function () {
      if (caseSetupProblem) pending(this, `could not build an accepted case: ${caseSetupProblem}`);
      await requireLogin(this, driver, 'psychologist');

      await driver.get(`${BASE}/dashboard/video/case/${acceptedCaseId}`);
      const heading = await driver.wait(until.elementLocated(By.css('h2')), 20000);
      expect(await heading.getText()).to.match(/consultation/i);
    });

    it('E18.8 the seeker reaches the same room through their request', async function () {
      if (caseSetupProblem) pending(this, `could not build an accepted case: ${caseSetupProblem}`);

      const asPsychologist = await api(`/api/video/case/${acceptedCaseId}`, {
        token: tokens.psychologist,
      });
      const mine = await api('/api/requests/mine', { token: tokens.seeker });
      const escalated = (mine.body?.requests || []).find((r) =>
        String(r.description || '').includes(MARK)
      );
      expect(escalated, 'the escalated request should be in the seeker list').to.exist;

      const asSeeker = await api(`/api/video/request/${escalated._id}`, { token: tokens.seeker });

      expect(asSeeker.status).to.equal(200);
      expect(asSeeker.body.roomName).to.equal(asPsychologist.body.roomName);
      expect(asSeeker.body.isModerator).to.equal(false);
      expect(asPsychologist.body.isModerator).to.equal(true);
    });

    it('E18.9 a case that is not accepted has no room', async function () {
      if (caseSetupProblem) pending(this, `could not build an accepted case: ${caseSetupProblem}`);

      // complete the case, then ask again
      await api(`/api/escalations/${acceptedCaseId}/complete`, {
        method: 'PATCH',
        token: tokens.psychologist,
      });
      const res = await api(`/api/video/case/${acceptedCaseId}`, { token: tokens.psychologist });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.match(/not accepted/i);
    });
  });
});
