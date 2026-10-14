import { describe, it, expect } from 'vitest';
import { svgOccurrences, replaceSVGSource } from '../svg-source.js';

describe('source-backed vector editing', () => {
  it('indexes external diagrams and balanced nested SVGs in source order', () => {
    const source='## Slide\n\n![A](assets/a.svg?x=1){width=300px}\n\n```{=html}\n<svg viewBox="0 0 10 10"><svg><rect/></svg></svg><img src="b.svg">\n```';
    const records=svgOccurrences(source);
    expect(records.map(record=>record.kind)).toEqual(['image','svg','image']);
    expect(records[1].literal).toBe('<svg viewBox="0 0 10 10"><svg><rect/></svg></svg>');
    expect(records[0].src).toBe('assets/a.svg?x=1');
  });
  it('ignores quoted examples, comments and script strings', () => {
    const source='```python\nprint("<svg></svg>")\n```\n<!-- <img src="a.svg"> -->\n<script>"<svg></svg>"</script>\n<svg data-editable-svg-id="real"><text>Live</text></svg>';
    expect(svgOccurrences(source).map(record=>record.id)).toEqual(['real']);
  });
  it('inlines just one repeated external image and remains replaceable on cumulative saves', () => {
    const source='## S\n\n![A](a.svg)\n\n![B](a.svg)\n';
    const anchor={...svgOccurrences(source)[1],id:'saved'};
    const moved='<svg data-editable-svg-id="saved"><path transform="translate(5 8)"/></svg>';
    const once=replaceSVGSource(source,anchor,moved);
    expect(once).toContain('![A](a.svg)');
    expect(once).not.toContain('![B](a.svg)');
    expect(once).toContain('```{=html}');
    expect(replaceSVGSource(once,anchor,moved)).toBe(once);
  });
  it('replaces inline SVG without touching enclosing fragments or following source', () => {
    const source='<div class="fragment"><svg><path/></svg></div><p>Keep</p>';
    expect(replaceSVGSource(source,{...svgOccurrences(source)[0],id:'edit'},'<svg data-editable-svg-id="edit"><path transform="translate(1 2)"/></svg>')).toBe('<div class="fragment"><svg data-editable-svg-id="edit"><path transform="translate(1 2)"/></svg></div><p>Keep</p>');
  });
  it('refuses to substitute a different image after external edits', () => {
    const anchor={...svgOccurrences('![A](a.svg)')[0],id:'edit'};
    expect(()=>replaceSVGSource('![B](b.svg)',anchor,'<svg/>')).toThrow('Cannot locate diagram source');
  });
});
