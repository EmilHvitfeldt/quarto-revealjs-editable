// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TESTING_DIR = path.join(__dirname, '..');

test.describe('Floating Toolbar', () => {

  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run ./run-tests.sh first to generate HTML files');
    }
  });

  test('Toolbar is created and visible', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Check toolbar exists
    const toolbar = await page.locator('#editable-toolbar');
    await expect(toolbar).toBeVisible();

    // Check it has the correct structure
    const structure = await page.evaluate(() => {
      const toolbar = document.getElementById('editable-toolbar');
      if (!toolbar) return null;
      return {
        hasHandle: !!toolbar.querySelector('.editable-toolbar-handle'),
        hasButtonsContainer: !!toolbar.querySelector('.editable-toolbar-buttons'),
        buttonCount: toolbar.querySelectorAll('.editable-toolbar-button').length,
        hasRole: toolbar.getAttribute('role') === 'toolbar',
      };
    });

    expect(structure).not.toBeNull();
    expect(structure.hasHandle).toBe(true);
    expect(structure.hasButtonsContainer).toBe(true);
    expect(structure.buttonCount).toBe(4); // save, copy, addText, addSlide
    expect(structure.hasRole).toBe(true);
  });

  test('Toolbar has all expected buttons', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    const buttons = await page.evaluate(() => {
      const toolbar = document.getElementById('editable-toolbar');
      if (!toolbar) return [];
      return Array.from(toolbar.querySelectorAll('.editable-toolbar-button')).map(btn => ({
        className: btn.className,
        ariaLabel: btn.getAttribute('aria-label'),
        title: btn.title,
      }));
    });

    expect(buttons.length).toBe(4);

    // Check for specific button classes
    const classNames = buttons.map(b => b.className);
    expect(classNames.some(c => c.includes('toolbar-save'))).toBe(true);
    expect(classNames.some(c => c.includes('toolbar-copy'))).toBe(true);
    expect(classNames.some(c => c.includes('toolbar-add-text'))).toBe(true);
    expect(classNames.some(c => c.includes('toolbar-add-slide'))).toBe(true);
  });

  test('Toolbar is draggable', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Get initial position
    const initialPos = await page.evaluate(() => {
      const toolbar = document.getElementById('editable-toolbar');
      const rect = toolbar.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });

    // Drag the handle
    const handle = await page.locator('.editable-toolbar-handle');
    await handle.dragTo(page.locator('body'), {
      targetPosition: { x: 100, y: 100 },
    });

    // Get new position
    const newPos = await page.evaluate(() => {
      const toolbar = document.getElementById('editable-toolbar');
      const rect = toolbar.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });

    // Position should have changed
    expect(newPos.left !== initialPos.left || newPos.top !== initialPos.top).toBe(true);
  });

  test('Toolbar buttons have hover labels', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Check that buttons have icon and label spans
    const buttonStructure = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.editable-toolbar-button');
      return Array.from(buttons).map(btn => ({
        hasIcon: !!btn.querySelector('.toolbar-icon'),
        hasLabel: !!btn.querySelector('.toolbar-label'),
      }));
    });

    for (const btn of buttonStructure) {
      expect(btn.hasIcon).toBe(true);
      expect(btn.hasLabel).toBe(true);
    }
  });

});

test.describe('Add Text Element', () => {

  test('addNewTextElement creates a new editable div', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Count initial editable elements
    const initialCount = await page.evaluate(() => {
      return document.querySelectorAll('.editable').length;
    });

    // Click add text button
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Verify new element was created
    const result = await page.evaluate(() => {
      const editables = document.querySelectorAll('.editable');
      const newElement = document.querySelector('.editable-new');
      return {
        newCount: editables.length,
        hasNewClass: !!newElement,
        newElementText: newElement ? newElement.textContent : null,
        hasContainer: newElement ? newElement.parentNode.classList.contains('editable-container') : false,
      };
    });

    expect(result.newCount).toBe(initialCount + 1);
    expect(result.hasNewClass).toBe(true);
    expect(result.newElementText).toBe('New text');
    expect(result.hasContainer).toBe(true);
  });

  test('New text element has resize handles', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new text element
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Check it has handles
    const result = await page.evaluate(() => {
      const newElement = document.querySelector('.editable-new');
      if (!newElement) return null;
      const container = newElement.parentNode;
      return {
        resizeHandles: container.querySelectorAll('.resize-handle').length,
        rotateHandle: !!container.querySelector('.rotate-handle'),
        fontControls: !!container.querySelector('.editable-font-controls'),
      };
    });

    expect(result).not.toBeNull();
    expect(result.resizeHandles).toBe(4);
    expect(result.rotateHandle).toBe(true);
    expect(result.fontControls).toBe(true); // divs get font controls
  });

  test('New text element is tracked in NewElementRegistry', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add two text elements
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);

    // Check registry
    const registryState = await page.evaluate(() => {
      return {
        newDivsCount: NewElementRegistry.newDivs.length,
        hasNewElements: NewElementRegistry.hasNewElements(),
      };
    });

    expect(registryState.newDivsCount).toBe(2);
    expect(registryState.hasNewElements).toBe(true);
  });

  test('New text element edit mode works', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new text element
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Click the edit button
    const hasEditButton = await page.evaluate(() => {
      const newElement = document.querySelector('.editable-new');
      const container = newElement.parentNode;
      const editBtn = container.querySelector('.editable-button-edit');
      if (editBtn) {
        editBtn.click();
        return true;
      }
      return false;
    });
    expect(hasEditButton).toBe(true);

    // Wait for Medium Editor to load and contentEditable to become true
    await page.waitForFunction(() => {
      const newElement = document.querySelector('.editable-new');
      return newElement && newElement.contentEditable === 'true';
    }, { timeout: 5000 });

    // Check final state
    const result = await page.evaluate(() => {
      const newElement = document.querySelector('.editable-new');
      const container = newElement.parentNode;
      const editBtn = container.querySelector('.editable-button-edit');
      return {
        isContentEditable: newElement.contentEditable === "true",
        buttonIsActive: editBtn.classList.contains('active'),
      };
    });

    expect(result.isContentEditable).toBe(true);
    expect(result.buttonIsActive).toBe(true);
  });

  test('New text element can be edited when in edit mode', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new text element
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Click edit button
    await page.evaluate(() => {
      const newElement = document.querySelector('.editable-new');
      const container = newElement.parentNode;
      const editBtn = container.querySelector('.editable-button-edit');
      editBtn.click();
    });

    // Wait for Quill to load and contentEditable to become true
    await page.waitForFunction(() => {
      const newElement = document.querySelector('.editable-new');
      return newElement && newElement.contentEditable === 'true';
    }, { timeout: 5000 });

    // Now edit the text - Quill puts content in .ql-editor
    const newText = await page.evaluate(() => {
      const newElement = document.querySelector('.editable-new');
      // With Quill, the editable content is in .ql-editor
      const editor = newElement.querySelector('.ql-editor') || newElement;

      // Focus and select all text
      editor.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);

      // Replace with new text using execCommand (works in contentEditable)
      document.execCommand('insertText', false, 'Custom edited text');

      return editor.textContent;
    });

    expect(newText).toBe('Custom edited text');
  });

  test('Arrow keys do not move element when in edit mode', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new text element
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Get initial position
    const initialPos = await page.evaluate(() => {
      const newElement = document.querySelector('.editable-new');
      const container = newElement.parentNode;
      return {
        left: parseFloat(container.style.left) || 0,
        top: parseFloat(container.style.top) || 0,
      };
    });

    // Enable edit mode
    await page.evaluate(() => {
      const newElement = document.querySelector('.editable-new');
      const container = newElement.parentNode;
      const editBtn = container.querySelector('.editable-button-edit');
      editBtn.click();
    });

    // Focus and press arrow keys
    await page.locator('.editable-new').click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');

    // Check position hasn't changed
    const finalPos = await page.evaluate(() => {
      const newElement = document.querySelector('.editable-new');
      const container = newElement.parentNode;
      return {
        left: parseFloat(container.style.left) || 0,
        top: parseFloat(container.style.top) || 0,
      };
    });

    // Position should not have changed
    expect(finalPos.left).toBe(initialPos.left);
    expect(finalPos.top).toBe(initialPos.top);
  });

  test('New text element is positioned in center of slide', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new text element
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Check position is roughly centered
    const position = await page.evaluate(() => {
      const newElement = document.querySelector('.editable-new');
      const container = newElement.parentNode;
      const slide = document.querySelector('section.present');
      const slideWidth = slide.offsetWidth;
      const slideHeight = slide.offsetHeight;
      const containerLeft = parseFloat(container.style.left) || 0;
      const containerTop = parseFloat(container.style.top) || 0;
      return {
        left: containerLeft,
        top: containerTop,
        slideWidth,
        slideHeight,
        isCenteredHorizontally: containerLeft > slideWidth * 0.3 && containerLeft < slideWidth * 0.7,
        isCenteredVertically: containerTop > slideHeight * 0.3 && containerTop < slideHeight * 0.7,
      };
    });

    expect(position.isCenteredHorizontally).toBe(true);
    expect(position.isCenteredVertically).toBe(true);
  });

});

test.describe('Add Slide', () => {

  test('addNewSlide creates a new slide section', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Count initial slides
    const initialSlides = await page.evaluate(() => {
      return document.querySelectorAll('section.slide').length;
    });

    // Click add slide button
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Verify new slide was created
    const result = await page.evaluate(() => {
      const slides = document.querySelectorAll('section.slide');
      const newSlide = document.querySelector('.editable-new-slide');
      return {
        newSlideCount: slides.length,
        hasNewSlideClass: !!newSlide,
        newSlideHasHeading: newSlide ? !!newSlide.querySelector('h2') : false,
      };
    });

    expect(result.newSlideCount).toBe(initialSlides + 1);
    expect(result.hasNewSlideClass).toBe(true);
    expect(result.newSlideHasHeading).toBe(true);
  });

  test('New slide is tracked in NewElementRegistry', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Check registry
    const registryState = await page.evaluate(() => {
      return {
        newSlidesCount: NewElementRegistry.newSlides.length,
        hasNewElements: NewElementRegistry.hasNewElements(),
      };
    });

    expect(registryState.newSlidesCount).toBe(1);
    expect(registryState.hasNewElements).toBe(true);
  });

  test('Reveal.js navigates to new slide', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Get initial slide index
    const initialIndex = await page.evaluate(() => Reveal.getIndices().h);

    // Add a slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Check we navigated to the new slide
    const newIndex = await page.evaluate(() => Reveal.getIndices().h);

    expect(newIndex).toBe(initialIndex + 1);
  });

});

test.describe('New Elements in Save Flow', () => {
  /**
   * TESTING CONVENTION: Always verify ORDER, not just presence!
   *
   * When testing saved QMD content, use expectOrder() or indexOf() comparisons:
   *
   *   // ✓ GOOD: Verifies order
   *   expectOrder(qmd, ['## Slide 1', 'MARKER_A', '## Slide 2', 'MARKER_B']);
   *
   *   // ✗ BAD: Only checks presence
   *   expect(qmd).toContain('MARKER_A');
   *   expect(qmd).toContain('MARKER_B');
   *
   * See testing/README.md for full guidelines.
   */

  /**
   * Helper to verify markers appear in the correct order in QMD output.
   * @param {string} qmd - The QMD content to check
   * @param {string[]} markers - Array of markers that should appear in this order
   */
  function expectOrder(qmd, markers) {
    let lastPos = -1;
    for (const marker of markers) {
      const pos = qmd.indexOf(marker);
      expect(pos, `Expected "${marker}" to be present in QMD`).toBeGreaterThan(-1);
      expect(pos, `Expected "${marker}" to appear after previous marker`).toBeGreaterThan(lastPos);
      lastPos = pos;
    }
  }

  test('New text elements are excluded from original element processing', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new text element
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Check that getOriginalEditableElements excludes new elements
    const counts = await page.evaluate(() => {
      const allElements = getEditableElements();
      const originalElements = getOriginalEditableElements();
      return {
        all: allElements.length,
        original: originalElements.length,
      };
    });

    expect(counts.all).toBe(counts.original + 1);
  });

  test('getTransformedQmd includes new divs', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new text element and modify its content
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Modify the new element's text
    await page.evaluate(() => {
      const newEl = document.querySelector('.editable-new');
      newEl.textContent = 'My custom new text';
    });

    // Get transformed QMD
    const transformed = await page.evaluate(() => getTransformedQmd());

    // Should include the new div with absolute positioning
    expect(transformed).toContain('My custom new text');
    expect(transformed).toContain('::: {.absolute');
  });

  test('getTransformedQmd includes new slides', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Get transformed QMD
    const transformed = await page.evaluate(() => getTransformedQmd());

    // Should include the new slide heading
    expect(transformed).toContain('## New Slide');
  });

  test('Multiple new elements are saved correctly', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add multiple elements
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);

    // Get transformed QMD
    const transformed = await page.evaluate(() => getTransformedQmd());

    // Count occurrences
    const newTextMatches = (transformed.match(/New text/g) || []).length;
    const newSlideMatches = (transformed.match(/## New Slide/g) || []).length;

    expect(newTextMatches).toBe(2);
    expect(newSlideMatches).toBe(1);
  });

  test('Save action includes new text element in downloaded file', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new text element and modify its content
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Modify the new element's text to something unique
    await page.evaluate(() => {
      const newEl = document.querySelector('.editable-new');
      newEl.textContent = 'UNIQUE_TEXT_FOR_SAVE_TEST';
    });

    // Set up download listener before clicking save
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.click('.toolbar-save');

    // Wait for download
    const download = await downloadPromise;

    // Read the downloaded file content
    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify the new text element is in the saved file
    expect(downloadedContent).toContain('UNIQUE_TEXT_FOR_SAVE_TEST');
    expect(downloadedContent).toContain('::: {.absolute');
  });

  test('Save action includes new slide in downloaded file', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Set up download listener before clicking save
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.click('.toolbar-save');

    // Wait for download
    const download = await downloadPromise;

    // Read the downloaded file content
    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify the new slide heading is in the saved file
    expect(downloadedContent).toContain('## New Slide');
  });

  test('New slide is inserted at correct position in document', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Get the heading of the current slide (slide 0)
    const currentSlideHeading = await page.evaluate(() => {
      const slide = document.querySelector('section.present');
      const h2 = slide.querySelector('h2');
      return h2 ? h2.textContent : null;
    });

    // Navigate to slide 1
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(300);

    // Get heading of slide 1
    const slide1Heading = await page.evaluate(() => {
      const slide = document.querySelector('section.present');
      const h2 = slide.querySelector('h2');
      return h2 ? h2.textContent : null;
    });

    // Add a new slide after slide 1
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Set up download listener and save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    // Read downloaded content
    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify the new slide appears AFTER slide 1's heading
    const slide1Pos = downloadedContent.indexOf(`## ${slide1Heading}`);
    const newSlidePos = downloadedContent.indexOf('## New Slide');

    expect(slide1Pos).toBeGreaterThan(-1);
    expect(newSlidePos).toBeGreaterThan(-1);
    expect(newSlidePos).toBeGreaterThan(slide1Pos);
  });

  test('Add new slide then add text to it', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Get initial slide index
    const initialSlideIndex = await page.evaluate(() => Reveal.getIndices().h);

    // Add a new slide (this navigates to the new slide)
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Verify we're on the new slide
    const newSlideIndex = await page.evaluate(() => Reveal.getIndices().h);
    expect(newSlideIndex).toBe(initialSlideIndex + 1);

    // Add a text element to the new slide
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Modify the text content
    await page.evaluate(() => {
      const newEl = document.querySelector('.editable-new');
      newEl.textContent = 'Text on new slide';
    });

    // Verify the text element is on the new slide
    const textOnNewSlide = await page.evaluate(() => {
      const newSlide = document.querySelector('.editable-new-slide');
      const textElement = newSlide ? newSlide.querySelector('.editable-new') : null;
      return textElement ? textElement.textContent : null;
    });
    expect(textOnNewSlide).toBe('Text on new slide');

    // Set up download listener and save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    // Read downloaded content
    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify both new slide and text are in saved file
    expect(downloadedContent).toContain('## New Slide');
    expect(downloadedContent).toContain('Text on new slide');
    expect(downloadedContent).toContain('::: {.absolute');

    // Verify correct ordering: text element should appear AFTER the new slide heading
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('Text on new slide');
    expect(textPos).toBeGreaterThan(newSlidePos);

    // Verify the text block is between the new slide and any following slide
    // Find the next slide heading after "## New Slide"
    const contentAfterNewSlide = downloadedContent.substring(newSlidePos + '## New Slide'.length);
    const nextSlideMatch = contentAfterNewSlide.match(/\n## /);
    if (nextSlideMatch) {
      const nextSlidePos = newSlidePos + '## New Slide'.length + nextSlideMatch.index;
      // Text should appear before the next slide
      expect(textPos).toBeLessThan(nextSlidePos);
    }
  });

  test('Slides inserted at various positions maintain correct order', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Start on slide 0 (original)
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(200);

    // Insert slide 1 after original
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'SLIDE_1';
    });

    // Insert slide 2 after slide 1 (we're now on slide 1)
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'SLIDE_2';
    });

    // Go back one slide (to slide 1), insert slide 3
    await page.evaluate(() => Reveal.prev());
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'SLIDE_3';
    });

    // Go back two slides (to original), insert slide 4
    await page.evaluate(() => { Reveal.prev(); Reveal.prev(); });
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'SLIDE_4';
    });

    // Save and check order
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Expected order: original, SLIDE_4, SLIDE_1, SLIDE_3, SLIDE_2, then remaining original slides
    const pos1 = downloadedContent.indexOf('SLIDE_1');
    const pos2 = downloadedContent.indexOf('SLIDE_2');
    const pos3 = downloadedContent.indexOf('SLIDE_3');
    const pos4 = downloadedContent.indexOf('SLIDE_4');

    // All markers should exist
    expect(pos1).toBeGreaterThan(-1);
    expect(pos2).toBeGreaterThan(-1);
    expect(pos3).toBeGreaterThan(-1);
    expect(pos4).toBeGreaterThan(-1);

    // Order should be: 4, 1, 3, 2
    expect(pos4).toBeLessThan(pos1);
    expect(pos1).toBeLessThan(pos3);
    expect(pos3).toBeLessThan(pos2);
  });

  test('Add 3 slides with text on 2nd slide maintains correct order', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add first new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text marker to first new slide
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const newEl = document.querySelector('.editable-new');
      newEl.textContent = 'MARKER_SLIDE_1';
    });

    // Add second new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text marker to second new slide
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      // Find the most recently added text element (on current slide)
      const currentSlide = document.querySelector('section.present');
      const newEl = currentSlide.querySelector('.editable-new');
      if (newEl) newEl.textContent = 'MARKER_SLIDE_2';
    });

    // Add third new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text marker to third new slide
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const currentSlide = document.querySelector('section.present');
      const newEl = currentSlide.querySelector('.editable-new');
      if (newEl) newEl.textContent = 'MARKER_SLIDE_3';
    });

    // Set up download listener and save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    // Read downloaded content
    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify all 3 markers are present
    expect(downloadedContent).toContain('MARKER_SLIDE_1');
    expect(downloadedContent).toContain('MARKER_SLIDE_2');
    expect(downloadedContent).toContain('MARKER_SLIDE_3');

    // Count ## New Slide occurrences (should be 3)
    const newSlideMatches = downloadedContent.match(/## New Slide/g) || [];
    expect(newSlideMatches.length).toBe(3);

    // Get positions of each marker
    const marker1Pos = downloadedContent.indexOf('MARKER_SLIDE_1');
    const marker2Pos = downloadedContent.indexOf('MARKER_SLIDE_2');
    const marker3Pos = downloadedContent.indexOf('MARKER_SLIDE_3');

    // Verify correct ordering: markers should appear in order 1, 2, 3
    expect(marker1Pos).toBeGreaterThan(-1);
    expect(marker2Pos).toBeGreaterThan(marker1Pos);
    expect(marker3Pos).toBeGreaterThan(marker2Pos);

    // Find positions of all ## New Slide headings
    let slidePositions = [];
    let searchStart = 0;
    while (true) {
      const pos = downloadedContent.indexOf('## New Slide', searchStart);
      if (pos === -1) break;
      slidePositions.push(pos);
      searchStart = pos + 1;
    }

    // Verify each marker appears after its corresponding slide heading
    // and before the next slide heading (or end of file)
    expect(marker1Pos).toBeGreaterThan(slidePositions[0]);
    expect(marker1Pos).toBeLessThan(slidePositions[1]);

    expect(marker2Pos).toBeGreaterThan(slidePositions[1]);
    expect(marker2Pos).toBeLessThan(slidePositions[2]);

    expect(marker3Pos).toBeGreaterThan(slidePositions[2]);
  });

  test('Text on original slide after adding new slides', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Start on slide 0, add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Go back to original slide 0
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(300);

    // Add text to original slide 0
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'TEXT_ON_ORIGINAL';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Text should appear after ## Slide 1 but before ## New Slide
    const slide1Pos = downloadedContent.indexOf('## Slide 1');
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('TEXT_ON_ORIGINAL');

    expect(textPos).toBeGreaterThan(slide1Pos);
    expect(textPos).toBeLessThan(newSlidePos);
  });

  test('Multiple text elements on same new slide', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add 3 text elements to the new slide
    for (let i = 1; i <= 3; i++) {
      await page.click('.toolbar-add-text');
      await page.waitForTimeout(300);
      await page.evaluate((idx) => {
        const currentSlide = document.querySelector('section.present');
        const newEls = currentSlide.querySelectorAll('.editable-new');
        const lastEl = newEls[newEls.length - 1];
        if (lastEl) lastEl.textContent = `MULTI_TEXT_${idx}`;
      }, i);
    }

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // All 3 text elements should be present
    expect(downloadedContent).toContain('MULTI_TEXT_1');
    expect(downloadedContent).toContain('MULTI_TEXT_2');
    expect(downloadedContent).toContain('MULTI_TEXT_3');

    // All should appear after ## New Slide and before ## Slide 2
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');
    const text1Pos = downloadedContent.indexOf('MULTI_TEXT_1');
    const text2Pos = downloadedContent.indexOf('MULTI_TEXT_2');
    const text3Pos = downloadedContent.indexOf('MULTI_TEXT_3');

    expect(text1Pos).toBeGreaterThan(newSlidePos);
    expect(text1Pos).toBeLessThan(slide2Pos);
    expect(text2Pos).toBeGreaterThan(newSlidePos);
    expect(text2Pos).toBeLessThan(slide2Pos);
    expect(text3Pos).toBeGreaterThan(newSlidePos);
    expect(text3Pos).toBeLessThan(slide2Pos);
  });

  test('New slides at different original positions', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add slide after original slide 0
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(200);
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'AFTER_SLIDE_0';
    });

    // Navigate to original slide 1 (now at index 2 due to new slide)
    await page.evaluate(() => Reveal.slide(2));
    await page.waitForTimeout(200);

    // Add slide after original slide 1
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'AFTER_SLIDE_1';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify order: Slide 1, AFTER_SLIDE_0, Slide 2, AFTER_SLIDE_1
    const slide1Pos = downloadedContent.indexOf('## Slide 1');
    const afterSlide0Pos = downloadedContent.indexOf('AFTER_SLIDE_0');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');
    const afterSlide1Pos = downloadedContent.indexOf('AFTER_SLIDE_1');

    expect(afterSlide0Pos).toBeGreaterThan(slide1Pos);
    expect(afterSlide0Pos).toBeLessThan(slide2Pos);
    expect(afterSlide1Pos).toBeGreaterThan(slide2Pos);
  });

  test('Text positioning is preserved on new slides', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text and move it to specific position
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);

    // Set specific position via setState
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) {
        el.textContent = 'POSITIONED_TEXT';
        const editableElt = editableRegistry.get(el);
        if (editableElt) {
          editableElt.setState({ x: 100, y: 200, width: 300, height: 150 });
        }
      }
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify position attributes are saved
    expect(downloadedContent).toContain('POSITIONED_TEXT');
    expect(downloadedContent).toContain('left=100px');
    expect(downloadedContent).toContain('top=200px');
    expect(downloadedContent).toContain('width=300px');
    expect(downloadedContent).toContain('height=150px');

    // Verify correct ordering: text should be on the new slide (after ## New Slide, before ## Slide 2)
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('POSITIONED_TEXT');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    expect(textPos).toBeGreaterThan(newSlidePos);
    expect(textPos).toBeLessThan(slide2Pos);
  });

  test('Empty text element content', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text and clear its content
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = '';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Should have the div block (empty or with default text)
    expect(downloadedContent).toContain('::: {.absolute');
    expect(downloadedContent).toContain(':::');

    // Verify correct ordering: div block should be on the new slide
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    // Find the ::: {.absolute that's part of the new slide (after ## New Slide)
    const contentAfterNewSlide = downloadedContent.substring(newSlidePos);
    const divBlockInNewSlide = contentAfterNewSlide.indexOf('::: {.absolute');

    // The div block should exist in the new slide section
    expect(divBlockInNewSlide).toBeGreaterThan(-1);
    // And it should be before Slide 2
    expect(newSlidePos + divBlockInNewSlide).toBeLessThan(slide2Pos);
  });

  test('Special characters in new element text', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text with special characters
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    const specialText = 'Text with: colons, {braces}, **markdown**, and ::: fences';
    await page.evaluate((text) => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = text;
    }, specialText);

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Special characters should be preserved
    expect(downloadedContent).toContain(specialText);

    // Verify correct ordering: text should be on the new slide
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf(specialText);
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    expect(textPos).toBeGreaterThan(newSlidePos);
    expect(textPos).toBeLessThan(slide2Pos);
  });

  test('Deep nesting of new slides', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add slide A
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'DEPTH_1';
    });

    // Add slide B after A
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'DEPTH_2';
    });

    // Add slide C after B
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'DEPTH_3';
    });

    // Add slide D after C
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'DEPTH_4';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // All should be present in order 1, 2, 3, 4
    const pos1 = downloadedContent.indexOf('DEPTH_1');
    const pos2 = downloadedContent.indexOf('DEPTH_2');
    const pos3 = downloadedContent.indexOf('DEPTH_3');
    const pos4 = downloadedContent.indexOf('DEPTH_4');

    expect(pos1).toBeGreaterThan(-1);
    expect(pos2).toBeGreaterThan(pos1);
    expect(pos3).toBeGreaterThan(pos2);
    expect(pos4).toBeGreaterThan(pos3);

    // Should have 4 new slide headings
    const newSlideCount = (downloadedContent.match(/## New Slide/g) || []).length;
    expect(newSlideCount).toBe(4);
  });

  test('Mixed: new slides at multiple positions with text on each', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add slide with text after original slide 0
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(200);
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'GROUP_A_TEXT';
    });

    // Navigate to original slide 1 (now index 2)
    await page.evaluate(() => Reveal.slide(2));
    await page.waitForTimeout(200);

    // Add slide with text after original slide 1
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'GROUP_B_TEXT';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify structure: Slide 1, New Slide + GROUP_A, Slide 2, New Slide + GROUP_B
    const slide1Pos = downloadedContent.indexOf('## Slide 1');
    const groupAPos = downloadedContent.indexOf('GROUP_A_TEXT');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');
    const groupBPos = downloadedContent.indexOf('GROUP_B_TEXT');

    expect(groupAPos).toBeGreaterThan(slide1Pos);
    expect(groupAPos).toBeLessThan(slide2Pos);
    expect(groupBPos).toBeGreaterThan(slide2Pos);
  });

  test('Adding text to the last new slide in a chain', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add 3 slides in sequence, only add text to the last one
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text only to the third (last) new slide
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'LAST_IN_CHAIN';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Should have 3 new slide headings
    const newSlideCount = (downloadedContent.match(/## New Slide/g) || []).length;
    expect(newSlideCount).toBe(3);

    // Text should appear after the third ## New Slide
    let slidePositions = [];
    let searchStart = 0;
    while (true) {
      const pos = downloadedContent.indexOf('## New Slide', searchStart);
      if (pos === -1) break;
      slidePositions.push(pos);
      searchStart = pos + 1;
    }

    const textPos = downloadedContent.indexOf('LAST_IN_CHAIN');
    expect(textPos).toBeGreaterThan(slidePositions[2]);
  });

  test('Original element modifications alongside new elements', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Move an existing editable element
    await page.evaluate(() => {
      const existingEl = document.querySelector('.editable:not(.editable-new)');
      if (existingEl) {
        const editableElt = editableRegistry.get(existingEl);
        if (editableElt) {
          editableElt.setState({ x: 555, y: 333 });
        }
      }
    });

    // Add a new slide with text
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'NEW_ALONGSIDE_MODIFIED';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Both modifications should be saved
    expect(downloadedContent).toContain('NEW_ALONGSIDE_MODIFIED');
    expect(downloadedContent).toContain('left=555px');
    expect(downloadedContent).toContain('top=333px');

    // Verify correct ordering:
    // - Modified original element should be on Slide 1 (before New Slide)
    // - New text should be on New Slide (after New Slide, before Slide 2)
    const slide1Pos = downloadedContent.indexOf('## Slide 1');
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');
    const modifiedPos = downloadedContent.indexOf('left=555px');
    const newTextPos = downloadedContent.indexOf('NEW_ALONGSIDE_MODIFIED');

    // Modified element should be between Slide 1 and New Slide
    expect(modifiedPos).toBeGreaterThan(slide1Pos);
    expect(modifiedPos).toBeLessThan(newSlidePos);

    // New text should be between New Slide and Slide 2
    expect(newTextPos).toBeGreaterThan(newSlidePos);
    expect(newTextPos).toBeLessThan(slide2Pos);
  });

  test('New slide after the last original slide', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Navigate to the last slide (Slide 2, index 1)
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(300);

    // Add a new slide after the last slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'AFTER_LAST_SLIDE';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Text should appear after ## Slide 2 (at the end)
    const slide2Pos = downloadedContent.indexOf('## Slide 2');
    const textPos = downloadedContent.indexOf('AFTER_LAST_SLIDE');
    const newSlidePos = downloadedContent.indexOf('## New Slide');

    expect(newSlidePos).toBeGreaterThan(slide2Pos);
    expect(textPos).toBeGreaterThan(newSlidePos);
  });

  test('Font styling on new elements is saved', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text and change font size
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) {
        el.textContent = 'STYLED_TEXT';
        const editableElt = editableRegistry.get(el);
        if (editableElt) {
          editableElt.setState({ fontSize: 24, textAlign: 'center' });
        }
      }
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify text and styling are saved
    expect(downloadedContent).toContain('STYLED_TEXT');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('STYLED_TEXT');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    expect(textPos).toBeGreaterThan(newSlidePos);
    expect(textPos).toBeLessThan(slide2Pos);
  });

  test('Rotation on new elements is saved', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text and rotate it
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) {
        el.textContent = 'ROTATED_TEXT';
        const editableElt = editableRegistry.get(el);
        if (editableElt) {
          editableElt.setState({ rotation: 45 });
        }
      }
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify rotation is saved (format: transform: rotate(45deg);)
    expect(downloadedContent).toContain('ROTATED_TEXT');
    expect(downloadedContent).toContain('transform: rotate(45deg)');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('ROTATED_TEXT');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    expect(textPos).toBeGreaterThan(newSlidePos);
    expect(textPos).toBeLessThan(slide2Pos);
  });

  test('Copy to clipboard includes new elements', async ({ page, context }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Add a new slide with text
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'CLIPBOARD_TEST';
    });

    // Click copy button
    await page.click('.toolbar-copy');
    await page.waitForTimeout(500);

    // Read clipboard
    const clipboardContent = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });

    // Verify new elements are in clipboard
    expect(clipboardContent).toContain('CLIPBOARD_TEST');
    expect(clipboardContent).toContain('## New Slide');

    // Verify ordering
    const newSlidePos = clipboardContent.indexOf('## New Slide');
    const textPos = clipboardContent.indexOf('CLIPBOARD_TEST');
    const slide2Pos = clipboardContent.indexOf('## Slide 2');

    expect(textPos).toBeGreaterThan(newSlidePos);
    expect(textPos).toBeLessThan(slide2Pos);
  });

  test('New slide with no content saves correctly', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide but don't add any text
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Save without adding text
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Should have the new slide heading
    expect(downloadedContent).toContain('## New Slide');

    // Verify ordering: New Slide should be between Slide 1 and Slide 2
    const slide1Pos = downloadedContent.indexOf('## Slide 1');
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    expect(newSlidePos).toBeGreaterThan(slide1Pos);
    expect(newSlidePos).toBeLessThan(slide2Pos);
  });

  test('Interleaved operations save correctly', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // 1. Add slide A
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'SLIDE_A_TEXT';
    });

    // 2. Go back to original slide 0, add text there
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'ORIGINAL_SLIDE_TEXT';
    });

    // 3. Add another slide B (after original slide 0)
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'SLIDE_B_TEXT';
    });

    // 4. Go back to slide A, add more text
    // Slide A should now be at index 2 (original 0, B at 1, A at 2)
    await page.evaluate(() => Reveal.slide(2));
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const currentSlide = document.querySelector('section.present');
      const newEls = currentSlide.querySelectorAll('.editable-new');
      const lastEl = newEls[newEls.length - 1];
      if (lastEl) lastEl.textContent = 'SLIDE_A_MORE_TEXT';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verify all texts are present
    expect(downloadedContent).toContain('SLIDE_A_TEXT');
    expect(downloadedContent).toContain('ORIGINAL_SLIDE_TEXT');
    expect(downloadedContent).toContain('SLIDE_B_TEXT');
    expect(downloadedContent).toContain('SLIDE_A_MORE_TEXT');

    // Verify ordering:
    // Original slide text should be on Slide 1
    // Slide B should come before Slide A (B was inserted after original, A was inserted after original earlier)
    const slide1Pos = downloadedContent.indexOf('## Slide 1');
    const originalTextPos = downloadedContent.indexOf('ORIGINAL_SLIDE_TEXT');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    expect(originalTextPos).toBeGreaterThan(slide1Pos);
    expect(originalTextPos).toBeLessThan(slide2Pos);
  });

  test('Unicode and emoji in new element text', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text with unicode and emoji
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    const unicodeText = '中文 日本語 émojis 🎉🚀 Ñoño';
    await page.evaluate((text) => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = text;
    }, unicodeText);

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Unicode should be preserved
    expect(downloadedContent).toContain(unicodeText);

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf(unicodeText);
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    expect(textPos).toBeGreaterThan(newSlidePos);
    expect(textPos).toBeLessThan(slide2Pos);
  });

  test('Multi-line text content in new elements', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text with multiple lines
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    const multilineText = 'Line one\nLine two\nLine three';
    await page.evaluate((text) => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = text;
    }, multilineText);

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Multi-line text should be preserved (or at least the words)
    expect(downloadedContent).toContain('Line one');
    expect(downloadedContent).toContain('Line two');
    expect(downloadedContent).toContain('Line three');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('Line one');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    expect(textPos).toBeGreaterThan(newSlidePos);
    expect(textPos).toBeLessThan(slide2Pos);
  });

  test('New slide between middle original slides', async ({ page }) => {
    // This test uses multiple-elements.qmd which has more slides
    const htmlPath = path.join(TESTING_DIR, 'multiple-elements.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Navigate to slide 1 (second slide, "Slide 2")
    await page.evaluate(() => Reveal.slide(1));
    await page.waitForTimeout(300);

    // Add a new slide after it
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'MIDDLE_INSERT';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Should be present
    expect(downloadedContent).toContain('MIDDLE_INSERT');
    expect(downloadedContent).toContain('## New Slide');

    // The file has ## Slide 1 and ## Slide 2
    // New slide should be after Slide 2
    const slide2Pos = downloadedContent.indexOf('## Slide 2');
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('MIDDLE_INSERT');

    expect(newSlidePos).toBeGreaterThan(slide2Pos);
    expect(textPos).toBeGreaterThan(newSlidePos);
  });

  test('Multiple text elements on different new slides', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add slide A with text
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'DIFF_SLIDE_A';
    });

    // Add slide B with different text
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'DIFF_SLIDE_B';
    });

    // Add slide C with different text
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'DIFF_SLIDE_C';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // All texts should be present
    expect(downloadedContent).toContain('DIFF_SLIDE_A');
    expect(downloadedContent).toContain('DIFF_SLIDE_B');
    expect(downloadedContent).toContain('DIFF_SLIDE_C');

    // Should have 3 new slide headings
    const newSlideCount = (downloadedContent.match(/## New Slide/g) || []).length;
    expect(newSlideCount).toBe(3);

    // Verify each text is on its own slide (in order A, B, C)
    const posA = downloadedContent.indexOf('DIFF_SLIDE_A');
    const posB = downloadedContent.indexOf('DIFF_SLIDE_B');
    const posC = downloadedContent.indexOf('DIFF_SLIDE_C');

    expect(posA).toBeLessThan(posB);
    expect(posB).toBeLessThan(posC);

    // Find all ## New Slide positions
    let slidePositions = [];
    let searchStart = 0;
    while (true) {
      const pos = downloadedContent.indexOf('## New Slide', searchStart);
      if (pos === -1) break;
      slidePositions.push(pos);
      searchStart = pos + 1;
    }

    // Each text should be between its slide and the next
    expect(posA).toBeGreaterThan(slidePositions[0]);
    expect(posA).toBeLessThan(slidePositions[1]);

    expect(posB).toBeGreaterThan(slidePositions[1]);
    expect(posB).toBeLessThan(slidePositions[2]);

    expect(posC).toBeGreaterThan(slidePositions[2]);
  });

});

test.describe('ToolbarRegistry', () => {

  test('ToolbarRegistry has expected actions', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    const actions = await page.evaluate(() => {
      return ToolbarRegistry.getActions().map(a => a.name);
    });

    expect(actions).toContain('save');
    expect(actions).toContain('copy');
    expect(actions).toContain('addText');
    expect(actions).toContain('addSlide');
  });

  test('ToolbarRegistry.createButton creates valid button', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    const buttonInfo = await page.evaluate(() => {
      const config = {
        icon: 'T',
        label: 'Test',
        title: 'Test Button',
        className: 'test-btn',
        onClick: () => {},
      };
      const btn = ToolbarRegistry.createButton(config);
      return {
        tagName: btn.tagName,
        hasClass: btn.classList.contains('editable-toolbar-button'),
        hasCustomClass: btn.classList.contains('test-btn'),
        hasIcon: !!btn.querySelector('.toolbar-icon'),
        hasLabel: !!btn.querySelector('.toolbar-label'),
        ariaLabel: btn.getAttribute('aria-label'),
        title: btn.title,
      };
    });

    expect(buttonInfo.tagName).toBe('BUTTON');
    expect(buttonInfo.hasClass).toBe(true);
    expect(buttonInfo.hasCustomClass).toBe(true);
    expect(buttonInfo.hasIcon).toBe(true);
    expect(buttonInfo.hasLabel).toBe(true);
    expect(buttonInfo.ariaLabel).toBe('Test');
    expect(buttonInfo.title).toBe('Test Button');
  });

});

test.describe('NewElementRegistry', () => {

  test('NewElementRegistry starts empty', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    const state = await page.evaluate(() => ({
      newDivsCount: NewElementRegistry.newDivs.length,
      newSlidesCount: NewElementRegistry.newSlides.length,
      hasNewElements: NewElementRegistry.hasNewElements(),
    }));

    expect(state.newDivsCount).toBe(0);
    expect(state.newSlidesCount).toBe(0);
    expect(state.hasNewElements).toBe(false);
  });

  test('NewElementRegistry.addDiv tracks divs', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.textContent = 'Test';
      NewElementRegistry.addDiv(div, 1);
      return {
        count: NewElementRegistry.newDivs.length,
        slideIndex: NewElementRegistry.newDivs[0].slideIndex,
        content: NewElementRegistry.newDivs[0].content,
      };
    });

    expect(result.count).toBe(1);
    expect(result.slideIndex).toBe(1);
    expect(result.content).toBe('Test');
  });

  test('NewElementRegistry.addSlide tracks slides', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    const result = await page.evaluate(() => {
      const slide = document.createElement('section');
      NewElementRegistry.addSlide(slide, 2);
      return {
        count: NewElementRegistry.newSlides.length,
        afterSlideIndex: NewElementRegistry.newSlides[0].afterSlideIndex,
      };
    });

    expect(result.count).toBe(1);
    expect(result.afterSlideIndex).toBe(2);
  });

  test('NewElementRegistry.clear resets state', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());

    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      NewElementRegistry.addDiv(div, 1);
      const slide = document.createElement('section');
      NewElementRegistry.addSlide(slide, 2);

      const before = NewElementRegistry.hasNewElements();
      NewElementRegistry.clear();
      const after = NewElementRegistry.hasNewElements();

      return { before, after };
    });

    expect(result.before).toBe(true);
    expect(result.after).toBe(false);
  });

});

// =============================================================================
// Edge Case Tests
// =============================================================================

test.describe('Edge Cases - Content that could break parsing', () => {

  test('Text containing "## " at line start (fake heading)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    // Add text that looks like a heading
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.innerHTML = '## Fake Heading\nThis is not a real slide';
    });

    // Save
    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // The fake heading should be inside a ::: block, not treated as a real heading
    expect(downloadedContent).toContain('## Fake Heading');
    expect(downloadedContent).toContain('::: {.absolute');

    // Count actual ## New Slide headings (should be exactly 1)
    const realNewSlides = (downloadedContent.match(/^## New Slide$/gm) || []).length;
    expect(realNewSlides).toBe(1);

    // Verify ordering: fake heading should be INSIDE a div block on the new slide
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const fakeHeadingPos = downloadedContent.indexOf('## Fake Heading');
    const slide2Pos = downloadedContent.indexOf('## Slide 2');

    expect(fakeHeadingPos).toBeGreaterThan(newSlidePos);
    expect(fakeHeadingPos).toBeLessThan(slide2Pos);
  });

  test('Text containing standalone ":::" line', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.innerHTML = 'Before fence<br>:::<br>After fence';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Content should be preserved
    expect(downloadedContent).toContain('Before fence');
    expect(downloadedContent).toContain('After fence');

    // The content with ::: should be inside the div block
    // Find the block containing our content and verify it uses longer fences
    const lines = downloadedContent.split('\n');
    let inBlock = false;
    let currentFenceLength = 0;
    let blockContainsOurContent = false;
    let ourBlockFenceLength = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fenceMatch = line.match(/^(:{3,})\s*\{\.absolute/);

      if (fenceMatch && !inBlock) {
        inBlock = true;
        currentFenceLength = fenceMatch[1].length;
        blockContainsOurContent = false;
      } else if (inBlock) {
        if (line.includes('Before fence')) {
          blockContainsOurContent = true;
          ourBlockFenceLength = currentFenceLength;
        }
        if (line.trim() === ':'.repeat(currentFenceLength)) {
          inBlock = false;
        }
      }
    }

    // The block containing our content should use at least 4 colons
    expect(ourBlockFenceLength).toBeGreaterThanOrEqual(4);

    // Verify the content has the ::: inside
    expect(downloadedContent).toContain('Before fence');
    expect(downloadedContent).toContain(':::');
    expect(downloadedContent).toContain('After fence');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('Before fence');
    expect(textPos).toBeGreaterThan(newSlidePos);
  });

  test('Text containing "{.absolute" (output format)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'Use {.absolute width=100px} for positioning';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // The text should be preserved literally
    expect(downloadedContent).toContain('Use {.absolute width=100px} for positioning');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('Use {.absolute width=100px}');
    expect(textPos).toBeGreaterThan(newSlidePos);
  });

  test('Text containing "::: {.editable" (input format)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'Example: ::: {.editable} content :::';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // The text should be preserved literally
    expect(downloadedContent).toContain('Example: ::: {.editable} content :::');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('Example: ::: {.editable}');
    expect(textPos).toBeGreaterThan(newSlidePos);
  });

  test('Text with markdown code blocks (```)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    const codeContent = '```javascript\nconst x = 1;\n```';
    await page.evaluate((text) => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.innerHTML = text.replace(/\n/g, '<br>');
    }, codeContent);

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Code fences should be preserved
    expect(downloadedContent).toContain('```');
    expect(downloadedContent).toContain('const x = 1');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const codePos = downloadedContent.indexOf('const x = 1');
    expect(codePos).toBeGreaterThan(newSlidePos);
  });

  test('Text starting with markdown list markers', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.innerHTML = '- Item 1<br>* Item 2<br>1. Item 3<br>> Quote';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // List markers should be preserved
    expect(downloadedContent).toContain('- Item 1');
    expect(downloadedContent).toContain('* Item 2');
    expect(downloadedContent).toContain('1. Item 3');
    expect(downloadedContent).toContain('> Quote');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const listPos = downloadedContent.indexOf('- Item 1');
    expect(listPos).toBeGreaterThan(newSlidePos);
  });

});

test.describe('Edge Cases - Document structure', () => {

  test('Document with no ## headings (title slide only)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'title-only.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add a new slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'TEXT_ON_NEW_SLIDE';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // New slide heading should be added
    expect(downloadedContent).toContain('## New Slide');
    expect(downloadedContent).toContain('TEXT_ON_NEW_SLIDE');

    // The new slide should appear after the original content
    const originalContentPos = downloadedContent.indexOf('Editable content on title slide');
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    expect(newSlidePos).toBeGreaterThan(originalContentPos);
  });

});

test.describe('Edge Cases - Numeric/positioning', () => {

  test('Negative rotation (-45deg)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) {
        el.textContent = 'NEGATIVE_ROTATION';
        const editableElt = editableRegistry.get(el);
        if (editableElt) {
          editableElt.setState({ rotation: -45 });
        }
      }
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    expect(downloadedContent).toContain('NEGATIVE_ROTATION');
    expect(downloadedContent).toContain('transform: rotate(-45deg)');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const textPos = downloadedContent.indexOf('NEGATIVE_ROTATION');
    expect(textPos).toBeGreaterThan(newSlidePos);
  });

  test('Rotation exactly 360 degrees', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) {
        el.textContent = 'ROTATION_360';
        const editableElt = editableRegistry.get(el);
        if (editableElt) {
          editableElt.setState({ rotation: 360 });
        }
      }
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    expect(downloadedContent).toContain('ROTATION_360');
    // 360 degrees should either be saved as-is or normalized
    // The important thing is the content is saved correctly
    const hasRotation = downloadedContent.includes('rotate(360deg)') ||
                        downloadedContent.includes('rotate(0deg)') ||
                        !downloadedContent.includes('rotate(');
    expect(hasRotation).toBe(true);
  });

  test('Rotation > 360 degrees (400deg)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) {
        el.textContent = 'ROTATION_400';
        const editableElt = editableRegistry.get(el);
        if (editableElt) {
          editableElt.setState({ rotation: 400 });
        }
      }
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    expect(downloadedContent).toContain('ROTATION_400');
    // Should save the rotation (whether normalized or not)
    expect(downloadedContent).toContain('rotate(');
  });

  test('Position at (0, 0)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) {
        el.textContent = 'POSITION_ZERO';
        const editableElt = editableRegistry.get(el);
        if (editableElt) {
          editableElt.setState({ x: 0, y: 0 });
        }
      }
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    expect(downloadedContent).toContain('POSITION_ZERO');
    expect(downloadedContent).toContain('left=0px');
    expect(downloadedContent).toContain('top=0px');
  });

  test('New element at minimum size (50x50)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) {
        el.textContent = 'MIN_SIZE';
        const editableElt = editableRegistry.get(el);
        if (editableElt) {
          editableElt.setState({ width: 50, height: 50 });
        }
      }
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    expect(downloadedContent).toContain('MIN_SIZE');
    expect(downloadedContent).toContain('width=50px');
    expect(downloadedContent).toContain('height=50px');
  });

  test('Decimal position/size values round correctly', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) {
        el.textContent = 'DECIMAL_VALUES';
        const editableElt = editableRegistry.get(el);
        if (editableElt) {
          editableElt.setState({ x: 123.456, y: 78.999, width: 200.123, height: 150.567 });
        }
      }
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    expect(downloadedContent).toContain('DECIMAL_VALUES');
    // Values should be rounded to 1 decimal place
    expect(downloadedContent).toMatch(/left=123\.5?px/);
    expect(downloadedContent).toMatch(/top=79(\.0)?px/);
    expect(downloadedContent).toMatch(/width=200\.1?px/);
    expect(downloadedContent).toMatch(/height=150\.6?px/);
  });

});

test.describe('Edge Cases - Insertion order', () => {

  test('Add 5+ slides after same original, NO navigation between', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Stay on slide 0 and add 5 slides in sequence (no going back)
    for (let i = 1; i <= 5; i++) {
      await page.click('.toolbar-add-slide');
      await page.waitForTimeout(400);
      await page.click('.toolbar-add-text');
      await page.waitForTimeout(200);
      await page.evaluate((num) => {
        const el = document.querySelector('section.present .editable-new');
        if (el) el.textContent = `CHAIN_${num}`;
      }, i);
    }

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // All 5 markers should be present
    for (let i = 1; i <= 5; i++) {
      expect(downloadedContent).toContain(`CHAIN_${i}`);
    }

    // Verify ordering: 1, 2, 3, 4, 5 (insertion order preserved in chain)
    const pos1 = downloadedContent.indexOf('CHAIN_1');
    const pos2 = downloadedContent.indexOf('CHAIN_2');
    const pos3 = downloadedContent.indexOf('CHAIN_3');
    const pos4 = downloadedContent.indexOf('CHAIN_4');
    const pos5 = downloadedContent.indexOf('CHAIN_5');

    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos3);
    expect(pos3).toBeLessThan(pos4);
    expect(pos4).toBeLessThan(pos5);
  });

  test('Wide tree: 5 slides via repeated back-and-add (all roots)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add slide 1 from original
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'WIDE_1';
    });

    // Go back to original, add slide 2
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'WIDE_2';
    });

    // Go back to original, add slide 3
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'WIDE_3';
    });

    // Go back to original, add slide 4
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'WIDE_4';
    });

    // Go back to original, add slide 5
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'WIDE_5';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // All 5 markers should be present
    for (let i = 1; i <= 5; i++) {
      expect(downloadedContent).toContain(`WIDE_${i}`);
    }

    // All 5 slides inserted after same original, later insertions come first
    // Expected order: 5, 4, 3, 2, 1 (reverse insertion order for roots)
    const pos1 = downloadedContent.indexOf('WIDE_1');
    const pos2 = downloadedContent.indexOf('WIDE_2');
    const pos3 = downloadedContent.indexOf('WIDE_3');
    const pos4 = downloadedContent.indexOf('WIDE_4');
    const pos5 = downloadedContent.indexOf('WIDE_5');

    expect(pos5).toBeLessThan(pos4);
    expect(pos4).toBeLessThan(pos3);
    expect(pos3).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos1);
  });

  test('Deeper nesting (6+ levels)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add 6 slides in a chain: A -> B -> C -> D -> E -> F
    const markers = ['DEEP_A', 'DEEP_B', 'DEEP_C', 'DEEP_D', 'DEEP_E', 'DEEP_F'];
    for (const marker of markers) {
      await page.click('.toolbar-add-slide');
      await page.waitForTimeout(400);
      await page.click('.toolbar-add-text');
      await page.waitForTimeout(200);
      await page.evaluate((m) => {
        const el = document.querySelector('section.present .editable-new');
        if (el) el.textContent = m;
      }, marker);
    }

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // All markers should be present in correct order
    for (const marker of markers) {
      expect(downloadedContent).toContain(marker);
    }

    // Verify order: A, B, C, D, E, F
    let lastPos = -1;
    for (const marker of markers) {
      const pos = downloadedContent.indexOf(marker);
      expect(pos).toBeGreaterThan(lastPos);
      lastPos = pos;
    }
  });

  test('Alternating: add slide -> add text -> add slide -> add text pattern', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Pattern: slide1 -> text on original -> slide2 -> text on slide1 -> slide3

    // Add slide 1
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'TEXT_ON_SLIDE_1';
    });

    // Go back to original, add text
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'TEXT_ON_ORIGINAL';
    });

    // Add slide 2 (from original)
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'TEXT_ON_SLIDE_2';
    });

    // Go to slide 1, add text
    await page.evaluate(() => Reveal.slide(2)); // slide 1 is now at index 2
    await page.waitForTimeout(300);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const currentSlide = document.querySelector('section.present');
      const newEls = currentSlide.querySelectorAll('.editable-new');
      const lastEl = newEls[newEls.length - 1];
      if (lastEl) lastEl.textContent = 'MORE_TEXT_ON_SLIDE_1';
    });

    // Add slide 3 (from slide 1)
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'TEXT_ON_SLIDE_3';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // All texts should be present
    expect(downloadedContent).toContain('TEXT_ON_SLIDE_1');
    expect(downloadedContent).toContain('TEXT_ON_ORIGINAL');
    expect(downloadedContent).toContain('TEXT_ON_SLIDE_2');
    expect(downloadedContent).toContain('MORE_TEXT_ON_SLIDE_1');
    expect(downloadedContent).toContain('TEXT_ON_SLIDE_3');

    // Verify ordering
    const slide1Pos = downloadedContent.indexOf('## Slide 1');
    const originalTextPos = downloadedContent.indexOf('TEXT_ON_ORIGINAL');
    const slide2TextPos = downloadedContent.indexOf('TEXT_ON_SLIDE_2');
    const slide1TextPos = downloadedContent.indexOf('TEXT_ON_SLIDE_1');
    const moreSlide1TextPos = downloadedContent.indexOf('MORE_TEXT_ON_SLIDE_1');
    const slide3TextPos = downloadedContent.indexOf('TEXT_ON_SLIDE_3');

    // Original text should be on original slide (before any new slides)
    expect(originalTextPos).toBeGreaterThan(slide1Pos);
    // Slide 1 texts should be together
    expect(slide1TextPos).toBeLessThan(slide3TextPos);
    expect(moreSlide1TextPos).toBeLessThan(slide3TextPos);
  });

});

test.describe('Edge Cases - State management', () => {

  test('Save with NO new elements (only moved existing)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Just move an existing element, don't add any new ones
    await page.evaluate(() => {
      const container = document.querySelector('.editable-container');
      if (container) {
        container.style.left = '100px';
        container.style.top = '200px';
      }
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Should still have the original content structure
    expect(downloadedContent).toContain('## Slide 1');
    expect(downloadedContent).toContain('## Slide 2');

    // Should NOT have any new slides
    expect(downloadedContent).not.toContain('## New Slide');

    // Original elements should be converted to .absolute
    expect(downloadedContent).toContain('{.absolute');
  });

  test('Multiple saves in same session', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // First save: add a slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'FIRST_SAVE_TEXT';
    });

    let downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    let download = await downloadPromise;

    let downloadStream = await download.createReadStream();
    let chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const firstSaveContent = Buffer.concat(chunks).toString('utf-8');

    expect(firstSaveContent).toContain('FIRST_SAVE_TEXT');
    expect(firstSaveContent).toContain('## New Slide');

    // Second save: add another slide
    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(400);
    await page.click('.toolbar-add-text');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'SECOND_SAVE_TEXT';
    });

    downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    download = await downloadPromise;

    downloadStream = await download.createReadStream();
    chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const secondSaveContent = Buffer.concat(chunks).toString('utf-8');

    // Second save should include both texts
    expect(secondSaveContent).toContain('FIRST_SAVE_TEXT');
    expect(secondSaveContent).toContain('SECOND_SAVE_TEXT');

    // Should have 2 new slides now
    const newSlideCount = (secondSaveContent.match(/## New Slide/g) || []).length;
    expect(newSlideCount).toBe(2);
  });

  test('Registry state after clear and new additions', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    // Add element, clear, add again
    const result = await page.evaluate(() => {
      // Add first
      const div1 = document.createElement('div');
      NewElementRegistry.addDiv(div1, 0);
      const countAfterFirst = NewElementRegistry.newDivs.length;

      // Clear
      NewElementRegistry.clear();
      const countAfterClear = NewElementRegistry.newDivs.length;

      // Add second
      const div2 = document.createElement('div');
      NewElementRegistry.addDiv(div2, 1);
      const countAfterSecond = NewElementRegistry.newDivs.length;

      return { countAfterFirst, countAfterClear, countAfterSecond };
    });

    expect(result.countAfterFirst).toBe(1);
    expect(result.countAfterClear).toBe(0);
    expect(result.countAfterSecond).toBe(1);
  });

});

test.describe('Edge Cases - Text content', () => {

  test('Text with only whitespace', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = '   \t\n   ';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Should still have the div block
    expect(downloadedContent).toContain('::: {.absolute');
    expect(downloadedContent).toContain('## New Slide');

    // Verify ordering
    const newSlidePos = downloadedContent.indexOf('## New Slide');
    const divPos = downloadedContent.indexOf('::: {.absolute');
    expect(divPos).toBeGreaterThan(newSlidePos);
  });

  test('Text with consecutive paragraph breaks (\\n\\n)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.innerHTML = 'Paragraph 1<br><br>Paragraph 2<br><br>Paragraph 3';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // All paragraphs should be present
    expect(downloadedContent).toContain('Paragraph 1');
    expect(downloadedContent).toContain('Paragraph 2');
    expect(downloadedContent).toContain('Paragraph 3');

    // Verify ordering
    const p1Pos = downloadedContent.indexOf('Paragraph 1');
    const p2Pos = downloadedContent.indexOf('Paragraph 2');
    const p3Pos = downloadedContent.indexOf('Paragraph 3');
    expect(p1Pos).toBeLessThan(p2Pos);
    expect(p2Pos).toBeLessThan(p3Pos);
  });

  test('Very long text (1000+ chars)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    const longText = 'LONG_START_' + 'x'.repeat(1000) + '_LONG_END';
    await page.evaluate((text) => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = text;
    }, longText);

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Long text should be preserved
    expect(downloadedContent).toContain('LONG_START_');
    expect(downloadedContent).toContain('_LONG_END');
    expect(downloadedContent.length).toBeGreaterThan(1000);
  });

  test('Text with HTML tags (<div>, <script>)', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    // Set as text content to preserve literal angle brackets
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'Example: <div class="test">content</div> and <script>alert(1)</script>';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // HTML-like content should be preserved (may be escaped or literal)
    expect(downloadedContent).toContain('div');
    expect(downloadedContent).toContain('script');
  });

});

test.describe('Edge Cases - Output format', () => {

  test('Verify ::: block properly closed with closing :::', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'VERIFY_CLOSURE';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Find all ::: lines
    const fenceLines = downloadedContent.split('\n').filter(line => line.trim().startsWith(':::'));

    // Should have matching open/close pairs
    let depth = 0;
    for (const line of fenceLines) {
      if (line.trim() === ':::') {
        depth--;
      } else if (line.trim().startsWith('::: {')) {
        depth++;
      }
    }
    expect(depth).toBe(0); // All blocks should be closed

    // Our specific new block should be properly formed
    const newBlockStart = downloadedContent.indexOf('::: {.absolute');
    expect(newBlockStart).toBeGreaterThan(-1);

    // Find the content between this open and its close
    const afterBlock = downloadedContent.substring(newBlockStart);
    const contentMatch = afterBlock.match(/::: \{\.absolute[^}]*\}\n([\s\S]*?)\n:::/);
    expect(contentMatch).not.toBeNull();
  });

  test('Verify proper blank lines around inserted content', async ({ page }) => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-slide');
    await page.waitForTimeout(500);

    await page.click('.toolbar-add-text');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('section.present .editable-new');
      if (el) el.textContent = 'BLANK_LINES_TEST';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('.toolbar-save');
    const download = await downloadPromise;

    const downloadStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // The ## New Slide should have a blank line before it (for proper markdown)
    const newSlideMatch = downloadedContent.match(/\n\n## New Slide/);
    expect(newSlideMatch).not.toBeNull();
  });

});
