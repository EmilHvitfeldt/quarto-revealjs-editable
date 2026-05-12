// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode — Code chunk outputs', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-code-output.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-code-output.qmd first');
    }
  });

  test('OJS cell gets modify-mode-valid class', async ({ page }) => {
    await setupPage(page, 'modify-mode-code-output.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    const valid = await page.locator('div.cell.modify-mode-valid').count();
    expect(valid).toBe(1);
  });

  test('the cell has move+resize but not text editing capabilities', async ({ page }) => {
    await setupPage(page, 'modify-mode-code-output.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    // OJS output may not have rendered yet (zero-height cell), so dispatch the
    // click directly via JS to bypass viewport/visibility checks.
    await page.evaluate(() => document.querySelector('div.cell.modify-mode-valid').click());

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    expect(await page.locator('.editable-container').count()).toBe(1);

    // No Quill rich-text editor should appear on a code chunk output cell.
    const quillCount = await page.locator('.editable-container .ql-editor').count();
    expect(quillCount).toBe(0);

    // No font-size or alignment toolbar controls.
    const fontControls = await page.locator('.editable-container .editable-control-font-size').count();
    expect(fontControls).toBe(0);
  });

  test('multiple cells on a slide are all classified valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-code-output.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const valid = await page.locator('div.cell.modify-mode-valid').count();
    expect(valid).toBe(2);
  });

  test('plain code block alongside OJS cell — both classifiers apply without conflict', async ({ page }) => {
    await setupPage(page, 'modify-mode-code-output.html');
    await navigateToSlide(page, 2);
    await page.click('.toolbar-modify');

    // OJS cell is claimed by the new classifier
    const cellValid = await page.locator('div.cell.modify-mode-valid').count();
    expect(cellValid).toBe(1);

    // Plain ```python``` block (non-executable) is claimed by the Code blocks classifier
    const codeValid = await page.locator('div.code-copy-outer-scaffold.modify-mode-valid').count();
    expect(codeValid).toBe(1);
  });

  test('serialize wraps activated cell in fenced div with absolute position', async ({ page }) => {
    await setupPage(page, 'modify-mode-code-output.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.evaluate(() => document.querySelector('div.cell.modify-mode-valid').click());

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    await page.waitForFunction(() => {
      const container = document.querySelector('.editable-container');
      return container && container.style.left !== '';
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());
    const slide = qmd.split(/(?=^## )/m).find(c => c.includes('Slide 1')) ?? '';

    // The OJS chunk should now be wrapped in a positioned fenced div, with
    // the original ```{ojs}``` fence preserved inside.
    const wrapStart = slide.indexOf('::: {.absolute');
    const chunkStart = slide.indexOf('```{ojs}');
    const chunkEnd = slide.indexOf('```', chunkStart + 3);
    const wrapEnd = slide.indexOf(':::', chunkEnd + 3);

    expect(wrapStart).toBeGreaterThanOrEqual(0);
    expect(chunkStart).toBeGreaterThan(wrapStart);
    expect(chunkEnd).toBeGreaterThan(chunkStart);
    expect(wrapEnd).toBeGreaterThan(chunkEnd);
    expect(slide).toContain('md`**hello** from observable`');
  });
});
