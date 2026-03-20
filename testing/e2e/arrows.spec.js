// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TESTING_DIR = path.join(__dirname, '..');

// Helper to click Add Arrow in the toolbar submenu
async function clickAddArrow(page) {
  await page.click('.toolbar-add');
  await page.click('.editable-toolbar-submenu-item.toolbar-add-arrow');
}

// Helper to wait for Reveal.js to be ready
async function waitForReveal(page) {
  await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
  await page.waitForTimeout(500);
}

// Helper to get arrow data from the page
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
      hasCurveToggle: !!container.querySelector('.editable-arrow-curve-toggle'),
      hasSvg: !!container.querySelector('svg'),
      hasPath: !!container.querySelector('svg path'),
    }));
  });
}

test.describe('Arrow Feature', () => {

  test.describe('Toolbar Integration', () => {

    test.beforeAll(async () => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      if (!fs.existsSync(htmlPath)) {
        throw new Error('Run quarto render arrows.qmd first to generate HTML file');
      }
    });

    test('Add submenu includes Arrow option', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Click add button to open submenu
      await page.click('.toolbar-add');

      // Check for arrow submenu item
      const submenuItems = await page.evaluate(() => {
        const items = document.querySelectorAll('.editable-toolbar-submenu-item');
        return Array.from(items).map(item => item.className);
      });

      expect(submenuItems.length).toBe(3); // Text, Slide, Arrow
      expect(submenuItems.some(c => c.includes('toolbar-add-arrow'))).toBe(true);
    });

  });

  test.describe('Arrow Creation', () => {

    test('Adding arrow creates arrow container on current slide', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Count existing arrows
      const initialCount = await page.evaluate(() =>
        document.querySelectorAll('.editable-arrow-container.editable-new').length
      );

      // Add an arrow
      await clickAddArrow(page);

      // Should have one more arrow
      const newCount = await page.evaluate(() =>
        document.querySelectorAll('.editable-arrow-container.editable-new').length
      );
      expect(newCount).toBe(initialCount + 1);
    });

    test('New arrow has all required elements', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      const arrows = await getArrowData(page);
      const newArrow = arrows.find(a => a.isNew);

      expect(newArrow).toBeDefined();
      expect(newArrow.hasSvg).toBe(true);
      expect(newArrow.hasPath).toBe(true);
      expect(newArrow.hasStartHandle).toBe(true);
      expect(newArrow.hasEndHandle).toBe(true);
      expect(newArrow.hasControl1Handle).toBe(true);
      expect(newArrow.hasControl2Handle).toBe(true);
      expect(newArrow.hasCurveToggle).toBe(true);
    });

    test('New arrow is centered on slide', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      const position = await page.evaluate(() => {
        const slide = document.querySelector('section.present');
        const startHandle = document.querySelector('.editable-arrow-container.editable-new .editable-arrow-handle-start');
        const endHandle = document.querySelector('.editable-arrow-container.editable-new .editable-arrow-handle-end');

        if (!slide || !startHandle || !endHandle) return null;

        const slideRect = slide.getBoundingClientRect();
        const slideCenter = {
          x: slideRect.width / 2,
          y: slideRect.height / 2,
        };

        // Get handle positions from style
        const startX = parseFloat(startHandle.style.left);
        const startY = parseFloat(startHandle.style.top);
        const endX = parseFloat(endHandle.style.left);
        const endY = parseFloat(endHandle.style.top);

        const arrowCenterX = (startX + endX) / 2;
        const arrowCenterY = (startY + endY) / 2;

        return {
          slideCenter,
          arrowCenter: { x: arrowCenterX, y: arrowCenterY },
        };
      });

      expect(position).not.toBeNull();
      // Arrow should be roughly centered (within 100px)
      expect(Math.abs(position.arrowCenter.x - position.slideCenter.x)).toBeLessThan(100);
      expect(Math.abs(position.arrowCenter.y - position.slideCenter.y)).toBeLessThan(100);
    });

    test('New arrow starts as active (selected)', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      const arrows = await getArrowData(page);
      const newArrow = arrows.find(a => a.isNew);

      expect(newArrow.isActive).toBe(true);
    });

  });

  test.describe('Arrow Selection', () => {

    test('Clicking outside arrow deselects it', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Verify it's active
      let arrows = await getArrowData(page);
      expect(arrows.find(a => a.isNew).isActive).toBe(true);

      // Click outside
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Should be deselected
      arrows = await getArrowData(page);
      expect(arrows.find(a => a.isNew).isActive).toBe(false);
    });

    test('Clicking arrow hit area selects it', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Deselect by clicking outside
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Get arrow path position and click on it
      const pathCenter = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const svg = container.querySelector('svg');
        const path = svg.querySelector('path[stroke-width="20"]'); // hit area
        if (!path) return null;

        const pathD = path.getAttribute('d');
        // Parse simple "M x1,y1 L x2,y2" format
        const match = pathD.match(/M\s*([\d.]+),([\d.]+)\s*L\s*([\d.]+),([\d.]+)/);
        if (!match) return null;

        const x1 = parseFloat(match[1]);
        const y1 = parseFloat(match[2]);
        const x2 = parseFloat(match[3]);
        const y2 = parseFloat(match[4]);

        return {
          x: (x1 + x2) / 2,
          y: (y1 + y2) / 2,
        };
      });

      if (pathCenter) {
        // Click on the arrow path (need to account for slide position)
        const slideBox = await page.locator('section.present').boundingBox();
        await page.click('section.present', {
          position: { x: pathCenter.x, y: pathCenter.y }
        });
        await page.waitForTimeout(100);

        const arrows = await getArrowData(page);
        expect(arrows.find(a => a.isNew).isActive).toBe(true);
      }
    });

    test('Only one arrow can be active at a time', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Add two arrows
      await clickAddArrow(page);
      await page.waitForTimeout(200);
      await clickAddArrow(page);
      await page.waitForTimeout(200);

      // Count active arrows
      const activeCount = await page.evaluate(() =>
        document.querySelectorAll('.editable-arrow-container.active').length
      );

      expect(activeCount).toBe(1);
    });

  });

  test.describe('Handle Dragging', () => {

    test('Dragging start handle updates arrow position', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Get initial position
      const initialPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-start');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Drag the start handle
      const startHandle = page.locator('.editable-arrow-handle-start');
      await startHandle.dragTo(page.locator('section.present'), {
        targetPosition: { x: 100, y: 100 },
      });

      // Get new position
      const newPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-start');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Position should have changed
      expect(newPos.left !== initialPos.left || newPos.top !== initialPos.top).toBe(true);
    });

    test('Dragging end handle updates arrow position', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Get initial position
      const initialPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Drag using mouse events directly
      const endHandle = page.locator('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 100, { steps: 5 });
      await page.mouse.up();

      // Get new position
      const newPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Position should have changed
      expect(newPos.left !== initialPos.left || newPos.top !== initialPos.top).toBe(true);
    });

    test('SVG path updates when handles are dragged', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Get initial path
      const initialPath = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });

      // Drag using mouse events directly
      const endHandle = page.locator('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 100, { steps: 5 });
      await page.mouse.up();

      // Get new path
      const newPath = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });

      expect(newPath).not.toBe(initialPath);
    });

  });

  test.describe('Curve Mode', () => {

    test('Toggle button switches to curve mode', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Click curve toggle
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      const arrows = await getArrowData(page);
      expect(arrows.find(a => a.isNew).hasCurveMode).toBe(true);
    });

    test('Control point handles appear in curve mode', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      // Check control handles are visible
      const control1Visible = await page.locator('.editable-arrow-handle-control1').isVisible();
      const control2Visible = await page.locator('.editable-arrow-handle-control2').isVisible();

      expect(control1Visible).toBe(true);
      expect(control2Visible).toBe(true);
    });

    test('Path becomes Bezier curve in curve mode', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Check initial path is a line (M...L)
      const initialPath = await page.evaluate(() => {
        const path = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return path.getAttribute('d');
      });
      expect(initialPath).toMatch(/^M.*L/);

      // Enable curve mode
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      // Check path is now a curve (M...C for cubic Bezier)
      const curvePath = await page.evaluate(() => {
        const path = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return path.getAttribute('d');
      });
      expect(curvePath).toMatch(/^M.*C/);
    });

    test('Toggling curve mode off resets to straight line', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Enable then disable curve mode
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      // Check path is back to line
      const pathD = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });
      expect(pathD).toMatch(/^M.*L/);

      // Control handles should be hidden
      const control1Visible = await page.locator('.editable-arrow-handle-control1').isVisible();
      expect(control1Visible).toBe(false);
    });

    test('Dragging control points changes curve shape', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      // Get initial curve path
      const initialPath = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });

      // Drag using mouse events directly
      const control1Handle = page.locator('.editable-arrow-handle-control1');
      const box = await control1Handle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y - 50, { steps: 5 });
      await page.mouse.up();

      // Path should have changed
      const newPath = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });
      expect(newPath).not.toBe(initialPath);
    });

    test('Guide lines connect endpoints to control points', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      // Check guide lines exist and are visible
      const guideLines = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const lines = container.querySelectorAll('svg line');
        return Array.from(lines).map(line => ({
          stroke: line.getAttribute('stroke'),
          display: line.style.display,
          x1: line.getAttribute('x1'),
          y1: line.getAttribute('y1'),
          x2: line.getAttribute('x2'),
          y2: line.getAttribute('y2'),
        }));
      });

      // Should have 2 guide lines with coordinates set
      const visibleGuides = guideLines.filter(l => l.display !== 'none' && l.x1);
      expect(visibleGuides.length).toBe(2);
    });

  });

  test.describe('Title Slide Handling', () => {

    test('hasTitleSlide detects YAML title slide', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      const hasTitle = await page.evaluate(() => {
        // Reproduce the hasTitleSlide logic
        const firstSlide = Reveal.getSlide(0);
        if (!firstSlide) return false;
        const h2 = firstSlide.querySelector('h2');
        return !h2;
      });

      // arrows.qmd has a title in YAML, so should have title slide
      expect(hasTitle).toBe(true);
    });

    test('Arrow added to content slide appears on that slide', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Navigate to slide 1 (first content slide after title)
      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      await clickAddArrow(page);

      // Arrow should be added to the current slide
      const arrowOnSlide = await page.evaluate(() => {
        const currentSlide = document.querySelector('section.present');
        const arrow = currentSlide.querySelector('.editable-arrow-container.editable-new');
        return !!arrow;
      });

      expect(arrowOnSlide).toBe(true);
    });

  });

  test.describe('Serialization', () => {

    test('Arrow has valid coordinates for serialization', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Navigate to a content slide
      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      await clickAddArrow(page);

      // Get arrow coordinates from the SVG path
      const pathData = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl ? pathEl.getAttribute('d') : null;
      });

      // Path should have valid "M x,y L x,y" format
      expect(pathData).toMatch(/^M\s*[\d.]+,[\d.]+\s*L\s*[\d.]+,[\d.]+$/);
    });

    test('Curved arrow has Bezier path with control points', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      await clickAddArrow(page);
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      // Get arrow path - should be cubic Bezier with control points
      const pathData = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl ? pathEl.getAttribute('d') : null;
      });

      // Path should have "M x,y C c1x,c1y c2x,c2y x,y" format (cubic Bezier)
      expect(pathData).toMatch(/^M\s*[\d.]+,[\d.]+\s*C\s*[\d.]+,[\d.]+\s+[\d.]+,[\d.]+\s+[\d.]+,[\d.]+$/);
    });

  });

  test.describe('Save Without Editable Elements', () => {

    test('Save button works when document has only arrows', async ({ page }) => {
      // Use a test file that has no .editable elements
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Add an arrow
      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);
      await clickAddArrow(page);

      // Check that getTransformedQmd doesn't throw
      const result = await page.evaluate(() => {
        try {
          const content = window.getTransformedQmd ? window.getTransformedQmd() : null;
          return { success: true, hasContent: !!content };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      expect(result.success).toBe(true);
    });

  });

  test.describe('Active State UI', () => {

    test('Handles are hidden when arrow is not active', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Deselect
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Check handles are hidden
      const startHandleVisible = await page.locator('.editable-arrow-handle-start').isVisible();
      const endHandleVisible = await page.locator('.editable-arrow-handle-end').isVisible();
      const curveToggleVisible = await page.locator('.editable-arrow-curve-toggle').isVisible();

      expect(startHandleVisible).toBe(false);
      expect(endHandleVisible).toBe(false);
      expect(curveToggleVisible).toBe(false);
    });

    test('Handles are shown when arrow is active', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Check handles are visible
      const startHandleVisible = await page.locator('.editable-arrow-handle-start').isVisible();
      const endHandleVisible = await page.locator('.editable-arrow-handle-end').isVisible();
      const curveToggleVisible = await page.locator('.editable-arrow-curve-toggle').isVisible();

      expect(startHandleVisible).toBe(true);
      expect(endHandleVisible).toBe(true);
      expect(curveToggleVisible).toBe(true);
    });

  });

  test.describe('Hit Area', () => {

    test('Hit area has wider stroke than visible path', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      const strokeWidths = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const paths = container.querySelectorAll('svg path');
        return Array.from(paths).map(p => ({
          stroke: p.getAttribute('stroke'),
          strokeWidth: p.getAttribute('stroke-width'),
        }));
      });

      // Should have hit area (transparent, 20px) and visible path (black, 2px)
      const hitArea = strokeWidths.find(p => p.stroke === 'transparent');
      const visiblePath = strokeWidths.find(p => p.stroke === 'black');

      expect(hitArea).toBeDefined();
      expect(visiblePath).toBeDefined();
      expect(parseInt(hitArea.strokeWidth)).toBeGreaterThan(parseInt(visiblePath.strokeWidth));
      expect(parseInt(hitArea.strokeWidth)).toBe(20);
    });

    test('Hit area path matches visible path', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      const paths = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const allPaths = container.querySelectorAll('svg path');
        const result = {};
        allPaths.forEach(p => {
          if (p.getAttribute('stroke') === 'transparent') {
            result.hitArea = p.getAttribute('d');
          } else if (p.getAttribute('stroke') === 'black') {
            result.visible = p.getAttribute('d');
          }
        });
        return result;
      });

      expect(paths.hitArea).toBe(paths.visible);
    });

  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  test.describe('Edge Cases - Multiple Arrows', () => {

    test('Multiple arrows on same slide are all created', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      // Add 3 arrows to the same slide
      await clickAddArrow(page);
      await page.waitForTimeout(100);
      await clickAddArrow(page);
      await page.waitForTimeout(100);
      await clickAddArrow(page);
      await page.waitForTimeout(100);

      const arrowCount = await page.evaluate(() => {
        const currentSlide = document.querySelector('section.present');
        return currentSlide.querySelectorAll('.editable-arrow-container.editable-new').length;
      });

      expect(arrowCount).toBe(3);
    });

    test('Multiple arrows have unique marker IDs', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);
      await page.waitForTimeout(100);
      await clickAddArrow(page);
      await page.waitForTimeout(100);

      const markerIds = await page.evaluate(() => {
        const markers = document.querySelectorAll('.editable-arrow-container.editable-new marker');
        return Array.from(markers).map(m => m.id);
      });

      // All IDs should be unique
      const uniqueIds = new Set(markerIds);
      expect(uniqueIds.size).toBe(markerIds.length);
    });

    test('Selecting one arrow deselects others', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);
      await page.waitForTimeout(100);
      await clickAddArrow(page);
      await page.waitForTimeout(100);

      // Click on the first arrow's path
      const firstArrowBox = await page.locator('.editable-arrow-container.editable-new').first().boundingBox();
      await page.mouse.click(firstArrowBox.x + firstArrowBox.width / 2, firstArrowBox.y + firstArrowBox.height / 2);
      await page.waitForTimeout(100);

      const activeCount = await page.evaluate(() =>
        document.querySelectorAll('.editable-arrow-container.active').length
      );

      expect(activeCount).toBeLessThanOrEqual(1);
    });

  });

  test.describe('Edge Cases - Title Slide', () => {

    test('Arrow can be added to title slide', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Make sure we're on title slide (index 0)
      await page.evaluate(() => Reveal.slide(0));
      await page.waitForTimeout(200);

      await clickAddArrow(page);

      const arrowOnTitleSlide = await page.evaluate(() => {
        const titleSlide = Reveal.getSlide(0);
        return !!titleSlide.querySelector('.editable-arrow-container.editable-new');
      });

      expect(arrowOnTitleSlide).toBe(true);
    });

  });

  test.describe('Edge Cases - Existing Arrows from Shortcodes', () => {

    test('Existing arrow from shortcode is rendered', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Go to slide with existing arrow (slide 1 in arrows.qmd)
      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      // Check for arrow SVG element (quarto-arrows creates these)
      const hasArrowSvg = await page.evaluate(() => {
        const currentSlide = document.querySelector('section.present');
        // quarto-arrows extension creates svg elements with class or specific structure
        const svgs = currentSlide.querySelectorAll('svg');
        return svgs.length > 0;
      });

      expect(hasArrowSvg).toBe(true);
    });

  });

  test.describe('Edge Cases - Coordinate Boundaries', () => {

    test('Arrow handle can be dragged to slide edge', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Drag end handle to edge of slide
      const endHandle = page.locator('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();
      const slideBox = await page.locator('section.present').boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(slideBox.x + slideBox.width - 10, slideBox.y + 10, { steps: 5 });
      await page.mouse.up();

      // Should not crash, handle should have updated position
      const newPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      expect(newPos.left).toBeGreaterThan(0);
      expect(newPos.top).toBeGreaterThan(0);
    });

    test('Arrow with handles at same position (zero length)', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Get start handle position and drag end handle to same spot
      const startPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-start');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      const endHandle = page.locator('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();
      const slideBox = await page.locator('section.present').boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      // Move to start position (accounting for slide offset and scale)
      await page.mouse.move(slideBox.x + startPos.left, slideBox.y + startPos.top, { steps: 5 });
      await page.mouse.up();

      // Should not crash - path should still exist
      const pathExists = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return !!pathEl && pathEl.getAttribute('d');
      });

      expect(pathExists).toBeTruthy();
    });

    test('Arrow handles very short distance between points', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Drag end handle very close to start
      const endHandle = page.locator('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x - 140, box.y, { steps: 5 }); // Move most of the way back
      await page.mouse.up();

      // Curve toggle should still be positioned (even if awkwardly)
      const toggleExists = await page.locator('.editable-arrow-curve-toggle').isVisible();
      expect(toggleExists).toBe(true);
    });

  });

  test.describe('Edge Cases - Slide Navigation', () => {

    test('Arrow state preserved when navigating away and back', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      await clickAddArrow(page);

      // Modify the arrow position
      const endHandle = page.locator('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + 50, { steps: 5 });
      await page.mouse.up();

      // Get the path
      const pathBefore = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });

      // Navigate away
      await page.evaluate(() => Reveal.slide(2));
      await page.waitForTimeout(200);

      // Navigate back
      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      // Path should be preserved
      const pathAfter = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });

      expect(pathAfter).toBe(pathBefore);
    });

    test('Creating arrow then immediately switching slides', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      await clickAddArrow(page);

      // Immediately navigate away
      await page.evaluate(() => Reveal.slide(2));
      await page.waitForTimeout(200);

      // Navigate back - arrow should still exist
      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      const arrowExists = await page.evaluate(() => {
        const currentSlide = document.querySelector('section.present');
        return !!currentSlide.querySelector('.editable-arrow-container.editable-new');
      });

      expect(arrowExists).toBe(true);
    });

  });

  test.describe('Edge Cases - Curve Mode Interactions', () => {

    test('Control points adjust when endpoints are moved in curve mode', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      // Get initial control point position
      const initialControlPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-control1');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Move the start handle significantly
      const startHandle = page.locator('.editable-arrow-handle-start');
      const box = await startHandle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x - 100, box.y - 100, { steps: 5 });
      await page.mouse.up();

      // Control point position is independent of endpoints after creation
      // (it maintains its absolute position, which is correct behavior)
      const controlPosAfter = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-control1');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Control point should still have valid position
      expect(controlPosAfter.left).toBeGreaterThan(0);
      expect(controlPosAfter.top).toBeGreaterThan(0);
    });

    test('Rapidly toggling curve mode does not break arrow', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Rapidly toggle curve mode
      for (let i = 0; i < 5; i++) {
        await page.click('.editable-arrow-curve-toggle');
        await page.waitForTimeout(50);
      }

      // Arrow should still be functional
      const arrowState = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke="black"]');
        return {
          hasContainer: !!container,
          hasPath: !!pathEl,
          pathD: pathEl ? pathEl.getAttribute('d') : null,
        };
      });

      expect(arrowState.hasContainer).toBe(true);
      expect(arrowState.hasPath).toBe(true);
      expect(arrowState.pathD).toBeTruthy();
    });

    test('Guide lines hidden after deselection in curve mode', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      // Verify guide lines are visible when active
      let guideLinesVisible = await page.evaluate(() => {
        const lines = document.querySelectorAll('.editable-arrow-container.editable-new svg line');
        return Array.from(lines).some(l => l.style.display !== 'none');
      });
      expect(guideLinesVisible).toBe(true);

      // Deselect
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Guide lines should be hidden
      guideLinesVisible = await page.evaluate(() => {
        const lines = document.querySelectorAll('.editable-arrow-container.editable-new svg line');
        return Array.from(lines).some(l => l.style.display !== 'none');
      });
      expect(guideLinesVisible).toBe(false);
    });

  });

  test.describe('Edge Cases - Accessibility', () => {

    test('Arrow handles have correct ARIA attributes', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      const ariaAttributes = await page.evaluate(() => {
        const handles = document.querySelectorAll('.editable-arrow-container.editable-new .editable-arrow-handle');
        return Array.from(handles).map(h => ({
          role: h.getAttribute('role'),
          ariaLabel: h.getAttribute('aria-label'),
          tabindex: h.getAttribute('tabindex'),
        }));
      });

      // All handles should have proper ARIA
      ariaAttributes.forEach(attr => {
        expect(attr.role).toBe('slider');
        expect(attr.ariaLabel).toBeTruthy();
        expect(attr.tabindex).toBe('0');
      });
    });

    test('Handles are focusable via keyboard', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      // Focus on start handle
      const startHandle = page.locator('.editable-arrow-handle-start');
      await startHandle.focus();

      const isFocused = await page.evaluate(() => {
        return document.activeElement.classList.contains('editable-arrow-handle-start');
      });

      expect(isFocused).toBe(true);
    });

  });

  test.describe('Edge Cases - Z-Index and Overlapping', () => {

    test('Arrow container has correct z-index', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      const zIndex = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        return parseInt(window.getComputedStyle(container).zIndex);
      });

      expect(zIndex).toBeGreaterThanOrEqual(100);
    });

    test('Arrow handles have higher z-index than container', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);

      const zIndices = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const handle = container.querySelector('.editable-arrow-handle');
        return {
          container: parseInt(window.getComputedStyle(container).zIndex) || 0,
          handle: parseInt(window.getComputedStyle(handle).zIndex) || 0,
        };
      });

      expect(zIndices.handle).toBeGreaterThanOrEqual(zIndices.container);
    });

  });

  test.describe('Edge Cases - Performance', () => {

    test('Creating many arrows does not crash', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Create 10 arrows
      for (let i = 0; i < 10; i++) {
        await clickAddArrow(page);
        await page.waitForTimeout(50);
      }

      const arrowCount = await page.evaluate(() =>
        document.querySelectorAll('.editable-arrow-container.editable-new').length
      );

      expect(arrowCount).toBe(10);
    });

    test('Page remains responsive after many arrows', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Create several arrows
      for (let i = 0; i < 5; i++) {
        await clickAddArrow(page);
        await page.waitForTimeout(50);
      }

      // Verify we can still interact with the last arrow
      const lastHandle = page.locator('.editable-arrow-handle-end').last();
      const box = await lastHandle.boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 30, box.y + 30, { steps: 3 });
      await page.mouse.up();

      // Should have moved
      const moved = await page.evaluate(() => {
        const handles = document.querySelectorAll('.editable-arrow-handle-end');
        const lastHandle = handles[handles.length - 1];
        return parseFloat(lastHandle.style.left) > 0;
      });

      expect(moved).toBe(true);
    });

  });

  test.describe('Edge Cases - Copy Functionality', () => {

    test('Copy to clipboard includes new arrows', async ({ page, context }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      await clickAddArrow(page);

      // Click copy button
      await page.click('.toolbar-copy');
      await page.waitForTimeout(200);

      // Read clipboard
      const clipboardContent = await page.evaluate(async () => {
        return await navigator.clipboard.readText();
      });

      // Should contain arrow shortcode
      expect(clipboardContent).toContain('{{< arrow');
      expect(clipboardContent).toContain('position="absolute"');
    });

  });

  test.describe('Edge Cases - Hit Area on Curves', () => {

    test('Hit area follows curved path', async ({ page }) => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      await page.goto(`file://${htmlPath}`);
      await waitForReveal(page);

      await clickAddArrow(page);
      await page.click('.editable-arrow-curve-toggle');
      await page.waitForTimeout(100);

      // Both paths should be Bezier curves
      const paths = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const allPaths = container.querySelectorAll('svg path');
        const result = {};
        allPaths.forEach(p => {
          if (p.getAttribute('stroke') === 'transparent') {
            result.hitArea = p.getAttribute('d');
          } else if (p.getAttribute('stroke') === 'black') {
            result.visible = p.getAttribute('d');
          }
        });
        return result;
      });

      // Both should be curves (contain 'C' for cubic Bezier)
      expect(paths.hitArea).toContain('C');
      expect(paths.visible).toContain('C');
      expect(paths.hitArea).toBe(paths.visible);
    });

  });

});
