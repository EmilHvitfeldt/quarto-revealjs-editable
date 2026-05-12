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

import { extractTables, extractPipeTables } from '../modify-mode.js';

describe('extractTables — pipe tables', () => {
  it('extracts a single pipe table', () => {
    const tables = extractTables('## Slide\n\n| A | B |\n|---|---|\n| 1 | 2 |\n');
    expect(tables).toHaveLength(1);
    expect(tables[0].kind).toBe('pipe');
    expect(tables[0].headerLine).toBe('| A | B |');
    expect(tables[0].startLine).toBe(2);
    expect(tables[0].endLine).toBe(4);
  });

  it('extracts multiple tables separated by a blank line', () => {
    const src = '## Slide\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n| X | Y |\n|---|---|\n| 9 | 8 |\n';
    const tables = extractTables(src);
    expect(tables).toHaveLength(2);
    expect(tables[0].headerLine).toBe('| A | B |');
    expect(tables[1].headerLine).toBe('| X | Y |');
  });

  it('handles separator with alignment colons', () => {
    expect(extractTables('## Slide\n\n| A | B |\n|:--|--:|\n| 1 | 2 |\n')).toHaveLength(1);
  });

  it('requires a separator row to qualify as a pipe table', () => {
    expect(extractTables('## Slide\n\n| A | B |\n| 1 | 2 |\n')).toHaveLength(0);
  });

  it('ignores tables inside fenced code blocks', () => {
    expect(extractTables('## Slide\n\n```\n| A | B |\n|---|---|\n```\n')).toHaveLength(0);
  });

  it('ignores tables already inside a fenced div', () => {
    const src = '## Slide\n\n::: {.absolute left=0px top=0px}\n| A | B |\n|---|---|\n| 1 | 2 |\n:::\n';
    expect(extractTables(src)).toHaveLength(0);
  });

});

describe('extractTables — list tables', () => {
  it('extracts a list-table fenced div as a single block', () => {
    const src = '## Slide\n\n::: {.list-table}\n- - A\n  - B\n- - 1\n  - 2\n:::\n';
    const tables = extractTables(src);
    expect(tables).toHaveLength(1);
    expect(tables[0].kind).toBe('list');
    expect(tables[0].startLine).toBe(2);
    expect(tables[0].endLine).toBe(7);
    expect(tables[0].headerLine).toBe('- - A');
  });

  it('keeps the list-table block out of the pipe-table depth filter', () => {
    const src =
      '## Slide\n' +
      '\n' +
      '::: {.list-table}\n' +
      '- - A\n  - B\n- - 1\n  - 2\n' +
      ':::\n' +
      '\n' +
      '| C | D |\n|---|---|\n| 3 | 4 |\n';
    const tables = extractTables(src);
    expect(tables).toHaveLength(2);
    expect(tables[0].kind).toBe('list');
    expect(tables[1].kind).toBe('pipe');
  });
});

describe('extractTables — grid tables', () => {
  it('extracts a grid table', () => {
    const src =
      '## Slide\n' +
      '\n' +
      '+-----+-----+\n' +
      '| A   | B   |\n' +
      '+=====+=====+\n' +
      '| 1   | 2   |\n' +
      '+-----+-----+\n';
    const tables = extractTables(src);
    expect(tables).toHaveLength(1);
    expect(tables[0].kind).toBe('grid');
    expect(tables[0].headerLine).toBe('| A   | B   |');
    expect(tables[0].startLine).toBe(2);
    expect(tables[0].endLine).toBe(6);
  });
});

describe('extractTables — HTML tables', () => {
  it('extracts a multi-line raw HTML table', () => {
    const src =
      '## Slide\n' +
      '\n' +
      '<table>\n' +
      '  <tr><th>A</th><th>B</th></tr>\n' +
      '  <tr><td>1</td><td>2</td></tr>\n' +
      '</table>\n';
    const tables = extractTables(src);
    expect(tables).toHaveLength(1);
    expect(tables[0].kind).toBe('html');
    expect(tables[0].startLine).toBe(2);
    expect(tables[0].endLine).toBe(5);
  });

  it('skips an unclosed HTML table', () => {
    expect(extractTables('## Slide\n\n<table>\n<tr><td>x</td></tr>\n')).toHaveLength(0);
  });
});

describe('extractTables — captions', () => {
  it('includes a `: caption` line in the table block', () => {
    const src =
      '## Slide\n' +
      '\n' +
      '| A | B |\n' +
      '|---|---|\n' +
      '| 1 | 2 |\n' +
      '\n' +
      ': My caption {#tbl-id}\n';
    const tables = extractTables(src);
    expect(tables).toHaveLength(1);
    expect(tables[0].endLine).toBe(6);
  });

  it('includes a `Table:` caption line', () => {
    const src =
      '## Slide\n' +
      '\n' +
      '| A | B |\n' +
      '|---|---|\n' +
      '| 1 | 2 |\n' +
      '\n' +
      'Table: Demographics\n';
    const tables = extractTables(src);
    expect(tables[0].endLine).toBe(6);
  });

  it('does not consume an adjacent paragraph that is not a caption', () => {
    const src =
      '## Slide\n' +
      '\n' +
      '| A | B |\n' +
      '|---|---|\n' +
      '| 1 | 2 |\n' +
      '\n' +
      'Just a paragraph\n';
    const tables = extractTables(src);
    expect(tables[0].endLine).toBe(4);
  });
});

describe('extractPipeTables back-compat', () => {
  it('returns only pipe tables', () => {
    const src =
      '## Slide\n' +
      '\n' +
      '| A | B |\n' +
      '|---|---|\n' +
      '| 1 | 2 |\n' +
      '\n' +
      '+---+---+\n' +
      '| X | Y |\n' +
      '+===+===+\n' +
      '| 1 | 2 |\n' +
      '+---+---+\n';
    const onlyPipes = extractPipeTables(src);
    expect(onlyPipes).toHaveLength(1);
    expect(onlyPipes[0].kind).toBe('pipe');
  });
});
