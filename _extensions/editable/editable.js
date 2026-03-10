// Configuration constants (only runtime values - visual styling is in editable.css)
const CONFIG = {
  // Sizing constraints
  MIN_ELEMENT_SIZE: 50,
  KEYBOARD_MOVE_STEP: 10,

  // Font constraints
  MIN_FONT_SIZE: 8,
  DEFAULT_FONT_SIZE: 16,
  FONT_SIZE_STEP: 2,

  // Timing
  HOVER_TIMEOUT: 500,
};

// =============================================================================
// Element State Management
// =============================================================================

// Registry to track all editable elements
const editableRegistry = new Map();

// EditableElement class - centralized state for each editable element
class EditableElement {
  constructor(element) {
    this.element = element;
    this.container = null;
    this.type = element.tagName.toLowerCase();

    // Initialize state from current element
    this.state = {
      x: 0,
      y: 0,
      width: element.offsetWidth,
      height: element.offsetHeight,
      // Div-specific properties
      fontSize: null,
      textAlign: null,
    };
  }

  // Get a copy of current state
  getState() {
    return { ...this.state };
  }

  // Update state and optionally sync to DOM
  setState(updates, syncToDOM = true) {
    Object.assign(this.state, updates);

    if (syncToDOM) {
      this.syncToDOM();
    }
  }

  // Sync state to DOM elements
  syncToDOM() {
    if (this.container) {
      this.container.style.left = this.state.x + "px";
      this.container.style.top = this.state.y + "px";
    }

    this.element.style.width = this.state.width + "px";
    this.element.style.height = this.state.height + "px";

    if (this.state.fontSize !== null) {
      this.element.style.fontSize = this.state.fontSize + "px";
    }
    if (this.state.textAlign !== null) {
      this.element.style.textAlign = this.state.textAlign;
    }
  }

  // Read current values from DOM into state
  syncFromDOM() {
    if (this.container) {
      this.state.x = this.container.style.left
        ? parseFloat(this.container.style.left)
        : this.container.offsetLeft;
      this.state.y = this.container.style.top
        ? parseFloat(this.container.style.top)
        : this.container.offsetTop;
    }

    this.state.width = this.element.style.width
      ? parseFloat(this.element.style.width)
      : this.element.offsetWidth;
    this.state.height = this.element.style.height
      ? parseFloat(this.element.style.height)
      : this.element.offsetHeight;

    if (this.type === "div") {
      if (this.element.style.fontSize) {
        this.state.fontSize = parseFloat(this.element.style.fontSize);
      }
      if (this.element.style.textAlign) {
        this.state.textAlign = this.element.style.textAlign;
      }
    }
  }

  // Generate dimension object for serialization
  toDimensions() {
    this.syncFromDOM();

    const dims = {
      width: this.state.width,
      height: this.state.height,
      left: this.state.x,
      top: this.state.y,
    };

    if (this.type === "div") {
      if (this.state.fontSize !== null) {
        dims.fontSize = this.state.fontSize;
      }
      if (this.state.textAlign !== null) {
        dims.textAlign = this.state.textAlign;
      }
    }

    return dims;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

// Round to 1 decimal place for cleaner output
function round(n) {
  return Math.round(n * 10) / 10;
}

// Get the current slide scale from reveal.js
function getSlideScale() {
  const slidesContainerEl = document.querySelector(".slides");
  return slidesContainerEl
    ? parseFloat(window.getComputedStyle(slidesContainerEl).getPropertyValue("--slide-scale")) || 1
    : 1;
}

// Get client coordinates from mouse or touch event, adjusted for slide scale
function getClientCoordinates(e, cachedScale) {
  const isTouch = e.type.startsWith("touch");
  const scale = cachedScale || getSlideScale();

  return {
    clientX: (isTouch ? e.touches[0].clientX : e.clientX) / scale,
    clientY: (isTouch ? e.touches[0].clientY : e.clientY) / scale,
  };
}

// Create a styled button element
function createButton(text, additionalClasses) {
  const button = document.createElement("button");
  button.textContent = text;
  button.className = "editable-button " + additionalClasses;
  return button;
}

// Change font size of an element with minimum constraint
function changeFontSize(element, delta) {
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

function getEditableElements() {
  return document.querySelectorAll("img.editable, div.editable");
}

function getEditableDivs() {
  return document.querySelectorAll("div.editable");
}

// =============================================================================
// Plugin Initialization
// =============================================================================

window.Revealeditable = function () {
  return {
    id: "Revealeditable",
    init: function (deck) {
      deck.on("ready", function () {
        const editableElements = getEditableElements();
        editableElements.forEach(setupDraggableElt);
        addSaveMenuButton();
      });
    },
  };
};

// =============================================================================
// Menu Button Setup
// =============================================================================

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

    // Add "Save Edits" button
    const newLi = document.createElement("li");
    newLi.className = "slide-menu-item";
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
    slideMenuItems.appendChild(newLi);

    // Add "Copy qmd to clipboard" button
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
    slideMenuItems.appendChild(copyLi);
  }
}

// =============================================================================
// Editable Element Setup
// =============================================================================

function setupDraggableElt(elt) {
  // Create state manager for this element
  const editableElt = new EditableElement(elt);
  editableRegistry.set(elt, editableElt);

  // Interaction state
  let isDragging = false;
  let isResizing = false;
  let startX, startY, initialX, initialY, initialWidth, initialHeight;
  let resizeHandle = null;
  let rafId = null;
  let cachedScale = 1;

  // Setup
  const container = createEltContainer(elt);
  editableElt.container = container;
  setupEltStyles(elt);
  createResizeHandles(container, elt);
  setupHoverEffects(container);
  setupKeyboardNavigation(container, elt, editableElt);
  attachEventListeners();

  // -------------------------------------------------------------------------
  // Container and Style Setup
  // -------------------------------------------------------------------------

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
    elt.style.width = elt.offsetWidth + "px";
    elt.style.height = elt.offsetHeight + "px";
    elt.style.display = "block";
  }

  // -------------------------------------------------------------------------
  // Resize Handles and Controls
  // -------------------------------------------------------------------------

  function createResizeHandles(container, elt) {
    // Make container focusable for keyboard navigation
    container.setAttribute("tabindex", "0");
    container.setAttribute("role", "application");
    container.setAttribute("aria-label", "Editable element. Use arrow keys to move, Shift+arrows to resize.");

    // Create corner resize handles
    const handles = ["nw", "ne", "sw", "se"];
    const handleLabels = {
      nw: "Resize from top-left corner",
      ne: "Resize from top-right corner",
      sw: "Resize from bottom-left corner",
      se: "Resize from bottom-right corner"
    };

    handles.forEach((position) => {
      const handle = document.createElement("div");
      handle.className = "resize-handle handle-" + position;
      handle.setAttribute("role", "slider");
      handle.setAttribute("aria-label", handleLabels[position]);
      handle.setAttribute("tabindex", "-1");
      handle.dataset.position = position;
      container.appendChild(handle);
    });

    // Create font controls for div elements
    if (elt.tagName.toLowerCase() === "div") {
      createFontControls(container, elt);
    }
  }

  function createFontControls(container, elt) {
    const fontControls = document.createElement("div");
    fontControls.className = "editable-font-controls";

    // Font size buttons
    const decreaseBtn = createButton("A-", "editable-button-font editable-button-decrease");
    decreaseBtn.setAttribute("aria-label", "Decrease font size");
    decreaseBtn.title = "Decrease font size";
    decreaseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      changeFontSize(elt, -CONFIG.FONT_SIZE_STEP);
    });

    const increaseBtn = createButton("A+", "editable-button-font editable-button-increase");
    increaseBtn.setAttribute("aria-label", "Increase font size");
    increaseBtn.title = "Increase font size";
    increaseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      changeFontSize(elt, CONFIG.FONT_SIZE_STEP);
    });

    // Alignment buttons with state update
    function setAlignment(alignment) {
      elt.style.textAlign = alignment;
      const editableElt = editableRegistry.get(elt);
      if (editableElt) {
        editableElt.state.textAlign = alignment;
      }
    }

    const alignLeftBtn = createButton("⇤", "editable-button-align");
    alignLeftBtn.setAttribute("aria-label", "Align text left");
    alignLeftBtn.title = "Align Left";
    alignLeftBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setAlignment("left");
    });

    const alignCenterBtn = createButton("⇔", "editable-button-align");
    alignCenterBtn.setAttribute("aria-label", "Align text center");
    alignCenterBtn.title = "Align Center";
    alignCenterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setAlignment("center");
    });

    const alignRightBtn = createButton("⇥", "editable-button-align");
    alignRightBtn.setAttribute("aria-label", "Align text right");
    alignRightBtn.title = "Align Right";
    alignRightBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setAlignment("right");
    });

    // Edit mode button
    const editBtn = createButton("✎", "editable-button-edit");
    editBtn.setAttribute("aria-label", "Toggle edit mode");
    editBtn.title = "Toggle Edit Mode";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isEditable = elt.contentEditable === "true";
      elt.contentEditable = !isEditable;
      editBtn.classList.toggle("active", !isEditable);
      editBtn.title = !isEditable ? "Exit Edit Mode" : "Toggle Edit Mode";
      if (!isEditable) {
        elt.focus();
      }
    });

    // Append all buttons
    fontControls.appendChild(decreaseBtn);
    fontControls.appendChild(increaseBtn);
    fontControls.appendChild(alignLeftBtn);
    fontControls.appendChild(alignCenterBtn);
    fontControls.appendChild(alignRightBtn);
    fontControls.appendChild(editBtn);
    container.appendChild(fontControls);
  }

  // -------------------------------------------------------------------------
  // Hover and Focus Effects
  // -------------------------------------------------------------------------

  function setupHoverEffects(container) {
    function showControls() {
      container.classList.add("active");
    }

    function hideControls() {
      container.classList.remove("active");
    }

    container.addEventListener("mouseenter", showControls);
    container.addEventListener("mouseleave", () => {
      if (!isDragging && !isResizing) {
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

  // -------------------------------------------------------------------------
  // Keyboard Navigation
  // -------------------------------------------------------------------------

  function setupKeyboardNavigation(container, elt, editableElt) {
    container.addEventListener("keydown", (e) => {
      // Shift+Tab exits to normal slide navigation
      if (e.key === "Tab" && e.shiftKey) {
        container.blur();
        e.preventDefault();
        return;
      }

      // Only handle arrow keys
      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const step = CONFIG.KEYBOARD_MOVE_STEP;
      editableElt.syncFromDOM();
      const state = editableElt.getState();

      if (e.shiftKey) {
        // Shift + arrows = resize
        switch (e.key) {
          case "ArrowRight":
            editableElt.setState({ width: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.width + step) });
            break;
          case "ArrowLeft":
            editableElt.setState({ width: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.width - step) });
            break;
          case "ArrowDown":
            editableElt.setState({ height: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.height + step) });
            break;
          case "ArrowUp":
            editableElt.setState({ height: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.height - step) });
            break;
        }
      } else {
        // Arrows = move
        switch (e.key) {
          case "ArrowRight":
            editableElt.setState({ x: state.x + step });
            break;
          case "ArrowLeft":
            editableElt.setState({ x: state.x - step });
            break;
          case "ArrowDown":
            editableElt.setState({ y: state.y + step });
            break;
          case "ArrowUp":
            editableElt.setState({ y: state.y - step });
            break;
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Event Listeners
  // -------------------------------------------------------------------------

  function attachEventListeners() {
    // Drag events on element
    elt.addEventListener("mousedown", startDrag);
    elt.addEventListener("touchstart", startDrag);

    // Resize events on handles
    container.querySelectorAll(".resize-handle").forEach((handle) => {
      handle.addEventListener("mousedown", startResize);
      handle.addEventListener("touchstart", startResize);
    });

    // Global move/end events (unified handler for mouse and touch)
    document.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("touchmove", handlePointerMove);
    document.addEventListener("mouseup", stopAction);
    document.addEventListener("touchend", stopAction);
  }

  // -------------------------------------------------------------------------
  // Drag Logic
  // -------------------------------------------------------------------------

  function startDrag(e) {
    if (e.target.parentElement.contentEditable === "true") return;
    if (e.target.classList.contains("resize-handle")) return;

    cachedScale = getSlideScale();
    isDragging = true;
    const coords = getClientCoordinates(e, cachedScale);

    startX = coords.clientX;
    startY = coords.clientY;
    initialX = container.offsetLeft;
    initialY = container.offsetTop;

    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;

    const coords = getClientCoordinates(e, cachedScale);
    const deltaX = coords.clientX - startX;
    const deltaY = coords.clientY - startY;

    container.style.left = initialX + deltaX + "px";
    container.style.top = initialY + deltaY + "px";

    e.preventDefault();
  }

  // -------------------------------------------------------------------------
  // Resize Logic
  // -------------------------------------------------------------------------

  function startResize(e) {
    cachedScale = getSlideScale();
    isResizing = true;
    resizeHandle = e.target.dataset.position;

    const coords = getClientCoordinates(e, cachedScale);

    startX = coords.clientX;
    startY = coords.clientY;
    initialWidth = elt.offsetWidth;
    initialHeight = elt.offsetHeight;
    initialX = container.offsetLeft;
    initialY = container.offsetTop;

    e.preventDefault();
    e.stopPropagation();
  }

  function resize(e) {
    if (!isResizing) return;

    const coords = getClientCoordinates(e, cachedScale);
    const deltaX = coords.clientX - startX;
    const deltaY = coords.clientY - startY;

    let newWidth = initialWidth;
    let newHeight = initialHeight;
    let newX = initialX;
    let newY = initialY;

    const preserveAspectRatio = e.shiftKey;
    const aspectRatio = initialWidth / initialHeight;

    if (preserveAspectRatio) {
      if (resizeHandle.includes("e") || resizeHandle.includes("w")) {
        const widthChange = resizeHandle.includes("e") ? deltaX : -deltaX;
        newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialWidth + widthChange);
        newHeight = newWidth / aspectRatio;
      } else if (resizeHandle.includes("s") || resizeHandle.includes("n")) {
        const heightChange = resizeHandle.includes("s") ? deltaY : -deltaY;
        newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialHeight + heightChange);
        newWidth = newHeight * aspectRatio;
      }

      if (resizeHandle.includes("w")) {
        newX = initialX + (initialWidth - newWidth);
      }
      if (resizeHandle.includes("n")) {
        newY = initialY + (initialHeight - newHeight);
      }
    } else {
      if (resizeHandle.includes("e")) {
        newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialWidth + deltaX);
      }
      if (resizeHandle.includes("w")) {
        newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialWidth - deltaX);
        newX = initialX + (initialWidth - newWidth);
      }
      if (resizeHandle.includes("s")) {
        newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialHeight + deltaY);
      }
      if (resizeHandle.includes("n")) {
        newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialHeight - deltaY);
        newY = initialY + (initialHeight - newHeight);
      }
    }

    elt.style.width = newWidth + "px";
    elt.style.height = newHeight + "px";
    container.style.left = newX + "px";
    container.style.top = newY + "px";

    e.preventDefault();
  }

  // -------------------------------------------------------------------------
  // Unified Pointer Move Handler (mouse + touch)
  // -------------------------------------------------------------------------

  function handlePointerMove(e) {
    if (!isDragging && !isResizing) return;

    // Cancel any pending frame to avoid queuing multiple updates
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    // Schedule update on next animation frame for smooth performance
    rafId = requestAnimationFrame(() => {
      if (isDragging) {
        drag(e);
      } else if (isResizing) {
        resize(e);
      }
      rafId = null;
    });
  }

  // -------------------------------------------------------------------------
  // Stop Action
  // -------------------------------------------------------------------------

  function stopAction() {
    if (isDragging || isResizing) {
      setTimeout(() => {
        if (!container.matches(":hover")) {
          container.classList.remove("active");
        }
      }, CONFIG.HOVER_TIMEOUT);
    }

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    isDragging = false;
    isResizing = false;
    resizeHandle = null;
  }
}

// =============================================================================
// Save/Export Functions
// =============================================================================

// Get the transformed QMD content (shared logic for save and clipboard)
function getTransformedQmd() {
  let content = readIndexQmd();
  if (!content) return "";

  const dimensions = extractEditableEltDimensions();
  content = updateTextDivs(content);
  const attributes = formatEditableEltStrings(dimensions);
  content = replaceEditableOccurrences(content, attributes);

  return content;
}

function saveMovedElts() {
  const content = getTransformedQmd();
  if (content) {
    downloadString(content);
  }
}

function copyQmdToClipboard() {
  const content = getTransformedQmd();
  if (!content) return;

  navigator.clipboard.writeText(content).then(function () {
    console.log("qmd content copied to clipboard");
  }).catch(function (err) {
    console.error("Failed to copy to clipboard:", err);
  });
}

function readIndexQmd() {
  if (!window._input_file) {
    console.error("_input_file not found. Was the editable filter applied?");
    return "";
  }
  return window._input_file;
}

function getEditableFilename() {
  return window._input_filename.split(/[/\\]/).pop();
}

// =============================================================================
// Dimension Extraction
// =============================================================================

function extractEditableEltDimensions() {
  const editableElements = getEditableElements();
  const dimensions = [];

  editableElements.forEach((elt) => {
    const editableElt = editableRegistry.get(elt);
    if (editableElt) {
      // Use centralized state
      dimensions.push(editableElt.toDimensions());
    } else {
      // Fallback for elements not in registry (shouldn't happen)
      const width = elt.style.width ? parseFloat(elt.style.width) : elt.offsetWidth;
      const height = elt.style.height ? parseFloat(elt.style.height) : elt.offsetHeight;

      const parentContainer = elt.parentNode;
      const left = parentContainer.style.left
        ? parseFloat(parentContainer.style.left)
        : parentContainer.offsetLeft;
      const top = parentContainer.style.top
        ? parseFloat(parentContainer.style.top)
        : parentContainer.offsetTop;

      dimensions.push({ width, height, left, top });
    }
  });

  return dimensions;
}

// =============================================================================
// QMD Transformation
// =============================================================================

function updateTextDivs(text) {
  const divs = getEditableDivs();
  const replacements = Array.from(divs).map(htmlToQuarto);

  const regex = /::: ?(?:\{\.editable[^}]*\}|editable)[\s\S]*?\n:::/g;

  let index = 0;
  return text.replace(regex, () => {
    return replacements[index++] || "";
  });
}

function htmlToQuarto(div) {
  let text = div.innerHTML.trim();

  // Convert HTML tags to Quarto/Markdown equivalents
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<code[^>]*>/gi, "`");
  text = text.replace(/<\/code>/gi, "`");
  text = text.replace(/<strong[^>]*>/gi, "**");
  text = text.replace(/<\/strong>/gi, "**");
  text = text.replace(/<em[^>]*>/gi, "*");
  text = text.replace(/<\/em>/gi, "*");
  text = text.replace(/<del[^>]*>/gi, "~~");
  text = text.replace(/<\/del>/gi, "~~");

  // Clean up excessive newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  return "::: {.editable}\n" + text.trim() + "\n:::";
}

function replaceEditableOccurrences(text, replacements) {
  const regex = /\{\.editable[^}]*\}/g;

  let index = 0;
  return text.replace(regex, () => {
    return replacements[index++] || "";
  });
}

function formatEditableEltStrings(dimensions) {
  return dimensions.map((dim) => {
    let str = `{.absolute width=${round(dim.width)}px height=${round(dim.height)}px left=${round(dim.left)}px top=${round(dim.top)}px`;

    // Add style attribute if needed
    const styles = [];
    if (dim.fontSize) {
      styles.push(`font-size: ${dim.fontSize}px;`);
    }
    if (dim.textAlign) {
      styles.push(`text-align: ${dim.textAlign};`);
    }
    if (styles.length > 0) {
      str += ` style="${styles.join(' ')}"`;
    }

    str += "}";
    return str;
  });
}

// =============================================================================
// File Download
// =============================================================================

async function downloadString(content, mimeType = "text/plain") {
  const filename = getEditableFilename();

  // Try modern File System Access API first
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

      console.log("File saved successfully");
      return;
    } catch (error) {
      console.log("File picker cancelled or failed, using fallback method");
    }
  }

  // Fallback to download link
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
