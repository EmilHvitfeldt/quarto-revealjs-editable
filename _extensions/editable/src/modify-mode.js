/**
 * Modify mode: click any plain image to make it editable.
 * Activated via the toolbar "Modify" button.
 *
 * Elements are classified into three buckets:
 *   valid        — element a classifier says can be modified; green ring
 *   warn         — element a classifier says to warn about; amber ring, not clickable
 *   (ignored)    — already editable or not recognised by any classifier
 *
 * ## Adding a new element type
 *
 * Call `ModifyModeClassifier.register()` with an object that implements:
 *
 *   classify(slideEl)  → { valid: Element[], warn: Array<{el, reason}> }
 *     Inspect `slideEl` (current slide) and return which elements can be
 *     activated and which should show a warning.  Cross-element context
 *     (e.g. counting sibling figures) belongs here.
 *
 *   activate(el)
 *     Called when the user clicks a valid element.  Stamp whatever
 *     data-attributes your serialize() needs, then call the appropriate
 *     setup helper (setupImageWhenReady, setupDivWhenReady, …).
 *
 *   serialize(text)  → string          [optional]
 *     Called during save to write modified elements of this type back to
 *     the QMD source.  Receives the full QMD string and must return the
 *     updated string.  Omit if your element type reuses an existing
 *     serialization path.
 *
 * @module modify-mode
 */

import { editableRegistry } from './editable-element.js';
import { setupImageWhenReady, setupDivWhenReady, setupVideoWhenReady } from './element-setup.js';
import { initializeQuillForElement } from './quill.js';
import { showRightPanel } from './toolbar.js';
import {
  splitIntoSlideChunks,
  serializeToQmd,
  elementToText,
  serializeArrowToShortcode,
} from './serialization.js';
import { getQmdHeadingIndex, getSlideScale } from './utils.js';
import { getColorPalette, getBrandColorOutput } from './colors.js';
import { setCapabilityOverride } from './capabilities.js';
import { createArrowElement, setActiveArrow } from './arrows.js';
import { CONFIG } from './config.js';

const VALID_CLASS = 'modify-mode-valid';
const WARN_CLASS  = 'modify-mode-warn';
const ROOT_CLASS  = 'modify-mode';

/** @type {AbortController|null} Cleans up click listeners on exit */
let abortController = null;

/** Single source of truth for whether modify mode is active */
let _active = false;

export function isModifyModeActive() { return _active; }

/**
 * Maps warn elements → the human-readable reason string returned by the
 * classifier.  Populated by applyClassification(), cleared on exit.
 * Use getWarnReason(el) to read.
 * @type {WeakMap<Element, string>}
 */
const _warnReasons = new WeakMap();

/**
 * Return the warning reason for an element that was classified as warn,
 * or null if the element is not a warned element.
 * @param {Element} el
 * @returns {string|null}
 */
export function getWarnReason(el) {
  return _warnReasons.get(el) ?? null;
}

// ---------------------------------------------------------------------------
// Classifier registry
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} WarnEntry
 * @property {Element} el
 * @property {string}  reason  - Human-readable explanation shown on hover
 */

/**
 * @typedef {Object} ClassifyResult
 * @property {Element[]}    valid
 * @property {WarnEntry[]}  warn
 */

/**
 * @typedef {Object} Classifier
 * @property {function(Element): ClassifyResult} classify
 *   Inspect the current slide element and return valid/warn lists.
 * @property {function(Element): void} activate
 *   Called when the user clicks a valid element.
 * @property {function(string): string} [serialize]
 *   Optional. Called during save; receives and returns the full QMD string.
 * @property {function(): void} [cleanup]
 *   Optional. Called when modify mode exits; restore any DOM changes made in classify().
 */

const _classifiers = [];

/**
 * Register a classifier for a new element type.
 * Classifiers are evaluated in registration order.
 * @param {Classifier} classifier
 */
export const ModifyModeClassifier = {
  register(classifier) {
    _classifiers.push(classifier);
  },

  /**
   * Apply every registered classifier's serialize() to the QMD text.
   * This is the single write-back entry point for all modified element types.
   * @param {string} text - Full QMD source
   * @returns {string}
   */
  applySerializers(text) {
    for (const classifier of _classifiers) {
      if (typeof classifier.serialize === 'function') {
        text = classifier.serialize(text);
      }
    }
    return text;
  },

};

// ---------------------------------------------------------------------------
// Image classifier (built-in)
// ---------------------------------------------------------------------------

/**
 * Get the effective src of an image, checking both src and data-src
 * (Reveal.js uses data-src for lazy loading).
 * @param {HTMLImageElement} img
 * @returns {string|null}
 */
export function getImgSrc(img) {
  return img.getAttribute('src') || img.getAttribute('data-src') || null;
}

function srcInQmdSource(img) {
  if (!window._input_file) return false;
  const src = getImgSrc(img);
  return !!src && window._input_file.includes(src);
}

function getChunkPrefix(src) {
  const match = src.match(/figure-revealjs\/(.+)-\d+\.png$/);
  return match ? match[1] : null;
}

function buildChunkPrefixCounts(imgs) {
  const counts = new Map();
  for (const img of imgs) {
    const src = getImgSrc(img);
    if (!src) continue;
    const prefix = getChunkPrefix(src);
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return counts;
}

ModifyModeClassifier.register({
  label: 'Images',
  classify(slideEl) {
    const imgs = Array.from(slideEl.querySelectorAll('img'));
    const prefixCounts = buildChunkPrefixCounts(imgs);

    const valid = [];
    const warn  = [];

    for (const img of imgs) {
      if (editableRegistry.has(img)) continue;
      if (img.classList.contains('absolute')) continue;
      if (img.closest('div.absolute')) continue;
      const src = getImgSrc(img);
      if (!src) continue;
      const prefix = getChunkPrefix(src);
      if (prefix) {
        if (prefixCounts.get(prefix) > 1) {
          warn.push({ el: img, reason: 'Multi-figure chunk — cannot target individual figures' });
        }
      } else if (srcInQmdSource(img)) {
        valid.push(img);
      }
    }

    return { valid, warn };
  },

  activate(img) {
    // Capture src before setting img.src, which resolves it to an absolute URL
    // and would break QMD source matching in serialize().
    const originalSrc = getImgSrc(img);

    // Ensure lazy-loaded images (data-src only) are fetched before setup polls
    // for naturalWidth/offsetWidth — without this, setupImageWhenReady can time
    // out before Reveal.js swaps data-src → src on its own schedule.
    if (!img.getAttribute('src') && img.getAttribute('data-src')) {
      img.src = img.getAttribute('data-src');
    }

    img.dataset.editableModifiedSrc   = originalSrc;
    img.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
    img.dataset.editableModified      = 'true';

    setupImageWhenReady(img);
  },

  serialize(text) {
    const imgs = Array.from(
      document.querySelectorAll('img[data-editable-modified="true"]')
    );
    if (imgs.length === 0) return text;

    const chunks = splitIntoSlideChunks(text);

    // Group by (chunkIndex, originalSrc) to handle duplicate srcs on the same slide.
    // DOM order within each group maps to QMD occurrence order.
    const groups = new Map();
    for (const img of imgs) {
      const originalSrc = img.dataset.editableModifiedSrc;
      if (!originalSrc) continue;
      if (!editableRegistry.has(img)) continue;
      const slideIndex = parseInt(img.dataset.editableModifiedSlide ?? '0', 10);
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      const key = `${chunkIndex}::${originalSrc}`;
      if (!groups.has(key)) groups.set(key, { chunkIndex, originalSrc, imgs: [] });
      groups.get(key).imgs.push(img);
    }

    for (const { chunkIndex, originalSrc, imgs: groupImgs } of groups.values()) {
      groupImgs.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );

      const replacements = groupImgs.map(img => {
        const dims = editableRegistry.get(img).toDimensions();
        return `](${dims.src || originalSrc})${serializeToQmd(dims)}`;
      });

      const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\]\\(${escapedSrc}\\)(\\{[^}]*\\})?`, 'g');

      let occurrence = 0;
      chunks[chunkIndex] = chunks[chunkIndex].replace(regex, (match) =>
        occurrence < replacements.length ? replacements[occurrence++] : match
      );
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Video classifier (built-in)
// ---------------------------------------------------------------------------

/**
 * Get the effective src of a video element.
 * Checks the src attribute directly on the element first, then falls back to
 * the first <source> child (Quarto may render either form).
 * @param {HTMLVideoElement} video
 * @returns {string|null}
 */
export function getVideoSrc(video) {
  return video.getAttribute('src') || video.getAttribute('data-src') ||
    video.querySelector('source')?.getAttribute('src') || null;
}

function videoSrcInQmdSource(video) {
  if (!window._input_file) return false;
  const src = getVideoSrc(video);
  return !!src && window._input_file.includes(src);
}

// Tracks videos whose `controls` attribute was removed during classification
// so it can be restored when modify mode exits without activating them.
const _videosWithControlsRemoved = new Set();

ModifyModeClassifier.register({
  label: 'Videos',
  classify(slideEl) {
    // Restore controls on any videos from a previous classification pass
    // (e.g. the user navigated slides without clicking).
    for (const video of _videosWithControlsRemoved) {
      video.setAttribute('controls', '');
    }
    _videosWithControlsRemoved.clear();

    const videos = Array.from(slideEl.querySelectorAll('video'));
    const valid = [];
    const warn  = [];

    for (const video of videos) {
      if (editableRegistry.has(video)) continue;
      if (video.classList.contains('absolute')) continue;
      if (video.closest('div.absolute')) continue;
      const src = getVideoSrc(video);
      if (!src) continue;
      if (videoSrcInQmdSource(video)) {
        valid.push(video);
      }
    }

    // Remove native controls from valid videos so browser-native control UI
    // doesn't intercept the click before our listener fires (Firefox issue).
    for (const video of valid) {
      video.removeAttribute('controls');
      _videosWithControlsRemoved.add(video);
    }

    return { valid, warn };
  },

  cleanup() {
    for (const video of _videosWithControlsRemoved) {
      video.setAttribute('controls', '');
    }
    _videosWithControlsRemoved.clear();
  },

  activate(video) {
    // Don't restore controls on this video — it's now an editable element.
    _videosWithControlsRemoved.delete(video);

    const originalSrc = getVideoSrc(video);

    if (!video.getAttribute('src') && video.getAttribute('data-src')) {
      video.src = video.getAttribute('data-src');
    }

    video.dataset.editableModifiedSrc   = originalSrc;
    video.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
    video.dataset.editableModified      = 'true';

    // Reveal.js sets max-width: 95% on media elements. Once inside the
    // inline-block editable-container, that percentage resolves against the
    // explicit style.width, shrinking the element further. Clear it first.
    video.style.maxWidth  = 'none';
    video.style.maxHeight = 'none';

    setupVideoWhenReady(video);
  },

  serialize(text) {
    const videos = Array.from(
      document.querySelectorAll('video[data-editable-modified="true"]')
    );
    if (videos.length === 0) return text;

    const chunks = splitIntoSlideChunks(text);

    const groups = new Map();
    for (const video of videos) {
      const originalSrc = video.dataset.editableModifiedSrc;
      if (!originalSrc) continue;
      if (!editableRegistry.has(video)) continue;
      const slideIndex = parseInt(video.dataset.editableModifiedSlide ?? '0', 10);
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      const key = `${chunkIndex}::${originalSrc}`;
      if (!groups.has(key)) groups.set(key, { chunkIndex, originalSrc, videos: [] });
      groups.get(key).videos.push(video);
    }

    for (const { chunkIndex, originalSrc, videos: groupVideos } of groups.values()) {
      groupVideos.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );

      const replacements = groupVideos.map(video => {
        const dims = editableRegistry.get(video).toDimensions();
        return `](${dims.src || originalSrc})${serializeToQmd(dims)}`;
      });

      const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\]\\(${escapedSrc}\\)(\\{[^}]*\\})?`, 'g');

      let occurrence = 0;
      chunks[chunkIndex] = chunks[chunkIndex].replace(regex, (match) =>
        occurrence < replacements.length ? replacements[occurrence++] : match
      );
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// {.absolute} div classifier helpers
// ---------------------------------------------------------------------------

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read left/top/width/height from a div.absolute's inline styles.
 * Returns null if any value is missing (element can't be matched to source).
 */
function getAbsolutePosition(el) {
  const s = el.style;
  const left   = s.left   ? parseFloat(s.left)   : null;
  const top    = s.top    ? parseFloat(s.top)     : null;
  const width  = s.width  ? parseFloat(s.width)  : null;
  const height = s.height ? parseFloat(s.height) : null;
  if (left === null || top === null || width === null || height === null) return null;
  return { left, top, width, height };
}

/**
 * Build a regex that matches a {.absolute ...} attribute block containing
 * all four original position values in any order.
 */
function makeAbsoluteBlockRegex(left, top, width, height) {
  const vals = [
    `left=${Math.round(left)}px`,
    `top=${Math.round(top)}px`,
    `width=${Math.round(width)}px`,
    `height=${Math.round(height)}px`,
  ];
  const lookaheads = vals.map(v => `(?=[^}]*${escapeRegex(v)})`).join('');
  return new RegExp(`\\{${lookaheads}\\.absolute[^}]*\\}`, 'g');
}

/** Return true if the div's position can be matched to a {.absolute} block in source. */
function absoluteDivInQmdSource(div, slideIndex) {
  if (!window._input_file) return false;
  const pos = getAbsolutePosition(div);
  if (!pos) return false;
  const chunks = splitIntoSlideChunks(window._input_file);
  const chunk = chunks[getQmdHeadingIndex(slideIndex) + 1];
  if (!chunk) return false;
  return makeAbsoluteBlockRegex(pos.left, pos.top, pos.width, pos.height).test(chunk);
}

/**
 * Poll until the element appears in editableRegistry, then set its container
 * position to the original left/top values captured before setup ran.
 * Needed because setupEltStyles sets position:relative on the element, clearing
 * the effective absolute position; the container must receive it instead.
 */
function waitForRegistryThenFixPosition(el, origLeft, origTop) {
  if (editableRegistry.has(el)) {
    editableRegistry.get(el).setState({ x: origLeft, y: origTop });
  } else {
    requestAnimationFrame(() => waitForRegistryThenFixPosition(el, origLeft, origTop));
  }
}

// {.absolute} div classifier
ModifyModeClassifier.register({
  label: 'Positioned divs',
  classify(slideEl) {
    const slideIndex = Reveal.getState().indexh;
    const divs = Array.from(slideEl.querySelectorAll('div.absolute'));
    const valid = [];
    const warn  = [];
    for (const div of divs) {
      if (editableRegistry.has(div)) continue;
      if (div.classList.contains('editable-container')) continue;
      if (div.classList.contains('editable-new')) continue;
      if (div.classList.contains('editable')) continue;
      const pos = getAbsolutePosition(div);
      if (!pos) {
        warn.push({ el: div, reason: 'No inline position — cannot match to source' });
        continue;
      }
      if (!absoluteDivInQmdSource(div, slideIndex)) {
        warn.push({ el: div, reason: 'Cannot locate matching {.absolute} block in source' });
        continue;
      }
      valid.push(div);
    }
    return { valid, warn };
  },

  activate(el) {
    const pos = getAbsolutePosition(el);
    if (!pos) return;
    el.dataset.editableModified          = 'true';
    el.dataset.editableModifiedSlide     = String(Reveal.getState().indexh);
    el.dataset.editableModifiedAbsLeft   = String(Math.round(pos.left));
    el.dataset.editableModifiedAbsTop    = String(Math.round(pos.top));
    el.dataset.editableModifiedAbsWidth  = String(Math.round(pos.width));
    el.dataset.editableModifiedAbsHeight = String(Math.round(pos.height));
    // Clear left/top before setup: setupEltStyles sets position:relative, so
    // any remaining left/top inline styles would act as relative offsets and
    // double-count the position when the container is placed.
    el.style.left = '';
    el.style.top  = '';
    setupDivWhenReady(el);
    waitForRegistryThenFixPosition(el, pos.left, pos.top);
  },

  serialize(text) {
    const divs = Array.from(
      document.querySelectorAll('div[data-editable-modified-abs-left]')
    );
    if (divs.length === 0) return text;
    const chunks = splitIntoSlideChunks(text);
    const groups = new Map();
    for (const div of divs) {
      if (!editableRegistry.has(div)) continue;
      const slideIndex = parseInt(div.dataset.editableModifiedSlide ?? '0', 10);
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      if (!groups.has(chunkIndex)) groups.set(chunkIndex, []);
      groups.get(chunkIndex).push(div);
    }
    for (const [chunkIndex, groupDivs] of groups) {
      groupDivs.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
      const occurrenceCounters = new Map();
      for (const div of groupDivs) {
        const origLeft   = parseInt(div.dataset.editableModifiedAbsLeft,   10);
        const origTop    = parseInt(div.dataset.editableModifiedAbsTop,    10);
        const origWidth  = parseInt(div.dataset.editableModifiedAbsWidth,  10);
        const origHeight = parseInt(div.dataset.editableModifiedAbsHeight, 10);
        const sig = `${origLeft},${origTop},${origWidth},${origHeight}`;
        const targetOccurrence = occurrenceCounters.get(sig) ?? 0;
        occurrenceCounters.set(sig, targetOccurrence + 1);
        const regex = makeAbsoluteBlockRegex(origLeft, origTop, origWidth, origHeight);
        const dims  = editableRegistry.get(div).toDimensions();
        const replacement = serializeToQmd(dims);
        let occurrence = 0;
        chunks[chunkIndex] = chunks[chunkIndex].replace(regex, (match) => {
          if (occurrence++ === targetOccurrence) return replacement;
          return match;
        });
      }
    }
    return chunks.join('');
  },
});

// {.absolute} image classifier
function makeAbsoluteImageRegex(src, left, top, width, height) {
  const escapedSrc = escapeRegex(src);
  const vals = [
    `left=${Math.round(left)}px`,
    `top=${Math.round(top)}px`,
    `width=${Math.round(width)}px`,
    `height=${Math.round(height)}px`,
  ];
  const lookaheads = vals.map(v => `(?=[^}]*${escapeRegex(v)})`).join('');
  return new RegExp(`\\]\\(${escapedSrc}\\)\\{${lookaheads}\\.absolute[^}]*\\}`, 'g');
}

function absoluteImgInQmdSource(img, slideIndex) {
  if (!window._input_file) return false;
  const pos = getAbsolutePosition(img);
  if (!pos) return false;
  const src = getImgSrc(img);
  if (!src) return false;
  const chunks = splitIntoSlideChunks(window._input_file);
  const chunk = chunks[getQmdHeadingIndex(slideIndex) + 1];
  if (!chunk) return false;
  return makeAbsoluteImageRegex(src, pos.left, pos.top, pos.width, pos.height).test(chunk);
}

ModifyModeClassifier.register({
  label: 'Positioned images',
  classify(slideEl) {
    const slideIndex = Reveal.getState().indexh;
    const imgs = Array.from(slideEl.querySelectorAll('img.absolute'));
    const valid = [];
    const warn  = [];
    for (const img of imgs) {
      if (editableRegistry.has(img)) continue;
      const pos = getAbsolutePosition(img);
      if (!pos) {
        warn.push({ el: img, reason: 'No inline position — cannot match to source' });
        continue;
      }
      if (!absoluteImgInQmdSource(img, slideIndex)) {
        warn.push({ el: img, reason: 'Cannot locate matching {.absolute} block in source' });
        continue;
      }
      valid.push(img);
    }
    return { valid, warn };
  },

  activate(el) {
    const pos = getAbsolutePosition(el);
    if (!pos) return;
    el.dataset.editableModifiedAbsLeft   = String(Math.round(pos.left));
    el.dataset.editableModifiedAbsTop    = String(Math.round(pos.top));
    el.dataset.editableModifiedAbsWidth  = String(Math.round(pos.width));
    el.dataset.editableModifiedAbsHeight = String(Math.round(pos.height));
    el.dataset.editableModifiedAbsSrc    = getImgSrc(el) ?? '';
    el.dataset.editableModifiedSlide     = String(Reveal.getState().indexh);
    if (!el.getAttribute('src') && el.getAttribute('data-src')) {
      el.src = el.getAttribute('data-src');
    }
    el.style.left = '';
    el.style.top  = '';
    // Remove percentage-based max-width/max-height (Reveal.js sets max-width:95%).
    // Once inside the inline-block editable-container, those % values would resolve
    // against the container width, shrinking the image.
    el.style.maxWidth  = 'none';
    el.style.maxHeight = 'none';
    setupImageWhenReady(el);
    waitForRegistryThenFixPosition(el, pos.left, pos.top);
  },

  serialize(text) {
    const imgs = Array.from(
      document.querySelectorAll('img[data-editable-modified-abs-src]')
    );
    if (imgs.length === 0) return text;
    const chunks = splitIntoSlideChunks(text);
    const groups = new Map();
    for (const img of imgs) {
      if (!editableRegistry.has(img)) continue;
      const slideIndex = parseInt(img.dataset.editableModifiedSlide ?? '0', 10);
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      if (!groups.has(chunkIndex)) groups.set(chunkIndex, []);
      groups.get(chunkIndex).push(img);
    }
    for (const [chunkIndex, groupImgs] of groups) {
      groupImgs.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
      for (const img of groupImgs) {
        const src        = img.dataset.editableModifiedAbsSrc;
        const origLeft   = parseInt(img.dataset.editableModifiedAbsLeft,   10);
        const origTop    = parseInt(img.dataset.editableModifiedAbsTop,    10);
        const origWidth  = parseInt(img.dataset.editableModifiedAbsWidth,  10);
        const origHeight = parseInt(img.dataset.editableModifiedAbsHeight, 10);
        const regex = makeAbsoluteImageRegex(src, origLeft, origTop, origWidth, origHeight);
        const dims  = editableRegistry.get(img).toDimensions();
        const replacement = `](${src}){.absolute left=${dims.left}px top=${dims.top}px width=${dims.width}px height=${dims.height}px}`;
        chunks[chunkIndex] = chunks[chunkIndex].replace(regex, replacement);
      }
    }
    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Slide title (h2) classifier
// ---------------------------------------------------------------------------

/**
 * Convert an h2 element's innerHTML to Quarto inline markdown.
 * Handles bold, italic, and strips remaining tags.
 * @param {string} html
 * @returns {string}
 */
function headingHtmlToMarkdown(html) {
  let text = html;

  // Background color spans (must come before foreground to avoid false matches)
  text = text.replace(/<span[^>]*style="[^"]*background-color:\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, colorVal, content) => `[${content}]{style='background-color: ${getBrandColorOutput(colorVal.trim())}'}`);

  // Foreground color spans
  text = text.replace(/<span[^>]*style="[^"]*(?<!background-)color:\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, colorVal, content) => {
      if (colorVal.trim().toLowerCase() === 'inherit') return content;
      return `[${content}]{style='color: ${getBrandColorOutput(colorVal.trim())}'}`;
    });

  // <font color="..."> (produced by some browsers)
  text = text.replace(/<font[^>]*\bcolor="([^"]+)"[^>]*>([\s\S]*?)<\/font>/gi,
    (_, colorVal, content) => `[${content}]{style='color: ${getBrandColorOutput(colorVal.trim())}'}`);

  return text
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~')
    .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '~~$1~~')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Build a minimal formatting toolbar for heading contentEditable editing.
 * Returns the toolbar element (caller must append it and remove it on cleanup).
 * @param {HTMLElement} h2
 * @returns {HTMLElement}
 */
/**
 * Build a Quill-style color picker span for the heading toolbar.
 * Saves/restores the h2 selection so clicking swatches doesn't lose focus.
 */
function buildColorPicker(execCmd, title, pickerClass, presetColors) {
  let savedRange = null;

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  };

  const isForeground = execCmd === 'foreColor';
  const iconSvg = isForeground
    ? '<svg viewbox="0 0 18 18"><line class="ql-color-label ql-stroke ql-transparent" x1="3" x2="15" y1="15" y2="15"/><polyline class="ql-stroke" points="5.5 11 9 3 12.5 11"/><line class="ql-stroke" x1="11.63" x2="6.38" y1="9" y2="9"/></svg>'
    : '<svg viewbox="0 0 18 18"><g class="ql-fill ql-color-label"><polygon points="6 6.868 6 6 5 6 5 7 5.942 7 6 6.868"/><rect height="1" width="1" x="4" y="4"/><polygon points="6.817 5 6 5 6 6 6.38 6 6.817 5"/><rect height="1" width="1" x="2" y="6"/><rect height="1" width="1" x="3" y="5"/><polygon points="11.183 5 11.62 6 12 6 12 5 11.183 5"/><rect height="1" width="1" x="11" y="4"/><polygon points="12 6.868 12.058 7 13 7 13 6 12 6 12 6.868"/><rect height="1" width="1" x="13" y="6"/><rect height="1" width="1" x="14" y="4"/><polygon points="14 5 13.367 5 13.82 6 14 6 14 5"/><rect height="1" width="1" x="14" y="7"/><rect height="1" width="1" x="14" y="2"/><rect height="1" width="1" x="13" y="3"/><polygon points="12 3.132 12 3 11 3 11 4 11.183 4 12 3.132"/><rect height="1" width="1" x="10" y="2"/><rect height="1" width="1" x="9" y="3"/><rect height="1" width="1" x="8" y="2"/><rect height="1" width="1" x="7" y="3"/><rect height="1" width="1" x="6" y="2"/><rect height="1" width="1" x="5" y="3"/><polygon points="3.917 5 4 5 4 6 4.075 6 3.917 5"/><rect height="1" width="1" x="3" y="7"/><rect height="1" width="1" x="2" y="4"/></g><rect class="ql-stroke" height="12" rx="1" ry="1" width="12" x="3" y="3"/></svg>';

  const label = document.createElement('span');
  label.className = 'ql-picker-label';
  label.title = title;
  label.innerHTML = iconSvg;

  const options = document.createElement('span');
  options.className = 'ql-picker-options';
  options.style.display = 'none';

  const addItem = (value, bg) => {
    const item = document.createElement('span');
    item.className = 'ql-picker-item';
    item.dataset.value = value;
    if (bg) item.style.backgroundColor = bg;
    options.appendChild(item);
    return item;
  };

  addItem('unset');
  for (const color of presetColors) addItem(color, color);

  const customInput = document.createElement('input');
  customInput.type = 'color';
  customInput.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;';
  const updateSwatch = (color) => {
    const swatchEl = label.querySelector('.ql-color-label');
    if (swatchEl) swatchEl.style[isForeground ? 'stroke' : 'fill'] = color || '';
  };

  customInput.addEventListener('input', () => {
    restoreSelection();
    document.execCommand(execCmd, false, customInput.value);
    updateSwatch(customInput.value);
  });

  addItem('custom');

  const picker = document.createElement('span');
  picker.className = `ql-picker ql-color-picker ${pickerClass}`;
  picker.appendChild(label);
  picker.appendChild(options);
  picker.appendChild(customInput);

  label.addEventListener('mousedown', (e) => {
    e.preventDefault();
    saveSelection();
    const isOpen = picker.classList.contains('ql-expanded');
    // Close all open pickers in this toolbar first
    picker.closest('.heading-edit-toolbar')?.querySelectorAll('.ql-expanded').forEach(p => {
      p.classList.remove('ql-expanded');
      p.querySelector('.ql-picker-options').style.display = 'none';
    });
    if (!isOpen) {
      picker.classList.add('ql-expanded');
      options.style.display = 'flex';
    }
  });

  options.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const item = e.target.closest('.ql-picker-item');
    if (!item) return;
    picker.classList.remove('ql-expanded');
    options.style.display = 'none';
    const value = item.dataset.value;
    if (value === 'custom') {
      customInput.click();
      return;
    }
    restoreSelection();
    if (value === 'unset') {
      document.execCommand(execCmd, false, 'inherit');
      updateSwatch('');
    } else {
      document.execCommand(execCmd, false, value);
      updateSwatch(value);
    }
  });

  return picker;
}

function buildHeadingToolbar(h2) {
  const toolbar = document.createElement('div');
  toolbar.className = 'heading-edit-toolbar quill-toolbar-container ql-toolbar ql-snow';

  const buttons = [
    { command: 'bold',          label: 'B', title: 'Bold',          style: 'font-weight:bold' },
    { command: 'italic',        label: 'I', title: 'Italic',        style: 'font-style:italic' },
    { command: 'underline',     label: 'U', title: 'Underline',     style: 'text-decoration:underline' },
    { command: 'strikeThrough', label: 'S', title: 'Strikethrough', style: 'text-decoration:line-through' },
  ];

  for (const { command, label, title, style } of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.title = title;
    btn.style.cssText = style;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.execCommand(command);
    });
    toolbar.appendChild(btn);
  }

  const presetColors = getColorPalette();
  toolbar.appendChild(buildColorPicker('foreColor',  'Text color',       'ql-color',      presetColors));
  toolbar.appendChild(buildColorPicker('backColor',  'Background color', 'ql-background', presetColors));

  // Close open pickers when clicking outside the toolbar
  const onDocMouseDown = (e) => {
    if (!toolbar.contains(e.target)) {
      toolbar.querySelectorAll('.ql-expanded').forEach(p => {
        p.classList.remove('ql-expanded');
        p.querySelector('.ql-picker-options').style.display = 'none';
      });
    }
  };
  document.addEventListener('mousedown', onDocMouseDown);
  toolbar._cleanup = () => document.removeEventListener('mousedown', onDocMouseDown);

  return toolbar;
}

ModifyModeClassifier.register({
  label: 'Slide titles',

  classify(slideEl) {
    const h2 = slideEl.querySelector('h2');
    if (!h2) return { valid: [], warn: [] };
    if (h2.classList.contains('editable-heading-active')) return { valid: [], warn: [] };
    return { valid: [h2], warn: [] };
  },

  activate(h2) {
    if (h2.classList.contains('editable-heading-active')) return true;
    h2.dataset.editableModifiedHeading = 'true';
    h2.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
    h2.dataset.editableModifiedOriginalHtml = h2.innerHTML;
    h2.classList.add('editable-heading-active');

    // Exit modify mode visually (green rings gone, button inactive) but keep
    // the text panel so the formatting toolbar can be shown immediately after.
    exitModifyMode({ resetPanel: false });

    h2.contentEditable = 'true';
    h2.focus();

    const range = document.createRange();
    range.selectNodeContents(h2);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const toolbar = buildHeadingToolbar(h2);
    const textPanel = document.querySelector('.toolbar-panel-text');
    if (textPanel) textPanel.appendChild(toolbar);
    showRightPanel('text');

    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        h2.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        h2.innerHTML = h2.dataset.editableModifiedOriginalHtml;
        h2.blur();
      }
    };
    h2.addEventListener('keydown', onKeyDown);

    h2.addEventListener('blur', () => {
      h2.removeEventListener('keydown', onKeyDown);
      h2.contentEditable = 'false';
      h2.classList.remove('editable-heading-active');
      toolbar._cleanup?.();
      toolbar.remove();
      showRightPanel('default');
    }, { once: true });

    return true; // exitModifyMode already called above; skip it in onValidElementClick
  },

  serialize(text) {
    const headings = Array.from(
      document.querySelectorAll('h2[data-editable-modified-heading="true"]')
    );
    if (!headings.length) return text;

    const chunks = splitIntoSlideChunks(text);

    for (const h2 of headings) {
      const slideIndex = parseInt(h2.dataset.editableModifiedSlide ?? '0', 10);
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      const newText = headingHtmlToMarkdown(h2.innerHTML);
      chunks[chunkIndex] = chunks[chunkIndex].replace(/^## .*/m, `## ${newText}`);
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Fenced div classifier
// ---------------------------------------------------------------------------

const CALLOUT_TYPES = ['callout-note', 'callout-tip', 'callout-warning', 'callout-important', 'callout-caution'];

/**
 * Parse top-level fenced div opening lines from a QMD slide chunk.
 * Returns an array of { lineIndex, closeLineIndex, matchKey, fenceStr, attrsStr }
 * where matchKey is the first class (e.g. ".my-class"), the id (e.g. "#my-id"),
 * or null for truly attribute-free divs (positional matching only).
 * closeLineIndex is the line index of the matching closing fence (or -1 if unclosed).
 *
 * Distinguishes bare `:::` (closing fence) from `::: {}` (opening fence with
 * no attrs) by checking whether the `{...}` token was present in the source.
 *
 * @param {string} chunk
 * @returns {Array<{lineIndex: number, closeLineIndex: number, matchKey: string|null, fenceStr: string, attrsStr: string}>}
 */
function parseFencedDivOpens(chunk) {
  const lines = chunk.split('\n');
  const result = [];
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(:{3,})\s*(\{([^}]*)\})?\s*$/);
    if (!match) continue;

    const fenceLen = match[1].length;
    const hasBraces = match[2] !== undefined; // `::: {}` vs bare `:::`
    const attrsStr = match[3] || '';

    // A bare `:::` (no braces) closes the innermost open fence.
    if (!hasBraces && stack.length > 0 && fenceLen >= stack[stack.length - 1].fenceLen) {
      const top = stack.pop();
      if (top.resultIdx !== undefined) result[top.resultIdx].closeLineIndex = i;
      continue;
    }

    const classes = (attrsStr.match(/\.[a-zA-Z_-][a-zA-Z0-9_-]*/g) || []).map(c => c.slice(1));
    const idMatch = attrsStr.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/);
    const matchKey = classes.length > 0 ? `.${classes[0]}` : (idMatch ? `#${idMatch[1]}` : null);
    const entry = { lineIndex: i, closeLineIndex: -1, matchKey, fenceStr: match[1], attrsStr, depth: stack.length };
    const resultIdx = result.length;
    result.push(entry);
    stack.push({ fenceLen, resultIdx });
  }

  return result.filter(e => e.depth === 0);
}

/**
 * Determine how a div can be identified in QMD source.
 * Returns { key: string|null, type: string } or null if not a fenced div candidate.
 * key is ".classname", "#id", or null (positional match only).
 */
function getFencedDivIdentifier(div) {
  const classes = Array.from(div.classList);

  if (classes.includes('columns')) return { key: '.columns', type: 'columns' };

  for (const ct of CALLOUT_TYPES) {
    if (classes.includes(ct)) return { key: `.${ct}`, type: 'callout' };
  }

  const knownInternal = new Set([
    'callout', 'callout-style-default', 'callout-captioned', 'callout-titled',
    'column', 'columns',
    'fragment', 'current-fragment', 'visible',
    'fade-in', 'fade-out', 'fade-up', 'fade-down', 'fade-left', 'fade-right',
    'absolute', 'editable', 'editable-container', 'editable-new', 'editable-heading-active',
    'modify-mode-valid', 'modify-mode-warn',
    'r-fit-text', 'r-stretch', 'r-frame', 'r-hstack', 'r-vstack',
    'slide-background', 'slide-background-content',
  ]);

  const userClass = classes.find(c => !knownInternal.has(c));
  if (userClass) return { key: `.${userClass}`, type: 'classed' };

  // Fall through to id-based matching (`::: {#my-id}` renders as <div id="my-id">)
  if (div.id) return { key: `#${div.id}`, type: 'id-keyed' };

  // No class or id — positional matching only
  return { key: null, type: 'classless' };
}

/**
 * Build the updated fence opening line with absolute position attrs merged in.
 * Preserves existing classes/attrs on the fence and appends the position data.
 */
function buildFenceLineWithAbsolute(originalLine, dims) {
  const match = originalLine.match(/^(:{3,})\s*(?:\{([^}]*)\})?\s*$/);
  if (!match) return originalLine;

  const fence = match[1];
  const existingAttrs = (match[2] || '').trim();

  const posAttrs = [
    `left=${Math.round(dims.left)}px`,
    `top=${Math.round(dims.top)}px`,
    `width=${Math.round(dims.width)}px`,
    `height=${Math.round(dims.height)}px`,
  ];

  const styleAttrs = [];
  if (dims.rotation) styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);

  let newAttrs = existingAttrs ? `${existingAttrs} ` : '';
  newAttrs += `.absolute ${posAttrs.join(' ')}`;
  if (styleAttrs.length > 0) newAttrs += ` style="${styleAttrs.join(' ')}"`;

  return `${fence} {${newAttrs}}`;
}

ModifyModeClassifier.register({
  label: 'Fenced divs',

  classify(slideEl) {
    if (!window._input_file) return { valid: [], warn: [] };
    const slideIndex = Reveal.getState().indexh;
    const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[chunkIndex];
    if (!chunk) return { valid: [], warn: [] };

    const fencedOpens = parseFencedDivOpens(chunk);
    if (fencedOpens.length === 0) return { valid: [], warn: [] };

    // Collect direct-child divs that aren't already handled by other classifiers
    const candidates = Array.from(slideEl.children).filter(el =>
      el.tagName === 'DIV' &&
      !editableRegistry.has(el) &&
      !el.classList.contains('editable-container') &&
      !el.classList.contains('editable-new') &&
      !el.classList.contains('editable') &&
      !el.classList.contains('absolute')
    );

    const valid = [];
    const warn = [];

    // Track which fenced opens have been claimed (by array index)
    const usedFenceIndices = new Set();
    // Track positional (classless/id-less) fence cursor
    const positionalFences = fencedOpens
      .map((fo, i) => ({ fo, i }))
      .filter(({ fo }) => fo.matchKey === null);
    let positionalCursor = 0;

    for (const div of candidates) {
      const ident = getFencedDivIdentifier(div);
      if (!ident) continue;

      let fenceIdx = -1;
      if (ident.key !== null) {
        // Match by class or id key
        fenceIdx = fencedOpens.findIndex((fo, i) => !usedFenceIndices.has(i) && fo.matchKey === ident.key);
      } else {
        // No class or id — match by position among keyless fenced divs
        while (positionalCursor < positionalFences.length && usedFenceIndices.has(positionalFences[positionalCursor].i)) {
          positionalCursor++;
        }
        if (positionalCursor < positionalFences.length) {
          fenceIdx = positionalFences[positionalCursor].i;
        }
      }

      if (fenceIdx === -1) continue;

      usedFenceIndices.add(fenceIdx);
      div.dataset.editableModifiedFenceIdx = String(fenceIdx);
      div.dataset.editableModifiedFenceType = ident.type;
      valid.push(div);
    }

    return { valid, warn };
  },

  activate(div) {
    const slideIndex = Reveal.getState().indexh;
    div.dataset.editableModifiedFence = 'true';
    div.dataset.editableModifiedSlide = String(slideIndex);

    // Capture natural position in slide-space coordinates before setup reparents
    // the element into the absolute editable-container (which starts at 0,0).
    const slideEl = div.closest('section');
    const scale = getSlideScale();
    const divRect   = div.getBoundingClientRect();
    const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
    const origLeft = (divRect.left - slideRect.left) / scale;
    const origTop  = (divRect.top  - slideRect.top)  / scale;

    if (div.dataset.editableModifiedFenceType === 'columns') {
      setCapabilityOverride(div, ['move', 'resize', 'rotate']);
      // Read natural dimensions at click time, before setup reparents into the
      // inline-block container (collapses width) and sets display:block (breaks flex).
      const naturalWidth  = div.offsetWidth;
      const naturalHeight = div.offsetHeight;
      setupDivWhenReady(div);
      div.style.display = 'flex';
      editableRegistry.get(div)?.setState({ width: naturalWidth, height: naturalHeight, x: origLeft, y: origTop });
    } else {
      setupDivWhenReady(div);
      waitForRegistryThenFixPosition(div, origLeft, origTop);
    }
  },

  serialize(text) {
    const divs = Array.from(
      document.querySelectorAll('div[data-editable-modified-fence="true"]')
    );
    if (divs.length === 0) return text;

    const chunks = splitIntoSlideChunks(text);

    // Group by chunk, then replace fence lines
    const byChunk = new Map();
    for (const div of divs) {
      if (!editableRegistry.has(div)) continue;
      const slideIndex = parseInt(div.dataset.editableModifiedSlide ?? '0', 10);
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      if (!byChunk.has(chunkIndex)) byChunk.set(chunkIndex, []);
      byChunk.get(chunkIndex).push(div);
    }

    for (const [chunkIndex, chunkDivs] of byChunk) {
      // Re-parse once per chunk (source may have been modified by other serializers)
      const fencedOpens = parseFencedDivOpens(chunks[chunkIndex]);

      // Build list of operations and sort bottom-to-top so splices don't shift earlier indices
      const ops = [];
      for (const div of chunkDivs) {
        const fenceIdx = parseInt(div.dataset.editableModifiedFenceIdx ?? '-1', 10);
        if (fenceIdx < 0) continue;
        const openEntry = fencedOpens[fenceIdx];
        if (!openEntry) continue;
        const dims = editableRegistry.get(div).toDimensions();
        const isCallout = div.dataset.editableModifiedFenceType === 'callout';
        ops.push({ openEntry, dims, isCallout });
      }
      // Process from bottom to top so insertions don't shift line indices of earlier ops
      ops.sort((a, b) => b.openEntry.lineIndex - a.openEntry.lineIndex);

      const lines = chunks[chunkIndex].split('\n');

      for (const { openEntry, dims, isCallout } of ops) {
        if (isCallout && openEntry.closeLineIndex >= 0) {
          // Callout: wrap the entire callout block with a positioned div.
          // Quarto's callout renderer ignores positional attrs on the callout fence itself,
          // so we need an outer ::: {.absolute ...} wrapper.
          // Use :::: (4+ colons) as the outer fence to avoid clashing with inner ::: fences.
          //
          // Height is intentionally omitted: callout height is determined by content.
          // The block-level callout fills container width automatically; saving an explicit
          // height would cause a mismatch since the callout renders at content height after
          // re-render regardless of the wrapper's height.
          const posAttrs = [
            `left=${Math.round(dims.left)}px`,
            `top=${Math.round(dims.top)}px`,
            `width=${Math.round(dims.width)}px`,
          ];
          const styleAttrs = [];
          if (dims.rotation) styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
          let wrapAttrs = `.absolute ${posAttrs.join(' ')}`;
          if (styleAttrs.length > 0) wrapAttrs += ` style="${styleAttrs.join(' ')}"`;

          lines.splice(openEntry.closeLineIndex + 1, 0, '::::');
          lines.splice(openEntry.lineIndex, 0, `:::: {${wrapAttrs}}`);
        } else {
          // Plain fenced div: modify the fence line in-place
          lines[openEntry.lineIndex] = buildFenceLineWithAbsolute(lines[openEntry.lineIndex], dims);
        }
      }

      chunks[chunkIndex] = lines.join('\n');
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Plain paragraph classifier
// ---------------------------------------------------------------------------

/**
 * Extract top-level paragraph blocks from a QMD slide chunk.
 * Returns an array of { startLine, endLine, text } for each block.
 * Only blocks at depth 0 (outside fenced divs and code fences) are returned.
 * Blocks containing markdown image syntax (`![...](...)`) are skipped to keep
 * indices aligned with the paragraph classifier, which excludes <p> elements
 * containing <img>.
 * @param {string} chunk
 * @returns {Array<{startLine: number, endLine: number, text: string}>}
 */
export function extractParagraphBlocks(chunk) {
  const lines = chunk.split('\n');
  const blocks = [];
  let depth = 0;
  let inCodeBlock = false;
  let blockStart = -1;
  const blockLines = [];

  const commitBlock = () => {
    if (blockLines.length > 0) {
      const text = blockLines.join('\n');
      if (!/!\[[^\]]*\]\(/.test(text)) {
        blocks.push({
          startLine: blockStart,
          endLine: blockStart + blockLines.length - 1,
          text,
        });
      }
    }
    blockStart = -1;
    blockLines.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      commitBlock();
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
    if (fenceMatch) {
      commitBlock();
      const hasBraces = fenceMatch[2] !== undefined;
      if (!hasBraces && depth > 0) {
        depth--;
      } else {
        depth++;
      }
      continue;
    }

    if (depth > 0) continue;
    if (trimmed.startsWith('#')) { commitBlock(); continue; }
    if (trimmed === '') { commitBlock(); continue; }

    if (blockStart === -1) blockStart = i;
    blockLines.push(line);
  }
  commitBlock();

  return blocks;
}

ModifyModeClassifier.register({
  label: 'Paragraphs',

  classify(slideEl) {
    // Skip <p> elements that contain an <img>: standalone images (`![](src)`) and
    // inline images (`text ![](src) text`) both render as <img> inside <p>, and the
    // image classifier handles them directly. Marking the wrapping <p> would create
    // overlapping click targets and let the user wrap the image in a fenced div,
    // which produces a much messier write-back than just adding {.absolute} to the
    // image markdown.
    const candidates = Array.from(slideEl.children).filter(el =>
      el.tagName === 'P' &&
      !editableRegistry.has(el) &&
      !el.classList.contains('absolute') &&
      !el.querySelector('img')
    );

    const valid = [];
    let idx = 0;
    for (const p of candidates) {
      p.dataset.editableModifiedParagraphIdx = String(idx++);
      valid.push(p);
    }
    return { valid, warn: [] };
  },

  activate(p) {
    const slideIndex = Reveal.getState().indexh;
    const slideEl = p.closest('section');
    const scale = getSlideScale();
    const pRect = p.getBoundingClientRect();
    const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
    const origLeft = (pRect.left - slideRect.left) / scale;
    const origTop  = (pRect.top  - slideRect.top)  / scale;

    p.dataset.editableModifiedParagraph = 'true';
    p.dataset.editableModifiedSlide = String(slideIndex);
    // editableModifiedParagraphIdx already set by classify()

    initializeQuillForElement(p);
    setupDivWhenReady(p);
    waitForRegistryThenFixPosition(p, origLeft, origTop);
  },

  serialize(text) {
    const paras = Array.from(
      document.querySelectorAll('p[data-editable-modified-paragraph="true"]')
    );
    if (paras.length === 0) return text;

    const chunks = splitIntoSlideChunks(text);

    const byChunk = new Map();
    for (const p of paras) {
      if (!editableRegistry.has(p)) continue;
      const slideIndex = parseInt(p.dataset.editableModifiedSlide ?? '0', 10);
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      if (!byChunk.has(chunkIndex)) byChunk.set(chunkIndex, []);
      byChunk.get(chunkIndex).push(p);
    }

    for (const [chunkIndex, chunkParas] of byChunk) {
      chunkParas.sort((a, b) =>
        parseInt(a.dataset.editableModifiedParagraphIdx ?? '0', 10) -
        parseInt(b.dataset.editableModifiedParagraphIdx ?? '0', 10)
      );

      const paraBlocks = extractParagraphBlocks(chunks[chunkIndex]);
      const lines = chunks[chunkIndex].split('\n');

      // Process bottom-to-top so line splices don't shift earlier indices
      for (let i = chunkParas.length - 1; i >= 0; i--) {
        const p = chunkParas[i];
        const paraIdx = parseInt(p.dataset.editableModifiedParagraphIdx ?? '0', 10);
        if (paraIdx >= paraBlocks.length) continue;

        const block = paraBlocks[paraIdx];
        const dims = editableRegistry.get(p).toDimensions();

        // Use Quill output if text was edited; otherwise preserve original QMD text
        const content = p.querySelector('.ql-editor')
          ? elementToText(p)
          : block.text;

        const posAttrs = [
          `left=${Math.round(dims.left)}px`,
          `top=${Math.round(dims.top)}px`,
          `width=${Math.round(dims.width)}px`,
          `height=${Math.round(dims.height)}px`,
        ];
        const styleAttrs = [];
        if (dims.rotation) styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
        let attrs = `.absolute ${posAttrs.join(' ')}`;
        if (styleAttrs.length) attrs += ` style="${styleAttrs.join(' ')}"`;

        const blockLineCount = block.endLine - block.startLine + 1;
        lines.splice(block.startLine, blockLineCount,
          `::: {${attrs}}`,
          content,
          ':::',
        );
      }

      chunks[chunkIndex] = lines.join('\n');
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Lists and blockquotes classifiers
// ---------------------------------------------------------------------------

/**
 * Extract top-level blocks from a QMD slide chunk whose first line matches testLine.
 * Used to locate ul, ol, and blockquote blocks by position.
 * @param {string} chunk
 * @param {function(string): boolean} testLine - returns true if a line starts a new block
 * @returns {Array<{startLine: number, endLine: number, text: string}>}
 */
function extractBlocksStartingWith(chunk, testLine) {
  const lines = chunk.split('\n');
  const blocks = [];
  let depth = 0;
  let inCodeBlock = false;
  let blockStart = -1;
  const blockLines = [];

  const commitBlock = () => {
    if (blockLines.length > 0) {
      blocks.push({
        startLine: blockStart,
        endLine: blockStart + blockLines.length - 1,
        text: blockLines.join('\n'),
      });
    }
    blockStart = -1;
    blockLines.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) { commitBlock(); inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;

    const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
    if (fenceMatch) {
      commitBlock();
      const hasBraces = fenceMatch[2] !== undefined;
      if (!hasBraces && depth > 0) depth--; else depth++;
      continue;
    }

    if (depth > 0) continue;
    if (trimmed === '') { commitBlock(); continue; }

    if (blockStart === -1) {
      if (testLine(line)) { blockStart = i; blockLines.push(line); }
    } else {
      blockLines.push(line);
    }
  }
  commitBlock();
  return blocks;
}

/**
 * Build a classifier for block-level list/blockquote elements.
 * @param {object} opts
 * @param {string} opts.tagName - uppercase tag name: 'UL', 'OL', 'BLOCKQUOTE'
 * @param {string} opts.dataKey - camelCase key used for dataset attrs (e.g. 'Ul')
 * @param {function(string): boolean} opts.testLine - identifies the first line of a source block
 * @param {string} opts.label - label shown in the modify panel
 */
function makeListClassifier({ tagName, dataKey, testLine, label }) {
  const idxAttr = `editableModified${dataKey}Idx`;
  const activeAttr = `editableModified${dataKey}`;

  return {
    label,

    classify(slideEl) {
      const candidates = Array.from(slideEl.children).filter(el =>
        el.tagName === tagName &&
        !editableRegistry.has(el) &&
        !el.classList.contains('absolute')
      );
      const valid = [];
      let idx = 0;
      for (const el of candidates) {
        el.dataset[idxAttr] = String(idx++);
        valid.push(el);
      }
      return { valid, warn: [] };
    },

    activate(el) {
      const slideIndex = Reveal.getState().indexh;
      const slideEl = el.closest('section');
      const scale = getSlideScale();
      const elRect = el.getBoundingClientRect();
      const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
      const origLeft = (elRect.left - slideRect.left) / scale;
      const origTop  = (elRect.top  - slideRect.top)  / scale;

      const cs = window.getComputedStyle(el);
      // Use getBoundingClientRect (already computed as elRect) for sub-pixel accuracy.
      // offsetWidth truncates to integer and causes text to wrap when the true
      // content width is fractional (e.g. 208.28px rounds to 208px).
      const naturalW = elRect.width / scale;
      const naturalH = elRect.height / scale;
      el.style.paddingLeft   = cs.paddingLeft;
      el.style.paddingRight  = cs.paddingRight;
      el.style.paddingTop    = cs.paddingTop;
      el.style.paddingBottom = cs.paddingBottom;
      el.style.margin        = '0';
      el.style.width         = naturalW + 'px';
      el.style.height        = naturalH + 'px';
      el.style.display       = 'block';

      el.dataset[activeAttr] = 'true';
      el.dataset.editableModifiedSlide = String(slideIndex);
      setCapabilityOverride(el, ['move', 'resize']);
      setupDivWhenReady(el);

      waitForRegistryThenFixPosition(el, origLeft, origTop);
    },

    serialize(text) {
      const htmlAttr = `data-editable-modified-${dataKey.toLowerCase()}`;
      const els = Array.from(
        document.querySelectorAll(`${tagName.toLowerCase()}[${htmlAttr}="true"]`)
      );
      if (els.length === 0) return text;

      const chunks = splitIntoSlideChunks(text);
      const byChunk = new Map();

      for (const el of els) {
        if (!editableRegistry.has(el)) continue;
        const slideIndex = parseInt(el.dataset.editableModifiedSlide ?? '0', 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length) continue;
        if (!byChunk.has(chunkIndex)) byChunk.set(chunkIndex, []);
        byChunk.get(chunkIndex).push(el);
      }

      for (const [chunkIndex, chunkEls] of byChunk) {
        chunkEls.sort((a, b) =>
          parseInt(a.dataset[idxAttr] ?? '0', 10) -
          parseInt(b.dataset[idxAttr] ?? '0', 10)
        );

        const blocks = extractBlocksStartingWith(chunks[chunkIndex], testLine);
        const lines = chunks[chunkIndex].split('\n');

        for (let i = chunkEls.length - 1; i >= 0; i--) {
          const el = chunkEls[i];
          const elIdx = parseInt(el.dataset[idxAttr] ?? '0', 10);
          if (elIdx >= blocks.length) continue;

          const block = blocks[elIdx];
          const dims = editableRegistry.get(el).toDimensions();

          const posAttrs = [
            `left=${Math.round(dims.left)}px`,
            `top=${Math.round(dims.top)}px`,
            `width=${Math.round(dims.width)}px`,
            `height=${Math.round(dims.height)}px`,
          ];
          const styleAttrs = [];
          if (dims.rotation) styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
          let attrs = `.absolute ${posAttrs.join(' ')}`;
          if (styleAttrs.length) attrs += ` style="${styleAttrs.join(' ')}"`;

          const blockLineCount = block.endLine - block.startLine + 1;
          lines.splice(block.startLine, blockLineCount,
            `::: {${attrs}}`,
            block.text,
            ':::',
          );
        }

        chunks[chunkIndex] = lines.join('\n');
      }

      return chunks.join('');
    },
  };
}

ModifyModeClassifier.register(makeListClassifier({
  tagName: 'UL',
  dataKey: 'Ul',
  testLine: (line) => /^[-*+] /.test(line),
  label: 'Bullet lists',
}));

ModifyModeClassifier.register(makeListClassifier({
  tagName: 'OL',
  dataKey: 'Ol',
  testLine: (line) => /^\d+[.)]\s/.test(line),
  label: 'Ordered lists',
}));

ModifyModeClassifier.register(makeListClassifier({
  tagName: 'BLOCKQUOTE',
  dataKey: 'Blockquote',
  testLine: (line) => /^>/.test(line),
  label: 'Blockquotes',
}));

// ---------------------------------------------------------------------------
// Positioned arrow classifier
// ---------------------------------------------------------------------------

/**
 * Kwargs the editable arrow system understands. Arrows whose shortcodes use
 * other kwargs (bend, fragment, aria-label, …) are classified as warn so we
 * don't silently drop those values during write-back.
 */
const SUPPORTED_ARROW_KWARGS = new Set([
  'from', 'to', 'control1', 'control2',
  'waypoints', 'smooth',
  'color', 'width', 'head', 'dash', 'line', 'opacity',
  'label', 'label-position', 'label-offset',
  'position',
]);

/**
 * Parse `key=value` pairs from a shortcode body. Supports double-quoted,
 * single-quoted, and unquoted values.
 * @param {string} body - The body between `{{< arrow ` and ` >}}`
 * @returns {Object<string,string>} Map of kwarg name → string value
 */
function parseArrowKwargs(body) {
  const kwargs = {};
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const value = m[2] !== undefined ? m[2]
                : m[3] !== undefined ? m[3]
                : m[4];
    kwargs[m[1]] = value;
  }
  return kwargs;
}

/**
 * Parse a "x,y" point string into {x, y} numbers, or null if invalid.
 */
function parseArrowPoint(s) {
  if (!s) return null;
  const parts = s.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { x: parts[0], y: parts[1] };
}

/**
 * Parse a `waypoints` value into an array of {x, y} points.
 * Accepts space-separated `x,y` pairs (e.g. `"100,50 200,80"`).
 */
function parseArrowWaypoints(s) {
  if (!s) return [];
  return s.trim().split(/\s+/)
    .map(parseArrowPoint)
    .filter(p => p !== null);
}

/**
 * Extract every `{{< arrow ... >}}` shortcode from a slide chunk.
 * Returns each occurrence in source order with its parsed kwargs and the
 * literal substring as it appeared in the source (so `serialize()` can match
 * and replace it without normalising whitespace or attribute order).
 *
 * @param {string} chunk
 * @returns {Array<{raw: string, body: string, kwargs: Object, index: number}>}
 *   `raw` is the full `{{< … >}}` literal, `index` is its character offset
 *   within `chunk`.
 */
export function parseArrowShortcodes(chunk) {
  const re = /\{\{<\s*arrow\s+([^>]*?)\s*>\}\}/g;
  const out = [];
  let m;
  while ((m = re.exec(chunk)) !== null) {
    out.push({
      raw: m[0],
      body: m[1],
      kwargs: parseArrowKwargs(m[1]),
      index: m.index,
    });
  }
  return out;
}

/**
 * Filter a list of parsed shortcodes to those that render as a positioned
 * (block-level) arrow div: only `position="absolute"` (or `"fixed"`) qualifies.
 */
function filterPositionedArrows(shortcodes) {
  return shortcodes.filter(sc =>
    sc.kwargs.position === 'absolute' || sc.kwargs.position === 'fixed'
  );
}

/**
 * Detect kwargs the editable system would silently drop on round-trip.
 * Returns the list of unsupported kwarg names (empty if all are supported).
 */
function unsupportedArrowKwargs(kwargs) {
  return Object.keys(kwargs).filter(k => !SUPPORTED_ARROW_KWARGS.has(k));
}

/**
 * Build an arrowData object compatible with createArrowElement() from
 * a parsed shortcode kwargs map. Falls back to defaults that match
 * addNewArrow() for any kwarg not present in the source.
 */
function arrowDataFromKwargs(kwargs) {
  const from = parseArrowPoint(kwargs.from) || { x: 0, y: 0 };
  const to   = parseArrowPoint(kwargs.to)   || { x: 0, y: 0 };
  const c1   = parseArrowPoint(kwargs.control1);
  const c2   = parseArrowPoint(kwargs.control2);
  const waypoints = parseArrowWaypoints(kwargs.waypoints);

  const numOr = (v, d) => {
    if (v === undefined || v === null || v === '') return d;
    const n = parseFloat(v);
    return isNaN(n) ? d : n;
  };

  return {
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    control1X: c1 ? c1.x : null,
    control1Y: c1 ? c1.y : null,
    control2X: c2 ? c2.x : null,
    control2Y: c2 ? c2.y : null,
    curveMode: !!(c1 || c2),
    waypoints,
    smooth: kwargs.smooth === 'true' || kwargs.smooth === true,
    color: kwargs.color || CONFIG.ARROW_DEFAULT_COLOR,
    width: numOr(kwargs.width, CONFIG.ARROW_DEFAULT_WIDTH),
    head: kwargs.head || 'arrow',
    dash: kwargs.dash || 'solid',
    line: kwargs.line || 'single',
    opacity: numOr(kwargs.opacity, 1),
    label: kwargs.label || '',
    labelPosition: kwargs['label-position'] || CONFIG.ARROW_DEFAULT_LABEL_POSITION,
    labelOffset: numOr(kwargs['label-offset'], CONFIG.ARROW_DEFAULT_LABEL_OFFSET),
    isActive: false,
  };
}

/**
 * Module-level list of arrows that have been activated from previous-save
 * shortcodes. Distinct from `NewElementRegistry.newArrows` (in-session
 * insertions) because write-back is in-place replacement of an existing
 * shortcode rather than appending a new one to the chunk.
 *
 * Each entry: { arrowData, sourceEl, slideIndex, sourceLiteral, occurrence }
 *   - arrowData: the editable arrow's data object (live)
 *   - sourceEl:  the original positioned div from the rendered slide (hidden)
 *   - slideIndex: Reveal.getState().indexh at activate time
 *   - sourceLiteral: exact `{{< arrow … >}}` string from the source chunk
 *   - occurrence: 0-based index among identical sourceLiteral strings in chunk
 */
const _modifiedArrows = [];

/**
 * Tracks arrow paths whose pointer-events we overrode during classification
 * so we can restore them on exit.  quarto-arrows emits arrows with the
 * wrapping div at `pointer-events: none` (so they don't intercept clicks
 * during a presentation).  Modify mode needs them clickable, but only on
 * the actual painted line — empty space inside an arrow's SVG bounding box
 * must remain click-through, otherwise diagonal or curved arrows (with
 * large bboxes) would swallow clicks meant for another arrow whose visible
 * line happens to fall inside their bbox.
 *
 * The approach: leave the wrapping div at `pointer-events: none` and the
 * outer SVG at its default.  Set `pointer-events: auto` on each visible
 * `<path>` element only — paths default to hit-testing on painted pixels
 * (`visiblePainted`), so empty SVG space stays click-through, while clicks
 * on the painted line catch on the path and bubble up to the click listener
 * attached to the wrapping div by `applyClassification`.  (Bubbling fires
 * the div listener regardless of the div's own `pointer-events: none`,
 * which only controls the div's own hit-testing target.)
 */
const _arrowsWithPointerEventsCleared = new Set();

/**
 * Find positioned arrow divs on the current slide that render a quarto-arrows
 * shortcode (have an SVG with a `<defs><marker id="arrow-…">` directly inside).
 * Excludes session-added arrows (marked with `editable-arrow-container`) and
 * already-activated source arrows.
 */
function findPositionedArrowDivs(slideEl) {
  const all = slideEl.querySelectorAll('div[style*="position: absolute"]');
  const out = [];
  for (const el of all) {
    if (el.classList.contains('editable-arrow-container')) continue;
    if (el.dataset.editableModifiedArrow === 'true') continue;
    if (el.dataset.editableModifiedArrowHidden === 'true') continue;
    const svg = el.querySelector(':scope > svg');
    if (!svg) continue;
    if (!svg.querySelector(':scope > defs > marker[id^="arrow-"]')) continue;
    out.push(el);
  }
  return out;
}

ModifyModeClassifier.register({
  label: 'Positioned arrows',

  classify(slideEl) {
    // Restore pointer-events on any arrow paths we touched in a previous
    // classification pass (e.g. user navigated away without clicking).
    for (const path of _arrowsWithPointerEventsCleared) {
      path.style.pointerEvents = '';
    }
    _arrowsWithPointerEventsCleared.clear();

    if (!window._input_file) return { valid: [], warn: [] };
    const slideIndex = Reveal.getState().indexh;
    const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[chunkIndex];
    if (!chunk) return { valid: [], warn: [] };

    const shortcodes = parseArrowShortcodes(chunk);
    const positioned = filterPositionedArrows(shortcodes);
    if (positioned.length === 0) return { valid: [], warn: [] };

    const divs = findPositionedArrowDivs(slideEl);
    if (divs.length === 0) return { valid: [], warn: [] };

    // Positional match: Nth shortcode → Nth div, in source/DOM order.
    // If counts differ (e.g. fragment-wrapped arrows produce extra spans, or
    // a styling option emits a wrapping element), pair as many as we can and
    // skip the rest.
    const pairCount = Math.min(positioned.length, divs.length);

    const valid = [];
    const warn  = [];

    // Track occurrence counts of identical literal shortcodes for write-back.
    const literalCounts = new Map();

    for (let i = 0; i < pairCount; i++) {
      const sc = positioned[i];
      const div = divs[i];
      const unsupported = unsupportedArrowKwargs(sc.kwargs);
      if (unsupported.length > 0) {
        warn.push({
          el: div,
          reason: `Arrow uses attributes not yet supported in modify mode: ${unsupported.join(', ')}`,
        });
        continue;
      }

      const occurrence = literalCounts.get(sc.raw) ?? 0;
      literalCounts.set(sc.raw, occurrence + 1);

      // Stamp source data for activate() and serialize().
      div.dataset.editableModifiedArrowSource = sc.raw;
      div.dataset.editableModifiedArrowOccurrence = String(occurrence);
      div.dataset.editableModifiedArrowKwargs = JSON.stringify(sc.kwargs);

      // Enable pointer events on every `<path>` inside the SVG.  Paths
      // default to `visiblePainted`, so only clicks on the actually painted
      // line/marker fire — empty SVG space stays click-through, which keeps
      // overlapping-arrow bboxes from swallowing clicks.  The wrapping div
      // and outer SVG are left at their defaults (none / visiblePainted)
      // so they don't intercept the bbox.  Click events bubble up from the
      // path to the click listener attached in applyClassification.
      div.querySelectorAll('svg path').forEach(p => {
        p.style.pointerEvents = 'auto';
        _arrowsWithPointerEventsCleared.add(p);
      });

      valid.push(div);
    }

    return { valid, warn };
  },

  activate(div) {
    const slideEl = div.closest('section');
    if (!slideEl) return;

    const kwargsJson = div.dataset.editableModifiedArrowKwargs;
    if (!kwargsJson) return;

    let kwargs;
    try { kwargs = JSON.parse(kwargsJson); } catch (e) { return; }

    const slideIndex = Reveal.getState().indexh;
    const arrowData = arrowDataFromKwargs(kwargs);
    arrowData.isActive = true;

    // Hide the source-rendered arrow (don't remove — keeping it preserves the
    // ordering anchor used by classify() if the user re-enters modify mode).
    div.dataset.editableModifiedArrowHidden = 'true';
    div.style.display = 'none';

    // Exit modify mode visually (rings off, button inactive) but don't reset
    // the toolbar panel — createArrowElement → setActiveArrow opens the arrow
    // style panel below, and we want it to stay visible so the user can see
    // the source's color/width/etc.  Without this, the default
    // exitModifyMode() that runs after activate() returns falsy would call
    // showRightPanel('default') and hide the arrow controls.
    exitModifyMode({ resetPanel: false });

    const arrowContainer = createArrowElement(arrowData);
    slideEl.appendChild(arrowContainer);
    arrowData.element = arrowContainer;
    arrowContainer.classList.remove('editable-new');

    _modifiedArrows.push({
      arrowData,
      sourceEl: div,
      slideIndex,
      sourceLiteral: div.dataset.editableModifiedArrowSource,
      occurrence: parseInt(div.dataset.editableModifiedArrowOccurrence ?? '0', 10),
    });

    setActiveArrow(arrowData);
    return true; // we already called exitModifyMode; skip the default exit
  },

  serialize(text) {
    if (_modifiedArrows.length === 0) return text;
    const chunks = splitIntoSlideChunks(text);

    // Group by chunk index so we can apply replacements per slide.
    const byChunk = new Map();
    for (const entry of _modifiedArrows) {
      const chunkIndex = getQmdHeadingIndex(entry.slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      if (!byChunk.has(chunkIndex)) byChunk.set(chunkIndex, []);
      byChunk.get(chunkIndex).push(entry);
    }

    for (const [chunkIndex, entries] of byChunk) {
      // Process longest source-literals first so a shorter literal that is a
      // substring of a longer one can't accidentally match the wrong span.
      // Within identical literals, sort by occurrence so the n-th replacement
      // targets the n-th appearance.
      entries.sort((a, b) => {
        if (a.sourceLiteral.length !== b.sourceLiteral.length) {
          return b.sourceLiteral.length - a.sourceLiteral.length;
        }
        return a.occurrence - b.occurrence;
      });

      // Per-literal replacement counters: track how many times we've already
      // consumed each unique sourceLiteral so identical-literal occurrences
      // line up with their occurrence stamps.
      const consumed = new Map();
      for (const entry of entries) {
        const replacement = serializeArrowToShortcode(entry.arrowData);
        const literal = entry.sourceLiteral;
        const skipCount = consumed.get(literal) ?? 0;

        let chunk = chunks[chunkIndex];
        let searchFrom = 0;
        let hit = -1;
        for (let i = 0; i <= skipCount; i++) {
          hit = chunk.indexOf(literal, searchFrom);
          if (hit === -1) break;
          searchFrom = hit + literal.length;
        }
        if (hit === -1) continue;

        chunks[chunkIndex] = chunk.slice(0, hit) + replacement + chunk.slice(hit + literal.length);
        consumed.set(literal, skipCount + 1);
      }
    }

    return chunks.join('');
  },

  cleanup() {
    // Restore path pointer-events to the inherited (none) value so arrows
    // don't intercept clicks once modify mode is closed.  Activated arrows'
    // source divs are display:none, so it doesn't matter whether their
    // paths get reset or not.
    for (const path of _arrowsWithPointerEventsCleared) {
      path.style.pointerEvents = '';
    }
    _arrowsWithPointerEventsCleared.clear();
  },
});

// ---------------------------------------------------------------------------
// Classification and lifecycle
// ---------------------------------------------------------------------------

/**
 * Run all registered classifiers against the current slide and return the
 * combined valid/warn lists.
 * @returns {{ valid: Array<{el: Element, classifier: Classifier}>, warn: Element[] }}
 */
function classifyElements() {
  const reveal = document.querySelector('.reveal');
  const currentSlide = reveal?.querySelector('.slides section.present:not(.slide-background)') ?? reveal;

  const valid = [];
  const warn  = [];

  for (const classifier of _classifiers) {
    const result = classifier.classify(currentSlide);
    result.valid.forEach(el => valid.push({ el, classifier }));
    result.warn.forEach(({ el, reason }) => {
      warn.push(el);
      _warnReasons.set(el, reason);
    });
  }

  return { valid, warn };
}

/**
 * (Re-)classify elements and attach click handlers.
 * Called on entry and on every slide change.
 */
function applyClassification() {
  document.querySelectorAll(`.${VALID_CLASS}, .${WARN_CLASS}`).forEach(el => {
    el.classList.remove(VALID_CLASS, WARN_CLASS);
  });
  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;

  const { valid, warn } = classifyElements();

  valid.forEach(({ el, classifier }) => {
    el.classList.add(VALID_CLASS);
    el.addEventListener('click', (e) => onValidElementClick(e, classifier), { signal });
  });
  warn.forEach(el => el.classList.add(WARN_CLASS));

}

/**
 * Populate the modify panel with the list of activatable element types.
 * Called each time modify mode is entered so the list reflects current classifiers.
 */
function buildModifyPanel() {
  const panel = document.querySelector('.toolbar-panel-modify');
  if (!panel) return;
  panel.innerHTML = '';
}

/**
 * Enter modify mode: classify elements, attach click handlers, and listen for
 * slide changes so classification stays current as the user navigates.
 */
export function enterModifyMode() {
  _active = true;
  document.querySelector('.reveal')?.classList.add(ROOT_CLASS);
  buildModifyPanel();
  showRightPanel('modify');
  applyClassification();
  Reveal.on('slidechanged', applyClassification);
}

/**
 * Exit modify mode: remove all classification classes, listeners, and the
 * toolbar active state.
 */
export function exitModifyMode({ resetPanel = true } = {}) {
  _active = false;
  document.querySelector('.reveal')?.classList.remove(ROOT_CLASS);
  Reveal.off('slidechanged', applyClassification);
  abortController?.abort();
  abortController = null;

  for (const classifier of _classifiers) {
    if (typeof classifier.cleanup === 'function') classifier.cleanup();
  }

  document.querySelectorAll(`.${VALID_CLASS}, .${WARN_CLASS}`).forEach(el => {
    el.classList.remove(VALID_CLASS, WARN_CLASS);
  });

  document.querySelector('.toolbar-modify')?.classList.remove('active');
  if (resetPanel) showRightPanel('default');
}

/**
 * Toggle modify mode on/off and sync the toolbar button.
 */
export function toggleModifyMode() {
  if (_active) {
    exitModifyMode();
  } else {
    enterModifyMode();
    document.querySelector('.toolbar-modify')?.classList.add('active');
  }
}

/**
 * Handle click on a valid element in modify mode.
 * Activates the element and exits modify mode.
 * @param {MouseEvent}  e
 * @param {Classifier}  classifier
 */
function onValidElementClick(e, classifier) {
  e.stopPropagation();
  const el = e.currentTarget;
  const stayActive = classifier.activate(el);
  if (!stayActive) exitModifyMode();
}
