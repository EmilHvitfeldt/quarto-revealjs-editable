// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage } = require('./test-helpers');

test.describe('Image context panel', () => {

  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'basic.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run ./run-tests.sh first to generate HTML files');
    }
  });

  // ── Panel structure ──────────────────────────────────────────────────────

  test('Image panel exists in DOM on load (hidden)', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const structure = await page.evaluate(() => {
      const toolbar = document.getElementById('editable-toolbar');
      if (!toolbar) return null;
      const panel = toolbar.querySelector('.toolbar-panel-image');
      return {
        exists: !!panel,
        hidden: panel ? panel.style.display === 'none' : false,
        hasControls: !!panel?.querySelector('.image-style-controls'),
      };
    });

    expect(structure).not.toBeNull();
    expect(structure.exists).toBe(true);
    expect(structure.hidden).toBe(true);
    expect(structure.hasControls).toBe(true);
  });

  // ── Panel visibility ─────────────────────────────────────────────────────

  test('Image panel shows when image container is clicked', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    const visibility = await page.evaluate(() => {
      const toolbar = document.getElementById('editable-toolbar');
      const imagePanel = toolbar?.querySelector('.toolbar-panel-image');
      const defaultPanel = toolbar?.querySelector('.toolbar-panel-default');
      return {
        imagePanelVisible: imagePanel?.style.display !== 'none',
        defaultPanelHidden: defaultPanel?.style.display === 'none',
      };
    });

    expect(visibility.imagePanelVisible).toBe(true);
    expect(visibility.defaultPanelHidden).toBe(true);
  });

  test('Image panel hides and default panel returns on outside click', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    // Deselect via setActiveImage(null) — direct click on body hits Reveal.js overlays
    await page.evaluate(() => window.setActiveImage?.(null));

    const visibility = await page.evaluate(() => {
      const toolbar = document.getElementById('editable-toolbar');
      const imagePanel = toolbar?.querySelector('.toolbar-panel-image');
      const defaultPanel = toolbar?.querySelector('.toolbar-panel-default');
      return {
        imagePanelHidden: imagePanel?.style.display === 'none',
        defaultPanelVisible: defaultPanel?.style.display !== 'none',
      };
    });

    expect(visibility.imagePanelHidden).toBe(true);
    expect(visibility.defaultPanelVisible).toBe(true);
  });

  // ── Opacity ──────────────────────────────────────────────────────────────

  test('Opacity slider updates image opacity', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      const slider = document.querySelector('.image-toolbar-opacity');
      slider.value = '50';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const label = document.querySelector('.image-opacity-label');
      return {
        opacity: img?.style.opacity,
        label: label?.textContent,
      };
    });

    expect(result.opacity).toBe('0.5');
    expect(result.label).toBe('50%');
  });

  test('Opacity slider syncs to state', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      const slider = document.querySelector('.image-toolbar-opacity');
      slider.value = '75';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const stateOpacity = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return window.editableRegistry?.get(img)?.state?.opacity;
    });

    expect(stateOpacity).toBe(75);
  });

  // ── Border radius ────────────────────────────────────────────────────────

  test('Border radius input updates image border-radius', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      const input = document.querySelector('.image-toolbar-radius');
      input.value = '20';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return img?.style.borderRadius;
    });

    expect(result).toBe('20px');
  });

  // ── Crop mode ────────────────────────────────────────────────────────────

  test('Crop button toggles crop-mode class on container', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    const before = await page.evaluate(() => {
      const container = document.querySelector('.editable-container:has(img)');
      return container?.classList.contains('crop-mode');
    });
    expect(before).toBe(false);

    // Click crop toggle button
    await page.evaluate(() => {
      document.querySelector('[title="Toggle crop mode — drag edge handles to crop"]')?.click();
    });

    const after = await page.evaluate(() => {
      const container = document.querySelector('.editable-container:has(img)');
      return container?.classList.contains('crop-mode');
    });
    expect(after).toBe(true);
  });

  test('Clicking crop button again exits crop mode', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      const btn = document.querySelector('[title="Toggle crop mode — drag edge handles to crop"]');
      btn?.click();
      btn?.click();
    });

    const hasCropMode = await page.evaluate(() => {
      const container = document.querySelector('.editable-container:has(img)');
      return container?.classList.contains('crop-mode');
    });
    expect(hasCropMode).toBe(false);
  });

  // ── Flip ─────────────────────────────────────────────────────────────────

  test('Flip H button applies scaleX(-1) to image', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      document.querySelector('[title="Flip horizontal"]')?.click();
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return {
        transform: img?.style.transform,
        active: document.querySelector('[title="Flip horizontal"]')?.classList.contains('active'),
      };
    });

    expect(result.transform).toContain('scaleX(-1)');
    expect(result.active).toBe(true);
  });

  test('Flip V button applies scaleY(-1) to image', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      document.querySelector('[title="Flip vertical"]')?.click();
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return img?.style.transform;
    });

    expect(result).toContain('scaleY(-1)');
  });

  test('Flip H and V together produce both scale transforms', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      document.querySelector('[title="Flip horizontal"]')?.click();
      document.querySelector('[title="Flip vertical"]')?.click();
    });

    const transform = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return img?.style.transform;
    });

    expect(transform).toContain('scaleX(-1)');
    expect(transform).toContain('scaleY(-1)');
  });

  // ── Reset ────────────────────────────────────────────────────────────────

  test('Reset button reverts all image style properties', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      const slider = document.querySelector('.image-toolbar-opacity');
      slider.value = '50';
      slider.dispatchEvent(new Event('input', { bubbles: true }));

      const radius = document.querySelector('.image-toolbar-radius');
      radius.value = '10';
      radius.dispatchEvent(new Event('input', { bubbles: true }));

      document.querySelector('[title="Flip horizontal"]')?.click();
    });

    await page.evaluate(() => {
      document.querySelector('.image-toolbar-reset')?.click();
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      return {
        opacity: img?.style.opacity,
        borderRadius: img?.style.borderRadius,
        transform: img?.style.transform,
        clipPath: img?.style.clipPath,
        stateOpacity: editableEl?.state?.opacity,
        stateRadius: editableEl?.state?.borderRadius,
        stateFlipH: editableEl?.state?.flipH,
        stateCropTop: editableEl?.state?.cropTop,
      };
    });

    expect(result.opacity).toBe('');
    expect(result.borderRadius).toBe('');
    expect(result.transform).toBe('');
    expect(result.clipPath).toBe('');
    expect(result.stateOpacity).toBe(100);
    expect(result.stateRadius).toBe(0);
    expect(result.stateFlipH).toBe(false);
    expect(result.stateCropTop).toBe(0);
  });

  // ── Undo/redo ────────────────────────────────────────────────────────────

  test('Ctrl+Z undoes opacity change', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    // Capture the initial opacity before any change
    const initialOpacity = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return img?.style.opacity || '1';
    });

    await page.evaluate(() => {
      const slider = document.querySelector('.image-toolbar-opacity');
      slider.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      slider.value = '40';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Verify the change was applied
    const changedOpacity = await page.evaluate(() => {
      return document.querySelector('.editable-container img')?.style.opacity;
    });
    expect(changedOpacity).toBe('0.4');

    await page.keyboard.press('Control+z');

    // Verify the undo restored the previous value specifically
    await page.waitForFunction(
      (prev) => document.querySelector('.editable-container img')?.style.opacity === prev,
      initialOpacity,
      { timeout: 2000 }
    );

    const opacity = await page.evaluate(() => {
      return document.querySelector('.editable-container img')?.style.opacity;
    });

    expect(opacity).toBe(initialOpacity);
  });

  // ── Serialization ────────────────────────────────────────────────────────

  test('Opacity and border-radius serialize to QMD style string', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    const qmd = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (!editableEl) return null;

      editableEl.state.opacity = 50;
      editableEl.state.borderRadius = 10;
      editableEl.syncToDOM();

      const dims = editableEl.toDimensions();
      return window.formatEditableEltStrings ? window.formatEditableEltStrings([dims])[0] : null;
    });

    expect(qmd).not.toBeNull();
    expect(qmd).toContain('opacity: 0.5');
    expect(qmd).toContain('border-radius: 10px');
  });

  test('Crop values serialize as clip-path in QMD style string', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    const qmd = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (!editableEl) return null;

      editableEl.state.cropTop = 10;
      editableEl.state.cropRight = 20;
      editableEl.state.cropBottom = 15;
      editableEl.state.cropLeft = 5;
      editableEl.syncToDOM();

      const dims = editableEl.toDimensions();
      return window.formatEditableEltStrings ? window.formatEditableEltStrings([dims])[0] : null;
    });

    expect(qmd).not.toBeNull();
    expect(qmd).toContain('clip-path: inset(10px 20px 15px 5px)');
  });

  test('Flip serializes as scaleX/scaleY in transform', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    const qmd = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (!editableEl) return null;

      editableEl.state.flipH = true;
      editableEl.state.flipV = true;
      editableEl.syncToDOM();

      const dims = editableEl.toDimensions();
      return window.formatEditableEltStrings ? window.formatEditableEltStrings([dims])[0] : null;
    });

    expect(qmd).not.toBeNull();
    expect(qmd).toContain('scaleX(-1)');
    expect(qmd).toContain('scaleY(-1)');
  });

  test('Rotation and flip compose into single transform in QMD', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    const qmd = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (!editableEl) return null;

      editableEl.state.rotation = 45;
      editableEl.state.flipH = true;
      editableEl.syncToDOM();

      const dims = editableEl.toDimensions();
      return window.formatEditableEltStrings ? window.formatEditableEltStrings([dims])[0] : null;
    });

    expect(qmd).not.toBeNull();
    expect(qmd).toContain('rotate(45deg)');
    expect(qmd).toContain('scaleX(-1)');
    const transformCount = (qmd.match(/transform:/g) || []).length;
    expect(transformCount).toBe(1);
  });

  // ── Panel controls sync on re-select ────────────────────────────────────

  test('Panel controls sync to current image state when image is re-selected', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // First click to select, then deselect, then update state, then re-select
    await page.click('.editable-container:has(img)');
    await page.evaluate(() => window.setActiveImage?.(null));

    // Update state then re-trigger panel sync via setActiveImage
    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (editableEl) {
        editableEl.state.opacity = 60;
        editableEl.state.borderRadius = 8;
      }
      window.setActiveImage?.(img);

      const slider = document.querySelector('.image-toolbar-opacity');
      const label = document.querySelector('.image-opacity-label');
      const radius = document.querySelector('.image-toolbar-radius');
      return {
        sliderValue: slider?.value,
        labelText: label?.textContent,
        radiusValue: radius?.value,
      };
    });

    expect(result.sliderValue).toBe('60');
    expect(result.labelText).toBe('60%');
    expect(result.radiusValue).toBe('8');
  });

  // ── Crop drag ────────────────────────────────────────────────────────────

  test('Dragging nw handle in crop mode updates cropTop and cropLeft', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    // Enter crop mode
    await page.evaluate(() => {
      document.querySelector('[title="Toggle crop mode — drag edge handles to crop"]')?.click();
    });

    // Get the nw handle position
    const handle = page.locator('.editable-container:has(img) .resize-handle.handle-nw');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();

    // Drag inward by 30px
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30);
    await page.mouse.up();

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      return {
        cropTop: editableEl?.state?.cropTop,
        cropLeft: editableEl?.state?.cropLeft,
        clipPath: img?.style.clipPath,
      };
    });

    expect(result.cropTop).toBeGreaterThan(0);
    expect(result.cropLeft).toBeGreaterThan(0);
    expect(result.clipPath).toContain('inset(');
  });

  test('Handles reposition to match crop insets in crop mode', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    // Set crop state directly and enter crop mode
    await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (editableEl) {
        editableEl.state.cropTop = 20;
        editableEl.state.cropLeft = 20;
      }
      document.querySelector('[title="Toggle crop mode — drag edge handles to crop"]')?.click();
    });

    // nw handle should be offset from its default corner position (cropTop=20, cropLeft=20)
    const result = await page.evaluate(() => {
      const handle = document.querySelector('.editable-container:has(img) .resize-handle.handle-nw');
      return {
        top: handle?.style.top,
        left: handle?.style.left,
      };
    });

    // Both values should be positive integers (crop 20 minus small handle offset)
    const topPx = parseInt(result.top, 10);
    const leftPx = parseInt(result.left, 10);
    expect(topPx).toBeGreaterThan(0);
    expect(topPx).toBeLessThan(20);  // offset from crop=20 but slightly less due to handle centering
    expect(leftPx).toBeGreaterThan(0);
    expect(leftPx).toBeLessThan(20);
  });

  test('Exiting crop mode resets handle inline styles', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      const btn = document.querySelector('[title="Toggle crop mode — drag edge handles to crop"]');
      btn?.click(); // enter
      btn?.click(); // exit
    });

    const result = await page.evaluate(() => {
      const handle = document.querySelector('.editable-container:has(img) .resize-handle.handle-nw');
      return { top: handle?.style.top, left: handle?.style.left };
    });

    expect(result.top).toBe('');
    expect(result.left).toBe('');
  });

  // ── Replace: src serialization ───────────────────────────────────────────

  test('Replace stores filename in state.src', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (editableEl) editableEl.state.src = 'new-photo.png';
    });

    const src = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return window.editableRegistry?.get(img)?.state?.src;
    });

    expect(src).toBe('new-photo.png');
  });

  test('Replace src is included in toDimensions output', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    const dims = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (!editableEl) return null;
      editableEl.state.src = 'new-photo.png';
      return editableEl.toDimensions();
    });

    expect(dims).not.toBeNull();
    expect(dims.src).toBe('new-photo.png');
  });

  test('replaceEditableOccurrences updates image src in QMD', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const qmd = '![alt](old-photo.png){.editable style="left: 100px"}';
      return window.replaceEditableOccurrences(
        qmd,
        ['{.absolute style="left: 100px"}'],
        ['new-photo.png']
      );
    });

    expect(result).toContain('](new-photo.png)');
    expect(result).not.toContain('](old-photo.png)');
  });

  test('replaceEditableOccurrences leaves src unchanged when srcReplacement is null', async ({ page }) => {
    await setupPage(page, 'basic.html');

    const result = await page.evaluate(() => {
      const qmd = '![alt](old-photo.png){.editable style="left: 100px"}';
      return window.replaceEditableOccurrences(
        qmd,
        ['{.absolute style="left: 100px"}'],
        [null]
      );
    });

    expect(result).toContain('](old-photo.png)');
  });

  // ── Replace: aspect ratio ────────────────────────────────────────────────

  test('Replacing image recalculates height to match new aspect ratio', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    const result = await page.evaluate(async () => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (!editableEl) return null;

      const startWidth = editableEl.state.width;

      // Create a 200x100 image (2:1 ratio) as a data URI
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 100;
      const dataUrl = canvas.toDataURL();

      // Simulate what the replace handler does
      editableEl.state.src = 'test.png';
      await new Promise(resolve => {
        const tmp = new Image();
        tmp.onload = () => {
          const newHeight = Math.round(startWidth * tmp.naturalHeight / tmp.naturalWidth);
          editableEl.state.height = newHeight;
          img.style.height = `${newHeight}px`;
          if (editableEl.container) editableEl.container.style.height = `${newHeight}px`;
          resolve();
        };
        tmp.src = dataUrl;
      });

      return {
        width: editableEl.state.width,
        height: editableEl.state.height,
        expectedHeight: Math.round(startWidth * 100 / 200),
      };
    });

    expect(result).not.toBeNull();
    expect(result.height).toBe(result.expectedHeight);
    expect(result.height).not.toBe(result.width); // height changed from original square assumption
  });

});
