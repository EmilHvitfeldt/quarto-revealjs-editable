import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../editable-element.js', () => ({
  editableRegistry: {
    has: () => true,
    get: () => ({ toDimensions: () => ({}) }),
  },
}));
vi.mock('../element-setup.js', () => ({
  setupImageWhenReady: vi.fn(),
  setupDivWhenReady: vi.fn(),
  setupVideoWhenReady: vi.fn(),
  setupDraggableElt: vi.fn(),
}));
vi.mock('../toolbar.js', () => ({ showRightPanel: vi.fn() }));
vi.mock('../serialization.js', () => ({
  splitIntoSlideChunks: vi.fn(),
  // Return a stable attr suffix so we can assert byte-equality across the
  // Images and Videos paths for the same logical input.
  serializeToQmd: vi.fn(() => '{width=300px}'),
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

import { makeMediaClassifier } from '../modify-mode.js';
import { splitIntoSlideChunks } from '../serialization.js';
import { getQmdHeadingIndex } from '../utils.js';

// Fake DOM element: only models the surface area the factory touches in
// serialize() — dataset, compareDocumentPosition, and being returned by
// document.querySelectorAll on the right selector.
function mkMedia({ tagName, src, slide = 0, order = 0 }) {
  const el = {
    tagName: tagName.toUpperCase(),
    dataset: {
      editableModifiedSrc: src,
      editableModifiedSlide: String(slide),
      editableModified: 'true',
    },
    _order: order,
    compareDocumentPosition(other) {
      // 4 === Node.DOCUMENT_POSITION_FOLLOWING
      return this._order < other._order ? 4 : 0;
    },
  };
  return el;
}

function withDocument(elements, fn) {
  const origDoc = globalThis.document;
  const origNode = globalThis.Node;
  globalThis.Node = { DOCUMENT_POSITION_FOLLOWING: 4 };
  globalThis.document = {
    querySelectorAll: (selector) =>
      elements.filter(el =>
        selector.toLowerCase().startsWith(el.tagName.toLowerCase() + '[')
      ),
  };
  try {
    return fn();
  } finally {
    globalThis.document = origDoc;
    globalThis.Node = origNode;
  }
}

describe('makeMediaClassifier serialize()', () => {
  beforeEach(() => {
    splitIntoSlideChunks.mockReset();
    getQmdHeadingIndex.mockReset();
    getQmdHeadingIndex.mockImplementation((n) => n);
  });

  function buildClassifier(tagName) {
    return makeMediaClassifier({
      tagName,
      label: tagName,
      getSrc: () => null,
      setupFn: vi.fn(),
      classify: () => ({ valid: [], warn: [] }),
    });
  }

  it('rewrites a single ](src) occurrence with the dimensions suffix', () => {
    splitIntoSlideChunks.mockReturnValue(['preamble', '## A\nText ![](pic.png) more\n']);
    const cls = buildClassifier('img');
    const el = mkMedia({ tagName: 'img', src: 'pic.png', slide: 0, order: 0 });
    const out = withDocument([el], () => cls.serialize('whatever'));
    expect(out).toBe('preamble## A\nText ![](pic.png){width=300px} more\n');
  });

  it('handles two same-src occurrences in DOM order', () => {
    splitIntoSlideChunks.mockReturnValue([
      'preamble',
      '## A\n![](pic.png) then ![](pic.png)\n',
    ]);
    const cls = buildClassifier('img');
    const first  = mkMedia({ tagName: 'img', src: 'pic.png', slide: 0, order: 0 });
    const second = mkMedia({ tagName: 'img', src: 'pic.png', slide: 0, order: 1 });
    const out = withDocument([second, first], () => cls.serialize('whatever'));
    // Both occurrences should be rewritten; sort is by DOM order, both yield
    // the same `{width=300px}` suffix in this test, so the output is symmetric.
    expect(out).toBe('preamble## A\n![](pic.png){width=300px} then ![](pic.png){width=300px}\n');
  });

  it('skips elements whose chunk index lands past the end of chunks', () => {
    splitIntoSlideChunks.mockReturnValue(['preamble']);
    const cls = buildClassifier('img');
    const el = mkMedia({ tagName: 'img', src: 'pic.png', slide: 5, order: 0 });
    const out = withDocument([el], () => cls.serialize('preamble'));
    expect(out).toBe('preamble');
  });

  it('produces identical serialize output for the Images and Videos shapes', () => {
    // Same logical input — different tagName/selector — must yield byte-identical
    // QMD output. Regression check for the D1 merge.
    const inputChunks = () => ['preamble', '## A\n![](media.src){existing} text\n'];
    splitIntoSlideChunks.mockImplementation(inputChunks);

    const imgCls = buildClassifier('img');
    const videoCls = buildClassifier('video');

    const imgEl   = mkMedia({ tagName: 'img',   src: 'media.src', slide: 0 });
    const videoEl = mkMedia({ tagName: 'video', src: 'media.src', slide: 0 });

    const imgOut   = withDocument([imgEl],   () => imgCls.serialize('input'));
    const videoOut = withDocument([videoEl], () => videoCls.serialize('input'));

    expect(imgOut).toBe(videoOut);
    expect(imgOut).toContain('](media.src){width=300px}');
    // Existing `{existing}` attr block is replaced, not preserved alongside.
    expect(imgOut).not.toContain('{existing}');
  });
});
