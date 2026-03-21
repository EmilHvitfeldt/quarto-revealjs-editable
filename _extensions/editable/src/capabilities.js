/**
 * Capability system for modular element behaviors.
 * Each capability handles a specific type of interaction (move, resize, rotate, etc.).
 * @module capabilities
 */

import { CONFIG } from './config.js';
import { getSlideScale, getClientCoordinates } from './utils.js';
import { pushUndoState } from './undo.js';
import { quillInstances } from './quill.js';
import { ControlRegistry } from './registries.js';

/**
 * Capability definitions for editable elements.
 * Each capability has a consistent interface with optional methods:
 * - init(context) - Initialize capability state
 * - createHandles(context) - Create UI handles
 * - createControls(context) - Create UI controls
 * - attachEvents(context) - Attach event listeners
 * - onMove(context, event) - Handle pointer move
 * - onStop(context) - Cleanup when interaction ends
 * - isActive(context) - Check if currently active
 * - handleKeyboard(context, event, editableElt) - Handle arrow keys
 * @type {Object}
 */
export const Capabilities = {
  /**
   * Move capability - handles dragging elements to reposition them.
   */
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

  /**
   * Resize capability - handles resizing elements via corner handles.
   * Supports aspect ratio preservation with Shift key.
   */
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

  /**
   * Font controls capability - creates container for edit button.
   * Actual formatting (font size, alignment, colors) is handled by Quill toolbar.
   */
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

  /**
   * Edit text capability - toggles contentEditable mode for divs.
   */
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

  /**
   * Rotate capability - handles rotating elements via top handle.
   * Supports 15-degree snap with Shift key.
   * Keyboard: Ctrl/Cmd + arrow keys for rotation.
   */
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

/**
 * Maps element types to their enabled capabilities.
 * @type {Object<string, string[]>}
 */
export const ELEMENT_CAPABILITIES = {
  img: ["move", "resize", "rotate"],
  div: ["move", "resize", "rotate", "fontControls", "editText"],
};

/**
 * Get capability objects for an element type.
 * @param {string} elementType - Element type ("img" or "div")
 * @returns {Object[]} Array of capability objects
 */
export function getCapabilitiesFor(elementType) {
  const capabilityNames = ELEMENT_CAPABILITIES[elementType] || ["move", "resize"];
  return capabilityNames.map((name) => Capabilities[name]).filter(Boolean);
}
