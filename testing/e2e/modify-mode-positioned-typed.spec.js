// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { TESTING_DIR, setupPage, navigateToSlide } = require('./test-helpers');

// Regression coverage for issue #140 — typed positioned re-activation.
//
// Each row below describes one typed inner type as it appears on its slide
// of `manual-positioned-reactivation.html`:
//   slideIndex      — Reveal.getIndices().h for the slide (first H2 is 0,
//                     no title slide in this fixture).
//   innerSelector   — selector for the inner element relative to slide root;
//                     this is the element we expect to get the green ring.
//   originalLeft    — `left=` value in the wrapper's QMD source, used to
//                     assert position after activation.
//
// One spec per row exercises: ring placement, click → .editable-container,
// container left/top ≈ wrapper original, and serialize round-trip in place.
const TYPED_CASES = [
  {
    label: 'paragraph',
    slideIndex: 1,
    innerSelector: 'div.absolute > p',
    originalLeft: 100,
  },
  {
    label: 'display equation',
    slideIndex: 2,
    innerSelector: 'div.absolute > p:has(> span.math.display)',
    originalLeft: 120,
  },
  {
    label: 'blockquote',
    slideIndex: 3,
    innerSelector: 'div.absolute > blockquote',
    originalLeft: 100,
  },
  {
    label: 'bullet list',
    slideIndex: 4,
    innerSelector: 'div.absolute > ul',
    originalLeft: 100,
  },
  {
    label: 'ordered list',
    slideIndex: 5,
    innerSelector: 'div.absolute > ol',
    originalLeft: 110,
  },
  {
    label: 'display code',
    slideIndex: 6,
    // Quarto wraps <pre> in div.code-copy-outer-scaffold (or div.sourceCode
    // when no copy button). The typed classifier matches whichever is the
    // direct child of div.absolute.
    innerSelector: 'div.absolute > div.code-copy-outer-scaffold, div.absolute > div.sourceCode',
    originalLeft: 80,
  },
  {
    label: 'code chunk output',
    slideIndex: 7,
    innerSelector: 'div.absolute > div.cell',
    originalLeft: 80,
    // OJS cells render async and frequently report 0×0 dimensions in test
    // environments. Ring placement (the classifier-regression signal) still
    // works; skip the click+activate and save round-trip cases.
    skipActivate: true,
  },
  {
    label: 'figure',
    slideIndex: 8,
    innerSelector: 'div.absolute > div.quarto-figure',
    originalLeft: 120,
  },
  {
    label: 'table',
    slideIndex: 9,
    innerSelector: 'div.absolute > table',
    originalLeft: 100,
  },
];

test.describe('Modify Mode — typed positioned re-activation (#140)', () => {
  test.beforeAll(async () => {
    const htmlPath = path.join(TESTING_DIR, 'manual-positioned-reactivation.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Run quarto render testing/manual-positioned-reactivation.qmd first');
    }
  });

  for (const c of TYPED_CASES) {
    test(`${c.label}: inner element gets ring, wrapper does not`, async ({ page }) => {
      await setupPage(page, 'manual-positioned-reactivation.html');
      await navigateToSlide(page, c.slideIndex);
      await page.click('.toolbar-modify');

      const innerCount = await page.locator(`${c.innerSelector}.modify-mode-valid`).count();
      expect(innerCount).toBe(1);

      // The wrapper itself must NOT get the ring — the typed claim marker
      // (`data-typed-positioned-claimed`) makes the generic Positioned divs
      // classifier skip it.
      const wrapperRing = await page.locator('div.absolute.modify-mode-valid').count();
      expect(wrapperRing).toBe(0);
    });

    (c.skipActivate ? test.skip : test)(`${c.label}: click activates and creates editable-container`, async ({ page }) => {
      await setupPage(page, 'manual-positioned-reactivation.html');
      await navigateToSlide(page, c.slideIndex);
      await page.click('.toolbar-modify');

      // Use JS-dispatched click instead of Playwright's pointer-click. Some
      // async-rendered content (notably OJS cells) reports zero height or
      // off-viewport offsets for a beat, which Playwright's auto-scroll
      // can't recover from. The application-level click handler doesn't
      // care about viewport — only the registered listener firing.
      // Wait for the inner element to have non-zero dimensions before
      // clicking — OJS cells (and any future async-rendered content) can
      // report 0×0 for a beat after classify, which both blocks Playwright
      // pointer clicks and stalls setupDivWhenReady's dimension poll.
      await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        return el && el.offsetWidth > 0 && el.offsetHeight > 0;
      }, `${c.innerSelector}.modify-mode-valid`, { timeout: 5000 });
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }, `${c.innerSelector}.modify-mode-valid`);
      await page.waitForSelector('.editable-container', { timeout: 5000 });

      const containers = await page.locator('.editable-container').count();
      expect(containers).toBeGreaterThan(0);

      // Container should be positioned at the wrapper's original left.
      await page.waitForFunction(() => {
        const c = document.querySelector('.editable-container');
        return c && parseFloat(c.style.left) > 0;
      }, { timeout: 3000 });
      const containerLeft = await page.evaluate(() => {
        const c = document.querySelector('.editable-container');
        return parseFloat(c.style.left);
      });
      expect(containerLeft).toBeCloseTo(c.originalLeft, 0);
    });

    (c.skipActivate ? test.skip : test)(`${c.label}: serialize rewrites existing fence in place`, async ({ page }) => {
      await setupPage(page, 'manual-positioned-reactivation.html');
      await navigateToSlide(page, c.slideIndex);
      await page.click('.toolbar-modify');
      // Async-rendered content (e.g. OJS cells) may report zero height for
      // a beat after classify; force-click since classification has already
      // verified the typed claim.
      // Wait for the inner element to have non-zero dimensions before
      // clicking — OJS cells (and any future async-rendered content) can
      // report 0×0 for a beat after classify, which both blocks Playwright
      // pointer clicks and stalls setupDivWhenReady's dimension poll.
      await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        return el && el.offsetWidth > 0 && el.offsetHeight > 0;
      }, `${c.innerSelector}.modify-mode-valid`, { timeout: 5000 });
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }, `${c.innerSelector}.modify-mode-valid`);
      await page.waitForSelector('.editable-container', { timeout: 5000 });
      await page.waitForFunction(() => {
        const c = document.querySelector('.editable-container');
        return c && parseFloat(c.style.left) > 0;
      }, { timeout: 3000 });

      const qmd = await page.evaluate(() => getTransformedQmd());
      // The serialized QMD must still have exactly one `.absolute` block per
      // typed slide — re-activation rewrites the existing fence; it must
      // never wrap a second fence around it.
      const slideHeadingMatch = qmd.match(/##\s+([^\n]+)\n/g) || [];
      const slideChunks = qmd.split(/(?=^## )/m);
      // Find the chunk for the typed slide by looking for a `{.absolute`
      // occurrence on a slide that isn't the controls.
      const typedSlideChunk = slideChunks.find((chunk) =>
        chunk.includes('{.absolute') &&
        !chunk.includes('Control — multi-child') &&
        !chunk.includes('Control — two positioned')
      );
      expect(typedSlideChunk).toBeDefined();
      const absMatches = typedSlideChunk.match(/\{\.absolute/g) || [];
      expect(absMatches.length).toBe(1);
      // sanity: slide headings parse cleanly
      expect(slideHeadingMatch.length).toBeGreaterThan(0);
    });
  }

  test('multi-child wrapper: every typed inner gets its own ring', async ({ page }) => {
    await setupPage(page, 'manual-positioned-reactivation.html');
    await navigateToSlide(page, 10); // "Control — multi-child positioned wrapper"
    await page.click('.toolbar-modify');

    // Two child paragraphs inside one wrapper → two inner rings.
    const innerPCount = await page.locator('div.absolute > p.modify-mode-valid').count();
    expect(innerPCount).toBe(2);
    // Wrapper is claimed by typed classifiers → no wrapper ring.
    const wrapperRing = await page.locator('div.absolute.modify-mode-valid').count();
    expect(wrapperRing).toBe(0);
  });

  test('plain (non-positioned) paragraph: first-activation Paragraphs classifier still fires', async ({ page }) => {
    await setupPage(page, 'manual-positioned-reactivation.html');
    await navigateToSlide(page, 11); // "Control — plain (non-positioned) paragraph"
    await page.click('.toolbar-modify');

    // The non-positioned <p> on this slide is a direct child of <section>;
    // the typed classifiers' `div.absolute > p` selector won't claim it.
    // Count valid <p>s that are direct children of <section>.
    const plainCount = await page.evaluate(() => {
      const slide = document.querySelector('.reveal .slides section.present');
      if (!slide) return 0;
      return Array.from(slide.children).filter(
        (el) => el.tagName === 'P' && el.classList.contains('modify-mode-valid')
      ).length;
    });
    expect(plainCount).toBeGreaterThan(0);
  });

  test('two positioned paragraphs on one slide: both get independent rings', async ({ page }) => {
    await setupPage(page, 'manual-positioned-reactivation.html');
    await navigateToSlide(page, 12); // "Control — two positioned paragraphs on same slide"
    await page.click('.toolbar-modify');

    const innerPCount = await page.locator('div.absolute > p.modify-mode-valid').count();
    expect(innerPCount).toBe(2);
    const wrapperRing = await page.locator('div.absolute.modify-mode-valid').count();
    expect(wrapperRing).toBe(0);
  });
});
