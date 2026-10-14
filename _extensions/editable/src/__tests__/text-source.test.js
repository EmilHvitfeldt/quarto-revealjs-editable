import { describe, expect, it } from 'vitest';
import { htmlTextElements, patchHtmlOpening } from '../text-source.js';

describe('htmlTextElements', () => {
  it('returns nested text elements and exact original source slices', () => {
    const source = 'Before\r\n<DIV class="outer active" id="authored" data-editable-text-id="saved&amp;id">' +
      '<p title="x > y">Hello <strong>world</strong> <em>again</em> <a href="/?x=1&amp;y=2">link</a></p>' +
      '<label>Label <span>child</span></label><h2>Heading</h2></DIV>\r\nAfter';
    const records = htmlTextElements(source);
    expect(records.map(record => record.tagName)).toEqual(['div', 'p', 'strong', 'em', 'a', 'label', 'span', 'h2']);
    expect(records[0]).toMatchObject({
      id: 'saved&id', elementId: 'authored', classes: ['outer', 'active'], ordinal: 0,
    });
    expect(records[1].opening).toBe('<p title="x > y">');
    for (const record of records) {
      expect(source.slice(record.start, record.end)).toBe(record.literal);
      expect(source.slice(record.start, record.openEnd)).toBe(record.opening);
      expect(source.slice(record.openEnd, record.closeStart)).toBe(record.inner);
      expect(source.slice(record.closeStart, record.end)).toMatch(/^<\//);
    }
  });

  it('counts repeated same-tag openings, including empty authored elements', () => {
    const records = htmlTextElements('<p></p><p>same</p><div><p>same</p><span>&nbsp; &#32;</span><span>last</span></div>');
    expect(records.filter(record => record.tagName === 'p').map(record => record.ordinal)).toEqual([1, 2]);
    expect(records.find(record => record.tagName === 'span').ordinal).toBe(1);
    expect(records.filter(record => record.tagName === 'p').map(record => record.inner)).toEqual(['same', 'same']);
  });

  it('records direct text runs with absolute offsets, including tails and whitespace', () => {
    const source = '<div>\nFirst line\nsecond <b>bold</b> tail<!-- hidden -->after comment\n<span>child</span> </div>';
    const records = htmlTextElements(source);
    expect(records[0].textRuns.map(run => run.literal)).toEqual([
      '\nFirst line\nsecond ', ' tail', 'after comment\n', ' ',
    ]);
    expect(records[1].textRuns.map(run => run.literal)).toEqual(['bold']);
    for (const record of records) {
      for (const run of record.textRuns) expect(source.slice(run.start, run.end)).toBe(run.literal);
    }
  });

  it('skips comments, excluded subtrees, and HTML-looking non-HTML fences', () => {
    const source = '<!-- <p>comment</p> -->\n' +
      '```python\n<p>python</p>\n```\n' +
      '~~~~text\n<span>code</span>\n~~~\n~~~~\n' +
      '<script>const s = "<p>script</p>";</script>' +
      '<style>.a::after { content: "<p>style</p>"; }</style>' +
      '<svg><text>figure</text><foreignObject><p>nested</p></foreignObject></svg>' +
      '<math><mtext>formula</mtext></math><template><p>template</p></template>' +
      '<div><img src="x"><br><span>visible</span></div>\n' +
      '```{=html}\n<p>raw <b>HTML</b></p>\n```\n<p>prose</p>';
    const records = htmlTextElements(source);
    expect(records.map(record => record.tagName)).toEqual(['div', 'span', 'p', 'b', 'p']);
    expect(records.filter(record => record.tagName === 'p').map(record => record.ordinal)).toEqual([0, 1]);
    expect(htmlTextElements('<div><!-- hidden --><svg><text>hidden</text></svg></div>')).toEqual([]);
  });

  it('handles raw HTML fences with quoted delimiters and preserves source offsets', () => {
    const source = '~~~{=html}\r\n<p data-note=\'one > two\'>A &amp; B</p>\r\n~~~\r\n' +
      '````{=html}\n<span>kept</span>\n```\n<span>also kept</span>\n````\n';
    const records = htmlTextElements(source);
    expect(records.map(record => record.inner)).toEqual(['A &amp; B', 'kept', 'also kept']);
    expect(records[0].start).toBe(source.indexOf('<p'));
    expect(records[0].opening).toBe('<p data-note=\'one > two\'>');
  });

  it('keeps a pre/code source block intact and ignores its syntax spans', () => {
    const code = '\n<span class="token keyword">Measure</span>(mode=&quot;OD600&quot;)\n' +
      '&lt;p title=&quot;quoted &gt; value&quot;&gt;literal&lt;/p&gt;\n```python\n';
    const source = `<pre class="prism"><code class="language-python">${code}</code></pre>` +
      '<pre>plain &lt;source&gt;</pre><code>inline <span>token</span></code><span>outside</span>';
    const records = htmlTextElements(source);
    expect(records.map(record => record.tagName)).toEqual(['code', 'pre', 'code', 'span']);
    expect(records[0].inner).toBe(code);
    expect(records[0].classes).toEqual(['language-python']);
    expect(records[3].ordinal).toBe(0);
    expect(source.slice(records[0].openEnd, records[0].closeStart)).toBe(code);
    expect(htmlTextElements('<pre>fallback <code></code></pre>').map(record => record.tagName)).toEqual(['pre']);
  });

  it('does not invent closing tags or index an unterminated fence or comment', () => {
    expect(htmlTextElements('<div><p>balanced child</p>')).toHaveLength(1);
    expect(htmlTextElements('<p>not closed')).toEqual([]);
    expect(htmlTextElements('```python\n<p>not HTML</p>')).toEqual([]);
    expect(htmlTextElements('<!-- <p>not HTML</p>')).toEqual([]);
    expect(htmlTextElements('<p><strong>crossed</p></strong>')).toEqual([]);
  });
});

describe('patchHtmlOpening', () => {
  it('adds an editable identity and movement while preserving authored attributes and CSS', () => {
    const opening = '<p  id=authored data-title="x > y" class=\'a b\' style="color: red; transform: rotate(12deg); --url: url(\'a;b\');" >';
    expect(patchHtmlOpening(opening, { id: 'new&id', translate: { x: 12.5, y: -8 } })).toBe(
      '<p  id=authored data-title="x > y" class=\'a b\' style="color: red; transform: rotate(12deg); --url: url(\'a;b\'); translate: 12.5px -8px;" data-editable-text-id="new&amp;id" >',
    );
  });

  it('patches only requested CSS values, including quoted and encoded delimiters', () => {
    const opening = '<span data-other=\'keep\' data-editable-text-id=\'old\' style=\'font-family: &quot;A;B&quot;; color : red ; translate: 1px 2px; transform: scale(2); --a: "x;y";\'>';
    const patched = patchHtmlOpening(opening, {
      id: 'new\'"<&', translate: { x: 0, y: 3 }, styleText: 'color: blue; font-weight: 700;',
    });
    expect(patched).toBe('<span data-other=\'keep\' data-editable-text-id=\'new&#39;"&lt;&amp;\' style=\'font-family: &quot;A;B&quot;; color : blue ; translate: 0px 3px; transform: scale(2); --a: "x;y"; font-weight: 700;\'>');
    const record = htmlTextElements(`${patched}label</span>`)[0];
    expect(record.id).toBe('new\'"<&');
    expect(record.elementId).toBeNull();
  });

  it('preserves the full inner protocol source when changing its opening tag', () => {
    const source = '<pre><code class="language-python">Measure(mode=&quot;OD600&quot;)\r\n' +
      '# &lt;em&gt;verbatim&lt;/em&gt;\r\n</code></pre>';
    const code = htmlTextElements(source)[0];
    const patched = source.slice(0, code.start) + patchHtmlOpening(code.opening, {
      id: 'protocol', translate: { x: -3, y: 0 },
    }) + source.slice(code.openEnd);
    expect(htmlTextElements(patched)[0].inner).toBe(code.inner);
    expect(patched).toBe('<pre><code class="language-python" data-editable-text-id="protocol" style="translate: -3px 0px;">' + code.inner + '</code></pre>');
  });

  it('retains untouched opening tags exactly and updates an existing translation', () => {
    const opening = '<DIV\n style="color: red; translate: 0px 0px;" data-editable-text-id="same">';
    expect(patchHtmlOpening(opening)).toBe(opening);
    expect(patchHtmlOpening(opening, { translate: { x: 1, y: 2 } })).toBe(
      '<DIV\n style="color: red; translate: 1px 2px;" data-editable-text-id="same">',
    );
    expect(patchHtmlOpening('<span style=color:red>', { styleText: 'font-size: 20px' })).toBe(
      '<span style="color:red; font-size: 20px;">',
    );
  });

  it('handles boolean attributes, CSS comments, custom properties, and self-closing endings', () => {
    const patched = patchHtmlOpening('<label style disabled data-editable-text-id />', {
      id: 'label', styleText: '--Label: "a;b"; font-family: "A;B";', translate: { x: 2, y: 4 },
    });
    expect(patched).toBe('<label style="--Label: &quot;a;b&quot;; font-family: &quot;A;B&quot;; translate: 2px 4px;" disabled data-editable-text-id="label" />');
    expect(patchHtmlOpening('<p style="/* keep; */ color: red; --Label: A; --label: B">', {
      styleText: 'color: blue; --Label: C;',
    })).toBe('<p style="/* keep; */ color: blue; --Label: C; --label: B">');
    expect(patchHtmlOpening('<p style="font-family: A\\;B; color: red;">', {
      styleText: 'font-family: C\\;D;',
    })).toBe('<p style="font-family: C\\;D; color: red;">');
  });

  it('rejects invalid tag or coordinate inputs', () => {
    expect(() => patchHtmlOpening('</p>', { id: 'bad' })).toThrow(/opening tag/);
    expect(() => patchHtmlOpening('<p>text', { id: 'bad' })).toThrow(/opening tag/);
    expect(() => patchHtmlOpening('<p>', { translate: { x: NaN, y: 2 } })).toThrow(/finite/);
    expect(() => patchHtmlOpening('<p>', { translate: { x: 1, y: Infinity } })).toThrow(/finite/);
    expect(() => patchHtmlOpening('<p>', { id: 1 })).toThrow(/string/);
  });
});
