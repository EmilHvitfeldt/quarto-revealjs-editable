/**
 * Element lifecycle: wrapping DOM elements with editable capabilities.
 * @module element-setup
 */

import { CONFIG } from './config.js';
import { getCurrentSlide, getCurrentSlideIndex, getQmdHeadingIndex, debug } from './utils.js';
import { editableRegistry, EditableElement } from './editable-element.js';
import { initializeQuillForElement } from './quill.js';
import { NewElementRegistry, ControlRegistry } from './registries.js';
import { getCapabilitiesFor } from './capabilities.js';
import { setActiveImage } from './images.js';

/**
 * Add a new editable text element to the current slide.
 * @returns {Promise<HTMLElement|null>} The new div element or null
 */
export async function addNewTextElement() {
  const currentSlide = getCurrentSlide();
  if (!currentSlide) {
    console.warn("No current slide found");
    return null;
  }

  const newDiv = document.createElement("div");
  newDiv.className = "editable editable-new";
  newDiv.textContent = CONFIG.NEW_TEXT_CONTENT;
  newDiv.style.width = CONFIG.NEW_TEXT_WIDTH + "px";
  newDiv.style.minHeight = CONFIG.NEW_TEXT_HEIGHT + "px";

  currentSlide.appendChild(newDiv);
  initializeQuillForElement(newDiv);
  setupDraggableElt(newDiv);

  const slideIndex = getCurrentSlideIndex();
  const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");

  if (isOnNewSlide) {
    const newSlideEntry = NewElementRegistry.newSlides.find((s) => s.element === currentSlide);
    NewElementRegistry.addDiv(newDiv, slideIndex, newSlideEntry || null);
  } else {
    const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);
    const originalSlideIndex = qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
    NewElementRegistry.addDiv(newDiv, originalSlideIndex, null);
  }

  const editableElt = editableRegistry.get(newDiv);
  if (editableElt) {
    const slideWidth = currentSlide.offsetWidth || CONFIG.DEFAULT_SLIDE_WIDTH;
    const slideHeight = currentSlide.offsetHeight || CONFIG.DEFAULT_SLIDE_HEIGHT;
    editableElt.setState({
      x: (slideWidth - CONFIG.NEW_TEXT_WIDTH) / 2,
      y: (slideHeight - CONFIG.NEW_TEXT_HEIGHT) / 2,
    });
  }

  debug("Added new text element to slide", slideIndex);
  return newDiv;
}

/**
 * Add a new slide after the current slide.
 * @returns {HTMLElement|null} The new slide section element or null
 */
export function addNewSlide() {
  const currentSlide = getCurrentSlide();
  if (!currentSlide) {
    console.warn("No current slide found");
    return null;
  }

  const slideIndex = getCurrentSlideIndex();
  const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);

  let originalSlideIndex;
  let insertAfterNewSlide = null;
  const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");

  if (isOnNewSlide) {
    const currentNewSlideEntry = NewElementRegistry.newSlides.find((s) => s.element === currentSlide);
    if (currentNewSlideEntry) {
      originalSlideIndex = currentNewSlideEntry.afterSlideIndex;
      insertAfterNewSlide = currentNewSlideEntry;
    } else {
      originalSlideIndex = qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
    }
  } else {
    originalSlideIndex = qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
  }

  const newSlide = document.createElement("section");
  newSlide.className = "slide level2 editable-new-slide";
  const heading = document.createElement("h2");
  heading.textContent = "";
  newSlide.appendChild(heading);
  currentSlide.insertAdjacentElement("afterend", newSlide);

  NewElementRegistry.addSlide(newSlide, originalSlideIndex, insertAfterNewSlide);
  Reveal.sync();
  Reveal.next();

  debug("Added new slide after original index", originalSlideIndex);
  return newSlide;
}

/**
 * Set up an element with editable capabilities.
 * Creates container, initializes state, attaches capabilities.
 * Exported so callers that have already established the element's natural
 * dimensions (e.g. the modify-mode code-block classifier) can skip the
 * dimension-polling helpers.
 * @param {HTMLElement} elt - Element to make editable
 */
export function setupDraggableElt(elt) {
  const editableElt = new EditableElement(elt);
  editableRegistry.set(elt, editableElt);

  const container = createEltContainer(elt);
  editableElt.container = container;
  setupEltStyles(elt);

  const context = {
    element: elt,
    container: container,
    editableElt: editableElt,
    handlers: {},
    rafId: null,
    cachedScale: 1,
  };

  const elementType = elt.tagName.toLowerCase();
  const capabilities = getCapabilitiesFor(elementType, elt);

  capabilities.forEach((cap) => { if (cap.init) cap.init(context); });

  setupContainerAccessibility(container);

  capabilities.forEach((cap) => {
    if (cap.createHandles) cap.createHandles(context);
    if (cap.createControls) cap.createControls(context);
  });

  capabilities.forEach((cap) => { if (cap.attachEvents) cap.attachEvents(context); });

  setupHoverEffects(context, capabilities);
  setupKeyboardNavigation(context, capabilities, editableElt);
  attachGlobalEvents(context, capabilities);

  if (elementType === "img") {
    container.addEventListener("mousedown", () => setActiveImage(elt));
  }
}

function createEltContainer(elt) {
  const container = document.createElement("div");
  container.className = "editable-container";
  elt.parentNode.insertBefore(container, elt);
  container.appendChild(elt);
  return container;
}

function setupEltStyles(elt) {
  elt.style.cursor = "move";
  elt.style.position = "relative";

  let width = elt.offsetWidth;
  let height = elt.offsetHeight;
  if (elt.tagName.toLowerCase() === "img" && (width === 0 || height === 0)) {
    width = elt.naturalWidth || width;
    height = elt.naturalHeight || height;
  }
  if (elt.tagName.toLowerCase() === "video" && (width === 0 || height === 0)) {
    width = elt.videoWidth || width || 300;
    height = elt.videoHeight || height || 150;
  }

  if (!elt.style.width) elt.style.width = width + "px";
  if (!elt.style.height) elt.style.height = height + "px";
  elt.style.display = "block";
}

function setupContainerAccessibility(container) {
  container.setAttribute("tabindex", "0");
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Editable element. Use arrow keys to move, Shift+arrows to resize.");
}

function setupHoverEffects(context, capabilities) {
  const { container } = context;

  const showControls = () => container.classList.add("active");
  const hideControls = () => container.classList.remove("active");
  const isAnyActive = () => capabilities.some((cap) => cap.isActive && cap.isActive(context));

  container.addEventListener("mouseenter", showControls);
  container.addEventListener("mouseleave", () => { if (!isAnyActive()) hideControls(); });
  container.addEventListener("focus", showControls);
  container.addEventListener("blur", (e) => {
    if (!container.contains(e.relatedTarget)) hideControls();
  });
}

function setupKeyboardNavigation(context, capabilities, editableElt) {
  const { container, element } = context;

  container.addEventListener("keydown", (e) => {
    if (element.contentEditable === "true") return;
    if (e.key === "Tab" && e.shiftKey) { container.blur(); e.preventDefault(); return; }
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;

    e.preventDefault();
    e.stopPropagation();
    editableElt.syncFromDOM();

    for (const cap of capabilities) {
      if (cap.handleKeyboard && cap.handleKeyboard(context, e, editableElt)) break;
    }
  });
}

function attachGlobalEvents(context, capabilities) {
  const handlePointerMove = (e) => {
    if (!capabilities.some((cap) => cap.isActive && cap.isActive(context))) return;
    if (context.rafId) cancelAnimationFrame(context.rafId);
    context.rafId = requestAnimationFrame(() => {
      capabilities.forEach((cap) => { if (cap.onMove) cap.onMove(context, e); });
      context.rafId = null;
    });
  };

  const stopAction = () => {
    const wasActive = capabilities.some((cap) => cap.isActive && cap.isActive(context));
    if (wasActive) {
      setTimeout(() => {
        if (!context.container.matches(":hover")) context.container.classList.remove("active");
      }, CONFIG.HOVER_TIMEOUT);
    }
    if (context.rafId) { cancelAnimationFrame(context.rafId); context.rafId = null; }
    capabilities.forEach((cap) => { if (cap.onStop) cap.onStop(context); });
  };

  document.addEventListener("mousemove", handlePointerMove);
  document.addEventListener("touchmove", handlePointerMove);
  document.addEventListener("mouseup", stopAction);
  document.addEventListener("touchend", stopAction);
}

/**
 * Set up an image element once it has valid dimensions.
 * @param {HTMLImageElement} img - Image element
 */
export function setupImageWhenReady(img) {
  if (img.complete && img.naturalWidth > 0 && img.offsetWidth > 0) {
    setupDraggableElt(img);
    return;
  }

  let setupDone = false;
  const doSetup = () => {
    if (setupDone) return;
    if (img.naturalWidth > 0 && img.offsetWidth > 0) {
      setupDone = true;
      setupDraggableElt(img);
    }
  };

  img.addEventListener("load", doSetup, { once: true });

  let attempts = 0;
  const poll = () => {
    if (setupDone || attempts >= CONFIG.POLL_MAX_ATTEMPTS) return;
    attempts++;
    if (img.naturalWidth > 0 && img.offsetWidth > 0) doSetup();
    else setTimeout(poll, CONFIG.POLL_INTERVAL_MS);
  };
  poll();
}

/**
 * Set up a div element once it has valid dimensions.
 * @param {HTMLDivElement} div - Div element
 */
export function setupDivWhenReady(div) {
  if (div.offsetWidth >= CONFIG.MIN_ELEMENT_SIZE && div.offsetHeight >= CONFIG.MIN_ELEMENT_SIZE) {
    setupDraggableElt(div);
    return;
  }

  let setupDone = false;
  let attempts = 0;

  const checkAndSetup = () => {
    if (setupDone || attempts >= CONFIG.POLL_MAX_ATTEMPTS) return;
    attempts++;
    if (div.offsetWidth >= CONFIG.MIN_ELEMENT_SIZE && div.offsetHeight >= CONFIG.MIN_ELEMENT_SIZE) {
      setupDone = true;
      setupDraggableElt(div);
    } else {
      if (attempts < 10) requestAnimationFrame(checkAndSetup);
      else setTimeout(checkAndSetup, CONFIG.POLL_INTERVAL_MS);
    }
  };

  requestAnimationFrame(checkAndSetup);
}

/**
 * Set up a video element once it has valid dimensions.
 * @param {HTMLVideoElement} video - Video element
 */
export function setupVideoWhenReady(video) {
  // Unlike images, videos may have zero dimensions in some browsers before
  // metadata loads. setupEltStyles handles the fallback, so call immediately.
  setupDraggableElt(video);
}
