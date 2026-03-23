/**
 * Main entry point for the editable Reveal.js plugin.
 * Registers toolbar actions and initializes editable elements.
 * @module main
 */

import { CONFIG } from './config.js';
import { getEditableElements, getOriginalEditableElements, getCurrentSlide, getCurrentSlideIndex, getQmdHeadingIndex, hasTitleSlide, debug } from './utils.js';
import { editableRegistry, EditableElement } from './editable-element.js';
import { setupUndoRedoKeyboard, canUndo, canRedo, pushUndoState, undo, redo } from './undo.js';
import { initializeQuillForElement, quillInstances } from './quill.js';
import { ToolbarRegistry, NewElementRegistry } from './registries.js';
import { Capabilities, getCapabilitiesFor } from './capabilities.js';
import { createFloatingToolbar } from './toolbar.js';
import { addNewArrow } from './arrows.js';
import {
  extractEditableEltDimensions,
  formatEditableEltStrings,
  replaceEditableOccurrences,
  updateTextDivs,
  insertNewSlides,
  insertNewDivs,
  insertNewArrows,
  serializeToQmd,
  elementToText,
  getFenceForContent,
  htmlToQuarto,
} from './serialization.js';

// Register toolbar actions (save, copy, add)

ToolbarRegistry.register("save", {
  icon: "💾",
  label: "Save",
  title: "Save edits to file",
  className: "toolbar-save",
  onClick: () => saveMovedElts(),
});

ToolbarRegistry.register("copy", {
  icon: "📋",
  label: "Copy",
  title: "Copy QMD to clipboard",
  className: "toolbar-copy",
  onClick: () => copyQmdToClipboard(),
});

ToolbarRegistry.register("add", {
  icon: "➕",
  label: "Add",
  title: "Add new elements",
  className: "toolbar-add",
  submenu: [
    {
      icon: "📝",
      label: "Text",
      title: "Add editable text to current slide",
      className: "toolbar-add-text",
      onClick: () => addNewTextElement(),
    },
    {
      icon: "🖼️",
      label: "Slide",
      title: "Add new slide after current",
      className: "toolbar-add-slide",
      onClick: () => addNewSlide(),
    },
    {
      icon: "➡️",
      label: "Arrow",
      title: "Add arrow to current slide",
      className: "toolbar-add-arrow",
      onClick: () => addNewArrow(),
    },
  ],
});

/**
 * Add a new editable text element to the current slide.
 * @returns {Promise<HTMLElement|null>} The new div element or null
 */
async function addNewTextElement() {
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

  await initializeQuillForElement(newDiv);

  setupDraggableElt(newDiv);

  const slideIndex = getCurrentSlideIndex();
  const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");

  if (isOnNewSlide) {
    const newSlideEntry = NewElementRegistry.newSlides.find(
      (s) => s.element === currentSlide
    );
    if (newSlideEntry) {
      NewElementRegistry.addDiv(newDiv, slideIndex, newSlideEntry);
    } else {
      NewElementRegistry.addDiv(newDiv, slideIndex, null);
    }
  } else {
    const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);
    const originalSlideIndex =
      qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
    NewElementRegistry.addDiv(newDiv, originalSlideIndex, null);
  }

  const editableElt = editableRegistry.get(newDiv);
  if (editableElt) {
    const slideWidth = currentSlide.offsetWidth || 960;
    const slideHeight = currentSlide.offsetHeight || 700;
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
function addNewSlide() {
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
    const currentNewSlideEntry = NewElementRegistry.newSlides.find(
      (s) => s.element === currentSlide
    );
    if (currentNewSlideEntry) {
      originalSlideIndex = currentNewSlideEntry.afterSlideIndex;
      insertAfterNewSlide = currentNewSlideEntry;
    } else {
      originalSlideIndex =
        qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
    }
  } else {
    originalSlideIndex =
      qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
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

  debug(
    "Added new slide after original index",
    originalSlideIndex,
    "insertAfterNewSlide:",
    insertAfterNewSlide ? "yes" : "no"
  );
  return newSlide;
}

/**
 * Get the transformed QMD content with all edits applied.
 * @returns {string} Complete QMD content
 */
function getTransformedQmd() {
  let content = readIndexQmd();
  if (!content) return "";

  const { text: contentWithSlides, slideLinePositions } =
    insertNewSlides(content);
  content = contentWithSlides;

  content = insertNewDivs(content, slideLinePositions);

  content = insertNewArrows(content, slideLinePositions);

  const dimensions = extractEditableEltDimensions();
  content = updateTextDivs(content);
  const attributes = formatEditableEltStrings(dimensions);
  content = replaceEditableOccurrences(content, attributes);

  return content;
}

/**
 * Save edits to a file (triggers download dialog).
 */
function saveMovedElts() {
  try {
    const content = getTransformedQmd();
    if (content) {
      downloadString(content);
    }
  } catch (error) {
    console.error("Error saving:", error);
    alert("Error saving: " + error.message);
  }
}

/**
 * Copy the transformed QMD content to clipboard.
 */
function copyQmdToClipboard() {
  const content = getTransformedQmd();
  if (!content) return;

  navigator.clipboard.writeText(content).then(function () {
    debug("qmd content copied to clipboard");
  }).catch(function (err) {
    console.error("Failed to copy to clipboard:", err);
  });
}

/**
 * Read the original QMD content from the injected global variable.
 * @returns {string} Original QMD content or empty string
 */
function readIndexQmd() {
  if (!window._input_file) {
    console.error("_input_file not found. Was the editable filter applied?");
    return "";
  }
  return window._input_file;
}

/**
 * Get the filename for saving.
 * @returns {string} Filename from injected global
 */
function getEditableFilename() {
  if (!window._input_filename) return 'untitled.qmd';
  return window._input_filename.split(/[/\\]/).pop();
}

/**
 * Download a string as a file. Uses File System Access API if available.
 * @param {string} content - Content to download
 * @param {string} [mimeType="text/plain"] - MIME type
 */
async function downloadString(content, mimeType = "text/plain") {
  const filename = getEditableFilename();

  if ("showSaveFilePicker" in window) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Text files",
            accept: { [mimeType]: [".txt", ".qmd", ".md"] },
          },
        ],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      debug("File saved successfully");
      return;
    } catch (error) {
      debug("File picker cancelled or failed, using fallback method");
    }
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Add save and copy buttons to the Reveal.js slide menu.
 */
function addSaveMenuButton() {
  const slideMenuItems = document.querySelector(
    "div.slide-menu-custom-panel ul.slide-menu-items"
  );

  if (slideMenuItems) {
    const existingItems = slideMenuItems.querySelectorAll("li[data-item]");
    let maxDataItem = 0;
    existingItems.forEach((item) => {
      const dataValue = parseInt(item.getAttribute("data-item")) || 0;
      if (dataValue > maxDataItem) {
        maxDataItem = dataValue;
      }
    });

    function addMenuHoverBehavior(li) {
      li.addEventListener("mouseenter", function () {
        slideMenuItems.querySelectorAll(".slide-tool-item.selected").forEach((item) => {
          item.classList.remove("selected");
        });
        li.classList.add("selected");
      });
      li.addEventListener("mouseleave", function () {
        li.classList.remove("selected");
      });
    }

    const newLi = document.createElement("li");
    newLi.className = "slide-tool-item";
    newLi.setAttribute("data-item", (maxDataItem + 1).toString());

    const newA = document.createElement("a");
    newA.href = "#";
    const kbd = document.createElement("kbd");
    kbd.textContent = "?";
    newA.appendChild(kbd);
    newA.appendChild(document.createTextNode(" Save Edits"));
    newA.addEventListener("click", function (e) {
      e.preventDefault();
      saveMovedElts();
    });
    newLi.appendChild(newA);
    addMenuHoverBehavior(newLi);
    slideMenuItems.appendChild(newLi);

    const copyLi = document.createElement("li");
    copyLi.className = "slide-tool-item";
    copyLi.setAttribute("data-item", (maxDataItem + 2).toString());

    const copyA = document.createElement("a");
    copyA.href = "#";
    const copyKbd = document.createElement("kbd");
    copyKbd.textContent = "c";
    copyA.appendChild(copyKbd);
    copyA.appendChild(document.createTextNode(" Copy qmd to Clipboard"));
    copyA.addEventListener("click", function (e) {
      e.preventDefault();
      copyQmdToClipboard();
    });
    copyLi.appendChild(copyA);
    addMenuHoverBehavior(copyLi);
    slideMenuItems.appendChild(copyLi);
  }
}

/**
 * Set up an element with editable capabilities.
 * Creates container, initializes state, attaches capabilities.
 * @param {HTMLElement} elt - Element to make editable
 */
function setupDraggableElt(elt) {
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
  const capabilities = getCapabilitiesFor(elementType);

  capabilities.forEach((cap) => {
    if (cap.init) cap.init(context);
  });

  setupContainerAccessibility(container);

  capabilities.forEach((cap) => {
    if (cap.createHandles) cap.createHandles(context);
    if (cap.createControls) cap.createControls(context);
  });

  capabilities.forEach((cap) => {
    if (cap.attachEvents) cap.attachEvents(context);
  });

  setupHoverEffects(context, capabilities);
  setupKeyboardNavigation(context, capabilities, editableElt);

  attachGlobalEvents(context, capabilities);

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

    elt.style.width = width + "px";
    elt.style.height = height + "px";
    elt.style.display = "block";
  }

  function setupContainerAccessibility(container) {
    container.setAttribute("tabindex", "0");
    container.setAttribute("role", "application");
    container.setAttribute("aria-label", "Editable element. Use arrow keys to move, Shift+arrows to resize.");
  }

  function setupHoverEffects(context, capabilities) {
    const { container } = context;

    function showControls() {
      container.classList.add("active");
    }

    function hideControls() {
      container.classList.remove("active");
    }

    function isAnyCapabilityActive() {
      return capabilities.some((cap) => cap.isActive && cap.isActive(context));
    }

    container.addEventListener("mouseenter", showControls);
    container.addEventListener("mouseleave", () => {
      if (!isAnyCapabilityActive()) {
        hideControls();
      }
    });

    container.addEventListener("focus", showControls);
    container.addEventListener("blur", (e) => {
      if (!container.contains(e.relatedTarget)) {
        hideControls();
      }
    });
  }

  function setupKeyboardNavigation(context, capabilities, editableElt) {
    const { container, element } = context;

    container.addEventListener("keydown", (e) => {
      if (element.contentEditable === "true") {
        return;
      }

      if (e.key === "Tab" && e.shiftKey) {
        container.blur();
        e.preventDefault();
        return;
      }

      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      editableElt.syncFromDOM();

      for (const cap of capabilities) {
        if (cap.handleKeyboard && cap.handleKeyboard(context, e, editableElt)) {
          break;
        }
      }
    });
  }

  function attachGlobalEvents(context, capabilities) {
    function handlePointerMove(e) {
      const isActive = capabilities.some((cap) => cap.isActive && cap.isActive(context));
      if (!isActive) return;

      if (context.rafId) {
        cancelAnimationFrame(context.rafId);
      }

      context.rafId = requestAnimationFrame(() => {
        capabilities.forEach((cap) => {
          if (cap.onMove) cap.onMove(context, e);
        });
        context.rafId = null;
      });
    }

    function stopAction() {
      const wasActive = capabilities.some((cap) => cap.isActive && cap.isActive(context));

      if (wasActive) {
        setTimeout(() => {
          if (!context.container.matches(":hover")) {
            context.container.classList.remove("active");
          }
        }, CONFIG.HOVER_TIMEOUT);
      }

      if (context.rafId) {
        cancelAnimationFrame(context.rafId);
        context.rafId = null;
      }

      capabilities.forEach((cap) => {
        if (cap.onStop) cap.onStop(context);
      });
    }

    document.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("touchmove", handlePointerMove);
    document.addEventListener("mouseup", stopAction);
    document.addEventListener("touchend", stopAction);
  }
}

/**
 * Set up an image element once it has valid dimensions.
 * Polls for dimensions if not immediately available.
 * @param {HTMLImageElement} img - Image element
 */
function setupImageWhenReady(img) {
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
    if (img.naturalWidth > 0 && img.offsetWidth > 0) {
      doSetup();
    } else {
      setTimeout(poll, CONFIG.POLL_INTERVAL_MS);
    }
  };
  poll();
}

/**
 * Set up a div element once it has valid dimensions.
 * @param {HTMLDivElement} div - Div element
 */
function setupDivWhenReady(div) {
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
      if (attempts < 10) {
        requestAnimationFrame(checkAndSetup);
      } else {
        setTimeout(checkAndSetup, CONFIG.POLL_INTERVAL_MS);
      }
    }
  };

  requestAnimationFrame(checkAndSetup);
}

/**
 * Reveal.js plugin factory function.
 * Initializes editable elements when Reveal.js is ready.
 * @returns {Object} Reveal.js plugin object
 */
window.Revealeditable = function () {
  return {
    id: "Revealeditable",
    init: function (deck) {
      deck.on("ready", async function () {
        const editableElements = getEditableElements();

        const editableDivs = Array.from(editableElements).filter(
          (el) => el.tagName.toLowerCase() === "div"
        );
        await Promise.all(editableDivs.map(initializeQuillForElement));

        editableElements.forEach((elt) => {
          const tagName = elt.tagName.toLowerCase();
          if (tagName === "img") {
            setupImageWhenReady(elt);
          } else if (tagName === "div") {
            setupDivWhenReady(elt);
          } else {
            setupDraggableElt(elt);
          }
        });
        addSaveMenuButton();
        createFloatingToolbar();
        setupUndoRedoKeyboard();
      });
    },
  };
};

// Expose internals for testing
window.getTransformedQmd = getTransformedQmd;
window.quillInstances = quillInstances;
window.editableRegistry = editableRegistry;
window.ToolbarRegistry = ToolbarRegistry;
window.NewElementRegistry = NewElementRegistry;
window.extractEditableEltDimensions = extractEditableEltDimensions;
window.formatEditableEltStrings = formatEditableEltStrings;
window.replaceEditableOccurrences = replaceEditableOccurrences;
window.updateTextDivs = updateTextDivs;
window.serializeToQmd = serializeToQmd;
window.copyQmdToClipboard = copyQmdToClipboard;
window.canUndo = canUndo;
window.canRedo = canRedo;
window.pushUndoState = pushUndoState;
window.undo = undo;
window.redo = redo;
window.getEditableElements = getEditableElements;
window.getOriginalEditableElements = getOriginalEditableElements;
window.hasTitleSlide = hasTitleSlide;
window.htmlToQuarto = htmlToQuarto;
window.readIndexQmd = readIndexQmd;
window.addNewSlide = addNewSlide;
window.addNewTextElement = addNewTextElement;
