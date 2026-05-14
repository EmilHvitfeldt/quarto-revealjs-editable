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
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    // Image on current slide should get modify-mode-valid class
    const validImgs = await page.locator('img.modify-mode-valid').count();
    expect(validImgs).toBeGreaterThan(0);
  });

  test('clicking valid image makes it editable and exits modify mode', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    await page.locator('img.modify-mode-valid').first().click();

    // Image should now be inside an editable container
    await page.waitForSelector('.editable-container img', { timeout: 3000 });

    // Modify mode should be inactive after clicking an element
    expect(await page.locator('.toolbar-modify.active').count()).toBe(0);
    expect(await page.locator('img.modify-mode-valid').count()).toBe(0);
  });

  test('Escape key exits modify mode and restores focus to Modify button', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await page.click('.toolbar-modify');
    expect(await page.locator('.toolbar-modify.active').count()).toBe(1);

    await page.keyboard.press('Escape');

    expect(await page.locator('.toolbar-modify.active').count()).toBe(0);
    expect(await page.locator('img.modify-mode-valid').count()).toBe(0);
    const focused = await page.evaluate(() => document.activeElement?.className ?? '');
    expect(focused).toContain('toolbar-modify');
  });

  test('valid elements get aria-label announcing they are clickable', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const label = await page.locator('img.modify-mode-valid').first().getAttribute('aria-label');
    expect(label).toMatch(/Click to modify/);

    await page.keyboard.press('Escape');
    // aria-label should be removed (or restored to original) after exit
    const stillThere = await page.locator('img[aria-label^="Click to modify"]').count();
    expect(stillThere).toBe(0);
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

    // Navigate to Slide 2 (index 2: title slide at 0, Slide 1 at 1, Slide 2 at 2)
    await navigateToSlide(page, 2);
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

    // Navigate to Slide 1 (index 1: title slide is at index 0)
    await navigateToSlide(page, 1);
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

  test('h2 title is classified as valid in modify mode', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const validH2 = await page.locator('h2.modify-mode-valid').count();
    expect(validH2).toBe(1);
  });

  test('clicking h2 title makes it contentEditable and exits modify mode', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    await page.locator('h2.modify-mode-valid').click();

    // h2 should be contentEditable after activation
    const editable = await page.locator('h2[contenteditable="true"]').count();
    expect(editable).toBe(1);

    // Modify mode should be inactive (exited on click, formatting toolbar takes over)
    expect(await page.locator('.toolbar-modify.active').count()).toBe(0);
  });

  test('bold formatting in h2 heading serializes to **text**', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');
    await page.locator('h2.modify-mode-valid').click();

    // Replace heading with known text, select the word "bold"
    await page.locator('h2[contenteditable="true"]').evaluate((h2) => {
      h2.focus();
      h2.textContent = 'hello bold world';
      const range = document.createRange();
      const tn = h2.firstChild;
      range.setStart(tn, 6); range.setEnd(tn, 10);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
    });
    // Trigger Bold via the heading toolbar (mousedown handler)
    await page.locator('.heading-edit-toolbar button[title="Bold"]').dispatchEvent('mousedown');

    const innerHTML = await page.locator('h2[contenteditable="true"]').evaluate(h2 => h2.innerHTML);
    const qmd = await page.evaluate(() => getTransformedQmd());
    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => /hello/i.test(c)) ?? '';
    expect.soft(innerHTML, `innerHTML after bold: ${innerHTML}`).toContain('bold');
    expect(slide1, `innerHTML=${innerHTML}\nslide=${slide1}`).toMatch(/\*\*bold\*\*/);
  });

  test('underline formatting in h2 heading serializes to [text]{.underline}', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');
    await page.locator('h2.modify-mode-valid').click();

    await page.locator('h2[contenteditable="true"]').evaluate((h2) => {
      h2.focus();
      h2.textContent = 'hello uline world';
      const range = document.createRange();
      const tn = h2.firstChild;
      range.setStart(tn, 6); range.setEnd(tn, 11);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
    });
    await page.locator('.heading-edit-toolbar button[title="Underline"]').dispatchEvent('mousedown');

    const innerHTML = await page.locator('h2[contenteditable="true"]').evaluate(h2 => h2.innerHTML);
    const qmd = await page.evaluate(() => getTransformedQmd());
    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => /hello/i.test(c)) ?? '';
    expect(slide1, `innerHTML=${innerHTML}\nslide=${slide1}`).toMatch(/\[uline\]\{\.underline\}/);
  });

  test('editing h2 title serializes back to QMD', async ({ page }) => {
    await setupPage(page, 'modify-mode.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');
    await page.locator('h2.modify-mode-valid').click();

    // Clear and type new heading text
    await page.locator('h2[contenteditable="true"]').fill('Updated Title');

    const qmd = await page.evaluate(() => getTransformedQmd());
    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => c.includes('## Slide 1') || c.includes('## Updated Title')) ?? '';

    expect(slide1).toMatch(/^## Updated Title/m);
  });
});
