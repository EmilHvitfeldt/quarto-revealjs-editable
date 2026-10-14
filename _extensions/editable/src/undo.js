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

/** @type {Function|null} Callback registered by arrows.js to update arrow DOM */
let restoreArrowDOMFn = null;

/**
 * Register the arrow DOM restore callback (called by arrows.js to break circular import).
 * @param {Function} fn - Function that accepts snapshots and updates arrow DOM
 */
export function registerRestoreArrowDOM(fn) {
  restoreArrowDOMFn = fn;
}

/** Clear undo/redo stacks — for use in tests only. */
export function clearUndoStacks() {
  undoStack.length = 0;
  redoStack.length = 0;
  notifyHistoryChange();
}

function notifyHistoryChange(restored = false) {
  if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') return;
  document.dispatchEvent(new CustomEvent('editable-history-change', {
    detail: { canUndo: canUndo(), canRedo: canRedo() },
  }));
  if (restored) document.dispatchEvent(new CustomEvent('editable-content-restored'));
}

/**
 * Activation changes the DOM structure, not just editable coordinates. Keep
 * node references so undo can unwrap an element and redo can reuse its event
 * listeners. Only the affected slide is captured, never the entire deck.
 */
function captureDOM(root) {
  const nodes = [];
  const visit = node => {
    const children = [...node.childNodes];
    nodes.push({
      node, children,
      attributes: node !== root && node.attributes
        ? [...node.attributes].map(attribute => [attribute.name, attribute.value]) : null,
      text: node.nodeType === 3 ? node.nodeValue : null,
    });
    children.forEach(visit);
  };
  visit(root);
  return { root, nodes, registry: new Map(editableRegistry) };
}

function restoreDOM(snapshot) {
  for (const { node, children, attributes, text } of snapshot.nodes) {
    if (attributes) {
      // Navigation can change fragment visibility between an edit and undo.
      const fragment = node.classList.contains('fragment');
      const visible = node.classList.contains('visible');
      const current = node.classList.contains('current-fragment');
      const target = new Map(attributes);
      for (const attribute of [...node.attributes]) {
        if (!target.has(attribute.name)) node.removeAttribute(attribute.name);
      }
      for (const [name, value] of attributes) {
        if (node.getAttribute(name) !== value) node.setAttribute(name, value);
      }
      if (fragment) {
        node.classList.toggle('visible', visible);
        node.classList.toggle('current-fragment', current);
      }
    }
    if (text !== null) node.nodeValue = text;
    const currentChildren = [...node.childNodes];
    if (children.length !== currentChildren.length || children.some((child, index) => child !== currentChildren[index])) {
      node.replaceChildren(...children);
    }
  }
  editableRegistry.clear();
  for (const [element, editableElt] of snapshot.registry) editableRegistry.set(element, editableElt);
}

function captureSnapshot(root = null) {
  return {
    elements: captureAllState(),
    arrows: captureArrowState(),
    dom: root ? captureDOM(root) : null,
  };
}

function restoreSnapshot(snapshot) {
  if (snapshot.dom) restoreDOM(snapshot.dom);
  restoreState(snapshot.elements);
  restoreArrowState(snapshot.arrows);
  notifyHistoryChange(true);
}

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
  for (const snapshot of snapshots) {
    const arrowData = snapshot.arrowData;
    for (const key of ARROW_STATE_KEYS) {
      arrowData[key] = snapshot.state[key];
    }
  }
  if (restoreArrowDOMFn) restoreArrowDOMFn(snapshots);
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
export function pushUndoState({ root = null } = {}) {
  const state = captureSnapshot(root);
  undoStack.push(state);

  // Limit stack size
  if (undoStack.length > CONFIG.MAX_UNDO_STACK_SIZE) {
    undoStack.shift();
  }

  // Clear redo stack on new action
  redoStack.length = 0;
  notifyHistoryChange();
}

/**
 * Undo the last action by restoring previous state.
 * @returns {boolean} True if undo was performed
 */
export function undo() {
  if (undoStack.length === 0) return false;

  // Save current state to redo stack
  const previousState = undoStack.pop();
  redoStack.push(captureSnapshot(previousState.dom?.root));
  restoreSnapshot(previousState);

  return true;
}

/**
 * Redo the last undone action.
 * @returns {boolean} True if redo was performed
 */
export function redo() {
  if (redoStack.length === 0) return false;

  // Save current state to undo stack
  const redoState = redoStack.pop();
  undoStack.push(captureSnapshot(redoState.dom?.root));
  restoreSnapshot(redoState);

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
    const target = document.activeElement;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const key = e.key.toLowerCase();
    // Check for Ctrl+Z (undo) or Cmd+Z on Mac
    if ((e.ctrlKey || e.metaKey) && key === "z" && !e.shiftKey) {
      e.preventDefault();
      if (undo()) {
        debug("Undo performed");
      }
      return;
    }

    // Check for Ctrl+Y or Ctrl+Shift+Z (redo)
    if ((e.ctrlKey || e.metaKey) && (key === "y" || (key === "z" && e.shiftKey))) {
      e.preventDefault();
      if (redo()) {
        debug("Redo performed");
      }
      return;
    }
  });
}
