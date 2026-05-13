import { describe, it, expect, vi } from 'vitest';

vi.mock('../editable-element.js', () => ({ editableRegistry: { has: () => false, get: () => null } }));
vi.mock('../serialization.js', () => ({
  splitIntoSlideChunks: vi.fn(),
}));
vi.mock('../utils.js', () => ({
  getQmdHeadingIndex: vi.fn(),
  escapeRegex: (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
}));

import {
  parseAbsoluteFences,
  findFenceForPositionedElement,
  Anchors,
} from '../modify-mode-positioned.js';

describe('parseAbsoluteFences', () => {
  it('returns an empty list when no fences are present', () => {
    expect(parseAbsoluteFences('plain paragraph\n\nanother')).toEqual([]);
  });

  it('finds a single top-level .absolute fence', () => {
    const chunk = [
      '::: {.absolute left=10px top=20px width=300px height=200px}',
      'inner',
      ':::',
    ].join('\n');
    const fences = parseAbsoluteFences(chunk);
    expect(fences).toHaveLength(1);
    expect(fences[0]).toMatchObject({
      fenceLineIndex: 0,
      closeLineIndex: 2,
      attrsStr: '.absolute left=10px top=20px width=300px height=200px',
    });
  });

  it('captures multiple top-level fences', () => {
    const chunk = [
      '::: {.absolute left=0px top=0px width=10px height=10px}',
      'a',
      ':::',
      '',
      '::: {.absolute left=100px top=100px width=20px height=20px}',
      'b',
      ':::',
    ].join('\n');
    const fences = parseAbsoluteFences(chunk);
    expect(fences).toHaveLength(2);
    expect(fences[0].fenceLineIndex).toBe(0);
    expect(fences[1].fenceLineIndex).toBe(4);
  });

  it('skips nested fences (returns only top-level .absolute)', () => {
    const chunk = [
      ':::: {.absolute left=0px top=0px width=10px height=10px}',
      '::: {.callout-note}',
      'inner',
      ':::',
      '::::',
    ].join('\n');
    const fences = parseAbsoluteFences(chunk);
    expect(fences).toHaveLength(1);
    expect(fences[0].fenceLineIndex).toBe(0);
    expect(fences[0].closeLineIndex).toBe(4);
  });

  it('ignores fences that are not .absolute', () => {
    const chunk = [
      '::: {.columns}',
      'x',
      ':::',
    ].join('\n');
    expect(parseAbsoluteFences(chunk)).toEqual([]);
  });

  it('drops malformed (unclosed) fences', () => {
    const chunk = [
      '::: {.absolute left=0px top=0px width=10px height=10px}',
      'unclosed',
    ].join('\n');
    expect(parseAbsoluteFences(chunk)).toEqual([]);
  });
});

describe('findFenceForPositionedElement', () => {
  const chunk = [
    '::: {.absolute #note-a left=10px top=20px width=300px height=200px}',
    'A',
    ':::',
    '',
    '::: {.absolute .myclass left=100px top=200px width=50px height=50px}',
    'B',
    ':::',
    '',
    '::: {.absolute left=500px top=500px width=80px height=80px}',
    'C',
    ':::',
  ].join('\n');

  it('matches by class anchor', () => {
    const out = findFenceForPositionedElement(chunk, { anchors: [Anchors.byClass('myclass')] });
    expect(out).not.toBeNull();
    expect(out.anchorKind).toBe('class');
    expect(out.fenceLineIndex).toBe(4);
  });

  it('matches by id anchor', () => {
    const out = findFenceForPositionedElement(chunk, { anchors: [Anchors.byId('note-a')] });
    expect(out).not.toBeNull();
    expect(out.anchorKind).toBe('id');
    expect(out.fenceLineIndex).toBe(0);
  });

  it('falls back to positional anchor when identity anchors fail', () => {
    const out = findFenceForPositionedElement(chunk, {
      anchors: [
        Anchors.byClass('absent'),
        Anchors.byPosition({ left: 500, top: 500, width: 80, height: 80 }),
      ],
    });
    expect(out).not.toBeNull();
    expect(out.anchorKind).toBe('position');
    expect(out.fenceLineIndex).toBe(8);
  });

  it('disambiguates duplicate positions via byIndex', () => {
    const dup = [
      '::: {.absolute left=10px top=10px width=20px height=20px}',
      'first',
      ':::',
      '',
      '::: {.absolute left=10px top=10px width=20px height=20px}',
      'second',
      ':::',
    ].join('\n');
    // byPosition matches both → returns null; byIndex picks one.
    const both = findFenceForPositionedElement(dup, {
      anchors: [Anchors.byPosition({ left: 10, top: 10, width: 20, height: 20 })],
    });
    expect(both).toBeNull();
    const second = findFenceForPositionedElement(dup, {
      anchors: [Anchors.byIndex(1)],
    });
    expect(second).not.toBeNull();
    expect(second.fenceLineIndex).toBe(4);
  });

  it('returns null when no anchor matches', () => {
    expect(findFenceForPositionedElement(chunk, { anchors: [Anchors.byId('nope')] })).toBeNull();
  });

  it('returns null when chunk has no absolute fences', () => {
    expect(findFenceForPositionedElement('plain content', { anchors: [Anchors.byIndex(0)] }))
      .toBeNull();
  });
});
