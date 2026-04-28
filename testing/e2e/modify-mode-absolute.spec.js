// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode — {.absolute} divs', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-absolute.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-absolute.qmd first');
    }
  });

  test('div.absolute elements get modify-mode-valid class when modify mode entered', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await page.click('.toolbar-modify');

    const validDivs = await page.locator('div.absolute.modify-mode-valid').count();
    expect(validDivs).toBeGreaterThan(0);
  });

  test('clicking valid div.absolute wraps it in editable-container', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await page.click('.toolbar-modify');

    await page.locator('div.absolute.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container div.absolute', { timeout: 3000 });
    const containers = await page.locator('.editable-container div.absolute').count();
    expect(containers).toBe(1);
  });

  test('container left/top matches original inline style after activation', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await page.click('.toolbar-modify');
    await page.locator('div.absolute.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container div.absolute', { timeout: 3000 });

    // Wait for waitForRegistryThenFixPosition to run and set container position
    await page.waitForFunction(() => {
      const container = document.querySelector('.editable-container');
      return container && parseFloat(container.style.left) > 0;
    }, { timeout: 3000 });

    const containerLeft = await page.evaluate(() => {
      const container = document.querySelector('.editable-container');
      return parseFloat(container.style.left);
    });
    const containerTop = await page.evaluate(() => {
      const container = document.querySelector('.editable-container');
      return parseFloat(container.style.top);
    });

    // Slide 1 div has left=100px top=80px
    expect(containerLeft).toBeCloseTo(100, 0);
    expect(containerTop).toBeCloseTo(80, 0);
  });

  test('serialize updates the correct {.absolute} block in QMD', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await page.click('.toolbar-modify');
    await page.locator('div.absolute.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container div.absolute', { timeout: 3000 });
    await page.waitForFunction(() => {
      const container = document.querySelector('.editable-container');
      return container && parseFloat(container.style.left) > 0;
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());

    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => c.includes('## Slide 1')) ?? '';
    const slide2 = chunks.find(c => c.includes('## Slide 2')) ?? '';

    // Slide 1 block should now have {.absolute ...} with updated values
    expect(slide1).toContain('{.absolute');
    // Slide 2 should remain unchanged (still original {.absolute ...} markers)
    expect(slide2).toContain('left=50px');
    expect(slide2).toContain('left=300px');
  });

  test('two div.absolute on same slide both get modify-mode-valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const validDivs = await page.locator('div.absolute.modify-mode-valid').count();
    expect(validDivs).toBe(2);
  });

  test('both divs on slide 2 can be activated and serialize independently', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    // Activate first div (exits modify mode automatically)
    await page.locator('div.absolute.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container div.absolute', { timeout: 3000 });

    // Re-enter modify mode to activate second div
    await page.click('.toolbar-modify');
    await page.locator('div.absolute.modify-mode-valid').first().click();
    await page.waitForFunction(
      () => document.querySelectorAll('.editable-container div.absolute').length >= 2,
      { timeout: 3000 }
    );

    const qmd = await page.evaluate(() => getTransformedQmd());
    const chunks = qmd.split(/(?=^## )/m);
    const slide2 = chunks.find(c => c.includes('## Slide 2')) ?? '';

    // Both blocks should have been processed and contain {.absolute
    const matches = slide2.match(/\{\.absolute/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(2);
  });
});
