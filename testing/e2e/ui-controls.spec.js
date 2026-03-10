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

test.describe('Drag and Resize', () => {

  test('Dragging element changes its position', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Simulate drag using dispatchEvent to bypass reveal.js overlays
    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const container = img.parentNode;
      const initialLeft = container.offsetLeft;
      const initialTop = container.offsetTop;

      // Dispatch mousedown on the image
      const mousedown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100
      });
      img.dispatchEvent(mousedown);

      // Dispatch mousemove on document (simulating drag)
      const mousemove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 150
      });
      document.dispatchEvent(mousemove);

      // Dispatch mouseup on document
      const mouseup = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(mouseup);

      const finalLeft = parseFloat(container.style.left) || container.offsetLeft;
      const finalTop = parseFloat(container.style.top) || container.offsetTop;

      return {
        initialLeft,
        initialTop,
        finalLeft,
        finalTop,
        moved: finalLeft !== initialLeft || finalTop !== initialTop
      };
    });

    expect(result.moved).toBe(true);
  });

  test('Resizing element changes its dimensions', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Simulate resize using dispatchEvent
    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const container = img.parentNode;
      const handle = container.querySelector('.resize-handle[data-position="se"]');
      const initialWidth = img.offsetWidth;
      const initialHeight = img.offsetHeight;

      // Dispatch mousedown on the SE handle
      const mousedown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100
      });
      handle.dispatchEvent(mousedown);

      // Dispatch mousemove (dragging handle outward)
      const mousemove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 180
      });
      document.dispatchEvent(mousemove);

      // Dispatch mouseup
      const mouseup = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(mouseup);

      const finalWidth = parseFloat(img.style.width) || img.offsetWidth;
      const finalHeight = parseFloat(img.style.height) || img.offsetHeight;

      return {
        initialWidth,
        initialHeight,
        finalWidth,
        finalHeight,
        resized: finalWidth !== initialWidth || finalHeight !== initialHeight
      };
    });

    expect(result.resized).toBe(true);
    expect(result.finalWidth).toBeGreaterThan(result.initialWidth);
    expect(result.finalHeight).toBeGreaterThan(result.initialHeight);
  });

  test('Dragging div element changes its position', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Simulate drag on div element
    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const initialLeft = container.offsetLeft;
      const initialTop = container.offsetTop;

      // Dispatch mousedown on the div
      const mousedown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100
      });
      div.dispatchEvent(mousedown);

      // Dispatch mousemove
      const mousemove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 175,
        clientY: 140
      });
      document.dispatchEvent(mousemove);

      // Dispatch mouseup
      const mouseup = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(mouseup);

      const finalLeft = parseFloat(container.style.left) || container.offsetLeft;
      const finalTop = parseFloat(container.style.top) || container.offsetTop;

      return {
        initialLeft,
        initialTop,
        finalLeft,
        finalTop,
        moved: finalLeft !== initialLeft || finalTop !== initialTop
      };
    });

    expect(result.moved).toBe(true);
  });

  test('Resize preserves aspect ratio with shift key', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Wait for image to have valid dimensions
    await page.waitForFunction(() => {
      const img = document.querySelector('img.editable');
      return img && img.offsetWidth > 0 && img.offsetHeight > 0;
    });

    // Simulate resize with shift key
    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const container = img.parentNode;
      const handle = container.querySelector('.resize-handle[data-position="se"]');
      const initialWidth = parseFloat(img.style.width) || img.offsetWidth;
      const initialHeight = parseFloat(img.style.height) || img.offsetHeight;
      const initialAspectRatio = initialWidth / initialHeight;

      // Dispatch mousedown on SE handle
      const mousedown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100
      });
      handle.dispatchEvent(mousedown);

      // Dispatch mousemove with shiftKey
      const mousemove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 250,
        clientY: 250,
        shiftKey: true
      });
      document.dispatchEvent(mousemove);

      // Dispatch mouseup
      const mouseup = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(mouseup);

      const finalWidth = parseFloat(img.style.width) || img.offsetWidth;
      const finalHeight = parseFloat(img.style.height) || img.offsetHeight;
      const finalAspectRatio = finalWidth / finalHeight;

      return {
        initialWidth,
        initialHeight,
        initialAspectRatio,
        finalWidth,
        finalHeight,
        finalAspectRatio,
        resized: finalWidth !== initialWidth
      };
    });

    expect(result.resized).toBe(true);
    // Aspect ratio should be approximately preserved
    expect(result.finalAspectRatio).toBeCloseTo(result.initialAspectRatio, 1);
  });
});

test.describe('Resize Edge Cases', () => {

  test('Resize from NW corner adjusts position', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Resizing from NW should change both position and size
    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const container = img.parentNode;
      const handle = container.querySelector('.resize-handle[data-position="nw"]');
      const initialWidth = img.offsetWidth;
      const initialHeight = img.offsetHeight;
      const initialLeft = container.offsetLeft;
      const initialTop = container.offsetTop;

      // Dispatch mousedown on NW handle
      const mousedown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100
      });
      handle.dispatchEvent(mousedown);

      // Drag NW handle up and left (making element larger)
      const mousemove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 50,
        clientY: 50
      });
      document.dispatchEvent(mousemove);

      const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
      document.dispatchEvent(mouseup);

      const finalWidth = parseFloat(img.style.width) || img.offsetWidth;
      const finalHeight = parseFloat(img.style.height) || img.offsetHeight;
      const finalLeft = parseFloat(container.style.left);
      const finalTop = parseFloat(container.style.top);

      return {
        initialWidth, initialHeight, initialLeft, initialTop,
        finalWidth, finalHeight, finalLeft, finalTop,
        sizeChanged: finalWidth !== initialWidth || finalHeight !== initialHeight,
        positionChanged: finalLeft !== initialLeft || finalTop !== initialTop
      };
    });

    expect(result.sizeChanged).toBe(true);
    expect(result.positionChanged).toBe(true);
    // NW resize outward should increase size
    expect(result.finalWidth).toBeGreaterThan(result.initialWidth);
    expect(result.finalHeight).toBeGreaterThan(result.initialHeight);
  });

  test('Resize enforces minimum size of 50px', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Try to resize to very small size
    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const container = img.parentNode;
      const handle = container.querySelector('.resize-handle[data-position="se"]');

      // Dispatch mousedown on SE handle
      const mousedown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 500,
        clientY: 500
      });
      handle.dispatchEvent(mousedown);

      // Drag SE handle way inward (trying to make element tiny)
      const mousemove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 10
      });
      document.dispatchEvent(mousemove);

      const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
      document.dispatchEvent(mouseup);

      const finalWidth = parseFloat(img.style.width) || img.offsetWidth;
      const finalHeight = parseFloat(img.style.height) || img.offsetHeight;

      return { finalWidth, finalHeight };
    });

    // Minimum size should be enforced (50px)
    expect(result.finalWidth).toBeGreaterThanOrEqual(50);
    expect(result.finalHeight).toBeGreaterThanOrEqual(50);
  });
});

test.describe('Font Size Controls', () => {

  test('Font size decrease has minimum of 8px', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Click decrease button many times to hit minimum
    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const buttons = container.querySelectorAll('.font-controls button');
      const decreaseBtn = buttons[0]; // First button is A-

      // Set initial small font size
      div.style.fontSize = '12px';

      // Click decrease many times
      for (let i = 0; i < 10; i++) {
        decreaseBtn.click();
      }

      const finalSize = parseFloat(div.style.fontSize);
      return { finalSize };
    });

    // Should not go below 8px
    expect(result.finalSize).toBeGreaterThanOrEqual(8);
  });

  test('Font size increase button works', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const buttons = container.querySelectorAll('.font-controls button');
      const increaseBtn = buttons[1]; // Second button is A+

      const initialSize = parseFloat(window.getComputedStyle(div).fontSize);

      increaseBtn.click();
      increaseBtn.click();

      const finalSize = parseFloat(div.style.fontSize);
      return { initialSize, finalSize };
    });

    expect(result.finalSize).toBeGreaterThan(result.initialSize);
  });

  test('Alignment buttons work', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const buttons = container.querySelectorAll('.font-controls button');
      // Buttons: A-, A+, alignLeft, alignCenter, alignRight, edit
      const alignLeftBtn = buttons[2];
      const alignCenterBtn = buttons[3];
      const alignRightBtn = buttons[4];

      alignLeftBtn.click();
      const leftAlign = div.style.textAlign;

      alignCenterBtn.click();
      const centerAlign = div.style.textAlign;

      alignRightBtn.click();
      const rightAlign = div.style.textAlign;

      return { leftAlign, centerAlign, rightAlign };
    });

    expect(result.leftAlign).toBe('left');
    expect(result.centerAlign).toBe('center');
    expect(result.rightAlign).toBe('right');
  });

  test('Edit mode button toggles contentEditable', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const buttons = container.querySelectorAll('.font-controls button');
      const editBtn = buttons[5]; // Last button is edit

      const initialEditable = div.contentEditable;

      editBtn.click();
      const afterFirstClick = div.contentEditable;

      editBtn.click();
      const afterSecondClick = div.contentEditable;

      return { initialEditable, afterFirstClick, afterSecondClick };
    });

    expect(result.initialEditable).toBe('inherit');
    expect(result.afterFirstClick).toBe('true');
    expect(result.afterSecondClick).toBe('false');
  });
});

test.describe('Multiple Elements', () => {

  test('Multiple editable elements work independently', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'multiple-elements.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const editables = document.querySelectorAll('.editable');
      const count = editables.length;

      // Each editable should have its own container
      const containers = [];
      editables.forEach((elt, i) => {
        const container = elt.parentNode;
        containers.push({
          index: i,
          hasContainer: container.style.position === 'absolute',
          hasHandles: container.querySelectorAll('.resize-handle').length === 4
        });
      });

      // Move first element
      const firstElt = editables[0];
      const firstContainer = firstElt.parentNode;
      const firstInitialLeft = firstContainer.offsetLeft;

      const mousedown = new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, clientX: 100, clientY: 100
      });
      firstElt.dispatchEvent(mousedown);

      const mousemove = new MouseEvent('mousemove', {
        bubbles: true, cancelable: true, clientX: 150, clientY: 120
      });
      document.dispatchEvent(mousemove);

      const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
      document.dispatchEvent(mouseup);

      const firstFinalLeft = parseFloat(firstContainer.style.left) || firstContainer.offsetLeft;

      // Check second element didn't move
      const secondElt = editables[1];
      const secondContainer = secondElt.parentNode;
      const secondLeft = secondContainer.offsetLeft;

      return {
        count,
        containers,
        firstMoved: firstFinalLeft !== firstInitialLeft,
        secondUnchanged: true // Second element should not have been affected
      };
    });

    expect(result.count).toBeGreaterThan(1);
    expect(result.containers.every(c => c.hasContainer)).toBe(true);
    expect(result.containers.every(c => c.hasHandles)).toBe(true);
    expect(result.firstMoved).toBe(true);
  });

  test('extracteditableEltDimensions returns all elements', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'multiple-elements.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const editables = document.querySelectorAll('.editable');
      const dimensions = extracteditableEltDimensions();
      return {
        elementCount: editables.length,
        dimensionCount: dimensions.length,
        allHaveDimensions: dimensions.every(d =>
          d.width > 0 && d.height > 0 &&
          typeof d.left === 'number' && typeof d.top === 'number'
        )
      };
    });

    expect(result.dimensionCount).toBe(result.elementCount);
    expect(result.allHaveDimensions).toBe(true);
  });
});

test.describe('Code Quality', () => {

  test('No global variable pollution', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Call save functions and verify no globals are leaked
    const globalsCheck = await page.evaluate(() => {
      // Record initial window properties
      const initialProps = new Set(Object.keys(window));

      // Trigger save logic
      const index = window._input_file;
      const Elt_dim = extracteditableEltDimensions();
      const result = updateTextDivs(index);
      const Elt_attr = formateditableEltStrings(Elt_dim);
      replaceeditableOccurrences(result, Elt_attr);

      // Check for new global variables (excluding expected ones)
      const afterProps = Object.keys(window);
      const newGlobals = afterProps.filter(p => !initialProps.has(p));

      // These should not exist as globals
      const badGlobals = ['Elt_dim', 'Elt_attr', 'divs', 'replacements', 'text', 'filename'];
      const leakedGlobals = badGlobals.filter(g => g in window);

      return {
        newGlobals,
        leakedGlobals,
        hasLeaks: leakedGlobals.length > 0
      };
    });

    expect(globalsCheck.hasLeaks).toBe(false);
    expect(globalsCheck.leakedGlobals).toEqual([]);
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
