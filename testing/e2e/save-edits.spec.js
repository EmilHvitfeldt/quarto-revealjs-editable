// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Path to test fixtures
const TESTING_DIR = path.join(__dirname, '..');

test.describe('Save Edits Feature', () => {

  test.beforeAll(async () => {
    // Ensure basic.html exists (rendered by run-tests.sh)
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run ./run-tests.sh first to generate HTML files');
    }
  });

  test('Save Edits transforms editable to absolute positioning', async ({ page }) => {
    // Load the rendered slides
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);

    // Wait for reveal.js to initialize
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    // Verify _input_file is loaded
    const inputFile = await page.evaluate(() => window._input_file);
    expect(inputFile).toContain('{.editable}');

    // Get the saveMovedElts function result by mocking the download
    const savedContent = await page.evaluate(() => {
      // Call the internal functions to get what would be saved
      const index = window._input_file;
      const Elt_dim = extracteditableEltDimensions();
      let result = updateTextDivs(index);
      const Elt_attr = formateditableEltStrings(Elt_dim);
      result = replaceeditableOccurrences(result, Elt_attr);
      return result;
    });

    // Verify transformations
    expect(savedContent).not.toContain('{.editable}');
    expect(savedContent).toContain('{.absolute');
    expect(savedContent).toContain('width=');
    expect(savedContent).toContain('height=');
    expect(savedContent).toContain('left=');
    expect(savedContent).toContain('top=');
  });

  test('Editable elements are wrapped in positioned containers', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);

    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    // Wait for editable elements to be set up
    await page.waitForTimeout(500);

    // Verify the editable image is wrapped in a container with absolute positioning
    const containerStyle = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const container = img.parentNode;
      return {
        position: container.style.position,
        hasResizeHandles: container.querySelectorAll('.resize-handle').length,
        imgCursor: img.style.cursor
      };
    });

    expect(containerStyle.position).toBe('absolute');
    expect(containerStyle.hasResizeHandles).toBe(4); // nw, ne, sw, se
    expect(containerStyle.imgCursor).toBe('move');
  });

  test('Dimensions are extracted correctly', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);

    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Get dimensions using the extension's function
    const dimensions = await page.evaluate(() => {
      return extracteditableEltDimensions();
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

  test('Copy to clipboard contains transformed content', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);

    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    // Call copyQmdToClipboard
    await page.evaluate(() => {
      copyQmdToClipboard();
    });

    // Wait a bit for clipboard to be written
    await page.waitForTimeout(500);

    // Read clipboard
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());

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

    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

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

    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Get saved content - this tests that the regex correctly matches div content with colons
    const savedContent = await page.evaluate(() => {
      const index = window._input_file;
      const Elt_dim = extracteditableEltDimensions();
      let result = updateTextDivs(index);
      const Elt_attr = formateditableEltStrings(Elt_dim);
      result = replaceeditableOccurrences(result, Elt_attr);
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

    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Both syntaxes should create editable elements
    const result = await page.evaluate(() => {
      const editables = document.querySelectorAll('div.editable');
      return {
        count: editables.length,
        allHaveContainers: Array.from(editables).every(el =>
          el.parentNode.style.position === 'absolute'
        )
      };
    });

    expect(result.count).toBe(2);
    expect(result.allHaveContainers).toBe(true);

    // Both should be transformable
    const savedContent = await page.evaluate(() => {
      const index = window._input_file;
      const Elt_dim = extracteditableEltDimensions();
      let result = updateTextDivs(index);
      const Elt_attr = formateditableEltStrings(Elt_dim);
      result = replaceeditableOccurrences(result, Elt_attr);
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

    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    // Get saved content
    const savedContent = await page.evaluate(() => {
      const index = window._input_file;
      const Elt_dim = extracteditableEltDimensions();
      let result = updateTextDivs(index);
      const Elt_attr = formateditableEltStrings(Elt_dim);
      result = replaceeditableOccurrences(result, Elt_attr);
      return result;
    });

    // LaTeX should be preserved
    expect(savedContent).toContain('\\dfrac');
    expect(savedContent).toContain('\\lambda');
    expect(savedContent).toContain('\\begin{array}');
  });
});
