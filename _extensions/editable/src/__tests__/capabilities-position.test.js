import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../quill.js', () => ({ quillInstances: new Map() }));
vi.mock('../undo.js', () => ({ pushUndoState: vi.fn() }));
vi.mock('../utils.js', () => ({
  getSlideScale: () => 1,
  getClientCoordinates: event => ({ clientX: event.clientX, clientY: event.clientY }),
}));

import { Capabilities } from '../capabilities.js';
import { pushUndoState } from '../undo.js';

beforeEach(() => vi.clearAllMocks());

function context() {
  return {
    element: { addEventListener: vi.fn(), offsetWidth: 300, offsetHeight: 180 },
    // A grid item sits at (430, 90), but its relative displacement is (12, 5).
    container: { offsetLeft: 442, offsetTop: 95, style: {}, querySelectorAll: () => [] },
    editableElt: { syncFromDOM: vi.fn(), getState: () => ({ x: 12, y: 5 }) },
    handlers: {},
  };
}

const pointer = (clientX, clientY) => ({
  type: 'mousedown', clientX, clientY,
  target: { classList: { contains: () => false }, closest: () => null, dataset: { position: 'nw' } },
  preventDefault: vi.fn(), stopPropagation: vi.fn(),
});

describe('media within normal slide layout', () => {
  it('records one history entry per drag, not per click or mouse move', () => {
    const ctx = context();
    Capabilities.move.init(ctx);
    Capabilities.move.attachEvents(ctx);
    ctx.handlers.drag(pointer(500, 200));
    Capabilities.move.onMove(ctx, pointer(501, 200));
    Capabilities.move.onStop(ctx);
    expect(pushUndoState).not.toHaveBeenCalled();
    expect(ctx.container.style.left).toBeUndefined();
    ctx.handlers.drag(pointer(500, 200));
    Capabilities.move.onMove(ctx, pointer(520, 210));
    Capabilities.move.onMove(ctx, pointer(530, 220));
    expect(pushUndoState).toHaveBeenCalledTimes(1);
  });

  it('does not add history when a resize handle is only clicked', () => {
    const ctx = context();
    Capabilities.resize.init(ctx);
    Capabilities.resize.attachEvents(ctx);
    ctx.handlers.resize(pointer(500, 200));
    Capabilities.resize.onMove(ctx, pointer(500, 200));
    Capabilities.resize.onStop(ctx);
    expect(pushUndoState).not.toHaveBeenCalled();
    expect(ctx.container.style.width).toBeUndefined();
  });
  it('moves by the pointer delta without adding the grid position again', () => {
    const ctx = context();
    Capabilities.move.init(ctx);
    Capabilities.move.attachEvents(ctx);
    ctx.handlers.drag(pointer(500, 200));
    Capabilities.move.onMove(ctx, pointer(570, 235));
    expect(ctx.container.style.left).toBe('82px');
    expect(ctx.container.style.top).toBe('40px');
  });

  it('starts resizing from the relative displacement', () => {
    const ctx = context();
    Capabilities.resize.init(ctx);
    Capabilities.resize.attachEvents(ctx);
    ctx.handlers.resize(pointer(500, 200));
    expect(ctx.resizeInitialX).toBe(12);
    expect(ctx.resizeInitialY).toBe(5);
  });
});
