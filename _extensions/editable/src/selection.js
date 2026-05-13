/**
 * Cross-module selection coordination.
 * Prevents images and arrows from being simultaneously active.
 * Each module registers its own deselect function here.
 * @module selection
 */

/** @type {Function|null} */
let deselectImageFn = null;
/** @type {Function|null} */
let deselectArrowFn = null;

export function registerDeselectImage(fn) { deselectImageFn = fn; }
export function registerDeselectArrow(fn) { deselectArrowFn = fn; }

export function deselectImage() { if (deselectImageFn) deselectImageFn(); }
export function deselectArrow() { if (deselectArrowFn) deselectArrowFn(); }

/**
 * Selectors for places where a click should NOT trigger a global "deselect
 * the active image" cleanup. The cleanup also resets the right toolbar
 * panel to `default`, which incorrectly hides the heading-edit toolbar
 * while the user is still actively editing the heading. Add new selectors
 * here when a new in-flight editing context needs the same exemption.
 */
const ACTIVE_EDIT_CONTEXT_SELECTORS = [
  '.editable-container:has(img)',
  '.editable-toolbar',
  ".editable-container:has(.ql-editor[contenteditable='true'])",
  '.editable-arrow-container',
  // h2 currently being edited via modify mode's heading flow.
  '.editable-heading-active',
];

/**
 * Should the document-level click handler skip the image-deselect cleanup
 * because the click landed inside an active editing context?
 * Pure for testing — the caller passes a DOM target (or a stub with `closest`).
 */
export function isInsideActiveEditContext(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return ACTIVE_EDIT_CONTEXT_SELECTORS.some(sel => target.closest(sel));
}
