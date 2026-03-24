/**
 * Undo/Redo system for tracking and reverting state changes.
 * Captures snapshots of all editable elements before changes.
 * @module undo
 */

import { CONFIG } from './config.js';
import { debug } from './utils.js';
import { editableRegistry } from './editable-element.js';
import { NewElementRegistry } from './registries.js';

/** @type {Array<Array<Object>>} Stack of previous states for undo */
const undoStack = [];
/** @type {Array<Array<Object>>} Stack of undone states for redo */
const redoStack = [];

/**
 * Capture a snapshot of a single element's state.
 * @param {HTMLElement} element - The element to capture
 * @returns {{element: HTMLElement, state: Object}|null} State snapshot or null
 */
export function captureElementState(element) {
  const editableElt = editableRegistry.get(element);
  if (!editableElt) return null;

  editableElt.syncFromDOM();
  return {
    element: element,
    state: { ...editableElt.state },
  };
}

/**
 * Capture state of all registered editable elements.
 * @returns {Array<{element: HTMLElement, state: Object}>} Array of state snapshots
 */
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

/** Arrow properties to capture for undo/redo */
const ARROW_STATE_KEYS = [
  'fromX', 'fromY', 'toX', 'toY',
  'control1X', 'control1Y', 'control2X', 'control2Y',
  'curveMode', 'color', 'width', 'head', 'dash', 'line', 'opacity'
];

/**
 * Capture state of all arrows.
 * @returns {Array<{arrowData: Object, state: Object}>} Array of arrow state snapshots
 */
export function captureArrowState() {
  const snapshots = [];
  for (const arrowData of NewElementRegistry.newArrows) {
    const state = {};
    for (const key of ARROW_STATE_KEYS) {
      state[key] = arrowData[key];
    }
    snapshots.push({
      arrowData: arrowData,
      state: state,
    });
  }
  return snapshots;
}

/**
 * Restore all arrows to a previous snapshot state.
 * @param {Array<{arrowData: Object, state: Object}>} snapshots - States to restore
 */
export function restoreArrowState(snapshots) {
  // Dynamically import arrow update functions to avoid circular dependency
  import('./arrows.js').then(({ updateArrowPath, updateArrowHandles, updateArrowAppearance, updateArrowActiveState }) => {
    for (const snapshot of snapshots) {
      const arrowData = snapshot.arrowData;
      // Restore state properties
      for (const key of ARROW_STATE_KEYS) {
        arrowData[key] = snapshot.state[key];
      }
      // Update DOM to reflect restored state
      updateArrowPath(arrowData);
      updateArrowHandles(arrowData);
      updateArrowAppearance(arrowData);
      updateArrowActiveState(arrowData);
    }
  });
}

/**
 * Restore all elements to a previous snapshot state.
 * @param {Array<{element: HTMLElement, state: Object}>} snapshots - States to restore
 */
export function restoreState(snapshots) {
  for (const snapshot of snapshots) {
    const editableElt = editableRegistry.get(snapshot.element);
    if (editableElt) {
      editableElt.setState(snapshot.state);
    }
  }
}

/**
 * Push current state to undo stack. Call before making changes.
 * Clears redo stack since new action invalidates redo history.
 */
export function pushUndoState() {
  const state = {
    elements: captureAllState(),
    arrows: captureArrowState(),
  };
  undoStack.push(state);

  // Limit stack size
  if (undoStack.length > CONFIG.MAX_UNDO_STACK_SIZE) {
    undoStack.shift();
  }

  // Clear redo stack on new action
  redoStack.length = 0;
}

/**
 * Undo the last action by restoring previous state.
 * @returns {boolean} True if undo was performed
 */
export function undo() {
  if (undoStack.length === 0) return false;

  // Save current state to redo stack
  const currentState = {
    elements: captureAllState(),
    arrows: captureArrowState(),
  };
  redoStack.push(currentState);

  // Restore previous state
  const previousState = undoStack.pop();
  restoreState(previousState.elements);
  restoreArrowState(previousState.arrows);

  return true;
}

/**
 * Redo the last undone action.
 * @returns {boolean} True if redo was performed
 */
export function redo() {
  if (redoStack.length === 0) return false;

  // Save current state to undo stack
  const currentState = {
    elements: captureAllState(),
    arrows: captureArrowState(),
  };
  undoStack.push(currentState);

  // Restore redo state
  const redoState = redoStack.pop();
  restoreState(redoState.elements);
  restoreArrowState(redoState.arrows);

  return true;
}

/**
 * Check if undo is available.
 * @returns {boolean} True if undo stack has entries
 */
export function canUndo() {
  return undoStack.length > 0;
}

/**
 * Check if redo is available.
 * @returns {boolean} True if redo stack has entries
 */
export function canRedo() {
  return redoStack.length > 0;
}

/**
 * Setup global keyboard shortcuts for undo/redo.
 * Ctrl+Z / Cmd+Z for undo, Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z for redo.
 */
export function setupUndoRedoKeyboard() {
  document.addEventListener("keydown", (e) => {
    // Check for Ctrl+Z (undo) or Cmd+Z on Mac
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      // Don't intercept if user is editing text content
      if (document.activeElement.contentEditable === "true") return;

      e.preventDefault();
      if (undo()) {
        debug("Undo performed");
      }
      return;
    }

    // Check for Ctrl+Y or Ctrl+Shift+Z (redo)
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      // Don't intercept if user is editing text content
      if (document.activeElement.contentEditable === "true") return;

      e.preventDefault();
      if (redo()) {
        debug("Redo performed");
      }
      return;
    }
  });
}
