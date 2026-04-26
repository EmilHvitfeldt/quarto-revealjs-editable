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

    // Click the image container
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

    // Select image
    await page.click('.editable-container:has(img)');

    // Click somewhere outside any editable container and toolbar
    await page.click('body', { position: { x: 10, y: 10 } });

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
      const slider = document.querySelector('.image-opacity-slider');
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
      const slider = document.querySelector('.image-opacity-slider');
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
      const input = document.querySelector('.image-border-radius-input');
      input.value = '20';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return img?.style.borderRadius;
    });

    expect(result).toBe('20px');
  });

  // ── Object fit ───────────────────────────────────────────────────────────

  test('Object fit Cover button sets object-fit and marks active', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.image-fit-btn')];
      const cover = btns.find(b => b.textContent === 'Cover');
      cover?.click();
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const btns = [...document.querySelectorAll('.image-fit-btn')];
      const cover = btns.find(b => b.textContent === 'Cover');
      return {
        objectFit: img?.style.objectFit,
        coverActive: cover?.classList.contains('active'),
      };
    });

    expect(result.objectFit).toBe('cover');
    expect(result.coverActive).toBe(true);
  });

  test('Clicking active object fit button clears it', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    // Click Cover twice
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.image-fit-btn')];
      const cover = btns.find(b => b.textContent === 'Cover');
      cover?.click();
      cover?.click();
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const btns = [...document.querySelectorAll('.image-fit-btn')];
      const cover = btns.find(b => b.textContent === 'Cover');
      return {
        objectFit: img?.style.objectFit,
        coverActive: cover?.classList.contains('active'),
      };
    });

    expect(result.objectFit).toBe('');
    expect(result.coverActive).toBe(false);
  });

  // ── Flip ─────────────────────────────────────────────────────────────────

  test('Flip H button applies scaleX(-1) to image', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      document.querySelector('.image-flip-btn[title="Flip horizontal"]')?.click();
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return {
        transform: img?.style.transform,
        active: document.querySelector('.image-flip-btn[title="Flip horizontal"]')?.classList.contains('active'),
      };
    });

    expect(result.transform).toContain('scaleX(-1)');
    expect(result.active).toBe(true);
  });

  test('Flip V button applies scaleY(-1) to image', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    await page.evaluate(() => {
      document.querySelector('.image-flip-btn[title="Flip vertical"]')?.click();
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
      document.querySelector('.image-flip-btn[title="Flip horizontal"]')?.click();
      document.querySelector('.image-flip-btn[title="Flip vertical"]')?.click();
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

    // Apply several changes
    await page.evaluate(() => {
      const slider = document.querySelector('.image-opacity-slider');
      slider.value = '50';
      slider.dispatchEvent(new Event('input', { bubbles: true }));

      const radius = document.querySelector('.image-border-radius-input');
      radius.value = '10';
      radius.dispatchEvent(new Event('input', { bubbles: true }));

      document.querySelector('.image-flip-btn[title="Flip horizontal"]')?.click();
    });

    // Click Reset
    await page.evaluate(() => {
      document.querySelector('.image-reset-btn')?.click();
    });

    const result = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      return {
        opacity: img?.style.opacity,
        borderRadius: img?.style.borderRadius,
        transform: img?.style.transform,
        stateOpacity: editableEl?.state?.opacity,
        stateRadius: editableEl?.state?.borderRadius,
        stateFlipH: editableEl?.state?.flipH,
      };
    });

    expect(result.opacity).toBe('');
    expect(result.borderRadius).toBe('');
    expect(result.transform).toBe('');
    expect(result.stateOpacity).toBe(100);
    expect(result.stateRadius).toBe(0);
    expect(result.stateFlipH).toBe(false);
  });

  // ── Undo/redo ────────────────────────────────────────────────────────────

  test('Ctrl+Z undoes opacity change', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    // Trigger mousedown (which pushes undo state) then change opacity
    await page.evaluate(() => {
      const slider = document.querySelector('.image-opacity-slider');
      slider.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      slider.value = '40';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.keyboard.press('Control+z');

    await page.waitForFunction(() => {
      const img = document.querySelector('.editable-container img');
      return img?.style.opacity !== '0.4';
    }, { timeout: 2000 });

    const opacity = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      return img?.style.opacity;
    });

    expect(opacity).not.toBe('0.4');
  });

  // ── Serialization ────────────────────────────────────────────────────────

  test('Image properties serialize to QMD style string', async ({ page }) => {
    await setupPage(page, 'basic.html');

    await page.click('.editable-container:has(img)');

    const qmd = await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (!editableEl) return null;

      // Set state directly and apply
      editableEl.state.opacity = 50;
      editableEl.state.borderRadius = 10;
      editableEl.state.objectFit = 'contain';
      editableEl.syncToDOM();

      const dims = editableEl.toDimensions();
      return window.formatEditableEltStrings ? window.formatEditableEltStrings([dims])[0] : null;
    });

    expect(qmd).not.toBeNull();
    expect(qmd).toContain('opacity: 0.5');
    expect(qmd).toContain('border-radius: 10px');
    expect(qmd).toContain('object-fit: contain');
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
    // Must be a single transform: declaration (not two)
    const transformCount = (qmd.match(/transform:/g) || []).length;
    expect(transformCount).toBe(1);
  });

  // ── Panel controls sync on re-select ────────────────────────────────────

  test('Panel controls sync to current image state when image is re-selected', async ({ page }) => {
    await setupPage(page, 'basic.html');

    // Set state directly then re-select the image
    await page.evaluate(() => {
      const img = document.querySelector('.editable-container img');
      const editableEl = window.editableRegistry?.get(img);
      if (editableEl) {
        editableEl.state.opacity = 60;
        editableEl.state.borderRadius = 8;
      }
    });

    // Click image to trigger panel sync
    await page.click('.editable-container:has(img)');

    const result = await page.evaluate(() => {
      const slider = document.querySelector('.image-opacity-slider');
      const label = document.querySelector('.image-opacity-label');
      const radius = document.querySelector('.image-border-radius-input');
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

});
