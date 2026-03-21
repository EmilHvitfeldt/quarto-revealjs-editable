import { CONFIG } from './config.js';
import { editableRegistry } from './editable-element.js';

// =============================================================================
// Undo/Redo System
// =============================================================================

const undoStack = [];
const redoStack = [];

// Capture a snapshot of an element's state
export function captureElementState(element) {
  const editableElt = editableRegistry.get(element);
  if (!editableElt) return null;

  editableElt.syncFromDOM();
  return {
    element: element,
    state: { ...editableElt.state },
  };
}

// Capture state of all elements
export function captureAllState() {
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
export function restoreState(snapshots) {
  for (const snapshot of snapshots) {
    const editableElt = editableRegistry.get(snapshot.element);
    if (editableElt) {
      editableElt.setState(snapshot.state);
    }
  }
}

// Push current state to undo stack (call before making changes)
export function pushUndoState() {
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
export function undo() {
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
export function redo() {
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
export function canUndo() {
  return undoStack.length > 0;
}

// Check if redo is available
export function canRedo() {
  return redoStack.length > 0;
}

// Setup global keyboard shortcuts for undo/redo
export function setupUndoRedoKeyboard() {
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
