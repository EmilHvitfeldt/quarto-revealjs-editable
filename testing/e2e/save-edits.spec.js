// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage } = require('./test-helpers');

test.describe('Save Edits Feature', () => {

  test.beforeAll(async () => {
    // Ensure basic.html exists (rendered by run-tests.sh)
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run ./run-tests.sh first to generate HTML files');
    }
  });

  test('Save Edits transforms editable to absolute positioning', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Verify _input_file is loaded
    const inputFile = await page.evaluate(() => window._input_file);
    expect(inputFile).toContain('{.editable}');

    // Get the transformed QMD via the public API
    const savedContent = await page.evaluate(() => getTransformedQmd());

    // Verify transformations
    expect(savedContent).not.toContain('{.editable}');
    expect(savedContent).toContain('{.absolute');
    expect(savedContent).toContain('width=');
    expect(savedContent).toContain('height=');
    expect(savedContent).toContain('left=');
    expect(savedContent).toContain('top=');
  });

  test('Editable elements are wrapped in positioned containers', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Verify the editable image is wrapped in a container with editable-container class
    const containerStyle = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const container = img.parentNode;
      return {
        hasContainerClass: container.classList.contains('editable-container'),
        hasResizeHandles: container.querySelectorAll('.resize-handle').length,
        imgCursor: img.style.cursor
      };
    });

    expect(containerStyle.hasContainerClass).toBe(true);
    expect(containerStyle.hasResizeHandles).toBe(4); // nw, ne, sw, se
    expect(containerStyle.imgCursor).toBe('move');
  });

  test('Dimensions are extracted correctly', async ({ page }) => {
    await setupPage(page, 'basic.html');
    // Wait for editable elements to be set up with dimensions
    await page.waitForFunction(() => {
      const el = document.querySelector('.editable');
      return el && el.style.width && parseFloat(el.style.width) > 0;
    });

    // Get dimensions using the extension's function
    const dimensions = await page.evaluate(() => {
      return extractEditableEltDimensions();
    });

    // Should have dimensions for each editable element
    expect(dimensions.length).toBeGreaterThan(0);

    // Each dimension should have required properties
    for (const dim of dimensions) {
      expect(dim).toHaveProperty('width');
      expect(dim).toHaveProperty('height');
      expect(dim).toHaveProperty('left');
      expect(dim).toHaveProperty('top');
      expect(dim.width).toBeGreaterThan(0);
      expect(dim.height).toBeGreaterThan(0);
    }
  });

  test('Copy to clipboard contains transformed content', async ({ page, context, browserName }) => {
    test.skip(browserName === 'firefox', 'Firefox does not support clipboard-read permission via Playwright');
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await setupPage(page, 'basic.html');

    // Call copyQmdToClipboard
    await page.evaluate(() => {
      copyQmdToClipboard();
    });

    // Wait for clipboard to have content and read it
    const clipboardContent = await page.evaluate(async () => {
      for (let i = 0; i < 20; i++) {
        const text = await navigator.clipboard.readText();
        if (text && text.length > 0) return text;
        await new Promise(r => setTimeout(r, 100));
      }
      return await navigator.clipboard.readText();
    });

    // Verify content was transformed
    expect(clipboardContent).toContain('{.absolute');
    expect(clipboardContent).toContain('width=');
  });

  test('Shortcodes in original source are preserved in base64', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'shortcode.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await setupPage(page, 'shortcode.html');

    // The original source (in _input_file) should have the shortcode preserved
    // Note: When saved, div content comes from rendered HTML where shortcodes are resolved
    const originalSource = await page.evaluate(() => window._input_file);

    expect(originalSource).toContain('{{< meta title >}}');
  });

  test('Content with colons handled correctly (regex fix)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'colons-in-content.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await setupPage(page, 'colons-in-content.html');

    // Get saved content - this tests that the regex correctly matches div content with colons
    const savedContent = await page.evaluate(() => {
      const index = window._input_file;
      const Elt_dim = extractEditableEltDimensions();
      let result = updateTextDivs(index);
      const Elt_attr = formatEditableEltStrings(Elt_dim);
      result = replaceEditableOccurrences(result, Elt_attr);
      return result;
    });

    // The div should be transformed (not left as {.editable})
    expect(savedContent).toContain('{.absolute');
    expect(savedContent).not.toContain('{.editable}');
    // Content with colons should be preserved in output
    expect(savedContent).toContain('12:30');
    expect(savedContent).toContain('https://example.com');
  });

  test('Both ::: editable and ::: {.editable} syntaxes work', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'bare-syntax.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await setupPage(page, 'bare-syntax.html');

    // Both syntaxes should create editable elements
    const result = await page.evaluate(() => {
      const editables = document.querySelectorAll('div.editable');
      return {
        count: editables.length,
        allHaveContainers: Array.from(editables).every(el =>
          el.parentNode.classList.contains('editable-container')
        )
      };
    });

    expect(result.count).toBe(2);
    expect(result.allHaveContainers).toBe(true);

    // Both should be transformable
    const savedContent = await page.evaluate(() => {
      const index = window._input_file;
      const Elt_dim = extractEditableEltDimensions();
      let result = updateTextDivs(index);
      const Elt_attr = formatEditableEltStrings(Elt_dim);
      result = replaceEditableOccurrences(result, Elt_attr);
      return result;
    });

    // Both should be converted to absolute positioning
    expect(savedContent).not.toContain('::: editable');
    expect(savedContent).not.toContain('{.editable}');
    expect(savedContent.match(/\{\.absolute/g).length).toBe(2);
  });

  test('LaTeX preserved in saved output', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'latex.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await setupPage(page, 'latex.html');

    // Get saved content
    const savedContent = await page.evaluate(() => {
      const index = window._input_file;
      const Elt_dim = extractEditableEltDimensions();
      let result = updateTextDivs(index);
      const Elt_attr = formatEditableEltStrings(Elt_dim);
      result = replaceEditableOccurrences(result, Elt_attr);
      return result;
    });

    // LaTeX should be preserved
    expect(savedContent).toContain('\\dfrac');
    expect(savedContent).toContain('\\lambda');
    expect(savedContent).toContain('\\begin{array}');
  });
});
