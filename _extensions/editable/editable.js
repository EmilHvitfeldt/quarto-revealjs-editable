var EditableModule = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/config.js
  var CONFIG;
  var init_config = __esm({
    "src/config.js"() {
      CONFIG = {
        // Debug mode - set window.EDITABLE_DEBUG = true to enable
        DEBUG: typeof window !== "undefined" && window.EDITABLE_DEBUG,
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
        ARROW_WAYPOINT_COLOR: "#f59e0b",
        ARROW_WAYPOINT_HANDLE_SIZE: 10,
        ARROW_DEFAULT_LABEL_POSITION: "middle",
        ARROW_DEFAULT_LABEL_OFFSET: 10,
        // Polling config
        POLL_MAX_ATTEMPTS: 50,
        POLL_INTERVAL_MS: 100,
        // Quill Editor CDN
        QUILL_CSS: "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css",
        QUILL_JS: "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"
      };
    }
  });

  // src/utils.js
  function round(n) {
    return Math.round(n * 10) / 10;
  }
  function debug(...args) {
    if (CONFIG.DEBUG) {
      console.log("[editable]", ...args);
    }
  }
  function getSlideScale() {
    const slidesContainerEl = document.querySelector(".slides");
    return slidesContainerEl ? parseFloat(window.getComputedStyle(slidesContainerEl).getPropertyValue("--slide-scale")) || 1 : 1;
  }
  function getClientCoordinates(e, cachedScale) {
    const isTouch = e.type.startsWith("touch");
    const scale = cachedScale || getSlideScale();
    return {
      clientX: (isTouch ? e.touches[0].clientX : e.clientX) / scale,
      clientY: (isTouch ? e.touches[0].clientY : e.clientY) / scale
    };
  }
  function createButton(text, additionalClasses) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = "editable-button " + additionalClasses;
    return button;
  }
  function changeFontSize(element, delta, editableRegistry2) {
    const currentFontSize = parseFloat(window.getComputedStyle(element).fontSize) || CONFIG.DEFAULT_FONT_SIZE;
    const newFontSize = Math.max(CONFIG.MIN_FONT_SIZE, currentFontSize + delta);
    element.style.fontSize = newFontSize + "px";
    const editableElt = editableRegistry2.get(element);
    if (editableElt) {
      editableElt.state.fontSize = newFontSize;
    }
  }
  function getEditableElements() {
    return document.querySelectorAll("img.editable, div.editable");
  }
  function getOriginalEditableElements() {
    return document.querySelectorAll("img.editable:not(.editable-new), div.editable:not(.editable-new)");
  }
  function getOriginalEditableDivs() {
    return document.querySelectorAll("div.editable:not(.editable-new)");
  }
  function getCurrentSlideIndex() {
    if (typeof Reveal === "undefined")
      return 0;
    const indices = Reveal.getIndices();
    return indices.h;
  }
  function getCurrentSlide() {
    return document.querySelector("section.present:not(.stack)") || document.querySelector("section.present");
  }
  function hasTitleSlide() {
    if (typeof Reveal === "undefined")
      return false;
    const firstSlide = Reveal.getSlide(0);
    if (!firstSlide)
      return false;
    const h2 = firstSlide.querySelector("h2");
    return !h2;
  }
  function getQmdHeadingIndex(revealIndex) {
    if (hasTitleSlide()) {
      return revealIndex - 1;
    }
    return revealIndex;
  }
  var init_utils = __esm({
    "src/utils.js"() {
      init_config();
    }
  });

  // src/editable-element.js
  var editableRegistry, EditableElement;
  var init_editable_element = __esm({
    "src/editable-element.js"() {
      editableRegistry = /* @__PURE__ */ new Map();
      EditableElement = class {
        /**
         * @param {HTMLElement} element - The DOM element to wrap
         */
        constructor(element) {
          this.element = element;
          this.container = null;
          this.type = element.tagName.toLowerCase();
          let width = element.offsetWidth;
          let height = element.offsetHeight;
          if (this.type === "img" && (width === 0 || height === 0)) {
            width = element.naturalWidth || width;
            height = element.naturalHeight || height;
          }
          this.state = {
            x: 0,
            y: 0,
            width,
            height,
            rotation: 0,
            // Div-specific properties
            fontSize: null,
            textAlign: null
          };
        }
        /**
         * Get a copy of current state.
         * @returns {Object} Copy of state object
         */
        getState() {
          return { ...this.state };
        }
        /**
         * Update state and optionally sync to DOM.
         * @param {Object} updates - Properties to update
         * @param {boolean} [syncToDOM=true] - Whether to apply changes to DOM
         */
        setState(updates, syncToDOM = true) {
          Object.assign(this.state, updates);
          if (syncToDOM) {
            this.syncToDOM();
          }
        }
        /**
         * Apply internal state to DOM elements.
         * Called after state changes to update visual representation.
         */
        syncToDOM() {
          if (this.container) {
            this.container.style.left = this.state.x + "px";
            this.container.style.top = this.state.y + "px";
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
        /**
         * Read current values from DOM into state.
         * Called before serialization to capture any direct DOM changes.
         */
        syncFromDOM() {
          if (this.container) {
            this.state.x = this.container.style.left ? parseFloat(this.container.style.left) : this.container.offsetLeft;
            this.state.y = this.container.style.top ? parseFloat(this.container.style.top) : this.container.offsetTop;
            const transform = this.container.style.transform || "";
            const rotateMatch = transform.match(/rotate\(([^)]+)deg\)/);
            this.state.rotation = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
          }
          this.state.width = this.element.style.width ? parseFloat(this.element.style.width) : this.element.offsetWidth;
          this.state.height = this.element.style.height ? parseFloat(this.element.style.height) : this.element.offsetHeight;
          if (this.type === "div") {
            if (this.element.style.fontSize) {
              this.state.fontSize = parseFloat(this.element.style.fontSize);
            }
            if (this.element.style.textAlign) {
              this.state.textAlign = this.element.style.textAlign;
            }
          }
        }
        /**
         * Generate dimension object for serialization to QMD.
         * Syncs from DOM first to capture current values.
         * @returns {Object} Dimensions formatted for PropertySerializers
         */
        toDimensions() {
          this.syncFromDOM();
          const dims = {
            width: this.state.width,
            height: this.state.height,
            left: this.state.x,
            top: this.state.y
          };
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
      };
    }
  });

  // src/colors.js
  function getColorPalette() {
    if (window._quarto_brand_palette && Array.isArray(window._quarto_brand_palette) && window._quarto_brand_palette.length > 0) {
      return window._quarto_brand_palette;
    }
    return DEFAULT_COLOR_PALETTE;
  }
  function rgbToHex(rgb) {
    const match = rgb.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match)
      return null;
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  function normalizeColor(color) {
    if (!color)
      return color;
    let normalized = color.trim().toLowerCase();
    if (normalized.startsWith("rgb")) {
      const hex = rgbToHex(normalized);
      if (hex)
        return hex.toLowerCase();
    }
    if (normalized === "black")
      return "#000000";
    if (normalized.match(/^#[0-9a-f]{3}$/i)) {
      return "#" + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3];
    }
    return normalized;
  }
  function getBrandColorOutput(colorVal) {
    if (!window._quarto_brand_color_names) {
      return colorVal;
    }
    let normalizedColor = colorVal.toLowerCase().trim();
    if (normalizedColor.startsWith("rgb")) {
      const hexColor = rgbToHex(normalizedColor);
      if (hexColor) {
        normalizedColor = hexColor.toLowerCase();
      }
    }
    const brandName = window._quarto_brand_color_names[normalizedColor];
    if (brandName) {
      return `__BRAND_SHORTCODE_${brandName}__`;
    }
    return colorVal;
  }
  var DEFAULT_COLOR_PALETTE;
  var init_colors = __esm({
    "src/colors.js"() {
      DEFAULT_COLOR_PALETTE = [
        "#000000",
        "#434343",
        "#666666",
        "#999999",
        "#cccccc",
        "#ffffff",
        "#e60000",
        "#ff9900",
        "#ffff00",
        "#008a00",
        "#0066cc",
        "#9933ff",
        "#ff99cc",
        "#ffcc99",
        "#ffff99",
        "#99ff99",
        "#99ccff",
        "#cc99ff"
      ];
    }
  });

  // src/quill.js
  function loadQuill() {
    if (quillLoaded) {
      return Promise.resolve();
    }
    if (quillLoading) {
      return quillLoading;
    }
    quillLoading = new Promise((resolve, reject) => {
      const cssLink = document.createElement("link");
      cssLink.rel = "stylesheet";
      cssLink.href = CONFIG.QUILL_CSS;
      document.head.appendChild(cssLink);
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
  async function initializeQuillForElement(element) {
    if (element.tagName.toLowerCase() !== "div")
      return null;
    if (quillInstances.has(element))
      return quillInstances.get(element);
    if (initializingElements.has(element)) {
      await new Promise((resolve) => {
        const check = () => {
          if (quillInstances.has(element))
            resolve();
          else
            setTimeout(check, 10);
        };
        check();
      });
      return quillInstances.get(element);
    }
    initializingElements.add(element);
    try {
      let createColorHandler = function(picker, formatName) {
        return function(value) {
          if (value === "unset") {
            this.quill.format(formatName, false);
          } else if (value === "custom") {
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
      };
      await loadQuill();
      const originalContent = element.innerHTML;
      element.innerHTML = "";
      const presetColors = getColorPalette();
      const colorOptions = presetColors.map((c) => `<option value="${c}"></option>`).join("");
      const colorOptionsWithExtras = `<option value="unset"></option>` + colorOptions + `<option value="custom">\u22EF</option>`;
      const toolbarContainer = document.createElement("div");
      toolbarContainer.id = "toolbar-" + Math.random().toString(36).substring(2, 11);
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
      const textColorPicker = document.createElement("input");
      textColorPicker.type = "color";
      textColorPicker.style.cssText = "position:absolute;visibility:hidden;width:0;height:0;";
      element.appendChild(textColorPicker);
      const bgColorPicker = document.createElement("input");
      bgColorPicker.type = "color";
      bgColorPicker.style.cssText = "position:absolute;visibility:hidden;width:0;height:0;";
      element.appendChild(bgColorPicker);
      const editorWrapper = document.createElement("div");
      editorWrapper.className = "quill-wrapper";
      editorWrapper.innerHTML = originalContent;
      element.appendChild(editorWrapper);
      const quill = new Quill(editorWrapper, {
        theme: "snow",
        modules: {
          toolbar: {
            container: "#" + toolbarContainer.id,
            handlers: {
              color: createColorHandler(textColorPicker, "color"),
              background: createColorHandler(bgColorPicker, "background")
            }
          }
        },
        placeholder: ""
      });
      toolbarContainer.className = "quill-toolbar-container ql-toolbar ql-snow";
      toolbarContainer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      quill.enable(false);
      const quillData = {
        quill,
        toolbarContainer,
        editorWrapper,
        isEditing: false,
        originalContent,
        // Preserve for unedited divs
        isDirty: false
        // Track if content was modified
      };
      quill.on("text-change", () => {
        quillData.isDirty = true;
      });
      quillInstances.set(element, quillData);
      initializingElements.delete(element);
      return quillData;
    } catch (err) {
      console.error("Failed to initialize Quill for element:", err);
      initializingElements.delete(element);
      return null;
    }
  }
  var quillLoaded, quillLoading, quillInstances, initializingElements;
  var init_quill = __esm({
    "src/quill.js"() {
      init_config();
      init_colors();
      quillLoaded = false;
      quillLoading = null;
      quillInstances = /* @__PURE__ */ new Map();
      initializingElements = /* @__PURE__ */ new Set();
    }
  });

  // src/registries.js
  var ControlRegistry, NewElementRegistry, ToolbarRegistry;
  var init_registries = __esm({
    "src/registries.js"() {
      init_config();
      init_utils();
      init_editable_element();
      init_undo();
      init_quill();
      ControlRegistry = {
        /** @type {Map<string, Object>} Registered controls by name */
        controls: /* @__PURE__ */ new Map(),
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
        }
      };
      ControlRegistry.register("decreaseFont", {
        icon: "A-",
        ariaLabel: "Decrease font size",
        title: "Decrease font size",
        className: "editable-button-font editable-button-decrease",
        appliesTo: ["div"],
        onClick: (element) => {
          pushUndoState();
          changeFontSize(element, -CONFIG.FONT_SIZE_STEP, editableRegistry);
        }
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
        }
      });
      ControlRegistry.register("alignLeft", {
        icon: "\u21E4",
        ariaLabel: "Align text left",
        title: "Align Left",
        className: "editable-button-align",
        appliesTo: ["div"],
        onClick: (element) => {
          pushUndoState();
          element.style.textAlign = "left";
          const editableElt = editableRegistry.get(element);
          if (editableElt)
            editableElt.state.textAlign = "left";
        }
      });
      ControlRegistry.register("alignCenter", {
        icon: "\u21D4",
        ariaLabel: "Align text center",
        title: "Align Center",
        className: "editable-button-align",
        appliesTo: ["div"],
        onClick: (element) => {
          pushUndoState();
          element.style.textAlign = "center";
          const editableElt = editableRegistry.get(element);
          if (editableElt)
            editableElt.state.textAlign = "center";
        }
      });
      ControlRegistry.register("alignRight", {
        icon: "\u21E5",
        ariaLabel: "Align text right",
        title: "Align Right",
        className: "editable-button-align",
        appliesTo: ["div"],
        onClick: (element) => {
          pushUndoState();
          element.style.textAlign = "right";
          const editableElt = editableRegistry.get(element);
          if (editableElt)
            editableElt.state.textAlign = "right";
        }
      });
      ControlRegistry.register("editMode", {
        icon: "\u270E",
        ariaLabel: "Toggle edit mode",
        title: "Edit Text",
        className: "editable-button-edit",
        appliesTo: ["div"],
        onClick: (element, btn) => {
          const isEditing = btn.classList.contains("active");
          const quillData = quillInstances.get(element);
          if (!isEditing) {
            if (quillData) {
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
            if (quillData) {
              if (quillData.toolbarContainer) {
                quillData.toolbarContainer.classList.remove("editing");
              }
              quillData.isEditing = false;
              quillData.quill.enable(false);
            }
            btn.classList.remove("active");
            btn.title = "Edit Text";
            window.getSelection().removeAllRanges();
          }
        }
      });
      NewElementRegistry = {
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
            slideIndex,
            content: div.textContent || CONFIG.NEW_TEXT_CONTENT,
            newSlideRef
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
            afterSlideIndex,
            insertAfterNewSlide,
            insertionOrder: this.newSlides.length
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
        }
      };
      ToolbarRegistry = {
        /** @type {Map<string, Object>} Registered actions by name */
        actions: /* @__PURE__ */ new Map(),
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
          const btn = document.createElement("button");
          btn.className = "editable-toolbar-button " + (config.className || "");
          btn.setAttribute("aria-label", config.label);
          btn.setAttribute("aria-haspopup", "true");
          btn.setAttribute("aria-expanded", "false");
          btn.title = config.title;
          btn.innerHTML = `<span class="toolbar-icon">${config.icon}</span><span class="toolbar-label">${config.label}</span>`;
          const submenu = document.createElement("div");
          submenu.className = "editable-toolbar-submenu";
          submenu.setAttribute("role", "menu");
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
              submenu.classList.remove("open");
              btn.setAttribute("aria-expanded", "false");
            });
            submenu.appendChild(item);
          });
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = submenu.classList.toggle("open");
            btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
          });
          document.addEventListener("click", (e) => {
            if (!wrapper.contains(e.target)) {
              submenu.classList.remove("open");
              btn.setAttribute("aria-expanded", "false");
            }
          });
          wrapper.appendChild(btn);
          wrapper.appendChild(submenu);
          return wrapper;
        }
      };
    }
  });

  // src/arrows.js
  var arrows_exports = {};
  __export(arrows_exports, {
    ARROW_HEAD_STYLES: () => ARROW_HEAD_STYLES,
    addNewArrow: () => addNewArrow,
    addWaypoint: () => addWaypoint,
    cleanupArrowListeners: () => cleanupArrowListeners,
    createArrowElement: () => createArrowElement,
    createArrowStyleControls: () => createArrowStyleControls,
    getActiveArrow: () => getActiveArrow,
    hasArrowExtension: () => hasArrowExtension,
    removeWaypoint: () => removeWaypoint,
    setActiveArrow: () => setActiveArrow,
    showArrowExtensionWarning: () => showArrowExtensionWarning,
    toggleCurveMode: () => toggleCurveMode,
    updateArrowActiveState: () => updateArrowActiveState,
    updateArrowAppearance: () => updateArrowAppearance,
    updateArrowHandles: () => updateArrowHandles,
    updateArrowLabel: () => updateArrowLabel,
    updateArrowPath: () => updateArrowPath,
    updateArrowStylePanel: () => updateArrowStylePanel
  });
  function hasArrowExtension() {
    if (window._quarto_arrow_extension)
      return true;
    const arrowSvgs = document.querySelectorAll('svg defs marker[id^="arrow-"]');
    if (arrowSvgs.length > 0)
      return true;
    const arrowPaths = document.querySelectorAll('svg path[marker-end^="url(#arrow-"]');
    if (arrowPaths.length > 0)
      return true;
    return false;
  }
  function showArrowExtensionModal() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "editable-modal-overlay";
      overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
    `;
      const modal = document.createElement("div");
      modal.className = "editable-modal";
      modal.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 450px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      font-family: system-ui, -apple-system, sans-serif;
    `;
      modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">Arrow Extension Required</h3>
      <p style="margin: 0 0 12px 0; color: #555; line-height: 1.5;">
        Arrows are saved as <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">{{&lt; arrow &gt;}}</code> shortcodes which require the <a href="https://github.com/EmilHvitfeldt/quarto-arrows" target="_blank" style="color: var(--editable-accent-color, #007cba);">quarto-arrows</a> extension to render.
      </p>
      <p style="margin: 0 0 16px 0; color: #555;">
        Install with:<br>
        <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 3px; display: inline-block; margin-top: 4px;">quarto add EmilHvitfeldt/quarto-arrows</code>
      </p>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
        Continue? (Arrows will work in the editor but won't render until the extension is installed)
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="editable-modal-cancel" style="
          padding: 8px 16px;
          border: 1px solid #ccc;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Cancel</button>
        <button class="editable-modal-confirm" style="
          padding: 8px 16px;
          border: none;
          background: var(--editable-accent-color, #007cba);
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Continue</button>
      </div>
    `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };
      modal.querySelector(".editable-modal-cancel").onclick = () => cleanup(false);
      modal.querySelector(".editable-modal-confirm").onclick = () => cleanup(true);
      overlay.onclick = (e) => {
        if (e.target === overlay)
          cleanup(false);
      };
      modal.querySelector(".editable-modal-confirm").focus();
    });
  }
  async function showArrowExtensionWarning() {
    if (arrowExtensionWarningShown)
      return true;
    const detected = hasArrowExtension();
    if (detected) {
      arrowExtensionWarningShown = true;
      return true;
    }
    const confirmed = await showArrowExtensionModal();
    if (confirmed) {
      arrowExtensionWarningShown = true;
    }
    return confirmed;
  }
  function setActiveArrow(arrowData) {
    if (activeArrow && activeArrow !== arrowData) {
      activeArrow.isActive = false;
      updateArrowActiveState(activeArrow);
    }
    activeArrow = arrowData;
    if (arrowData) {
      arrowData.isActive = true;
      updateArrowActiveState(arrowData);
    }
    updateArrowStylePanel(arrowData);
  }
  function getActiveArrow() {
    return activeArrow;
  }
  function cleanupArrowListeners(arrowData) {
    if (arrowData._dragController) {
      arrowData._dragController.abort();
      arrowData._dragController = null;
    }
    const handles = [
      arrowData._startHandle,
      arrowData._endHandle,
      arrowData._control1Handle,
      arrowData._control2Handle
    ];
    for (const handle of handles) {
      if (handle && handle._dragController) {
        handle._dragController.abort();
        handle._dragController = null;
      }
    }
    if (arrowData._waypointHandles) {
      for (const handle of arrowData._waypointHandles) {
        if (handle && handle._dragController) {
          handle._dragController.abort();
          handle._dragController = null;
        }
      }
    }
  }
  function createArrowStyleControls() {
    const container = document.createElement("div");
    container.className = "arrow-style-controls";
    container.style.display = "none";
    const colorPresetsRow = document.createElement("div");
    colorPresetsRow.className = "arrow-color-presets";
    const defaultColors = ["#000000"];
    const paletteColors = getColorPalette();
    const allColors = [...defaultColors, ...paletteColors.filter((c) => c.toLowerCase() !== "#000000")];
    allColors.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.className = "arrow-color-swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.addEventListener("click", () => {
        if (activeArrow) {
          pushUndoState();
          activeArrow.color = color;
          updateArrowAppearance(activeArrow);
          const picker = container.querySelector("#arrow-style-color");
          if (picker)
            picker.value = color;
          colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach((s) => s.classList.remove("selected"));
          swatch.classList.add("selected");
        }
      });
      colorPresetsRow.appendChild(swatch);
    });
    container.appendChild(colorPresetsRow);
    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.id = "arrow-style-color";
    colorPicker.className = "arrow-toolbar-color";
    colorPicker.value = "#000000";
    colorPicker.title = "Custom color";
    colorPicker.addEventListener("focus", () => {
      if (activeArrow)
        pushUndoState();
    });
    colorPicker.addEventListener("input", (e) => {
      if (activeArrow) {
        activeArrow.color = e.target.value;
        updateArrowAppearance(activeArrow);
        colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach((s) => s.classList.remove("selected"));
      }
    });
    container.appendChild(colorPicker);
    const widthInput = document.createElement("input");
    widthInput.type = "number";
    widthInput.id = "arrow-style-width";
    widthInput.className = "arrow-toolbar-width";
    widthInput.min = "1";
    widthInput.max = "20";
    widthInput.value = "2";
    widthInput.title = "Width";
    widthInput.addEventListener("focus", () => {
      if (activeArrow)
        pushUndoState();
    });
    widthInput.addEventListener("input", (e) => {
      if (activeArrow) {
        const val = parseInt(e.target.value);
        if (!isNaN(val)) {
          activeArrow.width = Math.max(1, Math.min(20, val));
          updateArrowAppearance(activeArrow);
        }
      }
    });
    container.appendChild(widthInput);
    const headSelect = document.createElement("select");
    headSelect.id = "arrow-style-head";
    headSelect.className = "arrow-toolbar-select";
    headSelect.title = "Head style";
    ARROW_HEAD_STYLES.forEach((style) => {
      const opt = document.createElement("option");
      opt.value = style;
      opt.textContent = style.charAt(0).toUpperCase() + style.slice(1);
      headSelect.appendChild(opt);
    });
    headSelect.addEventListener("change", (e) => {
      if (activeArrow) {
        pushUndoState();
        activeArrow.head = e.target.value;
        updateArrowAppearance(activeArrow);
      }
    });
    container.appendChild(headSelect);
    const dashSelect = document.createElement("select");
    dashSelect.id = "arrow-style-dash";
    dashSelect.className = "arrow-toolbar-select";
    dashSelect.title = "Dash style";
    ["solid", "dashed", "dotted"].forEach((style) => {
      const opt = document.createElement("option");
      opt.value = style;
      opt.textContent = style.charAt(0).toUpperCase() + style.slice(1);
      dashSelect.appendChild(opt);
    });
    dashSelect.addEventListener("change", (e) => {
      if (activeArrow) {
        pushUndoState();
        activeArrow.dash = e.target.value;
        updateArrowAppearance(activeArrow);
      }
    });
    container.appendChild(dashSelect);
    const lineSelect = document.createElement("select");
    lineSelect.id = "arrow-style-line";
    lineSelect.className = "arrow-toolbar-select";
    lineSelect.title = "Line style";
    ["single", "double", "triple"].forEach((style) => {
      const opt = document.createElement("option");
      opt.value = style;
      opt.textContent = style.charAt(0).toUpperCase() + style.slice(1);
      lineSelect.appendChild(opt);
    });
    lineSelect.addEventListener("change", (e) => {
      if (activeArrow) {
        pushUndoState();
        activeArrow.line = e.target.value;
        updateArrowAppearance(activeArrow);
      }
    });
    container.appendChild(lineSelect);
    const opacityInput = document.createElement("input");
    opacityInput.type = "range";
    opacityInput.id = "arrow-style-opacity";
    opacityInput.className = "arrow-toolbar-opacity";
    opacityInput.min = "0";
    opacityInput.max = "1";
    opacityInput.step = "0.1";
    opacityInput.value = "1";
    opacityInput.title = "Opacity";
    opacityInput.addEventListener("mousedown", () => {
      if (activeArrow)
        pushUndoState();
    });
    opacityInput.addEventListener("input", (e) => {
      if (activeArrow) {
        activeArrow.opacity = parseFloat(e.target.value);
        updateArrowAppearance(activeArrow);
      }
    });
    container.appendChild(opacityInput);
    const curveToggle = document.createElement("button");
    curveToggle.id = "arrow-style-curve";
    curveToggle.className = "arrow-toolbar-curve";
    curveToggle.innerHTML = "\u2934 Curve";
    curveToggle.title = "Toggle curve mode";
    curveToggle.addEventListener("click", () => {
      if (activeArrow) {
        pushUndoState();
        if (activeArrow.waypoints && activeArrow.waypoints.length > 0) {
          activeArrow.waypoints = [];
          activeArrow.smooth = false;
          rebuildWaypointHandles(activeArrow);
          updateSmoothToggleInToolbar(activeArrow);
        }
        toggleCurveMode(activeArrow);
        updateCurveToggleInToolbar(activeArrow);
      }
    });
    container.appendChild(curveToggle);
    const smoothToggle = document.createElement("button");
    smoothToggle.id = "arrow-style-smooth";
    smoothToggle.className = "arrow-toolbar-smooth";
    smoothToggle.innerHTML = "\u3030 Smooth";
    smoothToggle.title = "Toggle smooth curves through waypoints";
    smoothToggle.style.display = "none";
    smoothToggle.addEventListener("click", () => {
      if (activeArrow && activeArrow.waypoints && activeArrow.waypoints.length > 0) {
        pushUndoState();
        activeArrow.smooth = !activeArrow.smooth;
        updateArrowPath(activeArrow);
        updateSmoothToggleInToolbar(activeArrow);
      }
    });
    container.appendChild(smoothToggle);
    const waypointBadge = document.createElement("span");
    waypointBadge.id = "arrow-style-waypoint-count";
    waypointBadge.className = "arrow-toolbar-waypoint-badge";
    waypointBadge.style.display = "none";
    waypointBadge.title = "Number of waypoints (double-click arrow to add, right-click waypoint to remove)";
    container.appendChild(waypointBadge);
    const labelSeparator = document.createElement("div");
    labelSeparator.className = "arrow-toolbar-separator";
    labelSeparator.textContent = "Label";
    container.appendChild(labelSeparator);
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.id = "arrow-style-label";
    labelInput.className = "arrow-toolbar-label";
    labelInput.placeholder = "Label text...";
    labelInput.title = "Label text";
    labelInput.addEventListener("input", (e) => {
      if (activeArrow) {
        activeArrow.label = e.target.value;
        updateArrowLabel(activeArrow);
      }
    });
    container.appendChild(labelInput);
    const labelPositionSelect = document.createElement("select");
    labelPositionSelect.id = "arrow-style-label-position";
    labelPositionSelect.className = "arrow-toolbar-select";
    labelPositionSelect.title = "Label position";
    ["start", "middle", "end"].forEach((pos) => {
      const opt = document.createElement("option");
      opt.value = pos;
      opt.textContent = pos.charAt(0).toUpperCase() + pos.slice(1);
      labelPositionSelect.appendChild(opt);
    });
    labelPositionSelect.value = CONFIG.ARROW_DEFAULT_LABEL_POSITION;
    labelPositionSelect.addEventListener("change", (e) => {
      if (activeArrow) {
        activeArrow.labelPosition = e.target.value;
        updateArrowLabel(activeArrow);
      }
    });
    container.appendChild(labelPositionSelect);
    const labelOffsetInput = document.createElement("input");
    labelOffsetInput.type = "number";
    labelOffsetInput.id = "arrow-style-label-offset";
    labelOffsetInput.className = "arrow-toolbar-width";
    labelOffsetInput.value = CONFIG.ARROW_DEFAULT_LABEL_OFFSET.toString();
    labelOffsetInput.title = "Label offset (positive = above, negative = below)";
    labelOffsetInput.addEventListener("input", (e) => {
      if (activeArrow) {
        const val = parseInt(e.target.value);
        if (!isNaN(val)) {
          activeArrow.labelOffset = val;
          updateArrowLabel(activeArrow);
        }
      }
    });
    container.appendChild(labelOffsetInput);
    arrowControlRefs.colorPicker = colorPicker;
    arrowControlRefs.widthInput = widthInput;
    arrowControlRefs.headSelect = headSelect;
    arrowControlRefs.dashSelect = dashSelect;
    arrowControlRefs.lineSelect = lineSelect;
    arrowControlRefs.opacityInput = opacityInput;
    arrowControlRefs.colorPresetsRow = colorPresetsRow;
    arrowControlRefs.labelInput = labelInput;
    arrowControlRefs.labelPositionSelect = labelPositionSelect;
    arrowControlRefs.labelOffsetInput = labelOffsetInput;
    arrowControlRefs.smoothToggle = smoothToggle;
    arrowControlRefs.waypointBadge = waypointBadge;
    arrowControlRefs.curveToggle = curveToggle;
    return container;
  }
  function updateArrowStylePanel(arrowData) {
    const toolbar = document.getElementById("editable-toolbar");
    if (!toolbar)
      return;
    const buttonsContainer = toolbar.querySelector(".editable-toolbar-buttons");
    let arrowControls = toolbar.querySelector(".arrow-style-controls");
    if (!arrowControls) {
      arrowControls = createArrowStyleControls();
      toolbar.appendChild(arrowControls);
    }
    if (arrowData) {
      const { colorPicker, widthInput, headSelect, dashSelect, lineSelect, opacityInput, colorPresetsRow, labelInput, labelPositionSelect, labelOffsetInput } = arrowControlRefs;
      if (colorPicker) {
        const colorValue = arrowData.color === "black" ? "#000000" : arrowData.color;
        colorPicker.value = colorValue;
        if (colorPresetsRow) {
          colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach((s) => {
            s.classList.toggle("selected", s.style.backgroundColor === colorValue || rgbToHex(s.style.backgroundColor) === colorValue.toLowerCase());
          });
        }
      }
      if (widthInput) {
        widthInput.value = arrowData.width.toString();
      }
      if (headSelect) {
        headSelect.value = arrowData.head || "arrow";
      }
      if (dashSelect) {
        dashSelect.value = arrowData.dash || "solid";
      }
      if (lineSelect) {
        lineSelect.value = arrowData.line || "single";
      }
      if (opacityInput) {
        opacityInput.value = (arrowData.opacity !== void 0 ? arrowData.opacity : 1).toString();
      }
      if (labelInput) {
        labelInput.value = arrowData.label || "";
      }
      if (labelPositionSelect) {
        labelPositionSelect.value = arrowData.labelPosition || CONFIG.ARROW_DEFAULT_LABEL_POSITION;
      }
      if (labelOffsetInput) {
        labelOffsetInput.value = (arrowData.labelOffset !== void 0 ? arrowData.labelOffset : CONFIG.ARROW_DEFAULT_LABEL_OFFSET).toString();
      }
      updateCurveToggleInToolbar(arrowData);
      updateSmoothToggleInToolbar(arrowData);
      buttonsContainer.style.display = "none";
      arrowControls.style.display = "flex";
    } else {
      buttonsContainer.style.display = "flex";
      arrowControls.style.display = "none";
    }
  }
  function updateCurveToggleInToolbar(arrowData) {
    const curveToggle = document.querySelector("#arrow-style-curve");
    if (!curveToggle)
      return;
    const hasWaypoints = arrowData && arrowData.waypoints && arrowData.waypoints.length > 0;
    if (hasWaypoints) {
      curveToggle.classList.remove("disabled");
      curveToggle.classList.remove("active");
      curveToggle.title = "Switch to curve mode (clears waypoints)";
    } else {
      curveToggle.classList.remove("disabled");
      curveToggle.title = "Toggle curve mode";
      if (arrowData && arrowData.curveMode) {
        curveToggle.classList.add("active");
      } else {
        curveToggle.classList.remove("active");
      }
    }
  }
  function updateSmoothToggleInToolbar(arrowData) {
    const smoothToggle = arrowControlRefs.smoothToggle || document.querySelector("#arrow-style-smooth");
    const waypointBadge = arrowControlRefs.waypointBadge || document.querySelector("#arrow-style-waypoint-count");
    if (!smoothToggle || !waypointBadge)
      return;
    const hasWaypoints = arrowData && arrowData.waypoints && arrowData.waypoints.length > 0;
    if (hasWaypoints) {
      smoothToggle.style.display = "";
      waypointBadge.style.display = "";
      waypointBadge.textContent = `${arrowData.waypoints.length} wp`;
      if (arrowData.smooth) {
        smoothToggle.classList.add("active");
      } else {
        smoothToggle.classList.remove("active");
      }
    } else {
      smoothToggle.style.display = "none";
      waypointBadge.style.display = "none";
    }
  }
  function updateArrowAppearance(arrowData) {
    if (!arrowData._path)
      return;
    arrowData._path.setAttribute("stroke", arrowData.color);
    arrowData._path.setAttribute("stroke-width", arrowData.width);
    if (arrowData._labelText) {
      arrowData._labelText.setAttribute("fill", arrowData.color);
    }
    const dashPatterns = {
      solid: "none",
      dashed: `${arrowData.width * 4},${arrowData.width * 2}`,
      dotted: `${arrowData.width},${arrowData.width * 2}`
    };
    const dashArray = dashPatterns[arrowData.dash] || "none";
    if (dashArray === "none") {
      arrowData._path.removeAttribute("stroke-dasharray");
    } else {
      arrowData._path.setAttribute("stroke-dasharray", dashArray);
    }
    const opacity = arrowData.opacity !== void 0 ? arrowData.opacity : 1;
    arrowData._path.setAttribute("opacity", opacity);
    updateArrowLineStyle(arrowData);
    updateArrowheadMarker(arrowData);
  }
  function offsetPointPerpendicular(x, y, tangentX, tangentY, offsetAmount) {
    const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    if (len === 0)
      return { x, y };
    const normalX = -tangentY / len;
    const normalY = tangentX / len;
    return {
      x: x + normalX * offsetAmount,
      y: y + normalY * offsetAmount
    };
  }
  function createOffsetPathD(arrowData, offsetAmount) {
    const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y } = arrowData;
    if (control1X !== null && control2X !== null) {
      const startTangent = { x: control1X - fromX, y: control1Y - fromY };
      const endTangent = { x: toX - control2X, y: toY - control2Y };
      const c1Tangent = { x: control2X - fromX, y: control2Y - fromY };
      const c2Tangent = { x: toX - control1X, y: toY - control1Y };
      const newFrom = offsetPointPerpendicular(fromX, fromY, startTangent.x, startTangent.y, offsetAmount);
      const newC1 = offsetPointPerpendicular(control1X, control1Y, c1Tangent.x, c1Tangent.y, offsetAmount);
      const newC2 = offsetPointPerpendicular(control2X, control2Y, c2Tangent.x, c2Tangent.y, offsetAmount);
      const newTo = offsetPointPerpendicular(toX, toY, endTangent.x, endTangent.y, offsetAmount);
      return `M ${newFrom.x},${newFrom.y} C ${newC1.x},${newC1.y} ${newC2.x},${newC2.y} ${newTo.x},${newTo.y}`;
    } else if (control1X !== null) {
      const startTangent = { x: control1X - fromX, y: control1Y - fromY };
      const controlTangent = { x: toX - fromX, y: toY - fromY };
      const endTangent = { x: toX - control1X, y: toY - control1Y };
      const newFrom = offsetPointPerpendicular(fromX, fromY, startTangent.x, startTangent.y, offsetAmount);
      const newC1 = offsetPointPerpendicular(control1X, control1Y, controlTangent.x, controlTangent.y, offsetAmount);
      const newTo = offsetPointPerpendicular(toX, toY, endTangent.x, endTangent.y, offsetAmount);
      return `M ${newFrom.x},${newFrom.y} Q ${newC1.x},${newC1.y} ${newTo.x},${newTo.y}`;
    } else {
      const tangent = { x: toX - fromX, y: toY - fromY };
      const newFrom = offsetPointPerpendicular(fromX, fromY, tangent.x, tangent.y, offsetAmount);
      const newTo = offsetPointPerpendicular(toX, toY, tangent.x, tangent.y, offsetAmount);
      return `M ${newFrom.x},${newFrom.y} L ${newTo.x},${newTo.y}`;
    }
  }
  function updateArrowLineStyle(arrowData) {
    if (!arrowData._svg || !arrowData._path)
      return;
    const existingLines = arrowData._svg.querySelectorAll(".arrow-extra-line");
    existingLines.forEach((line) => line.remove());
    const lineStyle = arrowData.line || "single";
    if (lineStyle === "single") {
      arrowData._path.setAttribute("stroke", arrowData.color);
      arrowData._path.style.visibility = "visible";
      return;
    }
    const offset = arrowData.width * 1.5;
    const createOffsetPath = (offsetAmount) => {
      const extraPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      extraPath.className.baseVal = "arrow-extra-line";
      extraPath.setAttribute("stroke", arrowData.color);
      extraPath.setAttribute("stroke-width", arrowData.width);
      extraPath.setAttribute("fill", "none");
      extraPath.style.pointerEvents = "none";
      const dashPatterns = {
        solid: "none",
        dashed: `${arrowData.width * 4},${arrowData.width * 2}`,
        dotted: `${arrowData.width},${arrowData.width * 2}`
      };
      const dashArray = dashPatterns[arrowData.dash] || "none";
      if (dashArray !== "none") {
        extraPath.setAttribute("stroke-dasharray", dashArray);
      }
      const opacity = arrowData.opacity !== void 0 ? arrowData.opacity : 1;
      extraPath.setAttribute("opacity", opacity);
      const offsetPathD = createOffsetPathD(arrowData, offsetAmount);
      extraPath.setAttribute("d", offsetPathD);
      return extraPath;
    };
    if (lineStyle === "double") {
      const line1 = createOffsetPath(-offset);
      const line2 = createOffsetPath(offset);
      arrowData._svg.insertBefore(line1, arrowData._path);
      arrowData._svg.insertBefore(line2, arrowData._path);
      arrowData._path.style.visibility = "visible";
      arrowData._path.setAttribute("stroke", "transparent");
    } else if (lineStyle === "triple") {
      const line1 = createOffsetPath(-offset);
      const line2 = createOffsetPath(offset);
      arrowData._svg.insertBefore(line1, arrowData._path);
      arrowData._svg.insertBefore(line2, arrowData._path);
      arrowData._path.style.visibility = "visible";
      arrowData._path.setAttribute("stroke", arrowData.color);
    }
  }
  function updateArrowheadMarker(arrowData) {
    if (!arrowData._svg || !arrowData._markerId)
      return;
    const marker = arrowData._svg.querySelector(`#${arrowData._markerId}`);
    if (!marker)
      return;
    const markerPath = marker.querySelector("path");
    if (!markerPath)
      return;
    markerPath.setAttribute("fill", arrowData.color);
    const size = 10;
    let pathD;
    let refX = 0;
    switch (arrowData.head) {
      case "stealth":
        const w = size * 1.2;
        pathD = `M 0 0 L ${w} ${size / 2} L 0 ${size} L ${w * 0.3} ${size / 2} z`;
        refX = w * 0.3;
        break;
      case "diamond":
        pathD = `M 0 ${size / 2} L ${size / 2} 0 L ${size} ${size / 2} L ${size / 2} ${size} z`;
        refX = size / 2;
        break;
      case "circle":
        const r = size / 2;
        pathD = `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${size} A ${r} ${r} 0 1 1 ${r} 0`;
        refX = r;
        marker.setAttribute("refY", r);
        break;
      case "square":
        pathD = `M 0 0 L ${size} 0 L ${size} ${size} L 0 ${size} z`;
        refX = size / 2;
        break;
      case "bar":
        const bw = size / 3;
        pathD = `M 0 0 L ${bw} 0 L ${bw} ${size} L 0 ${size} z`;
        refX = bw / 2;
        break;
      case "none":
        pathD = "";
        break;
      default:
        pathD = `M 0 0 L ${size} ${size / 2} L 0 ${size} z`;
        refX = 0;
        marker.setAttribute("refY", size / 2);
    }
    markerPath.setAttribute("d", pathD);
    marker.setAttribute("refX", refX);
    if (arrowData.head === "none") {
      arrowData._path.removeAttribute("marker-end");
    } else {
      arrowData._path.setAttribute("marker-end", `url(#${arrowData._markerId})`);
    }
  }
  function updateArrowActiveState(arrowData) {
    if (!arrowData._container)
      return;
    const showControls = arrowData.isActive;
    if (arrowData._startHandle) {
      arrowData._startHandle.style.display = showControls ? "" : "none";
    }
    if (arrowData._endHandle) {
      arrowData._endHandle.style.display = showControls ? "" : "none";
    }
    if (arrowData._control1Handle) {
      arrowData._control1Handle.style.display = showControls && arrowData.curveMode ? "" : "none";
    }
    if (arrowData._control2Handle) {
      arrowData._control2Handle.style.display = showControls && arrowData.curveMode ? "" : "none";
    }
    if (arrowData._guideLine1) {
      arrowData._guideLine1.style.display = showControls && arrowData.curveMode && arrowData.control1X !== null ? "" : "none";
    }
    if (arrowData._guideLine2) {
      arrowData._guideLine2.style.display = showControls && arrowData.curveMode && arrowData.control2X !== null ? "" : "none";
    }
    if (showControls) {
      arrowData._container.classList.add("active");
    } else {
      arrowData._container.classList.remove("active");
    }
  }
  async function addNewArrow() {
    if (!await showArrowExtensionWarning()) {
      return null;
    }
    const currentSlide = getCurrentSlide();
    if (!currentSlide) {
      console.warn("No current slide found");
      return null;
    }
    pushUndoState();
    const slideIndex = getCurrentSlideIndex();
    const slideWidth = currentSlide.offsetWidth || 960;
    const slideHeight = currentSlide.offsetHeight || 700;
    const centerX = slideWidth / 2;
    const centerY = slideHeight / 2;
    const halfLength = CONFIG.NEW_ARROW_LENGTH / 2;
    const arrowData = {
      fromX: centerX - halfLength,
      fromY: centerY,
      toX: centerX + halfLength,
      toY: centerY,
      control1X: null,
      control1Y: null,
      control2X: null,
      control2Y: null,
      curveMode: false,
      waypoints: [],
      smooth: false,
      color: CONFIG.ARROW_DEFAULT_COLOR,
      width: CONFIG.ARROW_DEFAULT_WIDTH,
      head: "arrow",
      dash: "solid",
      line: "single",
      opacity: 1,
      label: "",
      labelPosition: CONFIG.ARROW_DEFAULT_LABEL_POSITION,
      labelOffset: CONFIG.ARROW_DEFAULT_LABEL_OFFSET,
      isActive: true
    };
    const arrowContainer = createArrowElement(arrowData);
    currentSlide.appendChild(arrowContainer);
    arrowData.element = arrowContainer;
    const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");
    if (isOnNewSlide) {
      const newSlideEntry = NewElementRegistry.newSlides.find(
        (s) => s.element === currentSlide
      );
      NewElementRegistry.addArrow(arrowData, slideIndex, newSlideEntry || null);
    } else {
      const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);
      const originalSlideIndex = qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
      NewElementRegistry.addArrow(arrowData, originalSlideIndex, null);
    }
    debug("Added new arrow to slide", slideIndex, "-> QMD heading index", getQmdHeadingIndex(slideIndex));
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
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.overflow = "visible";
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    const markerId = "arrowhead-" + Math.random().toString(36).substring(2, 11);
    marker.setAttribute("id", markerId);
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "10");
    marker.setAttribute("refX", "0");
    marker.setAttribute("refY", "5");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");
    const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    arrowPath.setAttribute("fill", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);
    const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitArea.setAttribute("stroke", "transparent");
    hitArea.setAttribute("stroke-width", "20");
    hitArea.setAttribute("stroke-linecap", "round");
    hitArea.setAttribute("fill", "none");
    hitArea.style.pointerEvents = "auto";
    hitArea.style.cursor = "pointer";
    svg.appendChild(hitArea);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
    path.setAttribute("stroke-width", arrowData.width || CONFIG.ARROW_DEFAULT_WIDTH);
    path.setAttribute("fill", "none");
    path.setAttribute("marker-end", `url(#${markerId})`);
    path.style.pointerEvents = "none";
    svg.appendChild(path);
    const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    labelText.className.baseVal = "editable-arrow-label";
    labelText.setAttribute("text-anchor", "middle");
    labelText.setAttribute("dominant-baseline", "middle");
    labelText.setAttribute("fill", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
    labelText.style.pointerEvents = "none";
    labelText.style.userSelect = "none";
    labelText.style.fontSize = "14px";
    labelText.style.fontFamily = "system-ui, -apple-system, sans-serif";
    svg.appendChild(labelText);
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
    arrowData._path = path;
    arrowData._hitArea = hitArea;
    arrowData._svg = svg;
    arrowData._markerId = markerId;
    arrowData._guideLine1 = guideLine1;
    arrowData._guideLine2 = guideLine2;
    arrowData._labelText = labelText;
    arrowData._container = container;
    const startHandle = createArrowHandle(arrowData, "start");
    const endHandle = createArrowHandle(arrowData, "end");
    container.appendChild(startHandle);
    container.appendChild(endHandle);
    arrowData._startHandle = startHandle;
    arrowData._endHandle = endHandle;
    const control1Handle = createArrowHandle(arrowData, "control1");
    const control2Handle = createArrowHandle(arrowData, "control2");
    control1Handle.style.display = "none";
    control2Handle.style.display = "none";
    container.appendChild(control1Handle);
    container.appendChild(control2Handle);
    arrowData._control1Handle = control1Handle;
    arrowData._control2Handle = control2Handle;
    arrowData._waypointHandles = [];
    if (arrowData.waypoints && arrowData.waypoints.length > 0) {
      for (let i = 0; i < arrowData.waypoints.length; i++) {
        const handle = createWaypointHandle(arrowData, i);
        container.appendChild(handle);
        arrowData._waypointHandles.push(handle);
      }
    }
    const arrowDragController = new AbortController();
    arrowData._dragController = arrowDragController;
    let isDraggingArrow = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let arrowDragScale = 1;
    const startArrowDrag = (e) => {
      e.stopPropagation();
      setActiveArrow(arrowData);
      pushUndoState();
      isDraggingArrow = true;
      arrowDragScale = getSlideScale();
      const clientX = e.clientX || e.touches && e.touches[0].clientX;
      const clientY = e.clientY || e.touches && e.touches[0].clientY;
      dragStartX = clientX;
      dragStartY = clientY;
      hitArea.style.cursor = "grabbing";
    };
    const onArrowDrag = (e) => {
      if (!isDraggingArrow)
        return;
      e.preventDefault();
      const clientX = e.clientX || e.touches && e.touches[0].clientX;
      const clientY = e.clientY || e.touches && e.touches[0].clientY;
      const deltaX = (clientX - dragStartX) / arrowDragScale;
      const deltaY = (clientY - dragStartY) / arrowDragScale;
      arrowData.fromX += deltaX;
      arrowData.fromY += deltaY;
      arrowData.toX += deltaX;
      arrowData.toY += deltaY;
      if (arrowData.control1X !== null) {
        arrowData.control1X += deltaX;
        arrowData.control1Y += deltaY;
      }
      if (arrowData.control2X !== null) {
        arrowData.control2X += deltaX;
        arrowData.control2Y += deltaY;
      }
      if (arrowData.waypoints && arrowData.waypoints.length > 0) {
        for (const wp of arrowData.waypoints) {
          wp.x += deltaX;
          wp.y += deltaY;
        }
      }
      dragStartX = clientX;
      dragStartY = clientY;
      updateArrowPath(arrowData);
      updateArrowHandles(arrowData);
    };
    const endArrowDrag = () => {
      isDraggingArrow = false;
      hitArea.style.cursor = "grab";
    };
    hitArea.addEventListener("mousedown", startArrowDrag);
    document.addEventListener("mousemove", onArrowDrag, { signal: arrowDragController.signal });
    document.addEventListener("mouseup", endArrowDrag, { signal: arrowDragController.signal });
    hitArea.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      const scale = getSlideScale();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      const insertIndex = findWaypointInsertIndex(arrowData, x, y);
      addWaypoint(arrowData, x, y, insertIndex);
    });
    hitArea.style.cursor = "grab";
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    updateArrowLabel(arrowData);
    setActiveArrow(arrowData);
    if (!globalClickOutsideHandlerRegistered) {
      globalClickOutsideHandlerRegistered = true;
      document.addEventListener("click", (e) => {
        if (activeArrow && !e.target.closest(".editable-arrow-container") && !e.target.closest(".editable-toolbar")) {
          setActiveArrow(null);
        }
      });
    }
    return container;
  }
  function createArrowHandle(arrowData, position) {
    const handle = document.createElement("div");
    handle.className = `editable-arrow-handle editable-arrow-handle-${position}`;
    handle.style.position = "absolute";
    const isControlPoint = position === "control1" || position === "control2";
    const handleSize = isControlPoint ? CONFIG.ARROW_CONTROL_HANDLE_SIZE : CONFIG.ARROW_HANDLE_SIZE;
    let bgColor;
    if (position === "start")
      bgColor = "#007cba";
    else if (position === "end")
      bgColor = "#28a745";
    else if (position === "control1")
      bgColor = CONFIG.ARROW_CONTROL1_COLOR;
    else if (position === "control2")
      bgColor = CONFIG.ARROW_CONTROL2_COLOR;
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
    const handleDragController = new AbortController();
    handle._dragController = handleDragController;
    let isDragging = false;
    let cachedScale = 1;
    const startDrag = (e) => {
      pushUndoState();
      isDragging = true;
      cachedScale = getSlideScale();
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrag = (e) => {
      if (!isDragging)
        return;
      if (!arrowData.element)
        return;
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
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;
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
      updateArrowPath(arrowData);
      updateArrowHandles(arrowData);
      e.preventDefault();
    };
    const stopDrag = () => {
      isDragging = false;
    };
    handle.addEventListener("mousedown", startDrag);
    handle.addEventListener("touchstart", startDrag);
    document.addEventListener("mousemove", onDrag, { signal: handleDragController.signal });
    document.addEventListener("touchmove", onDrag, { signal: handleDragController.signal });
    document.addEventListener("mouseup", stopDrag, { signal: handleDragController.signal });
    document.addEventListener("touchend", stopDrag, { signal: handleDragController.signal });
    return handle;
  }
  function createWaypointHandle(arrowData, waypointIndex) {
    const handle = document.createElement("div");
    handle.className = "editable-arrow-handle editable-arrow-handle-waypoint";
    handle.style.position = "absolute";
    handle.dataset.waypointIndex = waypointIndex;
    const handleSize = CONFIG.ARROW_WAYPOINT_HANDLE_SIZE;
    const bgColor = CONFIG.ARROW_WAYPOINT_COLOR;
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
    handle.setAttribute("aria-label", `Arrow waypoint ${waypointIndex + 1}`);
    handle.setAttribute("tabindex", "0");
    const handleDragController = new AbortController();
    handle._dragController = handleDragController;
    let isDragging = false;
    let cachedScale = 1;
    const startDrag = (e) => {
      pushUndoState();
      isDragging = true;
      cachedScale = getSlideScale();
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrag = (e) => {
      if (!isDragging)
        return;
      if (!arrowData.element)
        return;
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
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;
      const wpIndex = parseInt(handle.dataset.waypointIndex, 10);
      if (arrowData.waypoints[wpIndex]) {
        arrowData.waypoints[wpIndex].x = x;
        arrowData.waypoints[wpIndex].y = y;
      }
      updateArrowPath(arrowData);
      updateArrowHandles(arrowData);
      e.preventDefault();
    };
    const stopDrag = () => {
      isDragging = false;
    };
    handle.addEventListener("mousedown", startDrag);
    handle.addEventListener("touchstart", startDrag);
    document.addEventListener("mousemove", onDrag, { signal: handleDragController.signal });
    document.addEventListener("touchmove", onDrag, { signal: handleDragController.signal });
    document.addEventListener("mouseup", stopDrag, { signal: handleDragController.signal });
    document.addEventListener("touchend", stopDrag, { signal: handleDragController.signal });
    handle.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wpIndex = parseInt(handle.dataset.waypointIndex, 10);
      removeWaypoint(arrowData, wpIndex);
    });
    handle.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const wpIndex = parseInt(handle.dataset.waypointIndex, 10);
        removeWaypoint(arrowData, wpIndex);
      }
    });
    return handle;
  }
  function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }
  function findWaypointInsertIndex(arrowData, clickX, clickY) {
    const { fromX, fromY, toX, toY, waypoints } = arrowData;
    const points = [
      { x: fromX, y: fromY },
      ...waypoints || [],
      { x: toX, y: toY }
    ];
    if (!waypoints || waypoints.length === 0) {
      return 0;
    }
    let minDist = Infinity;
    let bestIndex = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dist = distanceToSegment(
        clickX,
        clickY,
        points[i].x,
        points[i].y,
        points[i + 1].x,
        points[i + 1].y
      );
      if (dist < minDist) {
        minDist = dist;
        bestIndex = i;
      }
    }
    return bestIndex;
  }
  function addWaypoint(arrowData, x, y, insertIndex) {
    pushUndoState();
    if (arrowData.curveMode) {
      arrowData.curveMode = false;
      arrowData.control1X = null;
      arrowData.control1Y = null;
      arrowData.control2X = null;
      arrowData.control2Y = null;
      if (arrowData._container) {
        arrowData._container.classList.remove("curve-mode");
      }
      if (arrowData._guideLine1)
        arrowData._guideLine1.style.display = "none";
      if (arrowData._guideLine2)
        arrowData._guideLine2.style.display = "none";
      if (arrowData._control1Handle)
        arrowData._control1Handle.style.display = "none";
      if (arrowData._control2Handle)
        arrowData._control2Handle.style.display = "none";
    }
    if (!arrowData.waypoints) {
      arrowData.waypoints = [];
    }
    const newWaypoint = { x, y };
    if (insertIndex !== void 0 && insertIndex >= 0 && insertIndex <= arrowData.waypoints.length) {
      arrowData.waypoints.splice(insertIndex, 0, newWaypoint);
    } else {
      arrowData.waypoints.push(newWaypoint);
    }
    rebuildWaypointHandles(arrowData);
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    updateArrowStylePanel(arrowData);
  }
  function removeWaypoint(arrowData, waypointIndex) {
    if (!arrowData.waypoints || waypointIndex < 0 || waypointIndex >= arrowData.waypoints.length) {
      return;
    }
    pushUndoState();
    arrowData.waypoints.splice(waypointIndex, 1);
    rebuildWaypointHandles(arrowData);
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    updateArrowStylePanel(arrowData);
  }
  function rebuildWaypointHandles(arrowData) {
    if (arrowData._waypointHandles) {
      for (const handle of arrowData._waypointHandles) {
        if (handle._dragController) {
          handle._dragController.abort();
        }
        handle.remove();
      }
    }
    arrowData._waypointHandles = [];
    if (arrowData.waypoints && arrowData.waypoints.length > 0) {
      for (let i = 0; i < arrowData.waypoints.length; i++) {
        const handle = createWaypointHandle(arrowData, i);
        arrowData._container.appendChild(handle);
        arrowData._waypointHandles.push(handle);
      }
    }
    updateArrowHandles(arrowData);
  }
  function catmullRomPath(points) {
    if (points.length < 2)
      return "";
    if (points.length === 2) {
      return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
    }
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }
  function waypointPolylinePath(fromX, fromY, waypoints, toX, toY) {
    let path = `M ${fromX},${fromY}`;
    for (const wp of waypoints) {
      path += ` L ${wp.x},${wp.y}`;
    }
    path += ` L ${toX},${toY}`;
    return path;
  }
  function updateArrowPath(arrowData) {
    if (!arrowData._path)
      return;
    const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y, waypoints, smooth } = arrowData;
    let pathD;
    if (waypoints && waypoints.length > 0) {
      const allPoints = [
        { x: fromX, y: fromY },
        ...waypoints,
        { x: toX, y: toY }
      ];
      if (smooth) {
        pathD = catmullRomPath(allPoints);
      } else {
        pathD = waypointPolylinePath(fromX, fromY, waypoints, toX, toY);
      }
    } else if (control1X !== null && control2X !== null) {
      pathD = `M ${fromX},${fromY} C ${control1X},${control1Y} ${control2X},${control2Y} ${toX},${toY}`;
    } else if (control1X !== null) {
      pathD = `M ${fromX},${fromY} Q ${control1X},${control1Y} ${toX},${toY}`;
    } else {
      pathD = `M ${fromX},${fromY} L ${toX},${toY}`;
    }
    arrowData._path.setAttribute("d", pathD);
    if (arrowData._hitArea) {
      arrowData._hitArea.setAttribute("d", pathD);
    }
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
    if (arrowData.line && arrowData.line !== "single") {
      updateArrowLineStyle(arrowData);
    }
    updateArrowLabel(arrowData);
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
    if (arrowData._waypointHandles && arrowData.waypoints) {
      for (let i = 0; i < arrowData._waypointHandles.length; i++) {
        const handle = arrowData._waypointHandles[i];
        const wp = arrowData.waypoints[i];
        if (handle && wp) {
          handle.style.left = wp.x + "px";
          handle.style.top = wp.y + "px";
        }
      }
    }
  }
  function getPointOnArrow(t, arrowData) {
    const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y } = arrowData;
    let x, y, dx, dy;
    if (control1X !== null && control2X !== null) {
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;
      x = mt3 * fromX + 3 * mt2 * t * control1X + 3 * mt * t2 * control2X + t3 * toX;
      y = mt3 * fromY + 3 * mt2 * t * control1Y + 3 * mt * t2 * control2Y + t3 * toY;
      dx = 3 * mt2 * (control1X - fromX) + 6 * mt * t * (control2X - control1X) + 3 * t2 * (toX - control2X);
      dy = 3 * mt2 * (control1Y - fromY) + 6 * mt * t * (control2Y - control1Y) + 3 * t2 * (toY - control2Y);
    } else if (control1X !== null) {
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      x = mt2 * fromX + 2 * mt * t * control1X + t2 * toX;
      y = mt2 * fromY + 2 * mt * t * control1Y + t2 * toY;
      dx = 2 * mt * (control1X - fromX) + 2 * t * (toX - control1X);
      dy = 2 * mt * (control1Y - fromY) + 2 * t * (toY - control1Y);
    } else {
      x = fromX + t * (toX - fromX);
      y = fromY + t * (toY - fromY);
      dx = toX - fromX;
      dy = toY - fromY;
    }
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return { x, y, angle };
  }
  function updateArrowLabel(arrowData) {
    if (!arrowData._labelText)
      return;
    const label = arrowData.label || "";
    arrowData._labelText.textContent = label;
    if (!label) {
      arrowData._labelText.style.display = "none";
      return;
    }
    arrowData._labelText.style.display = "";
    let t;
    switch (arrowData.labelPosition) {
      case "start":
        t = 0.15;
        break;
      case "end":
        t = 0.85;
        break;
      case "middle":
      default:
        t = 0.5;
    }
    const point = getPointOnArrow(t, arrowData);
    const offset = arrowData.labelOffset !== void 0 ? arrowData.labelOffset : CONFIG.ARROW_DEFAULT_LABEL_OFFSET;
    const angleRad = point.angle * (Math.PI / 180);
    const offsetX = -Math.sin(angleRad) * offset;
    const offsetY = Math.cos(angleRad) * offset;
    const labelX = point.x + offsetX;
    const labelY = point.y + offsetY;
    arrowData._labelText.setAttribute("x", labelX);
    arrowData._labelText.setAttribute("y", labelY);
    let rotationAngle = point.angle;
    if (rotationAngle > 90 || rotationAngle < -90) {
      rotationAngle += 180;
    }
    arrowData._labelText.setAttribute("transform", `rotate(${rotationAngle}, ${labelX}, ${labelY})`);
    arrowData._labelText.setAttribute("fill", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
  }
  function toggleCurveMode(arrowData) {
    arrowData.curveMode = !arrowData.curveMode;
    if (arrowData.curveMode) {
      if (arrowData.waypoints && arrowData.waypoints.length > 0) {
        arrowData.waypoints = [];
        arrowData.smooth = false;
        rebuildWaypointHandles(arrowData);
      }
      const { fromX, fromY, toX, toY } = arrowData;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / len * 50;
      const perpY = dx / len * 50;
      arrowData.control1X = fromX + dx / 3 + perpX;
      arrowData.control1Y = fromY + dy / 3 + perpY;
      arrowData.control2X = fromX + 2 * dx / 3 + perpX;
      arrowData.control2Y = fromY + 2 * dy / 3 + perpY;
      if (arrowData._container) {
        arrowData._container.classList.add("curve-mode");
      }
      if (arrowData._control1Handle)
        arrowData._control1Handle.style.display = "";
      if (arrowData._control2Handle)
        arrowData._control2Handle.style.display = "";
    } else {
      arrowData.control1X = null;
      arrowData.control1Y = null;
      arrowData.control2X = null;
      arrowData.control2Y = null;
      if (arrowData._container) {
        arrowData._container.classList.remove("curve-mode");
      }
      if (arrowData._guideLine1)
        arrowData._guideLine1.style.display = "none";
      if (arrowData._guideLine2)
        arrowData._guideLine2.style.display = "none";
      if (arrowData._control1Handle)
        arrowData._control1Handle.style.display = "none";
      if (arrowData._control2Handle)
        arrowData._control2Handle.style.display = "none";
    }
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    updateSmoothToggleInToolbar(arrowData);
  }
  var arrowExtensionWarningShown, activeArrow, globalClickOutsideHandlerRegistered, arrowControlRefs, ARROW_HEAD_STYLES;
  var init_arrows = __esm({
    "src/arrows.js"() {
      init_config();
      init_utils();
      init_colors();
      init_registries();
      init_undo();
      arrowExtensionWarningShown = false;
      activeArrow = null;
      globalClickOutsideHandlerRegistered = false;
      arrowControlRefs = {
        colorPicker: null,
        widthInput: null,
        headSelect: null,
        dashSelect: null,
        lineSelect: null,
        opacityInput: null,
        colorPresetsRow: null,
        labelInput: null,
        labelPositionSelect: null,
        labelOffsetInput: null,
        smoothToggle: null,
        waypointBadge: null,
        curveToggle: null
      };
      ARROW_HEAD_STYLES = ["arrow", "stealth", "diamond", "circle", "square", "bar", "none"];
    }
  });

  // src/undo.js
  function captureAllState() {
    const snapshots = [];
    for (const [element, editableElt] of editableRegistry) {
      editableElt.syncFromDOM();
      snapshots.push({
        element,
        state: { ...editableElt.state }
      });
    }
    return snapshots;
  }
  function captureArrowState() {
    const snapshots = [];
    for (const arrowData of NewElementRegistry.newArrows) {
      const state = {};
      for (const key of ARROW_STATE_KEYS) {
        state[key] = arrowData[key];
      }
      snapshots.push({
        arrowData,
        state
      });
    }
    return snapshots;
  }
  function restoreArrowState(snapshots) {
    Promise.resolve().then(() => (init_arrows(), arrows_exports)).then(({ updateArrowPath: updateArrowPath2, updateArrowHandles: updateArrowHandles2, updateArrowAppearance: updateArrowAppearance2, updateArrowActiveState: updateArrowActiveState2 }) => {
      for (const snapshot of snapshots) {
        const arrowData = snapshot.arrowData;
        for (const key of ARROW_STATE_KEYS) {
          arrowData[key] = snapshot.state[key];
        }
        updateArrowPath2(arrowData);
        updateArrowHandles2(arrowData);
        updateArrowAppearance2(arrowData);
        updateArrowActiveState2(arrowData);
      }
    });
  }
  function restoreState(snapshots) {
    for (const snapshot of snapshots) {
      const editableElt = editableRegistry.get(snapshot.element);
      if (editableElt) {
        editableElt.setState(snapshot.state);
      }
    }
  }
  function pushUndoState() {
    const state = {
      elements: captureAllState(),
      arrows: captureArrowState()
    };
    undoStack.push(state);
    if (undoStack.length > CONFIG.MAX_UNDO_STACK_SIZE) {
      undoStack.shift();
    }
    redoStack.length = 0;
  }
  function undo() {
    if (undoStack.length === 0)
      return false;
    const currentState = {
      elements: captureAllState(),
      arrows: captureArrowState()
    };
    redoStack.push(currentState);
    const previousState = undoStack.pop();
    restoreState(previousState.elements);
    restoreArrowState(previousState.arrows);
    return true;
  }
  function redo() {
    if (redoStack.length === 0)
      return false;
    const currentState = {
      elements: captureAllState(),
      arrows: captureArrowState()
    };
    undoStack.push(currentState);
    const redoState = redoStack.pop();
    restoreState(redoState.elements);
    restoreArrowState(redoState.arrows);
    return true;
  }
  function canUndo() {
    return undoStack.length > 0;
  }
  function canRedo() {
    return redoStack.length > 0;
  }
  function setupUndoRedoKeyboard() {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (document.activeElement.contentEditable === "true")
          return;
        e.preventDefault();
        if (undo()) {
          debug("Undo performed");
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "z" && e.shiftKey)) {
        if (document.activeElement.contentEditable === "true")
          return;
        e.preventDefault();
        if (redo()) {
          debug("Redo performed");
        }
        return;
      }
    });
  }
  var undoStack, redoStack, ARROW_STATE_KEYS;
  var init_undo = __esm({
    "src/undo.js"() {
      init_config();
      init_utils();
      init_editable_element();
      init_registries();
      undoStack = [];
      redoStack = [];
      ARROW_STATE_KEYS = [
        "fromX",
        "fromY",
        "toX",
        "toY",
        "control1X",
        "control1Y",
        "control2X",
        "control2Y",
        "curveMode",
        "color",
        "width",
        "head",
        "dash",
        "line",
        "opacity"
      ];
    }
  });

  // src/main.js
  init_config();
  init_utils();
  init_editable_element();
  init_undo();
  init_quill();
  init_registries();

  // src/capabilities.js
  init_config();
  init_utils();
  init_undo();
  init_quill();
  init_registries();
  var Capabilities = {
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
          if (element.contentEditable === "true")
            return;
          const quillData = quillInstances.get(element);
          if (quillData && quillData.isEditing)
            return;
          if (e.target.classList.contains("resize-handle"))
            return;
          if (e.target.closest(".ql-toolbar") || e.target.closest(".quill-toolbar-container"))
            return;
          if (e.target.closest(".ql-picker") || e.target.classList.contains("ql-picker-item"))
            return;
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
        if (!context.isDragging)
          return;
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
        if (e.shiftKey)
          return false;
        if (e.ctrlKey || e.metaKey)
          return false;
        const step = CONFIG.KEYBOARD_MOVE_STEP;
        const state = editableElt.getState();
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
      }
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
      },
      attachEvents(context) {
        const { container, element } = context;
        const startResize = (e) => {
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
        if (!context.isResizing)
          return;
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
        if (!e.shiftKey)
          return false;
        if (e.ctrlKey || e.metaKey)
          return false;
        const step = CONFIG.KEYBOARD_MOVE_STEP;
        const state = editableElt.getState();
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
      }
    },
    /**
     * Font controls capability - creates container for edit button.
     * Actual formatting (font size, alignment, colors) is handled by Quill toolbar.
     */
    fontControls: {
      name: "fontControls",
      init(context) {
      },
      createControls(context) {
        const { container } = context;
        const fontControls = document.createElement("div");
        fontControls.className = "editable-font-controls";
        container.appendChild(fontControls);
        return fontControls;
      },
      attachEvents(context) {
      }
    },
    /**
     * Edit text capability - toggles contentEditable mode for divs.
     */
    editText: {
      name: "editText",
      init(context) {
      },
      createControls(context) {
        const { container, element } = context;
        const elementType = element.tagName.toLowerCase();
        let fontControls = container.querySelector(".editable-font-controls");
        if (!fontControls) {
          fontControls = document.createElement("div");
          fontControls.className = "editable-font-controls";
          container.appendChild(fontControls);
        }
        const config = ControlRegistry.controls.get("editMode");
        if (config && config.appliesTo.includes(elementType)) {
          const btn = ControlRegistry.createButton(config, element);
          fontControls.appendChild(btn);
          return btn;
        }
        return null;
      },
      attachEvents(context) {
      }
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
        handle.title = "Rotate (Shift to snap to 15\xB0)";
        container.appendChild(handle);
      },
      attachEvents(context) {
        const { container } = context;
        const startRotate = (e) => {
          pushUndoState();
          context.isRotating = true;
          const rect = container.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          context.rotateCenterX = centerX;
          context.rotateCenterY = centerY;
          const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
          const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
          context.rotateStartAngle = Math.atan2(
            clientY - centerY,
            clientX - centerX
          );
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
        if (!context.isRotating)
          return;
        const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
        const currentAngle = Math.atan2(
          clientY - context.rotateCenterY,
          clientX - context.rotateCenterX
        );
        const angleDiff = (currentAngle - context.rotateStartAngle) * (180 / Math.PI);
        let newRotation = context.rotateInitialRotation + angleDiff;
        if (e.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }
        while (newRotation > 180)
          newRotation -= 360;
        while (newRotation < -180)
          newRotation += 360;
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
        if (!e.ctrlKey && !e.metaKey)
          return false;
        const step = e.shiftKey ? 15 : 5;
        const state = editableElt.getState();
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
      }
    }
  };
  var ELEMENT_CAPABILITIES = {
    img: ["move", "resize", "rotate"],
    div: ["move", "resize", "rotate", "fontControls", "editText"]
  };
  function getCapabilitiesFor(elementType) {
    const capabilityNames = ELEMENT_CAPABILITIES[elementType] || ["move", "resize"];
    return capabilityNames.map((name) => Capabilities[name]).filter(Boolean);
  }

  // src/toolbar.js
  init_registries();
  function createFloatingToolbar() {
    if (document.getElementById("editable-toolbar")) {
      return document.getElementById("editable-toolbar");
    }
    const toolbar = document.createElement("div");
    toolbar.id = "editable-toolbar";
    toolbar.className = "editable-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Editable tools");
    const dragHandle = document.createElement("div");
    dragHandle.className = "editable-toolbar-handle";
    dragHandle.innerHTML = "\u22EE\u22EE";
    dragHandle.title = "Drag to move toolbar";
    toolbar.appendChild(dragHandle);
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "editable-toolbar-buttons";
    ToolbarRegistry.getActions().forEach((action) => {
      let element;
      if (action.submenu) {
        element = ToolbarRegistry.createSubmenuButton(action);
      } else {
        element = ToolbarRegistry.createButton(action);
      }
      buttonsContainer.appendChild(element);
    });
    toolbar.appendChild(buttonsContainer);
    makeToolbarDraggable(toolbar, dragHandle);
    document.body.appendChild(toolbar);
    return toolbar;
  }
  function makeToolbarDraggable(toolbar, handle) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    function startDrag(e) {
      if (e.target !== handle && !handle.contains(e.target))
        return;
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
      toolbar.style.right = "auto";
      toolbar.style.transform = "none";
      toolbar.style.left = initialX + "px";
      toolbar.style.top = initialY + "px";
      e.preventDefault();
    }
    function drag(e) {
      if (!isDragging)
        return;
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
      toolbar.style.left = initialX + deltaX + "px";
      toolbar.style.top = initialY + deltaY + "px";
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

  // src/main.js
  init_arrows();

  // src/serialization.js
  init_config();
  init_utils();
  init_colors();
  init_editable_element();
  init_registries();
  init_quill();
  function findSlideHeadingLines(lines) {
    const headings = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      if (line.startsWith("## ") && (i === 0 || prevLine === "")) {
        headings.push(i);
      }
    }
    return headings;
  }
  var PropertySerializers = {
    // Core position/size properties (go in attribute list)
    width: {
      type: "attr",
      serialize: (v) => `width=${round(v)}px`
    },
    height: {
      type: "attr",
      serialize: (v) => `height=${round(v)}px`
    },
    left: {
      type: "attr",
      serialize: (v) => `left=${round(v)}px`
    },
    top: {
      type: "attr",
      serialize: (v) => `top=${round(v)}px`
    },
    // Style properties (go in style attribute)
    fontSize: {
      type: "style",
      serialize: (v) => v ? `font-size: ${v}px;` : null
    },
    textAlign: {
      type: "style",
      serialize: (v) => v ? `text-align: ${v};` : null
    },
    rotation: {
      type: "style",
      serialize: (v) => v ? `transform: rotate(${round(v)}deg);` : null
    }
  };
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
  function getFenceForContent(content) {
    const matches = content.match(/^:+/gm) || [];
    let maxColons = 3;
    for (const match of matches) {
      if (match.length >= maxColons) {
        maxColons = match.length + 1;
      }
    }
    return ":".repeat(maxColons);
  }
  function elementToText(element) {
    const quillEditor = element.querySelector(".ql-editor");
    let text = quillEditor ? quillEditor.innerHTML.trim() : element.innerHTML.trim();
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(
      /<p[^>]*class="[^"]*ql-align-(center|right|justify)[^"]*"[^>]*>/gi,
      (match, align) => `__ALIGN_START_${align}__`
    );
    text = text.replace(
      /__ALIGN_START_(center|right|justify)__([\s\S]*?)<\/p>/gi,
      (match, align, content) => `__ALIGN_START_${align}__${content}__ALIGN_END_${align}__

`
    );
    text = text.replace(/<p[^>]*>/gi, "");
    text = text.replace(/<\/p>/gi, "\n\n");
    text = text.replace(/<code[^>]*>/gi, "`");
    text = text.replace(/<\/code>/gi, "`");
    text = text.replace(/<strong[^>]*>/gi, "**");
    text = text.replace(/<\/strong>/gi, "**");
    text = text.replace(/<b[^>]*>/gi, "**");
    text = text.replace(/<\/b>/gi, "**");
    text = text.replace(/<em[^>]*>/gi, "*");
    text = text.replace(/<\/em>/gi, "*");
    text = text.replace(/<i[^>]*>/gi, "*");
    text = text.replace(/<\/i>/gi, "*");
    text = text.replace(/<del[^>]*>/gi, "~~");
    text = text.replace(/<\/del>/gi, "~~");
    text = text.replace(/<s(?![a-z])[^>]*>/gi, "~~");
    text = text.replace(/<\/s(?![a-z])>/gi, "~~");
    text = text.replace(/<strike[^>]*>/gi, "~~");
    text = text.replace(/<\/strike>/gi, "~~");
    text = text.replace(/<u[^>]*>/gi, "[");
    text = text.replace(/<\/u>/gi, "]{.underline}");
    text = text.replace(/<span[^>]*style="[^"]*background-color:\s*([^;"]+)[^"]*"[^>]*>/gi, "[__BG_START__$1__");
    text = text.replace(/__BG_START__([^_]+)__([^<]*)<\/span>/gi, (match, colorVal, content) => {
      const colorOutput = getBrandColorOutput(colorVal);
      return `${content}]{style='background-color: ${colorOutput}'}`;
    });
    text = text.replace(/<span[^>]*style="[^"]*(?<!background-)color:\s*([^;"]+)[^"]*"[^>]*>/gi, (match, colorVal) => {
      if (colorVal.trim().toLowerCase() === "inherit") {
        return "";
      }
      return `[__COLOR_START__${colorVal}__`;
    });
    text = text.replace(/__COLOR_START__([^_]+)__([^<]*)<\/span>/gi, (match, colorVal, content) => {
      const colorOutput = getBrandColorOutput(colorVal);
      return `${content}]{style='color: ${colorOutput}'}`;
    });
    text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "[$2]($1)");
    text = text.replace(/<[^>]+>/g, "");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/__BRAND_SHORTCODE_(\w+)__/g, "{{< brand color $1 >}}");
    text = text.replace(
      /__ALIGN_START_(center|right|justify)__([\s\S]*?)__ALIGN_END_\1__/g,
      (match, align, content) => {
        const trimmed = content.trim();
        const innerFence = getFenceForContent(trimmed);
        return `${innerFence} {style="text-align: ${align}"}
${trimmed}
${innerFence}`;
      }
    );
    return text.trim();
  }
  function serializeArrowToShortcode(arrow) {
    const fromX = round(arrow.fromX);
    const fromY = round(arrow.fromY);
    const toX = round(arrow.toX);
    const toY = round(arrow.toY);
    let shortcode = `{{< arrow from="${fromX},${fromY}" to="${toX},${toY}"`;
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
    if (arrow.waypoints && arrow.waypoints.length > 0) {
      const waypointsStr = arrow.waypoints.map((wp) => `${round(wp.x)},${round(wp.y)}`).join(" ");
      shortcode += ` waypoints="${waypointsStr}"`;
      if (arrow.smooth) {
        shortcode += ` smooth="true"`;
      }
    }
    const normalizedArrowColor = normalizeColor(arrow.color);
    if (arrow.color && normalizedArrowColor !== "#000000") {
      const colorOutput = getBrandColorOutput(arrow.color);
      shortcode += ` color="${colorOutput}"`;
    }
    if (arrow.width && arrow.width !== CONFIG.ARROW_DEFAULT_WIDTH) {
      shortcode += ` width="${arrow.width}"`;
    }
    if (arrow.head && arrow.head !== "arrow") {
      shortcode += ` head="${arrow.head}"`;
    }
    if (arrow.dash && arrow.dash !== "solid") {
      shortcode += ` dash="${arrow.dash}"`;
    }
    if (arrow.line && arrow.line !== "single") {
      shortcode += ` line="${arrow.line}"`;
    }
    if (arrow.opacity !== void 0 && arrow.opacity !== 1) {
      shortcode += ` opacity="${arrow.opacity}"`;
    }
    if (arrow.label) {
      shortcode += ` label="${arrow.label}"`;
    }
    if (arrow.label && arrow.labelPosition && arrow.labelPosition !== "middle") {
      shortcode += ` label-position="${arrow.labelPosition}"`;
    }
    if (arrow.label && arrow.labelOffset !== void 0 && arrow.labelOffset !== CONFIG.ARROW_DEFAULT_LABEL_OFFSET) {
      shortcode += ` label-offset="${arrow.labelOffset}"`;
    }
    shortcode += ` position="absolute" >}}`;
    return shortcode;
  }
  function extractEditableEltDimensions() {
    const editableElements = getOriginalEditableElements();
    const dimensions = [];
    editableElements.forEach((elt) => {
      const editableElt = editableRegistry.get(elt);
      if (editableElt) {
        dimensions.push(editableElt.toDimensions());
      } else {
        const width = elt.style.width ? parseFloat(elt.style.width) : elt.offsetWidth;
        const height = elt.style.height ? parseFloat(elt.style.height) : elt.offsetHeight;
        const parentContainer = elt.parentNode;
        const left = parentContainer.style.left ? parseFloat(parentContainer.style.left) : parentContainer.offsetLeft;
        const top = parentContainer.style.top ? parseFloat(parentContainer.style.top) : parentContainer.offsetTop;
        dimensions.push({ width, height, left, top });
      }
    });
    return dimensions;
  }
  function insertNewSlides(text) {
    if (NewElementRegistry.newSlides.length === 0) {
      return { text, slideLinePositions: /* @__PURE__ */ new Map() };
    }
    const lines = text.split("\n");
    const slideHeadingLines = findSlideHeadingLines(lines);
    const divsByNewSlide = /* @__PURE__ */ new Map();
    for (const divInfo of NewElementRegistry.newDivs) {
      if (divInfo.newSlideRef) {
        if (!divsByNewSlide.has(divInfo.newSlideRef)) {
          divsByNewSlide.set(divInfo.newSlideRef, []);
        }
        divsByNewSlide.get(divInfo.newSlideRef).push(divInfo);
      }
    }
    const arrowsByNewSlide = /* @__PURE__ */ new Map();
    for (const arrowInfo of NewElementRegistry.newArrows) {
      if (arrowInfo.newSlideRef) {
        if (!arrowsByNewSlide.has(arrowInfo.newSlideRef)) {
          arrowsByNewSlide.set(arrowInfo.newSlideRef, []);
        }
        arrowsByNewSlide.get(arrowInfo.newSlideRef).push(arrowInfo);
      }
    }
    function flattenSlideTree(slides) {
      const childrenOf = /* @__PURE__ */ new Map();
      const roots = [];
      for (const slide of slides) {
        if (slide.insertAfterNewSlide && slides.includes(slide.insertAfterNewSlide)) {
          if (!childrenOf.has(slide.insertAfterNewSlide)) {
            childrenOf.set(slide.insertAfterNewSlide, []);
          }
          childrenOf.get(slide.insertAfterNewSlide).push(slide);
        } else {
          roots.push(slide);
        }
      }
      roots.sort((a, b) => b.insertionOrder - a.insertionOrder);
      for (const [, children] of childrenOf) {
        children.sort((a, b) => b.insertionOrder - a.insertionOrder);
      }
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
    const slidesByAfterIndex = /* @__PURE__ */ new Map();
    for (const slide of NewElementRegistry.newSlides) {
      const idx = slide.afterSlideIndex;
      if (!slidesByAfterIndex.has(idx)) {
        slidesByAfterIndex.set(idx, []);
      }
      slidesByAfterIndex.get(idx).push(slide);
    }
    const afterIndices = [...slidesByAfterIndex.keys()].sort((a, b) => b - a);
    const slideLinePositions = /* @__PURE__ */ new Map();
    for (const afterIdx of afterIndices) {
      const slidesForThisIndex = slidesByAfterIndex.get(afterIdx);
      const orderedSlides = flattenSlideTree(slidesForThisIndex);
      const targetHeadingIndex = afterIdx;
      let baseInsertLineIndex;
      if (targetHeadingIndex >= slideHeadingLines.length) {
        baseInsertLineIndex = lines.length;
      } else if (targetHeadingIndex + 1 < slideHeadingLines.length) {
        baseInsertLineIndex = slideHeadingLines[targetHeadingIndex + 1];
      } else {
        baseInsertLineIndex = lines.length;
      }
      for (let i = orderedSlides.length - 1; i >= 0; i--) {
        const newSlide = orderedSlides[i];
        const newSlideContent = ["", CONFIG.NEW_SLIDE_HEADING, ""];
        const divsForThisSlide = divsByNewSlide.get(newSlide) || [];
        for (const divInfo of divsForThisSlide) {
          const editableElt = editableRegistry.get(divInfo.element);
          if (editableElt) {
            const dims = editableElt.toDimensions();
            const attrStr = serializeToQmd(dims);
            const textContent = elementToText(divInfo.element) || CONFIG.NEW_TEXT_CONTENT;
            const fence = getFenceForContent(textContent);
            newSlideContent.push("");
            newSlideContent.push(`${fence} ${attrStr}`);
            newSlideContent.push(textContent);
            newSlideContent.push(fence);
          }
        }
        const arrowsForThisSlide = arrowsByNewSlide.get(newSlide) || [];
        for (const arrowInfo of arrowsForThisSlide) {
          const shortcode = serializeArrowToShortcode(arrowInfo);
          newSlideContent.push("");
          newSlideContent.push(shortcode);
          newSlideContent.push("");
        }
        slideLinePositions.set(newSlide, baseInsertLineIndex + 1);
        lines.splice(baseInsertLineIndex, 0, ...newSlideContent);
        for (const [slide, pos] of slideLinePositions) {
          if (slide !== newSlide && pos >= baseInsertLineIndex) {
            slideLinePositions.set(slide, pos + newSlideContent.length);
          }
        }
      }
      const totalLinesAdded = orderedSlides.reduce((sum, slide) => {
        const divs = divsByNewSlide.get(slide) || [];
        const arrows = arrowsByNewSlide.get(slide) || [];
        return sum + 3 + divs.length * 4 + arrows.length * 3;
      }, 0);
      for (let j = 0; j < slideHeadingLines.length; j++) {
        if (slideHeadingLines[j] >= baseInsertLineIndex) {
          slideHeadingLines[j] += totalLinesAdded;
        }
      }
    }
    return { text: lines.join("\n"), slideLinePositions };
  }
  function insertNewDivs(text, slideLinePositions = /* @__PURE__ */ new Map()) {
    const divsOnOriginalSlides = NewElementRegistry.newDivs.filter(
      (div) => !div.newSlideRef
    );
    if (divsOnOriginalSlides.length === 0) {
      return text;
    }
    const lines = text.split("\n");
    const slideHeadingLines = findSlideHeadingLines(lines);
    const divsBySlide = /* @__PURE__ */ new Map();
    for (const newDiv of divsOnOriginalSlides) {
      const slideIdx = newDiv.slideIndex;
      if (!divsBySlide.has(slideIdx)) {
        divsBySlide.set(slideIdx, []);
      }
      divsBySlide.get(slideIdx).push(newDiv);
    }
    const slideIndices = [...divsBySlide.keys()].sort((a, b) => b - a);
    for (const slideIdx of slideIndices) {
      const divsForSlide = divsBySlide.get(slideIdx);
      let insertLineIndex;
      if (slideIdx >= slideHeadingLines.length) {
        insertLineIndex = lines.length;
      } else if (slideIdx + 1 < slideHeadingLines.length) {
        insertLineIndex = slideHeadingLines[slideIdx + 1];
      } else {
        insertLineIndex = lines.length;
      }
      const newContent = [];
      for (const divInfo of divsForSlide) {
        const editableElt = editableRegistry.get(divInfo.element);
        if (editableElt) {
          const dims = editableElt.toDimensions();
          const attrStr = serializeToQmd(dims);
          const textContent = elementToText(divInfo.element) || CONFIG.NEW_TEXT_CONTENT;
          const fence = getFenceForContent(textContent);
          newContent.push("");
          newContent.push(`${fence} ${attrStr}`);
          newContent.push(textContent);
          newContent.push(fence);
        }
      }
      if (newContent.length > 0) {
        lines.splice(insertLineIndex, 0, ...newContent);
        for (let i = 0; i < slideHeadingLines.length; i++) {
          if (slideHeadingLines[i] >= insertLineIndex) {
            slideHeadingLines[i] += newContent.length;
          }
        }
      }
    }
    return lines.join("\n");
  }
  function insertNewArrows(text, slideLinePositions = /* @__PURE__ */ new Map()) {
    const arrowsOnOriginalSlides = NewElementRegistry.newArrows.filter(
      (arrow) => !arrow.newSlideRef
    );
    if (arrowsOnOriginalSlides.length === 0) {
      return text;
    }
    const lines = text.split("\n");
    const slideHeadingLines = findSlideHeadingLines(lines);
    const arrowsBySlide = /* @__PURE__ */ new Map();
    for (const arrow of arrowsOnOriginalSlides) {
      const slideIdx = arrow.slideIndex;
      if (!arrowsBySlide.has(slideIdx)) {
        arrowsBySlide.set(slideIdx, []);
      }
      arrowsBySlide.get(slideIdx).push(arrow);
    }
    const slideIndices = [...arrowsBySlide.keys()].sort((a, b) => b - a);
    for (const slideIdx of slideIndices) {
      const arrowsForSlide = arrowsBySlide.get(slideIdx);
      let insertLineIndex;
      if (slideIdx >= slideHeadingLines.length) {
        insertLineIndex = lines.length;
      } else if (slideIdx + 1 < slideHeadingLines.length) {
        insertLineIndex = slideHeadingLines[slideIdx + 1];
      } else {
        insertLineIndex = lines.length;
      }
      const newContent = [];
      for (const arrow of arrowsForSlide) {
        const shortcode = serializeArrowToShortcode(arrow);
        newContent.push("");
        newContent.push(shortcode);
        newContent.push("");
      }
      if (newContent.length > 0) {
        lines.splice(insertLineIndex, 0, ...newContent);
        for (let i = 0; i < slideHeadingLines.length; i++) {
          if (slideHeadingLines[i] >= insertLineIndex) {
            slideHeadingLines[i] += newContent.length;
          }
        }
      }
    }
    return lines.join("\n");
  }
  function updateTextDivs(text) {
    const divs = getOriginalEditableDivs();
    const replacements = Array.from(divs).map(htmlToQuarto);
    const regex = /^(:{3,}) ?(?:\{\.editable[^}]*\}|editable)\n([\s\S]*?)\n\1$/gm;
    let index = 0;
    return text.replace(regex, (match, fence, originalContent) => {
      const replacement = replacements[index++];
      if (replacement === null) {
        const contentFence = getFenceForContent(originalContent);
        return `${contentFence} {.editable}
${originalContent}
${contentFence}`;
      }
      return replacement || "";
    });
  }
  function htmlToQuarto(div) {
    const quillData = quillInstances.get(div);
    if (quillData && !quillData.isDirty) {
      return null;
    }
    const text = elementToText(div);
    const fence = getFenceForContent(text);
    return `${fence} {.editable}
` + text.trim() + `
${fence}`;
  }
  function replaceEditableOccurrences(text, replacements) {
    const regex = /(?:^(:{3,}) |(?<=\]\([^)]*\)))\{\.editable[^}]*\}/gm;
    let index = 0;
    return text.replace(regex, (match, fenceColons) => {
      const isDiv = fenceColons !== void 0;
      const prefix = isDiv ? fenceColons + " " : "";
      return prefix + (replacements[index++] || "");
    });
  }
  function formatEditableEltStrings(dimensions) {
    return dimensions.map((dim) => serializeToQmd(dim));
  }

  // src/main.js
  ToolbarRegistry.register("save", {
    icon: "\u{1F4BE}",
    label: "Save",
    title: "Save edits to file",
    className: "toolbar-save",
    onClick: () => saveMovedElts()
  });
  ToolbarRegistry.register("copy", {
    icon: "\u{1F4CB}",
    label: "Copy",
    title: "Copy QMD to clipboard",
    className: "toolbar-copy",
    onClick: () => copyQmdToClipboard()
  });
  ToolbarRegistry.register("add", {
    icon: "\u2795",
    label: "Add",
    title: "Add new elements",
    className: "toolbar-add",
    submenu: [
      {
        icon: "\u{1F4DD}",
        label: "Text",
        title: "Add editable text to current slide",
        className: "toolbar-add-text",
        onClick: () => addNewTextElement()
      },
      {
        icon: "\u{1F5BC}\uFE0F",
        label: "Slide",
        title: "Add new slide after current",
        className: "toolbar-add-slide",
        onClick: () => addNewSlide()
      },
      {
        icon: "\u27A1\uFE0F",
        label: "Arrow",
        title: "Add arrow to current slide",
        className: "toolbar-add-arrow",
        onClick: () => addNewArrow()
      }
    ]
  });
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
      const originalSlideIndex = qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
      NewElementRegistry.addDiv(newDiv, originalSlideIndex, null);
    }
    const editableElt = editableRegistry.get(newDiv);
    if (editableElt) {
      const slideWidth = currentSlide.offsetWidth || 960;
      const slideHeight = currentSlide.offsetHeight || 700;
      editableElt.setState({
        x: (slideWidth - CONFIG.NEW_TEXT_WIDTH) / 2,
        y: (slideHeight - CONFIG.NEW_TEXT_HEIGHT) / 2
      });
    }
    debug("Added new text element to slide", slideIndex);
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
    debug(
      "Added new slide after original index",
      originalSlideIndex,
      "insertAfterNewSlide:",
      insertAfterNewSlide ? "yes" : "no"
    );
    return newSlide;
  }
  function getTransformedQmd() {
    let content = readIndexQmd();
    if (!content)
      return "";
    const { text: contentWithSlides, slideLinePositions } = insertNewSlides(content);
    content = contentWithSlides;
    content = insertNewDivs(content, slideLinePositions);
    content = insertNewArrows(content, slideLinePositions);
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
    if (!content)
      return;
    navigator.clipboard.writeText(content).then(function() {
      debug("qmd content copied to clipboard");
    }).catch(function(err) {
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
    if (!window._input_filename)
      return "untitled.qmd";
    return window._input_filename.split(/[/\\]/).pop();
  }
  async function downloadString(content, mimeType = "text/plain") {
    const filename = getEditableFilename();
    if ("showSaveFilePicker" in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "Text files",
              accept: { [mimeType]: [".txt", ".qmd", ".md"] }
            }
          ]
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
  function addSaveMenuButton() {
    const slideMenuItems = document.querySelector(
      "div.slide-menu-custom-panel ul.slide-menu-items"
    );
    if (slideMenuItems) {
      let addMenuHoverBehavior = function(li) {
        li.addEventListener("mouseenter", function() {
          slideMenuItems.querySelectorAll(".slide-tool-item.selected").forEach((item) => {
            item.classList.remove("selected");
          });
          li.classList.add("selected");
        });
        li.addEventListener("mouseleave", function() {
          li.classList.remove("selected");
        });
      };
      const existingItems = slideMenuItems.querySelectorAll("li[data-item]");
      let maxDataItem = 0;
      existingItems.forEach((item) => {
        const dataValue = parseInt(item.getAttribute("data-item")) || 0;
        if (dataValue > maxDataItem) {
          maxDataItem = dataValue;
        }
      });
      const newLi = document.createElement("li");
      newLi.className = "slide-tool-item";
      newLi.setAttribute("data-item", (maxDataItem + 1).toString());
      const newA = document.createElement("a");
      newA.href = "#";
      const kbd = document.createElement("kbd");
      kbd.textContent = "?";
      newA.appendChild(kbd);
      newA.appendChild(document.createTextNode(" Save Edits"));
      newA.addEventListener("click", function(e) {
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
      copyA.addEventListener("click", function(e) {
        e.preventDefault();
        copyQmdToClipboard();
      });
      copyLi.appendChild(copyA);
      addMenuHoverBehavior(copyLi);
      slideMenuItems.appendChild(copyLi);
    }
  }
  function setupDraggableElt(elt) {
    const editableElt = new EditableElement(elt);
    editableRegistry.set(elt, editableElt);
    const container = createEltContainer(elt);
    editableElt.container = container;
    setupEltStyles(elt);
    const context = {
      element: elt,
      container,
      editableElt,
      handlers: {},
      rafId: null,
      cachedScale: 1
    };
    const elementType = elt.tagName.toLowerCase();
    const capabilities = getCapabilitiesFor(elementType);
    capabilities.forEach((cap) => {
      if (cap.init)
        cap.init(context);
    });
    setupContainerAccessibility(container);
    capabilities.forEach((cap) => {
      if (cap.createHandles)
        cap.createHandles(context);
      if (cap.createControls)
        cap.createControls(context);
    });
    capabilities.forEach((cap) => {
      if (cap.attachEvents)
        cap.attachEvents(context);
    });
    setupHoverEffects(context, capabilities);
    setupKeyboardNavigation(context, capabilities, editableElt);
    attachGlobalEvents(context, capabilities);
    function createEltContainer(elt2) {
      const container2 = document.createElement("div");
      container2.className = "editable-container";
      elt2.parentNode.insertBefore(container2, elt2);
      container2.appendChild(elt2);
      return container2;
    }
    function setupEltStyles(elt2) {
      elt2.style.cursor = "move";
      elt2.style.position = "relative";
      let width = elt2.offsetWidth;
      let height = elt2.offsetHeight;
      if (elt2.tagName.toLowerCase() === "img" && (width === 0 || height === 0)) {
        width = elt2.naturalWidth || width;
        height = elt2.naturalHeight || height;
      }
      elt2.style.width = width + "px";
      elt2.style.height = height + "px";
      elt2.style.display = "block";
    }
    function setupContainerAccessibility(container2) {
      container2.setAttribute("tabindex", "0");
      container2.setAttribute("role", "application");
      container2.setAttribute("aria-label", "Editable element. Use arrow keys to move, Shift+arrows to resize.");
    }
    function setupHoverEffects(context2, capabilities2) {
      const { container: container2 } = context2;
      function showControls() {
        container2.classList.add("active");
      }
      function hideControls() {
        container2.classList.remove("active");
      }
      function isAnyCapabilityActive() {
        return capabilities2.some((cap) => cap.isActive && cap.isActive(context2));
      }
      container2.addEventListener("mouseenter", showControls);
      container2.addEventListener("mouseleave", () => {
        if (!isAnyCapabilityActive()) {
          hideControls();
        }
      });
      container2.addEventListener("focus", showControls);
      container2.addEventListener("blur", (e) => {
        if (!container2.contains(e.relatedTarget)) {
          hideControls();
        }
      });
    }
    function setupKeyboardNavigation(context2, capabilities2, editableElt2) {
      const { container: container2, element } = context2;
      container2.addEventListener("keydown", (e) => {
        if (element.contentEditable === "true") {
          return;
        }
        if (e.key === "Tab" && e.shiftKey) {
          container2.blur();
          e.preventDefault();
          return;
        }
        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        editableElt2.syncFromDOM();
        for (const cap of capabilities2) {
          if (cap.handleKeyboard && cap.handleKeyboard(context2, e, editableElt2)) {
            break;
          }
        }
      });
    }
    function attachGlobalEvents(context2, capabilities2) {
      function handlePointerMove(e) {
        const isActive = capabilities2.some((cap) => cap.isActive && cap.isActive(context2));
        if (!isActive)
          return;
        if (context2.rafId) {
          cancelAnimationFrame(context2.rafId);
        }
        context2.rafId = requestAnimationFrame(() => {
          capabilities2.forEach((cap) => {
            if (cap.onMove)
              cap.onMove(context2, e);
          });
          context2.rafId = null;
        });
      }
      function stopAction() {
        const wasActive = capabilities2.some((cap) => cap.isActive && cap.isActive(context2));
        if (wasActive) {
          setTimeout(() => {
            if (!context2.container.matches(":hover")) {
              context2.container.classList.remove("active");
            }
          }, CONFIG.HOVER_TIMEOUT);
        }
        if (context2.rafId) {
          cancelAnimationFrame(context2.rafId);
          context2.rafId = null;
        }
        capabilities2.forEach((cap) => {
          if (cap.onStop)
            cap.onStop(context2);
        });
      }
      document.addEventListener("mousemove", handlePointerMove);
      document.addEventListener("touchmove", handlePointerMove);
      document.addEventListener("mouseup", stopAction);
      document.addEventListener("touchend", stopAction);
    }
  }
  function setupImageWhenReady(img) {
    if (img.complete && img.naturalWidth > 0 && img.offsetWidth > 0) {
      setupDraggableElt(img);
      return;
    }
    let setupDone = false;
    const doSetup = () => {
      if (setupDone)
        return;
      if (img.naturalWidth > 0 && img.offsetWidth > 0) {
        setupDone = true;
        setupDraggableElt(img);
      }
    };
    img.addEventListener("load", doSetup, { once: true });
    let attempts = 0;
    const poll = () => {
      if (setupDone || attempts >= CONFIG.POLL_MAX_ATTEMPTS)
        return;
      attempts++;
      if (img.naturalWidth > 0 && img.offsetWidth > 0) {
        doSetup();
      } else {
        setTimeout(poll, CONFIG.POLL_INTERVAL_MS);
      }
    };
    poll();
  }
  function setupDivWhenReady(div) {
    if (div.offsetWidth >= CONFIG.MIN_ELEMENT_SIZE && div.offsetHeight >= CONFIG.MIN_ELEMENT_SIZE) {
      setupDraggableElt(div);
      return;
    }
    let setupDone = false;
    let attempts = 0;
    const checkAndSetup = () => {
      if (setupDone || attempts >= CONFIG.POLL_MAX_ATTEMPTS)
        return;
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
  window.Revealeditable = function() {
    return {
      id: "Revealeditable",
      init: function(deck) {
        deck.on("ready", async function() {
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
      }
    };
  };
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
})();
