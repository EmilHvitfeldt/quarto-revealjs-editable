/** Source-only HTML helpers. Offsets always refer to the original QMD string. */

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);
const EXCLUDED_TAGS = new Set(['script', 'style', 'svg', 'math', 'template']);
const RAW_TEXT_TAGS = new Set(['script', 'style']);
const ENTITIES = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0',
  ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009', hairsp: '\u200a',
  Tab: '\t', NewLine: '\n', ZeroWidthSpace: '\u200b',
};

function decodeEntity(entity) {
  const body = entity.slice(1, -1);
  if (Object.hasOwn(ENTITIES, body)) return ENTITIES[body];
  if (!/^#(?:\d+|x[\da-f]+)$/i.test(body)) return entity;
  const hex = /^#x/i.test(body);
  const value = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
  return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
    ? String.fromCodePoint(value) : entity;
}

function decodeAttribute(value) {
  return value.replace(/&(?:[a-z][\da-z]*|#\d+|#x[\da-f]+);/gi, decodeEntity);
}

// A decoded character boundary maps back to its original attribute offset.
// This lets a CSS value change without re-encoding unrelated declarations.
function decodedAttributeOffsets(value) {
  let decoded = '';
  const offsets = [0];
  for (let i = 0; i < value.length;) {
    const entity = value[i] === '&'
      ? value.slice(i).match(/^&(?:[a-z][\da-z]*|#\d+|#x[\da-f]+);/i)?.[0]
      : null;
    const piece = entity ? decodeEntity(entity) : value[i];
    const end = i + (entity ? entity.length : 1);
    decoded += piece;
    for (let j = 0; j < piece.length; j++) offsets.push(j === piece.length - 1 ? end : i);
    i = end;
  }
  return { decoded, offsets };
}

function escapeAttribute(value, quote = '"') {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(quote === "'" ? /'/g : /"/g, quote === "'" ? '&#39;' : '&quot;');
}

function readTag(source, start) {
  const match = source.slice(start).match(/^<(\/?)([a-z][\da-z:-]*)(?=[\s/>])/i);
  if (!match) return null;
  let quote = null;
  for (let i = start + match[0].length; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      const literal = source.slice(start, i + 1);
      if (match[1] && !/^<\/[a-z][\da-z:-]*\s*>$/i.test(literal)) return null;
      return {
        tagName: match[2].toLowerCase(), start, end: i + 1,
        closing: !!match[1], selfClosing: /\/\s*>$/.test(literal),
      };
    }
  }
  return null;
}

function attributes(opening) {
  const result = [];
  let i = opening.match(/^<[a-z][\da-z:-]*/i)?.[0].length ?? opening.length;
  while (i < opening.length) {
    while (/\s/.test(opening[i] ?? '') && i < opening.length) i++;
    if (opening[i] === '>' || /^\/\s*>/.test(opening.slice(i))) break;
    const start = i;
    while (i < opening.length && !/[\s=<>/]/.test(opening[i])) i++;
    if (i === start) { i++; continue; }
    const name = opening.slice(start, i).toLowerCase();
    const nameEnd = i;
    while (/\s/.test(opening[i] ?? '') && i < opening.length) i++;
    let value = null;
    let quote = null;
    let valueStart = i;
    let valueEnd = i;
    if (opening[i] === '=') {
      i++;
      while (/\s/.test(opening[i] ?? '') && i < opening.length) i++;
      quote = opening[i] === '"' || opening[i] === "'" ? opening[i++] : null;
      valueStart = i;
      if (quote) {
        while (i < opening.length && opening[i] !== quote) i++;
      } else {
        while (i < opening.length && !/[\s>]/.test(opening[i])) i++;
      }
      valueEnd = i;
      value = opening.slice(valueStart, valueEnd);
      if (quote && opening[i] === quote) i++;
    } else {
      i = nameEnd;
    }
    result.push({ name, start, end: i, value, quote, valueStart, valueEnd });
  }
  return result;
}

function meaningful(text) {
  return /[^\s\u200b-\u200d\u2060\ufeff]/u.test(decodeAttribute(text));
}

function lineEnd(source, start) {
  const end = source.indexOf('\n', start);
  return end < 0 ? source.length : end + 1;
}

function fenceAt(source, start) {
  const end = lineEnd(source, start);
  const match = source.slice(start, end).match(/^[ \t]{0,3}(`{3,}|~{3,})([^\r\n]*)\r?\n?$/);
  if (!match) return null;
  return { marker: match[1][0], length: match[1].length, info: match[2].trim(), end };
}

function closingFence(fence, current) {
  return current && current.marker === fence.marker && current.length >= fence.length && !current.info;
}

/**
 * Index balanced authored HTML text elements, including nested text containers.
 * Markdown code fences are skipped unless their language is {=html}. Comments
 * and script/style/svg/math/template subtrees contribute no editable text.
 * A pre with a code child yields code; syntax markup inside either is ignored.
 * Ordinals count all eligible same-tag openings, including textless elements.
 *
 * @param {string} chunk Original source, usually one slide chunk.
 * @returns {Array<{tagName:string, opening:string, inner:string, literal:string,
 * start:number, openEnd:number, closeStart:number, end:number, id:string|null,
 * elementId:string|null, classes:string[], ordinal:number,
 * textRuns:Array<{start:number,end:number,literal:string}>}>}
 */
export function htmlTextElements(chunk) {
  const stack = [];
  const records = [];
  const ordinals = new Map();
  let fence = null;
  let i = 0;
  while (i < chunk.length) {
    const inCode = stack.some(frame => frame.tagName === 'pre' || frame.tagName === 'code');
    const excluded = stack.some(frame => frame.excluded);
    if (!inCode && !excluded && (i === 0 || chunk[i - 1] === '\n')) {
      const current = fenceAt(chunk, i);
      if (fence && closingFence(fence, current)) {
        fence = null;
        i = current.end;
        continue;
      }
      if (!fence && current && !(current.marker === '`' && current.info.includes('`'))) {
        fence = current;
        i = current.end;
        if (!/^\{\s*=\s*html\s*\}$/i.test(current.info)) {
          while (i < chunk.length) {
            const closing = fenceAt(chunk, i);
            if (closingFence(fence, closing)) { i = closing.end; fence = null; break; }
            i = lineEnd(chunk, i);
          }
        }
        continue;
      }
    }
    if (chunk.startsWith('<!--', i)) {
      const end = chunk.indexOf('-->', i + 4);
      i = end < 0 ? chunk.length : end + 3;
      continue;
    }
    if (chunk[i] === '<') {
      const token = readTag(chunk, i);
      if (token) {
        if (token.closing) {
          let matching = stack.length - 1;
          while (matching >= 0 && stack[matching].tagName !== token.tagName) matching--;
          if (matching >= 0) {
            const frame = stack[matching];
            const balanced = matching === stack.length - 1;
            stack.length = matching;
            if (balanced && frame.recordable && frame.hasText && !frame.hasCodeChild) {
              if (frame.tagName === 'code') {
                for (const ancestor of stack) if (ancestor.tagName === 'pre') ancestor.hasCodeChild = true;
              }
              const opening = chunk.slice(frame.start, frame.openEnd);
              const attrs = attributes(opening);
              const attr = name => {
                const value = attrs.find(item => item.name === name)?.value;
                return value == null ? null : decodeAttribute(value);
              };
              records.push({
                tagName: frame.tagName, opening,
                inner: chunk.slice(frame.openEnd, i),
                literal: chunk.slice(frame.start, token.end),
                start: frame.start, openEnd: frame.openEnd, closeStart: i, end: token.end,
                id: attr('data-editable-text-id'), elementId: attr('id'),
                classes: (attr('class') ?? '').split(/\s+/).filter(Boolean),
                ordinal: frame.ordinal, textRuns: frame.textRuns,
              });
            }
          }
        } else if (RAW_TEXT_TAGS.has(token.tagName)) {
          const close = new RegExp(`</${token.tagName}\\s*>`, 'gi');
          close.lastIndex = token.end;
          const match = close.exec(chunk);
          i = match ? close.lastIndex : chunk.length;
          continue;
        } else if (!VOID_TAGS.has(token.tagName)) {
          const isExcluded = excluded || EXCLUDED_TAGS.has(token.tagName);
          const codeParent = stack.some(frame => frame.tagName === 'code');
          const recordable = !isExcluded && (!inCode || (token.tagName === 'code' && !codeParent));
          const ordinal = recordable ? (ordinals.get(token.tagName) ?? 0) : -1;
          if (recordable) ordinals.set(token.tagName, ordinal + 1);
          if (token.selfClosing) { i = token.end; continue; }
          stack.push({
            tagName: token.tagName, start: i, openEnd: token.end,
            excluded: isExcluded, recordable, ordinal, hasText: false, hasCodeChild: false, textRuns: [],
          });
        }
        i = token.end;
        continue;
      }
      if (/^<!|^<\?/.test(chunk.slice(i, i + 2))) {
        const end = chunk.indexOf('>', i + 2);
        i = end < 0 ? chunk.length : end + 1;
        continue;
      }
    }
    let end = i + 1;
    while (end < chunk.length && chunk[end] !== '<' && chunk[end - 1] !== '\n') end++;
    if (!excluded) {
      const direct = stack[stack.length - 1];
      if (direct?.recordable) {
        const previous = direct.textRuns[direct.textRuns.length - 1];
        if (previous?.end === i) {
          previous.end = end;
          previous.literal += chunk.slice(i, end);
        } else {
          direct.textRuns.push({ start: i, end, literal: chunk.slice(i, end) });
        }
      }
      if (meaningful(chunk.slice(i, end))) {
        for (const frame of stack) if (!frame.excluded) frame.hasText = true;
      }
    }
    i = end;
  }
  return records.sort((a, b) => a.start - b.start);
}

// Find CSS separators outside quoted values, comments, and nested functions.
function cssSeparators(text, separator) {
  const result = [];
  let quote = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = null;
    } else if (char === '\\') {
      i++;
    } else if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 1;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if ('([{'.includes(char)) {
      depth++;
    } else if (')]}'.includes(char)) {
      depth = Math.max(0, depth - 1);
    } else if (char === separator && depth === 0) {
      result.push(i);
    }
  }
  return result;
}

function cssDeclarations(text) {
  const result = [];
  let start = 0;
  for (const end of [...cssSeparators(text, ';'), text.length]) {
    const content = text.slice(start, end);
    const colon = cssSeparators(content, ':')[0];
    if (colon !== undefined) {
      const property = content.slice(0, colon).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (/^(?:--[\w-]+|[-a-z][\w-]*)$/i.test(property)) {
        const valueOffset = colon + 1;
        const rawValue = content.slice(valueOffset);
        const leading = rawValue.length - rawValue.trimStart().length;
        const trailing = rawValue.length - rawValue.trimEnd().length;
        result.push({
          property, key: property.startsWith('--') ? property : property.toLowerCase(),
          value: rawValue.trim(), valueStart: start + valueOffset + leading,
          valueEnd: start + Math.max(valueOffset + leading, content.length - trailing),
        });
      }
    }
    start = end + 1;
  }
  return result;
}

function mergeStyle(rawStyle, quote, styleText, translate) {
  const { decoded, offsets } = decodedAttributeOffsets(rawStyle);
  const existing = cssDeclarations(decoded);
  const updates = new Map();
  if (styleText !== undefined) {
    if (typeof styleText !== 'string') throw new TypeError('styleText must be a CSS declaration string');
    for (const declaration of cssDeclarations(styleText)) updates.set(declaration.key, declaration);
  }
  if (translate !== undefined) {
    if (!translate || !Number.isFinite(translate.x) || !Number.isFinite(translate.y)) {
      throw new TypeError('translate must contain finite numeric x and y coordinates');
    }
    updates.set('translate', { property: 'translate', value: `${translate.x}px ${translate.y}px` });
  }
  const patches = [];
  const found = new Set();
  for (const declaration of existing) {
    const update = updates.get(declaration.key);
    if (!update) continue;
    found.add(declaration.key);
    patches.push({ start: offsets[declaration.valueStart], end: offsets[declaration.valueEnd],
      value: escapeAttribute(update.value, quote) });
  }
  let result = rawStyle;
  for (const patch of patches.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, patch.start) + patch.value + result.slice(patch.end);
  }
  const additions = [...updates].filter(([key]) => !found.has(key)).map(([, update]) =>
    escapeAttribute(`${update.property}: ${update.value};`, quote));
  if (additions.length) {
    const end = result.trimEnd().length;
    const prefix = result.slice(0, end);
    result = prefix + (prefix ? (/;$/.test(prefix) ? ' ' : '; ') : '') +
      additions.join(' ') + result.slice(end);
  }
  return result;
}

function setAttribute(opening, name, encodedValue) {
  const attr = attributes(opening).find(item => item.name === name);
  if (attr) {
    if (attr.value !== null && attr.quote) {
      return opening.slice(0, attr.valueStart) + encodedValue(attr.quote) + opening.slice(attr.valueEnd);
    }
    return opening.slice(0, attr.start) + `${name}="${encodedValue('"')}"` + opening.slice(attr.end);
  }
  const ending = opening.match(/\s*\/?\s*>$/);
  const at = ending ? ending.index : opening.length - 1;
  return opening.slice(0, at) + ` ${name}="${encodedValue('"')}"` + opening.slice(at);
}

/**
 * Change only the editable ID and requested CSS declarations in an opening tag.
 * styleText merges declarations. translate uses independent CSS translate in px,
 * preserving transform and all unrelated attributes/declaration source bytes.
 *
 * @param {string} opening Original opening tag.
 * @param {{id?:string, translate?:{x:number,y:number}, styleText?:string}} options
 * @returns {string}
 */
export function patchHtmlOpening(opening, { id, translate, styleText } = {}) {
  const token = readTag(opening, 0);
  if (!token || token.closing || token.end !== opening.length) {
    throw new TypeError('Expected one complete HTML opening tag');
  }
  let result = opening;
  if (id !== undefined) {
    if (typeof id !== 'string') throw new TypeError('id must be a string');
    result = setAttribute(result, 'data-editable-text-id', quote => escapeAttribute(id, quote));
  }
  if (translate !== undefined || styleText !== undefined) {
    const attr = attributes(result).find(item => item.name === 'style');
    const style = attr?.value ?? '';
    result = setAttribute(result, 'style', quote => mergeStyle(style, quote, styleText, translate));
  }
  return result;
}
