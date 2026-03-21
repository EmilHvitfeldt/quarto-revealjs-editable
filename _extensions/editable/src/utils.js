import { CONFIG } from './config.js';

// Round to 1 decimal place for cleaner output
export function round(n) {
  return Math.round(n * 10) / 10;
}

// Get the current slide scale from reveal.js
export function getSlideScale() {
  const slidesContainerEl = document.querySelector(".slides");
  return slidesContainerEl
    ? parseFloat(window.getComputedStyle(slidesContainerEl).getPropertyValue("--slide-scale")) || 1
    : 1;
}

// Get client coordinates from mouse or touch event, adjusted for slide scale
export function getClientCoordinates(e, cachedScale) {
  const isTouch = e.type.startsWith("touch");
  const scale = cachedScale || getSlideScale();

  return {
    clientX: (isTouch ? e.touches[0].clientX : e.clientX) / scale,
    clientY: (isTouch ? e.touches[0].clientY : e.clientY) / scale,
  };
}

// Create a styled button element
export function createButton(text, additionalClasses) {
  const button = document.createElement("button");
  button.textContent = text;
  button.className = "editable-button " + additionalClasses;
  return button;
}

// Change font size of an element with minimum constraint
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

// =============================================================================
// DOM Query Functions
// =============================================================================

export function getEditableElements() {
  return document.querySelectorAll("img.editable, div.editable");
}

export function getEditableDivs() {
  return document.querySelectorAll("div.editable");
}

// Get only original editable elements (exclude dynamically added ones)
export function getOriginalEditableElements() {
  return document.querySelectorAll("img.editable:not(.editable-new), div.editable:not(.editable-new)");
}

export function getOriginalEditableDivs() {
  return document.querySelectorAll("div.editable:not(.editable-new)");
}

// Get current slide index (Reveal.js index)
export function getCurrentSlideIndex() {
  const indices = Reveal.getIndices();
  return indices.h;
}

// Get the current visible slide element
export function getCurrentSlide() {
  return document.querySelector("section.present:not(.stack)") ||
         document.querySelector("section.present");
}

// Check if document has a title slide (from YAML frontmatter)
// Title slides don't have a ## heading in the QMD source
export function hasTitleSlide() {
  const firstSlide = Reveal.getSlide(0);
  if (!firstSlide) return false;
  // Title slides typically have an h1 with the title, not an h2
  const h2 = firstSlide.querySelector("h2");
  return !h2;
}

// Convert Reveal.js slide index to QMD heading index
// If there's a title slide, the first ## heading is at Reveal index 1
export function getQmdHeadingIndex(revealIndex) {
  if (hasTitleSlide()) {
    return revealIndex - 1;
  }
  return revealIndex;
}
