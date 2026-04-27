/**
 * Modify mode: click any plain image to make it editable.
 * Activated via the toolbar "Modify" button.
 *
 * Elements are classified into three buckets:
 *   valid        — element a classifier says can be modified; green ring
 *   warn         — element a classifier says to warn about; amber ring, not clickable
 *   (ignored)    — already editable or not recognised by any classifier
 *
 * New element types can be supported by calling ModifyModeClassifier.register().
 * @module modify-mode
 */

import { editableRegistry } from './editable-element.js';
import { setupImageWhenReady } from './element-setup.js';

const VALID_CLASS = 'modify-mode-valid';
const WARN_CLASS  = 'modify-mode-warn';
const ROOT_CLASS  = 'modify-mode';

/** @type {AbortController|null} Cleans up click listeners on exit */
let abortController = null;

/** Single source of truth for whether modify mode is active */
let _active = false;

export function isModifyModeActive() { return _active; }

// ---------------------------------------------------------------------------
// Classifier registry
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Classifier
 * @property {string}   selector       - CSS selector for elements this classifier handles
 * @property {function(Element): boolean}             canModify  - true → valid (green ring)
 * @property {function(Element): string|null}         warnReason - non-null → warn (amber ring)
 * @property {function(Element): void}                activate   - called when element is clicked
 */

const _classifiers = [];

/**
 * Register a classifier for a new element type.
 * Classifiers are evaluated in registration order; the first match wins.
 * @param {Classifier} classifier
 */
export const ModifyModeClassifier = {
  register(classifier) {
    _classifiers.push(classifier);
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

/**
 * The prefixCounts map must be computed across all slide images before
 * individual elements are classified, so the image classifier uses a
 * slide-scoped classify() instead of per-element predicates.
 *
 * @param {Element} slideEl - The current slide element
 * @returns {{ valid: HTMLImageElement[], warn: HTMLImageElement[] }}
 */
function classifySlideImages(slideEl) {
  const imgs = Array.from(slideEl.querySelectorAll('img'));
  const prefixCounts = buildChunkPrefixCounts(imgs);

  const valid = [];
  const warn  = [];

  for (const img of imgs) {
    if (editableRegistry.has(img)) continue;
    const src = getImgSrc(img);
    if (!src) continue;
    const prefix = getChunkPrefix(src);
    if (prefix) {
      if (prefixCounts.get(prefix) > 1) warn.push(img);
    } else if (srcInQmdSource(img)) {
      valid.push(img);
    }
  }

  return { valid, warn };
}

ModifyModeClassifier.register({
  selector: 'img',

  classify: classifySlideImages,

  activate(img) {
    // Ensure lazy-loaded images (data-src only) are fetched before setup polls
    // for naturalWidth/offsetWidth — without this, setupImageWhenReady can time
    // out before Reveal.js swaps data-src → src on its own schedule.
    if (!img.getAttribute('src') && img.getAttribute('data-src')) {
      img.src = img.getAttribute('data-src');
    }

    img.dataset.editableModifiedSrc = getImgSrc(img);
    img.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
    img.dataset.editableModified = 'true';

    setupImageWhenReady(img);
  },
});

// ---------------------------------------------------------------------------
// Classification and lifecycle
// ---------------------------------------------------------------------------

/**
 * Run all registered classifiers against the current slide and return the
 * combined valid/warn lists paired with their classifier (for activate()).
 * @returns {{ valid: Array<{el: Element, classifier: Classifier}>, warn: Element[] }}
 */
function classifyElements() {
  const reveal = document.querySelector('.reveal');
  const currentSlide = reveal?.querySelector('.slides .present') ?? reveal;

  const valid = [];
  const warn  = [];

  for (const classifier of _classifiers) {
    if (typeof classifier.classify === 'function') {
      // Slide-scoped classify (e.g. image classifier needs cross-element context)
      const result = classifier.classify(currentSlide);
      result.valid.forEach(el => valid.push({ el, classifier }));
      result.warn.forEach(el => warn.push(el));
    } else {
      // Per-element predicates
      Array.from(currentSlide.querySelectorAll(classifier.selector)).forEach(el => {
        if (classifier.canModify(el))        valid.push({ el, classifier });
        else if (classifier.warnReason?.(el)) warn.push(el);
      });
    }
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
 * Enter modify mode: classify elements, attach click handlers, and listen for
 * slide changes so classification stays current as the user navigates.
 */
export function enterModifyMode() {
  _active = true;
  document.querySelector('.reveal')?.classList.add(ROOT_CLASS);
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
 * Stays in modify mode so the user can activate more elements.
 * @param {MouseEvent}  e
 * @param {Classifier}  classifier
 */
function onValidElementClick(e, classifier) {
  e.stopPropagation();
  const el = e.currentTarget;
  el.classList.remove(VALID_CLASS);
  classifier.activate(el);
  // Mode stays active — user can click more elements or dismiss via toolbar button
}
