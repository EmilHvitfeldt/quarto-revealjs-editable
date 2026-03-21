// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage } = require('./test-helpers');

test.describe('Quill Editor Formatting - Full Save Pipeline', () => {

  test.beforeAll(async () => {
    // Ensure quill-editor.html exists
    const htmlPath = path.join(TESTING_DIR, 'quill-editor.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run ./run-tests.sh first to generate HTML files');
    }
  });

  test('Bold formatting saves as **text** in full pipeline', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

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
    await setupPage(page, 'quill-editor.html');

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
    await setupPage(page, 'quill-editor.html');

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
    await setupPage(page, 'quill-editor.html');

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
    await setupPage(page, 'quill-editor.html');

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
    await setupPage(page, 'quill-editor.html');

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

    await setupPage(page, 'brand-colors.html');

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

    await setupPage(page, 'brand-colors.html');

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

    await setupPage(page, 'brand-colors.html');

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

  test('Center alignment saves as fenced div in full pipeline', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('centered text here');
      quillData.quill.setSelection(0, 18); // Select all text
      quillData.quill.format('align', 'center');

      return getTransformedQmd();
    });

    // Verify center alignment uses fenced div: ::: {style="text-align: center"}
    expect(savedContent).toContain('{style="text-align: center"}');
    expect(savedContent).toContain('centered text here');
    expect(savedContent).toContain('{.absolute');
  });

  test('Right alignment saves as fenced div in full pipeline', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('right aligned');
      quillData.quill.setSelection(0, 13); // Select all text
      quillData.quill.format('align', 'right');

      return getTransformedQmd();
    });

    // Verify right alignment uses fenced div: ::: {style="text-align: right"}
    expect(savedContent).toContain('{style="text-align: right"}');
    expect(savedContent).toContain('right aligned');
    expect(savedContent).toContain('{.absolute');
  });

  test('Multiple formats on same text in full pipeline', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

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

test.describe('Content Preservation and Alignment Regression Tests', () => {

  test('Unedited div preserves original content but gets absolute positioning', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    // Don't edit anything - just save
    const savedContent = await page.evaluate(() => {
      return getTransformedQmd();
    });

    // Should have absolute positioning (not {.editable})
    expect(savedContent).toContain('{.absolute');
    expect(savedContent).not.toContain('{.editable}');
    // Should NOT have HTML tags (original markdown content preserved)
    expect(savedContent).not.toContain('<p>');
    expect(savedContent).not.toContain('<strong>');
    expect(savedContent).not.toContain('</p>');
  });

  test('Alignment creates nested fences with outer absolute positioning', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('First paragraph\nSecond paragraph');
      // Apply alignment to second paragraph
      quillData.quill.setSelection(16, 16); // Position in second paragraph
      quillData.quill.format('align', 'center');

      return getTransformedQmd();
    });

    // Should have absolute positioning on outer div
    expect(savedContent).toContain('{.absolute');
    // Should NOT have {.editable} remaining
    expect(savedContent).not.toContain('{.editable}');
    // Should have alignment fenced div inside
    expect(savedContent).toContain('{style="text-align: center"}');
  });

  test('Mixed edited and unedited divs both get absolute positioning', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      // Get all editable divs
      const divs = document.querySelectorAll('div.editable');
      if (divs.length < 2) return { error: 'Need at least 2 divs' };

      // Edit only the first div
      const firstQuillData = quillInstances.get(divs[0]);
      if (firstQuillData) {
        firstQuillData.quill.enable(true);
        firstQuillData.quill.setText('Edited content');
      }

      // Leave second div unedited

      return getTransformedQmd();
    });

    // Count absolute occurrences - should be multiple (at least 2 for first slide's divs)
    const absoluteMatches = savedContent.match(/\{\.absolute/g);
    expect(absoluteMatches).not.toBeNull();
    expect(absoluteMatches.length).toBeGreaterThanOrEqual(2);

    // Should NOT have any {.editable} remaining
    expect(savedContent).not.toContain('{.editable}');

    // Edited div should have its new content
    expect(savedContent).toContain('Edited content');
  });

  test('Nested fences use correct colon count when alignment creates inner fences', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('Centered text');
      quillData.quill.setSelection(0, 13);
      quillData.quill.format('align', 'center');

      return getTransformedQmd();
    });

    // Inner alignment fence should use :::
    expect(savedContent).toMatch(/::: \{style="text-align: center"\}/);
    // Outer fence should use :::: (4 colons) to contain the inner :::
    expect(savedContent).toMatch(/:::: \{\.absolute/);
  });

  test('Multiple paragraphs with different alignments each get own fenced div', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      // Insert two paragraphs
      quillData.quill.setText('First para\nSecond para');

      // Center the first paragraph
      quillData.quill.setSelection(0, 10);
      quillData.quill.format('align', 'center');

      // Right-align the second paragraph
      quillData.quill.setSelection(11, 11);
      quillData.quill.format('align', 'right');

      return getTransformedQmd();
    });

    // Should have both alignments
    expect(savedContent).toContain('{style="text-align: center"}');
    expect(savedContent).toContain('{style="text-align: right"}');
    expect(savedContent).toContain('First para');
    expect(savedContent).toContain('Second para');
  });

  test('Alignment combined with bold formatting', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('Some bold text here');

      // Make "bold" bold
      quillData.quill.setSelection(5, 4);
      quillData.quill.format('bold', true);

      // Center the whole paragraph
      quillData.quill.setSelection(0, 19);
      quillData.quill.format('align', 'center');

      return getTransformedQmd();
    });

    // Should have center alignment
    expect(savedContent).toContain('{style="text-align: center"}');
    // Should have bold markers
    expect(savedContent).toContain('**bold**');
  });

  test('Color combined with alignment', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('Red centered text');

      // Make "Red" red
      quillData.quill.setSelection(0, 3);
      quillData.quill.format('color', '#ff0000');

      // Center the whole paragraph
      quillData.quill.setSelection(0, 17);
      quillData.quill.format('align', 'center');

      return getTransformedQmd();
    });

    // Should have center alignment
    expect(savedContent).toContain('{style="text-align: center"}');
    // Should have color style on "Red"
    expect(savedContent).toMatch(/\[Red\]\{style='color:[^']+'\}/);
  });

  test('Code formatting preserved as backticks', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      // Quill doesn't have built-in code format, but if HTML has <code> it should convert
      const editor = div.querySelector('.ql-editor');
      editor.innerHTML = '<p>Use <code>lm()</code> for regression</p>';
      quillData.isDirty = true;

      return getTransformedQmd();
    });

    // Code should be in backticks
    expect(savedContent).toContain('`lm()`');
    expect(savedContent).not.toContain('<code>');
  });

  test('Links converted to markdown syntax', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      const editor = div.querySelector('.ql-editor');
      editor.innerHTML = '<p>Visit <a href="https://example.com">Example Site</a> for more</p>';
      quillData.isDirty = true;

      return getTransformedQmd();
    });

    // Link should be in markdown format
    expect(savedContent).toContain('[Example Site](https://example.com)');
    expect(savedContent).not.toContain('<a ');
  });

  test('Line breaks preserved as newlines', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      const editor = div.querySelector('.ql-editor');
      editor.innerHTML = '<p>Line one<br>Line two<br>Line three</p>';
      quillData.isDirty = true;

      return getTransformedQmd();
    });

    // Should have newlines, not <br> tags
    expect(savedContent).toContain('Line one\nLine two\nLine three');
    expect(savedContent).not.toContain('<br');
  });

  test('Deeply nested formatting preserved correctly', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      quillData.quill.setText('normal bold bolditalic italic normal');

      // Apply bold to "bold bolditalic"
      quillData.quill.setSelection(7, 14);
      quillData.quill.format('bold', true);

      // Apply italic to "bolditalic italic"
      quillData.quill.setSelection(12, 15);
      quillData.quill.format('italic', true);

      return getTransformedQmd();
    });

    // Should have bold
    expect(savedContent).toContain('**');
    // Should have italic
    expect(savedContent).toContain('*');
    // Should not have HTML tags
    expect(savedContent).not.toContain('<strong>');
    expect(savedContent).not.toContain('<em>');
  });
});

test.describe('Source Preservation - No Unnecessary Modifications', () => {

  test('Unedited div content is preserved exactly (not normalized)', async ({ page }) => {
    // This test verifies we don't modify content that wasn't edited
    await setupPage(page, 'quill-editor.html');

    const result = await page.evaluate(() => {
      // Get original source content for first div
      const originalSource = window._input_file;

      // Extract the content of the first editable div from source
      const match = originalSource.match(/::: \{\.editable\}\n([\s\S]*?)\n:::/);
      const originalDivContent = match ? match[1] : null;

      // Don't edit anything - just save
      const savedContent = getTransformedQmd();

      // Extract the content from the saved output (now has {.absolute})
      const savedMatch = savedContent.match(/::+\s*\{\.absolute[^}]*\}\n([\s\S]*?)\n::+/);
      const savedDivContent = savedMatch ? savedMatch[1] : null;

      return {
        original: originalDivContent,
        saved: savedDivContent,
        exactMatch: originalDivContent === savedDivContent
      };
    });

    // Content should be EXACTLY the same - no normalization
    expect(result.exactMatch).toBe(true);
  });

  test('Content containing literal {.absolute should not confuse replacement', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      // Set content that contains text that looks like our syntax
      quillData.quill.setText('Use {.absolute top=10px} for positioning');

      return getTransformedQmd();
    });

    // The literal text should be preserved as content, not interpreted
    expect(savedContent).toContain('Use {.absolute top=10px} for positioning');
    // And the real attribute should also exist
    expect(savedContent).toMatch(/::+\s*\{\.absolute\s+width=/);
  });

  test('Content containing literal ::: should not break fencing', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const savedContent = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      quillData.quill.enable(true);
      // Set content that contains fence-like syntax
      quillData.quill.setText('Example:\n::: {.callout}\nThis is a callout\n:::');

      return getTransformedQmd();
    });

    // The literal ::: should be in the content
    expect(savedContent).toContain('::: {.callout}');
    expect(savedContent).toContain('This is a callout');
    // Outer fence should use more colons to not conflict
    expect(savedContent).toMatch(/::::\s*\{\.absolute/);
  });

  test('Only edited divs have content changed, others stay exactly as source', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const result = await page.evaluate(() => {
      const divs = document.querySelectorAll('div.editable');
      if (divs.length < 2) return { error: 'Need multiple divs' };

      // Get original content of second div from source
      const originalSource = window._input_file;
      const matches = [...originalSource.matchAll(/::: \{\.editable\}\n([\s\S]*?)\n:::/g)];
      const secondDivOriginal = matches[1] ? matches[1][1] : null;

      // Edit ONLY the first div
      const firstQuillData = quillInstances.get(divs[0]);
      if (firstQuillData) {
        firstQuillData.quill.enable(true);
        firstQuillData.quill.setText('EDITED CONTENT');
      }

      // Save
      const savedContent = getTransformedQmd();

      // Check if second div content is preserved exactly
      const savedMatches = [...savedContent.matchAll(/::+\s*\{\.absolute[^}]*\}\n([\s\S]*?)\n::+/g)];
      const secondDivSaved = savedMatches[1] ? savedMatches[1][1] : null;

      return {
        secondDivOriginal,
        secondDivSaved,
        preserved: secondDivOriginal === secondDivSaved,
        hasEditedContent: savedContent.includes('EDITED CONTENT')
      };
    });

    // Edited div should have new content
    expect(result.hasEditedContent).toBe(true);
    // Unedited div should have EXACT same content
    expect(result.preserved).toBe(true);
  });

  test('Clicking in editor without typing does not mark as dirty', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      // Enable editing (like clicking edit button)
      quillData.quill.enable(true);

      // Focus the editor (like clicking in it)
      quillData.quill.focus();

      // Move cursor around
      quillData.quill.setSelection(5, 0);

      // Check if marked dirty
      return {
        isDirty: quillData.isDirty
      };
    });

    // Should NOT be dirty - no actual content change
    expect(result.isDirty).toBe(false);
  });

  test('Formatting without selection does not create spurious changes', async ({ page }) => {
    await setupPage(page, 'quill-editor.html');

    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const quillData = quillInstances.get(div);
      if (!quillData) return { error: 'No Quill instance' };

      const originalContent = window._input_file;

      // Enable editing
      quillData.quill.enable(true);

      // Try to apply bold with no selection (cursor only)
      quillData.quill.setSelection(5, 0); // cursor at position 5, no selection
      quillData.quill.format('bold', true);

      // This shouldn't change isDirty for content
      const savedContent = getTransformedQmd();

      return {
        isDirty: quillData.isDirty,
        savedContent
      };
    });

    // Formatting with no selection might mark dirty but shouldn't change visible content
    // The key is the saved content shouldn't have spurious bold markers
    expect(result.savedContent).not.toMatch(/\*\*\*\*/); // No empty bold
  });
});
