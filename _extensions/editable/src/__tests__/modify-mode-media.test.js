import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../editable-element.js', () => ({
  editableRegistry: {
    has: () => true,
    get: (el) => ({ toDimensions: () => el._dimensions ?? ({}) }),
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

import { makeMediaClassifier, mediaOccurrences, serializeRawMedia } from '../modify-mode.js';
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

  it('edits only the second same-source raw image and preserves fragments and classes', () => {
    const first = '<img src="plate.png" class="first fragment" data-fragment-index="1" alt="First">';
    const second = '<img src="plate.png" class="second fragment" data-fragment-index="2" alt="Second">';
    splitIntoSlideChunks.mockReturnValue(['preamble', `## A\n${first}\n${second}\n`]);
    const el = mkMedia({ tagName: 'img', src: 'plate.png' });
    el.dataset.editableModifiedOccurrence = '1';
    el._dimensions = { left: 24, top: -8, width: 230, height: 150 };
    const out = withDocument([el], () => buildClassifier('img').serialize('input'));
    expect(out).toContain(first);
    expect(out).toContain('class="second fragment" data-fragment-index="2" alt="Second"');
    expect(out).toContain('position: relative; left: 24px; top: -8px; width: 230px; height: 150px;');
    expect(out.match(/style=/g)).toHaveLength(1);
  });

  it('preserves video controls, autoplay and child sources across two saves', () => {
    const original = '<video class="fragment" data-autoplay controls poster="poster.png"><source src="movie.mp4" type="video/mp4"></video>';
    const dims = { left: 10, top: 20, width: 450, height: 280 };
    const first = serializeRawMedia(mediaOccurrences(original, 'video', 'movie.mp4')[0], dims, 'absolute');
    const second = serializeRawMedia(mediaOccurrences(first, 'video', 'movie.mp4')[0], { ...dims, left: 30, width: 510 }, 'absolute');
    expect(second).toContain('class="fragment" data-autoplay controls poster="poster.png"');
    expect(second).toContain('<source src="movie.mp4" type="video/mp4">');
    expect(second).toContain('position: absolute; left: 30px; top: 20px; width: 510px; height: 280px;');
    expect(second.match(/style=/g)).toHaveLength(1);
  });

  it('matches encoded source URLs and preserves authored image styles', () => {
    const source = '<img src="image.png?a=1&amp;b=2" style="object-fit: contain; border: 1px solid red;" data-fragment-index="3">';
    const occurrence = mediaOccurrences(source, 'img', 'image.png?a=1&b=2')[0];
    const out = serializeRawMedia(occurrence, { left: 1, top: 2, width: 300, height: 200 });
    expect(out).toContain('src="image.png?a=1&amp;b=2"');
    expect(out).toContain('object-fit: contain; border: 1px solid red;');
    expect(out).toContain('data-fragment-index="3"');
  });

  it('keeps rotation and flips stable after reloading edited raw media', () => {
    const source = '<img src="pic.png" style="transform: translateX(-50%) rotate(15deg) scaleX(-1);">';
    const first = serializeRawMedia(mediaOccurrences(source, 'img', 'pic.png')[0], { rotation: 15, flipH: true });
    const second = serializeRawMedia(mediaOccurrences(first, 'img', 'pic.png')[0], { rotation: 15, flipH: true });
    expect(second).toBe(first);
    expect(second).toContain('transform: translateX(-50%) rotate(15deg) scaleX(-1);');
  });

  it('fails explicitly when the activated source occurrence is absent', () => {
    splitIntoSlideChunks.mockReturnValue(['preamble', '## A\n<img src="other.png">\n']);
    const el = mkMedia({ tagName: 'img', src: 'pic.png' });
    expect(() => withDocument([el], () => buildClassifier('img').serialize('input')))
      .toThrow('Cannot locate editable img: pic.png occurrence 1');
  });
});
