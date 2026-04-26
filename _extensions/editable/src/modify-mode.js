/**
 * Modify mode: click any plain image to make it editable.
 * Activated via the toolbar "Modify" button.
 * @module modify-mode
 */

import { editableRegistry } from './editable-element.js';
import { setupImageWhenReady } from './element-setup.js';

const VALID_CLASS = 'modify-mode-valid';
const INVALID_CLASS = 'modify-mode-invalid';
const ROOT_CLASS = 'modify-mode';

/** @type {AbortController|null} Cleans up click listeners on exit */
let abortController = null;

/**
 * Get the effective src of an image, checking both src and data-src
 * (Reveal.js uses data-src for lazy loading).
 * @param {HTMLImageElement} img
 * @returns {string|null}
 */
function getImgSrc(img) {
  return img.getAttribute('src') || img.getAttribute('data-src') || null;
}

/**
 * Check whether an img src appears literally in the QMD source.
 * Uses the base64-encoded source injected by the Lua filter.
 * @param {HTMLImageElement} img
 * @returns {boolean}
 */
function srcInQmdSource(img) {
  if (!window._input_file) return false;
  const src = getImgSrc(img);
  return !!src && window._input_file.includes(src);
}

/**
 * Classify all <img> elements on the current slide as valid or invalid.
 * Valid: not already editable, src found in QMD source.
 * @returns {{ valid: HTMLImageElement[], invalid: HTMLImageElement[] }}
 */
function classifyImages() {
  const reveal = document.querySelector('.reveal');
  const currentSlide = reveal?.querySelector('.slides .present');
  const imgs = currentSlide
    ? Array.from(currentSlide.querySelectorAll('img'))
    : Array.from(document.querySelectorAll('.reveal .slides img'));

  const valid = [];
  const invalid = [];
  for (const img of imgs) {
    if (editableRegistry.has(img)) continue; // already editable
    if (srcInQmdSource(img)) {
      valid.push(img);
    } else {
      invalid.push(img);
    }
  }
  return { valid, invalid };
}

/**
 * Enter modify mode: classify images and attach click handlers.
 */
export function enterModifyMode() {
  document.querySelector('.reveal')?.classList.add(ROOT_CLASS);

  abortController = new AbortController();
  const { signal } = abortController;

  const { valid, invalid } = classifyImages();

  valid.forEach(img => {
    img.classList.add(VALID_CLASS);
    img.addEventListener('click', onValidImageClick, { signal, once: true });
  });
  invalid.forEach(img => img.classList.add(INVALID_CLASS));
}

/**
 * Exit modify mode: remove all classify classes and listeners.
 */
export function exitModifyMode() {
  document.querySelector('.reveal')?.classList.remove(ROOT_CLASS);
  abortController?.abort();
  abortController = null;

  document.querySelectorAll(`.${VALID_CLASS}, .${INVALID_CLASS}`).forEach(img => {
    img.classList.remove(VALID_CLASS, INVALID_CLASS);
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
