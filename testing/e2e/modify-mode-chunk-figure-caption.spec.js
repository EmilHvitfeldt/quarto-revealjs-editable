// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

// chunk-figures.qmd executes R chunks. Locally `quarto render chunk-figures.qmd`
// produces the HTML this spec needs. In CI (no R toolchain) the file won't
// exist, so we skip the suite rather than fail.
const HAS_FIXTURE = fs.existsSync(path.join(TESTING_DIR, 'chunk-figures.html'));

test.describe(HAS_FIXTURE ? 'Modify Mode - Chunk figure caption bundling'
                          : 'Modify Mode - Chunk figure caption bundling (skipped: chunk-figures.html not rendered)', () => {
  test.skip(!HAS_FIXTURE, 'chunk-figures.html missing — run `quarto render testing/chunk-figures.qmd` (requires R) to enable');

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
