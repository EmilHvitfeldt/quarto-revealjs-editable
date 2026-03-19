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

  // Undo/Redo
  MAX_UNDO_STACK_SIZE: 50,

  // New element defaults
  NEW_TEXT_CONTENT: "New text",
  NEW_TEXT_WIDTH: 200,
  NEW_TEXT_HEIGHT: 50,
  NEW_SLIDE_HEADING: "## New Slide",

  // Arrow defaults
  NEW_ARROW_LENGTH: 150,
  ARROW_HANDLE_SIZE: 12,
  ARROW_CONTROL_HANDLE_SIZE: 10,
  ARROW_DEFAULT_COLOR: "black",
  ARROW_DEFAULT_WIDTH: 2,
  ARROW_CONTROL1_COLOR: "#ff6600",
  ARROW_CONTROL2_COLOR: "#9933ff",

  // Quill Editor CDN
  QUILL_CSS:
    "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css",
  QUILL_JS:
    "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js",
};

// =============================================================================
// Quill Editor Loader
// =============================================================================

let quillLoaded = false;
let quillLoading = null;

function loadQuill() {
  if (quillLoaded) {
    return Promise.resolve();
  }
  if (quillLoading) {
    return quillLoading;
  }

  quillLoading = new Promise((resolve, reject) => {
    // Load CSS
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = CONFIG.QUILL_CSS;
    document.head.appendChild(cssLink);

    // Load JS
    const script = document.createElement("script");
    script.src = CONFIG.QUILL_JS;
    script.onload = () => {
      quillLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error("Failed to load Quill"));
    };
    document.head.appendChild(script);
  });

  return quillLoading;
}

// Store Quill instances per element
const quillInstances = new Map();

// Default color palette for the color pickers
const DEFAULT_COLOR_PALETTE = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#e60000", "#ff9900", "#ffff00", "#008a00", "#0066cc", "#9933ff",
  "#ff99cc", "#ffcc99", "#ffff99", "#99ff99", "#99ccff", "#cc99ff",
];

// Get color palette - uses brand colors if available, otherwise defaults
function getColorPalette() {
  // Check if brand palette colors were injected by Quarto
  if (window._quarto_brand_palette && Array.isArray(window._quarto_brand_palette) && window._quarto_brand_palette.length > 0) {
    return window._quarto_brand_palette;
  }
  return DEFAULT_COLOR_PALETTE;
}

// Convert RGB color string to hex format
function rgbToHex(rgb) {
  // Match rgb(r, g, b) or rgba(r, g, b, a)
  const match = rgb.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Convert a color value to brand shortcode if it's a brand color, otherwise return as-is
// Uses placeholder to avoid being stripped by HTML cleanup regex
function getBrandColorOutput(colorVal) {
  if (!window._quarto_brand_color_names) {
    return colorVal;
  }

  // Normalize the color value
  let normalizedColor = colorVal.toLowerCase().trim();

  // Convert RGB to hex if needed
  if (normalizedColor.startsWith('rgb')) {
    const hexColor = rgbToHex(normalizedColor);
    if (hexColor) {
      normalizedColor = hexColor.toLowerCase();
    }
  }

  // Check if this color has a brand name
  const brandName = window._quarto_brand_color_names[normalizedColor];
  if (brandName) {
    // Use placeholder that won't be stripped by HTML cleanup
    return `__BRAND_SHORTCODE_${brandName}__`;
  }

  // Return original value (not converted) to preserve format
  return colorVal;
}

// Initialize Quill for an editable div element (called at page load)
async function initializeQuillForElement(element) {
  // Only for div elements
  if (element.tagName.toLowerCase() !== "div") return null;

  // Skip if already initialized
  if (quillInstances.has(element)) return quillInstances.get(element);

  try {
    await loadQuill();

    // Store original content before any DOM changes
    const originalContent = element.innerHTML;

    // Clear and set up structure for Quill
    element.innerHTML = "";

    // Get colors - brand palette if available, otherwise defaults
    const presetColors = getColorPalette();

    // Build color options HTML
    const colorOptions = presetColors.map(c => `<option value="${c}"></option>`).join("");
    const colorOptionsWithExtras = `<option value="unset"></option>` + colorOptions + `<option value="custom">⋯</option>`;

    // Create toolbar container
    const toolbarContainer = document.createElement("div");
    toolbarContainer.id = "toolbar-" + Math.random().toString(36).substr(2, 9);
    toolbarContainer.innerHTML = `
      <button class="ql-bold">B</button>
      <button class="ql-italic">I</button>
      <button class="ql-underline">U</button>
      <button class="ql-strike">S</button>
      <select class="ql-color">${colorOptionsWithExtras}</select>
      <select class="ql-background">${colorOptionsWithExtras}</select>
      <button class="ql-align" value=""></button>
      <button class="ql-align" value="center"></button>
      <button class="ql-align" value="right"></button>
    `;
    element.appendChild(toolbarContainer);

    // Create hidden color picker inputs for custom colors
    const textColorPicker = document.createElement("input");
    textColorPicker.type = "color";
    textColorPicker.style.cssText = "position:absolute;visibility:hidden;width:0;height:0;";
    element.appendChild(textColorPicker);

    const bgColorPicker = document.createElement("input");
    bgColorPicker.type = "color";
    bgColorPicker.style.cssText = "position:absolute;visibility:hidden;width:0;height:0;";
    element.appendChild(bgColorPicker);

    // Create editor container
    const editorWrapper = document.createElement("div");
    editorWrapper.className = "quill-wrapper";
    editorWrapper.innerHTML = originalContent;
    element.appendChild(editorWrapper);

    // Custom color handler factory
    function createColorHandler(picker, formatName) {
      return function(value) {
        if (value === "unset") {
          // Remove the color formatting
          this.quill.format(formatName, false);
        } else if (value === "custom") {
          // Save current selection
          const range = this.quill.getSelection();
          picker.click();
          picker.onchange = () => {
            if (range) {
              this.quill.setSelection(range);
            }
            this.quill.format(formatName, picker.value);
          };
        } else {
          this.quill.format(formatName, value);
        }
      };
    }

    // Initialize Quill with the toolbar and custom handlers
    const quill = new Quill(editorWrapper, {
      theme: "snow",
      modules: {
        toolbar: {
          container: "#" + toolbarContainer.id,
          handlers: {
            color: createColorHandler(textColorPicker, "color"),
            background: createColorHandler(bgColorPicker, "background"),
          },
        },
      },
      placeholder: "",
    });

    // Style the toolbar
    toolbarContainer.className = "quill-toolbar-container ql-toolbar ql-snow";

    // CRITICAL: Prevent toolbar buttons from stealing focus and losing selection
    toolbarContainer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Start with editing disabled and toolbar hidden
    quill.enable(false);
    // Toolbar starts without 'editing' class, so CSS hides it

    // Track original content and whether it was modified
    const quillData = {
      quill,
      toolbarContainer,
      editorWrapper,
      isEditing: false,
      originalContent: originalContent,  // Preserve for unedited divs
      isDirty: false,  // Track if content was modified
    };

    // Mark as dirty when content changes (any source - user or API)
    quill.on('text-change', () => {
      quillData.isDirty = true;
    });

    quillInstances.set(element, quillData);

    return quillData;
  } catch (err) {
    console.error("Failed to initialize Quill for element:", err);
    return null;
  }
}

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

    // Get dimensions - for images, use naturalWidth/naturalHeight if offset values are 0
    let width = element.offsetWidth;
    let height = element.offsetHeight;
    if (this.type === "img" && (width === 0 || height === 0)) {
      width = element.naturalWidth || width;
      height = element.naturalHeight || height;
    }

    // Initialize state from current element
    this.state = {
      x: 0,
      y: 0,
      width: width,
      height: height,
      rotation: 0,
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
      // Apply rotation to container
      if (this.state.rotation !== 0) {
        this.container.style.transform = `rotate(${this.state.rotation}deg)`;
      } else {
        this.container.style.transform = "";
      }
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

      // Parse rotation from transform
      const transform = this.container.style.transform || "";
      const rotateMatch = transform.match(/rotate\(([^)]+)deg\)/);
      this.state.rotation = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
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

    // Include rotation if set
    if (this.state.rotation !== 0) {
      dims.rotation = this.state.rotation;
    }

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
// Undo/Redo System
// =============================================================================

const undoStack = [];
const redoStack = [];

// Capture a snapshot of an element's state
function captureElementState(element) {
  const editableElt = editableRegistry.get(element);
  if (!editableElt) return null;

  editableElt.syncFromDOM();
  return {
    element: element,
    state: { ...editableElt.state },
  };
}

// Capture state of all elements
function captureAllState() {
  const snapshots = [];
  for (const [element, editableElt] of editableRegistry) {
    editableElt.syncFromDOM();
    snapshots.push({
      element: element,
      state: { ...editableElt.state },
    });
  }
  return snapshots;
}

// Restore state from a snapshot
function restoreState(snapshots) {
  for (const snapshot of snapshots) {
    const editableElt = editableRegistry.get(snapshot.element);
    if (editableElt) {
      editableElt.setState(snapshot.state);
    }
  }
}

// Push current state to undo stack (call before making changes)
function pushUndoState() {
  const state = captureAllState();
  undoStack.push(state);

  // Limit stack size
  if (undoStack.length > CONFIG.MAX_UNDO_STACK_SIZE) {
    undoStack.shift();
  }

  // Clear redo stack on new action
  redoStack.length = 0;
}

// Undo last action
function undo() {
  if (undoStack.length === 0) return false;

  // Save current state to redo stack
  const currentState = captureAllState();
  redoStack.push(currentState);

  // Restore previous state
  const previousState = undoStack.pop();
  restoreState(previousState);

  return true;
}

// Redo last undone action
function redo() {
  if (redoStack.length === 0) return false;

  // Save current state to undo stack
  const currentState = captureAllState();
  undoStack.push(currentState);

  // Restore redo state
  const redoState = redoStack.pop();
  restoreState(redoState);

  return true;
}

// Check if undo is available
function canUndo() {
  return undoStack.length > 0;
}

// Check if redo is available
function canRedo() {
  return redoStack.length > 0;
}

// Setup global keyboard shortcuts for undo/redo
function setupUndoRedoKeyboard() {
  document.addEventListener("keydown", (e) => {
    // Check for Ctrl+Z (undo) or Cmd+Z on Mac
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      // Don't intercept if user is editing text content
      if (document.activeElement.contentEditable === "true") return;

      e.preventDefault();
      if (undo()) {
        console.log("Undo performed");
      }
      return;
    }

    // Check for Ctrl+Y or Ctrl+Shift+Z (redo)
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      // Don't intercept if user is editing text content
      if (document.activeElement.contentEditable === "true") return;

      e.preventDefault();
      if (redo()) {
        console.log("Redo performed");
      }
      return;
    }
  });
}

// =============================================================================
// Capability System
// =============================================================================

// Capability definitions - each capability handles a specific interaction type
const Capabilities = {
  // Move capability - handles dragging elements
  move: {
    name: "move",

    init(context) {
      context.isDragging = false;
      context.dragStartX = 0;
      context.dragStartY = 0;
      context.dragInitialX = 0;
      context.dragInitialY = 0;
    },

    attachEvents(context) {
      const { element, container } = context;

      const startDrag = (e) => {
        // Don't start drag if element is in edit mode
        if (element.contentEditable === "true") return;
        // Check if Quill editor is in edit mode
        const quillData = quillInstances.get(element);
        if (quillData && quillData.isEditing) return;
        if (e.target.classList.contains("resize-handle")) return;
        // Don't start drag if clicking on Quill toolbar
        if (e.target.closest(".ql-toolbar") || e.target.closest(".quill-toolbar-container")) return;
        if (e.target.closest(".ql-picker") || e.target.classList.contains("ql-picker-item")) return;

        // Capture state for undo before starting drag
        pushUndoState();

        context.cachedScale = getSlideScale();
        context.isDragging = true;
        const coords = getClientCoordinates(e, context.cachedScale);

        context.dragStartX = coords.clientX;
        context.dragStartY = coords.clientY;
        context.dragInitialX = container.offsetLeft;
        context.dragInitialY = container.offsetTop;

        e.preventDefault();
      };

      element.addEventListener("mousedown", startDrag);
      element.addEventListener("touchstart", startDrag);

      context.handlers.drag = startDrag;
    },

    onMove(context, e) {
      if (!context.isDragging) return;

      const coords = getClientCoordinates(e, context.cachedScale);
      const deltaX = coords.clientX - context.dragStartX;
      const deltaY = coords.clientY - context.dragStartY;

      context.container.style.left = context.dragInitialX + deltaX + "px";
      context.container.style.top = context.dragInitialY + deltaY + "px";

      e.preventDefault();
    },

    onStop(context) {
      context.isDragging = false;
    },

    isActive(context) {
      return context.isDragging;
    },

    handleKeyboard(context, e, editableElt) {
      if (e.shiftKey) return false; // Let resize handle shift+arrows
      if (e.ctrlKey || e.metaKey) return false; // Let rotate handle ctrl/cmd+arrows

      const step = CONFIG.KEYBOARD_MOVE_STEP;
      const state = editableElt.getState();

      // Capture state for undo before keyboard move
      pushUndoState();

      switch (e.key) {
        case "ArrowRight":
          editableElt.setState({ x: state.x + step });
          return true;
        case "ArrowLeft":
          editableElt.setState({ x: state.x - step });
          return true;
        case "ArrowDown":
          editableElt.setState({ y: state.y + step });
          return true;
        case "ArrowUp":
          editableElt.setState({ y: state.y - step });
          return true;
      }
      return false;
    },
  },

  // Resize capability - handles resizing elements
  resize: {
    name: "resize",

    init(context) {
      context.isResizing = false;
      context.resizeHandle = null;
      context.resizeStartX = 0;
      context.resizeStartY = 0;
      context.resizeInitialWidth = 0;
      context.resizeInitialHeight = 0;
      context.resizeInitialX = 0;
      context.resizeInitialY = 0;
    },

    createHandles(context) {
      const { container } = context;

      const handles = ["nw", "ne", "sw", "se"];
      const handleLabels = {
        nw: "Resize from top-left corner",
        ne: "Resize from top-right corner",
        sw: "Resize from bottom-left corner",
        se: "Resize from bottom-right corner",
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
    },

    attachEvents(context) {
      const { container, element } = context;

      const startResize = (e) => {
        // Capture state for undo before starting resize
        pushUndoState();

        context.cachedScale = getSlideScale();
        context.isResizing = true;
        context.resizeHandle = e.target.dataset.position;

        const coords = getClientCoordinates(e, context.cachedScale);

        context.resizeStartX = coords.clientX;
        context.resizeStartY = coords.clientY;
        context.resizeInitialWidth = element.offsetWidth;
        context.resizeInitialHeight = element.offsetHeight;
        context.resizeInitialX = container.offsetLeft;
        context.resizeInitialY = container.offsetTop;

        e.preventDefault();
        e.stopPropagation();
      };

      container.querySelectorAll(".resize-handle").forEach((handle) => {
        handle.addEventListener("mousedown", startResize);
        handle.addEventListener("touchstart", startResize);
      });

      context.handlers.resize = startResize;
    },

    onMove(context, e) {
      if (!context.isResizing) return;

      const { element, container } = context;
      const coords = getClientCoordinates(e, context.cachedScale);
      const deltaX = coords.clientX - context.resizeStartX;
      const deltaY = coords.clientY - context.resizeStartY;

      let newWidth = context.resizeInitialWidth;
      let newHeight = context.resizeInitialHeight;
      let newX = context.resizeInitialX;
      let newY = context.resizeInitialY;

      const preserveAspectRatio = e.shiftKey;
      const aspectRatio = context.resizeInitialWidth / context.resizeInitialHeight;
      const handle = context.resizeHandle;

      if (preserveAspectRatio) {
        if (handle.includes("e") || handle.includes("w")) {
          const widthChange = handle.includes("e") ? deltaX : -deltaX;
          newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialWidth + widthChange);
          newHeight = newWidth / aspectRatio;
        } else if (handle.includes("s") || handle.includes("n")) {
          const heightChange = handle.includes("s") ? deltaY : -deltaY;
          newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialHeight + heightChange);
          newWidth = newHeight * aspectRatio;
        }

        if (handle.includes("w")) {
          newX = context.resizeInitialX + (context.resizeInitialWidth - newWidth);
        }
        if (handle.includes("n")) {
          newY = context.resizeInitialY + (context.resizeInitialHeight - newHeight);
        }
      } else {
        if (handle.includes("e")) {
          newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialWidth + deltaX);
        }
        if (handle.includes("w")) {
          newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialWidth - deltaX);
          newX = context.resizeInitialX + (context.resizeInitialWidth - newWidth);
        }
        if (handle.includes("s")) {
          newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialHeight + deltaY);
        }
        if (handle.includes("n")) {
          newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialHeight - deltaY);
          newY = context.resizeInitialY + (context.resizeInitialHeight - newHeight);
        }
      }

      element.style.width = newWidth + "px";
      element.style.height = newHeight + "px";
      container.style.left = newX + "px";
      container.style.top = newY + "px";

      e.preventDefault();
    },

    onStop(context) {
      context.isResizing = false;
      context.resizeHandle = null;
    },

    isActive(context) {
      return context.isResizing;
    },

    handleKeyboard(context, e, editableElt) {
      if (!e.shiftKey) return false; // Only handle shift+arrows
      if (e.ctrlKey || e.metaKey) return false; // Let rotate handle ctrl/cmd+shift+arrows

      const step = CONFIG.KEYBOARD_MOVE_STEP;
      const state = editableElt.getState();

      // Capture state for undo before keyboard resize
      pushUndoState();

      switch (e.key) {
        case "ArrowRight":
          editableElt.setState({ width: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.width + step) });
          return true;
        case "ArrowLeft":
          editableElt.setState({ width: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.width - step) });
          return true;
        case "ArrowDown":
          editableElt.setState({ height: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.height + step) });
          return true;
        case "ArrowUp":
          editableElt.setState({ height: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.height - step) });
          return true;
      }
      return false;
    },
  },

  // Font controls capability - now just creates the container for edit button
  // All formatting (font size, alignment, colors) is handled by Quill toolbar
  fontControls: {
    name: "fontControls",

    init(context) {
      // No special state needed
    },

    createControls(context) {
      const { container } = context;

      // Create font controls container (holds only the edit button now)
      const fontControls = document.createElement("div");
      fontControls.className = "editable-font-controls";
      container.appendChild(fontControls);
      return fontControls;
    },

    attachEvents(context) {
      // Events are attached via ControlRegistry.createButton
    },
  },

  // Edit text capability - contentEditable toggle (div only)
  editText: {
    name: "editText",

    init(context) {
      // No special state needed
    },

    createControls(context) {
      const { container, element } = context;
      const elementType = element.tagName.toLowerCase();

      // Find font controls container to append to
      let fontControls = container.querySelector(".editable-font-controls");
      if (!fontControls) {
        fontControls = document.createElement("div");
        fontControls.className = "editable-font-controls";
        container.appendChild(fontControls);
      }

      // Get edit mode control from registry
      const config = ControlRegistry.controls.get("editMode");
      if (config && config.appliesTo.includes(elementType)) {
        const btn = ControlRegistry.createButton(config, element);
        fontControls.appendChild(btn);
        return btn;
      }
      return null;
    },

    attachEvents(context) {
      // Events are attached via ControlRegistry.createButton
    },
  },

  // Rotate capability - handles rotating elements
  rotate: {
    name: "rotate",

    init(context) {
      context.isRotating = false;
      context.rotateStartAngle = 0;
      context.rotateInitialRotation = 0;
    },

    createHandles(context) {
      const { container } = context;

      const handle = document.createElement("div");
      handle.className = "rotate-handle";
      handle.setAttribute("role", "slider");
      handle.setAttribute("aria-label", "Rotate element");
      handle.setAttribute("tabindex", "-1");
      handle.title = "Rotate (Shift to snap to 15°)";
      container.appendChild(handle);
    },

    attachEvents(context) {
      const { container } = context;

      const startRotate = (e) => {
        // Capture state for undo before starting rotate
        pushUndoState();

        context.isRotating = true;

        // Get center of container in screen coordinates
        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        context.rotateCenterX = centerX;
        context.rotateCenterY = centerY;

        // Get mouse position in screen coordinates (no scaling needed)
        const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

        // Calculate starting angle from center to mouse
        context.rotateStartAngle = Math.atan2(
          clientY - centerY,
          clientX - centerX
        );

        // Get current rotation from state
        const editableElt = context.editableElt;
        context.rotateInitialRotation = editableElt.state.rotation || 0;

        e.preventDefault();
        e.stopPropagation();
      };

      const rotateHandle = container.querySelector(".rotate-handle");
      rotateHandle.addEventListener("mousedown", startRotate);
      rotateHandle.addEventListener("touchstart", startRotate);

      context.handlers.rotate = startRotate;
    },

    onMove(context, e) {
      if (!context.isRotating) return;

      // Get mouse position in screen coordinates (no scaling needed)
      const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

      // Calculate current angle from center to mouse
      const currentAngle = Math.atan2(
        clientY - context.rotateCenterY,
        clientX - context.rotateCenterX
      );

      // Calculate rotation difference in degrees
      const angleDiff = (currentAngle - context.rotateStartAngle) * (180 / Math.PI);
      let newRotation = context.rotateInitialRotation + angleDiff;

      // Snap to 15-degree increments if Shift key is pressed
      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      }

      // Normalize angle to -180 to 180 range
      while (newRotation > 180) newRotation -= 360;
      while (newRotation < -180) newRotation += 360;

      // Update state and DOM
      context.editableElt.setState({ rotation: newRotation });

      e.preventDefault();
    },

    onStop(context) {
      context.isRotating = false;
    },

    isActive(context) {
      return context.isRotating;
    },

    handleKeyboard(context, e, editableElt) {
      // Ctrl/Cmd + arrow keys for rotation
      if (!e.ctrlKey && !e.metaKey) return false;

      const step = e.shiftKey ? 15 : 5; // Shift for larger steps
      const state = editableElt.getState();

      // Capture state for undo before keyboard rotate
      pushUndoState();

      switch (e.key) {
        case "ArrowRight":
          editableElt.setState({ rotation: state.rotation + step });
          return true;
        case "ArrowLeft":
          editableElt.setState({ rotation: state.rotation - step });
          return true;
      }
      return false;
    },
  },
};

// Map element types to their capabilities
const ELEMENT_CAPABILITIES = {
  img: ["move", "resize", "rotate"],
  div: ["move", "resize", "rotate", "fontControls", "editText"],
};

// Get capabilities for an element type
function getCapabilitiesFor(elementType) {
  const capabilityNames = ELEMENT_CAPABILITIES[elementType] || ["move", "resize"];
  return capabilityNames.map((name) => Capabilities[name]).filter(Boolean);
}

// =============================================================================
// Control Registry
// =============================================================================

// Registry for UI controls - allows easy addition of new controls
const ControlRegistry = {
  controls: new Map(),

  // Register a new control
  register(name, config) {
    // config: { icon, ariaLabel, title, onClick, appliesTo, className }
    this.controls.set(name, { name, ...config });
  },

  // Get controls for a specific element type
  getControlsFor(elementType) {
    return [...this.controls.values()].filter(
      (c) => c.appliesTo.includes(elementType)
    );
  },

  // Create a button from a control config
  createButton(config, element) {
    const btn = createButton(config.icon, config.className || "");
    btn.setAttribute("aria-label", config.ariaLabel);
    btn.title = config.title;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      config.onClick(element, btn, e);
    });
    return btn;
  },
};

// Register built-in controls
ControlRegistry.register("decreaseFont", {
  icon: "A-",
  ariaLabel: "Decrease font size",
  title: "Decrease font size",
  className: "editable-button-font editable-button-decrease",
  appliesTo: ["div"],
  onClick: (element) => {
    pushUndoState();
    changeFontSize(element, -CONFIG.FONT_SIZE_STEP);
  },
});

ControlRegistry.register("increaseFont", {
  icon: "A+",
  ariaLabel: "Increase font size",
  title: "Increase font size",
  className: "editable-button-font editable-button-increase",
  appliesTo: ["div"],
  onClick: (element) => {
    pushUndoState();
    changeFontSize(element, CONFIG.FONT_SIZE_STEP);
  },
});

ControlRegistry.register("alignLeft", {
  icon: "⇤",
  ariaLabel: "Align text left",
  title: "Align Left",
  className: "editable-button-align",
  appliesTo: ["div"],
  onClick: (element) => {
    pushUndoState();
    element.style.textAlign = "left";
    const editableElt = editableRegistry.get(element);
    if (editableElt) editableElt.state.textAlign = "left";
  },
});

ControlRegistry.register("alignCenter", {
  icon: "⇔",
  ariaLabel: "Align text center",
  title: "Align Center",
  className: "editable-button-align",
  appliesTo: ["div"],
  onClick: (element) => {
    pushUndoState();
    element.style.textAlign = "center";
    const editableElt = editableRegistry.get(element);
    if (editableElt) editableElt.state.textAlign = "center";
  },
});

ControlRegistry.register("alignRight", {
  icon: "⇥",
  ariaLabel: "Align text right",
  title: "Align Right",
  className: "editable-button-align",
  appliesTo: ["div"],
  onClick: (element) => {
    pushUndoState();
    element.style.textAlign = "right";
    const editableElt = editableRegistry.get(element);
    if (editableElt) editableElt.state.textAlign = "right";
  },
});

ControlRegistry.register("editMode", {
  icon: "✎",
  ariaLabel: "Toggle edit mode",
  title: "Edit Text",
  className: "editable-button-edit",
  appliesTo: ["div"],
  onClick: (element, btn) => {
    // Use button's active class as the source of truth for edit state
    const isEditing = btn.classList.contains("active");

    // Quill should already be initialized at page load
    const quillData = quillInstances.get(element);

    if (!isEditing) {
      // Entering edit mode
      if (quillData) {
        // Show toolbar and enable editing
        if (quillData.toolbarContainer) {
          quillData.toolbarContainer.classList.add("editing");
        }
        quillData.isEditing = true;
        quillData.quill.enable(true);
        quillData.quill.focus();
      }

      btn.classList.add("active");
      btn.title = "Exit Edit Mode";
    } else {
      // Exiting edit mode
      if (quillData) {
        // Hide toolbar and disable editing
        if (quillData.toolbarContainer) {
          quillData.toolbarContainer.classList.remove("editing");
        }
        quillData.isEditing = false;
        quillData.quill.enable(false);
      }

      btn.classList.remove("active");
      btn.title = "Edit Text";

      // Deselect any selected text
      window.getSelection().removeAllRanges();
    }
  },
});

// =============================================================================
// New Element Registry - Tracks dynamically added elements and slides
// =============================================================================

const NewElementRegistry = {
  // Track new text divs added during the session
  newDivs: [],

  // Track new slides added during the session
  newSlides: [],

  // Track new arrows added during the session
  newArrows: [],

  // Add a new text div
  // newSlideRef is a reference to the new slide entry if this div is on a new slide
  addDiv(div, slideIndex, newSlideRef = null) {
    this.newDivs.push({
      element: div,
      slideIndex: slideIndex,
      content: div.textContent || CONFIG.NEW_TEXT_CONTENT,
      newSlideRef: newSlideRef, // Reference to NewElementRegistry.newSlides entry if on a new slide
    });
  },

  // Add a new slide
  // insertAfterNewSlide: reference to another newSlides entry if this slide comes after a new slide
  addSlide(slide, afterSlideIndex, insertAfterNewSlide = null) {
    this.newSlides.push({
      element: slide,
      afterSlideIndex: afterSlideIndex,
      insertAfterNewSlide: insertAfterNewSlide, // Reference to parent new slide, or null
      insertionOrder: this.newSlides.length,
    });
  },

  // Add a new arrow
  // newSlideRef is a reference to the new slide entry if this arrow is on a new slide
  // Note: We store the reference directly (not a copy) so handle drag updates are reflected
  addArrow(arrowData, slideIndex, newSlideRef = null) {
    arrowData.slideIndex = slideIndex;
    arrowData.newSlideRef = newSlideRef;
    this.newArrows.push(arrowData);
  },

  // Get count of new slides before a given index (for offset calculation)
  countNewSlidesBefore(index) {
    return this.newSlides.filter((s) => s.afterSlideIndex < index).length;
  },

  // Clear all tracked elements (e.g., after save)
  clear() {
    this.newDivs = [];
    this.newSlides = [];
    this.newArrows = [];
  },

  // Check if there are any new elements
  hasNewElements() {
    return this.newDivs.length > 0 || this.newSlides.length > 0 || this.newArrows.length > 0;
  },
};

// =============================================================================
// Toolbar Registry - Manages floating toolbar actions
// =============================================================================

const ToolbarRegistry = {
  actions: new Map(),

  // Register a toolbar action
  // config: { icon, label, title, onClick, className }
  // For submenu groups: { icon, label, title, className, submenu: [...configs] }
  register(name, config) {
    this.actions.set(name, { name, ...config });
  },

  // Get all registered actions
  getActions() {
    return [...this.actions.values()];
  },

  // Create a button from an action config
  createButton(config) {
    const btn = document.createElement("button");
    btn.className = "editable-toolbar-button " + (config.className || "");
    btn.setAttribute("aria-label", config.label);
    btn.title = config.title;
    btn.innerHTML = `<span class="toolbar-icon">${config.icon}</span><span class="toolbar-label">${config.label}</span>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      config.onClick(e);
    });
    return btn;
  },

  // Create a button with submenu
  createSubmenuButton(config) {
    const wrapper = document.createElement("div");
    wrapper.className = "editable-toolbar-submenu-wrapper";

    // Main button that toggles the submenu
    const btn = document.createElement("button");
    btn.className = "editable-toolbar-button " + (config.className || "");
    btn.setAttribute("aria-label", config.label);
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.title = config.title;
    btn.innerHTML = `<span class="toolbar-icon">${config.icon}</span><span class="toolbar-label">${config.label}</span>`;

    // Create submenu container
    const submenu = document.createElement("div");
    submenu.className = "editable-toolbar-submenu";
    submenu.setAttribute("role", "menu");

    // Add submenu items
    config.submenu.forEach((itemConfig) => {
      const item = document.createElement("button");
      item.className = "editable-toolbar-submenu-item " + (itemConfig.className || "");
      item.setAttribute("role", "menuitem");
      item.title = itemConfig.title;
      item.innerHTML = `<span class="toolbar-icon">${itemConfig.icon}</span><span class="toolbar-label">${itemConfig.label}</span>`;
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        itemConfig.onClick(e);
        // Close submenu after click
        submenu.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      });
      submenu.appendChild(item);
    });

    // Toggle submenu on button click
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = submenu.classList.toggle("open");
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Close submenu when clicking outside
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        submenu.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      }
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(submenu);
    return wrapper;
  },
};

// Register toolbar actions
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

// Add submenu: groups "Add Text", "Add Slide", and "Add Arrow"
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

// TODO: Add "modify" button for issue #48
// This will allow making any element editable without needing .editable class in source

// =============================================================================
// Property Serializers
// =============================================================================

// Serializers for converting state to QMD attributes
const PropertySerializers = {
  // Core position/size properties (go in attribute list)
  width: {
    type: "attr",
    serialize: (v) => `width=${round(v)}px`,
  },
  height: {
    type: "attr",
    serialize: (v) => `height=${round(v)}px`,
  },
  left: {
    type: "attr",
    serialize: (v) => `left=${round(v)}px`,
  },
  top: {
    type: "attr",
    serialize: (v) => `top=${round(v)}px`,
  },

  // Style properties (go in style attribute)
  fontSize: {
    type: "style",
    serialize: (v) => (v ? `font-size: ${v}px;` : null),
  },
  textAlign: {
    type: "style",
    serialize: (v) => (v ? `text-align: ${v};` : null),
  },
  rotation: {
    type: "style",
    serialize: (v) => (v ? `transform: rotate(${round(v)}deg);` : null),
  },
};

// Serialize dimensions to QMD attribute string
function serializeToQmd(dimensions) {
  const attrs = [];
  const styles = [];

  for (const [key, value] of Object.entries(dimensions)) {
    const serializer = PropertySerializers[key];
    if (serializer && value != null) {
      const result = serializer.serialize(value);
      if (result) {
        if (serializer.type === "style") {
          styles.push(result);
        } else {
          attrs.push(result);
        }
      }
    }
  }

  let str = `{.absolute ${attrs.join(" ")}`;
  if (styles.length > 0) {
    str += ` style="${styles.join(" ")}"`;
  }
  str += "}";
  return str;
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

// Get only original editable elements (exclude dynamically added ones)
function getOriginalEditableElements() {
  return document.querySelectorAll("img.editable:not(.editable-new), div.editable:not(.editable-new)");
}

function getOriginalEditableDivs() {
  return document.querySelectorAll("div.editable:not(.editable-new)");
}

// Get current slide index (Reveal.js index)
function getCurrentSlideIndex() {
  const indices = Reveal.getIndices();
  return indices.h;
}

// Get the current visible slide element
function getCurrentSlide() {
  return document.querySelector("section.present:not(.stack)") ||
         document.querySelector("section.present");
}

// Check if document has a title slide (from YAML frontmatter)
// Title slides don't have a ## heading in the QMD source
function hasTitleSlide() {
  const firstSlide = Reveal.getSlide(0);
  if (!firstSlide) return false;
  // Title slides typically have an h1 with the title, not an h2
  const h2 = firstSlide.querySelector("h2");
  return !h2;
}

// Convert Reveal.js slide index to QMD heading index
// If there's a title slide, the first ## heading is at Reveal index 1
function getQmdHeadingIndex(revealIndex) {
  if (hasTitleSlide()) {
    return revealIndex - 1;
  }
  return revealIndex;
}

// =============================================================================
// New Element Creation
// =============================================================================

async function addNewTextElement() {
  const currentSlide = getCurrentSlide();
  if (!currentSlide) {
    console.warn("No current slide found");
    return null;
  }

  // Create the new div
  const newDiv = document.createElement("div");
  newDiv.className = "editable editable-new";
  newDiv.textContent = CONFIG.NEW_TEXT_CONTENT;
  newDiv.style.width = CONFIG.NEW_TEXT_WIDTH + "px";
  newDiv.style.minHeight = CONFIG.NEW_TEXT_HEIGHT + "px";

  // Insert into current slide
  currentSlide.appendChild(newDiv);

  // Initialize Quill for the new element before setting up draggable
  await initializeQuillForElement(newDiv);

  // Setup as editable element (registers with editableRegistry)
  setupDraggableElt(newDiv);

  // Track in NewElementRegistry
  // Check if current slide is a new slide - if so, associate with that new slide
  const slideIndex = getCurrentSlideIndex();
  const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");

  if (isOnNewSlide) {
    // Find which new slide this is and track the div with it
    const newSlideEntry = NewElementRegistry.newSlides.find(
      (s) => s.element === currentSlide
    );
    if (newSlideEntry) {
      // Store reference to the new slide this div belongs to
      NewElementRegistry.addDiv(newDiv, slideIndex, newSlideEntry);
    } else {
      NewElementRegistry.addDiv(newDiv, slideIndex, null);
    }
  } else {
    // Convert to QMD heading index (accounts for title slide offset)
    const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);
    // Calculate original slide index (accounting for new slides before this position)
    const originalSlideIndex =
      qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
    NewElementRegistry.addDiv(newDiv, originalSlideIndex, null);
  }

  // Position in center of slide
  const editableElt = editableRegistry.get(newDiv);
  if (editableElt) {
    const slideWidth = currentSlide.offsetWidth || 960;
    const slideHeight = currentSlide.offsetHeight || 700;
    editableElt.setState({
      x: (slideWidth - CONFIG.NEW_TEXT_WIDTH) / 2,
      y: (slideHeight - CONFIG.NEW_TEXT_HEIGHT) / 2,
    });
  }

  console.log("Added new text element to slide", slideIndex);
  return newDiv;
}

function addNewSlide() {
  const currentSlide = getCurrentSlide();
  if (!currentSlide) {
    console.warn("No current slide found");
    return null;
  }

  const slideIndex = getCurrentSlideIndex();
  const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);

  // Calculate original slide index and track parent new slide if applicable
  let originalSlideIndex;
  let insertAfterNewSlide = null;
  const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");

  if (isOnNewSlide) {
    // Find the new slide entry we're on
    const currentNewSlideEntry = NewElementRegistry.newSlides.find(
      (s) => s.element === currentSlide
    );
    if (currentNewSlideEntry) {
      // Use the same original slide index, but track that we come after this new slide
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

  // Create new slide section
  const newSlide = document.createElement("section");
  newSlide.className = "slide level2 editable-new-slide";

  // Add placeholder heading
  const heading = document.createElement("h2");
  heading.textContent = "";
  newSlide.appendChild(heading);

  // Insert after current slide
  currentSlide.insertAdjacentElement("afterend", newSlide);

  // Track in registry with original slide index, insertion order, and parent reference
  NewElementRegistry.addSlide(newSlide, originalSlideIndex, insertAfterNewSlide);

  // Sync with Reveal.js and navigate to new slide
  Reveal.sync();
  Reveal.next();

  console.log(
    "Added new slide after original index",
    originalSlideIndex,
    "insertAfterNewSlide:",
    insertAfterNewSlide ? "yes" : "no"
  );
  return newSlide;
}

// =============================================================================
// Arrow Creation and Management
// =============================================================================

function addNewArrow() {
  const currentSlide = getCurrentSlide();
  if (!currentSlide) {
    console.warn("No current slide found");
    return null;
  }

  const slideIndex = getCurrentSlideIndex();
  const slideWidth = currentSlide.offsetWidth || 960;
  const slideHeight = currentSlide.offsetHeight || 700;

  // Default arrow position: centered, horizontal
  const centerX = slideWidth / 2;
  const centerY = slideHeight / 2;
  const halfLength = CONFIG.NEW_ARROW_LENGTH / 2;

  const arrowData = {
    fromX: centerX - halfLength,
    fromY: centerY,
    toX: centerX + halfLength,
    toY: centerY,
    // Control points (null = straight line, set values = curve)
    control1X: null,
    control1Y: null,
    control2X: null,
    control2Y: null,
    curveMode: false,
  };

  // Create the arrow container element
  const arrowContainer = createArrowElement(arrowData);
  currentSlide.appendChild(arrowContainer);

  // Store reference to container in arrowData for later updates
  arrowData.element = arrowContainer;

  // Track in NewElementRegistry
  const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");
  if (isOnNewSlide) {
    const newSlideEntry = NewElementRegistry.newSlides.find(
      (s) => s.element === currentSlide
    );
    NewElementRegistry.addArrow(arrowData, slideIndex, newSlideEntry || null);
  } else {
    // Convert to QMD heading index (accounts for title slide offset)
    const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);
    const originalSlideIndex =
      qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
    NewElementRegistry.addArrow(arrowData, originalSlideIndex, null);
  }

  console.log("Added new arrow to slide", slideIndex, "-> QMD heading index", getQmdHeadingIndex(slideIndex));
  return arrowContainer;
}

function createArrowElement(arrowData) {
  const container = document.createElement("div");
  container.className = "editable-arrow-container editable-new";
  container.style.position = "absolute";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.pointerEvents = "none";
  container.style.zIndex = "100";

  // Create SVG for the arrow
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.overflow = "visible";
  svg.style.pointerEvents = "none";

  // Create arrowhead marker
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  const markerId = "arrowhead-" + Math.random().toString(36).substr(2, 9);
  marker.setAttribute("id", markerId);
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "10");
  marker.setAttribute("refX", "0");
  marker.setAttribute("refY", "5");
  marker.setAttribute("orient", "auto");
  marker.setAttribute("markerUnits", "strokeWidth");

  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  arrowPath.setAttribute("fill", CONFIG.ARROW_DEFAULT_COLOR);
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Create the arrow path (supports both straight lines and Bezier curves)
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke", CONFIG.ARROW_DEFAULT_COLOR);
  path.setAttribute("stroke-width", CONFIG.ARROW_DEFAULT_WIDTH);
  path.setAttribute("fill", "none");
  path.setAttribute("marker-end", `url(#${markerId})`);
  path.style.pointerEvents = "stroke";
  svg.appendChild(path);

  // Create control point guide lines (shown in curve mode)
  const guideLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  guideLine1.setAttribute("stroke", CONFIG.ARROW_CONTROL1_COLOR);
  guideLine1.setAttribute("stroke-width", "1");
  guideLine1.setAttribute("stroke-dasharray", "4,4");
  guideLine1.setAttribute("opacity", "0.6");
  guideLine1.style.display = "none";
  svg.appendChild(guideLine1);

  const guideLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  guideLine2.setAttribute("stroke", CONFIG.ARROW_CONTROL2_COLOR);
  guideLine2.setAttribute("stroke-width", "1");
  guideLine2.setAttribute("stroke-dasharray", "4,4");
  guideLine2.setAttribute("opacity", "0.6");
  guideLine2.style.display = "none";
  svg.appendChild(guideLine2);

  container.appendChild(svg);

  // Store references for updates
  arrowData._path = path;
  arrowData._svg = svg;
  arrowData._markerId = markerId;
  arrowData._guideLine1 = guideLine1;
  arrowData._guideLine2 = guideLine2;
  arrowData._container = container;

  // Create draggable handles for start and end points
  const startHandle = createArrowHandle(arrowData, "start");
  const endHandle = createArrowHandle(arrowData, "end");
  container.appendChild(startHandle);
  container.appendChild(endHandle);

  arrowData._startHandle = startHandle;
  arrowData._endHandle = endHandle;

  // Create control point handles (hidden initially)
  const control1Handle = createArrowHandle(arrowData, "control1");
  const control2Handle = createArrowHandle(arrowData, "control2");
  control1Handle.style.display = "none";
  control2Handle.style.display = "none";
  container.appendChild(control1Handle);
  container.appendChild(control2Handle);

  arrowData._control1Handle = control1Handle;
  arrowData._control2Handle = control2Handle;

  // Create curve mode toggle button
  const curveToggle = createCurveModeToggle(arrowData);
  container.appendChild(curveToggle);
  arrowData._curveToggle = curveToggle;

  // Update visual
  updateArrowPath(arrowData);
  updateArrowHandles(arrowData);

  return container;
}

function createArrowHandle(arrowData, position) {
  const handle = document.createElement("div");
  handle.className = `editable-arrow-handle editable-arrow-handle-${position}`;
  handle.style.position = "absolute";

  // Different sizes and colors for different handle types
  const isControlPoint = position === "control1" || position === "control2";
  const handleSize = isControlPoint ? CONFIG.ARROW_CONTROL_HANDLE_SIZE : CONFIG.ARROW_HANDLE_SIZE;

  let bgColor;
  if (position === "start") bgColor = "#007cba";
  else if (position === "end") bgColor = "#28a745";
  else if (position === "control1") bgColor = CONFIG.ARROW_CONTROL1_COLOR;
  else if (position === "control2") bgColor = CONFIG.ARROW_CONTROL2_COLOR;

  handle.style.width = handleSize + "px";
  handle.style.height = handleSize + "px";
  handle.style.borderRadius = "50%";
  handle.style.backgroundColor = bgColor;
  handle.style.border = "2px solid white";
  handle.style.cursor = "move";
  handle.style.pointerEvents = "auto";
  handle.style.transform = "translate(-50%, -50%)";
  handle.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
  handle.setAttribute("role", "slider");
  handle.setAttribute("aria-label", `Arrow ${position} point`);
  handle.setAttribute("tabindex", "0");

  // Add drag functionality
  let isDragging = false;
  let cachedScale = 1;

  const startDrag = (e) => {
    isDragging = true;
    cachedScale = getSlideScale();
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrag = (e) => {
    if (!isDragging) return;

    const rect = arrowData.element.getBoundingClientRect();
    const scale = cachedScale;

    let clientX, clientY;
    if (e.type.startsWith("touch")) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Convert to slide coordinates
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;

    // Update arrow data based on which handle
    if (position === "start") {
      arrowData.fromX = x;
      arrowData.fromY = y;
    } else if (position === "end") {
      arrowData.toX = x;
      arrowData.toY = y;
    } else if (position === "control1") {
      arrowData.control1X = x;
      arrowData.control1Y = y;
    } else if (position === "control2") {
      arrowData.control2X = x;
      arrowData.control2Y = y;
    }

    // Update visual
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    updateCurveTogglePosition(arrowData);

    e.preventDefault();
  };

  const stopDrag = () => {
    isDragging = false;
  };

  handle.addEventListener("mousedown", startDrag);
  handle.addEventListener("touchstart", startDrag);
  document.addEventListener("mousemove", onDrag);
  document.addEventListener("touchmove", onDrag);
  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("touchend", stopDrag);

  return handle;
}

function updateArrowPath(arrowData) {
  if (!arrowData._path) return;

  const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y } = arrowData;
  let pathD;

  if (control1X !== null && control2X !== null) {
    // Cubic Bezier curve (two control points)
    pathD = `M ${fromX},${fromY} C ${control1X},${control1Y} ${control2X},${control2Y} ${toX},${toY}`;
  } else if (control1X !== null) {
    // Quadratic Bezier curve (one control point)
    pathD = `M ${fromX},${fromY} Q ${control1X},${control1Y} ${toX},${toY}`;
  } else {
    // Straight line
    pathD = `M ${fromX},${fromY} L ${toX},${toY}`;
  }

  arrowData._path.setAttribute("d", pathD);

  // Update guide lines (show connections from endpoints to control points)
  if (arrowData._guideLine1 && arrowData.curveMode) {
    if (control1X !== null) {
      arrowData._guideLine1.setAttribute("x1", fromX);
      arrowData._guideLine1.setAttribute("y1", fromY);
      arrowData._guideLine1.setAttribute("x2", control1X);
      arrowData._guideLine1.setAttribute("y2", control1Y);
      arrowData._guideLine1.style.display = "";
    } else {
      arrowData._guideLine1.style.display = "none";
    }
  }

  if (arrowData._guideLine2 && arrowData.curveMode) {
    if (control2X !== null) {
      arrowData._guideLine2.setAttribute("x1", toX);
      arrowData._guideLine2.setAttribute("y1", toY);
      arrowData._guideLine2.setAttribute("x2", control2X);
      arrowData._guideLine2.setAttribute("y2", control2Y);
      arrowData._guideLine2.style.display = "";
    } else {
      arrowData._guideLine2.style.display = "none";
    }
  }
}

function updateArrowHandles(arrowData) {
  if (arrowData._startHandle) {
    arrowData._startHandle.style.left = arrowData.fromX + "px";
    arrowData._startHandle.style.top = arrowData.fromY + "px";
  }
  if (arrowData._endHandle) {
    arrowData._endHandle.style.left = arrowData.toX + "px";
    arrowData._endHandle.style.top = arrowData.toY + "px";
  }
  if (arrowData._control1Handle && arrowData.control1X !== null) {
    arrowData._control1Handle.style.left = arrowData.control1X + "px";
    arrowData._control1Handle.style.top = arrowData.control1Y + "px";
  }
  if (arrowData._control2Handle && arrowData.control2X !== null) {
    arrowData._control2Handle.style.left = arrowData.control2X + "px";
    arrowData._control2Handle.style.top = arrowData.control2Y + "px";
  }
}

function createCurveModeToggle(arrowData) {
  const toggle = document.createElement("button");
  toggle.className = "editable-arrow-curve-toggle";
  toggle.innerHTML = "⤴";
  toggle.title = "Toggle curve mode";
  toggle.style.position = "absolute";
  toggle.style.width = "24px";
  toggle.style.height = "24px";
  toggle.style.borderRadius = "4px";
  toggle.style.border = "1px solid #ccc";
  toggle.style.background = "white";
  toggle.style.cursor = "pointer";
  toggle.style.fontSize = "14px";
  toggle.style.display = "flex";
  toggle.style.alignItems = "center";
  toggle.style.justifyContent = "center";
  toggle.style.pointerEvents = "auto";
  toggle.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
  toggle.style.zIndex = "102";

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCurveMode(arrowData);
  });

  // Position near the midpoint of the arrow
  updateCurveTogglePosition(arrowData, toggle);

  return toggle;
}

function toggleCurveMode(arrowData) {
  arrowData.curveMode = !arrowData.curveMode;

  if (arrowData.curveMode) {
    // Enable curve mode - initialize control points at sensible defaults
    const { fromX, fromY, toX, toY } = arrowData;
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;

    // Calculate perpendicular offset for control points
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len * 50; // 50px offset perpendicular to line
    const perpY = dx / len * 50;

    // Place control points at 1/3 and 2/3 along the line, offset perpendicular
    arrowData.control1X = fromX + dx / 3 + perpX;
    arrowData.control1Y = fromY + dy / 3 + perpY;
    arrowData.control2X = fromX + 2 * dx / 3 + perpX;
    arrowData.control2Y = fromY + 2 * dy / 3 + perpY;

    // Show control handles
    if (arrowData._control1Handle) arrowData._control1Handle.style.display = "";
    if (arrowData._control2Handle) arrowData._control2Handle.style.display = "";

    // Update toggle appearance
    if (arrowData._curveToggle) {
      arrowData._curveToggle.style.background = CONFIG.ARROW_CONTROL1_COLOR;
      arrowData._curveToggle.style.color = "white";
    }
  } else {
    // Disable curve mode - reset to straight line
    arrowData.control1X = null;
    arrowData.control1Y = null;
    arrowData.control2X = null;
    arrowData.control2Y = null;

    // Hide control handles and guide lines
    if (arrowData._control1Handle) arrowData._control1Handle.style.display = "none";
    if (arrowData._control2Handle) arrowData._control2Handle.style.display = "none";
    if (arrowData._guideLine1) arrowData._guideLine1.style.display = "none";
    if (arrowData._guideLine2) arrowData._guideLine2.style.display = "none";

    // Update toggle appearance
    if (arrowData._curveToggle) {
      arrowData._curveToggle.style.background = "white";
      arrowData._curveToggle.style.color = "black";
    }
  }

  updateArrowPath(arrowData);
  updateArrowHandles(arrowData);
}

function updateCurveTogglePosition(arrowData, toggle) {
  if (!toggle) toggle = arrowData._curveToggle;
  if (!toggle) return;

  const { fromX, fromY, toX, toY } = arrowData;
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  // Position toggle slightly offset from midpoint
  toggle.style.left = (midX + 15) + "px";
  toggle.style.top = (midY - 20) + "px";
}

// =============================================================================
// Floating Toolbar
// =============================================================================

function createFloatingToolbar() {
  // Check if toolbar already exists
  if (document.getElementById("editable-toolbar")) {
    return document.getElementById("editable-toolbar");
  }

  // Create toolbar container
  const toolbar = document.createElement("div");
  toolbar.id = "editable-toolbar";
  toolbar.className = "editable-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Editable tools");

  // Create drag handle
  const dragHandle = document.createElement("div");
  dragHandle.className = "editable-toolbar-handle";
  dragHandle.innerHTML = "⋮⋮";
  dragHandle.title = "Drag to move toolbar";
  toolbar.appendChild(dragHandle);

  // Create buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "editable-toolbar-buttons";

  // Add buttons from registry
  ToolbarRegistry.getActions().forEach((action) => {
    let element;
    if (action.submenu) {
      // Create button with submenu
      element = ToolbarRegistry.createSubmenuButton(action);
    } else {
      // Create regular button
      element = ToolbarRegistry.createButton(action);
    }
    buttonsContainer.appendChild(element);
  });

  toolbar.appendChild(buttonsContainer);

  // Make toolbar draggable
  makeToolbarDraggable(toolbar, dragHandle);

  // Add to document
  document.body.appendChild(toolbar);

  return toolbar;
}

function makeToolbarDraggable(toolbar, handle) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  function startDrag(e) {
    if (e.target !== handle && !handle.contains(e.target)) return;

    isDragging = true;
    handle.style.cursor = "grabbing";

    const rect = toolbar.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;

    if (e.type === "touchstart") {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else {
      startX = e.clientX;
      startY = e.clientY;
    }

    // Switch from right positioning to left positioning
    // Clear the transform that was used for initial centering
    toolbar.style.right = "auto";
    toolbar.style.transform = "none";
    toolbar.style.left = initialX + "px";
    toolbar.style.top = initialY + "px";

    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;

    let clientX, clientY;
    if (e.type === "touchmove") {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    toolbar.style.left = (initialX + deltaX) + "px";
    toolbar.style.top = (initialY + deltaY) + "px";
  }

  function stopDrag() {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = "grab";
    }
  }

  handle.addEventListener("mousedown", startDrag);
  handle.addEventListener("touchstart", startDrag);
  document.addEventListener("mousemove", drag);
  document.addEventListener("touchmove", drag);
  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("touchend", stopDrag);
}

// =============================================================================
// Plugin Initialization
// =============================================================================

window.Revealeditable = function () {
  return {
    id: "Revealeditable",
    init: function (deck) {
      deck.on("ready", async function () {
        const editableElements = getEditableElements();

        // First initialize Quill for all div elements (before setting up draggable)
        // This ensures DOM structure is stable before any interaction
        const editableDivs = Array.from(editableElements).filter(
          (el) => el.tagName.toLowerCase() === "div"
        );
        await Promise.all(editableDivs.map(initializeQuillForElement));

        // Now set up draggable elements, waiting for proper dimensions
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

// Helper to set up an image once it has valid dimensions
function setupImageWhenReady(img) {
  // Check if image already has valid dimensions
  if (img.complete && img.naturalWidth > 0 && img.offsetWidth > 0) {
    setupDraggableElt(img);
    return;
  }

  // For data-src images, Reveal.js sets src lazily
  // We need to handle: load event, and polling as fallback
  let setupDone = false;

  const doSetup = () => {
    if (setupDone) return;
    if (img.naturalWidth > 0 && img.offsetWidth > 0) {
      setupDone = true;
      setupDraggableElt(img);
    }
  };

  // Listen for load event
  img.addEventListener("load", doSetup, { once: true });

  // Also poll periodically as fallback (for edge cases with data-src)
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max
  const poll = () => {
    if (setupDone || attempts >= maxAttempts) return;
    attempts++;
    if (img.naturalWidth > 0 && img.offsetWidth > 0) {
      doSetup();
    } else {
      setTimeout(poll, 100);
    }
  };
  poll();
}

// Helper to set up a div once it has valid dimensions
function setupDivWhenReady(div) {
  // Check if div already has valid dimensions
  if (div.offsetWidth >= CONFIG.MIN_ELEMENT_SIZE && div.offsetHeight >= CONFIG.MIN_ELEMENT_SIZE) {
    setupDraggableElt(div);
    return;
  }

  // Wait for layout to complete using requestAnimationFrame + polling
  let setupDone = false;
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max

  const checkAndSetup = () => {
    if (setupDone || attempts >= maxAttempts) return;
    attempts++;

    if (div.offsetWidth >= CONFIG.MIN_ELEMENT_SIZE && div.offsetHeight >= CONFIG.MIN_ELEMENT_SIZE) {
      setupDone = true;
      setupDraggableElt(div);
    } else {
      // Use requestAnimationFrame for the first few attempts (layout timing)
      // then fall back to setTimeout for longer waits
      if (attempts < 10) {
        requestAnimationFrame(checkAndSetup);
      } else {
        setTimeout(checkAndSetup, 100);
      }
    }
  };

  // Start checking after next frame (gives CSS time to apply)
  requestAnimationFrame(checkAndSetup);
}

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

    // Helper to add menu hover behavior (matches reveal-menu plugin)
    function addMenuHoverBehavior(li) {
      li.addEventListener("mouseenter", function () {
        // Remove selected from siblings
        slideMenuItems.querySelectorAll(".slide-tool-item.selected").forEach((item) => {
          item.classList.remove("selected");
        });
        li.classList.add("selected");
      });
      li.addEventListener("mouseleave", function () {
        li.classList.remove("selected");
      });
    }

    // Add "Save Edits" button
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
    addMenuHoverBehavior(copyLi);
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

  // Create container
  const container = createEltContainer(elt);
  editableElt.container = container;
  setupEltStyles(elt);

  // Create shared context for capabilities
  const context = {
    element: elt,
    container: container,
    editableElt: editableElt,
    handlers: {},
    rafId: null,
    cachedScale: 1,
  };

  // Get capabilities for this element type
  const elementType = elt.tagName.toLowerCase();
  const capabilities = getCapabilitiesFor(elementType);

  // Initialize capabilities
  capabilities.forEach((cap) => {
    if (cap.init) cap.init(context);
  });

  // Setup container accessibility
  setupContainerAccessibility(container);

  // Let capabilities create their UI elements
  capabilities.forEach((cap) => {
    if (cap.createHandles) cap.createHandles(context);
    if (cap.createControls) cap.createControls(context);
  });

  // Let capabilities attach their events
  capabilities.forEach((cap) => {
    if (cap.attachEvents) cap.attachEvents(context);
  });

  // Setup hover/focus effects and keyboard navigation
  setupHoverEffects(context, capabilities);
  setupKeyboardNavigation(context, capabilities, editableElt);

  // Attach global pointer events
  attachGlobalEvents(context, capabilities);

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

    // For images, use naturalWidth/naturalHeight if offsetWidth/offsetHeight are 0
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

  // -------------------------------------------------------------------------
  // Hover and Focus Effects
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Keyboard Navigation
  // -------------------------------------------------------------------------

  function setupKeyboardNavigation(context, capabilities, editableElt) {
    const { container, element } = context;

    container.addEventListener("keydown", (e) => {
      // Don't intercept keyboard when element is in edit mode (contentEditable)
      // Allow normal text navigation/editing
      if (element.contentEditable === "true") {
        return;
      }

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

      editableElt.syncFromDOM();

      // Let capabilities handle keyboard input
      for (const cap of capabilities) {
        if (cap.handleKeyboard && cap.handleKeyboard(context, e, editableElt)) {
          break;
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Global Event Handlers
  // -------------------------------------------------------------------------

  function attachGlobalEvents(context, capabilities) {
    function handlePointerMove(e) {
      const isActive = capabilities.some((cap) => cap.isActive && cap.isActive(context));
      if (!isActive) return;

      // Cancel any pending frame
      if (context.rafId) {
        cancelAnimationFrame(context.rafId);
      }

      // Schedule update on next animation frame
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

// =============================================================================
// Save/Export Functions
// =============================================================================

// Get the transformed QMD content (shared logic for save and clipboard)
function getTransformedQmd() {
  let content = readIndexQmd();
  if (!content) return "";

  // First, insert any new slides into the content
  const { text: contentWithSlides, slideLinePositions } =
    insertNewSlides(content);
  content = contentWithSlides;

  // Then, insert any new text divs (pass slide positions for divs on new slides)
  content = insertNewDivs(content, slideLinePositions);

  // Insert any new arrows
  content = insertNewArrows(content, slideLinePositions);

  // Now process existing editable elements
  const dimensions = extractEditableEltDimensions();
  content = updateTextDivs(content);
  const attributes = formatEditableEltStrings(dimensions);
  content = replaceEditableOccurrences(content, attributes);

  return content;
}

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
  // Only process original elements, not dynamically added ones
  const editableElements = getOriginalEditableElements();
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

// Get the fence string needed for content (handles ::: in user content)
// If content contains :::, use :::: (or longer if needed)
function getFenceForContent(content) {
  // Find the longest sequence of colons at the start of any line
  const matches = content.match(/^:+/gm) || [];
  let maxColons = 3; // Default fence is :::
  for (const match of matches) {
    if (match.length >= maxColons) {
      maxColons = match.length + 1;
    }
  }
  return ":".repeat(maxColons);
}

// Convert element innerHTML to Quarto/Markdown text with proper formatting
function elementToText(element) {
  // If Quill was used, get content from .ql-editor
  const quillEditor = element.querySelector(".ql-editor");
  let text = quillEditor ? quillEditor.innerHTML.trim() : element.innerHTML.trim();

  // Convert HTML tags to Quarto/Markdown equivalents
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Handle Quill alignment classes on paragraphs using placeholder approach
  text = text.replace(/<p[^>]*class="[^"]*ql-align-(center|right|justify)[^"]*"[^>]*>/gi,
    (match, align) => `__ALIGN_START_${align}__`);
  text = text.replace(/__ALIGN_START_(center|right|justify)__([\s\S]*?)<\/p>/gi,
    (match, align, content) => `__ALIGN_START_${align}__${content}__ALIGN_END_${align}__\n\n`);

  // Handle remaining p tags (left-aligned or no alignment)
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<code[^>]*>/gi, "`");
  text = text.replace(/<\/code>/gi, "`");

  // Bold: <strong> and <b> → **text**
  text = text.replace(/<strong[^>]*>/gi, "**");
  text = text.replace(/<\/strong>/gi, "**");
  text = text.replace(/<b[^>]*>/gi, "**");
  text = text.replace(/<\/b>/gi, "**");

  // Italic: <em> and <i> → *text*
  text = text.replace(/<em[^>]*>/gi, "*");
  text = text.replace(/<\/em>/gi, "*");
  text = text.replace(/<i[^>]*>/gi, "*");
  text = text.replace(/<\/i>/gi, "*");

  // Strikethrough: <del> and <s> and <strike> → ~~text~~
  text = text.replace(/<del[^>]*>/gi, "~~");
  text = text.replace(/<\/del>/gi, "~~");
  text = text.replace(/<s(?![a-z])[^>]*>/gi, "~~");
  text = text.replace(/<\/s(?![a-z])>/gi, "~~");
  text = text.replace(/<strike[^>]*>/gi, "~~");
  text = text.replace(/<\/strike>/gi, "~~");

  // Underline: <u> → [text]{.underline}
  text = text.replace(/<u[^>]*>/gi, "[");
  text = text.replace(/<\/u>/gi, "]{.underline}");

  // Background color spans (must be processed BEFORE color to avoid false matches)
  text = text.replace(/<span[^>]*style="[^"]*background-color:\s*([^;"]+)[^"]*"[^>]*>/gi, '[__BG_START__$1__');
  text = text.replace(/__BG_START__([^_]+)__([^<]*)<\/span>/gi, (match, colorVal, content) => {
    const colorOutput = getBrandColorOutput(colorVal);
    return `${content}]{style='background-color: ${colorOutput}'}`;
  });

  // Color spans: <span style="color: ...">text</span> → [text]{style="color: ..."}
  text = text.replace(/<span[^>]*style="[^"]*(?<!background-)color:\s*([^;"]+)[^"]*"[^>]*>/gi, (match, colorVal) => {
    if (colorVal.trim().toLowerCase() === 'inherit') {
      return '';
    }
    return `[__COLOR_START__${colorVal}__`;
  });
  text = text.replace(/__COLOR_START__([^_]+)__([^<]*)<\/span>/gi, (match, colorVal, content) => {
    const colorOutput = getBrandColorOutput(colorVal);
    return `${content}]{style='color: ${colorOutput}'}`;
  });

  // Links: <a href="url">text</a> → [text](url)
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "[$2]($1)");

  // Remove any remaining HTML tags (cleanup)
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Clean up excessive newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  // Convert brand color placeholders back to shortcodes
  text = text.replace(/__BRAND_SHORTCODE_(\w+)__/g, '{{< brand color $1 >}}');

  // Convert alignment placeholders to fenced div syntax
  text = text.replace(/__ALIGN_START_(center|right|justify)__([\s\S]*?)__ALIGN_END_\1__/g,
    (match, align, content) => {
      const trimmed = content.trim();
      const innerFence = getFenceForContent(trimmed);
      return `${innerFence} {style="text-align: ${align}"}\n${trimmed}\n${innerFence}`;
    });

  return text.trim();
}

// Insert new slides (with their associated divs) into QMD content
function insertNewSlides(text) {
  if (NewElementRegistry.newSlides.length === 0) {
    return { text, slideLinePositions: new Map() };
  }

  const lines = text.split("\n");

  // Find all level-2 heading positions (slide boundaries)
  const slideHeadingLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : "";

    if (line.startsWith("## ") && (i === 0 || prevLine === "")) {
      slideHeadingLines.push(i);
    }
  }

  // Build a map of new slides to their associated divs
  const divsByNewSlide = new Map();
  for (const divInfo of NewElementRegistry.newDivs) {
    if (divInfo.newSlideRef) {
      if (!divsByNewSlide.has(divInfo.newSlideRef)) {
        divsByNewSlide.set(divInfo.newSlideRef, []);
      }
      divsByNewSlide.get(divInfo.newSlideRef).push(divInfo);
    }
  }

  // Build a map of new slides to their associated arrows
  const arrowsByNewSlide = new Map();
  for (const arrowInfo of NewElementRegistry.newArrows) {
    if (arrowInfo.newSlideRef) {
      if (!arrowsByNewSlide.has(arrowInfo.newSlideRef)) {
        arrowsByNewSlide.set(arrowInfo.newSlideRef, []);
      }
      arrowsByNewSlide.get(arrowInfo.newSlideRef).push(arrowInfo);
    }
  }

  // Build tree structure for slides with same afterSlideIndex
  // Flatten each tree respecting insertion semantics:
  // - Later roots come before earlier roots (inserted at same position, pushing down)
  // - Parent comes before its children
  // - Later children come before earlier children (inserted after parent, pushing siblings down)
  function flattenSlideTree(slides) {
    // Build children map
    const childrenOf = new Map();
    const roots = [];

    for (const slide of slides) {
      if (slide.insertAfterNewSlide && slides.includes(slide.insertAfterNewSlide)) {
        // This slide comes after another new slide in this group
        if (!childrenOf.has(slide.insertAfterNewSlide)) {
          childrenOf.set(slide.insertAfterNewSlide, []);
        }
        childrenOf.get(slide.insertAfterNewSlide).push(slide);
      } else {
        // This is a root (comes directly after original slide)
        roots.push(slide);
      }
    }

    // Sort roots by insertionOrder DESCENDING (later roots first, they pushed earlier ones down)
    roots.sort((a, b) => b.insertionOrder - a.insertionOrder);

    // Sort children by insertionOrder DESCENDING (later children first)
    for (const [, children] of childrenOf) {
      children.sort((a, b) => b.insertionOrder - a.insertionOrder);
    }

    // DFS to flatten: for each root (in descending order), visit it then its children
    // But children should come AFTER parent, so we do: parent, then recurse on children
    const result = [];
    function visit(slide) {
      result.push(slide);
      const children = childrenOf.get(slide) || [];
      for (const child of children) {
        visit(child);
      }
    }
    for (const root of roots) {
      visit(root);
    }
    return result;
  }

  // Group slides by afterSlideIndex
  const slidesByAfterIndex = new Map();
  for (const slide of NewElementRegistry.newSlides) {
    const idx = slide.afterSlideIndex;
    if (!slidesByAfterIndex.has(idx)) {
      slidesByAfterIndex.set(idx, []);
    }
    slidesByAfterIndex.get(idx).push(slide);
  }

  // Sort afterSlideIndex values in descending order (insert from end)
  const afterIndices = [...slidesByAfterIndex.keys()].sort((a, b) => b - a);

  const slideLinePositions = new Map();

  for (const afterIdx of afterIndices) {
    const slidesForThisIndex = slidesByAfterIndex.get(afterIdx);

    // Flatten the tree for this group - result is in desired final order
    const orderedSlides = flattenSlideTree(slidesForThisIndex);

    // Find the base insertion point for this afterSlideIndex (before any slides are inserted)
    const targetHeadingIndex = afterIdx;
    let baseInsertLineIndex;
    if (targetHeadingIndex >= slideHeadingLines.length) {
      baseInsertLineIndex = lines.length;
    } else if (targetHeadingIndex + 1 < slideHeadingLines.length) {
      baseInsertLineIndex = slideHeadingLines[targetHeadingIndex + 1];
    } else {
      baseInsertLineIndex = lines.length;
    }

    // Insert slides in REVERSE order of desired final order
    // Each insert goes at the SAME base position, so later inserts push earlier ones down
    // Result: first in orderedSlides ends up first in output
    for (let i = orderedSlides.length - 1; i >= 0; i--) {
      const newSlide = orderedSlides[i];

      // Build the new slide content
      const newSlideContent = ["", CONFIG.NEW_SLIDE_HEADING, ""];

      // Add divs for this slide
      const divsForThisSlide = divsByNewSlide.get(newSlide) || [];
      for (const divInfo of divsForThisSlide) {
        const editableElt = editableRegistry.get(divInfo.element);
        if (editableElt) {
          const dims = editableElt.toDimensions();
          const attrStr = serializeToQmd(dims);
          const textContent =
            elementToText(divInfo.element) || CONFIG.NEW_TEXT_CONTENT;

          // Determine fence length needed (must be longer than any ::: sequence in content)
          const fence = getFenceForContent(textContent);

          newSlideContent.push("");
          newSlideContent.push(`${fence} ${attrStr}`);
          newSlideContent.push(textContent);
          newSlideContent.push(fence);
        }
      }

      // Add arrows for this slide
      const arrowsForThisSlide = arrowsByNewSlide.get(newSlide) || [];
      for (const arrowInfo of arrowsForThisSlide) {
        const shortcode = serializeArrowToShortcode(arrowInfo);
        newSlideContent.push("");
        newSlideContent.push(shortcode);
        newSlideContent.push("");
      }

      // Track line position (will be at baseInsertLineIndex since we insert there)
      slideLinePositions.set(newSlide, baseInsertLineIndex + 1);

      // Insert at the base position (not the updated position)
      lines.splice(baseInsertLineIndex, 0, ...newSlideContent);

      // Update previously tracked positions (but NOT slideHeadingLines within this group)
      for (const [slide, pos] of slideLinePositions) {
        if (slide !== newSlide && pos >= baseInsertLineIndex) {
          slideLinePositions.set(slide, pos + newSlideContent.length);
        }
      }
    }

    // After processing this group, update slideHeadingLines for the total added content
    const totalLinesAdded = orderedSlides.reduce((sum, slide) => {
      const divs = divsByNewSlide.get(slide) || [];
      const arrows = arrowsByNewSlide.get(slide) || [];
      return sum + 3 + divs.length * 4 + arrows.length * 3; // 3 for heading, 4 per div, 3 per arrow
    }, 0);

    for (let j = 0; j < slideHeadingLines.length; j++) {
      if (slideHeadingLines[j] >= baseInsertLineIndex) {
        slideHeadingLines[j] += totalLinesAdded;
      }
    }
  }

  return { text: lines.join("\n"), slideLinePositions };
}

// Insert new text divs into QMD content
// Only handles divs on ORIGINAL slides - divs on new slides are handled by insertNewSlides
function insertNewDivs(text, slideLinePositions = new Map()) {
  // Filter to only divs on original slides (not on new slides)
  const divsOnOriginalSlides = NewElementRegistry.newDivs.filter(
    (div) => !div.newSlideRef
  );

  if (divsOnOriginalSlides.length === 0) {
    return text;
  }

  const lines = text.split("\n");

  // Find all level-2 heading positions
  const slideHeadingLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : "";

    if (line.startsWith("## ") && (i === 0 || prevLine === "")) {
      slideHeadingLines.push(i);
    }
  }

  // Group divs by slide index
  const divsBySlide = new Map();
  for (const newDiv of divsOnOriginalSlides) {
    const slideIdx = newDiv.slideIndex;
    if (!divsBySlide.has(slideIdx)) {
      divsBySlide.set(slideIdx, []);
    }
    divsBySlide.get(slideIdx).push(newDiv);
  }

  // Sort slide indices in descending order (insert from end)
  const slideIndices = [...divsBySlide.keys()].sort((a, b) => b - a);

  for (const slideIdx of slideIndices) {
    const divsForSlide = divsBySlide.get(slideIdx);

    // Find where to insert (before the next slide or at end)
    let insertLineIndex;
    if (slideIdx >= slideHeadingLines.length) {
      insertLineIndex = lines.length;
    } else if (slideIdx + 1 < slideHeadingLines.length) {
      insertLineIndex = slideHeadingLines[slideIdx + 1];
    } else {
      insertLineIndex = lines.length;
    }

    // Create div content for all new divs on this slide
    const newContent = [];
    for (const divInfo of divsForSlide) {
      const editableElt = editableRegistry.get(divInfo.element);
      if (editableElt) {
        const dims = editableElt.toDimensions();
        const attrStr = serializeToQmd(dims);
        const textContent =
          elementToText(divInfo.element) || CONFIG.NEW_TEXT_CONTENT;

        // Determine fence length needed (must be longer than any ::: sequence in content)
        const fence = getFenceForContent(textContent);

        newContent.push("");
        newContent.push(`${fence} ${attrStr}`);
        newContent.push(textContent);
        newContent.push(fence);
      }
    }

    if (newContent.length > 0) {
      lines.splice(insertLineIndex, 0, ...newContent);

      // Update slideHeadingLines for subsequent insertions
      for (let i = 0; i < slideHeadingLines.length; i++) {
        if (slideHeadingLines[i] >= insertLineIndex) {
          slideHeadingLines[i] += newContent.length;
        }
      }
    }
  }

  return lines.join("\n");
}

// Insert new arrows into QMD content
// Only handles arrows on ORIGINAL slides - arrows on new slides are handled by insertNewSlides
function insertNewArrows(text, slideLinePositions = new Map()) {
  // Filter to only arrows on original slides (not on new slides)
  const arrowsOnOriginalSlides = NewElementRegistry.newArrows.filter(
    (arrow) => !arrow.newSlideRef
  );

  if (arrowsOnOriginalSlides.length === 0) {
    return text;
  }

  const lines = text.split("\n");

  // Find all level-2 heading positions
  const slideHeadingLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : "";

    if (line.startsWith("## ") && (i === 0 || prevLine === "")) {
      slideHeadingLines.push(i);
    }
  }

  // Group arrows by slide index
  const arrowsBySlide = new Map();
  for (const arrow of arrowsOnOriginalSlides) {
    const slideIdx = arrow.slideIndex;
    if (!arrowsBySlide.has(slideIdx)) {
      arrowsBySlide.set(slideIdx, []);
    }
    arrowsBySlide.get(slideIdx).push(arrow);
  }

  // Sort slide indices in descending order (insert from end)
  const slideIndices = [...arrowsBySlide.keys()].sort((a, b) => b - a);

  for (const slideIdx of slideIndices) {
    const arrowsForSlide = arrowsBySlide.get(slideIdx);

    // Find where to insert (before the next slide or at end)
    let insertLineIndex;
    if (slideIdx >= slideHeadingLines.length) {
      insertLineIndex = lines.length;
    } else if (slideIdx + 1 < slideHeadingLines.length) {
      insertLineIndex = slideHeadingLines[slideIdx + 1];
    } else {
      insertLineIndex = lines.length;
    }

    // Create arrow shortcodes for all new arrows on this slide
    const newContent = [];
    for (const arrow of arrowsForSlide) {
      const shortcode = serializeArrowToShortcode(arrow);
      newContent.push("");
      newContent.push(shortcode);
      newContent.push("");
    }

    if (newContent.length > 0) {
      lines.splice(insertLineIndex, 0, ...newContent);

      // Update slideHeadingLines for subsequent insertions
      for (let i = 0; i < slideHeadingLines.length; i++) {
        if (slideHeadingLines[i] >= insertLineIndex) {
          slideHeadingLines[i] += newContent.length;
        }
      }
    }
  }

  return lines.join("\n");
}

// Serialize an arrow to quarto-arrows shortcode format
function serializeArrowToShortcode(arrow) {
  const fromX = round(arrow.fromX);
  const fromY = round(arrow.fromY);
  const toX = round(arrow.toX);
  const toY = round(arrow.toY);

  let shortcode = `{{< arrow from="${fromX},${fromY}" to="${toX},${toY}"`;

  // Add control points if they exist (curved arrow)
  if (arrow.control1X !== null && arrow.control1Y !== null) {
    const c1x = round(arrow.control1X);
    const c1y = round(arrow.control1Y);
    shortcode += ` control1="${c1x},${c1y}"`;
  }

  if (arrow.control2X !== null && arrow.control2Y !== null) {
    const c2x = round(arrow.control2X);
    const c2y = round(arrow.control2Y);
    shortcode += ` control2="${c2x},${c2y}"`;
  }

  shortcode += ` position="absolute" >}}`;

  return shortcode;
}

function updateTextDivs(text) {
  // Only process original divs, not dynamically added ones
  const divs = getOriginalEditableDivs();
  const replacements = Array.from(divs).map(htmlToQuarto);

  // Match fenced divs with 3+ colons: ::: {.editable...} ... :::
  // The closing fence must have the same number of colons as the opening
  // Capture: (1) opening fence, (2) content between fences
  const regex = /^(:{3,}) ?(?:\{\.editable[^}]*\}|editable)\n([\s\S]*?)\n\1$/gm;

  let index = 0;
  return text.replace(regex, (match, fence, originalContent) => {
    const replacement = replacements[index++];
    // If null, div wasn't edited - keep original content but use standard fence format
    // so that replaceEditableOccurrences can still add positioning attributes
    if (replacement === null) {
      const contentFence = getFenceForContent(originalContent);
      return `${contentFence} {.editable}\n${originalContent}\n${contentFence}`;
    }
    return replacement || "";
  });
}

function htmlToQuarto(div) {
  // Check if this div was edited - if not, return null to signal "keep original"
  const quillData = quillInstances.get(div);
  if (quillData && !quillData.isDirty) {
    // Content wasn't modified - return null so updateTextDivs keeps original source
    return null;
  }

  // Use shared conversion function
  const text = elementToText(div);

  // Wrap in fenced div
  const fence = getFenceForContent(text);
  return `${fence} {.editable}\n` + text.trim() + `\n${fence}`;
}

function replaceEditableOccurrences(text, replacements) {
  // Only replace {.editable} in valid contexts:
  // 1. After ":::+ " at start of line (div syntax with 3+ colons)
  // 2. After ")" in image syntax like ![](image.png){.editable}
  // This prevents replacing {.editable} that appears in user text content

  // Use a single regex that matches both valid contexts in document order
  // This ensures replacements are applied in the correct sequence
  const regex = /(?:^(:{3,}) |(?<=\]\([^)]*\)))\{\.editable[^}]*\}/gm;

  let index = 0;
  return text.replace(regex, (match, fenceColons) => {
    // Preserve the prefix (fence colons + space, or nothing for image syntax)
    const isDiv = fenceColons !== undefined;
    const prefix = isDiv ? fenceColons + ' ' : '';
    return prefix + (replacements[index++] || "");
  });
}

function formatEditableEltStrings(dimensions) {
  return dimensions.map((dim) => serializeToQmd(dim));
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
