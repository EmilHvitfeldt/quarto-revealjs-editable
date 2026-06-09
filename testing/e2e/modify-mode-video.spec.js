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

  test('clicking Modify highlights valid videos with green outline', async ({ page }) => {
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

  test('Modify panel is present and empty (labels removed in favour of on-slide highlights)', async ({ page }) => {
    await setupPage(page, 'modify-mode-video.html');
    await page.click('.toolbar-modify');

    const panel = page.locator('.toolbar-panel-modify');
    await expect(panel).toBeAttached();
    const panelText = await panel.innerText();
    expect(panelText.trim()).toBe('');
  });

  test('activated video keeps its rendered size (no jump to natural mp4 dimensions)', async ({ page }) => {
    await setupPage(page, 'modify-mode-video.html');
    await navigateToSlide(page, 2);

    // Capture the video's rendered size BEFORE activation
    const before = await page.evaluate(() => {
      const v = document.querySelector('section.present:not(.slide-background) video');
      const r = v.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });

    await page.click('.toolbar-modify');
    await page.locator('video.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container video', { timeout: 3000 });

    const after = await page.evaluate(() => {
      const v = document.querySelector('.editable-container video');
      const r = v.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });

    // Allow ±2px tolerance; size must not jump to natural mp4 dimensions.
    expect(Math.abs(after.w - before.w), `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`).toBeLessThan(2);
    expect(Math.abs(after.h - before.h), `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`).toBeLessThan(2);
  });

  test('video stays visible during drag-to-reposition', async ({ page }) => {
    await setupPage(page, 'modify-mode-video.html');
    await navigateToSlide(page, 2);
    await page.click('.toolbar-modify');
    await page.locator('video.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container video', { timeout: 3000 });

    const video = page.locator('.editable-container video').first();
    const box = await video.boundingBox();
    if (!box) throw new Error('Video has no bounding box after activation');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 30, { steps: 5 });

    const midState = await video.evaluate((v) => {
      const cs = getComputedStyle(v);
      const rect = v.getBoundingClientRect();
      return {
        visibility: cs.visibility,
        opacity: cs.opacity,
        display: cs.display,
        width: rect.width,
        height: rect.height,
      };
    });

    await page.mouse.up();

    expect(midState.visibility, JSON.stringify(midState)).not.toBe('hidden');
    expect(parseFloat(midState.opacity), JSON.stringify(midState)).toBeGreaterThan(0);
    expect(midState.display, JSON.stringify(midState)).not.toBe('none');
    expect(midState.width, JSON.stringify(midState)).toBeGreaterThan(0);
    expect(midState.height, JSON.stringify(midState)).toBeGreaterThan(0);
  });
});
