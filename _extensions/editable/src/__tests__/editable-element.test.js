import { describe, it, expect } from 'vitest';
import { EditableElement } from '../editable-element.js';

// Minimal DOM-ish element. Tracks every style assignment so the test can
// confirm whether `height` was written or skipped.
const makeEl = (tag = 'blockquote', opts = {}) => ({
  tagName: tag.toUpperCase(),
  offsetWidth: opts.width ?? 300,
  offsetHeight: opts.height ?? 100,
  style: {},
});

describe('EditableElement.syncToDOM', () => {
  it('writes element.style.height by default', () => {
    const el = makeEl();
    const ee = new EditableElement(el);
    ee.setState({ width: 200, height: 150 }, true);
    expect(el.style.height).toBe('150px');
  });

  it('skips height when syncHeight is false (blockquote/content-sized pattern)', () => {
    // Bug: the visible left accent bar on a blockquote tracks the element
    // height. When the user resizes the wrapper, the inner blockquote
    // grows with it and the bar stretches. For content-sized elements the
    // fix is to leave element.style.height untouched so the inner element
    // stays at auto/content height while state.height still tracks the
    // wrapper for serialization purposes.
    const el = makeEl();
    const ee = new EditableElement(el);
    ee.syncHeight = false;
    el.style.height = 'auto';  // simulate caller pinning the element auto
    ee.setState({ width: 200, height: 150 }, true);
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('auto');  // not overwritten
  });
});
