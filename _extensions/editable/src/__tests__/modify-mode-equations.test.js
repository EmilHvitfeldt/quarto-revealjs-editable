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

import { extractDisplayEquations, pickEquationRenderNode } from '../modify-mode.js';

describe('pickEquationRenderNode', () => {
  // Returns a fake DOM-ish element that maps querySelector(sel) → preset hit.
  const makeEl = (hits) => ({
    querySelector(sel) { return hits[sel] ?? null; },
  });

  it('returns null when no selectors match', () => {
    expect(pickEquationRenderNode(makeEl({}))).toBe(null);
  });

  it('prefers mjx-container over span.math.display', () => {
    // Bug case: real DOM has both; default ", "-joined querySelector
    // returns the outer (full-width) span.math.display first because it
    // appears earlier in document order. We need the rendered inline-block
    // node to measure the visible math, not the full-width source wrapper.
    const mjx = { tag: 'mjx-container' };
    const mathSpan = { tag: 'span.math.display' };
    const el = makeEl({
      'mjx-container': mjx,
      'span.math.display': mathSpan,
    });
    expect(pickEquationRenderNode(el)).toBe(mjx);
  });

  it('prefers .katex-display over span.math.display', () => {
    const katex = { tag: 'katex-display' };
    const mathSpan = { tag: 'span.math.display' };
    const el = makeEl({
      '.katex-display': katex,
      'span.math.display': mathSpan,
    });
    expect(pickEquationRenderNode(el)).toBe(katex);
  });

  it('falls back to span.math.display when no render output is present', () => {
    const mathSpan = { tag: 'span.math.display' };
    const el = makeEl({ 'span.math.display': mathSpan });
    expect(pickEquationRenderNode(el)).toBe(mathSpan);
  });

  it('prefers .MathJax_Display .MathJax (visible glyphs) over .MathJax_Display (centering wrapper)', () => {
    // MathJax v2 renders the glyphs in `<span class="MathJax">` inside the
    // full-width `<div class="MathJax_Display">`. Measuring _Display gives
    // the slide-left edge (= 0 in element-space); measuring the inner
    // .MathJax span gives the actual visible math position, which is what
    // we need for round-trip save.
    const glyphs = { tag: 'span.MathJax' };
    const wrapper = { tag: 'div.MathJax_Display' };
    const el = makeEl({
      '.MathJax_Display .MathJax': glyphs,
      '.MathJax_Display': wrapper,
    });
    expect(pickEquationRenderNode(el)).toBe(glyphs);
  });

  it('prefers .katex (visible glyphs) over .katex-display (centering wrapper)', () => {
    const glyphs = { tag: 'span.katex' };
    const wrapper = { tag: 'span.katex-display' };
    const el = makeEl({
      '.katex': glyphs,
      '.katex-display': wrapper,
    });
    expect(pickEquationRenderNode(el)).toBe(glyphs);
  });
});

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
