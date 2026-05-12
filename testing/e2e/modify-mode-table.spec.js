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

  test('pipe table on a slide gets modify-mode-valid class', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    expect(await page.locator('table.modify-mode-valid').count()).toBe(1);
  });

  test('multiple pipe tables on a slide are all classified valid', async ({ page }) => {
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
    expect(await page.locator('.editable-container .editable-handle').count()).toBe(0);
  });

  test('serialize wraps activated pipe table in fenced div with absolute position only', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('table.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container', { timeout: 3000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('.editable-container');
      return c && c.style.left !== '';
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());
    const slide = (qmd.split(/(?=^## )/m).find(c => c.includes('Slide 1')) ?? '');
    const wrapStart = slide.indexOf('::: {.absolute');
    expect(wrapStart).toBeGreaterThanOrEqual(0);
    const wrapLine = slide.slice(wrapStart, slide.indexOf('\n', wrapStart));
    expect(wrapLine).toMatch(/left=\d+px/);
    expect(wrapLine).toMatch(/top=\d+px/);
    expect(wrapLine).not.toMatch(/width=|height=/);
    expect(slide).toContain('| A | B |');
    expect(slide).toContain('|---|---|');
  });

  test('grid table is classified valid and serializes wrapped', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 3);
    await page.click('.toolbar-modify');
    expect(await page.locator('table.modify-mode-valid').count()).toBe(1);
    await page.locator('table.modify-mode-valid').first().click();
    await page.waitForFunction(() => {
      const c = document.querySelector('.editable-container');
      return c && c.style.left !== '';
    }, { timeout: 3000 });
    const qmd = await page.evaluate(() => getTransformedQmd());
    const slide = (qmd.split(/(?=^## )/m).find(c => c.includes('Slide 4')) ?? '');
    expect(slide).toMatch(/::: \{\.absolute[^}]*\}\n\+---/);
    expect(slide).toContain('+===+===+');
  });

  test('HTML table is classified valid and serializes wrapped', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 4);
    await page.click('.toolbar-modify');
    expect(await page.locator('table.modify-mode-valid').count()).toBe(1);
    await page.locator('table.modify-mode-valid').first().click();
    await page.waitForFunction(() => {
      const c = document.querySelector('.editable-container');
      return c && c.style.left !== '';
    }, { timeout: 3000 });
    const qmd = await page.evaluate(() => getTransformedQmd());
    const slide = (qmd.split(/(?=^## )/m).find(c => c.includes('Slide 5')) ?? '');
    expect(slide).toMatch(/::: \{\.absolute[^}]*\}\n<table/);
    // Closing fence appears after </table>.
    const close = slide.indexOf('</table>');
    expect(slide.indexOf(':::', close)).toBeGreaterThan(close);
  });

  test('captioned table wrap includes the caption line', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 5);
    await page.click('.toolbar-modify');
    await page.locator('[data-editable-modified-table-idx]').first().click();
    await page.waitForFunction(() => {
      const c = document.querySelector('.editable-container');
      return c && c.style.left !== '';
    }, { timeout: 3000 });
    const qmd = await page.evaluate(() => getTransformedQmd());
    const slide = (qmd.split(/(?=^## )/m).find(c => c.includes('Slide 6')) ?? '');
    const wrapStart = slide.indexOf('::: {.absolute');
    const captionIdx = slide.indexOf(': My caption');
    const closeIdx = slide.indexOf(':::', captionIdx);
    expect(wrapStart).toBeGreaterThanOrEqual(0);
    expect(captionIdx).toBeGreaterThan(wrapStart);
    expect(closeIdx).toBeGreaterThan(captionIdx);
  });

  test('list-table is classified valid and serializes wrapped', async ({ page }) => {
    await setupPage(page, 'modify-mode-table.html');
    await navigateToSlide(page, 6);
    await page.click('.toolbar-modify');
    expect(await page.locator('[data-editable-modified-table-idx]').count()).toBe(1);
    await page.locator('[data-editable-modified-table-idx]').first().click();
    await page.waitForFunction(() => {
      const c = document.querySelector('.editable-container');
      return c && c.style.left !== '';
    }, { timeout: 3000 });
    const qmd = await page.evaluate(() => getTransformedQmd());
    const slide = (qmd.split(/(?=^## )/m).find(c => c.includes('Slide 7')) ?? '');
    // Outer .absolute wrap surrounds the inner .list-table fenced div.
    const outer = slide.indexOf('::: {.absolute');
    const inner = slide.indexOf('::: {.list-table}', outer);
    expect(outer).toBeGreaterThanOrEqual(0);
    expect(inner).toBeGreaterThan(outer);
  });
});
