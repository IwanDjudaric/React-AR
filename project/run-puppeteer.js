const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]: ${err.toString()}`);
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.waitForTimeout(3000); // give it time to fetch model
  
  const status = await page.evaluate(() => {
    return document.querySelector('.status-chip')?.innerText;
  });
  console.log(`[STATUS] : ${status}`);
  
  await browser.close();
})();
