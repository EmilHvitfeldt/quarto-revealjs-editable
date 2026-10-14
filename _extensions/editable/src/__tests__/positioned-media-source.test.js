import { describe, it, expect } from 'vitest';
import { makeAbsoluteBlockRegex, makeAbsoluteImageRegex } from '../positioned-media-source.js';

const src = 'assets/v2_language_interface_problem.svg?layout=3';
const firstProblem = `![](${src}){.absolute width=1259.1px height=533px left=0px top=0px}`;

describe('already-positioned media source matching', () => {
  it('reactivates the manually positioned First Problem figure with fractional width', () => {
    expect(makeAbsoluteImageRegex(src, 0, 0, 1259.1, 533).test(firstProblem)).toBe(true);
  });

  it('rewrites only the matching image after dragging, retaining decimal geometry', () => {
    const other = `![](assets/other.svg){.absolute width=1259.1px height=533px left=0px top=0px}`;
    const replacement = `](${src}){.absolute width=1259.1px height=533px left=42.25px top=19.5px}`;
    const edited = `${firstProblem}\n${other}`.replace(makeAbsoluteImageRegex(src, 0, 0, 1259.1, 533), replacement);
    expect(edited).toBe(`![](${src}){.absolute width=1259.1px height=533px left=42.25px top=19.5px}\n${other}`);
    expect(makeAbsoluteImageRegex(src, 42.25, 19.5, 1259.1, 533).test(edited)).toBe(true);
  });

  it('matches decimal positions, negative positions and arbitrary attribute order', () => {
    const block = '{#diagram top=-3.75px width=1259.10px .absolute left=12.50px height=533.0px}';
    expect(makeAbsoluteBlockRegex(12.5, -3.75, 1259.1, 533).test(block)).toBe(true);
  });

  it('does not conflate nearby dimensions through integer rounding', () => {
    expect(makeAbsoluteImageRegex(src, 0, 0, 1259, 533).test(firstProblem)).toBe(false);
    expect(makeAbsoluteImageRegex(src, 0, 0, 1259.2, 533).test(firstProblem)).toBe(false);
  });

  it('keeps exact source identity, including escaped query parameters', () => {
    expect(makeAbsoluteImageRegex(src, 0, 0, 1259.1, 533).test(firstProblem.replace('layout=3', 'layout=4'))).toBe(false);
  });

  it('requires actual geometry attributes and the absolute class', () => {
    expect(makeAbsoluteBlockRegex(0, 0, 10, 10).test('{.absolute min-left=0px top=0px width=10px height=10px}')).toBe(false);
    expect(makeAbsoluteBlockRegex(0, 0, 10, 10).test('{.absolutely left=0px top=0px width=10px height=10px}')).toBe(false);
  });
});
