import { describe, it, expect, vi } from 'vitest';

vi.mock('../editable-element.js', () => ({ editableRegistry: { has: () => false, get: () => null } }));
vi.mock('../element-setup.js', () => ({
  setupImageWhenReady: vi.fn(),
  setupDivWhenReady: vi.fn(),
  setupVideoWhenReady: vi.fn(),
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

import { extractCodeBlocks, findChunkFigureCaption } from '../modify-mode.js';

describe('extractCodeBlocks', () => {
  it('extracts a single highlighted code block', () => {
    const blocks = extractCodeBlocks('## Slide\n\n```python\nx = 1\n```\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].firstCodeLine).toBe('x = 1');
    expect(blocks[0].startLine).toBe(2);
    expect(blocks[0].endLine).toBe(4);
  });

  it('extracts a plain (no-language) code block', () => {
    const blocks = extractCodeBlocks('## Slide\n\n```\nplain\nmore\n```\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].firstCodeLine).toBe('plain');
  });

  it('extracts multiple code blocks on the same slide', () => {
    const blocks = extractCodeBlocks(
      '## Slide\n\n```python\na = 1\n```\n\n```r\nb <- 2\n```\n'
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].firstCodeLine).toBe('a = 1');
    expect(blocks[1].firstCodeLine).toBe('b <- 2');
  });

  it('skips code blocks already inside a fenced div', () => {
    const blocks = extractCodeBlocks(
      '## Slide\n\n::: {.absolute}\n```python\nx = 1\n```\n:::\n'
    );
    expect(blocks).toHaveLength(0);
  });

  it('picks the first non-empty line as anchor (skipping blank lines)', () => {
    const blocks = extractCodeBlocks('## Slide\n\n```python\n\n\nfoo = 1\n```\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].firstCodeLine).toBe('foo = 1');
  });

  it('returns empty array when chunk has no code blocks', () => {
    expect(extractCodeBlocks('## Slide\n\nJust text\n')).toHaveLength(0);
  });

  it('handles a fenced div followed by a top-level code block', () => {
    const blocks = extractCodeBlocks(
      '## Slide\n\n::: {.note}\nhi\n:::\n\n```python\nz = 1\n```\n'
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].firstCodeLine).toBe('z = 1');
  });
});

describe('findChunkFigureCaption', () => {
  // No jsdom in this test suite — fake the minimal element shape the helper
  // inspects (`nextElementSibling`, `tagName`, `classList.contains`).
  function makeImg(next) {
    return { nextElementSibling: next };
  }
  function makeEl(tag, classes = [], text = '') {
    return {
      tagName: tag.toUpperCase(),
      classList: { contains: (c) => classes.includes(c) },
      textContent: text,
    };
  }

  it('returns the immediate <p class="caption"> sibling', () => {
    const cap = makeEl('p', ['caption'], 'A plot');
    expect(findChunkFigureCaption(makeImg(cap))).toBe(cap);
  });

  it('returns the immediate <p class="figure-caption"> sibling', () => {
    const cap = makeEl('p', ['figure-caption'], 'Caption');
    expect(findChunkFigureCaption(makeImg(cap))).toBe(cap);
  });

  it('returns null when next sibling is a non-caption <p>', () => {
    expect(findChunkFigureCaption(makeImg(makeEl('p', [], 'regular')))).toBeNull();
  });

  it('returns null when next sibling is not a <p>', () => {
    expect(findChunkFigureCaption(makeImg(makeEl('div', ['caption'])))).toBeNull();
  });

  it('returns null when img has no next element sibling', () => {
    expect(findChunkFigureCaption(makeImg(null))).toBeNull();
  });
});
