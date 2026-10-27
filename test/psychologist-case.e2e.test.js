const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');

const BASE_URL = 'http://localhost:5173';
const PSY_EMAIL = process.env.PSYCHOLOGIST_EMAIL || 'psychologist@mindease.test';
const PSY_PASSWORD = process.env.PSYCHOLOGIST_PASSWORD; // set before running, never commit it

// Psychologist case directory (PsychologistDashboard.jsx).
// If your router path differs, change only this line.
const DASHBOARD_PATH = '/dashboard/psychologist';

describe('MindEase Psychologist E2E Testing (Selenium)', function () {
  this.timeout(90000);
  let driver;

  before(async function () {
    if (!PSY_PASSWORD) {
      throw new Error('Set PSYCHOLOGIST_PASSWORD before running this test.');
    }
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().window().maximize();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  // Waits until the "Lifecycle Status" on the case page equals `expected`.
  // The page reloads after a status change, so the element is located again on every try.
  async function waitForCaseStatus(expected) {
    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.xpath("//p[contains(., 'Lifecycle Status')]/strong")
          );
          return (await el.getText()).trim().toLowerCase() === expected.toLowerCase();
        } catch (e) {
          return false; // page is still reloading
        }
      },
      15000,
      `Case status did not become ${expected}`
    );
  }

  // Clicks "Confirm Decision" in the status transition modal.
  async function confirmDecision() {
    const confirmBtn = await driver.wait(
      until.elementLocated(By.xpath("//button[normalize-space()='Confirm Decision']")),
      10000
    );
    await confirmBtn.click();
  }

  it('C5.6: psychologist logs in, accepts a case, adds a note and completes it', async function () {
    // 1. Log in as the psychologist
    await driver.get(`${BASE_URL}/login`);

    const emailInput = await driver.wait(
      until.elementLocated(By.xpath("//input[@type='email' or contains(@placeholder, 'email') or contains(@name, 'email')]")),
      10000
    );
    await emailInput.clear();
    await emailInput.sendKeys(PSY_EMAIL);

    const passInput = await driver.findElement(
      By.xpath("//input[@type='password' or contains(@placeholder, 'password') or contains(@name, 'password')]")
    );
    await passInput.clear();
    await passInput.sendKeys(PSY_PASSWORD);

    const loginBtn = await driver.findElement(
      By.xpath("//button[@type='submit' or contains(text(), 'Login') or contains(text(), 'Sign')]")
    );
    await loginBtn.click();

    await driver.wait(
      async () => !(await driver.getCurrentUrl()).includes('/login'),
      10000,
      'Login did not redirect away from /login'
    );

    // 2. Open the case directory and show only Pending cases
    await driver.get(`${BASE_URL}${DASHBOARD_PATH}`);
    await driver.wait(
      until.elementLocated(By.xpath("//h1[contains(., 'Psychologist Consultations')]")),
      10000
    );

    const statusSelect = await driver.wait(
      until.elementLocated(By.xpath("//select[option[@value='pending']]")),
      10000
    );
    await statusSelect.findElement(By.xpath("./option[@value='pending']")).click();

    // Wait until the list shows only Pending rows (or the empty message)
    const listState = await driver.wait(async () => {
      try {
        const empty = await driver.findElements(
          By.xpath("//p[contains(., 'No assigned cases matching')]")
        );
        if (empty.length > 0) return 'empty';

        const badges = await driver.findElements(By.xpath("//tbody/tr/td[4]//span"));
        if (badges.length === 0) return false;
        for (const badge of badges) {
          if ((await badge.getText()).trim().toLowerCase() !== 'pending') return false;
        }
        return 'rows';
      } catch (e) {
        return false; // list is still reloading
      }
    }, 15000);
    expect(listState, 'Psychologist has no Pending case to test with').to.equal('rows');

    // 3. Open the first pending case
    const caseId = (
      await driver.findElement(By.xpath("(//tbody/tr)[1]/td[1]")).getText()
    ).trim();
    await driver
      .findElement(By.xpath("(//tbody/tr)[1]//button[normalize-space()='Manage Case']"))
      .click();
    await driver.wait(until.urlContains(`/psychologist/case/${caseId}`), 10000);

    // 4. Accept the case
    const acceptBtn = await driver.wait(
      until.elementLocated(By.xpath("//button[normalize-space()='Accept Case Request']")),
      15000
    );
    await acceptBtn.click();

    const reasonBox = await driver.wait(
      until.elementLocated(By.xpath("//textarea[contains(@placeholder, 'justification')]")),
      10000
    );
    await reasonBox.sendKeys('Selenium E2E: accepting case');
    await confirmDecision();
    await waitForCaseStatus('Accepted');

    // 5. Add a private note
    const noteBox = await driver.wait(
      until.elementLocated(By.xpath("//textarea[contains(@placeholder, 'Record clinical observation')]")),
      15000
    );
    const note = `Selenium E2E note ${Date.now()}`;
    await noteBox.sendKeys(note);

    const noteBtn = await driver.findElement(
      By.xpath("//button[normalize-space()='Record Private Note']")
    );
    await driver.wait(until.elementIsEnabled(noteBtn), 5000);
    await noteBtn.click();

    await driver.wait(
      until.elementLocated(By.xpath(`//p[contains(., '${note}')]`)),
      10000,
      'Saved note did not appear in the notes list'
    );

    // 6. Complete the session
    const completeBtn = await driver.wait(
      until.elementLocated(By.xpath("//button[normalize-space()='Mark Session Completed']")),
      10000
    );
    await completeBtn.click();
    await confirmDecision();
    await waitForCaseStatus('Completed');

    // 7. Final checks: no more action buttons, and the note is still there after the reload
    const actionButtons = await driver.findElements(
      By.xpath("//button[normalize-space()='Accept Case Request' or normalize-space()='Reject Case' or normalize-space()='Mark Session Completed']")
    );
    expect(actionButtons.length, 'Action buttons should be gone for a completed case').to.equal(0);

    const savedNote = await driver.findElements(By.xpath(`//p[contains(., '${note}')]`));
    expect(savedNote.length, 'Note should still be listed after completion').to.be.above(0);
  });
});