// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode — Inline images', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-inline-img.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-inline-img.qmd first');
    }
  });

  test('inline image inside paragraph is classified as valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-inline-img.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    const validImgs = await page.locator('p img.modify-mode-valid').count();
    expect(validImgs).toBe(1);
  });

  test('parent paragraph of an inline image is NOT classified as valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-inline-img.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');

    const validParas = await page.locator('p.modify-mode-valid').count();
    expect(validParas).toBe(0);
  });

  test('clicking inline image activates only the image and exits modify mode', async ({ page }) => {
    await setupPage(page, 'modify-mode-inline-img.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('p img.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container img', { timeout: 3000 });
    expect(await page.locator('.toolbar-modify.active').count()).toBe(0);
    expect(await page.locator('img.modify-mode-valid').count()).toBe(0);
  });

  test('serialize replaces inline image src with .absolute attributes in source paragraph', async ({ page }) => {
    await setupPage(page, 'modify-mode-inline-img.html');
    await navigateToSlide(page, 0);
    await page.click('.toolbar-modify');
    await page.locator('p img.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container img', { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());
    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => c.includes('Slide 1')) ?? '';

    // Source paragraph text must be preserved around the image
    expect(slide1).toContain('I think that I shall never see a poem lovely as a');
    expect(slide1).toContain('tree, whose hungry mouth');
    // Image markdown gains .absolute attributes
    expect(slide1).toMatch(/!\[\]\(\.\.\/image\.png\)\{\.absolute[^}]*\}/);
    // Paragraph itself is NOT wrapped in a fenced div
    expect(slide1).not.toContain('::: {.absolute');
  });

  test('multiple inline images in same paragraph: only the clicked one is modified', async ({ page }) => {
    await setupPage(page, 'modify-mode-inline-img.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const validImgs = await page.locator('p img.modify-mode-valid').count();
    expect(validImgs).toBe(2);

    // Click first inline image
    await page.locator('p img.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container img', { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());
    const chunks = qmd.split(/(?=^## )/m);
    const slide2 = chunks.find(c => c.includes('Slide 2')) ?? '';

    // Exactly one occurrence should have gained .absolute attrs; the other still has width=40px
    const absoluteOccurrences = (slide2.match(/!\[\]\(\.\.\/image\.png\)\{\.absolute[^}]*\}/g) || []).length;
    expect(absoluteOccurrences).toBe(1);
    const plainOccurrences = (slide2.match(/!\[\]\(\.\.\/image\.png\)\{width=40px\}/g) || []).length;
    expect(plainOccurrences).toBe(1);
  });
});
