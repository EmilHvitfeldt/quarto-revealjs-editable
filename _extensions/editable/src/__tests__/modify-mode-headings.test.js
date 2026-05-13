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
}));
vi.mock('../utils.js', () => ({ getQmdHeadingIndex: vi.fn(), getSlideScale: vi.fn() }));
vi.mock('../colors.js', () => ({ getColorPalette: vi.fn(() => []), getBrandColorOutput: vi.fn() }));
vi.mock('../capabilities.js', () => ({ setCapabilityOverride: vi.fn() }));
vi.mock('../quill.js', () => ({ quillInstances: new Map(), initializeQuillForElement: vi.fn() }));

import { replaceHeadingTextInChunk } from '../modify-mode.js';

describe('replaceHeadingTextInChunk', () => {
  it('replaces the heading text on a plain heading', () => {
    const chunk = '## Old title\n\nbody text\n';
    expect(replaceHeadingTextInChunk(chunk, 'New title'))
      .toBe('## New title\n\nbody text\n');
  });

  it('preserves a trailing {...} attribute block', () => {
    const chunk = '## Old title {data-modify-test="titles"}\n\nbody text\n';
    expect(replaceHeadingTextInChunk(chunk, 'New title'))
      .toBe('## New title {data-modify-test="titles"}\n\nbody text\n');
  });

  it('preserves multiple attributes inside {...}', () => {
    const chunk = '## Title {.cls #id key="v"}\n';
    expect(replaceHeadingTextInChunk(chunk, 'New'))
      .toBe('## New {.cls #id key="v"}\n');
  });

  it('only replaces the first heading line in the chunk', () => {
    const chunk = '## A\n\n## not-a-heading-in-content\n';
    const out = replaceHeadingTextInChunk(chunk, 'Z');
    expect(out.startsWith('## Z\n')).toBe(true);
  });
});
