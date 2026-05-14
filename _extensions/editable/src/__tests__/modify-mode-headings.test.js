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
vi.mock('../colors.js', () => ({
  getColorPalette: vi.fn(() => []),
  // Mimic real implementation: brand-named colors return a placeholder token.
  getBrandColorOutput: vi.fn((color) => {
    const map = { '#ff0000': 'coral', '#008080': 'teal' };
    const name = map[color.toLowerCase()];
    return name ? `__BRAND_SHORTCODE_${name}__` : color;
  }),
}));
vi.mock('../capabilities.js', () => ({ setCapabilityOverride: vi.fn() }));
vi.mock('../quill.js', () => ({ quillInstances: new Map(), initializeQuillForElement: vi.fn() }));

import { replaceHeadingTextInChunk, headingHtmlToMarkdown } from '../modify-mode.js';

describe('headingHtmlToMarkdown — CSS-styled inline formatting', () => {
  // `document.execCommand('bold' | 'italic' | 'underline' | 'strikeThrough')`
  // emits `<span style="...">` in CSS mode (the default in many browsers),
  // not `<b>`/`<i>`/`<u>`/`<s>` tags. The previous markdown-conversion only
  // matched the tag forms, so users typing Bold in the heading toolbar
  // produced no `**…**` on save.

  it('converts <span style="font-weight: bold"> to **...**', () => {
    expect(headingHtmlToMarkdown('Hello <span style="font-weight: bold">world</span>'))
      .toBe('Hello **world**');
  });

  it('converts <span style="font-weight: 700"> to **...**', () => {
    expect(headingHtmlToMarkdown('<span style="font-weight: 700">w</span>'))
      .toBe('**w**');
  });

  it('converts <span style="font-style: italic"> to *...*', () => {
    expect(headingHtmlToMarkdown('<span style="font-style: italic">w</span>'))
      .toBe('*w*');
  });

  it('converts <span style="text-decoration: line-through"> to ~~...~~', () => {
    expect(headingHtmlToMarkdown('<span style="text-decoration: line-through">w</span>'))
      .toBe('~~w~~');
  });

  it('still handles tag-form <strong>/<em>/<s>', () => {
    expect(headingHtmlToMarkdown('<strong>a</strong> <em>b</em> <s>c</s>'))
      .toBe('**a** *b* ~~c~~');
  });

  it('converts <u> to [text]{.underline}', () => {
    expect(headingHtmlToMarkdown('hello <u>under</u> world'))
      .toBe('hello [under]{.underline} world');
  });

  it('converts <span style="text-decoration: underline"> to [text]{.underline}', () => {
    expect(headingHtmlToMarkdown('<span style="text-decoration: underline">w</span>'))
      .toBe('[w]{.underline}');
  });

  it('resolves brand color placeholder to {{< brand color name >}} shortcode', () => {
    expect(headingHtmlToMarkdown('<span style="color: #ff0000">title</span>'))
      .toBe("[title]{style='color: {{< brand color coral >}}'}");
  });

  it('resolves brand background color placeholder to shortcode', () => {
    expect(headingHtmlToMarkdown('<span style="background-color: #008080">title</span>'))
      .toBe("[title]{style='background-color: {{< brand color teal >}}'}");
  });
});

describe('replaceHeadingTextInChunk', () => {
  it('replaces the heading text on a plain heading', () => {
    const chunk = '## Old title\n\nbody text\n';
    expect(replaceHeadingTextInChunk(chunk, 'New title'))
      .toBe('## New title\n\nbody text\n');
  });

  it('preserves a trailing {...} attribute block', () => {
    const chunk = '## Old title {data-modify-test="titles"}\n\nbody text\n';
    expect(replaceHeadingTextInChunk(chunk, 'New title'))
      .toBe('## New title {data-modify-test="titles"}\n\nbody text\n');
  });

  it('preserves multiple attributes inside {...}', () => {
    const chunk = '## Title {.cls #id key="v"}\n';
    expect(replaceHeadingTextInChunk(chunk, 'New'))
      .toBe('## New {.cls #id key="v"}\n');
  });

  it('only replaces the first heading line in the chunk', () => {
    const chunk = '## A\n\n## not-a-heading-in-content\n';
    const out = replaceHeadingTextInChunk(chunk, 'Z');
    expect(out.startsWith('## Z\n')).toBe(true);
  });
});
