/**
 * Modify mode: click any plain image to make it editable.
 * Activated via the toolbar "Modify" button.
 *
 * Images are classified into three buckets:
 *   valid        — plain image whose src is in the QMD source; green ring
 *   warn         — chunk figure from a multi-figure chunk; amber ring, not clickable
 *   (ignored)    — already editable, or chunk figure that is safe to target
 *                  (single-figure chunk figures are currently treated as invalid
 *                   until chunk write-back is implemented)
 * @module modify-mode
 */

import { editableRegistry } from './editable-element.js';
import { setupImageWhenReady } from './element-setup.js';

const VALID_CLASS = 'modify-mode-valid';
const WARN_CLASS  = 'modify-mode-warn';
const ROOT_CLASS  = 'modify-mode';

/** @type {AbortController|null} Cleans up click listeners on exit */
let abortController = null;

/**
 * Get the effective src of an image, checking both src and data-src
 * (Reveal.js uses data-src for lazy loading).
 * @param {HTMLImageElement} img
 * @returns {string|null}
 */
export function getImgSrc(img) {
  return img.getAttribute('src') || img.getAttribute('data-src') || null;
}

/**
 * Check whether an img src appears literally in the QMD source.
 * @param {HTMLImageElement} img
 * @returns {boolean}
 */
function srcInQmdSource(img) {
  if (!window._input_file) return false;
  const src = getImgSrc(img);
  return !!src && window._input_file.includes(src);
}

/**
 * Extract the chunk prefix from a computed figure path.
 * e.g. "files/figure-revealjs/named-multi-2.png" → "named-multi"
 *      "files/figure-revealjs/unnamed-chunk-2-1.png" → "unnamed-chunk-2"
 * Returns null if the src doesn't look like a chunk figure path.
 * @param {string} src
 * @returns {string|null}
 */
function getChunkPrefix(src) {
  const match = src.match(/figure-revealjs\/(.+)-\d+\.png$/);
  return match ? match[1] : null;
}

/**
 * Build a map of chunk prefix → count of figures with that prefix
 * across all imgs on the slide.
 * @param {HTMLImageElement[]} imgs
 * @returns {Map<string, number>}
 */
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
 * Classify all <img> elements on the current slide into three buckets:
 *   valid — plain image whose src is in the QMD source
 *   warn  — chunk figure from a multi-figure chunk
 * Already-editable images and single-figure chunk images are skipped.
 * @returns {{ valid: HTMLImageElement[], warn: HTMLImageElement[] }}
 */
function classifyImages() {
  const reveal = document.querySelector('.reveal');
  const currentSlide = reveal?.querySelector('.slides .present');
  const imgs = currentSlide
    ? Array.from(currentSlide.querySelectorAll('img'))
    : Array.from(document.querySelectorAll('.reveal .slides img'));

  const prefixCounts = buildChunkPrefixCounts(imgs);

  const valid = [];
  const warn  = [];

  for (const img of imgs) {
    if (editableRegistry.has(img)) continue; // already editable

    const src = getImgSrc(img);
    if (!src) continue;

    const prefix = getChunkPrefix(src);
    if (prefix) {
      // Chunk figure: warn if multi-figure, skip if single-figure (not yet supported)
      if (prefixCounts.get(prefix) > 1) warn.push(img);
    } else if (srcInQmdSource(img)) {
      valid.push(img);
    }
  }

  return { valid, warn };
}

/**
 * Enter modify mode: classify images and attach click handlers.
 */
export function enterModifyMode() {
  document.querySelector('.reveal')?.classList.add(ROOT_CLASS);

  abortController = new AbortController();
  const { signal } = abortController;

  const { valid, warn } = classifyImages();

  valid.forEach(img => {
    img.classList.add(VALID_CLASS);
    img.addEventListener('click', onValidImageClick, { signal, once: true });
  });
  warn.forEach(img => img.classList.add(WARN_CLASS));
}

/**
 * Exit modify mode: remove all classification classes and listeners.
 */
export function exitModifyMode() {
  document.querySelector('.reveal')?.classList.remove(ROOT_CLASS);
  abortController?.abort();
  abortController = null;

  document.querySelectorAll(`.${VALID_CLASS}, .${WARN_CLASS}`).forEach(img => {
    img.classList.remove(VALID_CLASS, WARN_CLASS);
  });
}

/**
 * Handle click on a valid image in modify mode.
 * @param {MouseEvent} e
 */
function onValidImageClick(e) {
  e.stopPropagation();
  const img = e.currentTarget;

  // Store original src and current slide index before setup mutates the element
  img.dataset.editableModifiedSrc = getImgSrc(img);
  img.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
  img.dataset.editableModified = 'true';

  img.classList.remove(VALID_CLASS);
  setupImageWhenReady(img);

  // Exit modify mode after picking one image
  exitModifyMode();

  // Sync toolbar button state
  const btn = document.querySelector('.toolbar-modify');
  btn?.classList.remove('active');
}
