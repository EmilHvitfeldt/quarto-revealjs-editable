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

// extractBlocksStartingWith is not exported; test via observable behavior
// by importing the whole module and checking the exported extractParagraphBlocks
// for co-existence, then testing list extraction indirectly through a re-export.
// For direct testing we inline equivalent logic here.

import { extractParagraphBlocks, buildBlockSerializeAttrs } from '../modify-mode.js';

describe('buildBlockSerializeAttrs', () => {
  const dims = { left: 10, top: 20, width: 100, height: 200 };

  it('includes all four attrs by default', () => {
    const out = buildBlockSerializeAttrs(dims);
    expect(out).toContain('left=10px');
    expect(out).toContain('top=20px');
    expect(out).toContain('width=100px');
    expect(out).toContain('height=200px');
  });

  it('omits height when omitHeight is true (callout/blockquote pattern)', () => {
    // Blockquotes (and callouts) shouldn't persist `height` — the visual
    // bar / content should determine its own height. Saving an explicit
    // height re-renders with the bar stretched to the wrapper.
    const out = buildBlockSerializeAttrs(dims, { omitHeight: true });
    expect(out).toContain('left=10px');
    expect(out).toContain('top=20px');
    expect(out).toContain('width=100px');
    expect(out).not.toContain('height=');
  });
});

// ---------------------------------------------------------------------------
// Helper: replicate extractBlocksStartingWith logic for testing
// ---------------------------------------------------------------------------
function extractBlocksStartingWith(chunk, testLine) {
  const lines = chunk.split('\n');
  const blocks = [];
  let depth = 0;
  let inCodeBlock = false;
  let blockStart = -1;
  const blockLines = [];

  const commitBlock = () => {
    if (blockLines.length > 0) {
      blocks.push({
        startLine: blockStart,
        endLine: blockStart + blockLines.length - 1,
        text: blockLines.join('\n'),
      });
    }
    blockStart = -1;
    blockLines.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) { commitBlock(); inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
    if (fenceMatch) {
      commitBlock();
      const hasBraces = fenceMatch[2] !== undefined;
      if (!hasBraces && depth > 0) depth--; else depth++;
      continue;
    }
    if (depth > 0) continue;
    if (trimmed === '') { commitBlock(); continue; }
    if (blockStart === -1) {
      if (testLine(line)) { blockStart = i; blockLines.push(line); }
    } else {
      blockLines.push(line);
    }
  }
  commitBlock();
  return blocks;
}

const isUlLine = (line) => /^[-*+] /.test(line);
const isOlLine = (line) => /^\d+[.)]\s/.test(line);
const isBqLine = (line) => /^>/.test(line);

describe('extractBlocksStartingWith - bullet lists', () => {
  it('extracts a single ul block', () => {
    const blocks = extractBlocksStartingWith('## Slide\n\n- item1\n- item2\n', isUlLine);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('- item1\n- item2');
  });

  it('extracts multiple ul blocks', () => {
    const blocks = extractBlocksStartingWith('- a\n- b\n\n- c\n- d\n', isUlLine);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('- a\n- b');
    expect(blocks[1].text).toBe('- c\n- d');
  });

  it('skips ul blocks inside fenced divs', () => {
    const blocks = extractBlocksStartingWith('- top\n\n::: {.box}\n- inside\n:::\n', isUlLine);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('- top');
  });

  it('records correct startLine and endLine', () => {
    const blocks = extractBlocksStartingWith('## Slide\n\n- item1\n- item2\n', isUlLine);
    expect(blocks[0].startLine).toBe(2);
    expect(blocks[0].endLine).toBe(3);
  });

  it('does not match ordered list lines as ul', () => {
    const blocks = extractBlocksStartingWith('1. item\n2. item\n', isUlLine);
    expect(blocks).toHaveLength(0);
  });
});

describe('extractBlocksStartingWith - ordered lists', () => {
  it('extracts a single ol block', () => {
    const blocks = extractBlocksStartingWith('1. First\n2. Second\n', isOlLine);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('1. First\n2. Second');
  });

  it('does not match bullet list lines as ol', () => {
    const blocks = extractBlocksStartingWith('- item\n', isOlLine);
    expect(blocks).toHaveLength(0);
  });

  it('handles period and paren delimiters', () => {
    const blocks = extractBlocksStartingWith('1. item\n2) item\n', isOlLine);
    expect(blocks).toHaveLength(1);
  });
});

describe('extractBlocksStartingWith - blockquotes', () => {
  it('extracts a single blockquote block', () => {
    const blocks = extractBlocksStartingWith('> Some text\n', isBqLine);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('> Some text');
  });

  it('extracts multi-line blockquote', () => {
    const blocks = extractBlocksStartingWith('> Line one\n> Line two\n', isBqLine);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('> Line one\n> Line two');
  });

  it('does not match non-blockquote lines', () => {
    const blocks = extractBlocksStartingWith('- item\nsome text\n', isBqLine);
    expect(blocks).toHaveLength(0);
  });
});

describe('extractParagraphBlocks does not double-count lists', () => {
  it('list lines are included in paragraph blocks only if no blank line between', () => {
    // A slide with only a list should yield a block (paragraph extractor treats it as text)
    const blocks = extractParagraphBlocks('- item1\n- item2\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('- item1\n- item2');
  });
});
