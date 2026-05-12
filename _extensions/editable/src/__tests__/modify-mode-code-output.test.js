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

import { extractExecutableChunks } from '../modify-mode.js';

describe('extractExecutableChunks', () => {
  it('extracts an unnamed R chunk', () => {
    const chunks = extractExecutableChunks('## Slide\n\n```{r}\nplot(1:10)\n```\n');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].label).toBeNull();
    expect(chunks[0].firstCodeLine).toBe('plot(1:10)');
    expect(chunks[0].startLine).toBe(2);
    expect(chunks[0].endLine).toBe(4);
  });

  it('extracts a named R chunk', () => {
    const chunks = extractExecutableChunks('## Slide\n\n```{r tbl-mtcars}\nhead(mtcars)\n```\n');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].label).toBe('tbl-mtcars');
    expect(chunks[0].firstCodeLine).toBe('head(mtcars)');
  });

  it('extracts a python chunk', () => {
    const chunks = extractExecutableChunks('## Slide\n\n```{python}\nprint("hi")\n```\n');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].label).toBeNull();
    expect(chunks[0].firstCodeLine).toBe('print("hi")');
  });

  it('extracts an ojs chunk', () => {
    const chunks = extractExecutableChunks('## Slide\n\n```{ojs}\n{ return 1 }\n```\n');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].label).toBeNull();
    expect(chunks[0].firstCodeLine).toBe('{ return 1 }');
  });

  it('skips leading #| option lines for the anchor', () => {
    const chunks = extractExecutableChunks(
      '## Slide\n\n```{r}\n#| echo: false\n#| label: foo\nplot(1:10)\n```\n'
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].firstCodeLine).toBe('plot(1:10)');
  });

  it('extracts multiple chunks on the same slide', () => {
    const chunks = extractExecutableChunks(
      '## Slide\n\n```{r}\na <- 1\n```\n\n```{python}\nb = 2\n```\n'
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0].firstCodeLine).toBe('a <- 1');
    expect(chunks[1].firstCodeLine).toBe('b = 2');
  });

  it('skips chunks inside a fenced div', () => {
    const chunks = extractExecutableChunks(
      '## Slide\n\n::: {.absolute}\n```{r}\nplot(1:10)\n```\n:::\n'
    );
    expect(chunks).toHaveLength(0);
  });

  it('does not match non-executable code blocks', () => {
    const chunks = extractExecutableChunks('## Slide\n\n```python\nx = 1\n```\n');
    expect(chunks).toHaveLength(0);
  });

  it('returns empty array when chunk has no executable chunks', () => {
    expect(extractExecutableChunks('## Slide\n\nJust text\n')).toHaveLength(0);
  });

  it('handles a fenced div followed by an executable chunk', () => {
    const chunks = extractExecutableChunks(
      '## Slide\n\n::: {.note}\nhi\n:::\n\n```{r}\nz <- 1\n```\n'
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].firstCodeLine).toBe('z <- 1');
  });

  it('parses label correctly when chunk options follow', () => {
    const chunks = extractExecutableChunks(
      '## Slide\n\n```{r my-label echo=FALSE}\nx <- 1\n```\n'
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].label).toBe('my-label');
  });

  it('picks up `#| label:` option from chunk body', () => {
    const chunks = extractExecutableChunks(
      '## Slide\n\n```{r}\n#| label: tbl-foo\n#| echo: false\nhead(mtcars)\n```\n'
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].label).toBe('tbl-foo');
    expect(chunks[0].firstCodeLine).toBe('head(mtcars)');
  });
});
