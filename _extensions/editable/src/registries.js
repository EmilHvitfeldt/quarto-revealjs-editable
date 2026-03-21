/**
 * Registry systems for UI controls, toolbar actions, and new elements.
 * @module registries
 */

import { CONFIG } from './config.js';
import { createButton, changeFontSize } from './utils.js';
import { editableRegistry } from './editable-element.js';
import { pushUndoState } from './undo.js';
import { quillInstances } from './quill.js';

/**
 * Registry for element control buttons (font size, alignment, edit mode).
 * Controls are shown when an element is selected/hovered.
 * @example
 * ControlRegistry.register("myControl", {
 *   icon: "X",
 *   ariaLabel: "My control",
 *   title: "Tooltip text",
 *   className: "my-control-class",
 *   appliesTo: ["div"],
 *   onClick: (element, btn, e) => { ... }
 * });
 */
export const ControlRegistry = {
  /** @type {Map<string, Object>} Registered controls by name */
  controls: new Map(),

  /**
   * Register a new control.
   * @param {string} name - Unique control name
   * @param {Object} config - Control configuration
   * @param {string} config.icon - Button text/icon
   * @param {string} config.ariaLabel - Accessibility label
   * @param {string} config.title - Tooltip text
   * @param {string} [config.className] - Additional CSS class
   * @param {string[]} config.appliesTo - Element types this control applies to
   * @param {Function} config.onClick - Click handler (element, btn, event)
   */
  register(name, config) {
    this.controls.set(name, { name, ...config });
  },

  /**
   * Get controls applicable to an element type.
   * @param {string} elementType - Element type ("img" or "div")
   * @returns {Object[]} Array of control configs
   */
  getControlsFor(elementType) {
    return [...this.controls.values()].filter(
      (c) => c.appliesTo.includes(elementType)
    );
  },

  /**
   * Create a button element from a control config.
   * @param {Object} config - Control configuration
   * @param {HTMLElement} element - The editable element
   * @returns {HTMLButtonElement} The created button
   */
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
    changeFontSize(element, -CONFIG.FONT_SIZE_STEP, editableRegistry);
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
    changeFontSize(element, CONFIG.FONT_SIZE_STEP, editableRegistry);
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

/**
 * Registry tracking dynamically added elements, slides, and arrows.
 * Tracks insertions during a session for proper serialization to QMD.
 */
export const NewElementRegistry = {
  /** @type {Array<{element: HTMLElement, slideIndex: number, content: string, newSlideRef: Object|null}>} */
  newDivs: [],

  /** @type {Array<{element: HTMLElement, afterSlideIndex: number, insertAfterNewSlide: Object|null, insertionOrder: number}>} */
  newSlides: [],

  /** @type {Array<Object>} Arrow data objects */
  newArrows: [],

  /**
   * Add a new text div to tracking.
   * @param {HTMLElement} div - The div element
   * @param {number} slideIndex - Index of the slide containing the div
   * @param {Object|null} [newSlideRef=null] - Reference to newSlides entry if on a new slide
   */
  addDiv(div, slideIndex, newSlideRef = null) {
    this.newDivs.push({
      element: div,
      slideIndex: slideIndex,
      content: div.textContent || CONFIG.NEW_TEXT_CONTENT,
      newSlideRef: newSlideRef,
    });
  },

  /**
   * Add a new slide to tracking.
   * @param {HTMLElement} slide - The slide section element
   * @param {number} afterSlideIndex - Original slide index to insert after
   * @param {Object|null} [insertAfterNewSlide=null] - Parent new slide for chained insertions
   */
  addSlide(slide, afterSlideIndex, insertAfterNewSlide = null) {
    this.newSlides.push({
      element: slide,
      afterSlideIndex: afterSlideIndex,
      insertAfterNewSlide: insertAfterNewSlide,
      insertionOrder: this.newSlides.length,
    });
  },

  /**
   * Add a new arrow to tracking.
   * Stores reference directly so drag updates are reflected.
   * @param {Object} arrowData - Arrow data object
   * @param {number} slideIndex - Index of the slide containing the arrow
   * @param {Object|null} [newSlideRef=null] - Reference to newSlides entry if on a new slide
   */
  addArrow(arrowData, slideIndex, newSlideRef = null) {
    arrowData.slideIndex = slideIndex;
    arrowData.newSlideRef = newSlideRef;
    this.newArrows.push(arrowData);
  },

  /**
   * Count new slides inserted before a given index (for offset calculation).
   * @param {number} index - The slide index
   * @returns {number} Count of new slides before this index
   */
  countNewSlidesBefore(index) {
    return this.newSlides.filter((s) => s.afterSlideIndex < index).length;
  },

  /**
   * Clear all tracked elements (e.g., after save).
   */
  clear() {
    this.newDivs = [];
    this.newSlides = [];
    this.newArrows = [];
  },

  /**
   * Check if there are any new elements tracked.
   * @returns {boolean} True if any new elements exist
   */
  hasNewElements() {
    return this.newDivs.length > 0 || this.newSlides.length > 0 || this.newArrows.length > 0;
  },
};

/**
 * Registry for floating toolbar actions (save, copy, add elements).
 * @example
 * ToolbarRegistry.register("myAction", {
 *   icon: "X",
 *   label: "My Action",
 *   title: "Tooltip text",
 *   className: "toolbar-my-action",
 *   onClick: () => { ... }
 * });
 */
export const ToolbarRegistry = {
  /** @type {Map<string, Object>} Registered actions by name */
  actions: new Map(),

  /**
   * Register a toolbar action.
   * @param {string} name - Unique action name
   * @param {Object} config - Action configuration
   * @param {string} config.icon - Button icon
   * @param {string} config.label - Button label
   * @param {string} config.title - Tooltip text
   * @param {string} [config.className] - Additional CSS class
   * @param {Function} [config.onClick] - Click handler
   * @param {Array} [config.submenu] - Submenu items for dropdown
   */
  register(name, config) {
    this.actions.set(name, { name, ...config });
  },

  /**
   * Get all registered actions.
   * @returns {Object[]} Array of action configs
   */
  getActions() {
    return [...this.actions.values()];
  },

  /**
   * Create a button element from an action config.
   * @param {Object} config - Action configuration
   * @returns {HTMLButtonElement} The created button
   */
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

  /**
   * Create a button with dropdown submenu.
   * @param {Object} config - Action configuration with submenu array
   * @returns {HTMLDivElement} Wrapper containing button and submenu
   */
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
