// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode - Chunk figure caption bundling', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'chunk-figures.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/chunk-figures.qmd first');
    }
  });

  test('activating a code-chunk figure with fig-cap moves the caption inside the editable-container', async ({ page }) => {
    await setupPage(page, 'chunk-figures.html');
    // "Chunk figure with caption" is slide index 4
    await navigateToSlide(page, 4);
    await page.click('.toolbar-modify');
    await page.locator('img.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container img', { timeout: 3000 });

    const containsCaption = await page.evaluate(() => {
      const container = document.querySelector('.editable-container');
      const cap = container.querySelector('p.caption, p.figure-caption');
      return cap !== null && /A plot caption/.test(cap.textContent);
    });
    expect(containsCaption).toBe(true);
  });
});
