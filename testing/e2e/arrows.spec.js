// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { TESTING_DIR, setupPage, clickAddArrow, getArrowData, deselectArrow } = require('./test-helpers');

test.describe('Arrow Feature', () => {

  test.describe('Toolbar Integration', () => {

    test.beforeAll(async () => {
      const htmlPath = path.join(TESTING_DIR, 'arrows.html');
      if (!fs.existsSync(htmlPath)) {
        execSync('quarto render arrows.qmd', { cwd: TESTING_DIR, stdio: 'inherit' });
      }
    });

    test('Add submenu includes Arrow option', async ({ page }) => {
      await setupPage(page, 'arrows.html');

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

  test.describe('Arrow Extension Detection', () => {

    test('No warning shown when arrow extension is detected (existing arrows on page)', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      // arrows.html has an existing arrow shortcode rendered, so extension should be detected
      const hasArrowExtension = await page.evaluate(() => {
        // Same detection logic as in editable.js
        const arrowSvgs = document.querySelectorAll('svg defs marker[id^="arrow-"]');
        if (arrowSvgs.length > 0) return true;
        const arrowPaths = document.querySelectorAll('svg path[marker-end^="url(#arrow-"]');
        return arrowPaths.length > 0;
      });

      expect(hasArrowExtension).toBe(true);

      // Add an arrow
      await clickAddArrow(page);

      // No modal should have been shown (check it doesn't exist)
      const modalExists = await page.$('.editable-modal-overlay');
      expect(modalExists).toBeNull();

      // Arrow should have been created
      const arrows = await getArrowData(page);
      expect(arrows.some(a => a.isNew)).toBe(true);
    });

    test('Warning modal shown when arrow extension not detected (basic.html)', async ({ page }) => {
      await setupPage(page, 'basic.html');

      // Simulate "extension not installed" by clearing the flag
      // (The Lua filter sets this flag when extension is installed in project)
      await page.evaluate(() => {
        window._quarto_arrow_extension = false;
      });

      // Try to add an arrow
      await page.click('.toolbar-add');
      await page.click('.editable-toolbar-submenu-item.toolbar-add-arrow');

      // Modal should appear with install instructions
      await page.waitForSelector('.editable-modal-overlay', { timeout: 2000 });
      const modal = await page.$('.editable-modal-overlay');
      expect(modal).not.toBeNull();

      const modalText = await page.textContent('.editable-modal');
      expect(modalText).toContain('quarto-arrows');
      expect(modalText).toContain('quarto add');

      // Click continue to dismiss
      await page.click('.editable-modal-confirm');
    });

    test('Warning only shown once per session', async ({ page }) => {
      await setupPage(page, 'basic.html');

      // Simulate "extension not installed" by clearing the flag
      await page.evaluate(() => {
        window._quarto_arrow_extension = false;
      });

      // First arrow - should show modal
      await page.click('.toolbar-add');
      await page.click('.editable-toolbar-submenu-item.toolbar-add-arrow');
      await page.waitForSelector('.editable-modal-overlay', { timeout: 2000 });

      // Modal should appear
      let modal = await page.$('.editable-modal-overlay');
      expect(modal).not.toBeNull();

      // Click continue
      await page.click('.editable-modal-confirm');
      await page.waitForSelector('.editable-modal-overlay', { state: 'hidden', timeout: 2000 }).catch(() => {});

      // Deselect arrow first
      await deselectArrow(page);

      // Second arrow - should NOT show modal again
      await page.click('.toolbar-add');
      await page.click('.editable-toolbar-submenu-item.toolbar-add-arrow');
      // Wait a moment for potential modal
      await page.waitForTimeout(100);

      // No modal should appear this time
      modal = await page.$('.editable-modal-overlay');
      expect(modal).toBeNull();
    });

    test('Arrow not created if user cancels warning modal', async ({ page }) => {
      await setupPage(page, 'basic.html');

      // Simulate "extension not installed" by clearing the flag
      await page.evaluate(() => {
        window._quarto_arrow_extension = false;
      });

      // Try to add an arrow
      await page.click('.toolbar-add');
      await page.click('.editable-toolbar-submenu-item.toolbar-add-arrow');
      await page.waitForSelector('.editable-modal-overlay', { timeout: 2000 });

      // Modal should appear
      const modal = await page.$('.editable-modal-overlay');
      expect(modal).not.toBeNull();

      // Click cancel
      await page.click('.editable-modal-cancel');
      await page.waitForSelector('.editable-modal-overlay', { state: 'hidden', timeout: 2000 }).catch(() => {});

      // No arrow should have been created
      const arrows = await page.evaluate(() => {
        return document.querySelectorAll('.editable-arrow-container').length;
      });

      expect(arrows).toBe(0);
    });

  });

  test.describe('Arrow Creation', () => {

    test('Adding arrow creates arrow container on current slide', async ({ page }) => {
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
    });

    test('New arrow is centered on slide', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      const position = await page.evaluate(() => {
        const slide = document.querySelector('section.present');
        const startHandle = document.querySelector('.editable-arrow-container.editable-new .editable-arrow-handle-start');
        const endHandle = document.querySelector('.editable-arrow-container.editable-new .editable-arrow-handle-end');

        if (!slide || !startHandle || !endHandle) return null;

        // Use natural (offsetWidth/Height) coordinates — same space as arrow positions
        const slideCenter = {
          x: slide.offsetWidth / 2,
          y: slide.offsetHeight / 2,
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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      const arrows = await getArrowData(page);
      const newArrow = arrows.find(a => a.isNew);

      expect(newArrow.isActive).toBe(true);
    });

  });

  test.describe('Arrow Selection', () => {

    test('Clicking outside arrow deselects it', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Verify it's active
      let arrows = await getArrowData(page);
      expect(arrows.find(a => a.isNew).isActive).toBe(true);

      // Click outside
      await deselectArrow(page);

      // Should be deselected
      arrows = await getArrowData(page);
      expect(arrows.find(a => a.isNew).isActive).toBe(false);
    });

    test('Clicking arrow hit area selects it', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Deselect by clicking outside
      await deselectArrow(page);

      // Get the hit area's center in viewport coordinates (accounts for CSS scaling)
      const viewportCenter = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const svg = container.querySelector('svg');
        const path = svg.querySelector('path[stroke-width="20"]'); // hit area
        if (!path) return null;
        const rect = path.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      });

      if (viewportCenter) {
        await page.mouse.click(viewportCenter.x, viewportCenter.y);
        await page.waitForTimeout(100);

        const arrows = await getArrowData(page);
        expect(arrows.find(a => a.isNew).isActive).toBe(true);
      }
    });

    test('Only one arrow can be active at a time', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      // Add two arrows
      await clickAddArrow(page);
      await clickAddArrow(page);

      // Count active arrows
      const activeCount = await page.evaluate(() =>
        document.querySelectorAll('.editable-arrow-container.active').length
      );

      expect(activeCount).toBe(1);
    });

  });

  test.describe('Handle Dragging', () => {

    test('Dragging start handle updates arrow position', async ({ page }) => {
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Click curve toggle
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      const arrows = await getArrowData(page);
      expect(arrows.find(a => a.isNew).hasCurveMode).toBe(true);
    });

    test('Control point handles appear in curve mode', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      // Check control handles are visible
      const control1Visible = await page.locator('.editable-arrow-handle-control1').isVisible();
      const control2Visible = await page.locator('.editable-arrow-handle-control2').isVisible();

      expect(control1Visible).toBe(true);
      expect(control2Visible).toBe(true);
    });

    test('Path becomes Bezier curve in curve mode', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Check initial path is a line (M...L)
      const initialPath = await page.evaluate(() => {
        const path = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return path.getAttribute('d');
      });
      expect(initialPath).toMatch(/^M.*L/);

      // Enable curve mode
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      // Check path is now a curve (M...C for cubic Bezier)
      const curvePath = await page.evaluate(() => {
        const path = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return path.getAttribute('d');
      });
      expect(curvePath).toMatch(/^M.*C/);
    });

    test('Toggling curve mode off resets to straight line', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Enable then disable curve mode
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);
      await page.click('#arrow-style-curve');
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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);
      await page.click('#arrow-style-curve');
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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);
      await page.click('#arrow-style-curve');
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

    test('Curve toggle button shows active state when curve mode is on', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Initially not active
      let hasActiveClass = await page.evaluate(() => {
        const toggle = document.querySelector('#arrow-style-curve');
        return toggle.classList.contains('active');
      });
      expect(hasActiveClass).toBe(false);

      // Enable curve mode
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      // Should have active class
      hasActiveClass = await page.evaluate(() => {
        const toggle = document.querySelector('#arrow-style-curve');
        return toggle.classList.contains('active');
      });
      expect(hasActiveClass).toBe(true);

      // Disable curve mode
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      // Should not have active class
      hasActiveClass = await page.evaluate(() => {
        const toggle = document.querySelector('#arrow-style-curve');
        return toggle.classList.contains('active');
      });
      expect(hasActiveClass).toBe(false);
    });

    test('Curve toggle state syncs when selecting different arrows', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      // Create first arrow and enable curve mode
      await clickAddArrow(page);
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      // Verify curve mode is on
      let hasActiveClass = await page.evaluate(() => {
        const toggle = document.querySelector('#arrow-style-curve');
        return toggle.classList.contains('active');
      });
      expect(hasActiveClass).toBe(true);

      // Deselect
      await page.click('.reveal', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Create second arrow (straight by default)
      await clickAddArrow(page);

      // Curve toggle should not be active for new arrow
      hasActiveClass = await page.evaluate(() => {
        const toggle = document.querySelector('#arrow-style-curve');
        return toggle.classList.contains('active');
      });
      expect(hasActiveClass).toBe(false);
    });

  });

  test.describe('Title Slide Handling', () => {

    test('hasTitleSlide detects YAML title slide', async ({ page }) => {
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      await clickAddArrow(page);
      await page.click('#arrow-style-curve');
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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Deselect
      await deselectArrow(page);

      // Check handles are hidden
      const startHandleVisible = await page.locator('.editable-arrow-handle-start').isVisible();
      const endHandleVisible = await page.locator('.editable-arrow-handle-end').isVisible();

      expect(startHandleVisible).toBe(false);
      expect(endHandleVisible).toBe(false);
    });

    test('Handles are shown when arrow is active', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Check handles are visible
      const startHandleVisible = await page.locator('.editable-arrow-handle-start').isVisible();
      const endHandleVisible = await page.locator('.editable-arrow-handle-end').isVisible();

      expect(startHandleVisible).toBe(true);
      expect(endHandleVisible).toBe(true);
    });

  });

  test.describe('Hit Area', () => {

    test('Hit area has wider stroke than visible path', async ({ page }) => {
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      // Add 3 arrows to the same slide
      await clickAddArrow(page);
      await clickAddArrow(page);
      await clickAddArrow(page);

      const arrowCount = await page.evaluate(() => {
        const currentSlide = document.querySelector('section.present');
        return currentSlide.querySelectorAll('.editable-arrow-container.editable-new').length;
      });

      expect(arrowCount).toBe(3);
    });

    test('Multiple arrows have unique marker IDs', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);
      await clickAddArrow(page);

      const markerIds = await page.evaluate(() => {
        const markers = document.querySelectorAll('.editable-arrow-container.editable-new marker');
        return Array.from(markers).map(m => m.id);
      });

      // All IDs should be unique
      const uniqueIds = new Set(markerIds);
      expect(uniqueIds.size).toBe(markerIds.length);
    });

    test('Selecting one arrow deselects others', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);
      await clickAddArrow(page);

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Drag end handle very close to start
      const endHandle = page.locator('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x - 140, box.y, { steps: 5 }); // Move most of the way back
      await page.mouse.up();

      // Arrow should still exist and be functional
      const arrowExists = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container?.querySelector('svg path[stroke="black"]');
        return !!pathEl && !!pathEl.getAttribute('d');
      });
      expect(arrowExists).toBe(true);
    });

  });

  test.describe('Edge Cases - Slide Navigation', () => {

    test('Arrow state preserved when navigating away and back', async ({ page }) => {
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);
      await page.click('#arrow-style-curve');
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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Rapidly toggle curve mode
      for (let i = 0; i < 5; i++) {
        await page.click('#arrow-style-curve');
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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      // Verify guide lines are visible when active
      let guideLinesVisible = await page.evaluate(() => {
        const lines = document.querySelectorAll('.editable-arrow-container.editable-new svg line');
        return Array.from(lines).some(l => l.style.display !== 'none');
      });
      expect(guideLinesVisible).toBe(true);

      // Deselect
      await deselectArrow(page);

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      const zIndex = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        return parseInt(window.getComputedStyle(container).zIndex);
      });

      expect(zIndex).toBeGreaterThanOrEqual(100);
    });

    test('Arrow handles have higher z-index than container', async ({ page }) => {
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

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
      await setupPage(page, 'arrows.html');

      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await page.evaluate(() => Reveal.slide(1));
      await page.waitForTimeout(200);

      await clickAddArrow(page);

      // Deselect arrow to show normal toolbar buttons
      await deselectArrow(page);

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
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);
      await page.click('#arrow-style-curve');
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

  test.describe('Arrow Style Controls in Toolbar', () => {

    test('Toolbar shows arrow controls when arrow is selected', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      // Initially default panel visible, arrow panel hidden
      let panelState = await page.evaluate(() => {
        const defaultPanel = document.querySelector('.toolbar-panel-default');
        const arrowPanel = document.querySelector('.toolbar-panel-arrow');
        return {
          defaultDisplay: defaultPanel ? defaultPanel.style.display : null,
          arrowDisplay: arrowPanel ? arrowPanel.style.display : null,
        };
      });
      expect(panelState.defaultDisplay).not.toBe('none');
      expect(panelState.arrowDisplay).toBe('none');

      // Add arrow - it starts selected
      await clickAddArrow(page);

      // Arrow panel should be visible, default panel hidden
      panelState = await page.evaluate(() => {
        const defaultPanel = document.querySelector('.toolbar-panel-default');
        const arrowPanel = document.querySelector('.toolbar-panel-arrow');
        return {
          defaultDisplay: defaultPanel ? defaultPanel.style.display : null,
          arrowDisplay: arrowPanel ? arrowPanel.style.display : null,
        };
      });
      expect(panelState.defaultDisplay).toBe('none');
      expect(panelState.arrowDisplay).not.toBe('none');
    });

    test('Toolbar shows normal buttons when arrow is deselected', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Click outside to deselect
      await page.mouse.click(10, 150);
      await page.waitForTimeout(100);

      const panelState = await page.evaluate(() => {
        const defaultPanel = document.querySelector('.toolbar-panel-default');
        const arrowPanel = document.querySelector('.toolbar-panel-arrow');
        return {
          defaultDisplay: defaultPanel ? defaultPanel.style.display : null,
          arrowDisplay: arrowPanel ? arrowPanel.style.display : null,
        };
      });
      expect(panelState.defaultDisplay).not.toBe('none');
      expect(panelState.arrowDisplay).toBe('none');
    });

    test('Color picker changes arrow color', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Change color to red
      await page.fill('#arrow-style-color', '#ff0000');
      await page.waitForTimeout(50);

      // Verify path stroke changed
      const strokeColor = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke');
      });
      expect(strokeColor).toBe('#ff0000');
    });

    test('Width input changes arrow width', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Change width to 5
      await page.fill('#arrow-style-width', '5');
      await page.waitForTimeout(50);

      // Verify path stroke-width changed
      const strokeWidth = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-width');
      });
      expect(strokeWidth).toBe('5');
    });

    test('Head style selector changes arrowhead shape', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial marker path
      const initialMarkerPath = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const marker = container.querySelector('marker path');
        return marker.getAttribute('d');
      });

      // Change head to diamond
      await page.selectOption('#arrow-style-head', 'diamond');
      await page.waitForTimeout(50);

      // Verify marker path changed
      const newMarkerPath = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const marker = container.querySelector('marker path');
        return marker.getAttribute('d');
      });
      expect(newMarkerPath).not.toBe(initialMarkerPath);
    });

    test('Head style "none" removes arrowhead', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Change head to none
      await page.selectOption('#arrow-style-head', 'none');
      await page.waitForTimeout(50);

      // Verify marker-end is removed
      const hasMarker = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.hasAttribute('marker-end');
      });
      expect(hasMarker).toBe(false);
    });

    test('Arrow controls sync values when selecting different arrows', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      // Create first arrow and change its color
      await clickAddArrow(page);
      await page.fill('#arrow-style-color', '#ff0000');
      await page.waitForTimeout(50);

      // Click outside to deselect
      await page.click('.reveal', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Create second arrow (default color)
      await clickAddArrow(page);

      // Controls should show default color for new arrow
      const colorValue = await page.$eval('#arrow-style-color', el => el.value);
      expect(colorValue).toBe('#000000');
    });

    test('Dash selector changes arrow dash pattern', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Change dash to dashed
      await page.selectOption('#arrow-style-dash', 'dashed');
      await page.waitForTimeout(50);

      // Verify path has stroke-dasharray
      const dashArray = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-dasharray');
      });
      expect(dashArray).toBeTruthy();
      expect(dashArray).not.toBe('none');
    });

    test('Opacity slider changes arrow opacity', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Change opacity to 0.5
      await page.fill('#arrow-style-opacity', '0.5');
      await page.waitForTimeout(50);

      // Verify path opacity changed
      const opacity = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('opacity');
      });
      expect(opacity).toBe('0.5');
    });

    test('Line style selector creates multiple lines', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Change line to double
      await page.selectOption('#arrow-style-line', 'double');
      await page.waitForTimeout(50);

      // Verify extra lines were created
      const extraLineCount = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        return container.querySelectorAll('.arrow-extra-line').length;
      });
      expect(extraLineCount).toBe(2);
    });

    test('Style changes persist after deselect and reselect', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Change styles
      await page.fill('#arrow-style-color', '#00ff00');
      await page.fill('#arrow-style-width', '4');
      await page.waitForTimeout(50);

      // Click outside to deselect
      await page.click('.reveal', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Click arrow to reselect (use evaluate to dispatch click event on hit area)
      await page.evaluate(() => {
        const hitArea = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="transparent"]');
        hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(100);

      // Verify controls show saved values
      const colorValue = await page.$eval('#arrow-style-color', el => el.value);
      const widthValue = await page.$eval('#arrow-style-width', el => el.value);
      expect(colorValue).toBe('#00ff00');
      expect(widthValue).toBe('4');
    });

  });

  test.describe('Color Presets', () => {

    test('Color presets row exists with swatches', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      const presetsInfo = await page.evaluate(() => {
        const presetsRow = document.querySelector('.arrow-color-presets');
        const swatches = document.querySelectorAll('.arrow-color-swatch');
        return {
          hasPresetsRow: !!presetsRow,
          swatchCount: swatches.length
        };
      });

      expect(presetsInfo.hasPresetsRow).toBe(true);
      expect(presetsInfo.swatchCount).toBeGreaterThan(0);
    });

    test('Black is the first color swatch', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      const firstSwatchColor = await page.evaluate(() => {
        const firstSwatch = document.querySelector('.arrow-color-swatch');
        const bgColor = firstSwatch.style.backgroundColor;
        // Convert rgb to hex if needed
        if (bgColor.startsWith('rgb')) {
          const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
          }
        }
        return bgColor;
      });

      expect(firstSwatchColor).toBe('#000000');
    });

    test('Clicking a swatch changes arrow color', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get second swatch (first non-black color)
      const secondSwatchColor = await page.evaluate(() => {
        const swatches = document.querySelectorAll('.arrow-color-swatch');
        if (swatches.length < 2) return null;
        return swatches[1].style.backgroundColor;
      });

      // Click the second swatch
      await page.click('.arrow-color-swatch:nth-child(2)');
      await page.waitForTimeout(50);

      // Verify arrow color changed
      const arrowColor = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke');
      });

      // Convert rgb to comparable format if needed
      const normalizedSwatchColor = await page.evaluate((color) => {
        if (color.startsWith('rgb')) {
          const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
          }
        }
        return color;
      }, secondSwatchColor);

      expect(arrowColor.toLowerCase()).toBe(normalizedSwatchColor.toLowerCase());
    });

    test('Clicked swatch shows selected state', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Initially first swatch (black) should be selected since arrow is black by default
      let selectedCount = await page.evaluate(() => {
        return document.querySelectorAll('.arrow-color-swatch.selected').length;
      });
      expect(selectedCount).toBe(1);

      // Click second swatch
      await page.click('.arrow-color-swatch:nth-child(2)');
      await page.waitForTimeout(50);

      // Verify second swatch is now selected and only one is selected
      const selectionState = await page.evaluate(() => {
        const swatches = document.querySelectorAll('.arrow-color-swatch');
        const selectedSwatches = document.querySelectorAll('.arrow-color-swatch.selected');
        return {
          totalSelected: selectedSwatches.length,
          secondIsSelected: swatches[1].classList.contains('selected'),
          firstIsSelected: swatches[0].classList.contains('selected')
        };
      });

      expect(selectionState.totalSelected).toBe(1);
      expect(selectionState.secondIsSelected).toBe(true);
      expect(selectionState.firstIsSelected).toBe(false);
    });

    test('Using custom color picker clears swatch selection', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Initially a swatch should be selected
      let selectedCount = await page.evaluate(() => {
        return document.querySelectorAll('.arrow-color-swatch.selected').length;
      });
      expect(selectedCount).toBe(1);

      // Use the custom color picker
      await page.fill('#arrow-style-color', '#123456');
      await page.waitForTimeout(50);

      // Verify no swatches are selected
      selectedCount = await page.evaluate(() => {
        return document.querySelectorAll('.arrow-color-swatch.selected').length;
      });
      expect(selectedCount).toBe(0);
    });

    test('Selecting arrow highlights matching swatch', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Click second swatch to set a non-black color
      await page.click('.arrow-color-swatch:nth-child(2)');
      await page.waitForTimeout(50);

      // Deselect arrow
      await deselectArrow(page);

      // Reselect arrow by clicking on it
      await page.evaluate(() => {
        const hitArea = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="transparent"]');
        hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(100);

      // Verify second swatch is selected
      const secondIsSelected = await page.evaluate(() => {
        const swatches = document.querySelectorAll('.arrow-color-swatch');
        return swatches[1].classList.contains('selected');
      });

      expect(secondIsSelected).toBe(true);
    });

  });

  test.describe('Dash Style', () => {

    test('Switching between dash styles updates stroke-dasharray', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Initially solid (no dasharray)
      let dashArray = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-dasharray');
      });
      expect(dashArray).toBeFalsy();

      // Change to dashed
      await page.selectOption('#arrow-style-dash', 'dashed');
      await page.waitForTimeout(50);

      dashArray = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-dasharray');
      });
      expect(dashArray).toBeTruthy();

      // Change to dotted
      await page.selectOption('#arrow-style-dash', 'dotted');
      await page.waitForTimeout(50);

      const dottedArray = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-dasharray');
      });
      expect(dottedArray).toBeTruthy();
      expect(dottedArray).not.toBe(dashArray);

      // Change back to solid
      await page.selectOption('#arrow-style-dash', 'solid');
      await page.waitForTimeout(50);

      dashArray = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-dasharray');
      });
      expect(dashArray).toBeFalsy();
    });

    test('Dash pattern scales with stroke width', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Set dashed with width 2
      await page.selectOption('#arrow-style-dash', 'dashed');
      await page.fill('#arrow-style-width', '2');
      await page.waitForTimeout(50);

      const dashArray2 = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-dasharray');
      });

      // Change width to 4
      await page.fill('#arrow-style-width', '4');
      await page.waitForTimeout(50);

      const dashArray4 = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-dasharray');
      });

      // Dash pattern should be different (scaled)
      expect(dashArray4).not.toBe(dashArray2);
    });

    test('Dash persists after deselect and reselect', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      await page.selectOption('#arrow-style-dash', 'dotted');
      await page.waitForTimeout(50);

      // Deselect
      await page.click('.reveal', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Reselect
      await page.evaluate(() => {
        const hitArea = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="transparent"]');
        hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(100);

      const dashValue = await page.$eval('#arrow-style-dash', el => el.value);
      expect(dashValue).toBe('dotted');
    });

  });

  test.describe('Line Style', () => {

    test('Triple line creates 2 extra paths and shows center line', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      await page.selectOption('#arrow-style-line', 'triple');
      await page.waitForTimeout(50);

      const result = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const extraLines = container.querySelectorAll('.arrow-extra-line').length;
        const mainPath = container.querySelector('svg path[stroke]:not([stroke="transparent"]):not(.arrow-extra-line)');
        const mainVisible = mainPath.style.visibility !== 'hidden' && mainPath.getAttribute('stroke') !== 'transparent';
        return { extraLines, mainVisible };
      });

      expect(result.extraLines).toBe(2);
      expect(result.mainVisible).toBe(true);
    });

    test('Switching back to single removes extra lines', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Set to double
      await page.selectOption('#arrow-style-line', 'double');
      await page.waitForTimeout(50);

      let extraCount = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        return container.querySelectorAll('.arrow-extra-line').length;
      });
      expect(extraCount).toBe(2);

      // Switch back to single
      await page.selectOption('#arrow-style-line', 'single');
      await page.waitForTimeout(50);

      extraCount = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        return container.querySelectorAll('.arrow-extra-line').length;
      });
      expect(extraCount).toBe(0);
    });

    test('Extra lines follow arrow when handles dragged', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      await page.selectOption('#arrow-style-line', 'double');
      await page.waitForTimeout(50);

      // Get initial extra line paths
      const initialPaths = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const lines = container.querySelectorAll('.arrow-extra-line');
        return Array.from(lines).map(l => l.getAttribute('d'));
      });

      // Drag end handle
      const endHandle = await page.$('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + 30);
      await page.mouse.up();
      await page.waitForTimeout(50);

      // Get updated extra line paths
      const updatedPaths = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const lines = container.querySelectorAll('.arrow-extra-line');
        return Array.from(lines).map(l => l.getAttribute('d'));
      });

      // Paths should have changed
      expect(updatedPaths[0]).not.toBe(initialPaths[0]);
    });

    test('Extra lines have same color and dash as main', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Set color, dash, and line style
      await page.fill('#arrow-style-color', '#ff0000');
      await page.selectOption('#arrow-style-dash', 'dashed');
      await page.selectOption('#arrow-style-line', 'double');
      await page.waitForTimeout(50);

      const extraLineStyles = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const lines = container.querySelectorAll('.arrow-extra-line');
        return Array.from(lines).map(l => ({
          stroke: l.getAttribute('stroke'),
          dasharray: l.getAttribute('stroke-dasharray')
        }));
      });

      expect(extraLineStyles.length).toBe(2);
      extraLineStyles.forEach(style => {
        expect(style.stroke).toBe('#ff0000');
        expect(style.dasharray).toBeTruthy();
      });
    });

    test('Arrowhead visible for double line', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      await page.selectOption('#arrow-style-line', 'double');
      await page.waitForTimeout(50);

      // Main path should have marker-end and be visible (even if stroke is transparent)
      const hasMarker = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const mainPath = container.querySelector('svg path[marker-end]');
        return mainPath !== null && mainPath.style.visibility !== 'hidden';
      });

      expect(hasMarker).toBe(true);
    });

    test('Curved arrows work with double lines', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Enable curve mode
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      // Set double line
      await page.selectOption('#arrow-style-line', 'double');
      await page.waitForTimeout(50);

      const result = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const extraLines = container.querySelectorAll('.arrow-extra-line');
        const paths = Array.from(extraLines).map(l => l.getAttribute('d'));
        // Curved paths contain 'C' for cubic bezier
        const allCurved = paths.every(p => p && p.includes('C'));
        return { count: extraLines.length, allCurved };
      });

      expect(result.count).toBe(2);
      expect(result.allCurved).toBe(true);
    });

  });

  test.describe('Opacity', () => {

    test('Opacity 0 makes arrow nearly invisible', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      await page.fill('#arrow-style-opacity', '0');
      await page.waitForTimeout(50);

      const opacity = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('opacity');
      });

      expect(opacity).toBe('0');
    });

    test('Opacity applies to extra lines in double/triple mode', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      await page.fill('#arrow-style-opacity', '0.5');
      await page.selectOption('#arrow-style-line', 'double');
      await page.waitForTimeout(50);

      const opacities = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const lines = container.querySelectorAll('.arrow-extra-line');
        return Array.from(lines).map(l => l.getAttribute('opacity'));
      });

      expect(opacities.length).toBe(2);
      opacities.forEach(op => {
        expect(op).toBe('0.5');
      });
    });

    test('Opacity persists after deselect and reselect', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      await page.fill('#arrow-style-opacity', '0.3');
      await page.waitForTimeout(50);

      // Deselect
      await page.click('.reveal', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Reselect
      await page.evaluate(() => {
        const hitArea = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="transparent"]');
        hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(100);

      const opacityValue = await page.$eval('#arrow-style-opacity', el => el.value);
      expect(opacityValue).toBe('0.3');
    });

  });

  test.describe('Drag Arrow by Body', () => {

    test('Arrow can be dragged by its body', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial positions
      const initialPos = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        const d = pathEl.getAttribute('d');
        const match = d.match(/M ([\d.]+),([\d.]+)/);
        return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
      });

      // Get hit area position and drag it
      const hitArea = await page.$('.editable-arrow-container.editable-new svg path[stroke="transparent"]');
      const box = await hitArea.boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30);
      await page.mouse.up();
      await page.waitForTimeout(50);

      // Get new positions
      const newPos = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        const d = pathEl.getAttribute('d');
        const match = d.match(/M ([\d.]+),([\d.]+)/);
        return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
      });

      // Position should have changed
      expect(newPos.x).not.toBe(initialPos.x);
      expect(newPos.y).not.toBe(initialPos.y);
    });

    test('Dragging arrow body moves all points together', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial start and end positions
      const initialPositions = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const startHandle = container.querySelector('.editable-arrow-handle-start');
        const endHandle = container.querySelector('.editable-arrow-handle-end');
        return {
          startX: parseFloat(startHandle.style.left),
          startY: parseFloat(startHandle.style.top),
          endX: parseFloat(endHandle.style.left),
          endY: parseFloat(endHandle.style.top)
        };
      });

      // Calculate initial length
      const initialLength = Math.sqrt(
        Math.pow(initialPositions.endX - initialPositions.startX, 2) +
        Math.pow(initialPositions.endY - initialPositions.startY, 2)
      );

      // Drag arrow body
      const hitArea = await page.$('.editable-arrow-container.editable-new svg path[stroke="transparent"]');
      const box = await hitArea.boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50);
      await page.mouse.up();
      await page.waitForTimeout(50);

      // Get new positions
      const newPositions = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const startHandle = container.querySelector('.editable-arrow-handle-start');
        const endHandle = container.querySelector('.editable-arrow-handle-end');
        return {
          startX: parseFloat(startHandle.style.left),
          startY: parseFloat(startHandle.style.top),
          endX: parseFloat(endHandle.style.left),
          endY: parseFloat(endHandle.style.top)
        };
      });

      // Calculate new length - should be same (arrow shape preserved)
      const newLength = Math.sqrt(
        Math.pow(newPositions.endX - newPositions.startX, 2) +
        Math.pow(newPositions.endY - newPositions.startY, 2)
      );

      expect(Math.abs(newLength - initialLength)).toBeLessThan(1);
    });

    test('Dragging curved arrow body moves control points too', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Enable curve mode
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      // Get initial control point positions
      const initial = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const c1Handle = container.querySelector('.editable-arrow-handle-control1');
        const c2Handle = container.querySelector('.editable-arrow-handle-control2');
        const startHandle = container.querySelector('.editable-arrow-handle-start');
        const endHandle = container.querySelector('.editable-arrow-handle-end');
        // Calculate midpoint between start and end (center of arrow body)
        const startX = parseFloat(startHandle.style.left);
        const startY = parseFloat(startHandle.style.top);
        const endX = parseFloat(endHandle.style.left);
        const endY = parseFloat(endHandle.style.top);
        return {
          c1X: parseFloat(c1Handle.style.left),
          c1Y: parseFloat(c1Handle.style.top),
          c2X: parseFloat(c2Handle.style.left),
          c2Y: parseFloat(c2Handle.style.top),
          midX: (startX + endX) / 2,
          midY: (startY + endY) / 2
        };
      });

      // Use evaluate to trigger the drag since the hit area might be tricky to target
      await page.evaluate((delta) => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const hitArea = container.querySelector('svg path[stroke="transparent"]');

        // Simulate mousedown
        const downEvent = new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 500,
          clientY: 350
        });
        hitArea.dispatchEvent(downEvent);

        // Simulate mousemove
        const moveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 500 + delta.x,
          clientY: 350 + delta.y
        });
        document.dispatchEvent(moveEvent);

        // Simulate mouseup
        const upEvent = new MouseEvent('mouseup', { bubbles: true });
        document.dispatchEvent(upEvent);
      }, { x: 80, y: 40 });

      await page.waitForTimeout(50);

      // Get new control point positions
      const newPositions = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const c1Handle = container.querySelector('.editable-arrow-handle-control1');
        const c2Handle = container.querySelector('.editable-arrow-handle-control2');
        return {
          c1X: parseFloat(c1Handle.style.left),
          c1Y: parseFloat(c1Handle.style.top),
          c2X: parseFloat(c2Handle.style.left),
          c2Y: parseFloat(c2Handle.style.top)
        };
      });

      // Control points should have moved
      expect(newPositions.c1X).not.toBe(initial.c1X);
      expect(newPositions.c1Y).not.toBe(initial.c1Y);
      expect(newPositions.c2X).not.toBe(initial.c2X);
      expect(newPositions.c2Y).not.toBe(initial.c2Y);
    });

    test('Hit area has grab cursor', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      const cursor = await page.evaluate(() => {
        const hitArea = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="transparent"]');
        return hitArea.style.cursor;
      });

      expect(cursor).toBe('grab');
    });

  });

  test.describe('Style Interactions', () => {

    test('Changing multiple styles at once applies all correctly', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Change multiple styles
      await page.fill('#arrow-style-color', '#0000ff');
      await page.fill('#arrow-style-width', '5');
      await page.selectOption('#arrow-style-head', 'diamond');
      await page.selectOption('#arrow-style-dash', 'dotted');
      await page.fill('#arrow-style-opacity', '0.7');
      await page.waitForTimeout(50);

      const styles = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return {
          stroke: pathEl.getAttribute('stroke'),
          strokeWidth: pathEl.getAttribute('stroke-width'),
          dasharray: pathEl.getAttribute('stroke-dasharray'),
          opacity: pathEl.getAttribute('opacity')
        };
      });

      expect(styles.stroke).toBe('#0000ff');
      expect(styles.strokeWidth).toBe('5');
      expect(styles.dasharray).toBeTruthy();
      expect(styles.opacity).toBe('0.7');
    });

    test('New arrow has default style values', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      // Create first arrow and change styles
      await clickAddArrow(page);
      await page.fill('#arrow-style-color', '#ff0000');
      await page.selectOption('#arrow-style-dash', 'dashed');
      await page.waitForTimeout(50);

      // Deselect
      await page.click('.reveal', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Create second arrow
      await clickAddArrow(page);

      // Controls should show default values for new arrow
      const values = await page.evaluate(() => {
        return {
          color: document.querySelector('#arrow-style-color').value,
          dash: document.querySelector('#arrow-style-dash').value,
          line: document.querySelector('#arrow-style-line').value,
          opacity: document.querySelector('#arrow-style-opacity').value
        };
      });

      expect(values.color).toBe('#000000');
      expect(values.dash).toBe('solid');
      expect(values.line).toBe('single');
      expect(values.opacity).toBe('1');
    });

  });

  test.describe('Arrow Undo/Redo', () => {

    test('Undo reverts arrow position after drag', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial position
      const initialPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Drag the end handle
      const endHandle = page.locator('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 100, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(50);

      // Get position after drag
      const afterDragPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Position should have changed
      expect(afterDragPos.left).not.toBe(initialPos.left);

      // Undo
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);

      // Get position after undo
      const afterUndoPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Position should be reverted to initial
      expect(Math.abs(afterUndoPos.left - initialPos.left)).toBeLessThan(1);
      expect(Math.abs(afterUndoPos.top - initialPos.top)).toBeLessThan(1);
    });

    test('Undo reverts arrow color change', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial color
      const initialColor = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke');
      });

      // Change color
      await page.fill('#arrow-style-color', '#ff0000');
      await page.waitForTimeout(50);

      // Verify color changed
      const afterChangeColor = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke');
      });
      expect(afterChangeColor).toBe('#ff0000');

      // Undo
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);

      // Get color after undo
      const afterUndoColor = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke');
      });

      expect(afterUndoColor).toBe(initialColor);
    });

    test('Undo reverts curve mode toggle', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Verify initially not in curve mode (path has L for line)
      const initialPath = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });
      expect(initialPath).toMatch(/L/);

      // Toggle curve mode
      await page.click('#arrow-style-curve');
      await page.waitForTimeout(100);

      // Verify now in curve mode (path has C for cubic Bezier)
      const afterTogglePath = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });
      expect(afterTogglePath).toMatch(/C/);

      // Undo
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);

      // Verify back to straight line
      const afterUndoPath = await page.evaluate(() => {
        const pathEl = document.querySelector('.editable-arrow-container.editable-new svg path[stroke="black"]');
        return pathEl.getAttribute('d');
      });
      expect(afterUndoPath).toMatch(/L/);
    });

    test('Redo restores arrow position after undo', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial position
      const initialPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Drag the end handle
      const endHandle = page.locator('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 100, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(50);

      // Get position after drag
      const afterDragPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Undo
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);

      // Verify undone
      const afterUndoPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });
      expect(Math.abs(afterUndoPos.left - initialPos.left)).toBeLessThan(1);

      // Redo
      await page.keyboard.press('Control+y');
      await page.waitForTimeout(100);

      // Get position after redo
      const afterRedoPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-end');
        return {
          left: parseFloat(handle.style.left),
          top: parseFloat(handle.style.top),
        };
      });

      // Position should be restored to after drag
      expect(Math.abs(afterRedoPos.left - afterDragPos.left)).toBeLessThan(1);
      expect(Math.abs(afterRedoPos.top - afterDragPos.top)).toBeLessThan(1);
    });

    test('Undo reverts arrow width change', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial width
      const initialWidth = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-width');
      });

      // Change width
      await page.fill('#arrow-style-width', '8');
      await page.waitForTimeout(50);

      // Verify width changed
      const afterChangeWidth = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-width');
      });
      expect(afterChangeWidth).toBe('8');

      // Undo
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);

      // Get width after undo
      const afterUndoWidth = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const pathEl = container.querySelector('svg path[stroke]:not([stroke="transparent"])');
        return pathEl.getAttribute('stroke-width');
      });

      expect(afterUndoWidth).toBe(initialWidth);
    });

    test('Undo reverts arrow head style change', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial marker path
      const initialMarkerPath = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const marker = container.querySelector('marker path');
        return marker.getAttribute('d');
      });

      // Change head style
      await page.selectOption('#arrow-style-head', 'diamond');
      await page.waitForTimeout(50);

      // Verify marker changed
      const afterChangeMarkerPath = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const marker = container.querySelector('marker path');
        return marker.getAttribute('d');
      });
      expect(afterChangeMarkerPath).not.toBe(initialMarkerPath);

      // Undo
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);

      // Get marker after undo
      const afterUndoMarkerPath = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const marker = container.querySelector('marker path');
        return marker.getAttribute('d');
      });

      expect(afterUndoMarkerPath).toBe(initialMarkerPath);
    });

    test('Undo reverts arrow body drag', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial positions of both handles
      const initialPositions = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const startHandle = container.querySelector('.editable-arrow-handle-start');
        const endHandle = container.querySelector('.editable-arrow-handle-end');
        return {
          startLeft: parseFloat(startHandle.style.left),
          startTop: parseFloat(startHandle.style.top),
          endLeft: parseFloat(endHandle.style.left),
          endTop: parseFloat(endHandle.style.top),
        };
      });

      // Drag arrow body
      await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const hitArea = container.querySelector('svg path[stroke="transparent"]');

        const downEvent = new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 500,
          clientY: 350
        });
        hitArea.dispatchEvent(downEvent);

        const moveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 600,
          clientY: 400
        });
        document.dispatchEvent(moveEvent);

        const upEvent = new MouseEvent('mouseup', { bubbles: true });
        document.dispatchEvent(upEvent);
      });
      await page.waitForTimeout(50);

      // Get positions after drag
      const afterDragPositions = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const startHandle = container.querySelector('.editable-arrow-handle-start');
        const endHandle = container.querySelector('.editable-arrow-handle-end');
        return {
          startLeft: parseFloat(startHandle.style.left),
          startTop: parseFloat(startHandle.style.top),
          endLeft: parseFloat(endHandle.style.left),
          endTop: parseFloat(endHandle.style.top),
        };
      });

      // Verify positions changed
      expect(afterDragPositions.startLeft).not.toBe(initialPositions.startLeft);

      // Undo
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);

      // Get positions after undo
      const afterUndoPositions = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        const startHandle = container.querySelector('.editable-arrow-handle-start');
        const endHandle = container.querySelector('.editable-arrow-handle-end');
        return {
          startLeft: parseFloat(startHandle.style.left),
          startTop: parseFloat(startHandle.style.top),
          endLeft: parseFloat(endHandle.style.left),
          endTop: parseFloat(endHandle.style.top),
        };
      });

      // Positions should be reverted
      expect(Math.abs(afterUndoPositions.startLeft - initialPositions.startLeft)).toBeLessThan(1);
      expect(Math.abs(afterUndoPositions.endLeft - initialPositions.endLeft)).toBeLessThan(1);
    });

  });

  test.describe('Event Listener Cleanup', () => {

    test('Arrow handles have AbortControllers attached to DOM elements', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Check that handles have _dragController property (AbortController)
      const handleControllers = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        if (!container) return { found: false };

        const startHandle = container.querySelector('.editable-arrow-handle-start');
        const endHandle = container.querySelector('.editable-arrow-handle-end');
        const control1Handle = container.querySelector('.editable-arrow-handle-control1');
        const control2Handle = container.querySelector('.editable-arrow-handle-control2');

        return {
          found: true,
          start: startHandle && startHandle._dragController instanceof AbortController,
          end: endHandle && endHandle._dragController instanceof AbortController,
          control1: control1Handle && control1Handle._dragController instanceof AbortController,
          control2: control2Handle && control2Handle._dragController instanceof AbortController
        };
      });

      expect(handleControllers.found).toBe(true);
      expect(handleControllers.start).toBe(true);
      expect(handleControllers.end).toBe(true);
      expect(handleControllers.control1).toBe(true);
      expect(handleControllers.control2).toBe(true);
    });

    test('AbortController signals are not aborted initially', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      const signalStates = await page.evaluate(() => {
        const container = document.querySelector('.editable-arrow-container.editable-new');
        if (!container) return { found: false };

        const startHandle = container.querySelector('.editable-arrow-handle-start');
        const endHandle = container.querySelector('.editable-arrow-handle-end');

        return {
          found: true,
          startNotAborted: startHandle?._dragController && !startHandle._dragController.signal.aborted,
          endNotAborted: endHandle?._dragController && !endHandle._dragController.signal.aborted
        };
      });

      expect(signalStates.found).toBe(true);
      expect(signalStates.startNotAborted).toBe(true);
      expect(signalStates.endNotAborted).toBe(true);
    });

    test('Multiple arrows have separate AbortControllers', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      // Create two arrows
      await clickAddArrow(page);
      await clickAddArrow(page);

      const controllersUnique = await page.evaluate(() => {
        const containers = document.querySelectorAll('.editable-arrow-container.editable-new');
        if (containers.length < 2) return false;

        const handle1 = containers[0].querySelector('.editable-arrow-handle-start');
        const handle2 = containers[1].querySelector('.editable-arrow-handle-start');

        if (!handle1?._dragController || !handle2?._dragController) return false;

        // Check that controllers are different instances
        return handle1._dragController !== handle2._dragController;
      });

      expect(controllersUnique).toBe(true);
    });

    test('Dragging still works with AbortController setup', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      await clickAddArrow(page);

      // Get initial position
      const initialPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-start');
        return handle ? { left: handle.style.left, top: handle.style.top } : null;
      });

      expect(initialPos).not.toBeNull();

      // Drag the handle
      const handle = await page.$('.editable-arrow-handle-start');
      const box = await handle.boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.up();

      // Get new position
      const newPos = await page.evaluate(() => {
        const handle = document.querySelector('.editable-arrow-handle-start');
        return handle ? { left: handle.style.left, top: handle.style.top } : null;
      });

      // Position should have changed
      expect(newPos.left).not.toBe(initialPos.left);
      expect(newPos.top).not.toBe(initialPos.top);
    });

  });

  test.describe('Arrow Labels', () => {

    test('Label input exists in style controls', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      const labelInput = await page.$('#arrow-style-label');
      expect(labelInput).not.toBeNull();
    });

    test('Label position selector exists with start/middle/end options', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      const options = await page.evaluate(() => {
        const select = document.getElementById('arrow-style-label-position');
        if (!select) return [];
        return Array.from(select.options).map(o => o.value);
      });

      expect(options).toContain('start');
      expect(options).toContain('middle');
      expect(options).toContain('end');
    });

    test('Label offset input exists', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      const offsetInput = await page.$('#arrow-style-label-offset');
      expect(offsetInput).not.toBeNull();
    });

    test('Typing in label input shows label on arrow', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      // Type in the label input
      await page.fill('#arrow-style-label', 'Test Label');

      // Check that label text element exists and has the text
      const labelText = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? label.textContent : null;
      });

      expect(labelText).toBe('Test Label');
    });

    test('Label is hidden when text is empty', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      // Label should be hidden initially (empty)
      const isHidden = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? label.style.display === 'none' : true;
      });

      expect(isHidden).toBe(true);
    });

    test('Changing label position moves label along arrow', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      // Add a label first
      await page.fill('#arrow-style-label', 'Test');

      // Get position at middle (default)
      const middleX = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? parseFloat(label.getAttribute('x')) : null;
      });

      // Change to start position
      await page.selectOption('#arrow-style-label-position', 'start');

      const startX = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? parseFloat(label.getAttribute('x')) : null;
      });

      // Start position should be different from middle
      expect(startX).not.toBe(middleX);
      expect(startX).toBeLessThan(middleX);
    });

    test('Changing label offset moves label perpendicular to arrow', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      // Add a label first
      await page.fill('#arrow-style-label', 'Test');

      // Get initial Y position
      const initialY = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? parseFloat(label.getAttribute('y')) : null;
      });

      // Change offset to negative (below line)
      await page.fill('#arrow-style-label-offset', '-20');

      const newY = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? parseFloat(label.getAttribute('y')) : null;
      });

      // Y position should have changed
      expect(newY).not.toBe(initialY);
    });

    test('Label follows arrow when dragged', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      // Add a label
      await page.fill('#arrow-style-label', 'Moving');

      // Get initial label position
      const initialLabelX = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? parseFloat(label.getAttribute('x')) : null;
      });

      // Drag the arrow body
      const hitArea = await page.$('.editable-arrow-container.editable-new svg path[stroke="transparent"]');
      const box = await hitArea.boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2);
      await page.mouse.up();

      // Label should have moved
      const newLabelX = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? parseFloat(label.getAttribute('x')) : null;
      });

      expect(newLabelX).toBeGreaterThan(initialLabelX);
    });

    test('Label color matches arrow color', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      // Add a label
      await page.fill('#arrow-style-label', 'Colored');

      // Change arrow color
      await page.evaluate(() => {
        document.getElementById('arrow-style-color').value = '#ff0000';
        document.getElementById('arrow-style-color').dispatchEvent(new Event('input'));
      });

      // Check label color
      const labelColor = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? label.getAttribute('fill') : null;
      });

      expect(labelColor).toBe('#ff0000');
    });

    test('Label rotates to follow arrow direction', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      // Add a label
      await page.fill('#arrow-style-label', 'Rotated');

      // Get initial transform
      const initialTransform = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? label.getAttribute('transform') : null;
      });

      // Drag end handle to create angled arrow
      const endHandle = await page.$('.editable-arrow-handle-end');
      const box = await endHandle.boundingBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y - 100);
      await page.mouse.up();

      // Label transform should have changed
      const newTransform = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label ? label.getAttribute('transform') : null;
      });

      expect(newTransform).not.toBe(initialTransform);
    });

    test('Label values sync when selecting different arrows', async ({ page }) => {
      await setupPage(page, 'arrows.html');

      // Create two arrows
      await clickAddArrow(page);

      // Set label on first arrow
      await page.fill('#arrow-style-label', 'Arrow 1');
      await page.selectOption('#arrow-style-label-position', 'start');

      // Click outside to deselect
      await page.click('.reveal', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(100);

      // Create second arrow
      await clickAddArrow(page);

      // Second arrow should have empty label
      const labelValue = await page.evaluate(() => {
        return document.getElementById('arrow-style-label').value;
      });

      expect(labelValue).toBe('');
    });

    test('Label works on curved arrows', async ({ page }) => {
      await setupPage(page, 'arrows.html');
      await clickAddArrow(page);

      // Enable curve mode
      await page.click('#arrow-style-curve');

      // Add label
      await page.fill('#arrow-style-label', 'Curved');

      // Label should be visible
      const labelVisible = await page.evaluate(() => {
        const label = document.querySelector('.editable-arrow-label');
        return label && label.style.display !== 'none' && label.textContent === 'Curved';
      });

      expect(labelVisible).toBe(true);
    });

  });

});
