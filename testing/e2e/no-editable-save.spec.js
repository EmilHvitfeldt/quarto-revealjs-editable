// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, clickAddArrow } = require('./test-helpers');

/**
 * Tests for saving documents that have the editable filter active
 * but no .editable elements. Users should still be able to add
 * new elements (like arrows) and save the document.
 *
 * Issue: #53
 */
test.describe('Save Without Editable Elements', () => {

  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'no-editable.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render no-editable.qmd first to generate HTML file');
    }
  });

  /**
   * Custom setup for no-editable pages (no .editable-container exists)
   */
  async function setupNoEditablePage(page, htmlFile = 'no-editable.html') {
    const htmlPath = path.join(TESTING_DIR, htmlFile);
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    // Wait for toolbar only (no editable containers exist)
    await page.waitForSelector('#editable-toolbar', { timeout: 5000 });
  }

  test('Document has _input_file set even without .editable elements', async ({ page }) => {
    await setupNoEditablePage(page);

    const hasInputFile = await page.evaluate(() => {
      return typeof window._input_file === 'string' && window._input_file.length > 0;
    });

    expect(hasInputFile).toBe(true);
  });

  test('Toolbar is visible without .editable elements', async ({ page }) => {
    await setupNoEditablePage(page);

    const toolbarVisible = await page.isVisible('#editable-toolbar');
    expect(toolbarVisible).toBe(true);
  });

  test('Can add arrow to document without .editable elements', async ({ page }) => {
    await setupNoEditablePage(page);

    // Navigate to first content slide
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(200);

    await clickAddArrow(page);

    const arrowCount = await page.evaluate(() =>
      document.querySelectorAll('.editable-arrow-container.editable-new').length
    );

    expect(arrowCount).toBe(1);
  });

  test('getTransformedQmd works without .editable elements', async ({ page }) => {
    await setupNoEditablePage(page);

    // Navigate to first content slide
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(200);

    await clickAddArrow(page);

    // Check that getTransformedQmd doesn't throw and returns content
    const result = await page.evaluate(() => {
      try {
        const content = window.getTransformedQmd ? window.getTransformedQmd() : null;
        return { success: true, hasContent: !!content, content };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasContent).toBe(true);
  });

  test('Arrow shortcode is inserted in transformed output', async ({ page }) => {
    await setupNoEditablePage(page);

    // Navigate to first content slide (Slide 1)
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(200);

    await clickAddArrow(page);

    const result = await page.evaluate(() => {
      const content = window.getTransformedQmd ? window.getTransformedQmd() : '';
      return content;
    });

    // Should contain arrow shortcode
    expect(result).toContain('{{< arrow');
    expect(result).toContain('position="absolute"');
  });

  test('Arrow shortcode inserted after correct slide heading', async ({ page }) => {
    await setupNoEditablePage(page);

    // Navigate to first content slide (index 1, which is "## Slide 1")
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(200);

    await clickAddArrow(page);

    const result = await page.evaluate(() => {
      return window.getTransformedQmd ? window.getTransformedQmd() : '';
    });

    // Arrow should appear after "## Slide 1" heading
    const slide1Pos = result.indexOf('## Slide 1');
    const arrowPos = result.indexOf('{{< arrow');

    expect(slide1Pos).toBeGreaterThan(-1);
    expect(arrowPos).toBeGreaterThan(-1);
    expect(arrowPos).toBeGreaterThan(slide1Pos);

    // Arrow should appear before "## Slide 2" heading
    const slide2Pos = result.indexOf('## Slide 2');
    expect(arrowPos).toBeLessThan(slide2Pos);
  });

  test('Multiple arrows on different slides are saved correctly', async ({ page }) => {
    await setupNoEditablePage(page);

    // Add arrow to Slide 1
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(200);
    await clickAddArrow(page);

    // Deselect arrow
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(100);

    // Add arrow to Slide 2
    await page.evaluate(() => Reveal.slide(2));
    await page.waitForTimeout(200);
    await clickAddArrow(page);

    const result = await page.evaluate(() => {
      return window.getTransformedQmd ? window.getTransformedQmd() : '';
    });

    // Should have two arrow shortcodes
    const arrowMatches = result.match(/\{\{< arrow/g);
    expect(arrowMatches).not.toBeNull();
    expect(arrowMatches.length).toBe(2);
  });

  test('Original content is preserved when saving', async ({ page }) => {
    await setupNoEditablePage(page);

    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(200);
    await clickAddArrow(page);

    const result = await page.evaluate(() => {
      return window.getTransformedQmd ? window.getTransformedQmd() : '';
    });

    // Original content should be preserved
    expect(result).toContain('title: "No Editable Elements"');
    expect(result).toContain('## Slide 1');
    expect(result).toContain('## Slide 2');
    expect(result).toContain('This slide has no editable elements');
    expect(result).toContain('Just regular content here');
  });

});
