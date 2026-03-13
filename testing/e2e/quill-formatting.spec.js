// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Path to test fixtures
const TESTING_DIR = path.join(__dirname, '..');

test.describe('Quill Editor Formatting - Full Save Pipeline', () => {

  test.beforeAll(async () => {
    // Ensure quill-editor.html exists
    const htmlPath = path.join(TESTING_DIR, 'quill-editor.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run ./run-tests.sh first to generate HTML files');
    }
  });

  test('Bold formatting saves as **text** in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'quill-editor.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Apply bold formatting and get full saved output
    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      // Enable editing and apply bold
      quillData.quill.enable(true);
      quillData.quill.setText('test bold text');
      quillData.quill.setSelection(5, 4); // Select "bold"
      quillData.quill.format('bold', true);

      // Use the full save pipeline
      return getTransformedQmd();
    });

    expect(savedContent).toContain('**bold**');
    // Should be transformed to absolute positioning
    expect(savedContent).toContain('{.absolute');
  });

  test('Italic formatting saves as *text* in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'quill-editor.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('test italic text');
      quillData.quill.setSelection(5, 6); // Select "italic"
      quillData.quill.format('italic', true);

      return getTransformedQmd();
    });

    expect(savedContent).toContain('*italic*');
    // Should not be bold (double asterisks)
    expect(savedContent).not.toContain('**italic**');
    expect(savedContent).toContain('{.absolute');
  });

  test('Underline formatting saves as [text]{.underline} in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'quill-editor.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('test underline text');
      quillData.quill.setSelection(5, 9); // Select "underline"
      quillData.quill.format('underline', true);

      return getTransformedQmd();
    });

    expect(savedContent).toContain('[underline]{.underline}');
    expect(savedContent).toContain('{.absolute');
  });

  test('Strikethrough formatting saves as ~~text~~ in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'quill-editor.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('test strike text');
      quillData.quill.setSelection(5, 6); // Select "strike"
      quillData.quill.format('strike', true);

      return getTransformedQmd();
    });

    expect(savedContent).toContain('~~strike~~');
    expect(savedContent).toContain('{.absolute');
  });

  test('Text color saves with style attribute in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'quill-editor.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('test colored text');
      quillData.quill.setSelection(5, 7); // Select "colored"
      quillData.quill.format('color', '#ff0000');

      return getTransformedQmd();
    });

    // Verify "colored" has color style applied: [colored]{style='color: ...'}
    expect(savedContent).toMatch(/\[colored\]\{style='color:[^']+'\}/);
    expect(savedContent).toContain('{.absolute');
  });

  test('Background color saves with style attribute in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'quill-editor.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('test highlighted text');
      quillData.quill.setSelection(5, 11); // Select "highlighted"
      quillData.quill.format('background', '#ffff00');

      return getTransformedQmd();
    });

    // Verify "highlighted" has background-color style applied: [highlighted]{style='background-color: ...'}
    expect(savedContent).toMatch(/\[highlighted\]\{style='background-color:[^']+'\}/);
    expect(savedContent).toContain('{.absolute');
  });

  test('Brand color saves as shortcode in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'brand-colors.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const savedContent = await page.evaluate(() => {
      // Verify brand colors are loaded
      if (!window._quarto_brand_color_names) {
        return { error: 'No brand colors loaded' };
      }

      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('test brand color');
      quillData.quill.setSelection(5, 5); // Select "brand"

      // Use one of the brand colors (coral = #ff6b6b)
      quillData.quill.format('color', 'rgb(255, 107, 107)');

      return getTransformedQmd();
    });

    // Verify "brand" has coral brand color applied: [brand]{style='color: {{< brand color coral >}}'}
    expect(savedContent).toMatch(/\[brand\]\{style='color: \{\{< brand color coral >\}\}'\}/);
    expect(savedContent).toContain('{.absolute');
  });

  test('Brand background color saves as shortcode in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'brand-colors.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const savedContent = await page.evaluate(() => {
      if (!window._quarto_brand_color_names) {
        return { error: 'No brand colors loaded' };
      }

      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('test brand background');
      quillData.quill.setSelection(5, 5); // Select "brand"

      // Use teal = #4ecdc4
      quillData.quill.format('background', 'rgb(78, 205, 196)');

      return getTransformedQmd();
    });

    // Verify "brand" has teal background color applied: [brand]{style='background-color: {{< brand color teal >}}'}
    expect(savedContent).toMatch(/\[brand\]\{style='background-color: \{\{< brand color teal >\}\}'\}/);
    expect(savedContent).toContain('{.absolute');
  });

  test('Non-brand color saves as raw value in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'brand-colors.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('test custom color');
      quillData.quill.setSelection(5, 6); // Select "custom"

      // Use a color that's NOT in the brand palette
      quillData.quill.format('color', 'rgb(123, 45, 67)');

      return getTransformedQmd();
    });

    // Verify "custom" has color style with raw value (NOT brand shortcode): [custom]{style='color: rgb...'}
    expect(savedContent).toMatch(/\[custom\]\{style='color:[^']+'\}/);
    expect(savedContent).not.toContain('{{< brand');
    expect(savedContent).toContain('{.absolute');
  });

  test('Multiple formats on same text in full pipeline', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'quill-editor.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('test formatted text');
      quillData.quill.setSelection(5, 9); // Select "formatted"
      quillData.quill.format('bold', true);
      quillData.quill.format('italic', true);

      return getTransformedQmd();
    });

    // Bold+italic text should have markers around it: ***formatted*** or **_formatted_** or similar
    // The exact nesting depends on Quill's output, but "formatted" should be wrapped
    expect(savedContent).toMatch(/\*+formatted\*+/);
    expect(savedContent).toContain('{.absolute');
  });
});
