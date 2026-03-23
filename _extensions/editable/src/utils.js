/**
 * Utility functions for the editable extension.
 * @module utils
 */

import { CONFIG } from './config.js';

/**
 * Round a number to 1 decimal place for cleaner QMD output.
 * @param {number} n - The number to round
 * @returns {number} Rounded value
 */
export function round(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Log a debug message (only when DEBUG mode is enabled).
 * @param {...any} args - Arguments to log
 */
export function debug(...args) {
  if (CONFIG.DEBUG) {
    console.log('[editable]', ...args);
  }
}

/**
 * Get the current slide scale from Reveal.js CSS custom property.
 * @returns {number} The slide scale factor (default 1)
 */
export function getSlideScale() {
  const slidesContainerEl = document.querySelector(".slides");
  return slidesContainerEl
    ? parseFloat(window.getComputedStyle(slidesContainerEl).getPropertyValue("--slide-scale")) || 1
    : 1;
}

/**
 * Get client coordinates from mouse or touch event, adjusted for slide scale.
 * @param {MouseEvent|TouchEvent} e - The event object
 * @param {number} [cachedScale] - Pre-cached scale value for performance
 * @returns {{clientX: number, clientY: number}} Adjusted coordinates
 */
export function getClientCoordinates(e, cachedScale) {
  const isTouch = e.type.startsWith("touch");
  const scale = cachedScale || getSlideScale();

  return {
    clientX: (isTouch ? e.touches[0].clientX : e.clientX) / scale,
    clientY: (isTouch ? e.touches[0].clientY : e.clientY) / scale,
  };
}

/**
 * Create a styled button element.
 * @param {string} text - Button text content
 * @param {string} additionalClasses - Additional CSS classes to add
 * @returns {HTMLButtonElement} The created button
 */
export function createButton(text, additionalClasses) {
  const button = document.createElement("button");
  button.textContent = text;
  button.className = "editable-button " + additionalClasses;
  return button;
}

/**
 * Change font size of an element with minimum constraint.
 * @param {HTMLElement} element - The element to modify
 * @param {number} delta - Amount to change (positive or negative)
 * @param {Map} editableRegistry - Registry to update state
 */
export function changeFontSize(element, delta, editableRegistry) {
  const currentFontSize =
    parseFloat(window.getComputedStyle(element).fontSize) || CONFIG.DEFAULT_FONT_SIZE;
  const newFontSize = Math.max(CONFIG.MIN_FONT_SIZE, currentFontSize + delta);
  element.style.fontSize = newFontSize + "px";

  // Update state if element is in registry
  const editableElt = editableRegistry.get(element);
  if (editableElt) {
    editableElt.state.fontSize = newFontSize;
  }
}

/**
 * Get all editable elements (images and divs with .editable class).
 * @returns {NodeList} All editable elements
 */
export function getEditableElements() {
  return document.querySelectorAll("img.editable, div.editable");
}

/**
 * Get all editable div elements.
 * @returns {NodeList} All editable divs
 */
export function getEditableDivs() {
  return document.querySelectorAll("div.editable");
}

/**
 * Get only original editable elements (excludes dynamically added ones).
 * @returns {NodeList} Original editable elements
 */
export function getOriginalEditableElements() {
  return document.querySelectorAll("img.editable:not(.editable-new), div.editable:not(.editable-new)");
}

/**
 * Get only original editable divs (excludes dynamically added ones).
 * @returns {NodeList} Original editable divs
 */
export function getOriginalEditableDivs() {
  return document.querySelectorAll("div.editable:not(.editable-new)");
}

/**
 * Get current Reveal.js slide index.
 * @returns {number} Horizontal slide index
 */
export function getCurrentSlideIndex() {
  if (typeof Reveal === 'undefined') return 0;
  const indices = Reveal.getIndices();
  return indices.h;
}

/**
 * Get the current visible slide element.
 * @returns {HTMLElement|null} The current slide section element
 */
export function getCurrentSlide() {
  return document.querySelector("section.present:not(.stack)") ||
         document.querySelector("section.present");
}

/**
 * Check if document has a title slide (from YAML frontmatter).
 * Title slides are generated from YAML and don't have a ## heading in QMD source.
 * @returns {boolean} True if first slide lacks an h2 heading
 */
export function hasTitleSlide() {
  if (typeof Reveal === 'undefined') return false;
  const firstSlide = Reveal.getSlide(0);
  if (!firstSlide) return false;
  // Title slides typically have an h1 with the title, not an h2
  const h2 = firstSlide.querySelector("h2");
  return !h2;
}

/**
 * Convert Reveal.js slide index to QMD heading index.
 * Accounts for title slide offset when present.
 * @param {number} revealIndex - The Reveal.js slide index
 * @returns {number} The corresponding QMD ## heading index
 */
export function getQmdHeadingIndex(revealIndex) {
  if (hasTitleSlide()) {
    return revealIndex - 1;
  }
  return revealIndex;
}
