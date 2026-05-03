/**
 * Quill rich text editor integration.
 * Handles initialization and management of Quill editors.
 * @module quill
 */

import Quill from 'quill';
import { getColorPalette } from './colors.js';

/**
 * Map of DOM elements to their Quill instance data.
 * @type {Map<HTMLElement, {quill: Quill, toolbarContainer: HTMLElement, editorWrapper: HTMLElement, isEditing: boolean, originalContent: string, isDirty: boolean}>}
 */
export const quillInstances = new Map();

/**
 * Initialize Quill editor for an editable div element.
 * Called at page load to prevent text shifting when entering edit mode.
 * @param {HTMLElement} element - The div element to initialize
 * @returns {Object|null} Quill data object or null if failed
 */
export function initializeQuillForElement(element) {
  // Only for div and p elements
  const tag = element.tagName.toLowerCase();
  if (tag !== "div" && tag !== "p") return null;

  // Skip if already initialized
  if (quillInstances.has(element)) return quillInstances.get(element);

  try {
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
      <button class="ql-bold" aria-label="Bold">B</button>
      <button class="ql-italic" aria-label="Italic">I</button>
      <button class="ql-underline" aria-label="Underline">U</button>
      <button class="ql-strike" aria-label="Strikethrough">S</button>
      <span class="quill-toolbar-separator"></span>
      <select class="ql-color" aria-label="Text color">${colorOptionsWithExtras}</select>
      <select class="ql-background" aria-label="Background color">${colorOptionsWithExtras}</select>
      <span class="quill-toolbar-separator"></span>
      <button class="ql-align" value="" aria-label="Align left"></button>
      <button class="ql-align" value="center" aria-label="Align center"></button>
      <button class="ql-align" value="right" aria-label="Align right"></button>
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
