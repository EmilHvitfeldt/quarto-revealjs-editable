import { describe, it, expect, vi, beforeEach } from 'vitest';

const { registry, readSize } = vi.hoisted(() => ({ registry: new Map(), readSize: vi.fn() }));
vi.mock('../editable-element.js', () => ({ editableRegistry: registry, readElementSize: readSize }));
vi.mock('../serialization.js', () => ({ splitIntoSlideChunks: vi.fn() }));
vi.mock('../utils.js', () => ({
  getCurrentSlideIndex: () => 0,
  getQmdHeadingIndex: () => 0,
  escapeRegex: value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
}));

import { makePositionedClassifier } from '../modify-mode-positioned.js';
import { makeAbsoluteImageRegex } from '../positioned-media-source.js';
import { splitIntoSlideChunks } from '../serialization.js';

describe('positioned image reactivation and save', () => {
  beforeEach(() => { registry.clear(); readSize.mockReset(); });

  it('classifies, activates and saves the actual decimal-width First Problem image', () => {
    const src = 'assets/v2_language_interface_problem.svg?layout=3';
    const source = `![](${src}){.absolute width=1259.1px height=533px left=0px top=0px}`;
    const image = { dataset: {}, style: { left: '0px', top: '0px', width: '1259.1px', height: '533px' } };
    const setState = vi.fn();
    const classifier = makePositionedClassifier({
      label: 'Positioned images', selector: 'img.absolute', serializeSelector: 'img[data-editable-modified]',
      matchesSource: (_image, pos) => makeAbsoluteImageRegex(src, pos.left, pos.top, pos.width, pos.height).test(source),
      setupFn: element => registry.set(element, {
        setState,
        toDimensions: () => ({ left: 32.25, top: 18.5, width: 1259.1, height: 533 }),
      }),
      getReplacement: (_image, dims, ds) => ({
        regex: makeAbsoluteImageRegex(src, Number(ds.editableModifiedAbsLeft), Number(ds.editableModifiedAbsTop), Number(ds.editableModifiedAbsWidth), Number(ds.editableModifiedAbsHeight)),
        replacement: `](${src}){.absolute width=${dims.width}px height=${dims.height}px left=${dims.left}px top=${dims.top}px}`,
      }),
    });
    expect(classifier.classify({ querySelectorAll: () => [image] })).toEqual({ valid: [image], warn: [] });
    classifier.activate(image);
    expect(image.dataset.editableModifiedAbsWidth).toBe('1259.1');
    expect(setState).toHaveBeenCalledWith({ x: 0, y: 0 });
    vi.stubGlobal('document', { querySelectorAll: () => [image] });
    splitIntoSlideChunks.mockReturnValue(['', source]);
    expect(classifier.serialize(source)).toBe(`![](${src}){.absolute width=1259.1px height=533px left=32.25px top=18.5px}`);
    vi.unstubAllGlobals();
  });

  it('locks the visible image size before removing the 95-percent theme constraint', () => {
    const image = { tagName: 'IMG', dataset: {}, style: {
      left: '0px', top: '0px', width: '1259.1px', height: '533px', maxWidth: '95%',
    } };
    readSize.mockReturnValue({ width: 1216, height: 533 });
    const setState = vi.fn();
    const beforeRemovingConstraint = vi.fn(element => {
      expect(element.style.width).toBe('1216px');
      expect(element.style.height).toBe('533px');
      element.style.maxWidth = 'none';
    });
    const classifier = makePositionedClassifier({
      label: 'Positioned images', selector: 'img.absolute', serializeSelector: 'img[data-editable-modified]',
      matchesSource: () => true,
      extraActivate: beforeRemovingConstraint,
      setupFn: element => registry.set(element, { setState }),
      getReplacement: () => null,
    });
    classifier.activate(image);
    expect(readSize).toHaveBeenCalledWith(image);
    expect(beforeRemovingConstraint).toHaveBeenCalledWith(image);
    expect(image.dataset.editableModifiedAbsWidth).toBe('1259.1');
    expect(image.dataset.editableModifiedAbsHeight).toBe('533');
    expect(setState).toHaveBeenCalledWith({ x: 0, y: 0 });
  });
});
