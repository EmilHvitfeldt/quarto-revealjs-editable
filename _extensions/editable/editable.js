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
        if (e.target.parentElement.contentEditable === "true") return;
        if (e.target.classList.contains("resize-handle")) return;

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

  // Font controls capability - font size and alignment (div only)
  fontControls: {
    name: "fontControls",

    init(context) {
      // No special state needed
    },

    createControls(context) {
      const { container, element } = context;
      const elementType = element.tagName.toLowerCase();

      // Create font controls container
      const fontControls = document.createElement("div");
      fontControls.className = "editable-font-controls";

      // Get controls from registry for this element type
      const controlNames = ["decreaseFont", "increaseFont", "alignLeft", "alignCenter", "alignRight"];
      controlNames.forEach((name) => {
        const config = ControlRegistry.controls.get(name);
        if (config && config.appliesTo.includes(elementType)) {
          const btn = ControlRegistry.createButton(config, element);
          fontControls.appendChild(btn);
        }
      });

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

        context.cachedScale = getSlideScale();
        context.isRotating = true;

        // Get center of container
        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        context.rotateCenterX = centerX;
        context.rotateCenterY = centerY;

        // Calculate starting angle from center to mouse
        const coords = getClientCoordinates(e, 1); // Don't scale for angle calculation
        context.rotateStartAngle = Math.atan2(
          coords.clientY * context.cachedScale - centerY,
          coords.clientX * context.cachedScale - centerX
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

      const coords = getClientCoordinates(e, 1); // Don't scale for angle calculation

      // Calculate current angle from center to mouse
      const currentAngle = Math.atan2(
        coords.clientY * context.cachedScale - context.rotateCenterY,
        coords.clientX * context.cachedScale - context.rotateCenterX
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
  title: "Toggle Edit Mode",
  className: "editable-button-edit",
  appliesTo: ["div"],
  onClick: (element, btn) => {
    const isEditable = element.contentEditable === "true";
    element.contentEditable = !isEditable;
    btn.classList.toggle("active", !isEditable);
    btn.title = !isEditable ? "Exit Edit Mode" : "Toggle Edit Mode";
    if (!isEditable) {
      element.focus();
    }
  },
});

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
        setupUndoRedoKeyboard();
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
    elt.style.width = elt.offsetWidth + "px";
    elt.style.height = elt.offsetHeight + "px";
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
    const { container } = context;

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
