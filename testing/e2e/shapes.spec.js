// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

// Open the Add submenu and click the "Shape" item to reveal the picker.
async function openShapePicker(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('.toolbar-add')
      || document.querySelector('.editable-toolbar-submenu-wrapper > button');
    if (btn) btn.click();
  });
  await page.evaluate(() => {
    const item = document.querySelector('.toolbar-add-shape');
    if (item) item.click();
  });
  await page.waitForSelector('.shape-picker-popover', { state: 'visible' });
}

// Click a shape preview in the picker by its accessible label.
async function pickShape(page, label) {
  await page.evaluate((lbl) => {
    const item = [...document.querySelectorAll('.shape-picker-item')]
      .find((el) => el.getAttribute('aria-label') === lbl);
    if (item) item.click();
  }, label);
  await page.waitForSelector('.shape-wrapper.editable-new', { state: 'attached' });
}

test.describe('Shapes Feature', () => {
  test.beforeAll(() => {
    const htmlPath = path.join(TESTING_DIR, 'shapes.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('shapes.html not found — run ./run-tests.sh first.');
    }
  });

  test.beforeEach(async ({ page }) => {
    await setupPage(page, 'shapes.html');
  });

  test('adds a shape from the picker and shows the shape panel', async ({ page }) => {
    await openShapePicker(page);
    await pickShape(page, 'Hexagon');

    const count = await page.evaluate(() =>
      document.querySelectorAll('.shape-wrapper.editable-new').length
    );
    expect(count).toBe(1);

    // The shape panel becomes the visible right-zone panel.
    const panelVisible = await page.evaluate(() => {
      const p = document.querySelector('.toolbar-panel-shape');
      return p && getComputedStyle(p).display !== 'none';
    });
    expect(panelVisible).toBe(true);
  });

  test('serializes an added shape to .shape-* QMD with fill and .absolute', async ({ page }) => {
    await openShapePicker(page);
    await pickShape(page, 'Hexagon');

    // Change the fill via the panel.
    await page.evaluate(() => {
      const input = document.querySelector('.shape-toolbar-color');
      input.value = '#e24a68';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const qmd = await page.evaluate(() => window.getTransformedQmd());
    expect(qmd).toMatch(/\.shape-hexagon/);
    expect(qmd).toMatch(/\.absolute/);
    expect(qmd).toMatch(/fill="#e24a68"/i);
    expect(qmd).toMatch(/width=\d+px/);
  });

  test('modify mode reactivates an authored shape', async ({ page }) => {
    // Slide index 1 is the authored-shapes slide.
    await navigateToSlide(page, 1);

    await page.evaluate(() => window.toggleModifyMode && window.toggleModifyMode());
    // Fallback: toggle via the toolbar button if not exposed globally.
    await page.evaluate(() => {
      if (!document.querySelector('.modify-mode-valid')) {
        const btn = document.querySelector('.toolbar-modify');
        if (btn) btn.click();
      }
    });

    const validCount = await page.evaluate(() =>
      document.querySelectorAll('.shape-wrapper.modify-mode-valid').length
    );
    expect(validCount).toBeGreaterThan(0);
  });

  test('modify mode preserves a callout direction on save', async ({ page }) => {
    await navigateToSlide(page, 1);

    // Enter modify mode and activate the authored speech bubble (direction=up).
    await page.evaluate(() => {
      const btn = document.querySelector('.toolbar-modify');
      if (btn) btn.click();
    });
    await page.waitForSelector('.shape-wrapper.modify-mode-valid', { state: 'attached' });
    await page.evaluate(() => {
      const bubble = [...document.querySelectorAll('.shape-wrapper.modify-mode-valid')]
        .find((el) => [...el.classList].includes('shape-speech-bubble'));
      if (bubble) bubble.click();
    });
    await page.waitForFunction(() =>
      document.querySelector('.shape-wrapper[data-editable-modified="true"]')
    );

    const qmd = await page.evaluate(() => window.getTransformedQmd());
    expect(qmd).toMatch(/\.shape-speech-bubble/);
    expect(qmd).toMatch(/direction="up"/);
  });

  test('callout shows a direction handle that aims the pointer when dragged', async ({ page }) => {
    await openShapePicker(page);
    await pickShape(page, 'Round callout');

    // The direction handle appears for callout shapes.
    await page.waitForSelector('.shape-direction-handle', { state: 'attached' });

    // Drag the handle to the left edge of its container → pointer faces left (~270°).
    const result = await page.evaluate(() => {
      const handle = document.querySelector('.shape-direction-handle');
      const container = handle.parentElement;
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy }));
      // Move to the left of center.
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left - 20, clientY: cy }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      const wrapper = document.querySelector('.shape-wrapper.editable-new');
      const el = window.editableRegistry.get(wrapper);
      return el ? el.state.direction : null;
    });

    // Left ≈ 270°; allow a small tolerance for the click offset.
    expect(result).toBeGreaterThanOrEqual(255);
    expect(result).toBeLessThanOrEqual(285);

    const qmd = await page.evaluate(() => window.getTransformedQmd());
    expect(qmd).toMatch(/\.shape-callout-round/);
    expect(qmd).toMatch(/direction="2[5-8]\d"/);
  });

  test('typing text into an added shape serializes into the fence body', async ({ page }) => {
    await openShapePicker(page);
    await pickShape(page, 'Hexagon');

    await page.evaluate(() => {
      const wrapper = document.querySelector('.shape-wrapper.editable-new');
      const content = wrapper.querySelector('.shape-content');
      wrapper.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      content.textContent = 'Hello shape';
      content.dispatchEvent(new Event('input', { bubbles: true }));
      content.blur();
    });

    const qmd = await page.evaluate(() => window.getTransformedQmd());
    expect(qmd).toMatch(/\.shape-hexagon/);
    expect(qmd).toContain('Hello shape');
  });

  test('the shape panel Edit button enters text edit mode and types', async ({ page }) => {
    await openShapePicker(page);
    await pickShape(page, 'Circle');

    // Click the panel's edit-text button (no double-click needed).
    await page.click('.shape-toolbar-text');
    const editing = await page.evaluate(() => {
      const c = document.querySelector('.shape-wrapper.editable-new .shape-content');
      return c.getAttribute('contenteditable') === 'true' && document.activeElement === c;
    });
    expect(editing).toBe(true);

    await page.keyboard.type('Panel text');
    const qmd = await page.evaluate(() => window.getTransformedQmd());
    expect(qmd).toMatch(/\.shape-circle/);
    expect(qmd).toContain('Panel text');
  });

  test('editing text on an authored shape via modify mode round-trips', async ({ page }) => {
    await navigateToSlide(page, 1);
    await page.evaluate(() => {
      const btn = document.querySelector('.toolbar-modify');
      if (btn) btn.click();
    });
    await page.waitForSelector('.shape-wrapper.modify-mode-valid', { state: 'attached' });
    await page.evaluate(() => {
      const bubble = [...document.querySelectorAll('.shape-wrapper.modify-mode-valid')]
        .find((el) => [...el.classList].includes('shape-speech-bubble'));
      if (bubble) bubble.click();
    });
    await page.waitForFunction(() =>
      document.querySelector('.shape-wrapper[data-editable-modified="true"]')
    );

    await page.evaluate(() => {
      const wrapper = document.querySelector('.shape-wrapper[data-editable-modified="true"]');
      const content = wrapper.querySelector('.shape-content');
      wrapper.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      content.textContent = 'Goodbye';
      content.dispatchEvent(new Event('input', { bubbles: true }));
      content.blur();
    });

    const qmd = await page.evaluate(() => window.getTransformedQmd());
    expect(qmd).toMatch(/\.shape-speech-bubble/);
    expect(qmd).toContain('Goodbye');
    // The original "Hi" body line should have been replaced.
    expect(qmd).not.toMatch(/\n\s*Hi\s*\n/);
  });
});
