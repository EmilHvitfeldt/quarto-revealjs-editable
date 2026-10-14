import { describe, expect, it } from 'vitest';
import { sourceSlideHeadings } from '../source-slides.js';

describe('source slide boundaries', () => {
  it('ignores headings inside Markdown and HTML sample fences', () => {
    const source = '## Instructions {#instructions}\n\n```markdown\n## Robot CLI\n```\n\n```{=html}\n<pre>\n## Sample heading\n</pre>\n```\n\n## Next {#next}\n';
    const headings = sourceSlideHeadings(source);
    expect(headings.map(heading => heading.title)).toEqual(['Instructions {#instructions}', 'Next {#next}']);
    expect(source.slice(headings[1].start)).toBe('## Next {#next}\n');
  });

  it('handles longer tilde fences, CRLF and closing fences with whitespace', () => {
    const source = '## First\r\n~~~~python\r\n## Not a slide\r\n~~~\r\n## Still code\r\n~~~~  \r\n## Second\r\n';
    expect(sourceSlideHeadings(source).map(heading => heading.title)).toEqual(['First', 'Second']);
  });

  it('ignores frontmatter and records exact original byte offsets', () => {
    const source = '---\ntitle: Test\n## YAML text\n---\n\nPreamble\n\n## Main\n';
    expect(sourceSlideHeadings(source)).toEqual([{ start: source.indexOf('## Main'), title: 'Main', line: '## Main' }]);
  });

  it('returns no phantom headings in an unclosed code fence', () => {
    expect(sourceSlideHeadings('```python\n## code\n')).toEqual([]);
  });
});
