
const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');

const BASE_URL = 'http://localhost:5173';
const NGO_EMAIL = process.env.NGO_EMAIL || 'ngo@test.com';
const NGO_PASSWORD = process.env.NGO_PASSWORD; // set before running, never commit it

// Link on a referral card that opens ReferralDetail.
// If your router path differs, change only this line.
const REFERRAL_LINK_XPATH = "(//a[contains(@href, 'referral')])[1]";

describe('MindEase NGO E2E Testing (Selenium)', function () {
  this.timeout(60000);
  let driver;

  before(async function () {
    if (!NGO_PASSWORD) {
      throw new Error('Set NGO_PASSWORD before running this test.');
    }
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().window().maximize();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it('T14.11: NGO logs in, sees a referral and updates its status', async function () {
    // 1. Log in as the NGO officer
    await driver.get(`${BASE_URL}/login`);

    const emailInput = await driver.wait(
      until.elementLocated(By.xpath("//input[@type='email' or contains(@placeholder, 'email') or contains(@name, 'email')]")),
      10000
    );
    await emailInput.clear();
    await emailInput.sendKeys(NGO_EMAIL);

    const passInput = await driver.findElement(
      By.xpath("//input[@type='password' or contains(@placeholder, 'password') or contains(@name, 'password')]")
    );
    await passInput.clear();
    await passInput.sendKeys(NGO_PASSWORD);

    const loginBtn = await driver.findElement(By.xpath("//button[@type='submit' or contains(text(), 'Login') or contains(text(), 'Sign')]"));
    await loginBtn.click();
    await driver.sleep(2000);

    // 2. Open the NGO dashboard and check that a referral is listed
    await driver.get(`${BASE_URL}/dashboard/ngo`);
    await driver.wait(
      until.elementLocated(By.xpath("//h2[contains(., 'Referred Cases')]")),
      10000
    );
    await driver.wait(until.elementLocated(By.id('status-filter')), 10000);

    const emptyMsg = await driver.findElements(
      By.xpath("//p[contains(., 'No referred cases yet')]")
    );
    expect(emptyMsg.length, 'NGO has no referral to test with').to.equal(0);

    // 3. Open the first referral
    const link = await driver.wait(
      until.elementLocated(By.xpath(REFERRAL_LINK_XPATH)),
      10000
    );
    await link.click();

    // 4. Change the status and add a note
    const statusSelect = await driver.wait(
      until.elementLocated(By.id('referral-status')),
      10000
    );
    const currentStatus = await statusSelect.getAttribute('value');
    const targetStatus = currentStatus === 'in_progress' ? 'resolved' : 'in_progress';

    await driver
      .findElement(By.xpath(`//select[@id='referral-status']/option[@value='${targetStatus}']`))
      .click();

    const note = `Selenium E2E note ${Date.now()}`;
    const noteBox = await driver.findElement(By.id('referral-note'));
    await noteBox.clear();
    await noteBox.sendKeys(note);

    // 5. Save and check the success message
    const saveBtn = await driver.findElement(By.xpath("//button[normalize-space()='Save']"));
    await driver.wait(until.elementIsEnabled(saveBtn), 5000);
    await saveBtn.click();

    await driver.wait(
      until.elementLocated(By.xpath("//p[@role='status' and contains(., 'Referral updated.')]")),
      10000
    );

    // 6. The form must now show the saved status and note
    const savedStatus = await driver.findElement(By.id('referral-status')).getAttribute('value');
    const savedNote = await driver.findElement(By.id('referral-note')).getAttribute('value');
    expect(savedStatus).to.equal(targetStatus);
    expect(savedNote).to.equal(note);
  });
});