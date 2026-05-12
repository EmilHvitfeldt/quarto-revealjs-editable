// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode — Tables', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-table.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-table.qmd first');
    }
  });

  test('table on a slide gets modify-mode-valid class', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    expect(await page.locator('table.modify-mode-valid').count()).toBe(1);
  });

  test('multiple tables on a slide are all classified valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    expect(await page.locator('[data-editable-modified-table-idx]').count()).toBe(2);
  });

  test('clicking a table wraps it in editable-container', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    await page.locator('table.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    expect(await page.locator('.editable-container').count()).toBe(1);
  });

  test('activated table has move capability but not resize', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('table.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    // Resize corner handles should not be created for tables.
    const handles = await page.locator('.editable-container .editable-handle').count();
    expect(handles).toBe(0);
  });

  test('serialize wraps activated table in fenced div with absolute position', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('table.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    await page.waitForFunction(() => {
      const container = document.querySelector('.editable-container');
      return container && container.style.left !== '';
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());
    const chunks = qmd.split(/(?=^## )/m);
    const slide = chunks.find(c => c.includes('Slide 1')) ?? '';

    const wrapStart = slide.indexOf('::: {.absolute');
    const headerIdx = slide.indexOf('| A | B |');
    const sepIdx    = slide.indexOf('|---|---|');
    const wrapEnd   = slide.indexOf(':::', sepIdx);

    expect(wrapStart).toBeGreaterThanOrEqual(0);
    expect(headerIdx).toBeGreaterThan(wrapStart);
    expect(sepIdx).toBeGreaterThan(headerIdx);
    expect(wrapEnd).toBeGreaterThan(sepIdx);
    // The serialized attrs must include left/top but not width/height (move-only).
    const wrapLine = slide.slice(wrapStart, slide.indexOf('\n', wrapStart));
    expect(wrapLine).toMatch(/left=\d+px/);
    expect(wrapLine).toMatch(/top=\d+px/);
    expect(wrapLine).not.toMatch(/width=/);
    expect(wrapLine).not.toMatch(/height=/);
  });
});
