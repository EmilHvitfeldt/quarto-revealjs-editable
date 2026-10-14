/** Index source diagram instances without treating sample code as drawings. */
export function svgOccurrences(source) {
  let fence = null;
  const visible = source.split(/(?<=\n)/).map(line => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})([^\n]*)/);
    if (match) {
      if (fence && match[1][0] === fence.mark && match[1].length >= fence.length && !match[2].trim()) {
        fence = null;
        return line.replace(/[^\n]/g, ' ');
      }
      if (!fence) fence = { mark: match[1][0], length: match[1].length, html: /^\{\s*=html\s*\}$/.test(match[2].trim()) };
      return line.replace(/[^\n]/g, ' ');
    }
    return fence && !fence.html ? line.replace(/[^\n]/g, ' ') : line;
  }).join('').replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, text => text.replace(/[^\n]/g, ' '));
  const tag = '<(?:svg|img)\\b(?:[^"\'<>]|"[^"]*"|\'[^\']*\')*>|<\\/svg\\s*>';
  const image = '!\\[[^\\]\\n]*\\]\\(([^)\\n]+)\\)(?:\\{[^}]*\\})?';
  const tokens = new RegExp(`${tag}|${image}`, 'gi');
  const records = [];
  let depth = 0, root = null;
  for (const match of visible.matchAll(tokens)) {
    const literal = source.slice(match.index, match.index + match[0].length);
    if (/^<svg\b/i.test(literal)) {
      if (!depth) root = { start: match.index, opening: literal, kind: 'svg' };
      if (!/\/\s*>$/.test(literal)) depth++;
      else if (!depth) records.push({ ...root, end: match.index + literal.length });
    } else if (/^<\/svg/i.test(literal)) {
      if (depth && !--depth) records.push({ ...root, end: match.index + literal.length });
    } else if (!depth) {
      const src = literal.startsWith('<')
        ? literal.match(/\s(?:src|data-src)\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find(value => value !== undefined)
        : match[1];
      if (src && /\.svg(?:[?#]|$)/i.test(src)) records.push({ start: match.index, end: match.index + literal.length, opening: literal, kind: 'image', src: src.replace(/&amp;/g, '&'), markdown: literal.startsWith('!') });
    }
  }
  return records.map((record, ordinal) => ({ ...record, ordinal, literal: source.slice(record.start, record.end), id: record.opening.match(/\sdata-editable-svg-id="([^"]+)"/)?.[1] }));
}

export function replaceSVGSource(chunk, anchor, svg) {
  const records = svgOccurrences(chunk);
  const target = records.find(record => record.id === anchor.id) ?? records[anchor.ordinal];
  if (!target || (target.id !== anchor.id && (target.kind !== anchor.kind || (anchor.kind === 'image' ? target.src !== anchor.src : target.opening !== anchor.opening)))) throw new Error('Cannot locate diagram source; reload before editing');
  const replacement = target.markdown ? `\n\n\`\`\`{=html}\n${svg}\n\`\`\`\n\n` : svg;
  return chunk.slice(0, target.start) + replacement + chunk.slice(target.end);
}
