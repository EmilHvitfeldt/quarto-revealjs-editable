import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRegistry = new Map();
const mockNewArrows = [];

vi.mock('../config.js', () => ({
  CONFIG: { MAX_UNDO_STACK_SIZE: 50, DEBUG: false },
}));
vi.mock('../utils.js', () => ({ debug: () => {} }));
vi.mock('../editable-element.js', () => ({
  get editableRegistry() { return mockRegistry; },
}));
vi.mock('../registries.js', () => ({
  get NewElementRegistry() { return { newArrows: mockNewArrows }; },
}));

import {
  pushUndoState,
  undo,
  redo,
  canUndo,
  canRedo,
  captureArrowState,
  restoreArrowState,
  registerRestoreArrowDOM,
  clearUndoStacks,
} from '../undo.js';

function makeEl() { return {}; }  // plain object as Map key (no DOM needed)

function makeEditableElt(initialState) {
  let state = { ...initialState };
  return {
    syncFromDOM: () => {},
    getState: () => ({ ...state }),
    setState: (s) => { state = { ...state, ...s }; },
    get state() { return state; },
  };
}

beforeEach(() => {
  clearUndoStacks();
  mockRegistry.clear();
  mockNewArrows.length = 0;
});

describe('canUndo / canRedo', () => {
  it('returns false when stacks are empty', () => {
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
  });

  it('canUndo returns true after pushUndoState', () => {
    pushUndoState();
    expect(canUndo()).toBe(true);
  });
});

describe('pushUndoState / undo / redo', () => {
  it('restores element state on undo', () => {
    const el = makeEl();
    const elt = makeEditableElt({ x: 10 });
    mockRegistry.set(el, elt);

    pushUndoState();
    elt.setState({ x: 99 });

    expect(undo()).toBe(true);
    expect(elt.getState().x).toBe(10);
  });

  it('redo re-applies state after undo', () => {
    const el = makeEl();
    const elt = makeEditableElt({ x: 10 });
    mockRegistry.set(el, elt);

    pushUndoState();
    elt.setState({ x: 99 });

    undo();
    expect(elt.getState().x).toBe(10);

    redo();
    expect(elt.getState().x).toBe(99);
  });

  it('clears redo stack when new action is pushed', () => {
    const el = makeEl();
    const elt = makeEditableElt({ x: 0 });
    mockRegistry.set(el, elt);

    pushUndoState();
    elt.setState({ x: 1 });
    undo();
    expect(canRedo()).toBe(true);

    pushUndoState();
    expect(canRedo()).toBe(false);
  });

  it('undo returns false when stack is empty', () => {
    expect(undo()).toBe(false);
  });

  it('redo returns false when stack is empty', () => {
    expect(redo()).toBe(false);
  });
});

describe('arrow state capture and restore', () => {
  const makeArrow = (overrides = {}) => ({
    fromX: 10, fromY: 20, toX: 100, toY: 200,
    color: 'black', width: 2, style: 'solid', type: 'arrow',
    control1X: null, control1Y: null, control2X: null, control2Y: null,
    waypoints: [], labelText: '', labelPosition: 'middle', labelOffset: 10,
    opacity: 1, ...overrides,
  });

  it('captures arrow state snapshot', () => {
    const arrowData = makeArrow();
    mockNewArrows.push(arrowData);

    const snapshots = captureArrowState();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].state.fromX).toBe(10);
    expect(snapshots[0].arrowData).toBe(arrowData);
  });

  it('restores arrow state from snapshot', () => {
    const arrowData = makeArrow();
    mockNewArrows.push(arrowData);

    const snapshots = captureArrowState();
    arrowData.fromX = 999;

    restoreArrowState(snapshots);
    expect(arrowData.fromX).toBe(10);
  });

  it('calls registered DOM restore callback', () => {
    const domFn = vi.fn();
    registerRestoreArrowDOM(domFn);

    const arrowData = makeArrow();
    mockNewArrows.push(arrowData);

    const snapshots = captureArrowState();
    restoreArrowState(snapshots);
    expect(domFn).toHaveBeenCalledWith(snapshots);

    registerRestoreArrowDOM(null);
  });
});
