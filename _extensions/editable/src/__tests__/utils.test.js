import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock CONFIG
vi.mock('../config.js', () => ({
  CONFIG: {
    DEBUG: false,
  }
}));

import { round, getCurrentSlideIndex, getCurrentSlide } from '../utils.js';

afterEach(() => vi.unstubAllGlobals());

describe('source slide identity', () => {
  it('uses the expanded-source index of a vertical or cloned leaf slide', () => {
    const leaf = { dataset: { editableSourceIndex: '47' }, querySelector: () => null };
    vi.stubGlobal('Reveal', { getCurrentSlide: () => leaf, getIndices: () => ({ h: 8, v: 3 }) });
    expect(getCurrentSlideIndex()).toBe(47);
    expect(getCurrentSlide()).toBe(leaf);
  });

  it('preserves standard Reveal indexing without source metadata', () => {
    vi.stubGlobal('Reveal', { getCurrentSlide: () => ({ dataset: {} }), getIndices: () => ({ h: 8, v: 3 }) });
    expect(getCurrentSlideIndex()).toBe(8);
  });

  it('does not accept malformed source metadata as a slide index', () => {
    vi.stubGlobal('Reveal', { getCurrentSlide: () => ({ dataset: { editableSourceIndex: 'broken' } }), getIndices: () => ({ h: 8 }) });
    expect(getCurrentSlideIndex()).toBe(8);
  });
});

describe('round', () => {
  it('rounds to 1 decimal place', () => {
    expect(round(1.234)).toBe(1.2);
    expect(round(1.256)).toBe(1.3);
    expect(round(1.251)).toBe(1.3);
  });

  it('handles integers', () => {
    expect(round(5)).toBe(5);
    expect(round(100)).toBe(100);
  });

  it('handles negative numbers', () => {
    expect(round(-1.234)).toBe(-1.2);
    expect(round(-1.256)).toBe(-1.3);
  });

  it('handles zero', () => {
    expect(round(0)).toBe(0);
    expect(round(0.04)).toBe(0);
    expect(round(0.05)).toBe(0.1);
  });

  it('handles very small numbers', () => {
    expect(round(0.001)).toBe(0);
    expect(round(0.099)).toBe(0.1);
  });

  it('handles large numbers', () => {
    expect(round(12345.678)).toBe(12345.7);
  });
});
