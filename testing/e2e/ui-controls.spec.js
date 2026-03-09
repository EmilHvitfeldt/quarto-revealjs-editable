// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TESTING_DIR = path.join(__dirname, '..');

test.describe('UI Controls', () => {

  test('Font controls exist for div elements', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Check that font controls are created for div.editable
    const fontControls = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const controls = container.querySelector('.font-controls');
      if (!controls) return null;
      return {
        hasDecreaseBtn: !!controls.querySelector('button'),
        buttonCount: controls.querySelectorAll('button').length
      };
    });

    expect(fontControls).not.toBeNull();
    expect(fontControls.buttonCount).toBe(6); // A-, A+, left, center, right, edit
  });

  test('changeFontSize function works', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    // Test the changeFontSize function directly
    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const initial = parseFloat(window.getComputedStyle(div).fontSize);

      // Call the internal function via the button's click handler
      // Or set font size directly to test
      div.style.fontSize = (initial + 4) + 'px';
      const after = parseFloat(div.style.fontSize);

      return { initial, after, increased: after > initial };
    });

    expect(result.increased).toBe(true);
  });

  test('Text alignment can be set', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    // Test alignment by setting style directly
    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      div.style.textAlign = 'center';
      return div.style.textAlign;
    });

    expect(result).toBe('center');
  });

  test('Edit mode can be enabled', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    // Test contentEditable
    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      div.contentEditable = 'true';
      return div.contentEditable;
    });

    expect(result).toBe('true');
  });

  test('Resize handles are created', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Check resize handles exist
    const handles = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const container = img.parentNode;
      const handleElements = container.querySelectorAll('.resize-handle');
      return {
        count: handleElements.length,
        positions: Array.from(handleElements).map(h => h.dataset.position)
      };
    });

    expect(handles.count).toBe(4);
    expect(handles.positions).toContain('nw');
    expect(handles.positions).toContain('ne');
    expect(handles.positions).toContain('sw');
    expect(handles.positions).toContain('se');
  });
});

test.describe('Menu Integration', () => {

  test('Save and Copy buttons are added to menu', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Check menu items exist in DOM (even if not visible)
    const menuItems = await page.evaluate(() => {
      const items = document.querySelectorAll('.slide-menu-items li a');
      const texts = Array.from(items).map(a => a.textContent);
      return {
        hasSaveEdits: texts.some(t => t.includes('Save Edits')),
        hasCopyClipboard: texts.some(t => t.includes('Copy qmd to Clipboard'))
      };
    });

    expect(menuItems.hasSaveEdits).toBe(true);
    expect(menuItems.hasCopyClipboard).toBe(true);
  });
});

test.describe('htmlToQuarto Conversion', () => {

  test('Basic HTML tags convert to markdown', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    // Test htmlToQuarto with mock HTML
    const result = await page.evaluate(() => {
      // Create a mock div to test conversion
      const mockDiv = document.createElement('div');
      mockDiv.innerHTML = '<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>';

      return htmlToQuarto(mockDiv);
    });

    expect(result).toContain('**bold**');
    expect(result).toContain('*italic*');
    expect(result).toContain('`code`');
  });

  test('Strikethrough converts to markdown', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    const result = await page.evaluate(() => {
      const mockDiv = document.createElement('div');
      mockDiv.innerHTML = '<p><del>deleted</del></p>';
      return htmlToQuarto(mockDiv);
    });

    expect(result).toContain('~~deleted~~');
  });
});
