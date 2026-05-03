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

import { extractParagraphBlocks } from '../modify-mode.js';

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
});
