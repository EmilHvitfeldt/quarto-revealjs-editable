import { CONFIG } from './config.js';
import { createButton, changeFontSize } from './utils.js';
import { editableRegistry } from './editable-element.js';
import { pushUndoState } from './undo.js';
import { quillInstances } from './quill.js';

// =============================================================================
// Control Registry
// =============================================================================

// Registry for UI controls - allows easy addition of new controls
export const ControlRegistry = {
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

// =============================================================================
// New Element Registry - Tracks dynamically added elements and slides
// =============================================================================

export const NewElementRegistry = {
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

export const ToolbarRegistry = {
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
