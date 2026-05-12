import { describe, it, expect, vi } from 'vitest';

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

import { extractPipeTables } from '../modify-mode.js';

describe('extractPipeTables', () => {
  it('extracts a single pipe table', () => {
    const tables = extractPipeTables('## Slide\n\n| A | B |\n|---|---|\n| 1 | 2 |\n');
    expect(tables).toHaveLength(1);
    expect(tables[0].headerLine).toBe('| A | B |');
    expect(tables[0].startLine).toBe(2);
    expect(tables[0].endLine).toBe(4);
  });

  it('extracts multiple tables separated by a blank line', () => {
    const src = '## Slide\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n| X | Y |\n|---|---|\n| 9 | 8 |\n';
    const tables = extractPipeTables(src);
    expect(tables).toHaveLength(2);
    expect(tables[0].headerLine).toBe('| A | B |');
    expect(tables[1].headerLine).toBe('| X | Y |');
  });

  it('ignores tables inside fenced code blocks', () => {
    const src = '## Slide\n\n```\n| A | B |\n|---|---|\n```\n';
    expect(extractPipeTables(src)).toHaveLength(0);
  });

  it('ignores tables already inside a fenced div', () => {
    const src = '## Slide\n\n::: {.absolute left=0px top=0px}\n| A | B |\n|---|---|\n| 1 | 2 |\n:::\n';
    expect(extractPipeTables(src)).toHaveLength(0);
  });

  it('requires a separator row to qualify as a table', () => {
    const src = '## Slide\n\n| A | B |\n| 1 | 2 |\n';
    expect(extractPipeTables(src)).toHaveLength(0);
  });

  it('handles separator with alignment colons', () => {
    const tables = extractPipeTables('## Slide\n\n| A | B |\n|:--|--:|\n| 1 | 2 |\n');
    expect(tables).toHaveLength(1);
  });
});
