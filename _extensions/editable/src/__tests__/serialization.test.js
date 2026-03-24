import { describe, it, expect, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('../config.js', () => ({
  CONFIG: {
    ARROW_DEFAULT_COLOR: 'black',
    ARROW_DEFAULT_WIDTH: 2,
    ARROW_DEFAULT_LABEL_OFFSET: 10,
  }
}));

vi.mock('../colors.js', () => ({
  getBrandColorOutput: (color) => color,
  normalizeColor: (color) => {
    if (!color) return color;
    const normalized = color.trim().toLowerCase();
    if (normalized === 'black') return '#000000';
    if (normalized.match(/^#[0-9a-f]{3}$/i)) {
      return '#' + normalized[1] + normalized[1] +
                   normalized[2] + normalized[2] +
                   normalized[3] + normalized[3];
    }
    return normalized;
  }
}));

vi.mock('../utils.js', () => ({
  round: (n) => Math.round(n * 10) / 10,
  getOriginalEditableElements: () => [],
  getOriginalEditableDivs: () => [],
}));

vi.mock('../editable-element.js', () => ({
  editableRegistry: new Map(),
}));

vi.mock('../registries.js', () => ({
  NewElementRegistry: {
    newSlides: [],
    newDivs: [],
    newArrows: [],
    countNewSlidesBefore: () => 0,
  }
}));

vi.mock('../quill.js', () => ({
  quillInstances: new Map(),
}));

import { serializeToQmd, getFenceForContent, serializeArrowToShortcode } from '../serialization.js';

describe('serializeToQmd', () => {
  it('serializes basic dimensions', () => {
    const dims = { width: 100, height: 50, left: 10, top: 20 };
    const result = serializeToQmd(dims);
    expect(result).toBe('{.absolute width=100px height=50px left=10px top=20px}');
  });

  it('includes rotation in style attribute', () => {
    const dims = { width: 100, height: 50, left: 0, top: 0, rotation: 45 };
    const result = serializeToQmd(dims);
    expect(result).toContain('style="transform: rotate(45deg);"');
  });

  it('rounds dimensions to 1 decimal place', () => {
    const dims = { width: 100.567, height: 50.234, left: 10.999, top: 20.001 };
    const result = serializeToQmd(dims);
    expect(result).toContain('width=100.6px');
    expect(result).toContain('height=50.2px');
    expect(result).toContain('left=11px');
    expect(result).toContain('top=20px');
  });

  it('includes fontSize in style', () => {
    const dims = { width: 100, height: 50, left: 0, top: 0, fontSize: 24 };
    const result = serializeToQmd(dims);
    expect(result).toContain('style="font-size: 24px;"');
  });

  it('includes textAlign in style', () => {
    const dims = { width: 100, height: 50, left: 0, top: 0, textAlign: 'center' };
    const result = serializeToQmd(dims);
    expect(result).toContain('style="text-align: center;"');
  });

  it('combines multiple style properties', () => {
    const dims = { width: 100, height: 50, left: 0, top: 0, fontSize: 16, rotation: 30 };
    const result = serializeToQmd(dims);
    expect(result).toContain('font-size: 16px;');
    expect(result).toContain('transform: rotate(30deg);');
  });
});

describe('getFenceForContent', () => {
  it('returns ::: for content without colons', () => {
    expect(getFenceForContent('hello world')).toBe(':::');
  });

  it('returns :::: when content has :::' , () => {
    expect(getFenceForContent('::: nested\ncontent\n:::')).toBe('::::');
  });

  it('returns ::::: when content has ::::', () => {
    expect(getFenceForContent(':::: outer\n::: inner\n:::\n::::')).toBe(':::::');
  });

  it('handles content with colons but not fence sequences', () => {
    expect(getFenceForContent('Time: 12:30 PM')).toBe(':::');
  });

  it('handles empty content', () => {
    expect(getFenceForContent('')).toBe(':::');
  });
});

describe('serializeArrowToShortcode', () => {
  it('serializes basic arrow', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toBe('{{< arrow from="100,200" to="300,400" position="absolute" >}}');
  });

  it('includes non-default color', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: '#ff0000',
      width: 2,
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toContain('color="#ff0000"');
  });

  it('omits default black color', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: '#000000',
      width: 2,
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).not.toContain('color=');
  });

  it('includes non-default width', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 5,
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toContain('width="5"');
  });

  it('includes control points for curved arrow', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: 150, control1Y: 100,
      control2X: 250, control2Y: 300,
      color: 'black',
      width: 2,
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toContain('control1="150,100"');
    expect(result).toContain('control2="250,300"');
  });

  it('includes head style when not default', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
      head: 'diamond',
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toContain('head="diamond"');
  });

  it('includes dash style when not solid', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
      dash: 'dashed',
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toContain('dash="dashed"');
  });

  it('includes opacity when not 1', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
      opacity: 0.5,
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toContain('opacity="0.5"');
  });

  it('includes label when present', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
      label: 'Step 1',
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toContain('label="Step 1"');
  });

  it('omits label when empty', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
      label: '',
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).not.toContain('label=');
  });

  it('includes label-position when label present and not middle', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
      label: 'Start',
      labelPosition: 'start',
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toContain('label-position="start"');
  });

  it('omits label-position when middle (default)', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
      label: 'Middle',
      labelPosition: 'middle',
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).not.toContain('label-position=');
  });

  it('includes label-offset when label present and not default', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
      label: 'Offset',
      labelOffset: 20,
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).toContain('label-offset="20"');
  });

  it('omits label-offset when default (10)', () => {
    const arrow = {
      fromX: 100, fromY: 200,
      toX: 300, toY: 400,
      control1X: null, control1Y: null,
      control2X: null, control2Y: null,
      color: 'black',
      width: 2,
      label: 'Default offset',
      labelOffset: 10,
    };
    const result = serializeArrowToShortcode(arrow);
    expect(result).not.toContain('label-offset=');
  });
});
