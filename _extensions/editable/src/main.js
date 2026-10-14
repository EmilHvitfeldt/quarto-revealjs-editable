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
import { addNewArrow, initArrows, setActiveArrow } from './arrows.js';
import { setActiveImage } from './images.js';
import { isInsideActiveEditContext } from './selection.js';
import { addNewTextElement, addNewSlide, setupImageWhenReady, setupDivWhenReady, openShapePicker } from './element-setup.js';
import { setActiveShape } from './shapes.js';
import { getTransformedQmd, saveMovedElts, copyQmdToClipboard, readIndexQmd } from './io.js';
import { toggleModifyMode, ModifyModeClassifier, enterModifyMode, exitModifyMode } from './modify-mode.js';
import { addSaveMenuButton } from './menu.js';
import { initializeServerSaving, startServerSavingEvents } from './server-sync.js';
import { canEditSelectedText, editSelectedText } from './text-editing.js';
import { svgPartsEnabled, setSVGPartsEnabled, initializeSVGReferences } from './svg-editing.js';
import {
  extractEditableEltDimensions,
  formatEditableEltStrings,
  replaceEditableOccurrences,
  updateTextDivs,
  serializeToQmd,
  htmlToQuarto,
} from './serialization.js';

// Register toolbar actions (save, copy, add)

ToolbarRegistry.register("undo", {
  icon: "↶", label: "Undo", title: "Undo last change (Ctrl/Cmd+Z)",
  className: "toolbar-undo", zone: "left", stacked: false,
  onClick: () => undo(),
});

ToolbarRegistry.register("redo", {
  icon: "↷", label: "Redo", title: "Redo last change (Ctrl/Cmd+Shift+Z or Ctrl+Y)",
  className: "toolbar-redo", zone: "left", stacked: false,
  onClick: () => redo(),
});

ToolbarRegistry.register("edit-text", {
  icon: "T", label: "Edit text", title: "Edit selected text (or double-click it)",
  className: "toolbar-edit-text", zone: "left", stacked: false,
  onClick: () => editSelectedText(),
});

ToolbarRegistry.register("save", {
  icon: "💾",
  label: "Save",
  title: "Save edits to the server",
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
    { icon: "⬟", label: "Shape", title: "Add a shape to current slide", className: "toolbar-add-shape", onClick: () => openShapePicker() },
  ],
});

ToolbarRegistry.register("modify", {
  icon: "✏️",
  label: "Modify",
  title: "Click text, labels or media to make them editable",
  className: "toolbar-modify",
  zone: "left",
  stacked: false,
  onClick: () => toggleModifyMode(),
});

ToolbarRegistry.register("diagram-parts", {
  icon: "◇", label: "Diagram parts", title: "Move boxes, their contents, and arrows inside vector figures",
  className: "toolbar-diagram-parts", zone: "left", stacked: false,
  onClick: () => {
    setSVGPartsEnabled(!svgPartsEnabled());
    exitModifyMode();
    enterModifyMode();
  },
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
        await initializeServerSaving(getTransformedQmd);
        initializeSVGReferences();
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
        const updateHistoryButtons = () => {
          for (const [name, available] of [['undo', canUndo()], ['redo', canRedo()]]) {
            const button = document.querySelector(`.toolbar-${name}`);
            button.disabled = !available;
            button.classList.toggle('toolbar-button-disabled', !available);
          }
        };
        document.addEventListener('editable-history-change', updateHistoryButtons);
        document.addEventListener('editable-content-restored', () => {
          setActiveImage(null);
          setActiveShape(null);
          setActiveArrow(null);
        });
        updateHistoryButtons();
        const updateTextButton = () => {
          const button = document.querySelector('.toolbar-edit-text');
          button.disabled = !canEditSelectedText();
          button.classList.toggle('toolbar-button-disabled', button.disabled);
        };
        document.addEventListener('editable-text-selection-change', updateTextButton);
        updateTextButton();
        setupUndoRedoKeyboard();
        startServerSavingEvents();
        document.dispatchEvent(new CustomEvent('presentation-editor-ready'));

        document.addEventListener("click", (e) => {
          if (!isInsideActiveEditContext(e.target)) {
            setActiveImage(null);
            setActiveShape(null);
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
