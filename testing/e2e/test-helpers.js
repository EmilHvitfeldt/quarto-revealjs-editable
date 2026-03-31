// @ts-check
const path = require('path');

const TESTING_DIR = path.join(__dirname, '..');

/**
 * Setup page with the given HTML file and wait for Reveal.js to be ready.
 * Uses element-based waiting instead of fixed timeouts.
 * @param {import('@playwright/test').Page} page
 * @param {string} htmlFile - HTML filename (e.g., 'basic.html')
 */
async function setupPage(page, htmlFile = 'basic.html') {
  const htmlPath = path.join(TESTING_DIR, htmlFile);
  await page.goto(`file://${htmlPath}`);
  await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
  // Wait for editable infrastructure to be set up
  await page.waitForSelector('.editable-container, #editable-toolbar', { timeout: 5000 });
}

/**
 * Wait for Reveal.js to be ready (for use in tests that already have page loaded)
 * @param {import('@playwright/test').Page} page
 */
async function waitForReveal(page) {
  await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
  await page.waitForSelector('.editable-container, #editable-toolbar', { timeout: 5000 });
}

/**
 * Wait for an element to appear after an action
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {number} timeout
 */
async function waitForElement(page, selector, timeout = 2000) {
  await page.waitForSelector(selector, { timeout });
}

/**
 * Wait for a condition in the page
 * @param {import('@playwright/test').Page} page
 * @param {Function} condition
 * @param {number} timeout
 */
async function waitForCondition(page, condition, timeout = 2000) {
  await page.waitForFunction(condition, { timeout });
}

/**
 * Click add text button in toolbar submenu and wait for element to be created
 * @param {import('@playwright/test').Page} page
 */
async function clickAddText(page) {
  const initialCount = await page.evaluate(() => document.querySelectorAll('.editable-new').length);
  await page.click('.toolbar-add');
  await page.waitForSelector('.editable-toolbar-submenu-item.toolbar-add-text', { state: 'visible' });
  await page.click('.editable-toolbar-submenu-item.toolbar-add-text');
  // Wait for new element to be created
  await page.waitForFunction(
    (count) => document.querySelectorAll('.editable-new').length > count,
    initialCount,
    { timeout: 5000 }
  );
}

/**
 * Click add slide button in toolbar submenu and wait for slide to be created
 * @param {import('@playwright/test').Page} page
 */
async function clickAddSlide(page) {
  const initialCount = await page.evaluate(() => document.querySelectorAll('.editable-new-slide').length);
  await page.click('.toolbar-add');
  await page.waitForSelector('.editable-toolbar-submenu-item.toolbar-add-slide', { state: 'visible' });
  await page.click('.editable-toolbar-submenu-item.toolbar-add-slide');
  // Wait for new slide to be created
  await page.waitForFunction(
    (count) => document.querySelectorAll('.editable-new-slide').length > count,
    initialCount,
    { timeout: 5000 }
  );
}

/**
 * Click add arrow button in toolbar submenu and wait for arrow to be created
 * @param {import('@playwright/test').Page} page
 */
async function clickAddArrow(page) {
  // First ensure normal toolbar buttons are visible by deselecting any arrow
  const arrowControlsVisible = await page.evaluate(() => {
    const arrowControls = document.querySelector('.arrow-style-controls');
    return arrowControls && arrowControls.style.display !== 'none';
  });
  if (arrowControlsVisible) {
    // Click below the top bar (y > 100px) to deselect the arrow
    await page.mouse.click(10, 150);
    await page.waitForFunction(() => {
      const arrowControls = document.querySelector('.arrow-style-controls');
      return !arrowControls || arrowControls.style.display === 'none';
    }, { timeout: 1000 }).catch(() => {});
  }

  const initialCount = await page.evaluate(() =>
    document.querySelectorAll('.editable-arrow-container.editable-new').length
  );

  await page.click('.toolbar-add');
  await page.waitForSelector('.editable-toolbar-submenu-item.toolbar-add-arrow', { state: 'visible' });
  await page.click('.editable-toolbar-submenu-item.toolbar-add-arrow');

  // Handle potential arrow extension warning modal (auto-accept)
  const modal = await page.$('.editable-modal-overlay');
  if (modal) {
    await page.click('.editable-modal-confirm');
    await page.waitForSelector('.editable-modal-overlay', { state: 'hidden', timeout: 1000 }).catch(() => {});
  }

  // Wait for arrow to be created
  await page.waitForFunction(
    (count) => document.querySelectorAll('.editable-arrow-container.editable-new').length > count,
    initialCount,
    { timeout: 5000 }
  );
}

/**
 * Get arrow data from the page
 * @param {import('@playwright/test').Page} page
 */
async function getArrowData(page) {
  return page.evaluate(() => {
    const containers = document.querySelectorAll('.editable-arrow-container');
    return Array.from(containers).map(container => ({
      isNew: container.classList.contains('editable-new'),
      isActive: container.classList.contains('active'),
      hasCurveMode: container.classList.contains('curve-mode'),
      hasStartHandle: !!container.querySelector('.editable-arrow-handle-start'),
      hasEndHandle: !!container.querySelector('.editable-arrow-handle-end'),
      hasControl1Handle: !!container.querySelector('.editable-arrow-handle-control1'),
      hasControl2Handle: !!container.querySelector('.editable-arrow-handle-control2'),
      hasSvg: !!container.querySelector('svg'),
      hasPath: !!container.querySelector('svg path'),
    }));
  });
}

/**
 * Deselect any active arrow by clicking outside
 * @param {import('@playwright/test').Page} page
 */
async function deselectArrow(page) {
  // Click below the top bar (y > 100px) and away from arrow containers
  await page.mouse.click(10, 150);
  await page.waitForFunction(() => {
    const active = document.querySelector('.editable-arrow-container.active');
    return !active;
  }, { timeout: 1000 }).catch(() => {});
}

/**
 * Add multiple slides with text markers efficiently using direct JS calls.
 * Much faster than clicking UI for each slide in a loop.
 * @param {import('@playwright/test').Page} page
 * @param {string[]} markers - Array of text markers for each slide
 */
async function addSlidesWithMarkers(page, markers) {
  await page.evaluate(async (markers) => {
    for (const marker of markers) {
      // Call internal functions directly
      addNewSlide();
      const div = await addNewTextElement();
      if (div) {
        const editor = div.querySelector('.ql-editor');
        if (editor) {
          editor.textContent = marker;
        } else {
          div.textContent = marker;
        }
        // Mark as dirty so it gets saved
        const quillData = quillInstances?.get(div);
        if (quillData) quillData.isDirty = true;
      }
    }
  }, markers);
  // Wait for all elements to be created
  await page.waitForFunction(
    (count) => document.querySelectorAll('.editable-new-slide').length >= count,
    markers.length,
    { timeout: 5000 }
  );
}

/**
 * Add text element with marker on current slide using direct JS call.
 * @param {import('@playwright/test').Page} page
 * @param {string} marker - Text content for the element
 */
async function addTextWithMarker(page, marker) {
  await page.evaluate(async (marker) => {
    const div = await addNewTextElement();
    if (div) {
      const editor = div.querySelector('.ql-editor');
      if (editor) {
        editor.textContent = marker;
      } else {
        div.textContent = marker;
      }
      const quillData = quillInstances?.get(div);
      if (quillData) quillData.isDirty = true;
    }
  }, marker);
}

/**
 * Add a new slide using direct JS call (faster than UI click).
 * @param {import('@playwright/test').Page} page
 */
async function addSlideViaJS(page) {
  const initialCount = await page.evaluate(() => document.querySelectorAll('.editable-new-slide').length);
  await page.evaluate(() => addNewSlide());
  await page.waitForFunction(
    (count) => document.querySelectorAll('.editable-new-slide').length > count,
    initialCount,
    { timeout: 5000 }
  );
}

module.exports = {
  TESTING_DIR,
  setupPage,
  waitForReveal,
  waitForElement,
  waitForCondition,
  clickAddText,
  clickAddSlide,
  clickAddArrow,
  getArrowData,
  deselectArrow,
  addSlidesWithMarkers,
  addTextWithMarker,
  addSlideViaJS,
};
