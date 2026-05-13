/**
 * Main entry point for the editable Reveal.js plugin.
 * Registers toolbar actions and initializes editable elements.
 * @module main
 */

import { getEditableElements, getOriginalEditableElements, hasTitleSlide } from './utils.js';
import { editableRegistry } from './editable-element.js';
import { setupUndoRedoKeyboard, canUndo, canRedo, pushUndoState, undo, redo } from './undo.js';
import { initializeQuillForElement, quillInstances } from './quill.js';
import { ToolbarRegistry, NewElementRegistry } from './registries.js';
import { createFloatingToolbar } from './toolbar.js';
import { addNewArrow, initArrows } from './arrows.js';
import { setActiveImage } from './images.js';
import { isInsideActiveEditContext } from './selection.js';
import { addNewTextElement, addNewSlide, setupImageWhenReady, setupDivWhenReady } from './element-setup.js';
import { getTransformedQmd, saveMovedElts, copyQmdToClipboard, readIndexQmd } from './io.js';
import { toggleModifyMode, ModifyModeClassifier, enterModifyMode, exitModifyMode } from './modify-mode.js';
import { addSaveMenuButton } from './menu.js';
import {
  extractEditableEltDimensions,
  formatEditableEltStrings,
  replaceEditableOccurrences,
  updateTextDivs,
  serializeToQmd,
  htmlToQuarto,
} from './serialization.js';

// Register toolbar actions (save, copy, add)

ToolbarRegistry.register("save", {
  icon: "💾",
  label: "Save",
  title: "Save edits to file",
  className: "toolbar-save",
  zone: "left",
  onClick: () => saveMovedElts(),
});

ToolbarRegistry.register("copy", {
  icon: "📋",
  label: "Copy",
  title: "Copy QMD to clipboard",
  className: "toolbar-copy",
  zone: "left",
  onClick: () => copyQmdToClipboard(),
});

ToolbarRegistry.register("add", {
  icon: "➕",
  label: "Add",
  title: "Add new elements",
  className: "toolbar-add",
  zone: "left",
  stacked: false,
  hideOnContext: true,
  submenu: [
    { icon: "📝", label: "Text", title: "Add editable text to current slide", className: "toolbar-add-text", onClick: () => addNewTextElement() },
    { icon: "🖼️", label: "Slide", title: "Add new slide after current", className: "toolbar-add-slide", onClick: () => addNewSlide() },
    { icon: "➡️", label: "Arrow", title: "Add arrow to current slide", className: "toolbar-add-arrow", onClick: () => addNewArrow() },
  ],
});

ToolbarRegistry.register("modify", {
  icon: "✏️",
  label: "Modify",
  title: "Click an image to make it editable",
  className: "toolbar-modify",
  zone: "left",
  stacked: false,
  onClick: () => toggleModifyMode(),
});

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
        initArrows();
        const editableElements = getEditableElements();

        const editableDivs = Array.from(editableElements).filter(
          (el) => el.tagName.toLowerCase() === "div"
        );
        editableDivs.forEach(initializeQuillForElement);

        editableElements.forEach((elt) => {
          const tagName = elt.tagName.toLowerCase();
          if (tagName === "img") setupImageWhenReady(elt);
          else if (tagName === "div") setupDivWhenReady(elt);
        });

        addSaveMenuButton();
        createFloatingToolbar();
        setupUndoRedoKeyboard();

        document.addEventListener("click", (e) => {
          if (!isInsideActiveEditContext(e.target)) {
            setActiveImage(null);
          }
        });
      });
    },
  };
};

// Expose internals for e2e testing under a single namespace to avoid global pollution
window.editable = {
  getTransformedQmd,
  quillInstances,
  editableRegistry,
  ToolbarRegistry,
  NewElementRegistry,
  extractEditableEltDimensions,
  formatEditableEltStrings,
  replaceEditableOccurrences,
  updateTextDivs,
  serializeToQmd,
  copyQmdToClipboard,
  canUndo,
  canRedo,
  pushUndoState,
  undo,
  redo,
  getEditableElements,
  getOriginalEditableElements,
  hasTitleSlide,
  htmlToQuarto,
  readIndexQmd,
  addNewSlide,
  addNewTextElement,
  setActiveImage,
  ModifyModeClassifier,
};
// Legacy flat exports — kept for backward compatibility with existing e2e tests
Object.assign(window, window.editable);
