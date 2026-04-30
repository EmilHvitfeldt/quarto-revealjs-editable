// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

test.describe('Modify Mode - Video', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-video.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-video.qmd first');
    }
  });

  test('clicking Modify highlights valid videos with green ring', async ({ page }) => {
    await setupPage(page, 'modify-mode-video.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const validVideos = await page.locator('video.modify-mode-valid').count();
    expect(validVideos).toBeGreaterThan(0);
  });

  test('clicking valid video makes it editable and exits modify mode', async ({ page }) => {
    await setupPage(page, 'modify-mode-video.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    await page.locator('video.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container video', { timeout: 3000 });

    expect(await page.locator('.toolbar-modify.active').count()).toBe(0);
    expect(await page.locator('video.modify-mode-valid').count()).toBe(0);
  });

  test('modified video serializes to correct slide chunk', async ({ page }) => {
    await setupPage(page, 'modify-mode-video.html');

    await navigateToSlide(page, 2);
    await page.click('.toolbar-modify');
    await page.locator('video.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container video', { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());

    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => c.includes('## Slide 1')) ?? '';
    const slide2 = chunks.find(c => c.includes('## Slide 2')) ?? '';

    expect(slide2).toContain('{.absolute');
    expect(slide1).not.toContain('{.absolute');
  });

  test('Videos label appears in modify panel', async ({ page }) => {
    await setupPage(page, 'modify-mode-video.html');
    await page.click('.toolbar-modify');

    const panelText = await page.locator('.toolbar-panel-modify').innerText();
    expect(panelText).toContain('Videos');
  });
});
