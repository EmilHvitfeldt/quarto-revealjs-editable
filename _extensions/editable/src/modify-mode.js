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
import { setupImageWhenReady, setupDivWhenReady } from './element-setup.js';
import { showRightPanel } from './toolbar.js';
import {
  splitIntoSlideChunks,
  serializeToQmd,
} from './serialization.js';

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

  /** Return the label strings from all registered classifiers that have one. */
  getLabels() {
    return _classifiers.map(c => c.label).filter(Boolean);
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
    // Ensure lazy-loaded images (data-src only) are fetched before setup polls
    // for naturalWidth/offsetWidth — without this, setupImageWhenReady can time
    // out before Reveal.js swaps data-src → src on its own schedule.
    if (!img.getAttribute('src') && img.getAttribute('data-src')) {
      img.src = img.getAttribute('data-src');
    }

    img.dataset.editableModifiedSrc   = getImgSrc(img);
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
      const chunkIndex = slideIndex + 1;
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
  const chunk = chunks[slideIndex + 1];
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
      const chunkIndex = slideIndex + 1;
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
  const currentSlide = reveal?.querySelector('.slides .present') ?? reveal;

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
  const label = document.createElement('span');
  label.className = 'modify-panel-label';
  label.textContent = 'Click to edit:';
  panel.appendChild(label);
  const list = document.createElement('ul');
  list.className = 'modify-panel-list';
  ModifyModeClassifier.getLabels().forEach(text => {
    const item = document.createElement('li');
    item.textContent = text;
    list.appendChild(item);
  });
  panel.appendChild(list);
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
export function exitModifyMode() {
  _active = false;
  document.querySelector('.reveal')?.classList.remove(ROOT_CLASS);
  Reveal.off('slidechanged', applyClassification);
  abortController?.abort();
  abortController = null;

  document.querySelectorAll(`.${VALID_CLASS}, .${WARN_CLASS}`).forEach(el => {
    el.classList.remove(VALID_CLASS, WARN_CLASS);
  });

  document.querySelector('.toolbar-modify')?.classList.remove('active');
  showRightPanel('default');
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
  classifier.activate(el);
  exitModifyMode();
}
