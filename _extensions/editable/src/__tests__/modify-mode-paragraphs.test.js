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
}));
vi.mock('../utils.js', () => ({ getQmdHeadingIndex: vi.fn(), getSlideScale: vi.fn() }));
vi.mock('../colors.js', () => ({ getColorPalette: vi.fn(() => []), getBrandColorOutput: vi.fn() }));
vi.mock('../capabilities.js', () => ({ setCapabilityOverride: vi.fn() }));
vi.mock('../quill.js', () => ({ quillInstances: new Map(), initializeQuillForElement: vi.fn() }));

import { extractParagraphBlocks, assignStableParagraphIndices, isParagraphCandidate } from '../modify-mode.js';

// Minimal DOM-ish element for testing the paragraph candidate predicate.
const makeEl = ({ tagName = 'P', classes = [], descendants = {} } = {}) => ({
  tagName,
  classList: { contains: (c) => classes.includes(c) },
  querySelector: (sel) => descendants[sel] ?? null,
});

describe('isParagraphCandidate', () => {
  it('accepts a plain <p>', () => {
    expect(isParagraphCandidate(makeEl())).toBe(true);
  });

  it('rejects non-<p> elements', () => {
    expect(isParagraphCandidate(makeEl({ tagName: 'DIV' }))).toBe(false);
  });

  it('rejects <p> containing an img', () => {
    expect(isParagraphCandidate(makeEl({ descendants: { img: {} } }))).toBe(false);
  });

  it('rejects <p> containing a display equation', () => {
    expect(isParagraphCandidate(makeEl({ descendants: { 'span.math.display': {} } }))).toBe(false);
  });

  it('rejects code-chunk fig-cap (<p class="caption">)', () => {
    // Bug: Quarto renders `fig-cap: "A plot"` as `<p class="caption">A plot</p>`
    // as a direct slide child, so the Paragraphs classifier was treating it
    // as a standalone editable paragraph.
    expect(isParagraphCandidate(makeEl({ classes: ['caption'] }))).toBe(false);
  });

  it('rejects figure-caption variant class', () => {
    expect(isParagraphCandidate(makeEl({ classes: ['figure-caption'] }))).toBe(false);
  });
});

const makeP = (existingIdx) => ({
  dataset: existingIdx === undefined ? {} : { editableModifiedParagraphIdx: String(existingIdx) },
});

describe('assignStableParagraphIndices', () => {
  it('assigns 0..n on fresh paragraphs', () => {
    const ps = [makeP(), makeP(), makeP()];
    assignStableParagraphIndices(ps);
    expect(ps.map(p => p.dataset.editableModifiedParagraphIdx)).toEqual(['0', '1', '2']);
  });

  it('does not overwrite existing indices', () => {
    const ps = [makeP(0), makeP(), makeP()];
    assignStableParagraphIndices(ps);
    expect(ps.map(p => p.dataset.editableModifiedParagraphIdx)).toEqual(['0', '1', '2']);
  });

  it('indices stay stable across multiple classify passes', () => {
    // Simulates the bug: after activating p0, classify re-runs over [p0, p1].
    // p1 must keep idx 1, not be reset to 0.
    const p0 = makeP();
    const p1 = makeP();
    assignStableParagraphIndices([p0, p1]);
    expect(p1.dataset.editableModifiedParagraphIdx).toBe('1');
    // re-run (e.g. user toggles modify mode again)
    assignStableParagraphIndices([p0, p1]);
    expect(p0.dataset.editableModifiedParagraphIdx).toBe('0');
    expect(p1.dataset.editableModifiedParagraphIdx).toBe('1');
  });
});

describe('extractParagraphBlocks', () => {
  it('extracts a single paragraph', () => {
    const blocks = extractParagraphBlocks('## Slide\n\nHello world\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('Hello world');
  });

  it('extracts multiple paragraphs', () => {
    const blocks = extractParagraphBlocks('## Slide\n\nFirst paragraph\n\nSecond paragraph\n');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('First paragraph');
    expect(blocks[1].text).toBe('Second paragraph');
  });

  it('skips paragraphs inside fenced divs', () => {
    const blocks = extractParagraphBlocks('## Slide\n\nTop level\n\n::: {.box}\nInside fence\n:::\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('Top level');
  });

  it('skips headings', () => {
    const blocks = extractParagraphBlocks('## Slide title\n\nParagraph text\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('Paragraph text');
  });

  it('handles multi-line paragraphs', () => {
    const blocks = extractParagraphBlocks('Line one\nLine two\nLine three\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('Line one\nLine two\nLine three');
    expect(blocks[0].startLine).toBe(0);
    expect(blocks[0].endLine).toBe(2);
  });

  it('skips content inside code blocks', () => {
    const blocks = extractParagraphBlocks('Intro\n\n```r\ncode here\n```\n\nAfter code\n');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('Intro');
    expect(blocks[1].text).toBe('After code');
  });

  it('returns empty array for chunk with no paragraphs', () => {
    const blocks = extractParagraphBlocks('## Just a heading\n\n::: {.foo}\nsome content\n:::\n');
    expect(blocks).toHaveLength(0);
  });

  it('records correct startLine and endLine', () => {
    const blocks = extractParagraphBlocks('## Slide\n\nFirst\n\nSecond\n');
    expect(blocks[0].startLine).toBe(2);
    expect(blocks[0].endLine).toBe(2);
    expect(blocks[1].startLine).toBe(4);
    expect(blocks[1].endLine).toBe(4);
  });

  it('skips standalone image-only paragraph blocks', () => {
    const blocks = extractParagraphBlocks('Text para\n\n![](img.png)\n\nAnother text\n');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('Text para');
    expect(blocks[1].text).toBe('Another text');
  });

  it('skips paragraph blocks containing inline images', () => {
    const blocks = extractParagraphBlocks('Plain text\n\nInline ![](img.png){width=80px} image text\n\nLast\n');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('Plain text');
    expect(blocks[1].text).toBe('Last');
  });
});
