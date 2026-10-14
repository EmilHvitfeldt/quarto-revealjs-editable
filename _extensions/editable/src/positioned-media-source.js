/** Source matching for already-positioned media, including saved decimals. */
import { escapeRegex } from './utils.js';

function pixelValue(value) {
  if (!Number.isFinite(value)) throw new TypeError('Positioned geometry must be finite');
  const canonical = String(value);
  // Quarto normalizes redundant decimal zeros when emitting inline styles.
  // Accept those equivalent spellings without rounding distinct positions.
  return canonical.includes('.')
    ? `${escapeRegex(canonical)}0*px`
    : `${escapeRegex(canonical)}(?:\\.0+)?px`;
}

function absoluteAttributes(left, top, width, height) {
  const geometry = { left, top, width, height };
  const matches = Object.entries(geometry).map(([name, value]) =>
    `(?=(?:[^}]*\\s)?${name}=${pixelValue(value)}(?=\\s|}))`).join('');
  return `\\{(?=(?:[^}]*\\s)?\\.absolute(?=\\s|}))${matches}[^}]*\\}`;
}

export function makeAbsoluteBlockRegex(left, top, width, height) {
  return new RegExp(absoluteAttributes(left, top, width, height), 'g');
}

export function makeAbsoluteImageRegex(src, left, top, width, height) {
  return new RegExp(`\\]\\(${escapeRegex(src)}\\)${absoluteAttributes(left, top, width, height)}`, 'g');
}
