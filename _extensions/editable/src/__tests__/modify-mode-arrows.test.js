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
vi.mock('../config.js', () => ({
  CONFIG: {
    ARROW_DEFAULT_COLOR: 'black',
    ARROW_DEFAULT_WIDTH: 2,
    ARROW_DEFAULT_LABEL_POSITION: 'middle',
    ARROW_DEFAULT_LABEL_OFFSET: 10,
  },
}));

import { parseArrowShortcodes } from '../modify-mode.js';

describe('parseArrowShortcodes', () => {
  it('extracts a single absolute arrow shortcode', () => {
    const chunk = '## Slide\n\n{{< arrow from="100,200" to="300,400" position="absolute" >}}\n';
    const result = parseArrowShortcodes(chunk);
    expect(result).toHaveLength(1);
    expect(result[0].kwargs.from).toBe('100,200');
    expect(result[0].kwargs.to).toBe('300,400');
    expect(result[0].kwargs.position).toBe('absolute');
  });

  it('extracts every arrow on a slide in source order', () => {
    const chunk = [
      '## Slide',
      '',
      '{{< arrow from="1,1" to="2,2" position="absolute" >}}',
      '',
      '{{< arrow from="3,3" to="4,4" position="absolute" >}}',
      '',
    ].join('\n');
    const result = parseArrowShortcodes(chunk);
    expect(result).toHaveLength(2);
    expect(result[0].kwargs.from).toBe('1,1');
    expect(result[1].kwargs.from).toBe('3,3');
    expect(result[0].index).toBeLessThan(result[1].index);
  });

  it('captures the literal raw substring as it appears in source', () => {
    const chunk = '{{< arrow from="1,2"  to="3,4"   position="absolute" >}}';
    const result = parseArrowShortcodes(chunk);
    expect(result[0].raw).toBe(chunk);
  });

  it('parses styling kwargs (color, width, head, dash, line, opacity)', () => {
    const chunk = '{{< arrow from="0,0" to="1,1" color="red" width="3" head="stealth" dash="5,5" line="double" opacity="0.5" position="absolute" >}}';
    const { kwargs } = parseArrowShortcodes(chunk)[0];
    expect(kwargs.color).toBe('red');
    expect(kwargs.width).toBe('3');
    expect(kwargs.head).toBe('stealth');
    expect(kwargs.dash).toBe('5,5');
    expect(kwargs.line).toBe('double');
    expect(kwargs.opacity).toBe('0.5');
  });

  it('parses curve and waypoint kwargs', () => {
    const chunk = '{{< arrow from="0,0" to="100,100" control1="50,0" control2="50,100" waypoints="20,20 80,80" smooth="true" position="absolute" >}}';
    const { kwargs } = parseArrowShortcodes(chunk)[0];
    expect(kwargs.control1).toBe('50,0');
    expect(kwargs.control2).toBe('50,100');
    expect(kwargs.waypoints).toBe('20,20 80,80');
    expect(kwargs.smooth).toBe('true');
  });

  it('parses label kwargs including hyphenated keys', () => {
    const chunk = '{{< arrow from="0,0" to="1,1" label="hi" label-position="start" label-offset="20" position="absolute" >}}';
    const { kwargs } = parseArrowShortcodes(chunk)[0];
    expect(kwargs.label).toBe('hi');
    expect(kwargs['label-position']).toBe('start');
    expect(kwargs['label-offset']).toBe('20');
  });

  it('accepts single-quoted and unquoted values', () => {
    const chunk = `{{< arrow from='1,2' to=3,4 position="absolute" >}}`;
    const { kwargs } = parseArrowShortcodes(chunk)[0];
    expect(kwargs.from).toBe('1,2');
    expect(kwargs.to).toBe('3,4');
  });

  it('returns inline (non-positioned) arrows too — caller filters by position', () => {
    const chunk = '{{< arrow from="0,0" to="1,1" >}}';
    const result = parseArrowShortcodes(chunk);
    expect(result).toHaveLength(1);
    expect(result[0].kwargs.position).toBeUndefined();
  });

  it('returns empty when no arrows present', () => {
    expect(parseArrowShortcodes('## Slide\n\nno arrows here\n')).toEqual([]);
  });

  it('does not match shortcodes for other names', () => {
    const chunk = '{{< brand color foo >}}\n{{< video src="x" >}}';
    expect(parseArrowShortcodes(chunk)).toEqual([]);
  });

  it('flags unsupported kwargs (bend, fragment, aria-label) — verified via raw kwargs', () => {
    // The classifier filters these out as warns; this test confirms the
    // parser preserves them so the downstream check can detect them.
    const chunk = '{{< arrow from="0,0" to="1,1" bend="left" fragment="true" aria-label="x" position="absolute" >}}';
    const { kwargs } = parseArrowShortcodes(chunk)[0];
    expect(kwargs.bend).toBe('left');
    expect(kwargs.fragment).toBe('true');
    expect(kwargs['aria-label']).toBe('x');
  });
});
