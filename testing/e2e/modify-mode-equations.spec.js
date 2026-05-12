// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode — Display Equations', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-equations.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-equations.qmd first');
    }
  });

  test('single-line display equation is classified valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-equations.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    expect(await page.locator('[data-editable-modified-eq-idx]').count()).toBe(1);
  });

  test('multi-line display equation is classified valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-equations.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');
    expect(await page.locator('[data-editable-modified-eq-idx]').count()).toBe(1);
  });

  test('multiple equations on a slide are all classified valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-equations.html');
    await navigateToSlide(page, 2);
    await page.click('.toolbar-modify');
    expect(await page.locator('[data-editable-modified-eq-idx]').count()).toBe(2);
  });

  test('clicking an equation wraps it in editable-container', async ({ page }) => {
    await setupPage(page, 'modify-mode-equations.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('[data-editable-modified-eq-idx]').first().click();
    await page.waitForSelector('.editable-container', { timeout: 3000 });
    expect(await page.locator('.editable-container').count()).toBe(1);
  });

  test('activated equation has move capability but not resize', async ({ page }) => {
    await setupPage(page, 'modify-mode-equations.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('[data-editable-modified-eq-idx]').first().click();
    await page.waitForSelector('.editable-container', { timeout: 3000 });
    expect(await page.locator('.editable-container .editable-handle').count()).toBe(0);
  });

  test('serialize wraps activated equation in fenced div with absolute position', async ({ page }) => {
    await setupPage(page, 'modify-mode-equations.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('[data-editable-modified-eq-idx]').first().click();
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
    expect(slide).toContain('$$E = mc^2$$');
  });

  test('multi-line equation is fully enclosed by wrap', async ({ page }) => {
    await setupPage(page, 'modify-mode-equations.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');
    await page.locator('[data-editable-modified-eq-idx]').first().click();
    await page.waitForSelector('.editable-container', { timeout: 3000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('.editable-container');
      return c && c.style.left !== '';
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());
    const slide = (qmd.split(/(?=^## )/m).find(c => c.includes('Slide 2')) ?? '');
    const wrapStart = slide.indexOf('::: {.absolute');
    expect(wrapStart).toBeGreaterThanOrEqual(0);
    // Wrap must enclose both `$$` delimiters before the closing `:::`.
    const firstDD = slide.indexOf('$$', wrapStart);
    const lastDD  = slide.lastIndexOf('$$');
    const closeIdx = slide.indexOf(':::', lastDD);
    expect(firstDD).toBeGreaterThan(wrapStart);
    expect(closeIdx).toBeGreaterThan(lastDD);
  });
});
