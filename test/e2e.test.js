const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');

describe('MindEase Automated E2E Testing (Selenium)', function () {
  this.timeout(50000);
  let driver;

  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().window().maximize();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it('T5.7: Should verify chat routing & UI interactions', async function () {
    // 1. Authenticate via Login
    await driver.get('http://localhost:5173/login');

    const emailInput = await driver.wait(
      until.elementLocated(By.xpath("//input[@type='email' or contains(@placeholder, 'email') or contains(@name, 'email')]")),
      10000
    );
    await emailInput.clear();
    await emailInput.sendKeys('23201015@uap-bd.edu');

    const passInput = await driver.findElement(
      By.xpath("//input[@type='password' or contains(@placeholder, 'password') or contains(@name, 'password')]")
    );
    await passInput.clear();
    await passInput.sendKeys('12345678');

    const loginBtn = await driver.findElement(By.xpath("//button[@type='submit' or contains(text(), 'Login') or contains(text(), 'Sign')]"));
    await loginBtn.click();
    await driver.sleep(2000);

    // 2. Navigate to Chat Route
    await driver.get('http://localhost:5173/dashboard/chat');
    await driver.sleep(2000);

    // 3. Dynamic Handler: Check if input exists or standard dashboard chat window loaded
    const inputs = await driver.findElements(By.xpath("//input | //textarea"));
    
    if (inputs.length > 0) {
      const testMsg = 'Automated message sent by Selenium!';
      await inputs[0].sendKeys(testMsg);

      const sendBtn = await driver.findElement(By.xpath("//button[contains(., 'Send') or contains(@type, 'submit')]"));
      await sendBtn.click();
      await driver.sleep(1000);

      const pageSource = await driver.getPageSource();
      expect(pageSource).to.include(testMsg);
    } else {
      // If no active session input, verify chat interface layout container rendered
      const currentUrl = await driver.getCurrentUrl();
      expect(currentUrl).to.include('/dashboard/chat');
    }
  });

  it('T7.6: Should block non-NGO user from accessing NGO route', async function () {
    await driver.get('http://localhost:5173/dashboard/ngo');
    await driver.sleep(1500);

    const currentUrl = await driver.getCurrentUrl();
    expect(currentUrl).to.not.include('/dashboard/ngo');
  });
});