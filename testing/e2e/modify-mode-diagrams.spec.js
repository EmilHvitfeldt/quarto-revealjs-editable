// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode — Diagram chunks (mermaid, dot)', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-diagrams.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-diagrams.qmd first');
    }
  });

  test('mermaid cell gets modify-mode-valid class', async ({ page }) => {
    await setupPage(page, 'modify-mode-diagrams.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    const valid = await page.locator('section.present div.cell.modify-mode-valid').count();
    expect(valid).toBe(1);
  });

  test('dot cell gets modify-mode-valid class', async ({ page }) => {
    await setupPage(page, 'modify-mode-diagrams.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const valid = await page.locator('section.present div.cell.modify-mode-valid').count();
    expect(valid).toBe(1);
  });

  test('multiple diagram chunks on a slide are all classified valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-diagrams.html');
    await navigateToSlide(page, 2);
    await page.click('.toolbar-modify');

    const valid = await page.locator('section.present div.cell.modify-mode-valid').count();
    expect(valid).toBe(2);
  });

  test('clicking a mermaid cell wraps it in editable-container with move+resize only', async ({ page }) => {
    await setupPage(page, 'modify-mode-diagrams.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.evaluate(() =>
      document.querySelector('section.present div.cell.modify-mode-valid').click()
    );

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    expect(await page.locator('.editable-container').count()).toBe(1);

    const quillCount = await page.locator('.editable-container .ql-editor').count();
    expect(quillCount).toBe(0);
    const fontControls = await page.locator('.editable-container .editable-control-font-size').count();
    expect(fontControls).toBe(0);
  });

  test('after activating one of two diagram chunks, the sibling can still be modified', async ({ page }) => {
    await setupPage(page, 'modify-mode-diagrams.html');
    // Slide 3 has a mermaid + dot chunk side by side.
    await navigateToSlide(page, 2);
    await page.click('.toolbar-modify');

    // Activate the first one.
    await page.evaluate(() =>
      document.querySelector('section.present div.cell.modify-mode-valid').click()
    );
    await page.waitForSelector('section.present .editable-container', { timeout: 3000 });

    // Re-enter modify mode and verify the sibling is still classifiable.
    await page.click('.toolbar-modify');

    const stillValid = await page.locator('section.present div.cell.modify-mode-valid').count();
    expect(stillValid).toBe(1);
  });

  test('serialize wraps activated mermaid chunk in fenced div with absolute position', async ({ page }) => {
    await setupPage(page, 'modify-mode-diagrams.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.evaluate(() =>
      document.querySelector('section.present div.cell.modify-mode-valid').click()
    );

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('.editable-container');
      return c && c.style.left !== '';
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());
    const slide = qmd.split(/(?=^## )/m).find(c => c.includes('Slide 1')) ?? '';

    const wrapStart = slide.indexOf('::: {.absolute');
    const chunkStart = slide.indexOf('```{mermaid}');
    const chunkEnd = slide.indexOf('```', chunkStart + 3);
    const wrapEnd = slide.indexOf(':::', chunkEnd + 3);

    expect(wrapStart).toBeGreaterThanOrEqual(0);
    expect(chunkStart).toBeGreaterThan(wrapStart);
    expect(chunkEnd).toBeGreaterThan(chunkStart);
    expect(wrapEnd).toBeGreaterThan(chunkEnd);
    expect(slide).toContain('flowchart LR');
  });

  test('named mermaid chunk write-back matches by label', async ({ page }) => {
    await setupPage(page, 'modify-mode-diagrams.html');
    await navigateToSlide(page, 3);
    await page.click('.toolbar-modify');
    await page.evaluate(() =>
      document.querySelector('section.present div.cell.modify-mode-valid').click()
    );

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('.editable-container');
      return c && c.style.left !== '';
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());
    const slide = qmd.split(/(?=^## )/m).find(c => c.includes('Slide 4')) ?? '';

    const wrapStart = slide.indexOf('::: {.absolute');
    const chunkStart = slide.indexOf('```{mermaid}');
    expect(wrapStart).toBeGreaterThanOrEqual(0);
    expect(chunkStart).toBeGreaterThan(wrapStart);
    expect(slide).toContain('%%| label: mychart');
  });
});
