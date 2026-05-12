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

import { extractDisplayEquations } from '../modify-mode.js';

describe('extractDisplayEquations', () => {
  it('extracts a single-line display equation', () => {
    const eqs = extractDisplayEquations('## Slide\n\n$$E = mc^2$$\n');
    expect(eqs).toHaveLength(1);
    expect(eqs[0].startLine).toBe(2);
    expect(eqs[0].endLine).toBe(2);
    expect(eqs[0].headerLine).toBe('$$E = mc^2$$');
  });

  it('extracts a multi-line display equation', () => {
    const src = '## Slide\n\n$$\na + b = c\n$$\n';
    const eqs = extractDisplayEquations(src);
    expect(eqs).toHaveLength(1);
    expect(eqs[0].startLine).toBe(2);
    expect(eqs[0].endLine).toBe(4);
    expect(eqs[0].headerLine).toBe('a + b = c');
  });

  it('extracts multiple display equations on the same slide', () => {
    const src = '## Slide\n\n$$a$$\n\n$$b$$\n';
    const eqs = extractDisplayEquations(src);
    expect(eqs).toHaveLength(2);
    expect(eqs[0].headerLine).toBe('$$a$$');
    expect(eqs[1].headerLine).toBe('$$b$$');
  });

  it('skips $$ inside fenced code blocks', () => {
    const src = '## Slide\n\n```\n$$x$$\n```\n';
    expect(extractDisplayEquations(src)).toHaveLength(0);
  });

  it('skips $$ inside :::  fenced divs', () => {
    const src = '## Slide\n\n::: {.note}\n$$x$$\n:::\n';
    expect(extractDisplayEquations(src)).toHaveLength(0);
  });

  it('ignores inline math ($...$)', () => {
    expect(extractDisplayEquations('## Slide\n\nInline $a+b$ here\n')).toHaveLength(0);
  });
});
