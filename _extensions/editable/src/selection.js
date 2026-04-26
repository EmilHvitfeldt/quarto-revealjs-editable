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
