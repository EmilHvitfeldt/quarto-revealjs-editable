/** Source-backed text selection, in-place movement and inline editing. */
import { editableRegistry } from './editable-element.js';
import { pushUndoState } from './undo.js';
import { getCurrentSlideIndex, getQmdHeadingIndex, getSlideScale } from './utils.js';
import { splitIntoSlideChunks } from './serialization.js';
import { htmlTextElements, patchHtmlOpening } from './text-source.js';

const anchors = new WeakMap();
const slideAnchors = new WeakMap();
const sourceIds = new Map();
const textRuns = new WeakMap();
let selected = null;
let order = 0;
let eventsStarted = false;
const blocked = 'script, style, svg, math, template, iframe, .ql-editor, .editable-toolbar, .editable-container, .slide-number, .notes';
const blockChildren = 'div, p, pre, table, ul, ol, img, video, iframe, svg, button, input';

function withIdentity(anchor, suffix = '') {
  const location = anchor.record ? `html:${anchor.record.tagName}:${anchor.record.ordinal}` : `${anchor.kind}:${anchor.original}`;
  const key = `${anchor.chunkIndex}:${location}${suffix}`;
  if (!sourceIds.has(key)) sourceIds.set(key, anchor.record?.id || `text-${crypto.randomUUID()}`);
  return { ...anchor, key, id: sourceIds.get(key) };
}

function normalized(text) { return text.replace(/\s+/g, ' ').trim(); }
function decoded(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return normalized(template.content.textContent);
}
function escapeHTML(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sameRecord(a, b) {
  return a.tagName === b.tagName && a.elementId === b.elementId &&
    a.classes.join(' ') === b.classes.join(' ') && decoded(a.inner) === decoded(b.inner);
}
function notifySelection() {
  document.dispatchEvent(new CustomEvent('editable-text-selection-change'));
}
function select(element) {
  selected?.classList.remove('editable-text-selected');
  selected = element;
  selected?.classList.add('editable-text-selected');
  notifySelection();
}
export function canEditSelectedText() {
  return Boolean(selected?.isConnected && editableRegistry.get(selected)?.type === 'plain-text');
}
export function editSelectedText() {
  if (canEditSelectedText()) editableRegistry.get(selected).edit();
}

function startEvents() {
  if (eventsStarted) return;
  eventsStarted = true;
  document.addEventListener('click', event => {
    if (event.target.closest('.editable-toolbar, [data-editable-text-id], [contenteditable]')) return;
    select(null);
  });
  document.addEventListener('editable-content-restored', () => {
    if (selected && !canEditSelectedText()) select(null);
    notifySelection();
  });
}

/** Never wrap a flex/grid/absolute label merely to move it. */
class InPlaceText {
  constructor(element, anchor) {
    this.element = element;
    this.container = anchor.wrapperId ? element.closest(`[id="${anchor.wrapperId}"]`) : element;
    this.anchor = anchor;
    this.type = 'plain-text';
    this.editing = false;
    const computed = getComputedStyle(this.container);
    this.inline = computed.display === 'inline';
    this.inlineBase = { x: Number.parseFloat(computed.left) || 0, y: Number.parseFloat(computed.top) || 0 };
    const terms = computed.translate.split(/\s+/);
    const coordinate = (value, size) => value?.endsWith('%')
      ? (Number.parseFloat(value) || 0) * size / 100 : Number.parseFloat(value) || 0;
    this.state = {
      x: coordinate(terms[0], element.offsetWidth),
      y: coordinate(terms[1], element.offsetHeight),
      edited: false, order: 0,
    };
    const previous = [...editableRegistry.values()]
      .filter(editable => editable.type === 'plain-text' && editable.element.isConnected && editable.anchor.key === anchor.key)
      .sort((a, b) => b.state.order - a.state.order)[0];
    if (previous) {
      this.state = { ...previous.state };
      this.applyPosition();
      if (this.state.edited) this.element.innerHTML = cleanInnerHTML(previous.element);
    }
    element.dataset.editableTextId = anchor.id;
    element.classList.add('editable-text-target');
    this.attach();
    select(element);
  }
  getState() { return { ...this.state }; }
  syncFromDOM() {}
  adoptLatest() {
    const latest = [...editableRegistry.values()]
      .filter(editable => editable.type === 'plain-text' && editable.element.isConnected && editable.anchor.key === this.anchor.key)
      .sort((a, b) => b.state.order - a.state.order)[0];
    if (!latest || latest.state.order <= this.state.order) return;
    this.state = { ...latest.state };
    this.applyPosition();
    if (this.state.edited) this.element.innerHTML = cleanInnerHTML(latest.element);
  }
  setState(updates) {
    Object.assign(this.state, updates);
    this.applyPosition();
  }
  applyPosition() {
    if (this.inline) {
      this.container.style.position = 'relative';
      this.container.style.left = `${this.inlineBase.x + this.state.x}px`;
      this.container.style.top = `${this.inlineBase.y + this.state.y}px`;
    } else {
      this.container.style.translate = `${this.state.x}px ${this.state.y}px`;
    }
  }
  getResizeHandles() { return []; }
  current() { return editableRegistry.get(this.element) === this; }
  attach() {
    let drag = null;
    const begin = event => {
      if (!this.current() || this.editing || event.button > 0 || !editorVisible()) return;
      if (event.target.closest('[data-editable-text-id]') !== this.element) return;
      this.adoptLatest();
      select(this.element);
      const pointer = event.touches?.[0] ?? event;
      drag = { x: pointer.clientX, y: pointer.clientY, initialX: this.state.x, initialY: this.state.y, scale: getSlideScale(), recorded: false };
      event.preventDefault();
      event.stopPropagation();
    };
    const move = event => {
      if (!drag || !this.current()) return;
      const pointer = event.touches?.[0] ?? event;
      const dx = pointer.clientX - drag.x, dy = pointer.clientY - drag.y;
      if (!drag.recorded) {
        if (Math.hypot(dx, dy) < 3) return;
        pushUndoState();
        drag.recorded = true;
      }
      this.setState({ x: drag.initialX + dx / drag.scale, y: drag.initialY + dy / drag.scale, order: ++order });
      event.preventDefault();
    };
    const end = () => { drag = null; };
    this.element.addEventListener('mousedown', begin);
    this.element.addEventListener('touchstart', begin, { passive: false });
    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);
    this.element.addEventListener('dblclick', event => {
      if (!this.current() || !editorVisible()) return;
      event.preventDefault(); event.stopPropagation(); this.edit();
    });
    this.element.addEventListener('keydown', event => {
      if (!this.current() || !editorVisible()) return;
      if (this.editing) {
        event.stopPropagation();
        if (event.key === 'Escape') {
          this.element.innerHTML = this.beforeEdit;
          this.state.edited = this.beforeEdited;
          this.element.blur();
        } else if (event.key === 'Enter' && this.element.tagName !== 'CODE' && !event.shiftKey) {
          event.preventDefault(); this.element.blur();
        }
        return;
      }
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!delta || event.ctrlKey || event.metaKey) return;
      this.adoptLatest();
      event.preventDefault(); event.stopPropagation(); pushUndoState();
      const step = event.shiftKey ? 10 : 1;
      this.setState({ x: this.state.x + delta[0] * step, y: this.state.y + delta[1] * step, order: ++order });
    });
    this.element.addEventListener('blur', () => this.finishEdit());
    this.element.addEventListener('input', () => {
      if (!this.editing) return;
      this.state.edited = true;
      this.state.order = ++order;
    });
  }
  edit() {
    if (this.editing) return;
    this.adoptLatest();
    select(this.element);
    pushUndoState({ root: this.element.closest('section') });
    this.beforeEdit = this.element.innerHTML;
    this.beforeEdited = this.state.edited;
    this.editing = true;
    this.element.contentEditable = 'true';
    this.element.classList.add('editable-text-active');
    this.element.focus();
    const range = document.createRange(); range.selectNodeContents(this.element);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }
  finishEdit() {
    if (!this.editing) return;
    this.editing = false;
    this.element.removeAttribute('contenteditable');
    this.element.classList.remove('editable-text-active');
    if (this.element.innerHTML !== this.beforeEdit) {
      if (this.element.tagName === 'CODE') this.element.textContent = this.element.innerText;
      this.state.edited = true;
      this.state.order = ++order;
    }
    this.syncFromDOM();
    document.dispatchEvent(new CustomEvent('editable-content-restored'));
  }
}

function editorVisible() {
  return document.documentElement.classList.contains('presentation-editor-visible');
}

function registerAnchor(element, anchor) {
  if (anchors.has(element)) return;
  anchors.set(element, anchor);
  if (anchor.kind === 'html') {
    [...element.childNodes].filter(node => node.nodeType === 3).forEach((node, index) => textRuns.set(node, index));
  }
}

function sourceAnchors(slide) {
  if (slideAnchors.has(slide)) return slideAnchors.get(slide);
  const chunkIndex = getQmdHeadingIndex(getCurrentSlideIndex()) + 1;
  const chunk = splitIntoSlideChunks(window._input_file || '')[chunkIndex];
  if (!chunk) return [];
  const records = htmlTextElements(chunk);
  const candidates = [...slide.querySelectorAll('*')].filter(element =>
    !element.closest(blocked) && (element.tagName === 'CODE' || !element.closest('pre, code')));
  const used = new Set();
  for (const record of records) {
    const choices = candidates.filter(element => !used.has(element) &&
      element.tagName.toLowerCase() === record.tagName &&
      (!record.elementId || element.id === record.elementId) &&
      record.classes.every(name => element.classList.contains(name)) &&
      (record.id ? element.dataset.editableTextId === record.id : normalized(element.textContent) === decoded(record.inner)));
    const element = choices[0];
    if (!element) continue;
    used.add(element);
    registerAnchor(element, withIdentity({
      kind: 'html', chunkIndex, record,
      sameIndex: records.filter(other => sameRecord(other, record)).indexOf(record),
    }));
  }
  // Markdown headings stay headings; movement is an ordinary heading style.
  const headings = [...chunk.matchAll(/^(#{1,6})[ \t]+(.+)$/gm)];
  for (const match of headings) {
    const title = match[2].replace(/\s*\{[^}]*\}\s*$/, '').replace(/[*`]/g, '').trim();
    const element = candidates.find(el => el.tagName === `H${match[1].length}` && normalized(el.textContent) === title);
    if (element) registerAnchor(element, withIdentity({ kind: 'heading', chunkIndex, original: match[0] }));
  }
  // Code fences are edited as code, without touching the surrounding language
  // declaration or importing Quill's rich text markup into protocol samples.
  for (const match of chunk.matchAll(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm)) {
    if (match[2].includes('=html')) continue;
    const element = candidates.find(el => el.tagName === 'CODE' && !anchors.has(el) && normalized(el.textContent) === normalized(match[3]));
    if (element) {
      const before = chunk.slice(0, match.index).match(/^::: \{#(text-[\w-]+) style="translate: [^"\n]+"\}\n$/m);
      const wrapped = before && before.index + before[0].length === match.index && chunk.slice(match.index + match[0].length).startsWith('\n:::');
      const original = wrapped ? before[0] + match[0] + '\n:::' : match[0];
      registerAnchor(element, withIdentity({ kind: 'code-fence', chunkIndex, original, fenceContent: match[0], wrapperId: wrapped ? before[1] : null, fence: match[1], language: match[2] }));
    }
  }
  const result = candidates.filter(element => anchors.has(element));
  slideAnchors.set(slide, result);
  return result;
}

function candidate(element) {
  if (!normalized(element.textContent)) return false;
  if (element.tagName === 'CODE') return true;
  if (element.closest('pre, code')) return false;
  const ownText = [...element.childNodes].some(node => node.nodeType === 3 && normalized(node.nodeValue));
  const richLabel = !element.querySelector(blockChildren);
  return ownText || richLabel;
}

function findRecord(records, anchor) {
  return records.find(record => record.id === anchor.id) ?? records.filter(record => sameRecord(record, anchor.record))[anchor.sameIndex];
}

/** Mixed containers stay in place; only their clicked direct text run moves. */
function isolateDirectText(element, event) {
  const anchor = anchors.get(element);
  if (anchor.kind !== 'html' || !element.querySelector(blockChildren)) return element;
  const nodes = [...element.childNodes].filter(node => node.nodeType === 3);
  const range = event && document.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = nodes.includes(range?.startContainer) ? range.startContainer : nodes.find(node => normalized(node.nodeValue));
  if (!node || !normalized(node.nodeValue)) return null;
  const index = textRuns.get(node);
  const run = anchor.record.textRuns[index];
  if (!run || decoded(run.literal) !== normalized(node.nodeValue)) return null;
  const span = document.createElement('span');
  span.style.display = 'inline-block';
  node.replaceWith(span);
  span.append(node);
  registerAnchor(span, withIdentity({ ...anchor, kind: 'text-run', runIndex: index }, `:run:${index}`));
  return span;
}

function cleanInnerHTML(element) {
  const copy = element.cloneNode(true);
  for (const node of [copy, ...copy.querySelectorAll('*')]) {
    node.classList.remove('editable-text-target', 'editable-text-selected', 'editable-text-active');
    node.removeAttribute('contenteditable');
    if (node.getAttribute('class') === '') node.removeAttribute('class');
  }
  return copy.innerHTML;
}

export const textClassifier = {
  label: 'Text and labels',
  classify(slide) {
    startEvents();
    const valid = sourceAnchors(slide).filter(element => candidate(element) && !editableRegistry.has(element));
    return { valid, warn: [] };
  },
  activate(element, event) {
    element = isolateDirectText(element, event);
    if (!element) return;
    element.setAttribute('tabindex', '0');
    const editable = new InPlaceText(element, anchors.get(element));
    editableRegistry.set(element, editable);
    notifySelection();
  },
  serialize(text) {
    const chunks = splitIntoSlideChunks(text);
    const selectedEdits = new Map();
    for (const [element, editable] of editableRegistry) {
      if (editable.type !== 'plain-text' || !element.isConnected) continue;
      const key = editable.anchor.key;
      if (!selectedEdits.has(key) || selectedEdits.get(key).state.order < editable.state.order) selectedEdits.set(key, editable);
    }
    const patches = new Map();
    const add = (chunkIndex, start, end, replacement) => {
      if (!patches.has(chunkIndex)) patches.set(chunkIndex, []);
      patches.get(chunkIndex).push({ start, end, replacement });
    };
    for (const editable of selectedEdits.values()) {
      const { element, anchor, state } = editable;
      const chunk = chunks[anchor.chunkIndex];
      if (!chunk) throw new Error('Cannot locate text source slide');
      if (anchor.kind === 'html' || anchor.kind === 'text-run') {
        const target = findRecord(htmlTextElements(chunk), anchor);
        if (!target) throw new Error(`Cannot locate text source: ${anchor.record.tagName}`);
        if (anchor.kind === 'text-run') {
          const run = target.textRuns[anchor.runIndex];
          if (!run) throw new Error('Cannot locate text source run');
          const opening = patchHtmlOpening('<span style="display: inline-block;">', { id: anchor.id, translate: { x: state.x, y: state.y } });
          add(anchor.chunkIndex, run.start, run.end, `${opening}${state.edited ? cleanInnerHTML(element) : run.literal}</span>`);
          continue;
        }
        add(anchor.chunkIndex, target.start, target.openEnd,
          patchHtmlOpening(target.opening, editable.inline
            ? { id: anchor.id, styleText: `position: relative; left: ${editable.inlineBase.x + state.x}px; top: ${editable.inlineBase.y + state.y}px;` }
            : { id: anchor.id, translate: { x: state.x, y: state.y } }));
        if (state.edited) add(anchor.chunkIndex, target.openEnd, target.closeStart,
          element.tagName === 'CODE' ? escapeHTML(element.innerText) : cleanInnerHTML(element));
      } else {
        const start = chunk.indexOf(anchor.original);
        if (start < 0) throw new Error('Cannot locate original text block');
        if (anchor.kind === 'code-fence') {
          let content = state.edited ? `${anchor.fence}${anchor.language}\n${element.innerText.replace(/\n?$/, '\n')}${anchor.fence}` : anchor.fenceContent;
          // Keep fenced-code movement in a source wrapper rather than flattening it.
          if (state.x || state.y || anchor.wrapperId) {
            content = `::: {#${anchor.wrapperId || anchor.id} style="translate: ${state.x}px ${state.y}px;"}\n${content}\n:::`;
          }
          if (content !== anchor.original) add(anchor.chunkIndex, start, start + anchor.original.length, content);
        } else {
          const line = anchor.original;
          const attributes = line.match(/\s*\{([^}]*)\}\s*$/)?.[1] || '';
          const oldStyle = attributes.match(/\bstyle=(?:"([^"]*)"|'([^']*)')/);
          const styleTag = patchHtmlOpening(`<span style="${(oldStyle?.[1] ?? oldStyle?.[2] ?? '').replace(/"/g, '&quot;')}">`, { translate: { x: state.x, y: state.y } });
          const style = styleTag.match(/\sstyle="([^"]*)"/)[1];
          const attrs = attributes.replace(/\bstyle=(?:"[^"]*"|'[^']*')/, '').trim();
          const title = state.edited ? normalized(element.textContent) : line.replace(/^#+\s+/, '').replace(/\s*\{[^}]*\}\s*$/, '');
          const prefix = line.match(/^#+/)[0];
          add(anchor.chunkIndex, start, start + line.length, `${prefix} ${title} {${attrs}${attrs ? ' ' : ''}style="${style}"}`);
        }
      }
    }
    for (const [index, edits] of patches) {
      // Replacing a parent includes its current descendant markup, so discard
      // contained patches before applying source offsets from right to left.
      const outer = edits.filter(edit => !edits.some(parent => parent !== edit && parent.start <= edit.start && parent.end >= edit.end && (parent.start < edit.start || parent.end > edit.end)));
      outer.sort((a, b) => b.start - a.start);
      for (const patch of outer) {
        chunks[index] = chunks[index].slice(0, patch.start) + patch.replacement + chunks[index].slice(patch.end);
      }
    }
    return chunks.join('');
  },
};
