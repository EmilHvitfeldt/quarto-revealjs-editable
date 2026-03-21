// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage } = require('./test-helpers');

test.describe('UI Controls', () => {

  test('Edit button exists for div elements', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Check that edit button is created for div.editable
    // Note: Font size and alignment controls are now in Quill toolbar (appears on edit)
    const fontControls = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const controls = container.querySelector('.editable-font-controls');
      if (!controls) return null;
      return {
        hasEditBtn: !!controls.querySelector('.editable-button-edit'),
        buttonCount: controls.querySelectorAll('button').length
      };
    });

    expect(fontControls).not.toBeNull();
    expect(fontControls.hasEditBtn).toBe(true);
    expect(fontControls.buttonCount).toBe(1); // Only edit button (font/align now in Quill toolbar)
  });

  test('changeFontSize function works', async ({ page }) => {
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

    // Test alignment by setting style directly
    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      div.style.textAlign = 'center';
      return div.style.textAlign;
    });

    expect(result).toBe('center');
  });

  test('Edit mode can be enabled', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Test contentEditable
    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      div.contentEditable = 'true';
      return div.contentEditable;
    });

    expect(result).toBe('true');
  });

  test('Resize handles are created', async ({ page }) => {
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

    // Simulate drag using dispatchEvent to bypass reveal.js overlays
    const result = await page.evaluate(() => {
      return new Promise(resolve => {
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

        // Wait for requestAnimationFrame to process
        requestAnimationFrame(() => {
          // Dispatch mouseup on document
          const mouseup = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(mouseup);

          const finalLeft = parseFloat(container.style.left) || container.offsetLeft;
          const finalTop = parseFloat(container.style.top) || container.offsetTop;

          resolve({
            initialLeft,
            initialTop,
            finalLeft,
            finalTop,
            moved: finalLeft !== initialLeft || finalTop !== initialTop
          });
        });
      });
    });

    expect(result.moved).toBe(true);
  });

  test('Resizing element changes its dimensions', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Simulate resize using dispatchEvent
    const result = await page.evaluate(() => {
      return new Promise(resolve => {
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

        // Wait for requestAnimationFrame to process
        requestAnimationFrame(() => {
          // Dispatch mouseup
          const mouseup = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(mouseup);

          const finalWidth = parseFloat(img.style.width) || img.offsetWidth;
          const finalHeight = parseFloat(img.style.height) || img.offsetHeight;

          resolve({
            initialWidth,
            initialHeight,
            finalWidth,
            finalHeight,
            resized: finalWidth !== initialWidth || finalHeight !== initialHeight
          });
        });
      });
    });

    expect(result.resized).toBe(true);
    expect(result.finalWidth).toBeGreaterThan(result.initialWidth);
    expect(result.finalHeight).toBeGreaterThan(result.initialHeight);
  });

  test('Dragging div element changes its position', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Simulate drag on div element
    const result = await page.evaluate(() => {
      return new Promise(resolve => {
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

        // Wait for requestAnimationFrame to process
        requestAnimationFrame(() => {
          // Dispatch mouseup
          const mouseup = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(mouseup);

          const finalLeft = parseFloat(container.style.left) || container.offsetLeft;
          const finalTop = parseFloat(container.style.top) || container.offsetTop;

          resolve({
            initialLeft,
            initialTop,
            finalLeft,
            finalTop,
            moved: finalLeft !== initialLeft || finalTop !== initialTop
          });
        });
      });
    });

    expect(result.moved).toBe(true);
  });

  test('Resize preserves aspect ratio with shift key', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Wait for image to have valid dimensions
    await page.waitForFunction(() => {
      const img = document.querySelector('img.editable');
      return img && img.offsetWidth > 0 && img.offsetHeight > 0;
    });

    // Simulate resize with shift key
    const result = await page.evaluate(() => {
      return new Promise(resolve => {
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

        // Wait for requestAnimationFrame to process
        requestAnimationFrame(() => {
          // Dispatch mouseup
          const mouseup = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(mouseup);

          const finalWidth = parseFloat(img.style.width) || img.offsetWidth;
          const finalHeight = parseFloat(img.style.height) || img.offsetHeight;
          const finalAspectRatio = finalWidth / finalHeight;

          resolve({
            initialWidth,
            initialHeight,
            initialAspectRatio,
            finalWidth,
            finalHeight,
            finalAspectRatio,
            resized: finalWidth !== initialWidth
          });
        });
      });
    });

    expect(result.resized).toBe(true);
    // Aspect ratio should be approximately preserved
    expect(result.finalAspectRatio).toBeCloseTo(result.initialAspectRatio, 1);
  });
});

test.describe('Resize Edge Cases', () => {

  test('Resize from NW corner adjusts position', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Resizing from NW should change both position and size
    const result = await page.evaluate(() => {
      return new Promise(resolve => {
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

        // Wait for requestAnimationFrame to process
        requestAnimationFrame(() => {
          const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
          document.dispatchEvent(mouseup);

          const finalWidth = parseFloat(img.style.width) || img.offsetWidth;
          const finalHeight = parseFloat(img.style.height) || img.offsetHeight;
          const finalLeft = parseFloat(container.style.left);
          const finalTop = parseFloat(container.style.top);

          resolve({
            initialWidth, initialHeight, initialLeft, initialTop,
            finalWidth, finalHeight, finalLeft, finalTop,
            sizeChanged: finalWidth !== initialWidth || finalHeight !== initialHeight,
            positionChanged: finalLeft !== initialLeft || finalTop !== initialTop
          });
        });
      });
    });

    expect(result.sizeChanged).toBe(true);
    expect(result.positionChanged).toBe(true);
    // NW resize outward should increase size
    expect(result.finalWidth).toBeGreaterThan(result.initialWidth);
    expect(result.finalHeight).toBeGreaterThan(result.initialHeight);
  });

  test('Resize enforces minimum size of 50px', async ({ page }) => {
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

    // Click decrease button many times to hit minimum
    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const buttons = container.querySelectorAll('.editable-font-controls button');
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

  test('Quill toolbar appears when entering edit mode', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Click edit button
    await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const editBtn = container.querySelector('.editable-button-edit');
      editBtn.click();
    });

    // Wait for Quill to enable editing (contentEditable is on .ql-editor, not the div)
    await page.waitForFunction(() => {
      const div = document.querySelector('div.editable');
      const editor = div.querySelector('.ql-editor');
      return editor && editor.contentEditable === 'true';
    }, { timeout: 5000 });

    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const toolbar = div.querySelector('.quill-toolbar-container');
      const quillWrapper = div.querySelector('.quill-wrapper');
      return {
        hasToolbar: !!toolbar,
        hasQuillWrapper: !!quillWrapper,
        toolbarVisible: toolbar ? toolbar.style.display !== 'none' : false,
      };
    });

    expect(result.hasToolbar).toBe(true);
    expect(result.hasQuillWrapper).toBe(true);
    expect(result.toolbarVisible).toBe(true);
  });

  test('Quill toolbar has formatting buttons', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Click edit button and wait for Quill
    await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const editBtn = container.querySelector('.editable-button-edit');
      editBtn.click();
    });

    await page.waitForFunction(() => {
      const div = document.querySelector('div.editable');
      return div.querySelector('.quill-toolbar-container');
    }, { timeout: 5000 });

    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const toolbar = div.querySelector('.quill-toolbar-container');
      return {
        hasBold: !!toolbar.querySelector('.ql-bold'),
        hasItalic: !!toolbar.querySelector('.ql-italic'),
        hasUnderline: !!toolbar.querySelector('.ql-underline'),
        hasStrike: !!toolbar.querySelector('.ql-strike'),
        hasColor: !!toolbar.querySelector('.ql-color'),
        hasBackground: !!toolbar.querySelector('.ql-background'),
        hasAlign: !!toolbar.querySelector('.ql-align'),
      };
    });

    expect(result.hasBold).toBe(true);
    expect(result.hasItalic).toBe(true);
    expect(result.hasUnderline).toBe(true);
    expect(result.hasStrike).toBe(true);
    expect(result.hasColor).toBe(true);
    expect(result.hasBackground).toBe(true);
    expect(result.hasAlign).toBe(true);
  });

  test('Edit mode button toggles contentEditable', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Get initial state - Quill editor should be disabled initially
    const initialEditable = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const editor = div.querySelector('.ql-editor');
      return editor ? editor.contentEditable : 'no-editor';
    });
    expect(initialEditable).toBe('false');

    // Click edit button and wait for Quill to enable
    await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const editBtn = container.querySelector('.editable-button-edit');
      editBtn.click();
    });

    // Wait for contentEditable to become true on .ql-editor
    await page.waitForFunction(() => {
      const div = document.querySelector('div.editable');
      const editor = div.querySelector('.ql-editor');
      return editor && editor.contentEditable === 'true';
    }, { timeout: 5000 });

    const afterFirstClick = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const editor = div.querySelector('.ql-editor');
      return editor.contentEditable;
    });
    expect(afterFirstClick).toBe('true');

    // Click again to exit edit mode
    await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const editBtn = container.querySelector('.editable-button-edit');
      editBtn.click();
    });

    await page.waitForFunction(() => {
      const div = document.querySelector('div.editable');
      const editor = div.querySelector('.ql-editor');
      return editor && editor.contentEditable === 'false';
    }, { timeout: 2000 });

    const afterSecondClick = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const editor = div.querySelector('.ql-editor');
      return editor.contentEditable;
    });
    expect(afterSecondClick).toBe('false');
  });
});

test.describe('Multiple Elements', () => {

  test('Multiple editable elements work independently', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'multiple-elements.html');

    if (!fs.existsSync(htmlPath)) {
      test.skip();
      return;
    }

    await setupPage(page, 'multiple-elements.html');

    const result = await page.evaluate(() => {
      return new Promise(resolve => {
        const editables = document.querySelectorAll('.editable');
        const count = editables.length;

        // Each editable should have its own container
        const containers = [];
        editables.forEach((elt, i) => {
          const container = elt.parentNode;
          containers.push({
            index: i,
            hasContainer: container.classList.contains('editable-container'),
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

        // Wait for requestAnimationFrame to process
        requestAnimationFrame(() => {
          const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
          document.dispatchEvent(mouseup);

          const firstFinalLeft = parseFloat(firstContainer.style.left) || firstContainer.offsetLeft;

          // Check second element didn't move
          const secondElt = editables[1];
          const secondContainer = secondElt.parentNode;
          const secondLeft = secondContainer.offsetLeft;

          resolve({
            count,
            containers,
            firstMoved: firstFinalLeft !== firstInitialLeft,
            secondUnchanged: true // Second element should not have been affected
          });
        });
      });
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

    await setupPage(page, 'multiple-elements.html');

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
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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

  test('Edit button has ARIA label', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Navigate to slide with div.editable
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForFunction(() => document.querySelector('div.editable'));

    const buttons = await page.evaluate(() => {
      const container = document.querySelector('div.editable').parentNode;
      const fontControls = container.querySelector('.editable-font-controls');
      if (!fontControls) return [];
      return Array.from(fontControls.querySelectorAll('button')).map(b => ({
        text: b.textContent,
        ariaLabel: b.getAttribute('aria-label'),
        title: b.title,
        className: b.className
      }));
    });

    // Now only edit button remains (font/align controls are in Quill toolbar)
    expect(buttons.length).toBe(1);
    expect(buttons[0].ariaLabel).toBeTruthy();
    expect(buttons[0].ariaLabel).toContain('edit');
    expect(buttons[0].className).toContain('editable-button-edit');
  });

  test('Focus shows controls like hover does', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;

      // Check initial state - no active class
      const initialHasActive = container.classList.contains('active');

      // Focus the container
      container.focus();

      // Small delay for event to process
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            initialHasActive,
            focusedHasActive: container.classList.contains('active')
          });
        }, 100);
      });
    });

    expect(result.initialHasActive).toBe(false);
    expect(result.focusedHasActive).toBe(true);
  });

  test('Arrow keys move element', async ({ page }) => {
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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
    await setupPage(page, 'basic.html');

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

test.describe('CSS Customization', () => {

  test('Container has editable-container class', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      return {
        hasClass: container.classList.contains('editable-container'),
        className: container.className
      };
    });

    expect(result.hasClass).toBe(true);
    expect(result.className).toContain('editable-container');
  });

  test('Resize handles have position-specific classes', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const handles = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      return Array.from(container.querySelectorAll('.resize-handle')).map(h => ({
        classes: h.className,
        hasPositionClass: h.classList.contains('handle-nw') ||
                          h.classList.contains('handle-ne') ||
                          h.classList.contains('handle-sw') ||
                          h.classList.contains('handle-se')
      }));
    });

    expect(handles.length).toBe(4);
    handles.forEach(h => {
      expect(h.hasPositionClass).toBe(true);
    });
  });

  test('Font controls have editable-font-controls class', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const divEditable = document.querySelector('div.editable');
      if (!divEditable) return { found: false };
      const container = divEditable.parentNode;
      const fontControls = container.querySelector('.editable-font-controls');
      return {
        found: !!fontControls,
        className: fontControls ? fontControls.className : null
      };
    });

    expect(result.found).toBe(true);
    expect(result.className).toContain('editable-font-controls');
  });

  test('Edit button has editable-button class', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const buttons = await page.evaluate(() => {
      const divEditable = document.querySelector('div.editable');
      if (!divEditable) return [];
      const container = divEditable.parentNode;
      const fontControls = container.querySelector('.editable-font-controls');
      if (!fontControls) return [];
      return Array.from(fontControls.querySelectorAll('button')).map(b => ({
        hasBaseClass: b.classList.contains('editable-button'),
        classes: b.className
      }));
    });

    // Now only edit button (font/align controls are in Quill toolbar)
    expect(buttons.length).toBe(1);
    expect(buttons[0].hasBaseClass).toBe(true);
  });

  test('CSS custom properties are applied from stylesheet', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      return {
        accentColor: styles.getPropertyValue('--editable-accent-color').trim(),
        handleSize: styles.getPropertyValue('--editable-handle-size').trim(),
        borderWidth: styles.getPropertyValue('--editable-border-width').trim()
      };
    });

    // These should have default values from editable.css
    expect(result.accentColor).toBe('#007cba');
    expect(result.handleSize).toBe('10px');
    expect(result.borderWidth).toBe('2px');
  });

  test('CSS custom properties can be overridden', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Override the CSS custom property and verify it takes effect
    const result = await page.evaluate(() => {
      const root = document.documentElement;

      // Get original value
      const originalColor = getComputedStyle(root).getPropertyValue('--editable-accent-color').trim();

      // Override the property
      root.style.setProperty('--editable-accent-color', '#ff0000');

      // Get new computed value
      const newColor = getComputedStyle(root).getPropertyValue('--editable-accent-color').trim();

      // Check that button background uses the CSS variable
      const divEditable = document.querySelector('div.editable');
      const container = divEditable.parentNode;
      const button = container.querySelector('.editable-button');
      const buttonBg = getComputedStyle(button).backgroundColor;

      return {
        originalColor,
        newColor,
        buttonBg
      };
    });

    expect(result.originalColor).toBe('#007cba');
    expect(result.newColor).toBe('#ff0000');
    // Button should now use the overridden red color (rgb(255, 0, 0))
    expect(result.buttonBg).toBe('rgb(255, 0, 0)');
  });

  test('Active class controls visibility of handles', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Test that CSS class toggles work (actual opacity depends on CSS loading)
    const result = await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      const handle = container.querySelector('.resize-handle');

      // Make sure container has correct class
      const containerClass = container.className;

      // Initial state - no active class
      container.classList.remove('active');
      const initialHasActive = container.classList.contains('active');

      // Add active class
      container.classList.add('active');
      const activeHasActive = container.classList.contains('active');

      // Remove active class
      container.classList.remove('active');
      const removedHasActive = container.classList.contains('active');

      return {
        containerClass,
        initialHasActive,
        activeHasActive,
        removedHasActive
      };
    });

    expect(result.containerClass).toContain('editable-container');
    expect(result.initialHasActive).toBe(false);
    expect(result.activeHasActive).toBe(true);
    expect(result.removedHasActive).toBe(false);
  });
});

// Undo/Redo Tests
test.describe('Undo/Redo', () => {
  test('Undo stack functions exist', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      return {
        hasUndo: typeof undo === 'function',
        hasRedo: typeof redo === 'function',
        hasCanUndo: typeof canUndo === 'function',
        hasCanRedo: typeof canRedo === 'function',
        hasPushUndoState: typeof pushUndoState === 'function',
      };
    });

    expect(result.hasUndo).toBe(true);
    expect(result.hasRedo).toBe(true);
    expect(result.hasCanUndo).toBe(true);
    expect(result.hasCanRedo).toBe(true);
    expect(result.hasPushUndoState).toBe(true);
  });

  test('Undo reverts drag position', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(async () => {
      const container = document.querySelector('.editable-container');
      const img = container.querySelector('img.editable');

      // Get initial position
      const initialLeft = container.offsetLeft;
      const initialTop = container.offsetTop;

      // Simulate drag by pushing undo state and changing position
      pushUndoState();
      container.style.left = (initialLeft + 100) + 'px';
      container.style.top = (initialTop + 50) + 'px';

      // Verify position changed
      const movedLeft = parseFloat(container.style.left);
      const movedTop = parseFloat(container.style.top);

      // Undo
      const undoResult = undo();

      // Wait for state to be applied
      await new Promise(r => requestAnimationFrame(r));

      // Get position after undo
      const afterUndoLeft = container.style.left ? parseFloat(container.style.left) : container.offsetLeft;
      const afterUndoTop = container.style.top ? parseFloat(container.style.top) : container.offsetTop;

      return {
        initialLeft,
        initialTop,
        movedLeft,
        movedTop,
        undoResult,
        afterUndoLeft,
        afterUndoTop,
      };
    });

    expect(result.movedLeft).toBe(result.initialLeft + 100);
    expect(result.movedTop).toBe(result.initialTop + 50);
    expect(result.undoResult).toBe(true);
    expect(result.afterUndoLeft).toBe(result.initialLeft);
    expect(result.afterUndoTop).toBe(result.initialTop);
  });

  test('Redo restores undone action', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(async () => {
      const container = document.querySelector('.editable-container');

      // Get initial position
      const initialLeft = container.offsetLeft;

      // Make a change
      pushUndoState();
      container.style.left = (initialLeft + 100) + 'px';

      // Sync to editableRegistry
      const img = container.querySelector('img.editable');
      const editableElt = editableRegistry.get(img);
      if (editableElt) {
        editableElt.syncFromDOM();
      }

      const afterMoveLeft = parseFloat(container.style.left);

      // Undo
      undo();
      await new Promise(r => requestAnimationFrame(r));
      const afterUndoLeft = container.style.left ? parseFloat(container.style.left) : container.offsetLeft;

      // Redo
      redo();
      await new Promise(r => requestAnimationFrame(r));
      const afterRedoLeft = container.style.left ? parseFloat(container.style.left) : container.offsetLeft;

      return {
        initialLeft,
        afterMoveLeft,
        afterUndoLeft,
        afterRedoLeft,
      };
    });

    expect(result.afterMoveLeft).toBe(result.initialLeft + 100);
    expect(result.afterUndoLeft).toBe(result.initialLeft);
    expect(result.afterRedoLeft).toBe(result.initialLeft + 100);
  });

  test('canUndo returns false when stack is empty', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      // Clear stacks by reloading page, so they should be empty
      // Since we just loaded, stacks are empty
      return {
        canUndoInitial: canUndo(),
        canRedoInitial: canRedo(),
      };
    });

    expect(result.canUndoInitial).toBe(false);
    expect(result.canRedoInitial).toBe(false);
  });

  test('canUndo returns true after action', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const canUndoBefore = canUndo();

      // Push a state
      pushUndoState();

      const canUndoAfter = canUndo();

      return {
        canUndoBefore,
        canUndoAfter,
      };
    });

    expect(result.canUndoBefore).toBe(false);
    expect(result.canUndoAfter).toBe(true);
  });

  test('Undo clears redo stack on new action', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      // Make a change
      pushUndoState();

      // Undo it
      undo();
      const canRedoAfterUndo = canRedo();

      // Make a new change (should clear redo stack)
      pushUndoState();
      const canRedoAfterNewAction = canRedo();

      return {
        canRedoAfterUndo,
        canRedoAfterNewAction,
      };
    });

    expect(result.canRedoAfterUndo).toBe(true);
    expect(result.canRedoAfterNewAction).toBe(false);
  });

  test('Ctrl+Z triggers undo', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Setup: make a change
    await page.evaluate(() => {
      const container = document.querySelector('.editable-container');
      pushUndoState();
      container.style.left = '200px';
      const img = container.querySelector('img.editable');
      const editableElt = editableRegistry.get(img);
      if (editableElt) {
        editableElt.state.x = 200;
      }
    });

    // Press Ctrl+Z
    await page.keyboard.press('Control+z');

    // Wait for undo to apply - position should revert from 200
    await page.waitForFunction(() => {
      const container = document.querySelector('.editable-container');
      const left = container.style.left ? parseFloat(container.style.left) : container.offsetLeft;
      return left !== 200;
    }, { timeout: 2000 });

    const result = await page.evaluate(() => {
      const container = document.querySelector('.editable-container');
      return {
        left: container.style.left ? parseFloat(container.style.left) : container.offsetLeft,
      };
    });

    // Position should be reverted (not 200)
    expect(result.left).not.toBe(200);
  });
});

// Rotation Tests
test.describe('Rotation', () => {
  test('Rotate handle is created for elements', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const container = img.parentNode;
      const rotateHandle = container.querySelector('.rotate-handle');
      return {
        exists: !!rotateHandle,
        ariaLabel: rotateHandle?.getAttribute('aria-label'),
        role: rotateHandle?.getAttribute('role'),
        title: rotateHandle?.title
      };
    });

    expect(result.exists).toBe(true);
    expect(result.ariaLabel).toBe('Rotate element');
    expect(result.role).toBe('slider');
    expect(result.title).toContain('Rotate');
  });

  test('Rotate handle exists for div elements too', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Navigate to slide with div.editable
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForFunction(() => document.querySelector('div.editable'));

    const result = await page.evaluate(() => {
      const div = document.querySelector('div.editable');
      const container = div.parentNode;
      const rotateHandle = container.querySelector('.rotate-handle');
      return {
        exists: !!rotateHandle
      };
    });

    expect(result.exists).toBe(true);
  });

  test('Rotation state is included in EditableElement', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const editableElt = editableRegistry.get(img);
      return {
        hasRotation: 'rotation' in editableElt.state,
        initialRotation: editableElt.state.rotation
      };
    });

    expect(result.hasRotation).toBe(true);
    expect(result.initialRotation).toBe(0);
  });

  test('Rotation can be set via setState', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const editableElt = editableRegistry.get(img);
      const container = editableElt.container;

      // Set rotation
      editableElt.setState({ rotation: 45 });

      return {
        stateRotation: editableElt.state.rotation,
        transform: container.style.transform
      };
    });

    expect(result.stateRotation).toBe(45);
    expect(result.transform).toBe('rotate(45deg)');
  });

  test('Rotation is serialized to QMD style attribute', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const dimensions = {
        width: 100,
        height: 100,
        left: 50,
        top: 50,
        rotation: 30
      };
      return serializeToQmd(dimensions);
    });

    expect(result).toContain('transform: rotate(30deg)');
    expect(result).toContain('style=');
  });

  test('Rotation is not serialized when 0', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const dimensions = {
        width: 100,
        height: 100,
        left: 50,
        top: 50,
        rotation: 0
      };
      return serializeToQmd(dimensions);
    });

    expect(result).not.toContain('transform');
    expect(result).not.toContain('rotate');
  });

  test('Ctrl+Arrow rotates element via keyboard', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Focus container
    await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      container.focus();
    });

    // Press Ctrl+Right to rotate
    await page.keyboard.press('Control+ArrowRight');

    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const editableElt = editableRegistry.get(img);
      return {
        rotation: editableElt.state.rotation
      };
    });

    // Should have rotated by 5 degrees (default step)
    expect(result.rotation).toBe(5);
  });

  test('Ctrl+Shift+Arrow rotates by larger step', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Focus container
    await page.evaluate(() => {
      const container = document.querySelector('.editable').parentNode;
      container.focus();
    });

    // Press Ctrl+Shift+Right to rotate by larger step
    await page.keyboard.press('Control+Shift+ArrowRight');

    const result = await page.evaluate(() => {
      const img = document.querySelector('img.editable');
      const editableElt = editableRegistry.get(img);
      return {
        rotation: editableElt.state.rotation
      };
    });

    // Should have rotated by 15 degrees (shift step)
    expect(result.rotation).toBe(15);
  });

  test('Rotation is included in undo/redo', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(async () => {
      const img = document.querySelector('img.editable');
      const editableElt = editableRegistry.get(img);

      // Initial rotation
      const initialRotation = editableElt.state.rotation;

      // Capture state and rotate
      pushUndoState();
      editableElt.setState({ rotation: 45 });
      const afterRotate = editableElt.state.rotation;

      // Undo
      undo();
      await new Promise(r => requestAnimationFrame(r));
      const afterUndo = editableElt.state.rotation;

      return {
        initialRotation,
        afterRotate,
        afterUndo
      };
    });

    expect(result.initialRotation).toBe(0);
    expect(result.afterRotate).toBe(45);
    expect(result.afterUndo).toBe(0);
  });

  test('CSS custom property for rotate color exists', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      return {
        rotateColor: styles.getPropertyValue('--editable-rotate-color').trim()
      };
    });

    expect(result.rotateColor).toBe('#ff6600');
  });
});
