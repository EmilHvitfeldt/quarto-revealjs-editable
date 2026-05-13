import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for modify-mode.js's transitive imports (it pulls in DOM-y modules).
vi.mock('../editable-element.js', () => ({ editableRegistry: { has: () => false, get: () => null } }));
vi.mock('../element-setup.js', () => ({
  setupImageWhenReady: vi.fn(),
  setupDivWhenReady: vi.fn(),
  setupVideoWhenReady: vi.fn(),
  setupDraggableElt: vi.fn(),
}));
vi.mock('../toolbar.js', () => ({ showRightPanel: vi.fn() }));
vi.mock('../serialization.js', () => ({
  splitIntoSlideChunks: vi.fn(),
  serializeToQmd: vi.fn(),
  elementToText: vi.fn(),
  serializeArrowToShortcode: vi.fn(),
}));
vi.mock('../utils.js', () => ({ getQmdHeadingIndex: vi.fn(), getSlideScale: vi.fn() }));
vi.mock('../colors.js', () => ({ getColorPalette: vi.fn(() => []), getBrandColorOutput: vi.fn() }));
vi.mock('../capabilities.js', () => ({ setCapabilityOverride: vi.fn() }));
vi.mock('../quill.js', () => ({ quillInstances: new Map(), initializeQuillForElement: vi.fn() }));
vi.mock('../arrows.js', () => ({ createArrowElement: vi.fn(), setActiveArrow: vi.fn() }));

import {
  isAlreadyPositioned,
  findPositionedAncestor,
  buildAbsoluteAttrString,
  wrapLinesWithAbsoluteFence,
} from '../modify-mode.js';

// Tiny fake-element factory: only models classList.contains + closest, which
// is everything the helpers under test inspect. Saves us from needing jsdom.
function mkEl({ classes = [], parent = null } = {}) {
  const classSet = new Set(classes);
  const el = {
    classList: { contains: (c) => classSet.has(c) },
    parentNode: parent,
  };
  el.closest = function (selector) {
    // Support `.foo` and `tag.foo` selectors.
    const m = selector.match(/^([a-z]+)?\.([a-z-]+)$/i);
    if (!m) return null;
    const [, tag, cls] = m;
    let cur = el;
    while (cur) {
      const tagOk = !tag || (cur._tag && cur._tag.toLowerCase() === tag.toLowerCase());
      if (tagOk && cur.classList && cur.classList.contains(cls)) return cur;
      cur = cur.parentNode;
    }
    return null;
  };
  return el;
}

describe('isAlreadyPositioned', () => {
  it('returns false for null/undefined', () => {
    expect(isAlreadyPositioned(null)).toBe(false);
    expect(isAlreadyPositioned(undefined)).toBe(false);
  });

  it('returns true when the element itself has .absolute', () => {
    const el = mkEl({ classes: ['absolute'] });
    el._tag = 'div';
    expect(isAlreadyPositioned(el)).toBe(true);
  });

  it('returns true when nested inside a div.absolute', () => {
    const outer = mkEl({ classes: ['absolute'] });
    outer._tag = 'div';
    const inner = mkEl({ parent: outer });
    inner._tag = 'p';
    expect(isAlreadyPositioned(inner)).toBe(true);
  });

  it('returns false for an unpositioned element with no .absolute ancestor', () => {
    const el = mkEl();
    el._tag = 'p';
    expect(isAlreadyPositioned(el)).toBe(false);
  });
});

describe('findPositionedAncestor', () => {
  it('returns null for null', () => {
    expect(findPositionedAncestor(null)).toBeNull();
  });

  it('returns the element itself if it has .absolute', () => {
    const el = mkEl({ classes: ['absolute'] });
    el._tag = 'div';
    expect(findPositionedAncestor(el)).toBe(el);
  });

  it('returns the nearest .absolute ancestor', () => {
    const outer = mkEl({ classes: ['absolute'] });
    outer._tag = 'div';
    const inner = mkEl({ parent: outer });
    inner._tag = 'p';
    expect(findPositionedAncestor(inner)).toBe(outer);
  });

  it('returns null when there is no positioned ancestor', () => {
    const el = mkEl();
    el._tag = 'p';
    expect(findPositionedAncestor(el)).toBeNull();
  });
});

describe('buildAbsoluteAttrString', () => {
  const dims = { left: 10.3, top: 20.7, width: 300.1, height: 200.9, rotation: 0 };

  it('emits all four position attrs by default and rounds to integers', () => {
    expect(buildAbsoluteAttrString(dims))
      .toBe('.absolute left=10px top=21px width=300px height=201px');
  });

  it('honours the include list (callout: no height)', () => {
    expect(buildAbsoluteAttrString(dims, { include: ['left', 'top', 'width'] }))
      .toBe('.absolute left=10px top=21px width=300px');
  });

  it('honours the include list (table/equation: only left+top)', () => {
    expect(buildAbsoluteAttrString(dims, { include: ['left', 'top'] }))
      .toBe('.absolute left=10px top=21px');
  });

  it('appends a style="transform: rotate(...)" when rotation is non-zero', () => {
    const rotated = { ...dims, rotation: 12 };
    expect(buildAbsoluteAttrString(rotated))
      .toBe('.absolute left=10px top=21px width=300px height=201px style="transform: rotate(12deg);"');
  });

  it('omits the style block when rotation is 0', () => {
    expect(buildAbsoluteAttrString(dims)).not.toContain('style=');
  });
});

describe('wrapLinesWithAbsoluteFence', () => {
  it('splices `::: {attrs}` and `:::` around the block', () => {
    const lines = ['a', 'b', 'c', 'd'];
    wrapLinesWithAbsoluteFence(lines, { startLine: 1, endLine: 2 }, '.absolute left=0px top=0px');
    expect(lines).toEqual([
      'a',
      '::: {.absolute left=0px top=0px}',
      'b',
      'c',
      ':::',
      'd',
    ]);
  });

  it('mutates in place', () => {
    const lines = ['x'];
    const ret = wrapLinesWithAbsoluteFence(lines, { startLine: 0, endLine: 0 }, '.absolute');
    expect(ret).toBeUndefined();
    expect(lines).toEqual(['::: {.absolute}', 'x', ':::']);
  });
});
