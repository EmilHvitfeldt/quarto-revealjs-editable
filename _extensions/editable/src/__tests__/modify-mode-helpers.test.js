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
vi.mock('../utils.js', () => ({
  getQmdHeadingIndex: vi.fn(),
  getSlideScale: vi.fn(),
  escapeRegex: (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
}));
vi.mock('../colors.js', () => ({ getColorPalette: vi.fn(() => []), getBrandColorOutput: vi.fn() }));
vi.mock('../capabilities.js', () => ({ setCapabilityOverride: vi.fn() }));
vi.mock('../quill.js', () => ({ quillInstances: new Map(), initializeQuillForElement: vi.fn() }));
vi.mock('../arrows.js', () => ({ createArrowElement: vi.fn(), setActiveArrow: vi.fn() }));

import {
  isAlreadyPositioned,
  findPositionedAncestor,
  buildAbsoluteAttrString,
  wrapLinesWithAbsoluteFence,
  sortByIndexAttr,
  forEachInReverse,
  captureSlideRelativePosition,
  lockNaturalDimensions,
  groupModifiedElementsByChunk,
  resolveByHeader,
  resolveByLabel,
  findTopLevelWrappers,
  topLevelAncestorIn,
} from '../modify-mode.js';
import { splitIntoSlideChunks } from '../serialization.js';
import { getQmdHeadingIndex, getSlideScale } from '../utils.js';
import { editableRegistry } from '../editable-element.js';

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

describe('sortByIndexAttr', () => {
  it('sorts elements ascending by parsed dataset integer', () => {
    const els = [
      { dataset: { idx: '2' } },
      { dataset: { idx: '0' } },
      { dataset: { idx: '10' } },
      { dataset: { idx: '1' } },
    ];
    sortByIndexAttr(els, 'idx');
    expect(els.map(e => e.dataset.idx)).toEqual(['0', '1', '2', '10']);
  });

  it('treats missing attr as 0', () => {
    const els = [
      { dataset: { idx: '3' } },
      { dataset: {} },
      { dataset: { idx: '1' } },
    ];
    sortByIndexAttr(els, 'idx');
    expect(els.map(e => e.dataset.idx ?? 'missing')).toEqual(['missing', '1', '3']);
  });
});

describe('forEachInReverse', () => {
  it('invokes fn from last to first', () => {
    const seen = [];
    forEachInReverse(['a', 'b', 'c'], (item, i) => seen.push([item, i]));
    expect(seen).toEqual([['c', 2], ['b', 1], ['a', 0]]);
  });

  it('keeps splice indices stable when used to mutate a parallel array', () => {
    const lines = ['L0', 'L1', 'L2', 'L3'];
    const items = [{ at: 0 }, { at: 2 }];
    forEachInReverse(items, ({ at }) => lines.splice(at, 1, 'X', 'Y'));
    // Both splices should land at their original positions, not shifted by
    // earlier inserts.
    expect(lines).toEqual(['X', 'Y', 'L1', 'X', 'Y', 'L3']);
  });

  it('handles empty arrays without invoking fn', () => {
    const fn = vi.fn();
    forEachInReverse([], fn);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('captureSlideRelativePosition', () => {
  beforeEach(() => {
    getSlideScale.mockReset();
    getSlideScale.mockReturnValue(2);
  });

  function elWith({ rect, slideRect, inner }) {
    const slide = slideRect
      ? { getBoundingClientRect: () => slideRect, _tag: 'section', classList: { contains: () => false } }
      : null;
    const el = {
      getBoundingClientRect: () => rect,
      _tag: 'div',
      classList: { contains: () => false },
      closest: (sel) => (sel === 'section' ? slide : null),
    };
    if (inner) el._inner = inner;
    return el;
  }

  it('returns scaled slide-relative position', () => {
    const el = elWith({
      rect: { left: 200, top: 300, width: 400, height: 200 },
      slideRect: { left: 100, top: 100 },
    });
    const out = captureSlideRelativePosition(el);
    expect(out.left).toBe(50);    // (200 - 100) / 2
    expect(out.top).toBe(100);    // (300 - 100) / 2
    expect(out.width).toBe(200);  // 400 / 2
    expect(out.height).toBe(100); // 200 / 2
    expect(out.scale).toBe(2);
  });

  it('falls back to {0,0} slideRect when there is no section ancestor', () => {
    const el = elWith({
      rect: { left: 50, top: 80, width: 100, height: 40 },
      slideRect: null,
    });
    const out = captureSlideRelativePosition(el);
    expect(out.left).toBe(25);
    expect(out.top).toBe(40);
  });

  it('measures from rectSource when provided (equation inner-math anchor)', () => {
    const inner = {
      getBoundingClientRect: () => ({ left: 250, top: 350, width: 80, height: 30 }),
    };
    const el = elWith({
      rect: { left: 200, top: 300, width: 400, height: 200 },
      slideRect: { left: 100, top: 100 },
    });
    const out = captureSlideRelativePosition(el, { rectSource: inner });
    expect(out.left).toBe(75);   // (250 - 100) / 2
    expect(out.top).toBe(125);   // (350 - 100) / 2
    expect(out.width).toBe(40);
    expect(out.height).toBe(15);
  });
});

describe('lockNaturalDimensions', () => {
  beforeEach(() => {
    getSlideScale.mockReset();
    getSlideScale.mockReturnValue(2);
    // jsdom-free getComputedStyle stub
    if (typeof globalThis.window === 'undefined') globalThis.window = {};
    globalThis.window.getComputedStyle = () => ({
      paddingLeft: '4px',
      paddingRight: '4px',
      paddingTop: '2px',
      paddingBottom: '2px',
    });
  });

  it('writes scaled width/height and copied padding, zeroes margin', () => {
    const style = {};
    const el = {
      getBoundingClientRect: () => ({ width: 400, height: 200 }),
      style,
    };
    lockNaturalDimensions(el);
    expect(style.width).toBe('200px');
    expect(style.height).toBe('100px');
    expect(style.paddingLeft).toBe('4px');
    expect(style.paddingTop).toBe('2px');
    expect(style.margin).toBe('0');
    expect(style.display).toBeUndefined();
  });

  it('sets display when displayOverride is passed', () => {
    const style = {};
    const el = {
      getBoundingClientRect: () => ({ width: 100, height: 50 }),
      style,
    };
    lockNaturalDimensions(el, 'block');
    expect(style.display).toBe('block');
  });
});

describe('groupModifiedElementsByChunk', () => {
  beforeEach(() => {
    splitIntoSlideChunks.mockReset();
    getQmdHeadingIndex.mockReset();
    splitIntoSlideChunks.mockReturnValue(['preamble', '## A\n', '## B\n', '## C\n']);
    // slide index N → chunk N+1 (i.e. getQmdHeadingIndex(N) === N)
    getQmdHeadingIndex.mockImplementation((n) => n);
    // Pretend all elements are in the registry.
    editableRegistry.has = () => true;
  });

  function modEl(slide) {
    return { dataset: { editableModifiedSlide: String(slide) } };
  }

  it('groups elements by their source-chunk index', () => {
    const a = modEl(0); // chunk 1
    const b = modEl(0); // chunk 1
    const c = modEl(1); // chunk 2
    const { chunks, byChunk } = groupModifiedElementsByChunk([a, b, c], 'ignored');
    expect(chunks).toHaveLength(4);
    expect(byChunk.get(1)).toEqual([a, b]);
    expect(byChunk.get(2)).toEqual([c]);
  });

  it('skips elements not in editableRegistry', () => {
    editableRegistry.has = (el) => el !== 'orphan';
    const a = modEl(0);
    const { byChunk } = groupModifiedElementsByChunk(['orphan', a], 'ignored');
    expect(byChunk.get(1)).toEqual([a]);
  });

  it('skips elements whose chunk index runs past the chunk array', () => {
    const a = modEl(99);
    const { byChunk } = groupModifiedElementsByChunk([a], 'ignored');
    expect(byChunk.size).toBe(0);
  });

  it('treats missing slide attr as slide 0', () => {
    const a = { dataset: {} };
    const { byChunk } = groupModifiedElementsByChunk([a], 'ignored');
    expect(byChunk.get(1)).toEqual([a]);
  });
});

describe('resolveByHeader', () => {
  const sources = [
    { headerLine: '| A | B |', startLine: 0 },
    { headerLine: '| C | D |', startLine: 5 },
    { headerLine: '| E | F |', startLine: 10 },
  ];

  function el(header, idx) {
    return { dataset: { hdr: header, idx: String(idx) } };
  }

  it('prefers the header anchor when it is unique', () => {
    const resolved = resolveByHeader({
      chunkEls: [el('| C | D |', 99)],
      sources,
      getHeader: (s) => s.headerLine,
      headerAttr: 'hdr',
      idxAttr: 'idx',
    });
    expect(resolved[0]).toBe(sources[1]);
  });

  it('falls back to positional index when the header is duplicated', () => {
    const dupSources = [
      { headerLine: '| A | B |', startLine: 0 },
      { headerLine: '| A | B |', startLine: 5 },
    ];
    const resolved = resolveByHeader({
      chunkEls: [el('| A | B |', 1)],
      sources: dupSources,
      getHeader: (s) => s.headerLine,
      headerAttr: 'hdr',
      idxAttr: 'idx',
    });
    expect(resolved[0]).toBe(dupSources[1]);
  });

  it('falls back to positional index when the header attr is missing', () => {
    const resolved = resolveByHeader({
      chunkEls: [{ dataset: { idx: '2' } }],
      sources,
      getHeader: (s) => s.headerLine,
      headerAttr: 'hdr',
      idxAttr: 'idx',
    });
    expect(resolved[0]).toBe(sources[2]);
  });

  it('returns null when neither anchor resolves', () => {
    const resolved = resolveByHeader({
      chunkEls: [{ dataset: { hdr: 'not-in-sources', idx: '99' } }],
      sources,
      getHeader: (s) => s.headerLine,
      headerAttr: 'hdr',
      idxAttr: 'idx',
    });
    expect(resolved[0]).toBeNull();
  });
});

describe('resolveByLabel', () => {
  const sources = [
    { label: '',         firstCodeLine: 'plot1' },
    { label: 'named',    firstCodeLine: 'plot2' },
    { label: 'other',    firstCodeLine: 'plot3' },
  ];
  const opts = {
    getLabel: (s) => s.label,
    getFirstLine: (s) => s.firstCodeLine,
    labelAttr: 'lbl',
    firstLineAttr: 'first',
    idxAttr: 'idx',
  };

  it('matches by label when present', () => {
    const el = { dataset: { lbl: 'named', idx: '0' } };
    expect(resolveByLabel(el, sources, opts)).toBe(sources[1]);
  });

  it('falls back to positional when label is empty', () => {
    const el = { dataset: { lbl: '', idx: '2', first: 'plot3' } };
    expect(resolveByLabel(el, sources, opts)).toBe(sources[2]);
  });

  it('rejects positional match if the first-line guard mismatches', () => {
    const el = { dataset: { lbl: '', idx: '2', first: 'different' } };
    expect(resolveByLabel(el, sources, opts)).toBeNull();
  });

  it('accepts positional match when either side has no first-line text', () => {
    const el = { dataset: { lbl: '', idx: '2', first: '' } };
    expect(resolveByLabel(el, sources, opts)).toBe(sources[2]);
  });

  it('returns null when label is unknown and idx is out of range', () => {
    const el = { dataset: { lbl: 'nope', idx: '99' } };
    expect(resolveByLabel(el, sources, opts)).toBeNull();
  });
});

describe('topLevelAncestorIn / findTopLevelWrappers', () => {
  beforeEach(() => {
    // The groupModifiedElementsByChunk suite mutates editableRegistry.has; reset.
    editableRegistry.has = () => false;
  });

  function mkNode(tag, classes = []) {
    return {
      tagName: tag.toUpperCase(),
      classList: { contains: (c) => classes.includes(c) },
      parentElement: null,
    };
  }

  function tree() {
    // section > div(wrapper) > pre
    // section > pre2 (top-level direct)
    const slide = mkNode('section');
    const wrapper = mkNode('div');
    wrapper.parentElement = slide;
    const pre = mkNode('pre');
    pre.parentElement = wrapper;
    const pre2 = mkNode('pre');
    pre2.parentElement = slide;
    slide._children = [wrapper, pre2];
    wrapper._children = [pre];
    return { slide, wrapper, pre, pre2 };
  }

  it('topLevelAncestorIn walks up to the slide-direct child', () => {
    const { slide, wrapper, pre } = tree();
    expect(topLevelAncestorIn(slide, pre)).toBe(wrapper);
  });

  it('topLevelAncestorIn returns el itself when already a direct child', () => {
    const { slide, pre2 } = tree();
    expect(topLevelAncestorIn(slide, pre2)).toBe(pre2);
  });

  it('findTopLevelWrappers dedupes and applies post-filter', () => {
    const { slide, wrapper, pre, pre2 } = tree();
    // Stub slideEl.querySelectorAll to return the inner elements we want walked.
    slide.querySelectorAll = (sel) => sel === 'pre' ? [pre, pre2] : [];
    const wrappers = findTopLevelWrappers(slide, 'pre');
    expect(wrappers).toEqual([wrapper, pre2]);
  });

  it('findTopLevelWrappers honours preFilter (e.g. tables-in-cell skip)', () => {
    const { slide, wrapper, pre, pre2 } = tree();
    slide.querySelectorAll = () => [pre, pre2];
    const wrappers = findTopLevelWrappers(slide, 'pre', {
      preFilter: (inner) => inner !== pre, // drop the wrapped pre
    });
    expect(wrappers).toEqual([pre2]);
  });

  it('findTopLevelWrappers honours postFilter (e.g. equations require display container)', () => {
    const { slide, wrapper, pre, pre2 } = tree();
    slide.querySelectorAll = () => [pre, pre2];
    const wrappers = findTopLevelWrappers(slide, 'pre', {
      postFilter: (w) => w === wrapper, // drop pre2 wrapper
    });
    expect(wrappers).toEqual([wrapper]);
  });
});
