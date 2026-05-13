/**
 * Modify-mode helpers for re-activating elements that are *already* positioned
 * (wrapped in `::: {.absolute …}` or carrying `{.absolute}` themselves).
 *
 * Two consumers:
 *   1. The existing `Positioned divs` and `Positioned images` classifiers,
 *      which use `registerPositionedClassifier()` to share the dataset
 *      bookkeeping / activation / chunk-regex-replace serialize boilerplate.
 *   2. Issue #140's forthcoming per-type re-activation classifiers
 *      (paragraphs, blockquotes, lists, equations, code, tables, …) which
 *      use `findFenceForPositionedElement()` to locate the outer
 *      `::: {.absolute}` fence around an inner element in the QMD source.
 *
 * Phase 0 (this file) is behavior-preserving for the two existing classifiers
 * apart from one bug fix: positioned images now share the occurrence-counter
 * dedup that positioned divs already had, so two same-src same-size images on
 * one slide are rewritten independently.
 *
 * @module modify-mode-positioned
 */

import { editableRegistry } from './editable-element.js';
import { splitIntoSlideChunks } from './serialization.js';
import { getQmdHeadingIndex } from './utils.js';

/* eslint-env browser */
/* global Reveal */

/**
 * Read left/top/width/height from a positioned element's inline styles.
 * Returns null if any value is missing — caller treats that as "can't match
 * back to source".
 */
export function getAbsolutePosition(el) {
  const s = el.style;
  const left   = s.left   ? parseFloat(s.left)   : null;
  const top    = s.top    ? parseFloat(s.top)    : null;
  const width  = s.width  ? parseFloat(s.width)  : null;
  const height = s.height ? parseFloat(s.height) : null;
  if (left === null || top === null || width === null || height === null) return null;
  return { left, top, width, height };
}

/**
 * Parse top-level `::: {.absolute …}` fences from a slide-chunk string.
 * Nested fences inside an `.absolute` block are not returned. Used by
 * `findFenceForPositionedElement` and by tests.
 *
 * @param {string} chunk
 * @returns {Array<{fenceLineIndex: number, closeLineIndex: number, attrsStr: string, fenceLen: number}>}
 */
export function parseAbsoluteFences(chunk) {
  const lines = chunk.split('\n');
  const result = [];
  /** @type {Array<{fenceLen: number, resultIdx: number|undefined}>} */
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(:{3,})\s*(\{([^}]*)\})?\s*$/);
    if (!m) continue;
    const fenceLen = m[1].length;
    const hasBraces = m[2] !== undefined;
    const attrsStr = (m[3] || '').trim();

    // Bare `:::` closes the innermost open fence at or below its length.
    if (!hasBraces && stack.length > 0 && fenceLen >= stack[stack.length - 1].fenceLen) {
      const top = stack.pop();
      if (top.resultIdx !== undefined) result[top.resultIdx].closeLineIndex = i;
      continue;
    }

    const hasAbsolute = /(^|\s)\.absolute(\s|$)/.test(attrsStr);
    // Only track top-level .absolute fences in the result; inner fences still
    // push to the stack so their close `:::` is consumed correctly.
    const isTopLevelAbsolute = hasAbsolute && stack.length === 0;
    let resultIdx;
    if (isTopLevelAbsolute) {
      resultIdx = result.length;
      result.push({ fenceLineIndex: i, closeLineIndex: -1, attrsStr, fenceLen });
    }
    stack.push({ fenceLen, resultIdx });
  }

  // Drop fences that never closed — they're malformed and not safe to rewrite.
  return result.filter(e => e.closeLineIndex !== -1);
}

/**
 * Locate the `::: {.absolute …}` fence in `chunk` that wraps the given
 * inner element. Anchor strategies are tried in order; the first that
 * yields exactly one matching fence wins.
 *
 * Each anchor is `{ kind: string, test(fence, index, allFences) → bool }`.
 *
 * @param {string} chunk Slide-chunk source as it appears in QMD.
 * @param {{anchors: Array<{kind: string, test: Function}>}} opts
 * @returns {{fenceLineIndex: number, closeLineIndex: number, attrsStr: string, anchorKind: string} | null}
 */
export function findFenceForPositionedElement(chunk, { anchors } = { anchors: [] }) {
  const fences = parseAbsoluteFences(chunk);
  if (fences.length === 0) return null;

  for (const anchor of anchors) {
    const hits = [];
    for (let i = 0; i < fences.length; i++) {
      if (anchor.test(fences[i], i, fences)) hits.push(fences[i]);
    }
    if (hits.length === 1) {
      const { fenceLineIndex, closeLineIndex, attrsStr } = hits[0];
      return { fenceLineIndex, closeLineIndex, attrsStr, anchorKind: anchor.kind };
    }
  }

  return null;
}

/**
 * Convenience anchor factories for common identity strategies. Phase 2
 * classifiers compose these as needed.
 */
export const Anchors = {
  byClass: (className) => ({
    kind: 'class',
    test: (f) => new RegExp(`(^|\\s)\\.${escapeRegex(className)}(\\s|$)`).test(f.attrsStr),
  }),
  byId: (id) => ({
    kind: 'id',
    test: (f) => new RegExp(`(^|\\s)#${escapeRegex(id)}(\\s|$)`).test(f.attrsStr),
  }),
  byPosition: ({ left, top, width, height }) => ({
    kind: 'position',
    test: (f) => {
      const has = (key, val) => new RegExp(`${key}=${val}px`).test(f.attrsStr);
      return has('left', Math.round(left)) && has('top', Math.round(top))
          && (width  == null || has('width',  Math.round(width)))
          && (height == null || has('height', Math.round(height)));
    },
  }),
  byIndex: (index) => ({
    kind: 'index',
    test: (_f, i) => i === index,
  }),
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Poll until `el` appears in `editableRegistry`, then place the wrapping
 * container at the original (left, top) captured before setup. Setup sets
 * `position: relative` on the element itself, so any remaining inline
 * left/top would double-count once the container is positioned.
 */
export function waitForRegistryThenFixPosition(el, origLeft, origTop) {
  if (editableRegistry.has(el)) {
    editableRegistry.get(el).setState({ x: origLeft, y: origTop });
  } else {
    requestAnimationFrame(() => waitForRegistryThenFixPosition(el, origLeft, origTop));
  }
}

/**
 * Build a ModifyModeClassifier definition for "re-activate an already-positioned
 * element" classifiers. Wraps the boilerplate shared by `Positioned divs` and
 * `Positioned images` (and, post-issue #140, by the per-type re-activation
 * classifiers).
 *
 * Returns the classifier object — the caller is responsible for passing it to
 * `ModifyModeClassifier.register(...)`. Keeping registration in the caller
 * avoids a circular import with modify-mode.js, which is where the registry
 * lives.
 *
 * Options:
 *   label                    Classifier label shown in modify-mode UI.
 *   selector                 CSS selector for DOM candidates (e.g. 'div.absolute').
 *   serializeSelector        CSS selector for previously-activated elements
 *                            during save (e.g. 'div[data-editable-modified-abs-left]').
 *   extraSkip(el)            Optional. Skip the candidate without a warning
 *                            (used to exclude editable-container etc.).
 *   getPosition(el) → {left,top,width,height}|null
 *                            How to read the element's position. Default reads
 *                            from `el.style` directly. Typed-inner classifiers
 *                            override to read from the wrapping `div.absolute`
 *                            instead (the inner element doesn't carry the
 *                            position attrs).
 *   onClassifyValid(el)      Optional. Called for each element judged valid.
 *                            Typed-inner classifiers use it to stamp a marker
 *                            on the wrapping `div.absolute` so the generic
 *                            `Positioned divs` classifier can skip it.
 *   matchesSource(el, pos, slideIndex) → bool
 *                            True if the element's source can be located in
 *                            the slide chunk. Determines valid vs warn.
 *   noPositionReason         Warn message when getAbsolutePosition returns null.
 *   noSourceReason           Warn message when matchesSource returns false.
 *   extraDataset(el)         Optional. Stamp additional dataset keys at activate
 *                            time (e.g. abs-src for images).
 *   extraActivate(el)        Optional. Image-specific tweaks (src swap,
 *                            maxWidth:none, etc.). Runs before setupFn.
 *   setupFn(el)              The setup helper to call (setupDivWhenReady,
 *                            setupImageWhenReady, …).
 *   getReplacement(el, dims, ds) → {regex: RegExp, replacement: string}
 *                            Build the regex matching the original source and
 *                            the replacement text from the current dimensions.
 *                            `ds` is a snapshot of the dataset values captured
 *                            at activate time (left/top/width/height plus any
 *                            extraDataset keys).
 */
export function makePositionedClassifier(opts) {
  const {
    label,
    selector,
    serializeSelector,
    extraSkip,
    matchesSource,
    noPositionReason = 'No inline position — cannot match to source',
    noSourceReason   = 'Cannot locate matching {.absolute} block in source',
    extraDataset,
    extraActivate,
    setupFn,
    getReplacement,
    getPosition = getAbsolutePosition,
    onClassifyValid,
  } = opts;

  return {
    label,

    classify(slideEl) {
      const slideIndex = Reveal.getState().indexh;
      const candidates = Array.from(slideEl.querySelectorAll(selector));
      const valid = [];
      const warn  = [];
      for (const el of candidates) {
        if (editableRegistry.has(el)) continue;
        if (extraSkip && extraSkip(el)) continue;
        const pos = getPosition(el);
        if (!pos) { warn.push({ el, reason: noPositionReason }); continue; }
        if (!matchesSource(el, pos, slideIndex)) {
          warn.push({ el, reason: noSourceReason });
          continue;
        }
        valid.push(el);
        if (onClassifyValid) onClassifyValid(el);
      }
      return { valid, warn };
    },

    activate(el) {
      const pos = getPosition(el);
      if (!pos) return;
      el.dataset.editableModified          = 'true';
      el.dataset.editableModifiedSlide     = String(Reveal.getState().indexh);
      el.dataset.editableModifiedAbsLeft   = String(Math.round(pos.left));
      el.dataset.editableModifiedAbsTop    = String(Math.round(pos.top));
      el.dataset.editableModifiedAbsWidth  = String(Math.round(pos.width));
      el.dataset.editableModifiedAbsHeight = String(Math.round(pos.height));
      if (extraDataset) extraDataset(el);
      // Clear left/top before setup: setupEltStyles sets position:relative,
      // and any remaining inline left/top would act as relative offsets and
      // double-count the position once the container is placed.
      el.style.left = '';
      el.style.top  = '';
      if (extraActivate) extraActivate(el);
      setupFn(el);
      waitForRegistryThenFixPosition(el, pos.left, pos.top);
    },

    serialize(text) {
      const els = Array.from(document.querySelectorAll(serializeSelector));
      if (els.length === 0) return text;
      const chunks = splitIntoSlideChunks(text);

      const groups = new Map();
      for (const el of els) {
        if (!editableRegistry.has(el)) continue;
        const slideIndex = parseInt(el.dataset.editableModifiedSlide ?? '0', 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length) continue;
        if (!groups.has(chunkIndex)) groups.set(chunkIndex, []);
        groups.get(chunkIndex).push(el);
      }

      for (const [chunkIndex, groupEls] of groups) {
        groupEls.sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );
        const occurrenceCounters = new Map();
        for (const el of groupEls) {
          const ds = { ...el.dataset };
          const sig = `${ds.editableModifiedAbsLeft},${ds.editableModifiedAbsTop},${ds.editableModifiedAbsWidth},${ds.editableModifiedAbsHeight}`;
          const targetOccurrence = occurrenceCounters.get(sig) ?? 0;
          occurrenceCounters.set(sig, targetOccurrence + 1);
          const dims = editableRegistry.get(el).toDimensions();
          const { regex, replacement } = getReplacement(el, dims, ds);
          let occurrence = 0;
          chunks[chunkIndex] = chunks[chunkIndex].replace(regex, (match) => {
            if (occurrence++ === targetOccurrence) return replacement;
            return match;
          });
        }
      }

      return chunks.join('');
    },
  };
}
