// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode — Paragraphs', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-paragraph.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-paragraph.qmd first');
    }
  });

  test('paragraph elements get modify-mode-valid class when modify mode entered', async ({ page }) => {
    await setupPage(page, 'modify-mode-paragraph.html');
    // indexh=0 = Slide 1 - Single paragraph
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    const validParas = await page.locator('p.modify-mode-valid').count();
    expect(validParas).toBeGreaterThan(0);
  });

  test('clicking valid paragraph wraps it in editable-container', async ({ page }) => {
    await setupPage(page, 'modify-mode-paragraph.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    await page.locator('p.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    const containers = await page.locator('.editable-container').count();
    expect(containers).toBe(1);
  });

  test('modify mode exits after clicking valid paragraph', async ({ page }) => {
    await setupPage(page, 'modify-mode-paragraph.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('p.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    expect(await page.locator('.toolbar-modify.active').count()).toBe(0);
    expect(await page.locator('p.modify-mode-valid').count()).toBe(0);
  });

  test('multiple paragraphs on slide are all classified as valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-paragraph.html');
    // indexh=1 = Slide 2 - Multiple paragraphs
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const validParas = await page.locator('p.modify-mode-valid').count();
    expect(validParas).toBe(2);
  });

  test('serialize wraps activated paragraph in fenced div with absolute position', async ({ page }) => {
    await setupPage(page, 'modify-mode-paragraph.html');
    // indexh=0 = Slide 1 - Single paragraph
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('p.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    await page.waitForFunction(() => {
      const container = document.querySelector('.editable-container');
      return container && container.style.left !== '';
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());

    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => c.includes('Slide 1')) ?? '';

    // The paragraph should now be wrapped in a positioned fenced div
    expect(slide1).toContain('::: {.absolute');
    expect(slide1).toContain('A single paragraph on this slide.');
    expect(slide1).toContain(':::');
  });
});
