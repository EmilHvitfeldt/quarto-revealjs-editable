// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode — Code blocks', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-code.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-code.qmd first');
    }
  });

  test('highlighted code-block wrapper gets modify-mode-valid class', async ({ page }) => {
    await setupPage(page, 'modify-mode-code.html');
    // indexh=0 = Slide 1 - Highlighted code block
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    const wrapperValid = await page.locator('div.code-copy-outer-scaffold.modify-mode-valid').count();
    expect(wrapperValid).toBe(1);
  });

  test('plain (no-language) pre is clickable and shows green ring', async ({ page }) => {
    await setupPage(page, 'modify-mode-code.html');
    // indexh=1 = Slide 2 - Plain code block
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const valid = await page.locator('pre.modify-mode-valid').count();
    expect(valid).toBe(1);

    // The green-ring box-shadow must actually render (regression guard for the
    // CSS selector list — pre was missing from it).
    const boxShadow = await page.locator('pre.modify-mode-valid').first()
      .evaluate(el => window.getComputedStyle(el).boxShadow);
    expect(boxShadow).not.toBe('none');
    expect(boxShadow).not.toBe('');
  });

  test('clicking a plain pre wraps it in editable-container', async ({ page }) => {
    await setupPage(page, 'modify-mode-code.html');
    // indexh=1 = Slide 2 - Plain code block
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    await page.locator('pre.modify-mode-valid').click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    expect(await page.locator('.editable-container').count()).toBe(1);
  });

  test('clicking a highlighted code block wraps it in editable-container', async ({ page }) => {
    await setupPage(page, 'modify-mode-code.html');
    // indexh=0 = Slide 1 - Highlighted code block
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    await page.locator('.code-copy-outer-scaffold.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    expect(await page.locator('.editable-container').count()).toBe(1);
  });

  test('multiple code blocks on a slide are all classified valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-code.html');
    // indexh=2 = Slide 3 - Multiple code blocks
    await navigateToSlide(page, 2);
    await page.click('.toolbar-modify');

    const valid = await page.locator('[data-editable-modified-code-idx]').count();
    expect(valid).toBe(2);
  });

  test('serialize wraps activated code block in fenced div with absolute position', async ({ page }) => {
    await setupPage(page, 'modify-mode-code.html');
    // indexh=0 = Slide 1 - Highlighted code block
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('.code-copy-outer-scaffold.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    await page.waitForFunction(() => {
      const container = document.querySelector('.editable-container');
      return container && container.style.left !== '';
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());
    const chunks = qmd.split(/(?=^## )/m);
    const slide = chunks.find(c => c.includes('Slide 1')) ?? '';

    // The code block should now be wrapped in a positioned fenced div, with
    // the original ```python fence preserved inside.
    const wrapStart = slide.indexOf('::: {.absolute');
    const codeStart = slide.indexOf('```python');
    const codeEnd   = slide.indexOf('```', codeStart + 3);
    const wrapEnd   = slide.indexOf(':::', codeEnd + 3);

    expect(wrapStart).toBeGreaterThanOrEqual(0);
    expect(codeStart).toBeGreaterThan(wrapStart);
    expect(codeEnd).toBeGreaterThan(codeStart);
    expect(wrapEnd).toBeGreaterThan(codeEnd);
    expect(slide).toContain('x = 1');
  });
});
