/** Find authored slide headings without interpreting sample code as slides. */
export function sourceSlideHeadings(source) {
  const headings = [];
  let offset = 0;
  let fence = null;
  let frontmatter = false;
  for (const line of source.match(/[^\n]*\n|[^\n]+$/g) || []) {
    const text = line.replace(/\r?\n$/, '');
    if (offset === 0 && text === '---') frontmatter = true;
    else if (frontmatter && /^(?:---|\.\.\.)\s*$/.test(text)) frontmatter = false;
    else if (!frontmatter) {
      const marker = text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      } else if (marker) {
        fence = marker[1];
      } else {
        const heading = text.match(/^##[ \t]+(.+)$/);
        if (heading) headings.push({ start: offset, title: heading[1], line: text });
      }
    }
    offset += line.length;
  }
  return headings;
}
