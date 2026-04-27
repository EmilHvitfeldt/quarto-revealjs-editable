// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode.qmd first');
    }
  });

  test('Modify button exists and is enabled', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    const btn = page.locator('.toolbar-modify');
    await expect(btn).toBeVisible();
    await expect(btn).not.toBeDisabled();
  });

  test('clicking Modify highlights valid images with green ring', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await page.click('.toolbar-modify');

    // Image on current slide should get modify-mode-valid class
    const validImgs = await page.locator('img.modify-mode-valid').count();
    expect(validImgs).toBeGreaterThan(0);
  });

  test('clicking valid image makes it editable and exits modify mode', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await page.click('.toolbar-modify');

    await page.locator('img.modify-mode-valid').first().click();

    // Image should now be inside an editable container
    await page.waitForSelector('.editable-container img', { timeout: 3000 });

    // Modify mode should be inactive after clicking an element
    expect(await page.locator('.toolbar-modify.active').count()).toBe(0);
    expect(await page.locator('img.modify-mode-valid').count()).toBe(0);
  });

  test('clicking Modify button again exits modify mode', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await page.click('.toolbar-modify');
    expect(await page.locator('.toolbar-modify.active').count()).toBe(1);

    await page.click('.toolbar-modify');
    expect(await page.locator('img.modify-mode-valid').count()).toBe(0);
    expect(await page.locator('.toolbar-modify.active').count()).toBe(0);
  });

  test('modified image serializes to correct slide chunk', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');

    // Navigate to slide 2 (index 1) and activate the image there
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');
    await page.locator('img.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container img', { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());

    // Split on slide boundaries to check per-slide
    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => c.includes('## Slide 1')) ?? '';
    const slide2 = chunks.find(c => c.includes('## Slide 2')) ?? '';

    // Only slide 2 should have the .absolute attribute
    expect(slide2).toContain('{.absolute');
    expect(slide1).not.toContain('{.absolute');
  });

  test('same image on two slides: modifying slide 1 does not affect slide 2', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');

    // Stay on slide 1 (index 0) and activate the image there
    await page.click('.toolbar-modify');
    await page.locator('img.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container img', { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());

    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => c.includes('## Slide 1')) ?? '';
    const slide2 = chunks.find(c => c.includes('## Slide 2')) ?? '';

    expect(slide1).toContain('{.absolute');
    expect(slide2).not.toContain('{.absolute');
  });
});
