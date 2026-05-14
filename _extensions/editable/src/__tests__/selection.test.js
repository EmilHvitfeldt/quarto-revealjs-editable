import { describe, it, expect } from 'vitest';
import { isInsideActiveEditContext } from '../selection.js';

// Stub a DOM-ish target whose `closest(sel)` returns truthy only for the
// selectors listed in `hits`. Mirrors how Element.closest works for the
// purposes of the predicate.
const makeTarget = (hits = []) => ({
  closest(sel) { return hits.includes(sel) ? {} : null; },
});

describe('isInsideActiveEditContext', () => {
  it('returns false for a click target with no editing context', () => {
    expect(isInsideActiveEditContext(makeTarget())).toBe(false);
  });

  it('returns true for clicks inside the image editable-container', () => {
    expect(isInsideActiveEditContext(makeTarget(['.editable-container:has(img)']))).toBe(true);
  });

  it('returns true for clicks inside the editable toolbar', () => {
    expect(isInsideActiveEditContext(makeTarget(['.editable-toolbar']))).toBe(true);
  });

  it('returns true for clicks inside an arrow container', () => {
    expect(isInsideActiveEditContext(makeTarget(['.editable-arrow-container']))).toBe(true);
  });

  it('returns true for clicks inside an active Quill text editor', () => {
    expect(isInsideActiveEditContext(makeTarget([
      ".editable-container:has(.ql-editor[contenteditable='true'])",
    ]))).toBe(true);
  });

  it('returns true for clicks inside an actively-edited heading', () => {
    // Bug: without this, clicking the h2 while editing triggers
    // setActiveImage(null) → showRightPanel('default'), which hides the
    // heading-edit toolbar even though the user is still focused on the h2.
    expect(isInsideActiveEditContext(makeTarget(['.editable-heading-active']))).toBe(true);
  });

  it('handles null/undefined targets gracefully', () => {
    expect(isInsideActiveEditContext(null)).toBe(false);
    expect(isInsideActiveEditContext(undefined)).toBe(false);
    expect(isInsideActiveEditContext({})).toBe(false);
  });
});
