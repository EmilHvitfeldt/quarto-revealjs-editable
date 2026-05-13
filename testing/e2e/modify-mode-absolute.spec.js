// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

// The fixture wraps plain text in `::: {.absolute …}`, which renders as
// <div.absolute><p>…</p></div>. Since the issue-#140 typed-positioned
// classifiers landed, the inner <p> is the activation target (the wrapper
// is source-anchor metadata only). The tests below verify the new flow:
//   - the inner <p> gets `modify-mode-valid` (not the wrapper)
//   - clicking the <p> reparents it into an .editable-container at the
//     wrapper's original (left, top)
//   - serialize still rewrites the wrapper's `{.absolute …}` block in place
test.describe('Modify Mode — {.absolute} divs', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'modify-mode-absolute.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/modify-mode-absolute.qmd first');
    }
  });

  test('inner <p> elements get modify-mode-valid class when modify mode entered', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await page.click('.toolbar-modify');

    const validPs = await page.locator('div.absolute > p.modify-mode-valid').count();
    expect(validPs).toBeGreaterThan(0);
  });

  test('clicking valid inner <p> wraps it in editable-container', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await page.click('.toolbar-modify');

    await page.locator('div.absolute > p.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    const containers = await page.locator('.editable-container').count();
    expect(containers).toBe(1);
  });

  test('container left/top matches wrapper original inline style after activation', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await page.click('.toolbar-modify');
    await page.locator('div.absolute > p.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });

    // Wait for waitForRegistryThenFixPosition to run and set container position
    await page.waitForFunction(() => {
      const container = document.querySelector('.editable-container');
      return container && parseFloat(container.style.left) > 0;
    }, { timeout: 3000 });

    const containerLeft = await page.evaluate(() => {
      const container = document.querySelector('.editable-container');
      return parseFloat(container.style.left);
    });
    const containerTop = await page.evaluate(() => {
      const container = document.querySelector('.editable-container');
      return parseFloat(container.style.top);
    });

    // Slide 1 wrapper has left=100px top=80px
    expect(containerLeft).toBeCloseTo(100, 0);
    expect(containerTop).toBeCloseTo(80, 0);
  });

  test('serialize updates the correct {.absolute} block in QMD', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await page.click('.toolbar-modify');
    await page.locator('div.absolute > p.modify-mode-valid').first().click();

    await page.waitForSelector('.editable-container', { timeout: 3000 });
    await page.waitForFunction(() => {
      const container = document.querySelector('.editable-container');
      return container && parseFloat(container.style.left) > 0;
    }, { timeout: 3000 });

    const qmd = await page.evaluate(() => getTransformedQmd());

    const chunks = qmd.split(/(?=^## )/m);
    const slide1 = chunks.find(c => c.includes('## Slide 1')) ?? '';
    const slide2 = chunks.find(c => c.includes('## Slide 2')) ?? '';

    // Slide 1 block should still have {.absolute ...} with updated values
    expect(slide1).toContain('{.absolute');
    // Slide 2 should remain unchanged (still original {.absolute ...} markers)
    expect(slide2).toContain('left=50px');
    expect(slide2).toContain('left=300px');
  });

  test('two div.absolute paragraphs on same slide both get modify-mode-valid', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    const validPs = await page.locator('div.absolute > p.modify-mode-valid').count();
    expect(validPs).toBe(2);
  });

  test('both paragraphs on slide 2 can be activated and serialize independently', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');
    await navigateToSlide(page, 1);
    await page.click('.toolbar-modify');

    // Activate first paragraph (exits modify mode automatically)
    await page.locator('div.absolute > p.modify-mode-valid').first().click();
    await page.waitForSelector('.editable-container', { timeout: 3000 });

    // Re-enter modify mode to activate the second paragraph
    await page.click('.toolbar-modify');
    await page.locator('div.absolute > p.modify-mode-valid').first().click();
    await page.waitForFunction(
      () => document.querySelectorAll('.editable-container').length >= 2,
      { timeout: 3000 }
    );

    const qmd = await page.evaluate(() => getTransformedQmd());
    const chunks = qmd.split(/(?=^## )/m);
    const slide2 = chunks.find(c => c.includes('## Slide 2')) ?? '';

    // Both blocks should have been processed and contain {.absolute
    const matches = slide2.match(/\{\.absolute/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(2);
  });

  test('classify ignores .slide-background.present injected into .slides (quarto preview regression)', async ({ page }) => {
    await setupPage(page, 'modify-mode-absolute.html');

    // Simulate what quarto preview injects: a .slide-background div with .present
    // inside .slides. Before the fix, querySelector('.slides .present') matched
    // this element instead of the real slide, so no elements were classified.
    await page.evaluate(() => {
      const slides = document.querySelector('.reveal .slides');
      const bg = document.createElement('div');
      bg.className = 'slide-background present';
      slides.prepend(bg);
    });

    await page.click('.toolbar-modify');
    const validPs = await page.locator('div.absolute > p.modify-mode-valid').count();
    expect(validPs).toBeGreaterThan(0);
  });
});
