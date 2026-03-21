import { describe, it, expect } from 'vitest';
import { rgbToHex, normalizeColor, DEFAULT_COLOR_PALETTE } from '../colors.js';

describe('rgbToHex', () => {
  it('converts rgb to hex', () => {
    expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(rgbToHex('rgb(0, 255, 0)')).toBe('#00ff00');
    expect(rgbToHex('rgb(0, 0, 255)')).toBe('#0000ff');
  });

  it('converts rgba to hex (ignoring alpha)', () => {
    expect(rgbToHex('rgba(255, 0, 0, 0.5)')).toBe('#ff0000');
  });

  it('handles spaces in rgb string', () => {
    expect(rgbToHex('rgb( 255 , 255 , 255 )')).toBe('#ffffff');
  });

  it('returns null for invalid input', () => {
    expect(rgbToHex('not a color')).toBeNull();
    expect(rgbToHex('#ff0000')).toBeNull();
  });

  it('handles black and white', () => {
    expect(rgbToHex('rgb(0, 0, 0)')).toBe('#000000');
    expect(rgbToHex('rgb(255, 255, 255)')).toBe('#ffffff');
  });

  it('pads single digit hex values', () => {
    expect(rgbToHex('rgb(0, 0, 15)')).toBe('#00000f');
    expect(rgbToHex('rgb(1, 2, 3)')).toBe('#010203');
  });
});

describe('normalizeColor', () => {
  it('returns null/undefined as-is', () => {
    expect(normalizeColor(null)).toBeNull();
    expect(normalizeColor(undefined)).toBeUndefined();
  });

  it('normalizes "black" to #000000', () => {
    expect(normalizeColor('black')).toBe('#000000');
    expect(normalizeColor('BLACK')).toBe('#000000');
    expect(normalizeColor(' black ')).toBe('#000000');
  });

  it('expands short hex to full hex', () => {
    expect(normalizeColor('#000')).toBe('#000000');
    expect(normalizeColor('#fff')).toBe('#ffffff');
    expect(normalizeColor('#abc')).toBe('#aabbcc');
  });

  it('converts rgb to hex', () => {
    expect(normalizeColor('rgb(0, 0, 0)')).toBe('#000000');
    expect(normalizeColor('rgb(255, 255, 255)')).toBe('#ffffff');
  });

  it('lowercases hex colors', () => {
    expect(normalizeColor('#FF0000')).toBe('#ff0000');
    expect(normalizeColor('#AbCdEf')).toBe('#abcdef');
  });

  it('trims whitespace', () => {
    expect(normalizeColor('  #ff0000  ')).toBe('#ff0000');
  });
});

describe('DEFAULT_COLOR_PALETTE', () => {
  it('contains standard colors', () => {
    expect(DEFAULT_COLOR_PALETTE).toContain('#000000');
    expect(DEFAULT_COLOR_PALETTE).toContain('#ffffff');
  });

  it('is an array of hex colors', () => {
    expect(Array.isArray(DEFAULT_COLOR_PALETTE)).toBe(true);
    DEFAULT_COLOR_PALETTE.forEach(color => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});
