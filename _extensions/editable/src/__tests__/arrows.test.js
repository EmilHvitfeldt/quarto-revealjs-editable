import { describe, it, expect, vi } from 'vitest';

vi.mock('../config.js', () => ({
  CONFIG: {
    DEBUG: false,
    ARROW_HANDLE_SIZE: 12,
    ARROW_CONTROL_HANDLE_SIZE: 10,
    ARROW_WAYPOINT_HANDLE_SIZE: 10,
    ARROW_DEFAULT_COLOR: 'black',
    ARROW_DEFAULT_WIDTH: 2,
    ARROW_WAYPOINT_COLOR: '#f59e0b',
    ARROW_CONTROL1_COLOR: '#ff6600',
    ARROW_CONTROL2_COLOR: '#9933ff',
    ARROW_DEFAULT_LABEL_OFFSET: 10,
    ARROW_DOUBLE_LINE_OFFSET_MULTIPLIER: 1.5,
    ARROW_CONTROL_POINT_DISPLACEMENT: 50,
    ARROW_LABEL_T_START: 0.15,
    ARROW_LABEL_T_END: 0.85,
    ARROW_LABEL_T_MIDDLE: 0.5,
    ARROW_LABEL_FLIP_THRESHOLD: 90,
    ARROW_HANDLE_OFFSET: -6,
    ARROW_DEFAULT_LABEL_POSITION: 'middle',
    NEW_FENCE_LENGTH: 3,
  }
}));
vi.mock('../utils.js', () => ({
  getSlideScale: () => 1,
  getRawClient: (e) => ({ clientX: e.clientX, clientY: e.clientY }),
  getCurrentSlide: () => null,
  getCurrentSlideIndex: () => 0,
  getQmdHeadingIndex: (i) => i,
  debug: () => {},
}));
vi.mock('../colors.js', () => ({
  getColorPalette: () => [],
  rgbToHex: (v) => v,
}));
vi.mock('../registries.js', () => ({
  NewElementRegistry: { newArrows: [] },
  ToolbarRegistry: { register: () => {} },
}));
vi.mock('../undo.js', () => ({
  pushUndoState: () => {},
  registerRestoreArrowDOM: () => {},
}));
vi.mock('../toolbar.js', () => ({
  showRightPanel: () => {},
}));
vi.mock('../selection.js', () => ({
  registerDeselectArrow: () => {},
  deselectImage: () => {},
}));

import {
  distanceToSegment,
  offsetPointPerpendicular,
  catmullRomPath,
  getPointOnArrow,
} from '../arrows.js';

describe('distanceToSegment', () => {
  it('returns 0 when point is on segment', () => {
    expect(distanceToSegment(5, 0, 0, 0, 10, 0)).toBeCloseTo(0);
  });

  it('returns perpendicular distance from point to segment', () => {
    expect(distanceToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
  });

  it('returns distance to nearest endpoint when point projects outside segment', () => {
    expect(distanceToSegment(-1, 0, 0, 0, 10, 0)).toBeCloseTo(1);
    expect(distanceToSegment(11, 0, 0, 0, 10, 0)).toBeCloseTo(1);
  });

  it('handles degenerate segment (start == end)', () => {
    const d = distanceToSegment(3, 4, 5, 5, 5, 5);
    expect(d).toBeCloseTo(Math.sqrt(4 + 1));
  });
});

describe('offsetPointPerpendicular', () => {
  it('offsets horizontally for a rightward tangent', () => {
    // tangent pointing right (1, 0): perpendicular is (0, 1)
    const result = offsetPointPerpendicular(0, 0, 1, 0, 10);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(10);
  });

  it('offsets in negative direction with negative offset', () => {
    const result = offsetPointPerpendicular(0, 0, 1, 0, -10);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(-10);
  });

  it('offsets diagonally for 45-degree tangent', () => {
    const sq2 = Math.SQRT2;
    const result = offsetPointPerpendicular(0, 0, 1 / sq2, 1 / sq2, sq2);
    expect(result.x).toBeCloseTo(-1);
    expect(result.y).toBeCloseTo(1);
  });
});

describe('catmullRomPath', () => {
  it('returns a string starting with M for 2+ points', () => {
    const path = catmullRomPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(typeof path).toBe('string');
    expect(path.startsWith('M')).toBe(true);
  });

  it('includes C cubic bezier commands for smooth curves', () => {
    const path = catmullRomPath([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
    expect(path).toContain('C');
  });

  it('returns empty string for fewer than 2 points', () => {
    expect(catmullRomPath([])).toBe('');
    expect(catmullRomPath([{ x: 0, y: 0 }])).toBe('');
  });
});

describe('getPointOnArrow', () => {
  const straightArrow = {
    fromX: 0, fromY: 0,
    toX: 100, toY: 0,
    control1X: null, control1Y: null,
    control2X: null, control2Y: null,
    waypoints: [],
  };

  it('returns start point at t=0', () => {
    const pt = getPointOnArrow(0, straightArrow);
    expect(pt.x).toBeCloseTo(0);
    expect(pt.y).toBeCloseTo(0);
  });

  it('returns end point at t=1', () => {
    const pt = getPointOnArrow(1, straightArrow);
    expect(pt.x).toBeCloseTo(100);
    expect(pt.y).toBeCloseTo(0);
  });

  it('returns midpoint at t=0.5 for straight arrow', () => {
    const pt = getPointOnArrow(0.5, straightArrow);
    expect(pt.x).toBeCloseTo(50);
    expect(pt.y).toBeCloseTo(0);
  });

  it('includes angle property', () => {
    const pt = getPointOnArrow(0.5, straightArrow);
    expect(typeof pt.angle).toBe('number');
  });

  it('returns 0-degree angle for rightward arrow', () => {
    const pt = getPointOnArrow(0.5, straightArrow);
    expect(pt.angle).toBeCloseTo(0);
  });
});
