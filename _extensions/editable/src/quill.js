/**
 * Quill rich text editor integration.
 * Handles dynamic loading, initialization, and management of Quill editors.
 * @module quill
 */

import { CONFIG } from './config.js';
import { getColorPalette } from './colors.js';

/** @type {boolean} Whether Quill has been loaded */
let quillLoaded = false;
/** @type {Promise|null} Loading promise to prevent duplicate loads */
let quillLoading = null;

/**
 * Load Quill CSS and JS from CDN.
 * Returns immediately if already loaded, or returns existing promise if loading.
 * @returns {Promise<void>} Resolves when Quill is ready
 */
export function loadQuill() {
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

/**
 * Map of DOM elements to their Quill instance data.
 * @type {Map<HTMLElement, {quill: Quill, toolbarContainer: HTMLElement, editorWrapper: HTMLElement, isEditing: boolean, originalContent: string, isDirty: boolean}>}
 */
export const quillInstances = new Map();

/** @type {Set<HTMLElement>} Elements currently being initialized (race condition guard) */
const initializingElements = new Set();

/**
 * Initialize Quill editor for an editable div element.
 * Called at page load to prevent text shifting when entering edit mode.
 * @param {HTMLElement} element - The div element to initialize
 * @returns {Promise<Object|null>} Quill data object or null if failed
 */
export async function initializeQuillForElement(element) {
  // Only for div elements
  if (element.tagName.toLowerCase() !== "div") return null;

  // Skip if already initialized
  if (quillInstances.has(element)) return quillInstances.get(element);

  // Guard against race conditions - wait for existing initialization
  if (initializingElements.has(element)) {
    await new Promise(resolve => {
      const check = () => {
        if (quillInstances.has(element)) resolve();
        else setTimeout(check, 10);
      };
      check();
    });
    return quillInstances.get(element);
  }

  initializingElements.add(element);

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
    initializingElements.delete(element);

    return quillData;
  } catch (err) {
    console.error("Failed to initialize Quill for element:", err);
    initializingElements.delete(element);
    return null;
  }
}
