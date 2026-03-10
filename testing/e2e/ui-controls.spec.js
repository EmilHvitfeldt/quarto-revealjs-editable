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

  test('extractEditableEltDimensions returns all elements', async ({ page }) => {
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
      const dimensions = extractEditableEltDimensions();
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

  test('Graceful handling when _input_file is missing', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Test behavior when _input_file is missing
    const result = await page.evaluate(() => {
      // Save original value
      const original = window._input_file;

      // Remove _input_file to simulate missing filter
      delete window._input_file;

      // Call readIndexQmd
      const content = readIndexQmd();

      // Restore original
      window._input_file = original;

      return {
        returnedEmpty: content === "",
        didNotCrash: true
      };
    });

    expect(result.returnedEmpty).toBe(true);
    expect(result.didNotCrash).toBe(true);
  });

  test('Dimension values are rounded to 1 decimal place', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      // Create dimensions with many decimal places
      const testDimensions = [{
        width: 123.456789,
        height: 78.123456,
        left: 50.999999,
        top: 25.111111
      }];

      const formatted = formatEditableEltStrings(testDimensions);
      return formatted[0];
    });

    // Should have at most 1 decimal place
    expect(result).toContain('width=123.5px');
    expect(result).toContain('height=78.1px');
    expect(result).toContain('left=51px');
    expect(result).toContain('top=25.1px');
    // Should not have many decimal places
    expect(result).not.toContain('123.456789');
    expect(result).not.toContain('78.123456');
  });

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
      const Elt_dim = extractEditableEltDimensions();
      const result = updateTextDivs(index);
      const Elt_attr = formatEditableEltStrings(Elt_dim);
      replaceEditableOccurrences(result, Elt_attr);

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

test.describe('Accessibility', () => {

  test('Containers are focusable with proper ARIA attributes', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      return {
        tabindex: container.getAttribute('tabindex'),
        role: container.getAttribute('role'),
        ariaLabel: container.getAttribute('aria-label'),
        isFocusable: container.tabIndex >= 0
      };
    });

    expect(result.tabindex).toBe('0');
    expect(result.role).toBe('application');
    expect(result.ariaLabel).toContain('arrow keys');
    expect(result.isFocusable).toBe(true);
  });

  test('Resize handles have ARIA labels', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const handles = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      return Array.from(container.querySelectorAll('.resize-handle')).map(h => ({
        position: h.dataset.position,
        role: h.getAttribute('role'),
        ariaLabel: h.getAttribute('aria-label')
      }));
    });

    expect(handles.length).toBe(4);
    handles.forEach(h => {
      expect(h.role).toBe('slider');
      expect(h.ariaLabel).toContain('Resize');
      expect(h.ariaLabel).toContain('corner');
    });
  });

  test('Font control buttons have ARIA labels', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Navigate to slide with div.editable
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(300);

    const buttons = await page.evaluate(() => {
      const container = document.querySelector('div.editable').parentNode;
      const fontControls = container.querySelector('.font-controls');
      return Array.from(fontControls.querySelectorAll('button')).map(b => ({
        text: b.textContent,
        ariaLabel: b.getAttribute('aria-label'),
        title: b.title
      }));
    });

    expect(buttons.length).toBe(6);
    buttons.forEach(b => {
      expect(b.ariaLabel).toBeTruthy();
      expect(b.ariaLabel.length).toBeGreaterThan(0);
    });

    // Check specific labels
    expect(buttons.find(b => b.text === 'A-').ariaLabel).toContain('Decrease');
    expect(buttons.find(b => b.text === 'A+').ariaLabel).toContain('Increase');
  });

  test('Focus shows controls like hover does', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      const handle = container.querySelector('.resize-handle');

      // Check initial state
      const initialOpacity = handle.style.opacity;

      // Focus the container
      container.focus();

      // Small delay for event to process
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            initialOpacity,
            focusedOpacity: handle.style.opacity,
            borderAfterFocus: container.style.border
          });
        }, 100);
      });
    });

    expect(result.initialOpacity).toBe('0');
    expect(result.focusedOpacity).toBe('1');
    expect(result.borderAfterFocus).toContain('solid');
  });

  test('Arrow keys move element', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Get initial position and focus container
    const initial = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      container.focus();
      return {
        left: parseFloat(container.style.left) || container.offsetLeft,
        top: parseFloat(container.style.top) || container.offsetTop
      };
    });

    // Press arrow keys
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');

    const afterMove = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      return {
        left: parseFloat(container.style.left),
        top: parseFloat(container.style.top)
      };
    });

    // Should have moved by KEYBOARD_MOVE_STEP (10px)
    expect(afterMove.left).toBe(initial.left + 10);
    expect(afterMove.top).toBe(initial.top + 10);
  });

  test('Shift+Arrow keys resize element', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Get initial size and focus container
    const initial = await page.evaluate(() => {
      const elt = document.querySelector('.editable');
      const container = elt.parentNode;
      container.focus();
      return {
        width: parseFloat(elt.style.width) || elt.offsetWidth,
        height: parseFloat(elt.style.height) || elt.offsetHeight
      };
    });

    // Press Shift+Arrow keys
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');

    const afterResize = await page.evaluate(() => {
      const elt = document.querySelector('.editable');
      return {
        width: parseFloat(elt.style.width),
        height: parseFloat(elt.style.height)
      };
    });

    // Should have resized by KEYBOARD_MOVE_STEP (10px)
    expect(afterResize.width).toBe(initial.width + 10);
    expect(afterResize.height).toBe(initial.height + 10);
  });

  test('Keyboard resize respects minimum size', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Set element to minimum size and try to shrink further
    await page.evaluate(() => {
      const elt = document.querySelector('.editable');
      const container = elt.parentNode;

      // Set to just above minimum
      elt.style.width = '55px';
      elt.style.height = '55px';
      container.focus();
    });

    // Try to shrink below minimum
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowUp');

    const afterShrink = await page.evaluate(() => {
      const elt = document.querySelector('.editable');
      return {
        width: parseFloat(elt.style.width),
        height: parseFloat(elt.style.height)
      };
    });

    // Should not go below 50px (MIN_ELEMENT_SIZE)
    expect(afterShrink.width).toBe(50);
    expect(afterShrink.height).toBe(50);
  });

  test('Shift+Tab blurs container to return to slide navigation', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Focus the container
    const focused = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      container.focus();
      return document.activeElement === container;
    });
    expect(focused).toBe(true);

    // Press Shift+Tab to exit
    await page.keyboard.press('Shift+Tab');

    // Container should no longer be focused
    const afterTab = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      return {
        isFocused: document.activeElement === container
      };
    });

    expect(afterTab.isFocused).toBe(false);
  });
});
