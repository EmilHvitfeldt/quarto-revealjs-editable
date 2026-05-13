/**
 * Modify mode: click any plain image to make it editable.
 * Activated via the toolbar "Modify" button.
 *
 * Elements are classified into three buckets:
 *   valid        — element a classifier says can be modified; green ring
 *   warn         — element a classifier says to warn about; amber ring, not clickable
 *   (ignored)    — already editable or not recognised by any classifier
 *
 * ## Adding a new element type
 *
 * Call `ModifyModeClassifier.register()` with an object that implements:
 *
 *   classify(slideEl)  → { valid: Element[], warn: Array<{el, reason}> }
 *     Inspect `slideEl` (current slide) and return which elements can be
 *     activated and which should show a warning.  Cross-element context
 *     (e.g. counting sibling figures) belongs here.
 *
 *   activate(el)
 *     Called when the user clicks a valid element.  Stamp whatever
 *     data-attributes your serialize() needs, then call the appropriate
 *     setup helper (setupImageWhenReady, setupDivWhenReady, …).
 *
 *   serialize(text)  → string          [optional]
 *     Called during save to write modified elements of this type back to
 *     the QMD source.  Receives the full QMD string and must return the
 *     updated string.  Omit if your element type reuses an existing
 *     serialization path.
 *
 * @module modify-mode
 */

import { editableRegistry } from './editable-element.js';
import { setupImageWhenReady, setupDivWhenReady, setupVideoWhenReady, setupDraggableElt } from './element-setup.js';
import { initializeQuillForElement } from './quill.js';
import { showRightPanel } from './toolbar.js';
import {
  splitIntoSlideChunks,
  serializeToQmd,
  elementToText,
  serializeArrowToShortcode,
} from './serialization.js';
import { getQmdHeadingIndex, getSlideScale, escapeRegex } from './utils.js';
import { getColorPalette, getBrandColorOutput } from './colors.js';
import { setCapabilityOverride } from './capabilities.js';
import { createArrowElement, setActiveArrow } from './arrows.js';
import { CONFIG } from './config.js';
import {
  getAbsolutePosition,
  waitForRegistryThenFixPosition,
  makePositionedClassifier,
} from './modify-mode-positioned.js';

const VALID_CLASS = 'modify-mode-valid';
const WARN_CLASS  = 'modify-mode-warn';
const ROOT_CLASS  = 'modify-mode';

/** @type {AbortController|null} Cleans up click listeners on exit */
let abortController = null;

/** Single source of truth for whether modify mode is active */
let _active = false;

export function isModifyModeActive() { return _active; }

/**
 * Maps warn elements → the human-readable reason string returned by the
 * classifier.  Populated by applyClassification(), cleared on exit.
 * Use getWarnReason(el) to read.
 * @type {WeakMap<Element, string>}
 */
const _warnReasons = new WeakMap();

/**
 * Saves the original aria-label of warn/valid elements so we can restore
 * it when exiting modify mode.  A value of `null` means the element had no
 * aria-label originally (so cleanup should remove the attribute).
 * @type {WeakMap<Element, string|null>}
 */
const _originalAriaLabels = new WeakMap();

function applyAriaLabel(el, label) {
  if (!_originalAriaLabels.has(el)) {
    _originalAriaLabels.set(el, el.hasAttribute('aria-label') ? el.getAttribute('aria-label') : null);
  }
  el.setAttribute('aria-label', label);
}

function restoreAriaLabels(root = document) {
  root.querySelectorAll(`.${VALID_CLASS}, .${WARN_CLASS}`).forEach(el => {
    if (!_originalAriaLabels.has(el)) return;
    const original = _originalAriaLabels.get(el);
    if (original === null) el.removeAttribute('aria-label');
    else el.setAttribute('aria-label', original);
    _originalAriaLabels.delete(el);
  });
}

/**
 * Return the warning reason for an element that was classified as warn,
 * or null if the element is not a warned element.
 * @param {Element} el
 * @returns {string|null}
 */
export function getWarnReason(el) {
  return _warnReasons.get(el) ?? null;
}

// ---------------------------------------------------------------------------
// Classifier registry
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} WarnEntry
 * @property {Element} el
 * @property {string}  reason  - Human-readable explanation shown on hover
 */

/**
 * @typedef {Object} ClassifyResult
 * @property {Element[]}    valid
 * @property {WarnEntry[]}  warn
 */

/**
 * @typedef {Object} Classifier
 * @property {function(Element): ClassifyResult} classify
 *   Inspect the current slide element and return valid/warn lists.
 * @property {function(Element): void} activate
 *   Called when the user clicks a valid element.
 * @property {function(string): string} [serialize]
 *   Optional. Called during save; receives and returns the full QMD string.
 * @property {function(): void} [cleanup]
 *   Optional. Called when modify mode exits; restore any DOM changes made in classify().
 */

const _classifiers = [];

/**
 * Register a classifier for a new element type.
 * Classifiers are evaluated in registration order.
 * @param {Classifier} classifier
 */
export const ModifyModeClassifier = {
  register(classifier) {
    _classifiers.push(classifier);
  },

  /**
   * Apply every registered classifier's serialize() to the QMD text.
   * This is the single write-back entry point for all modified element types.
   * @param {string} text - Full QMD source
   * @returns {string}
   */
  applySerializers(text) {
    for (const classifier of _classifiers) {
      if (typeof classifier.serialize === 'function') {
        text = classifier.serialize(text);
      }
    }
    return text;
  },

};

// ---------------------------------------------------------------------------
// Image classifier (built-in)
// ---------------------------------------------------------------------------

/**
 * Get the effective src of an image, checking both src and data-src
 * (Reveal.js uses data-src for lazy loading).
 * @param {HTMLImageElement} img
 * @returns {string|null}
 */
export function getImgSrc(img) {
  return img.getAttribute('src') || img.getAttribute('data-src') || null;
}

function srcInQmdSource(img) {
  if (!window._input_file) return false;
  const src = getImgSrc(img);
  return !!src && window._input_file.includes(src);
}

function getChunkPrefix(src) {
  const match = src.match(/figure-revealjs\/(.+)-\d+\.png$/);
  return match ? match[1] : null;
}

function buildChunkPrefixCounts(imgs) {
  const counts = new Map();
  for (const img of imgs) {
    const src = getImgSrc(img);
    if (!src) continue;
    const prefix = getChunkPrefix(src);
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return counts;
}

/**
 * Get the effective src of a video element.
 * Checks the src attribute directly on the element first, then falls back to
 * the first <source> child (Quarto may render either form).
 * @param {HTMLVideoElement} video
 * @returns {string|null}
 */
export function getVideoSrc(video) {
  return video.getAttribute('src') || video.getAttribute('data-src') ||
    video.querySelector('source')?.getAttribute('src') || null;
}

function videoSrcInQmdSource(video) {
  if (!window._input_file) return false;
  const src = getVideoSrc(video);
  return !!src && window._input_file.includes(src);
}

/**
 * Factory for the Images / Videos classifiers, which share the entire
 * activate + serialize pipeline (capture src, lazy data-src swap, dataset
 * stamping, then on save: group by `chunkIndex::src`, sort by DOM order,
 * regex-replace `](src){attrs}` with occurrence counting).
 *
 * Options:
 *   - `tagName`, `label`, `getSrc`, `setupFn` — the four pieces that differ.
 *   - `classify(slideEl)` — caller owns the per-element decision so it can
 *     do things like Images' multi-figure-chunk warn or Videos' controls
 *     removal.
 *   - `beforeSetup(el)` — runs at activate-time after dataset stamping and
 *     before `setupFn`. Used by Videos to clear `max-width` (Reveal sets
 *     95% on media; resolves against our explicit width post-setup) and to
 *     opt the activated video out of the pending controls-restore set.
 *   - `cleanup()` — runs when modify mode exits without activating anything.
 *     Used by Videos to restore `controls` on classify-time strippings.
 */
export function makeMediaClassifier({ tagName, label, getSrc, setupFn, classify, beforeSetup, cleanup }) {
  return {
    label,
    classify,
    cleanup,

    activate(el) {
      // Capture src before assigning to el.src, which would resolve to an
      // absolute URL and break QMD source matching in serialize().
      const originalSrc = getSrc(el);

      // Ensure lazy-loaded media (data-src only) are fetched before setup
      // polls for natural dimensions — without this, setup can time out
      // before Reveal.js swaps data-src → src on its own schedule.
      if (!el.getAttribute('src') && el.getAttribute('data-src')) {
        el.src = el.getAttribute('data-src');
      }

      el.dataset.editableModifiedSrc   = originalSrc;
      el.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
      el.dataset.editableModified      = 'true';

      if (beforeSetup) beforeSetup(el);
      setupFn(el);
    },

    serialize(text) {
      const els = Array.from(
        document.querySelectorAll(`${tagName}[data-editable-modified="true"]`)
      );
      if (els.length === 0) return text;

      const chunks = splitIntoSlideChunks(text);

      // Group by (chunkIndex, originalSrc) to handle duplicate srcs on the
      // same slide. DOM order within each group maps to QMD occurrence order.
      const groups = new Map();
      for (const el of els) {
        const originalSrc = el.dataset.editableModifiedSrc;
        if (!originalSrc) continue;
        if (!editableRegistry.has(el)) continue;
        const slideIndex = parseInt(el.dataset.editableModifiedSlide ?? '0', 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length) continue;
        const key = `${chunkIndex}::${originalSrc}`;
        if (!groups.has(key)) groups.set(key, { chunkIndex, originalSrc, els: [] });
        groups.get(key).els.push(el);
      }

      for (const { chunkIndex, originalSrc, els: groupEls } of groups.values()) {
        groupEls.sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );

        const replacements = groupEls.map(el => {
          const dims = editableRegistry.get(el).toDimensions();
          return `](${dims.src || originalSrc})${serializeToQmd(dims)}`;
        });

        const regex = new RegExp(`\\]\\(${escapeRegex(originalSrc)}\\)(\\{[^}]*\\})?`, 'g');

        let occurrence = 0;
        chunks[chunkIndex] = chunks[chunkIndex].replace(regex, (match) =>
          occurrence < replacements.length ? replacements[occurrence++] : match
        );
      }

      return chunks.join('');
    },
  };
}

// Tracks videos whose `controls` attribute was removed during classification
// so it can be restored when modify mode exits without activating them.
const _videosWithControlsRemoved = new Set();

ModifyModeClassifier.register(makeMediaClassifier({
  tagName: 'img',
  label: 'Images',
  getSrc: getImgSrc,
  setupFn: setupImageWhenReady,

  classify(slideEl) {
    const imgs = Array.from(slideEl.querySelectorAll('img'));
    const prefixCounts = buildChunkPrefixCounts(imgs);

    const valid = [];
    const warn  = [];

    for (const img of imgs) {
      if (editableRegistry.has(img)) continue;
      if (isAlreadyPositioned(img)) continue;
      const src = getImgSrc(img);
      if (!src) continue;
      const prefix = getChunkPrefix(src);
      if (prefix) {
        if (prefixCounts.get(prefix) > 1) {
          warn.push({ el: img, reason: 'Multi-figure chunk — cannot target individual figures' });
        }
      } else if (srcInQmdSource(img)) {
        valid.push(img);
      }
    }

    return { valid, warn };
  },
}));

ModifyModeClassifier.register(makeMediaClassifier({
  tagName: 'video',
  label: 'Videos',
  getSrc: getVideoSrc,
  setupFn: setupVideoWhenReady,

  classify(slideEl) {
    // Restore controls on any videos from a previous classification pass
    // (e.g. the user navigated slides without clicking).
    for (const video of _videosWithControlsRemoved) {
      video.setAttribute('controls', '');
    }
    _videosWithControlsRemoved.clear();

    const videos = Array.from(slideEl.querySelectorAll('video'));
    const valid = [];

    for (const video of videos) {
      if (editableRegistry.has(video)) continue;
      if (isAlreadyPositioned(video)) continue;
      const src = getVideoSrc(video);
      if (!src) continue;
      if (videoSrcInQmdSource(video)) {
        valid.push(video);
      }
    }

    // Remove native controls from valid videos so browser-native control UI
    // doesn't intercept the click before our listener fires (Firefox issue).
    for (const video of valid) {
      video.removeAttribute('controls');
      _videosWithControlsRemoved.add(video);
    }

    return { valid, warn: [] };
  },

  beforeSetup(video) {
    // This video is being activated — don't restore its `controls` on cleanup.
    _videosWithControlsRemoved.delete(video);

    // Reveal.js sets max-width: 95% on media elements. Once inside the
    // inline-block editable-container, that percentage resolves against the
    // explicit style.width, shrinking the element further. Clear it first.
    video.style.maxWidth  = 'none';
    video.style.maxHeight = 'none';
  },

  cleanup() {
    for (const video of _videosWithControlsRemoved) {
      video.setAttribute('controls', '');
    }
    _videosWithControlsRemoved.clear();
  },
}));

// ---------------------------------------------------------------------------
// Positioned-element re-activation classifiers
//
// The shared boilerplate (dataset bookkeeping, activate-time setup, chunk
// regex replace) lives in modify-mode-positioned.js. This section wires the
// two element types onto that factory.
// ---------------------------------------------------------------------------

/**
 * Build a regex that matches a {.absolute ...} attribute block containing
 * all four original position values in any order.
 */
function makeAbsoluteBlockRegex(left, top, width, height) {
  const vals = [
    `left=${Math.round(left)}px`,
    `top=${Math.round(top)}px`,
    `width=${Math.round(width)}px`,
    `height=${Math.round(height)}px`,
  ];
  const lookaheads = vals.map(v => `(?=[^}]*${escapeRegex(v)})`).join('');
  return new RegExp(`\\{${lookaheads}\\.absolute[^}]*\\}`, 'g');
}

function makeAbsoluteImageRegex(src, left, top, width, height) {
  const escapedSrc = escapeRegex(src);
  const vals = [
    `left=${Math.round(left)}px`,
    `top=${Math.round(top)}px`,
    `width=${Math.round(width)}px`,
    `height=${Math.round(height)}px`,
  ];
  const lookaheads = vals.map(v => `(?=[^}]*${escapeRegex(v)})`).join('');
  return new RegExp(`\\]\\(${escapedSrc}\\)\\{${lookaheads}\\.absolute[^}]*\\}`, 'g');
}

function absoluteDivInQmdSource(div, slideIndex) {
  if (!window._input_file) return false;
  const pos = getAbsolutePosition(div);
  if (!pos) return false;
  const chunks = splitIntoSlideChunks(window._input_file);
  const chunk = chunks[getQmdHeadingIndex(slideIndex) + 1];
  if (!chunk) return false;
  return makeAbsoluteBlockRegex(pos.left, pos.top, pos.width, pos.height).test(chunk);
}

function absoluteImgInQmdSource(img, slideIndex) {
  if (!window._input_file) return false;
  const pos = getAbsolutePosition(img);
  if (!pos) return false;
  const src = getImgSrc(img);
  if (!src) return false;
  const chunks = splitIntoSlideChunks(window._input_file);
  const chunk = chunks[getQmdHeadingIndex(slideIndex) + 1];
  if (!chunk) return false;
  return makeAbsoluteImageRegex(src, pos.left, pos.top, pos.width, pos.height).test(chunk);
}

// ---------------------------------------------------------------------------
// Typed-inner positioned classifiers (issue #140)
//
// Saved elements wrapped in `::: {.absolute …}` re-activate by targeting the
// *inner* semantic element (paragraph, list, table, …), not the wrapper. The
// wrapper's role is reduced to source-anchor metadata + a `data-typed-positioned-claimed`
// marker that tells the generic `Positioned divs` classifier to skip it.
//
// Per-type behavior matches the first-activation classifier where it matters:
// capability overrides, Quill init for editable text, natural-dimension
// locking before reparenting. Position is read from the wrapper's inline
// styles (the inner element doesn't carry the position attrs).
//
// Registers BEFORE `Positioned divs` so the typed claim wins. See
// `ARCHITECTURE.md` — "Re-activating Already-Positioned Elements".
// ---------------------------------------------------------------------------

/**
 * Per-inner-type activation config. Each entry registers a typed positioned
 * classifier targeting `div.absolute > <selector>`.
 *
 *   label         Suffix for "Positioned …" classifier label.
 *   selector      CSS selector relative to the wrapper (e.g. 'p', 'div.cell').
 *   extraFilter   Optional predicate to refine matches (e.g. paragraphs that
 *                 are NOT just a math equation wrapper). Receives the inner
 *                 element; return false to skip.
 *   capabilities  setCapabilityOverride argument; null to leave defaults.
 *   lockDims      Whether to lock natural width/height before reparent.
 *   quill         Whether to attach Quill rich-text editing.
 *   display       CSS `display` value to restore (e.g. 'table' for tables).
 */
const TYPED_INNER_CONFIGS = [
  // Equations live as <p><span class="math display">...</span></p>. Match the
  // paragraph form first so the generic paragraph classifier below doesn't
  // grab it and offer Quill editing on LaTeX source.
  {
    label: 'equation',
    selectors: ['p'],
    extraFilter: (el) => !!el.querySelector(':scope > span.math.display'),
    capabilities: ['move'], lockDims: true, quill: false, display: null,
  },
  // Generic paragraph — explicitly excludes math-only paragraphs so the
  // equation entry above wins (registration order matters within this array
  // because both selectors would otherwise match the same <p>).
  {
    label: 'paragraph',
    selectors: ['p'],
    extraFilter: (el) => !el.querySelector(':scope > span.math.display'),
    capabilities: null, lockDims: false, quill: true, display: null,
  },
  { label: 'blockquote', selectors: ['blockquote'], capabilities: ['move','resize'], lockDims: true, quill: false, display: null },
  { label: 'bullet list',  selectors: ['ul'], capabilities: ['move','resize'], lockDims: true, quill: false, display: null },
  { label: 'ordered list', selectors: ['ol'], capabilities: ['move','resize'], lockDims: true, quill: false, display: null },
  // Code chunk outputs and code chunk figures both render as `div.cell` —
  // one entry covers both. Register BEFORE display code so a positioned
  // executable chunk doesn't get grabbed by the display-code classifier
  // (which matches any `div.sourceCode`).
  { label: 'code cell',    selectors: ['div.cell'], capabilities: ['move','resize'], lockDims: true, quill: false, display: null },
  // Display code: Quarto wraps the <pre> in `div.code-copy-outer-scaffold`
  // (when copy button is enabled) or `div.sourceCode` (when not). Match
  // either as the direct child of the absolute wrapper.
  { label: 'display code', selectors: ['div.code-copy-outer-scaffold', 'div.sourceCode'], capabilities: ['move','resize'], lockDims: true, quill: false, display: null },
  // Figures from `![](src){#fig-id}` syntax are wrapped in
  // `div.quarto-float.quarto-figure` (not a bare <figure>).
  { label: 'figure',       selectors: ['div.quarto-figure'], capabilities: ['move','resize'], lockDims: true, quill: false, display: null },
  { label: 'table',        selectors: ['table'],             capabilities: ['move'],          lockDims: true, quill: false, display: 'table' },
];

/**
 * Read an element's position relative to its slide, scaled out of CSS-pixel
 * space so the numbers match the element-space coordinates that QMD source
 * uses. Pass `rectSource` to measure from a nested node (e.g. the rendered
 * math container inside an equation `<p>`) while still anchoring against the
 * outer element's slide.
 *
 * Returns `{ left, top, width, height, scale, slideEl }`.
 */
export function captureSlideRelativePosition(el, { rectSource } = {}) {
  const slideEl = el.closest('section');
  const scale = getSlideScale();
  const rect = (rectSource ?? el).getBoundingClientRect();
  const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
  return {
    left:   (rect.left - slideRect.left) / scale,
    top:    (rect.top  - slideRect.top)  / scale,
    width:  rect.width  / scale,
    height: rect.height / scale,
    scale,
    slideEl,
  };
}

/**
 * Lock the element's natural width/height + padding so it doesn't collapse
 * or stretch when reparented into the inline-block `editable-container`.
 *
 * Uses `getBoundingClientRect().width / scale` rather than `offsetWidth` to
 * preserve sub-pixel accuracy — `offsetWidth` truncates to an integer, which
 * causes inline-block text to wrap when the true content width is fractional
 * (e.g. 208.28px collapsing to 208px).
 *
 * Pass `displayOverride` to set `el.style.display` after locking (tables
 * pass nothing and set `display:table` after dataset stamping instead).
 */
export function lockNaturalDimensions(el, displayOverride) {
  const scale = getSlideScale();
  const elRect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  el.style.paddingLeft   = cs.paddingLeft;
  el.style.paddingRight  = cs.paddingRight;
  el.style.paddingTop    = cs.paddingTop;
  el.style.paddingBottom = cs.paddingBottom;
  el.style.margin        = '0';
  el.style.width         = (elRect.width  / scale) + 'px';
  el.style.height        = (elRect.height / scale) + 'px';
  if (displayOverride) el.style.display = displayOverride;
}

/**
 * Read position from the wrapping `div.absolute`. Inner elements don't carry
 * the position attrs themselves — they live on the wrapper. Returns null if
 * the wrapper is missing or has incomplete position styles.
 */
function getPositionFromWrapper(innerEl) {
  const wrapper = innerEl.parentElement;
  if (!wrapper || !wrapper.classList || !wrapper.classList.contains('absolute')) return null;
  return getAbsolutePosition(wrapper);
}

/**
 * Build a regex that matches the `{.absolute …}` block in source containing
 * all four original position values — same shape as the Positioned divs
 * regex. Re-activated typed elements share the wrapper's source location, so
 * the rewrite target is identical.
 */
function makeTypedFenceRewriteReplacement(_el, dims, ds) {
  return {
    regex: makeAbsoluteBlockRegex(
      parseInt(ds.editableModifiedAbsLeft,   10),
      parseInt(ds.editableModifiedAbsTop,    10),
      parseInt(ds.editableModifiedAbsWidth,  10),
      parseInt(ds.editableModifiedAbsHeight, 10),
    ),
    replacement: serializeToQmd(dims),
  };
}

for (const cfg of TYPED_INNER_CONFIGS) {
  // Tag of the inner element (used as serializeSelector base). The selectors
  // may be more specific than a tag (e.g. `div.cell`) — derive the tag from
  // the first selector's leading word.
  const innerTag = cfg.selectors[0].match(/^[a-zA-Z]+/)[0].toLowerCase();
  const fullSelector = cfg.selectors.map((s) => `div.absolute > ${s}`).join(', ');
  ModifyModeClassifier.register(makePositionedClassifier({
    label: `Positioned ${cfg.label}`,
    selector: fullSelector,
    // Scope serialize to the typed-claimed dataset stamped at activate time,
    // not just the abs-left dataset — otherwise `Positioned divs` and this
    // classifier would both match a typed inner <div> (e.g. div.cell).
    serializeSelector: `${innerTag}[data-editable-modified-typed-inner="true"]`,
    getPosition: getPositionFromWrapper,
    matchesSource: (el, _pos, slideIndex) => {
      const wrapper = el.parentElement;
      return wrapper ? absoluteDivInQmdSource(wrapper, slideIndex) : false;
    },
    extraSkip: cfg.extraFilter ? (el) => !cfg.extraFilter(el) : undefined,
    onClassifyValid: (el) => {
      const wrapper = el.parentElement;
      if (wrapper) wrapper.dataset.typedPositionedClaimed = 'true';
    },
    extraDataset: (el) => {
      el.dataset.editableModifiedTypedInner = 'true';
    },
    setupFn: setupDivWhenReady,
    extraActivate: (el) => {
      // Hoist the inner element out of its `div.absolute` wrapper BEFORE setup
      // runs. setupDraggableElt inserts an .editable-container around the inner
      // in-place; if the wrapper is left positioned around the container, the
      // container's `position: absolute` compounds with the wrapper's position
      // and renders at the wrong spot. Moving the inner up makes the container
      // a direct child of the slide section, where its absolute position is
      // relative to the slide (correct). The now-empty wrapper is hidden so it
      // doesn't ghost the inner element.
      const wrapper = el.parentElement;
      if (wrapper && wrapper.classList && wrapper.classList.contains('absolute')) {
        const wrapperParent = wrapper.parentNode;
        if (wrapperParent) {
          wrapperParent.insertBefore(el, wrapper);
          wrapper.style.display = 'none';
        }
      }
      if (cfg.lockDims) lockNaturalDimensions(el, cfg.display);
      if (cfg.capabilities) setCapabilityOverride(el, cfg.capabilities);
      if (cfg.quill) initializeQuillForElement(el);
    },
    getReplacement: makeTypedFenceRewriteReplacement,
  }));
}

// ---------------------------------------------------------------------------
// Generic positioned-div classifier (any remaining div.absolute the typed
// classifiers above didn't claim — e.g. fenced divs that wrap multiple
// children, raw HTML, etc.)
// ---------------------------------------------------------------------------

ModifyModeClassifier.register(makePositionedClassifier({
  label: 'Positioned divs',
  selector: 'div.absolute',
  // Scope to wrappers only (`.absolute`) so a typed-inner <div> (e.g.
  // `div.cell` activated via the typed classifier above) isn't double-rewritten.
  serializeSelector: 'div.absolute[data-editable-modified-abs-left]',
  extraSkip: (div) =>
    div.classList.contains('editable-container') ||
    div.classList.contains('editable-new') ||
    div.classList.contains('editable') ||
    div.dataset.typedPositionedClaimed === 'true',
  matchesSource: (el, _pos, slideIndex) => absoluteDivInQmdSource(el, slideIndex),
  setupFn: setupDivWhenReady,
  getReplacement: (_el, dims, ds) => ({
    regex: makeAbsoluteBlockRegex(
      parseInt(ds.editableModifiedAbsLeft,   10),
      parseInt(ds.editableModifiedAbsTop,    10),
      parseInt(ds.editableModifiedAbsWidth,  10),
      parseInt(ds.editableModifiedAbsHeight, 10),
    ),
    replacement: serializeToQmd(dims),
  }),
}));

ModifyModeClassifier.register(makePositionedClassifier({
  label: 'Positioned images',
  selector: 'img.absolute',
  serializeSelector: 'img[data-editable-modified-abs-src]',
  matchesSource: (el, _pos, slideIndex) => absoluteImgInQmdSource(el, slideIndex),
  extraDataset: (el) => {
    el.dataset.editableModifiedAbsSrc = getImgSrc(el) ?? '';
  },
  extraActivate: (el) => {
    if (!el.getAttribute('src') && el.getAttribute('data-src')) {
      el.src = el.getAttribute('data-src');
    }
    // Remove percentage-based max-width/max-height (Reveal.js sets max-width:95%).
    // Once inside the inline-block editable-container, those % values would resolve
    // against the container width, shrinking the image.
    el.style.maxWidth  = 'none';
    el.style.maxHeight = 'none';
  },
  setupFn: setupImageWhenReady,
  getReplacement: (_el, dims, ds) => {
    const src = ds.editableModifiedAbsSrc;
    return {
      regex: makeAbsoluteImageRegex(
        src,
        parseInt(ds.editableModifiedAbsLeft,   10),
        parseInt(ds.editableModifiedAbsTop,    10),
        parseInt(ds.editableModifiedAbsWidth,  10),
        parseInt(ds.editableModifiedAbsHeight, 10),
      ),
      replacement: `](${src}){.absolute left=${dims.left}px top=${dims.top}px width=${dims.width}px height=${dims.height}px}`,
    };
  },
}));

// ---------------------------------------------------------------------------
// Replace the heading text on the first `## ...` line of a slide chunk,
// preserving any trailing `{...}` attribute block.
export function replaceHeadingTextInChunk(chunk, newText) {
  return chunk.replace(/^## [^\n]*/m, (line) => {
    const attrMatch = line.match(/\s*(\{[^}]*\})\s*$/);
    const trailing = attrMatch ? ` ${attrMatch[1]}` : '';
    return `## ${newText}${trailing}`;
  });
}

// Slide title (h2) classifier
// ---------------------------------------------------------------------------

/**
 * Convert an h2 element's innerHTML to Quarto inline markdown.
 * Handles bold, italic, and strips remaining tags.
 * @param {string} html
 * @returns {string}
 */
export function headingHtmlToMarkdown(html) {
  let text = html;

  // `document.execCommand('bold'|'italic'|'strikeThrough')` in CSS mode (the
  // default in most browsers) emits `<span style="font-weight: bold">…</span>`
  // rather than `<b>`/`<i>`/`<s>` tags. Convert those to markdown FIRST so the
  // span-stripping fallback below doesn't drop the formatting on the floor.
  text = text.replace(/<span[^>]*style="[^"]*font-weight:\s*(bold|[6-9]\d\d)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, _w, content) => `**${content}**`);
  text = text.replace(/<span[^>]*style="[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, content) => `*${content}*`);
  text = text.replace(/<span[^>]*style="[^"]*text-decoration:[^"]*line-through[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, content) => `~~${content}~~`);

  // Background color spans (must come before foreground to avoid false matches)
  text = text.replace(/<span[^>]*style="[^"]*background-color:\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, colorVal, content) => `[${content}]{style='background-color: ${getBrandColorOutput(colorVal.trim())}'}`);

  // Foreground color spans
  text = text.replace(/<span[^>]*style="[^"]*(?<!background-)color:\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, colorVal, content) => {
      if (colorVal.trim().toLowerCase() === 'inherit') return content;
      return `[${content}]{style='color: ${getBrandColorOutput(colorVal.trim())}'}`;
    });

  // <font color="..."> (produced by some browsers)
  text = text.replace(/<font[^>]*\bcolor="([^"]+)"[^>]*>([\s\S]*?)<\/font>/gi,
    (_, colorVal, content) => `[${content}]{style='color: ${getBrandColorOutput(colorVal.trim())}'}`);

  return text
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~')
    .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '~~$1~~')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Build a minimal formatting toolbar for heading contentEditable editing.
 * Returns the toolbar element (caller must append it and remove it on cleanup).
 * @param {HTMLElement} h2
 * @returns {HTMLElement}
 */
/**
 * Build a Quill-style color picker span for the heading toolbar.
 * Saves/restores the h2 selection so clicking swatches doesn't lose focus.
 */
function buildColorPicker(execCmd, title, pickerClass, presetColors) {
  let savedRange = null;

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  };

  const isForeground = execCmd === 'foreColor';
  const iconSvg = isForeground
    ? '<svg viewbox="0 0 18 18"><line class="ql-color-label ql-stroke ql-transparent" x1="3" x2="15" y1="15" y2="15"/><polyline class="ql-stroke" points="5.5 11 9 3 12.5 11"/><line class="ql-stroke" x1="11.63" x2="6.38" y1="9" y2="9"/></svg>'
    : '<svg viewbox="0 0 18 18"><g class="ql-fill ql-color-label"><polygon points="6 6.868 6 6 5 6 5 7 5.942 7 6 6.868"/><rect height="1" width="1" x="4" y="4"/><polygon points="6.817 5 6 5 6 6 6.38 6 6.817 5"/><rect height="1" width="1" x="2" y="6"/><rect height="1" width="1" x="3" y="5"/><polygon points="11.183 5 11.62 6 12 6 12 5 11.183 5"/><rect height="1" width="1" x="11" y="4"/><polygon points="12 6.868 12.058 7 13 7 13 6 12 6 12 6.868"/><rect height="1" width="1" x="13" y="6"/><rect height="1" width="1" x="14" y="4"/><polygon points="14 5 13.367 5 13.82 6 14 6 14 5"/><rect height="1" width="1" x="14" y="7"/><rect height="1" width="1" x="14" y="2"/><rect height="1" width="1" x="13" y="3"/><polygon points="12 3.132 12 3 11 3 11 4 11.183 4 12 3.132"/><rect height="1" width="1" x="10" y="2"/><rect height="1" width="1" x="9" y="3"/><rect height="1" width="1" x="8" y="2"/><rect height="1" width="1" x="7" y="3"/><rect height="1" width="1" x="6" y="2"/><rect height="1" width="1" x="5" y="3"/><polygon points="3.917 5 4 5 4 6 4.075 6 3.917 5"/><rect height="1" width="1" x="3" y="7"/><rect height="1" width="1" x="2" y="4"/></g><rect class="ql-stroke" height="12" rx="1" ry="1" width="12" x="3" y="3"/></svg>';

  const label = document.createElement('span');
  label.className = 'ql-picker-label';
  label.title = title;
  label.innerHTML = iconSvg;

  const options = document.createElement('span');
  options.className = 'ql-picker-options';
  options.style.display = 'none';

  const addItem = (value, bg) => {
    const item = document.createElement('span');
    item.className = 'ql-picker-item';
    item.dataset.value = value;
    if (bg) item.style.backgroundColor = bg;
    options.appendChild(item);
    return item;
  };

  addItem('unset');
  for (const color of presetColors) addItem(color, color);

  const customInput = document.createElement('input');
  customInput.type = 'color';
  customInput.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;';
  const updateSwatch = (color) => {
    const swatchEl = label.querySelector('.ql-color-label');
    if (swatchEl) swatchEl.style[isForeground ? 'stroke' : 'fill'] = color || '';
  };

  customInput.addEventListener('input', () => {
    restoreSelection();
    document.execCommand(execCmd, false, customInput.value);
    updateSwatch(customInput.value);
  });

  addItem('custom');

  const picker = document.createElement('span');
  picker.className = `ql-picker ql-color-picker ${pickerClass}`;
  picker.appendChild(label);
  picker.appendChild(options);
  picker.appendChild(customInput);

  label.addEventListener('mousedown', (e) => {
    e.preventDefault();
    saveSelection();
    const isOpen = picker.classList.contains('ql-expanded');
    // Close all open pickers in this toolbar first
    picker.closest('.heading-edit-toolbar')?.querySelectorAll('.ql-expanded').forEach(p => {
      p.classList.remove('ql-expanded');
      p.querySelector('.ql-picker-options').style.display = 'none';
    });
    if (!isOpen) {
      picker.classList.add('ql-expanded');
      options.style.display = 'flex';
    }
  });

  options.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const item = e.target.closest('.ql-picker-item');
    if (!item) return;
    picker.classList.remove('ql-expanded');
    options.style.display = 'none';
    const value = item.dataset.value;
    if (value === 'custom') {
      customInput.click();
      return;
    }
    restoreSelection();
    if (value === 'unset') {
      document.execCommand(execCmd, false, 'inherit');
      updateSwatch('');
    } else {
      document.execCommand(execCmd, false, value);
      updateSwatch(value);
    }
  });

  return picker;
}

function buildHeadingToolbar(h2) {
  const toolbar = document.createElement('div');
  toolbar.className = 'heading-edit-toolbar quill-toolbar-container ql-toolbar ql-snow';

  const buttons = [
    { command: 'bold',          label: 'B', title: 'Bold',          style: 'font-weight:bold' },
    { command: 'italic',        label: 'I', title: 'Italic',        style: 'font-style:italic' },
    { command: 'underline',     label: 'U', title: 'Underline',     style: 'text-decoration:underline' },
    { command: 'strikeThrough', label: 'S', title: 'Strikethrough', style: 'text-decoration:line-through' },
  ];

  for (const { command, label, title, style } of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.title = title;
    btn.style.cssText = style;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.execCommand(command);
    });
    toolbar.appendChild(btn);
  }

  const presetColors = getColorPalette();
  toolbar.appendChild(buildColorPicker('foreColor',  'Text color',       'ql-color',      presetColors));
  toolbar.appendChild(buildColorPicker('backColor',  'Background color', 'ql-background', presetColors));

  // Close open pickers when clicking outside the toolbar
  const onDocMouseDown = (e) => {
    if (!toolbar.contains(e.target)) {
      toolbar.querySelectorAll('.ql-expanded').forEach(p => {
        p.classList.remove('ql-expanded');
        p.querySelector('.ql-picker-options').style.display = 'none';
      });
    }
  };
  document.addEventListener('mousedown', onDocMouseDown);
  toolbar._cleanup = () => document.removeEventListener('mousedown', onDocMouseDown);

  return toolbar;
}

ModifyModeClassifier.register({
  label: 'Slide titles',

  classify(slideEl) {
    const h2 = slideEl.querySelector('h2');
    if (!h2) return { valid: [], warn: [] };
    if (h2.classList.contains('editable-heading-active')) return { valid: [], warn: [] };
    return { valid: [h2], warn: [] };
  },

  activate(h2) {
    if (h2.classList.contains('editable-heading-active')) return true;
    h2.dataset.editableModifiedHeading = 'true';
    h2.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
    h2.dataset.editableModifiedOriginalHtml = h2.innerHTML;
    h2.classList.add('editable-heading-active');

    // Exit modify mode visually (green rings gone, button inactive) but keep
    // the text panel so the formatting toolbar can be shown immediately after.
    exitModifyMode({ resetPanel: false });

    h2.contentEditable = 'true';
    h2.focus();

    const range = document.createRange();
    range.selectNodeContents(h2);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const toolbar = buildHeadingToolbar(h2);
    const textPanel = document.querySelector('.toolbar-panel-text');
    if (textPanel) textPanel.appendChild(toolbar);
    showRightPanel('text');

    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        h2.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        h2.innerHTML = h2.dataset.editableModifiedOriginalHtml;
        h2.blur();
      }
    };
    h2.addEventListener('keydown', onKeyDown);

    h2.addEventListener('blur', () => {
      h2.removeEventListener('keydown', onKeyDown);
      h2.contentEditable = 'false';
      h2.classList.remove('editable-heading-active');
      toolbar._cleanup?.();
      toolbar.remove();
      showRightPanel('default');
      document.querySelector('.toolbar-modify')?.focus();
    }, { once: true });

    return true; // exitModifyMode already called above; skip it in onValidElementClick
  },

  serialize(text) {
    const headings = Array.from(
      document.querySelectorAll('h2[data-editable-modified-heading="true"]')
    );
    if (!headings.length) return text;

    const chunks = splitIntoSlideChunks(text);

    for (const h2 of headings) {
      const slideIndex = parseInt(h2.dataset.editableModifiedSlide ?? '0', 10);
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      const newText = headingHtmlToMarkdown(h2.innerHTML);
      chunks[chunkIndex] = replaceHeadingTextInChunk(chunks[chunkIndex], newText);
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Fenced div classifier
// ---------------------------------------------------------------------------

const CALLOUT_TYPES = ['callout-note', 'callout-tip', 'callout-warning', 'callout-important', 'callout-caution'];

/**
 * Parse top-level fenced div opening lines from a QMD slide chunk.
 * Returns an array of { lineIndex, closeLineIndex, matchKey, fenceStr, attrsStr }
 * where matchKey is the first class (e.g. ".my-class"), the id (e.g. "#my-id"),
 * or null for truly attribute-free divs (positional matching only).
 * closeLineIndex is the line index of the matching closing fence (or -1 if unclosed).
 *
 * Distinguishes bare `:::` (closing fence) from `::: {}` (opening fence with
 * no attrs) by checking whether the `{...}` token was present in the source.
 *
 * @param {string} chunk
 * @returns {Array<{lineIndex: number, closeLineIndex: number, matchKey: string|null, fenceStr: string, attrsStr: string}>}
 */
function parseFencedDivOpens(chunk) {
  const lines = chunk.split('\n');
  const result = [];
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(:{3,})\s*(\{([^}]*)\})?\s*$/);
    if (!match) continue;

    const fenceLen = match[1].length;
    const hasBraces = match[2] !== undefined; // `::: {}` vs bare `:::`
    const attrsStr = match[3] || '';

    // A bare `:::` (no braces) closes the innermost open fence.
    if (!hasBraces && stack.length > 0 && fenceLen >= stack[stack.length - 1].fenceLen) {
      const top = stack.pop();
      if (top.resultIdx !== undefined) result[top.resultIdx].closeLineIndex = i;
      continue;
    }

    const classes = (attrsStr.match(/\.[a-zA-Z_-][a-zA-Z0-9_-]*/g) || []).map(c => c.slice(1));
    const idMatch = attrsStr.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/);
    const matchKey = classes.length > 0 ? `.${classes[0]}` : (idMatch ? `#${idMatch[1]}` : null);
    const entry = { lineIndex: i, closeLineIndex: -1, matchKey, fenceStr: match[1], attrsStr, depth: stack.length };
    const resultIdx = result.length;
    result.push(entry);
    stack.push({ fenceLen, resultIdx });
  }

  return result.filter(e => e.depth === 0);
}

/**
 * Determine how a div can be identified in QMD source.
 * Returns { key: string|null, type: string } or null if not a fenced div candidate.
 * key is ".classname", "#id", or null (positional match only).
 */
function getFencedDivIdentifier(div) {
  const classes = Array.from(div.classList);

  if (classes.includes('columns')) return { key: '.columns', type: 'columns' };

  for (const ct of CALLOUT_TYPES) {
    if (classes.includes(ct)) return { key: `.${ct}`, type: 'callout' };
  }

  const knownInternal = new Set([
    'callout', 'callout-style-default', 'callout-captioned', 'callout-titled',
    'column', 'columns',
    'fragment', 'current-fragment', 'visible',
    'fade-in', 'fade-out', 'fade-up', 'fade-down', 'fade-left', 'fade-right',
    'absolute', 'editable', 'editable-container', 'editable-new', 'editable-heading-active',
    'modify-mode-valid', 'modify-mode-warn',
    'r-fit-text', 'r-stretch', 'r-frame', 'r-hstack', 'r-vstack',
    'slide-background', 'slide-background-content',
    // Code-block wrappers handled by the Code blocks classifier.
    'sourceCode', 'code-copy-outer-scaffold', 'code-with-copy', 'numberSource',
  ]);

  const userClass = classes.find(c => !knownInternal.has(c));
  if (userClass) return { key: `.${userClass}`, type: 'classed' };

  // Fall through to id-based matching (`::: {#my-id}` renders as <div id="my-id">)
  if (div.id) return { key: `#${div.id}`, type: 'id-keyed' };

  // No class or id — positional matching only
  return { key: null, type: 'classless' };
}

/**
 * Returns true if `el` is itself `.absolute` or is nested inside a `div.absolute`.
 * Centralises the duplicated `.absolute`-filter pattern used by classifiers
 * to skip elements that are already positioned.
 */
export function isAlreadyPositioned(el) {
  if (!el) return false;
  if (el.classList && el.classList.contains('absolute')) return true;
  return !!(el.closest && el.closest('div.absolute'));
}

/**
 * Returns the nearest `.absolute` ancestor (or `el` itself if it has the
 * class), or `null`. Used by the issue-#140 re-activation classifiers to
 * locate the positioning wrapper around an inner element.
 */
export function findPositionedAncestor(el) {
  if (!el || !el.closest) return null;
  return el.closest('.absolute');
}

/**
 * Build the inner attr string for a `.absolute` fence/wrapper, e.g.
 *   `.absolute left=10px top=20px width=300px height=200px style="transform: rotate(5deg);"`
 *
 * `include` is an explicit list of position keys to emit. Callers opt out
 * by omitting keys (callouts drop `height`; tables/equations drop `width`
 * and `height`). The default includes all four.
 */
export function buildAbsoluteAttrString(dims, { include = ['left', 'top', 'width', 'height'] } = {}) {
  const posAttrs = include.map(k => `${k}=${Math.round(dims[k])}px`);
  const styleAttrs = [];
  if (dims.rotation) styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
  let out = `.absolute ${posAttrs.join(' ')}`;
  if (styleAttrs.length) out += ` style="${styleAttrs.join(' ')}"`;
  return out;
}

/**
 * Wrap `lines[block.startLine .. block.endLine]` with a `::: {attrs}` / `:::`
 * fence pair, in place. Splices bottom-first so earlier indices aren't
 * invalidated.
 */
export function wrapLinesWithAbsoluteFence(lines, block, attrs) {
  lines.splice(block.endLine + 1, 0, ':::');
  lines.splice(block.startLine, 0, `::: {${attrs}}`);
}

/**
 * Sort `els` in place by their `dataset[attrName]` parsed as an integer.
 * Missing attrs sort as 0. Used by serialize() paths that recover the
 * classify-time positional index recorded on each element.
 */
export function sortByIndexAttr(els, attrName) {
  els.sort((a, b) =>
    parseInt(a.dataset[attrName] ?? '0', 10) -
    parseInt(b.dataset[attrName] ?? '0', 10)
  );
}

/**
 * Iterate `items` from last to first, invoking `fn(item, i)`. Used by
 * serialize() paths that splice into a `lines` array — iterating in reverse
 * keeps the indices of earlier items stable across insertions.
 */
export function forEachInReverse(items, fn) {
  for (let i = items.length - 1; i >= 0; i--) fn(items[i], i);
}

/**
 * Group registered, modify-mode elements by the QMD chunk that holds their
 * source. Reads `dataset.editableModifiedSlide` to map each element to a
 * chunk index. Skips elements not in `editableRegistry` and elements whose
 * slide maps past the end of the chunk array.
 *
 * Returns `{ chunks, byChunk }` — callers mutate `chunks[chunkIndex]` in
 * place and `return chunks.join('')` at the end.
 */
export function groupModifiedElementsByChunk(els, text) {
  const chunks = splitIntoSlideChunks(text);
  const byChunk = new Map();
  for (const el of els) {
    if (!editableRegistry.has(el)) continue;
    const slideIndex = parseInt(el.dataset.editableModifiedSlide ?? '0', 10);
    const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
    if (chunkIndex >= chunks.length) continue;
    if (!byChunk.has(chunkIndex)) byChunk.set(chunkIndex, []);
    byChunk.get(chunkIndex).push(el);
  }
  return { chunks, byChunk };
}

/**
 * Build the updated fence opening line with absolute position attrs merged in.
 * Preserves existing classes/attrs on the fence and appends the position data.
 */
function buildFenceLineWithAbsolute(originalLine, dims) {
  const match = originalLine.match(/^(:{3,})\s*(?:\{([^}]*)\})?\s*$/);
  if (!match) return originalLine;

  const fence = match[1];
  const existingAttrs = (match[2] || '').trim();

  const attrStr = buildAbsoluteAttrString(dims);
  const newAttrs = existingAttrs ? `${existingAttrs} ${attrStr}` : attrStr;

  return `${fence} {${newAttrs}}`;
}

ModifyModeClassifier.register({
  label: 'Fenced divs',

  classify(slideEl) {
    if (!window._input_file) return { valid: [], warn: [] };
    const slideIndex = Reveal.getState().indexh;
    const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[chunkIndex];
    if (!chunk) return { valid: [], warn: [] };

    const fencedOpens = parseFencedDivOpens(chunk);
    if (fencedOpens.length === 0) return { valid: [], warn: [] };

    // Collect direct-child divs that aren't already handled by other classifiers
    const candidates = Array.from(slideEl.children).filter(el =>
      el.tagName === 'DIV' &&
      !editableRegistry.has(el) &&
      !el.classList.contains('editable-container') &&
      !el.classList.contains('editable-new') &&
      !el.classList.contains('editable') &&
      !isAlreadyPositioned(el)
    );

    const valid = [];
    const warn = [];

    // Track which fenced opens have been claimed (by array index)
    const usedFenceIndices = new Set();
    // Track positional (classless/id-less) fence cursor
    const positionalFences = fencedOpens
      .map((fo, i) => ({ fo, i }))
      .filter(({ fo }) => fo.matchKey === null);
    let positionalCursor = 0;

    for (const div of candidates) {
      const ident = getFencedDivIdentifier(div);
      if (!ident) continue;

      let fenceIdx = -1;
      if (ident.key !== null) {
        // Match by class or id key
        fenceIdx = fencedOpens.findIndex((fo, i) => !usedFenceIndices.has(i) && fo.matchKey === ident.key);
      } else {
        // No class or id — match by position among keyless fenced divs
        while (positionalCursor < positionalFences.length && usedFenceIndices.has(positionalFences[positionalCursor].i)) {
          positionalCursor++;
        }
        if (positionalCursor < positionalFences.length) {
          fenceIdx = positionalFences[positionalCursor].i;
        }
      }

      if (fenceIdx === -1) continue;

      usedFenceIndices.add(fenceIdx);
      div.dataset.editableModifiedFenceIdx = String(fenceIdx);
      div.dataset.editableModifiedFenceType = ident.type;
      valid.push(div);
    }

    return { valid, warn };
  },

  activate(div) {
    const slideIndex = Reveal.getState().indexh;
    div.dataset.editableModifiedFence = 'true';
    div.dataset.editableModifiedSlide = String(slideIndex);

    // Capture natural position in slide-space coordinates before setup reparents
    // the element into the absolute editable-container (which starts at 0,0).
    const { left: origLeft, top: origTop } = captureSlideRelativePosition(div);

    if (div.dataset.editableModifiedFenceType === 'columns') {
      setCapabilityOverride(div, ['move', 'resize', 'rotate']);
      // Read natural dimensions at click time, before setup reparents into the
      // inline-block container (collapses width) and sets display:block (breaks flex).
      const naturalWidth  = div.offsetWidth;
      const naturalHeight = div.offsetHeight;
      setupDivWhenReady(div);
      div.style.display = 'flex';
      editableRegistry.get(div)?.setState({ width: naturalWidth, height: naturalHeight, x: origLeft, y: origTop });
    } else {
      setupDivWhenReady(div);
      waitForRegistryThenFixPosition(div, origLeft, origTop);
    }
  },

  serialize(text) {
    const divs = Array.from(
      document.querySelectorAll('div[data-editable-modified-fence="true"]')
    );
    if (divs.length === 0) return text;

    // Group by chunk, then replace fence lines
    const { chunks, byChunk } = groupModifiedElementsByChunk(divs, text);

    for (const [chunkIndex, chunkDivs] of byChunk) {
      // Re-parse once per chunk (source may have been modified by other serializers)
      const fencedOpens = parseFencedDivOpens(chunks[chunkIndex]);

      // Build list of operations and sort bottom-to-top so splices don't shift earlier indices
      const ops = [];
      for (const div of chunkDivs) {
        const fenceIdx = parseInt(div.dataset.editableModifiedFenceIdx ?? '-1', 10);
        if (fenceIdx < 0) continue;
        const openEntry = fencedOpens[fenceIdx];
        if (!openEntry) continue;
        const dims = editableRegistry.get(div).toDimensions();
        const isCallout = div.dataset.editableModifiedFenceType === 'callout';
        ops.push({ openEntry, dims, isCallout });
      }
      // Process from bottom to top so insertions don't shift line indices of earlier ops
      ops.sort((a, b) => b.openEntry.lineIndex - a.openEntry.lineIndex);

      const lines = chunks[chunkIndex].split('\n');

      for (const { openEntry, dims, isCallout } of ops) {
        if (isCallout && openEntry.closeLineIndex >= 0) {
          // Callout: wrap the entire callout block with a positioned div.
          // Quarto's callout renderer ignores positional attrs on the callout fence itself,
          // so we need an outer ::: {.absolute ...} wrapper.
          // Use :::: (4+ colons) as the outer fence to avoid clashing with inner ::: fences.
          //
          // Height is intentionally omitted: callout height is determined by content.
          // The block-level callout fills container width automatically; saving an explicit
          // height would cause a mismatch since the callout renders at content height after
          // re-render regardless of the wrapper's height.
          const wrapAttrs = buildAbsoluteAttrString(dims, { include: ['left', 'top', 'width'] });

          lines.splice(openEntry.closeLineIndex + 1, 0, '::::');
          lines.splice(openEntry.lineIndex, 0, `:::: {${wrapAttrs}}`);
        } else {
          // Plain fenced div: modify the fence line in-place
          lines[openEntry.lineIndex] = buildFenceLineWithAbsolute(lines[openEntry.lineIndex], dims);
        }
      }

      chunks[chunkIndex] = lines.join('\n');
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Plain paragraph classifier
// ---------------------------------------------------------------------------

/**
 * Extract top-level paragraph blocks from a QMD slide chunk.
 * Returns an array of { startLine, endLine, text } for each block.
 * Only blocks at depth 0 (outside fenced divs and code fences) are returned.
 * Blocks containing markdown image syntax (`![...](...)`) are skipped to keep
 * indices aligned with the paragraph classifier, which excludes <p> elements
 * containing <img>.
 * @param {string} chunk
 * @returns {Array<{startLine: number, endLine: number, text: string}>}
 */
export function extractParagraphBlocks(chunk) {
  const lines = chunk.split('\n');
  const blocks = [];
  let depth = 0;
  let inCodeBlock = false;
  let blockStart = -1;
  const blockLines = [];

  const commitBlock = () => {
    if (blockLines.length > 0) {
      const text = blockLines.join('\n');
      // Skip display-equation blocks (`$$...$$`): these are handled by the
      // Display equations classifier, and including them here would mis-align
      // the positional paragraph index in slides that mix equations and prose.
      if (!/!\[[^\]]*\]\(/.test(text) && !/^\s*\$\$/.test(text)) {
        blocks.push({
          startLine: blockStart,
          endLine: blockStart + blockLines.length - 1,
          text,
        });
      }
    }
    blockStart = -1;
    blockLines.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      commitBlock();
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
    if (fenceMatch) {
      commitBlock();
      const hasBraces = fenceMatch[2] !== undefined;
      if (!hasBraces && depth > 0) {
        depth--;
      } else {
        depth++;
      }
      continue;
    }

    if (depth > 0) continue;
    if (trimmed.startsWith('#')) { commitBlock(); continue; }
    if (trimmed === '') { commitBlock(); continue; }

    if (blockStart === -1) blockStart = i;
    blockLines.push(line);
  }
  commitBlock();

  return blocks;
}

// Decide whether a slide child counts as a standalone editable paragraph.
//
//  - Skip <p> elements containing <img>: standalone images and inline images
//    both render as <img> inside <p>, and the image classifier handles them.
//  - Skip <p> elements containing a display equation: the Display equations
//    classifier owns those.
//  - Skip Quarto figure captions (`<p class="caption">` / `<p class="figure-caption">`):
//    they render as direct slide children alongside the figure and would
//    otherwise be wrapped in their own `{.absolute}` block, divorcing the
//    caption from its figure.
export function isParagraphCandidate(el) {
  if (el.tagName !== 'P') return false;
  if (el.classList.contains('caption')) return false;
  if (el.classList.contains('figure-caption')) return false;
  if (el.querySelector('img')) return false;
  if (el.querySelector('span.math.display')) return false;
  return true;
}

// Assigns paragraph indices in DOM order without overwriting existing ones.
// Index stability is required: when classify re-runs after a paragraph is
// activated, the remaining unactivated paragraphs must keep their original
// positional indices so they still align with the QMD `paraBlocks` array.
export function assignStableParagraphIndices(paragraphs) {
  const used = new Set();
  for (const p of paragraphs) {
    const existing = p.dataset.editableModifiedParagraphIdx;
    if (existing !== undefined) used.add(parseInt(existing, 10));
  }
  let next = 0;
  for (const p of paragraphs) {
    if (p.dataset.editableModifiedParagraphIdx !== undefined) continue;
    while (used.has(next)) next++;
    p.dataset.editableModifiedParagraphIdx = String(next);
    used.add(next);
    next++;
  }
}

ModifyModeClassifier.register({
  label: 'Paragraphs',

  classify(slideEl) {
    // Skip <p> elements that contain an <img>: standalone images (`![](src)`) and
    // inline images (`text ![](src) text`) both render as <img> inside <p>, and the
    // image classifier handles them directly. Marking the wrapping <p> would create
    // overlapping click targets and let the user wrap the image in a fenced div,
    // which produces a much messier write-back than just adding {.absolute} to the
    // image markdown.
    const allParas = Array.from(slideEl.children).filter(isParagraphCandidate);

    // Index over ALL qualifying paragraphs (including already-activated ones)
    // so indices stay aligned with `extractParagraphBlocks` positions in QMD.
    assignStableParagraphIndices(allParas);

    const valid = allParas.filter(p =>
      !editableRegistry.has(p) && !isAlreadyPositioned(p)
    );
    return { valid, warn: [] };
  },

  activate(p) {
    const slideIndex = Reveal.getState().indexh;
    const { left: origLeft, top: origTop } = captureSlideRelativePosition(p);

    p.dataset.editableModifiedParagraph = 'true';
    p.dataset.editableModifiedSlide = String(slideIndex);
    // editableModifiedParagraphIdx already set by classify()

    initializeQuillForElement(p);
    setupDivWhenReady(p);
    waitForRegistryThenFixPosition(p, origLeft, origTop);
  },

  serialize(text) {
    const paras = Array.from(
      document.querySelectorAll('p[data-editable-modified-paragraph="true"]')
    );
    if (paras.length === 0) return text;

    const { chunks, byChunk } = groupModifiedElementsByChunk(paras, text);

    for (const [chunkIndex, chunkParas] of byChunk) {
      sortByIndexAttr(chunkParas, 'editableModifiedParagraphIdx');

      const paraBlocks = extractParagraphBlocks(chunks[chunkIndex]);
      const lines = chunks[chunkIndex].split('\n');

      // Process bottom-to-top so line splices don't shift earlier indices
      forEachInReverse(chunkParas, (p) => {
        const paraIdx = parseInt(p.dataset.editableModifiedParagraphIdx ?? '0', 10);
        if (paraIdx >= paraBlocks.length) return;

        const block = paraBlocks[paraIdx];
        const dims = editableRegistry.get(p).toDimensions();

        // Use Quill output if text was edited; otherwise preserve original QMD text
        const content = p.querySelector('.ql-editor')
          ? elementToText(p)
          : block.text;

        const attrs = buildAbsoluteAttrString(dims);

        const blockLineCount = block.endLine - block.startLine + 1;
        lines.splice(block.startLine, blockLineCount,
          `::: {${attrs}}`,
          content,
          ':::',
        );
      });

      chunks[chunkIndex] = lines.join('\n');
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Lists and blockquotes classifiers
// ---------------------------------------------------------------------------

/**
 * Extract top-level blocks from a QMD slide chunk whose first line matches testLine.
 * Used to locate ul, ol, and blockquote blocks by position.
 * @param {string} chunk
 * @param {function(string): boolean} testLine - returns true if a line starts a new block
 * @returns {Array<{startLine: number, endLine: number, text: string}>}
 */
function extractBlocksStartingWith(chunk, testLine) {
  const lines = chunk.split('\n');
  const blocks = [];
  let depth = 0;
  let inCodeBlock = false;
  let blockStart = -1;
  const blockLines = [];

  const commitBlock = () => {
    if (blockLines.length > 0) {
      blocks.push({
        startLine: blockStart,
        endLine: blockStart + blockLines.length - 1,
        text: blockLines.join('\n'),
      });
    }
    blockStart = -1;
    blockLines.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) { commitBlock(); inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;

    const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
    if (fenceMatch) {
      commitBlock();
      const hasBraces = fenceMatch[2] !== undefined;
      if (!hasBraces && depth > 0) depth--; else depth++;
      continue;
    }

    if (depth > 0) continue;
    if (trimmed === '') { commitBlock(); continue; }

    if (blockStart === -1) {
      if (testLine(line)) { blockStart = i; blockLines.push(line); }
    } else {
      blockLines.push(line);
    }
  }
  commitBlock();
  return blocks;
}

/**
 * Build a classifier for block-level list/blockquote elements.
 * @param {object} opts
 * @param {string} opts.tagName - uppercase tag name: 'UL', 'OL', 'BLOCKQUOTE'
 * @param {string} opts.dataKey - camelCase key used for dataset attrs (e.g. 'Ul')
 * @param {function(string): boolean} opts.testLine - identifies the first line of a source block
 * @param {string} opts.label - label shown in the modify panel
 */
function makeListClassifier({ tagName, dataKey, testLine, label }) {
  const idxAttr = `editableModified${dataKey}Idx`;
  const activeAttr = `editableModified${dataKey}`;

  return {
    label,

    classify(slideEl) {
      const candidates = Array.from(slideEl.children).filter(el =>
        el.tagName === tagName &&
        !editableRegistry.has(el) &&
        !isAlreadyPositioned(el)
      );
      const valid = [];
      let idx = 0;
      for (const el of candidates) {
        el.dataset[idxAttr] = String(idx++);
        valid.push(el);
      }
      return { valid, warn: [] };
    },

    activate(el) {
      const slideIndex = Reveal.getState().indexh;
      const { left: origLeft, top: origTop } = captureSlideRelativePosition(el);
      lockNaturalDimensions(el, 'block');

      el.dataset[activeAttr] = 'true';
      el.dataset.editableModifiedSlide = String(slideIndex);
      setCapabilityOverride(el, ['move', 'resize']);
      setupDivWhenReady(el);

      waitForRegistryThenFixPosition(el, origLeft, origTop);
    },

    serialize(text) {
      const htmlAttr = `data-editable-modified-${dataKey.toLowerCase()}`;
      const els = Array.from(
        document.querySelectorAll(`${tagName.toLowerCase()}[${htmlAttr}="true"]`)
      );
      if (els.length === 0) return text;

      const { chunks, byChunk } = groupModifiedElementsByChunk(els, text);

      for (const [chunkIndex, chunkEls] of byChunk) {
        sortByIndexAttr(chunkEls, idxAttr);

        const blocks = extractBlocksStartingWith(chunks[chunkIndex], testLine);
        const lines = chunks[chunkIndex].split('\n');

        forEachInReverse(chunkEls, (el) => {
          const elIdx = parseInt(el.dataset[idxAttr] ?? '0', 10);
          if (elIdx >= blocks.length) return;

          const block = blocks[elIdx];
          const dims = editableRegistry.get(el).toDimensions();

          const attrs = buildAbsoluteAttrString(dims);

          const blockLineCount = block.endLine - block.startLine + 1;
          lines.splice(block.startLine, blockLineCount,
            `::: {${attrs}}`,
            block.text,
            ':::',
          );
        });

        chunks[chunkIndex] = lines.join('\n');
      }

      return chunks.join('');
    },
  };
}

ModifyModeClassifier.register(makeListClassifier({
  tagName: 'UL',
  dataKey: 'Ul',
  testLine: (line) => /^[-*+] /.test(line),
  label: 'Bullet lists',
}));

ModifyModeClassifier.register(makeListClassifier({
  tagName: 'OL',
  dataKey: 'Ol',
  testLine: (line) => /^\d+[.)]\s/.test(line),
  label: 'Ordered lists',
}));

ModifyModeClassifier.register(makeListClassifier({
  tagName: 'BLOCKQUOTE',
  dataKey: 'Blockquote',
  testLine: (line) => /^>/.test(line),
  label: 'Blockquotes',
}));

// ---------------------------------------------------------------------------
// Positioned arrow classifier
// ---------------------------------------------------------------------------

/**
 * Kwargs the editable arrow system understands. Arrows whose shortcodes use
 * other kwargs (bend, fragment, aria-label, …) are classified as warn so we
 * don't silently drop those values during write-back.
 */
const SUPPORTED_ARROW_KWARGS = new Set([
  'from', 'to', 'control1', 'control2',
  'waypoints', 'smooth',
  'color', 'width', 'head', 'dash', 'line', 'opacity',
  'label', 'label-position', 'label-offset',
  'position',
]);

/**
 * Parse `key=value` pairs from a shortcode body. Supports double-quoted,
 * single-quoted, and unquoted values.
 * @param {string} body - The body between `{{< arrow ` and ` >}}`
 * @returns {Object<string,string>} Map of kwarg name → string value
 */
function parseArrowKwargs(body) {
  const kwargs = {};
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const value = m[2] !== undefined ? m[2]
                : m[3] !== undefined ? m[3]
                : m[4];
    kwargs[m[1]] = value;
  }
  return kwargs;
}

/**
 * Parse a "x,y" point string into {x, y} numbers, or null if invalid.
 */
function parseArrowPoint(s) {
  if (!s) return null;
  const parts = s.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { x: parts[0], y: parts[1] };
}

/**
 * Parse a `waypoints` value into an array of {x, y} points.
 * Accepts space-separated `x,y` pairs (e.g. `"100,50 200,80"`).
 */
function parseArrowWaypoints(s) {
  if (!s) return [];
  return s.trim().split(/\s+/)
    .map(parseArrowPoint)
    .filter(p => p !== null);
}

/**
 * Extract every `{{< arrow ... >}}` shortcode from a slide chunk.
 * Returns each occurrence in source order with its parsed kwargs and the
 * literal substring as it appeared in the source (so `serialize()` can match
 * and replace it without normalising whitespace or attribute order).
 *
 * @param {string} chunk
 * @returns {Array<{raw: string, body: string, kwargs: Object, index: number}>}
 *   `raw` is the full `{{< … >}}` literal, `index` is its character offset
 *   within `chunk`.
 */
export function parseArrowShortcodes(chunk) {
  const re = /\{\{<\s*arrow\s+([^>]*?)\s*>\}\}/g;
  const out = [];
  let m;
  while ((m = re.exec(chunk)) !== null) {
    out.push({
      raw: m[0],
      body: m[1],
      kwargs: parseArrowKwargs(m[1]),
      index: m.index,
    });
  }
  return out;
}

/**
 * Filter a list of parsed shortcodes to those that render as a positioned
 * (block-level) arrow div: only `position="absolute"` (or `"fixed"`) qualifies.
 */
function filterPositionedArrows(shortcodes) {
  return shortcodes.filter(sc =>
    sc.kwargs.position === 'absolute' || sc.kwargs.position === 'fixed'
  );
}

/**
 * Detect kwargs the editable system would silently drop on round-trip.
 * Returns the list of unsupported kwarg names (empty if all are supported).
 */
function unsupportedArrowKwargs(kwargs) {
  return Object.keys(kwargs).filter(k => !SUPPORTED_ARROW_KWARGS.has(k));
}

/**
 * Build an arrowData object compatible with createArrowElement() from
 * a parsed shortcode kwargs map. Falls back to defaults that match
 * addNewArrow() for any kwarg not present in the source.
 */
function arrowDataFromKwargs(kwargs) {
  const from = parseArrowPoint(kwargs.from) || { x: 0, y: 0 };
  const to   = parseArrowPoint(kwargs.to)   || { x: 0, y: 0 };
  const c1   = parseArrowPoint(kwargs.control1);
  const c2   = parseArrowPoint(kwargs.control2);
  const waypoints = parseArrowWaypoints(kwargs.waypoints);

  const numOr = (v, d) => {
    if (v === undefined || v === null || v === '') return d;
    const n = parseFloat(v);
    return isNaN(n) ? d : n;
  };

  return {
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    control1X: c1 ? c1.x : null,
    control1Y: c1 ? c1.y : null,
    control2X: c2 ? c2.x : null,
    control2Y: c2 ? c2.y : null,
    curveMode: !!(c1 || c2),
    waypoints,
    smooth: kwargs.smooth === 'true' || kwargs.smooth === true,
    color: kwargs.color || CONFIG.ARROW_DEFAULT_COLOR,
    width: numOr(kwargs.width, CONFIG.ARROW_DEFAULT_WIDTH),
    head: kwargs.head || 'arrow',
    dash: kwargs.dash || 'solid',
    line: kwargs.line || 'single',
    opacity: numOr(kwargs.opacity, 1),
    label: kwargs.label || '',
    labelPosition: kwargs['label-position'] || CONFIG.ARROW_DEFAULT_LABEL_POSITION,
    labelOffset: numOr(kwargs['label-offset'], CONFIG.ARROW_DEFAULT_LABEL_OFFSET),
    isActive: false,
  };
}

/**
 * Module-level list of arrows that have been activated from previous-save
 * shortcodes. Distinct from `NewElementRegistry.newArrows` (in-session
 * insertions) because write-back is in-place replacement of an existing
 * shortcode rather than appending a new one to the chunk.
 *
 * Each entry: { arrowData, sourceEl, slideIndex, sourceLiteral, occurrence }
 *   - arrowData: the editable arrow's data object (live)
 *   - sourceEl:  the original positioned div from the rendered slide (hidden)
 *   - slideIndex: Reveal.getState().indexh at activate time
 *   - sourceLiteral: exact `{{< arrow … >}}` string from the source chunk
 *   - occurrence: 0-based index among identical sourceLiteral strings in chunk
 */
const _modifiedArrows = [];

/**
 * Tracks arrow paths whose pointer-events we overrode during classification
 * so we can restore them on exit.  quarto-arrows emits arrows with the
 * wrapping div at `pointer-events: none` (so they don't intercept clicks
 * during a presentation).  Modify mode needs them clickable, but only on
 * the actual painted line — empty space inside an arrow's SVG bounding box
 * must remain click-through, otherwise diagonal or curved arrows (with
 * large bboxes) would swallow clicks meant for another arrow whose visible
 * line happens to fall inside their bbox.
 *
 * The approach: leave the wrapping div at `pointer-events: none` and the
 * outer SVG at its default.  Set `pointer-events: auto` on each visible
 * `<path>` element only — paths default to hit-testing on painted pixels
 * (`visiblePainted`), so empty SVG space stays click-through, while clicks
 * on the painted line catch on the path and bubble up to the click listener
 * attached to the wrapping div by `applyClassification`.  (Bubbling fires
 * the div listener regardless of the div's own `pointer-events: none`,
 * which only controls the div's own hit-testing target.)
 */
const _arrowsWithPointerEventsCleared = new Set();

/**
 * Find positioned arrow divs on the current slide that render a quarto-arrows
 * shortcode (have an SVG with a `<defs><marker id="arrow-…">` directly inside).
 * Excludes session-added arrows (marked with `editable-arrow-container`) and
 * already-activated source arrows.
 */
function findPositionedArrowDivs(slideEl) {
  const all = slideEl.querySelectorAll('div[style*="position: absolute"]');
  const out = [];
  for (const el of all) {
    if (el.classList.contains('editable-arrow-container')) continue;
    if (el.dataset.editableModifiedArrow === 'true') continue;
    if (el.dataset.editableModifiedArrowHidden === 'true') continue;
    const svg = el.querySelector(':scope > svg');
    if (!svg) continue;
    if (!svg.querySelector(':scope > defs > marker[id^="arrow-"]')) continue;
    out.push(el);
  }
  return out;
}

ModifyModeClassifier.register({
  label: 'Positioned arrows',

  classify(slideEl) {
    // Restore pointer-events on any arrow paths we touched in a previous
    // classification pass (e.g. user navigated away without clicking).
    for (const path of _arrowsWithPointerEventsCleared) {
      path.style.pointerEvents = '';
    }
    _arrowsWithPointerEventsCleared.clear();

    if (!window._input_file) return { valid: [], warn: [] };
    const slideIndex = Reveal.getState().indexh;
    const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[chunkIndex];
    if (!chunk) return { valid: [], warn: [] };

    const shortcodes = parseArrowShortcodes(chunk);
    const positioned = filterPositionedArrows(shortcodes);
    if (positioned.length === 0) return { valid: [], warn: [] };

    const divs = findPositionedArrowDivs(slideEl);
    if (divs.length === 0) return { valid: [], warn: [] };

    // Positional match: Nth shortcode → Nth div, in source/DOM order.
    // If counts differ (e.g. fragment-wrapped arrows produce extra spans, or
    // a styling option emits a wrapping element), pair as many as we can and
    // skip the rest.
    const pairCount = Math.min(positioned.length, divs.length);

    const valid = [];
    const warn  = [];

    // Track occurrence counts of identical literal shortcodes for write-back.
    const literalCounts = new Map();

    for (let i = 0; i < pairCount; i++) {
      const sc = positioned[i];
      const div = divs[i];
      const unsupported = unsupportedArrowKwargs(sc.kwargs);
      if (unsupported.length > 0) {
        warn.push({
          el: div,
          reason: `Arrow uses attributes not yet supported in modify mode: ${unsupported.join(', ')}`,
        });
        continue;
      }

      const occurrence = literalCounts.get(sc.raw) ?? 0;
      literalCounts.set(sc.raw, occurrence + 1);

      // Stamp source data for activate() and serialize().
      div.dataset.editableModifiedArrowSource = sc.raw;
      div.dataset.editableModifiedArrowOccurrence = String(occurrence);
      div.dataset.editableModifiedArrowKwargs = JSON.stringify(sc.kwargs);

      // Enable pointer events on every `<path>` inside the SVG.  Paths
      // default to `visiblePainted`, so only clicks on the actually painted
      // line/marker fire — empty SVG space stays click-through, which keeps
      // overlapping-arrow bboxes from swallowing clicks.  The wrapping div
      // and outer SVG are left at their defaults (none / visiblePainted)
      // so they don't intercept the bbox.  Click events bubble up from the
      // path to the click listener attached in applyClassification.
      div.querySelectorAll('svg path').forEach(p => {
        p.style.pointerEvents = 'auto';
        _arrowsWithPointerEventsCleared.add(p);
      });

      valid.push(div);
    }

    return { valid, warn };
  },

  activate(div) {
    const slideEl = div.closest('section');
    if (!slideEl) return;

    const kwargsJson = div.dataset.editableModifiedArrowKwargs;
    if (!kwargsJson) return;

    let kwargs;
    try { kwargs = JSON.parse(kwargsJson); } catch (e) { return; }

    const slideIndex = Reveal.getState().indexh;
    const arrowData = arrowDataFromKwargs(kwargs);
    arrowData.isActive = true;

    // Hide the source-rendered arrow (don't remove — keeping it preserves the
    // ordering anchor used by classify() if the user re-enters modify mode).
    div.dataset.editableModifiedArrowHidden = 'true';
    div.style.display = 'none';

    // Exit modify mode visually (rings off, button inactive) but don't reset
    // the toolbar panel — createArrowElement → setActiveArrow opens the arrow
    // style panel below, and we want it to stay visible so the user can see
    // the source's color/width/etc.  Without this, the default
    // exitModifyMode() that runs after activate() returns falsy would call
    // showRightPanel('default') and hide the arrow controls.
    exitModifyMode({ resetPanel: false });

    const arrowContainer = createArrowElement(arrowData);
    slideEl.appendChild(arrowContainer);
    arrowData.element = arrowContainer;
    arrowContainer.classList.remove('editable-new');

    _modifiedArrows.push({
      arrowData,
      sourceEl: div,
      slideIndex,
      sourceLiteral: div.dataset.editableModifiedArrowSource,
      occurrence: parseInt(div.dataset.editableModifiedArrowOccurrence ?? '0', 10),
    });

    setActiveArrow(arrowData);
    return true; // we already called exitModifyMode; skip the default exit
  },

  serialize(text) {
    if (_modifiedArrows.length === 0) return text;
    const chunks = splitIntoSlideChunks(text);

    // Group by chunk index so we can apply replacements per slide.
    const byChunk = new Map();
    for (const entry of _modifiedArrows) {
      const chunkIndex = getQmdHeadingIndex(entry.slideIndex) + 1;
      if (chunkIndex >= chunks.length) continue;
      if (!byChunk.has(chunkIndex)) byChunk.set(chunkIndex, []);
      byChunk.get(chunkIndex).push(entry);
    }

    for (const [chunkIndex, entries] of byChunk) {
      // Process longest source-literals first so a shorter literal that is a
      // substring of a longer one can't accidentally match the wrong span.
      // Within identical literals, sort by occurrence so the n-th replacement
      // targets the n-th appearance.
      entries.sort((a, b) => {
        if (a.sourceLiteral.length !== b.sourceLiteral.length) {
          return b.sourceLiteral.length - a.sourceLiteral.length;
        }
        return a.occurrence - b.occurrence;
      });

      // Per-literal replacement counters: track how many times we've already
      // consumed each unique sourceLiteral so identical-literal occurrences
      // line up with their occurrence stamps.
      const consumed = new Map();
      for (const entry of entries) {
        const replacement = serializeArrowToShortcode(entry.arrowData);
        const literal = entry.sourceLiteral;
        const skipCount = consumed.get(literal) ?? 0;

        let chunk = chunks[chunkIndex];
        let searchFrom = 0;
        let hit = -1;
        for (let i = 0; i <= skipCount; i++) {
          hit = chunk.indexOf(literal, searchFrom);
          if (hit === -1) break;
          searchFrom = hit + literal.length;
        }
        if (hit === -1) continue;

        chunks[chunkIndex] = chunk.slice(0, hit) + replacement + chunk.slice(hit + literal.length);
        consumed.set(literal, skipCount + 1);
      }
    }

    return chunks.join('');
  },

  cleanup() {
    // Restore path pointer-events to the inherited (none) value so arrows
    // don't intercept clicks once modify mode is closed.  Activated arrows'
    // source divs are display:none, so it doesn't matter whether their
    // paths get reset or not.
    for (const path of _arrowsWithPointerEventsCleared) {
      path.style.pointerEvents = '';
    }
    _arrowsWithPointerEventsCleared.clear();
  },
});

// ---------------------------------------------------------------------------
// Display code block classifier
// ---------------------------------------------------------------------------

/**
 * Extract top-level fenced code blocks from a QMD slide chunk.
 * Only blocks at depth 0 (not inside `:::` fenced divs) are returned.
 * @param {string} chunk
 * @returns {Array<{startLine: number, endLine: number, firstCodeLine: string}>}
 */
export function extractCodeBlocks(chunk) {
  const lines = chunk.split('\n');
  const blocks = [];
  let depth = 0;
  let blockStart = -1;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inBlock) {
      // Track fenced-div depth so we skip code blocks inside `:::` wrappers.
      const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
      if (fenceMatch) {
        const hasBraces = fenceMatch[2] !== undefined;
        if (!hasBraces && depth > 0) depth--; else depth++;
        continue;
      }

      if (depth === 0 && /^```/.test(line)) {
        inBlock = true;
        blockStart = i;
      }
    } else {
      if (/^```\s*$/.test(line)) {
        const firstCodeLine = lines
          .slice(blockStart + 1, i)
          .find(l => l.trim() !== '') ?? '';
        blocks.push({ startLine: blockStart, endLine: i, firstCodeLine });
        inBlock = false;
        blockStart = -1;
      }
    }
  }
  return blocks;
}

/**
 * Find the topmost ancestor of `el` that is a direct child of `slideEl`.
 * Returns null if `el` is not contained in `slideEl`.
 */
export function topLevelAncestorIn(slideEl, el) {
  let node = el;
  while (node && node.parentElement && node.parentElement !== slideEl) {
    node = node.parentElement;
  }
  return node && node.parentElement === slideEl ? node : null;
}

/**
 * Find unique top-level wrappers in `slideEl` that contain elements matching
 * `innerSelector`. Skips wrappers already claimed by modify mode (in the
 * registry, `editable-container`, or already positioned via `.absolute`).
 *
 * Optional `preFilter(innerEl)` filters out inner elements before the walk
 * (e.g. tables inside `div.cell` chunks belong to a different classifier).
 * Optional `postFilter(wrapper)` filters out wrappers after dedup (e.g. code
 * blocks skip `div.cell` wrappers; equations require a display-eq container).
 */
/**
 * Resolve each element in `chunkEls` to a source block using a header-line
 * anchor, falling back to a positional-index anchor stamped at classify time.
 *
 * The header anchor is only used if it's unique within `sources` — if two
 * sources share the same header line (rare for tables and display equations
 * but possible), the positional fallback fires. Returns an array parallel
 * to `chunkEls`, with `null` for elements that couldn't be resolved.
 *
 *   getHeader: source → string  (e.g. table → table.headerLine)
 *   headerAttr: dataset key holding the captured header line
 *   idxAttr: dataset key holding the positional index
 */
export function resolveByHeader({ chunkEls, sources, getHeader, headerAttr, idxAttr }) {
  const headerCounts = new Map();
  for (const s of sources) {
    const h = (getHeader(s) ?? '').trim();
    headerCounts.set(h, (headerCounts.get(h) ?? 0) + 1);
  }
  return chunkEls.map((el) => {
    const expected = (el.dataset[headerAttr] ?? '').trim();
    if (expected && headerCounts.get(expected) === 1) {
      return sources.find(s => (getHeader(s) ?? '').trim() === expected) ?? null;
    }
    const idx = parseInt(el.dataset[idxAttr] ?? '-1', 10);
    if (idx >= 0 && idx < sources.length) return sources[idx];
    return null;
  });
}

/**
 * Resolve a single element to a source block by label (named code-chunk
 * label etc.), falling back to a positional index guarded by a first-line
 * sanity check.
 *
 *   getLabel: source → string  (e.g. execChunk → execChunk.label)
 *   getFirstLine: source → string  (sanity-check for positional fallback)
 *   labelAttr / firstLineAttr / idxAttr: dataset keys captured at classify time
 */
export function resolveByLabel(el, sources, { getLabel, getFirstLine, labelAttr, firstLineAttr, idxAttr }) {
  const label = el.dataset[labelAttr] || '';
  if (label) {
    const named = sources.find(s => getLabel(s) === label);
    if (named) return named;
  }
  const idx = parseInt(el.dataset[idxAttr] ?? '-1', 10);
  if (idx >= 0 && idx < sources.length) {
    const candidate = sources[idx];
    const expectedFirst = (el.dataset[firstLineAttr] ?? '').trim();
    const actualFirst   = (getFirstLine(candidate) ?? '').trim();
    if (!expectedFirst || !actualFirst || expectedFirst === actualFirst) {
      return candidate;
    }
  }
  return null;
}

export function findTopLevelWrappers(slideEl, innerSelector, { preFilter, postFilter } = {}) {
  const inners = Array.from(slideEl.querySelectorAll(innerSelector));
  const wrappers = [];
  const seen = new Set();
  for (const inner of inners) {
    if (preFilter && !preFilter(inner)) continue;
    const w = topLevelAncestorIn(slideEl, inner);
    if (!w) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    if (editableRegistry.has(w)) continue;
    if (w.classList && w.classList.contains('editable-container')) continue;
    if (isAlreadyPositioned(w)) continue;
    if (postFilter && !postFilter(w)) continue;
    wrappers.push(w);
  }
  return wrappers;
}

/**
 * Read the first non-empty line of code text from a code-block wrapping
 * element (either a `<div class="code-copy-outer-scaffold">`/`<div
 * class="sourceCode">` or a bare `<pre>`).
 */
function getCodeFirstLine(wrapper) {
  const code = wrapper.querySelector('pre code') ?? wrapper.querySelector('pre') ?? wrapper;
  const text = code.textContent || '';
  return text.split('\n').find(l => l.trim() !== '') ?? '';
}

ModifyModeClassifier.register({
  label: 'Code blocks',

  classify(slideEl) {
    // Code-chunk cells (executable {r}/{python}/{ojs}/... blocks) are handled
    // by the Code chunk outputs classifier; skip them here so we don't
    // double-claim.
    const wrappers = findTopLevelWrappers(slideEl, 'pre', {
      postFilter: (w) => !(w.tagName === 'DIV' && w.classList.contains('cell')),
    });
    const valid = [];
    let idx = 0;
    for (const wrapper of wrappers) {
      wrapper.dataset.editableModifiedCodeIdx = String(idx++);
      wrapper.dataset.editableModifiedCodeFirstLine = getCodeFirstLine(wrapper);
      valid.push(wrapper);
    }

    return { valid, warn: [] };
  },

  activate(el) {
    const slideIndex = Reveal.getState().indexh;
    const { left: origLeft, top: origTop } = captureSlideRelativePosition(el);
    // Lock natural dimensions before setup so reparenting into the inline-block
    // editable-container doesn't collapse or stretch the block.
    lockNaturalDimensions(el, 'block');

    el.dataset.editableModifiedCode = 'true';
    el.dataset.editableModifiedSlide = String(slideIndex);
    setCapabilityOverride(el, ['move', 'resize']);
    // Single-line code blocks can be shorter than setupDivWhenReady's
    // MIN_ELEMENT_SIZE polling threshold; we already locked the natural
    // dimensions above, so go straight to setup.
    setupDraggableElt(el);

    waitForRegistryThenFixPosition(el, origLeft, origTop);
  },

  serialize(text) {
    const els = Array.from(
      document.querySelectorAll('[data-editable-modified-code="true"]')
    );
    if (els.length === 0) return text;

    const { chunks, byChunk } = groupModifiedElementsByChunk(els, text);

    for (const [chunkIndex, chunkEls] of byChunk) {
      sortByIndexAttr(chunkEls, 'editableModifiedCodeIdx');

      const blocks = extractCodeBlocks(chunks[chunkIndex]);
      const lines = chunks[chunkIndex].split('\n');

      // Bottom-to-top so line splices don't shift earlier indices.
      forEachInReverse(chunkEls, (el) => {
        const codeIdx = parseInt(el.dataset.editableModifiedCodeIdx ?? '0', 10);
        if (codeIdx >= blocks.length) return;

        // Safety: verify the positional match still names the same code block.
        const expectedFirst = (el.dataset.editableModifiedCodeFirstLine ?? '').trim();
        const actualFirst   = (blocks[codeIdx].firstCodeLine ?? '').trim();
        if (expectedFirst && actualFirst && expectedFirst !== actualFirst) return;

        const block = blocks[codeIdx];
        const dims = editableRegistry.get(el).toDimensions();

        const attrs = buildAbsoluteAttrString(dims);

        wrapLinesWithAbsoluteFence(lines, block, attrs);
      });

      chunks[chunkIndex] = lines.join('\n');
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Code chunk output classifier
// ---------------------------------------------------------------------------

/**
 * Parse executable code chunks from a QMD slide chunk.
 * An executable chunk has a fence with engine braces, e.g. `\`\`\`{r}`,
 * `\`\`\`{python label}`, `\`\`\`{ojs}`.
 * Only chunks at depth 0 (outside `:::` fenced divs) are returned.
 *
 * @param {string} chunk
 * @returns {Array<{startLine: number, endLine: number, label: string|null, firstCodeLine: string}>}
 */
export function extractExecutableChunks(chunk) {
  const lines = chunk.split('\n');
  const chunks = [];
  let depth = 0;
  let chunkStart = -1;
  let chunkLabel = null;
  let inChunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inChunk) {
      const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
      if (fenceMatch) {
        const hasBraces = fenceMatch[2] !== undefined;
        if (!hasBraces && depth > 0) depth--; else depth++;
        continue;
      }

      if (depth === 0) {
        // Match an executable chunk fence: ```{engine [label] [opts]}
        const execMatch = line.match(/^```+\s*\{([^}]+)\}\s*$/);
        if (execMatch) {
          const inner = execMatch[1].trim();
          const tokens = inner.split(/\s+/);
          // First token is the engine; an optional bare label follows
          // (without `=`). Anything else is treated as options.
          let label = null;
          if (tokens.length >= 2 && !tokens[1].includes('=') && !tokens[1].startsWith('.')) {
            label = tokens[1];
          }
          inChunk = true;
          chunkStart = i;
          chunkLabel = label;
        }
      }
    } else {
      if (/^```\s*$/.test(line)) {
        // First non-empty, non-`#|`-option line of code content as the anchor.
        const body = lines.slice(chunkStart + 1, i);
        const firstCodeLine = body.find(l => l.trim() !== '' && !l.trim().startsWith('#|')) ?? '';
        // Modern Quarto labels live in `#| label: foo` option lines; fall back
        // to the fence-token label captured at open time.
        if (chunkLabel === null) {
          for (const l of body) {
            const m = l.match(/^\s*#\|\s*label:\s*([A-Za-z0-9_-]+)\s*$/);
            if (m) { chunkLabel = m[1]; break; }
            if (l.trim() !== '' && !l.trim().startsWith('#|')) break;
          }
        }
        chunks.push({ startLine: chunkStart, endLine: i, label: chunkLabel, firstCodeLine });
        inChunk = false;
        chunkStart = -1;
        chunkLabel = null;
      }
    }
  }
  return chunks;
}

/**
 * True if the cell has at least one visible non-image output and no image
 * output. Image outputs are handled by the Images classifier; we exclude any
 * cell that contains an `<img>` so the two classifiers don't both ring the
 * same chunk.
 */
function cellQualifiesForOutput(cell) {
  const outputs = cell.querySelectorAll('[class*="cell-output"]');
  if (outputs.length === 0) return false;
  if (cell.querySelector('img')) return false;
  for (const out of outputs) {
    if (out.children.length > 0 || out.textContent.trim() !== '') return true;
  }
  return false;
}

ModifyModeClassifier.register({
  label: 'Code chunk outputs',

  classify(slideEl) {
    if (!window._input_file) return { valid: [], warn: [] };
    const slideIndex = Reveal.getState().indexh;
    const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[chunkIndex];
    if (!chunk) return { valid: [], warn: [] };

    const execChunks = extractExecutableChunks(chunk);
    if (execChunks.length === 0) return { valid: [], warn: [] };

    // Walk top-level slots in DOM order. A slot is either a `div.cell` direct
    // child, or an `editable-container` direct child whose first descendant
    // `div.cell` is an already-activated chunk. This keeps positional indices
    // stable when the user activates one cell and re-enters modify mode for
    // its sibling.
    const allCells = [];
    for (const child of slideEl.children) {
      if (child.tagName !== 'DIV') continue;
      if (child.classList.contains('cell')) {
        if (isAlreadyPositioned(child)) continue;
        allCells.push(child);
      } else if (child.classList.contains('editable-container')) {
        const inner = child.querySelector(':scope > div.cell');
        if (inner) allCells.push(inner);
      }
    }

    // Counts must agree positionally. If the user has manually written
    // `::: {.cell}` fenced divs alongside real chunks, we can't reliably
    // map DOM cells to source — defer to the Fenced divs classifier.
    if (allCells.length !== execChunks.length) return { valid: [], warn: [] };

    const valid = [];
    for (let i = 0; i < allCells.length; i++) {
      const cell = allCells[i];
      // Skip cells that are already activated (wrapped in editable-container)
      // — they are still positionally counted above to keep indices aligned.
      if (editableRegistry.has(cell)) continue;
      if (cell.closest('.editable-container')) continue;
      if (!cellQualifiesForOutput(cell)) continue;
      const exec = execChunks[i];
      cell.dataset.editableModifiedCellIdx = String(i);
      cell.dataset.editableModifiedCellLabel = exec.label || '';
      cell.dataset.editableModifiedCellFirstLine = exec.firstCodeLine;
      valid.push(cell);
    }

    return { valid, warn: [] };
  },

  activate(el) {
    const slideIndex = Reveal.getState().indexh;
    const { left: origLeft, top: origTop } = captureSlideRelativePosition(el);
    // Lock natural dimensions before setup; without this, reparenting into the
    // inline-block editable-container collapses the cell width.
    lockNaturalDimensions(el, 'block');

    el.dataset.editableModifiedCell = 'true';
    el.dataset.editableModifiedSlide = String(slideIndex);
    setCapabilityOverride(el, ['move', 'resize']);
    setupDraggableElt(el);

    waitForRegistryThenFixPosition(el, origLeft, origTop);
  },

  serialize(text) {
    const els = Array.from(
      document.querySelectorAll('[data-editable-modified-cell="true"]')
    );
    if (els.length === 0) return text;

    const { chunks, byChunk } = groupModifiedElementsByChunk(els, text);

    for (const [chunkIndex, chunkEls] of byChunk) {
      sortByIndexAttr(chunkEls, 'editableModifiedCellIdx');

      const execChunks = extractExecutableChunks(chunks[chunkIndex]);
      const lines = chunks[chunkIndex].split('\n');

      // Bottom-to-top so line splices don't shift earlier indices.
      forEachInReverse(chunkEls, (el) => {
        // Prefer match by chunk label (named chunks); fall back to positional.
        const target = resolveByLabel(el, execChunks, {
          getLabel: (c) => c.label,
          getFirstLine: (c) => c.firstCodeLine,
          labelAttr: 'editableModifiedCellLabel',
          firstLineAttr: 'editableModifiedCellFirstLine',
          idxAttr: 'editableModifiedCellIdx',
        });
        if (!target) return;

        const dims = editableRegistry.get(el).toDimensions();
        const attrs = buildAbsoluteAttrString(dims);

        wrapLinesWithAbsoluteFence(lines, target, attrs);
      });

      chunks[chunkIndex] = lines.join('\n');
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Code chunk figure classifier (single-figure chunks)
// ---------------------------------------------------------------------------
//
// An executable code chunk that produces exactly one <img> figure can be
// dragged/resized/rotated. On save the whole source chunk is wrapped in a
// `::: {.absolute ...}` fenced div. Multi-figure chunks are warned by the
// Images classifier and skipped here.

ModifyModeClassifier.register({
  label: 'Code chunk figures',

  classify(slideEl) {
    if (!window._input_file) return { valid: [], warn: [] };
    const slideIndex = Reveal.getState().indexh;
    const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[chunkIndex];
    if (!chunk) return { valid: [], warn: [] };

    const execChunks = extractExecutableChunks(chunk);
    if (execChunks.length === 0) return { valid: [], warn: [] };

    // Single-figure chunks get auto-stretched: Reveal promotes the <img> out
    // of its `div.cell` wrapper and adds `r-stretch`, so we can't rely on the
    // cell wrapping. Instead, group imgs by knitr's chunk-prefix in the
    // generated filename (`figure-revealjs/<prefix>-<n>.png`). A prefix that
    // appears exactly once on the slide is a single-figure chunk; multi-figure
    // prefixes (count > 1) are already warn-classified by the Images classifier.
    const imgs = Array.from(slideEl.querySelectorAll('img'));
    const prefixCounts = buildChunkPrefixCounts(imgs);

    const candidates = [];
    for (const img of imgs) {
      if (editableRegistry.has(img)) continue;
      if (isAlreadyPositioned(img)) continue;
      const src = getImgSrc(img);
      if (!src) continue;
      const prefix = getChunkPrefix(src);
      if (!prefix) continue;
      if (prefixCounts.get(prefix) !== 1) continue;
      candidates.push({ img, prefix });
    }
    if (candidates.length === 0) return { valid: [], warn: [] };

    candidates.sort((a, b) =>
      a.img.compareDocumentPosition(b.img) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    // Pass 1: named chunks (filename prefix == fence/option label).
    const usedExecIdx = new Set();
    const assignments = [];
    const unresolved = [];
    for (const { img, prefix } of candidates) {
      const idx = execChunks.findIndex((c, i) => c.label === prefix && !usedExecIdx.has(i));
      if (idx >= 0) {
        assignments.push({ img, execIdx: idx, exec: execChunks[idx] });
        usedExecIdx.add(idx);
      } else {
        unresolved.push({ img, prefix });
      }
    }

    // Pass 2: positional match for remaining (unnamed) candidates against
    // the still-unclaimed unnamed exec chunks, in source order.
    const remainingExec = [];
    for (let i = 0; i < execChunks.length; i++) {
      if (usedExecIdx.has(i)) continue;
      if (execChunks[i].label) continue;
      remainingExec.push({ execIdx: i, exec: execChunks[i] });
    }
    for (let i = 0; i < unresolved.length && i < remainingExec.length; i++) {
      assignments.push({ img: unresolved[i].img, ...remainingExec[i] });
    }

    const valid = [];
    for (const { img, execIdx, exec } of assignments) {
      img.dataset.editableModifiedChunkFigExecIdx = String(execIdx);
      img.dataset.editableModifiedChunkFigLabel = exec.label || '';
      img.dataset.editableModifiedChunkFigFirstLine = exec.firstCodeLine;
      valid.push(img);
    }

    return { valid, warn: [] };
  },

  activate(img) {
    const originalSrc = getImgSrc(img);
    if (!img.getAttribute('src') && img.getAttribute('data-src')) {
      img.src = img.getAttribute('data-src');
    }
    // r-stretch is Reveal's auto-stretch class; once we wrap the img into an
    // absolutely-positioned editable-container it just fights our sizing.
    img.classList.remove('r-stretch');

    // Lock the on-screen dimensions before the inline-block editable-container
    // wraps the img. Without this:
    //   - Reveal's `max-width: 95%` shrinks the img when dragged toward the
    //     right edge (the wrapper's effective width follows the slide width).
    //   - The HTML `width="960"` attribute also resolves against the wrapper.
    const scale = getSlideScale();
    const rect = img.getBoundingClientRect();
    img.style.width  = (rect.width  / scale) + 'px';
    img.style.height = (rect.height / scale) + 'px';
    img.style.maxWidth  = 'none';
    img.style.maxHeight = 'none';
    img.removeAttribute('width');
    img.removeAttribute('height');

    img.dataset.editableModifiedSrc = originalSrc;
    img.dataset.editableModifiedChunkFig = 'true';
    img.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
    setupImageWhenReady(img);
  },

  serialize(text) {
    const imgs = Array.from(
      document.querySelectorAll('img[data-editable-modified-chunk-fig="true"]')
    );
    if (imgs.length === 0) return text;

    const { chunks, byChunk } = groupModifiedElementsByChunk(imgs, text);

    for (const [chunkIndex, chunkImgs] of byChunk) {
      sortByIndexAttr(chunkImgs, 'editableModifiedChunkFigExecIdx');

      const execChunks = extractExecutableChunks(chunks[chunkIndex]);
      const lines = chunks[chunkIndex].split('\n');

      // Bottom-to-top so splices don't shift earlier line indices.
      forEachInReverse(chunkImgs, (img) => {
        const target = resolveByLabel(img, execChunks, {
          getLabel: (c) => c.label,
          getFirstLine: (c) => c.firstCodeLine,
          labelAttr: 'editableModifiedChunkFigLabel',
          firstLineAttr: 'editableModifiedChunkFigFirstLine',
          idxAttr: 'editableModifiedChunkFigExecIdx',
        });
        if (!target) return;

        const dims = editableRegistry.get(img).toDimensions();
        const attrs = buildAbsoluteAttrString(dims);

        wrapLinesWithAbsoluteFence(lines, target, attrs);
      });

      chunks[chunkIndex] = lines.join('\n');
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Table classifier (move only)
// ---------------------------------------------------------------------------

/**
 * Extract top-level tables from a QMD slide chunk.
 *
 * Supports four Quarto table syntaxes:
 *   - pipe tables   (`| A | B |` ... `|---|---|`)
 *   - grid tables   (`+---+---+` borders with `|` content rows)
 *   - HTML tables   (raw `<table>...</table>`)
 *   - list tables   (`::: {.list-table}` … `:::`)
 *
 * Quarto's list-table Lua filter replaces the fenced div with a bare
 * `<table>` in the rendered DOM, so it doesn't surface to the fenced-divs
 * classifier — we have to claim it here.  Tables inside ``` code fences
 * and other `:::` fenced divs are skipped (depth filter).
 *
 * If a table is immediately followed (optionally across blank lines) by a
 * Pandoc caption line (`: Caption ...` or `Table: ...`), the caption is
 * included in the table's line range so the write-back wrap covers it.
 *
 * @param {string} chunk
 * @returns {Array<{startLine: number, endLine: number, headerLine: string, kind: string}>}
 */
export function extractTables(chunk) {
  const lines = chunk.split('\n');
  const tables = [];
  let depth = 0;
  let inCode = false;

  const isPipeRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isPipeSep = (l) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
  const isGridBorder = (l) => /^\s*\+[-=+:]{3,}\+\s*$/.test(l);
  const isGridRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isHtmlOpen  = (l) => /^\s*<table[\s>]/i.test(l);
  const isHtmlClose = (l) => /<\/table\s*>/i.test(l);
  const isCaption   = (l) => /^\s*(:|Table:)\s+\S/.test(l);

  // Extend `end` to include a trailing Pandoc caption block, if present.
  function extendWithCaption(end) {
    let j = end + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length && isCaption(lines[j])) {
      let capEnd = j;
      while (capEnd + 1 < lines.length && lines[capEnd + 1].trim() !== '') capEnd++;
      return capEnd;
    }
    return end;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inCode) {
      if (/^```\s*$/.test(line)) inCode = false;
      continue;
    }
    if (/^```/.test(line)) { inCode = true; continue; }

    const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
    if (fenceMatch) {
      const hasBraces = fenceMatch[2] !== undefined;
      // List table: a `.list-table` fenced div at depth 0 — Quarto's filter
      // renders this directly to a `<table>`, so we need to claim the whole
      // fenced block as a table.
      if (hasBraces && depth === 0 && /(^|[\s\{])\.list-table(\s|\})/.test(fenceMatch[2])) {
        const start = i;
        let inner = 1;
        let end = -1;
        let firstContent = null;
        for (let j = i + 1; j < lines.length; j++) {
          const m2 = lines[j].match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
          if (m2) {
            if (m2[2] !== undefined) inner++; else inner--;
            if (inner === 0) { end = j; break; }
          } else if (firstContent === null && lines[j].trim()) {
            firstContent = lines[j];
          }
        }
        if (end !== -1) {
          const extended = extendWithCaption(end);
          tables.push({
            startLine: start,
            endLine: extended,
            headerLine: firstContent ?? line,
            kind: 'list',
          });
          i = extended;
          continue;
        }
      }
      if (!hasBraces && depth > 0) depth--; else depth++;
      continue;
    }
    if (depth !== 0) continue;

    // Pipe table: header row + separator
    if (isPipeRow(line) && i + 1 < lines.length && isPipeSep(lines[i + 1])) {
      const start = i;
      let end = i + 1;
      for (let j = i + 2; j < lines.length; j++) {
        if (isPipeRow(lines[j])) end = j;
        else break;
      }
      end = extendWithCaption(end);
      tables.push({ startLine: start, endLine: end, headerLine: line, kind: 'pipe' });
      i = end;
      continue;
    }

    // Grid table: starts with `+---+`, alternating borders and `|` rows
    if (isGridBorder(line)) {
      const start = i;
      let end = i;
      let firstContent = null;
      let j = i + 1;
      while (j < lines.length && (isGridBorder(lines[j]) || isGridRow(lines[j]))) {
        if (firstContent === null && isGridRow(lines[j])) firstContent = lines[j];
        end = j;
        j++;
      }
      if (firstContent === null || end === start) continue;
      end = extendWithCaption(end);
      tables.push({ startLine: start, endLine: end, headerLine: firstContent, kind: 'grid' });
      i = end;
      continue;
    }

    // Raw HTML table
    if (isHtmlOpen(line)) {
      const start = i;
      let end = -1;
      if (isHtmlClose(line)) {
        end = i;
      } else {
        for (let j = i + 1; j < lines.length; j++) {
          if (isHtmlClose(lines[j])) { end = j; break; }
        }
      }
      if (end === -1) continue;
      end = extendWithCaption(end);
      tables.push({ startLine: start, endLine: end, headerLine: line, kind: 'html' });
      i = end;
    }
  }

  return tables;
}

// Kept for backward compatibility with existing tests/imports.
export const extractPipeTables = (chunk) =>
  extractTables(chunk).filter(t => t.kind === 'pipe');

ModifyModeClassifier.register({
  label: 'Tables',

  classify(slideEl) {
    if (!window._input_file) return { valid: [], warn: [] };
    const slideIndex = Reveal.getState().indexh;
    const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[chunkIndex];
    if (!chunk) return { valid: [], warn: [] };

    const sourceTables = extractTables(chunk);
    if (sourceTables.length === 0) return { valid: [], warn: [] };

    // Tables rendered as the output of an executable code chunk belong to
    // the code-output classifier — skip them at the inner level.
    const wrappers = findTopLevelWrappers(slideEl, 'table', {
      preFilter: (t) => !t.closest('div.cell'),
    });

    // Positional pairing: bail if counts differ so we don't mis-anchor.
    if (wrappers.length !== sourceTables.length) return { valid: [], warn: [] };

    const valid = [];
    for (let i = 0; i < wrappers.length; i++) {
      const w = wrappers[i];
      w.dataset.editableModifiedTableIdx = String(i);
      w.dataset.editableModifiedTableHeader = sourceTables[i].headerLine;
      valid.push(w);
    }
    return { valid, warn: [] };
  },

  activate(el) {
    const slideIndex = Reveal.getState().indexh;
    const { left: origLeft, top: origTop } = captureSlideRelativePosition(el);
    const isTable = el.tagName === 'TABLE';
    lockNaturalDimensions(el);

    el.dataset.editableModifiedTable = 'true';
    el.dataset.editableModifiedSlide = String(slideIndex);
    setCapabilityOverride(el, ['move']);
    setupDraggableElt(el);

    // setupEltStyles forces display:block; restore table layout so the table
    // renders correctly inside the inline-block editable-container.
    if (isTable) el.style.display = 'table';

    waitForRegistryThenFixPosition(el, origLeft, origTop);
  },

  serialize(text) {
    const els = Array.from(
      document.querySelectorAll('[data-editable-modified-table="true"]')
    );
    if (els.length === 0) return text;

    const { chunks, byChunk } = groupModifiedElementsByChunk(els, text);

    for (const [chunkIndex, chunkEls] of byChunk) {
      sortByIndexAttr(chunkEls, 'editableModifiedTableIdx');

      const sourceTables = extractTables(chunks[chunkIndex]);
      const lines = chunks[chunkIndex].split('\n');

      // Resolve target source table per element. Primary anchor: header
      // line text. If the header is duplicated in the chunk, fall back to
      // the positional index stamped at classify time.
      const resolved = resolveByHeader({
        chunkEls,
        sources: sourceTables,
        getHeader: (t) => t.headerLine,
        headerAttr: 'editableModifiedTableHeader',
        idxAttr: 'editableModifiedTableIdx',
      });

      // Build splice plan and apply bottom-to-top so earlier indices aren't shifted.
      const plan = chunkEls
        .map((el, i) => ({ el, target: resolved[i] }))
        .filter(p => p.target)
        .sort((a, b) => b.target.startLine - a.target.startLine);

      for (const { el, target } of plan) {
        const dims = editableRegistry.get(el).toDimensions();
        const attrs = buildAbsoluteAttrString(dims, { include: ['left', 'top'] });
        wrapLinesWithAbsoluteFence(lines, target, attrs);
      }

      chunks[chunkIndex] = lines.join('\n');
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Display equation classifier (move + resize)
// ---------------------------------------------------------------------------

/**
 * Extract top-level display equation blocks (`$$...$$`) from a QMD slide
 * chunk. Skips equations inside fenced code blocks (``` ```) and fenced
 * divs (`:::`). Supports both single-line (`$$E=mc^2$$`) and multi-line
 * (`$$\n…\n$$`) forms.
 *
 * @param {string} chunk
 * @returns {Array<{startLine: number, endLine: number, headerLine: string}>}
 */
export function extractDisplayEquations(chunk) {
  const lines = chunk.split('\n');
  const eqs = [];
  let depth = 0;
  let inCode = false;
  let mathStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inCode) {
      if (/^```\s*$/.test(line)) inCode = false;
      continue;
    }
    if (mathStart === -1 && /^```/.test(line)) { inCode = true; continue; }

    if (mathStart === -1) {
      const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
      if (fenceMatch) {
        const hasBraces = fenceMatch[2] !== undefined;
        if (!hasBraces && depth > 0) depth--; else depth++;
        continue;
      }
      if (depth !== 0) continue;

      const open = line.match(/^\s*\$\$(.*)$/);
      if (!open) continue;
      const rest = open[1];
      const closeIdx = rest.indexOf('$$');
      if (closeIdx !== -1) {
        // Single-line block: `$$ ... $$`. Require nothing significant after.
        const after = rest.slice(closeIdx + 2).trim();
        if (after === '') {
          eqs.push({ startLine: i, endLine: i, headerLine: line });
        }
      } else {
        mathStart = i;
      }
    } else {
      // Inside a multi-line display block — look for closing `$$`.
      if (/\$\$\s*$/.test(line)) {
        const body = lines.slice(mathStart, i + 1);
        const headerLine = body.find(l => l.trim() && l.trim() !== '$$') ?? lines[mathStart];
        eqs.push({ startLine: mathStart, endLine: i, headerLine });
        mathStart = -1;
      }
    }
  }
  return eqs;
}

/**
 * Returns true when `el` contains exactly one rendered display-math node
 * (the `<span class="math display">` or its MathJax/KaTeX replacement) and
 * no other significant content. We use this to recognise standalone
 * display equations (Pandoc emits each one inside its own `<p>`).
 */
function isDisplayEquationContainer(el) {
  const span = el.querySelector(':scope span.math.display, :scope > span.math.display');
  if (!span) return false;
  // Walk children — allow whitespace text and MathJax-inserted siblings
  // (`<script type="math/tex">`, `<mjx-container>`, `.MathJax_Preview`),
  // reject any inline text or other content.
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent && node.textContent.trim() !== '') return false;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    if (node === span) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'mjx-container') continue;
    if (node.classList.contains('MathJax') ||
        node.classList.contains('MathJax_Preview') ||
        node.classList.contains('MathJax_Display') ||
        node.classList.contains('katex-display')) continue;
    return false;
  }
  return true;
}

// Try each selector individually, in priority order, and return the first
// match. We can't pass a comma-joined list to querySelector because that
// returns the first match in DOCUMENT order, which would prefer the outer
// full-width `span.math.display` source wrapper over an inner inline-block
// rendered math node (mjx-container / .katex-display). Measuring the outer
// wrapper makes origLeft collapse to 0 because the wrapper spans the slide.
const EQUATION_RENDER_SELECTORS = [
  'mjx-container',
  '.MathJax_Display',
  '.katex-display',
  'span.math.display',
];

export function pickEquationRenderNode(el, selectors = EQUATION_RENDER_SELECTORS) {
  for (const sel of selectors) {
    const hit = el.querySelector(sel);
    if (hit) return hit;
  }
  return null;
}

ModifyModeClassifier.register({
  label: 'Display equations',

  classify(slideEl) {
    if (!window._input_file) return { valid: [], warn: [] };
    const slideIndex = Reveal.getState().indexh;
    const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[chunkIndex];
    if (!chunk) return { valid: [], warn: [] };

    const sourceEqs = extractDisplayEquations(chunk);
    if (sourceEqs.length === 0) return { valid: [], warn: [] };

    const wrappers = findTopLevelWrappers(slideEl, 'span.math.display', {
      postFilter: isDisplayEquationContainer,
    });

    if (wrappers.length !== sourceEqs.length) return { valid: [], warn: [] };

    const valid = [];
    for (let i = 0; i < wrappers.length; i++) {
      const w = wrappers[i];
      w.dataset.editableModifiedEqIdx = String(i);
      w.dataset.editableModifiedEqHeader = sourceEqs[i].headerLine;
      valid.push(w);
    }
    return { valid, warn: [] };
  },

  activate(el) {
    const slideIndex = Reveal.getState().indexh;
    // Anchor on the rendered math node when available so the container's
    // top edge sits at the visible top of the equation (not the top of the
    // wrapping `<p>`'s margin box, which would shift the equation down).
    const inner = pickEquationRenderNode(el) ?? el;
    const { left: origLeft, top: origTop, width: naturalW, height: naturalH } =
      captureSlideRelativePosition(el, { rectSource: inner });

    el.style.padding = '0';
    el.style.margin  = '0';
    el.style.width   = naturalW + 'px';
    el.style.height  = naturalH + 'px';
    el.querySelectorAll('.MathJax_Display, mjx-container, .katex-display').forEach(n => {
      n.style.margin = '0';
    });

    el.dataset.editableModifiedEq = 'true';
    el.dataset.editableModifiedSlide = String(slideIndex);
    setCapabilityOverride(el, ['move']);
    setupDraggableElt(el);

    waitForRegistryThenFixPosition(el, origLeft, origTop);
  },

  serialize(text) {
    const els = Array.from(
      document.querySelectorAll('[data-editable-modified-eq="true"]')
    );
    if (els.length === 0) return text;

    const { chunks, byChunk } = groupModifiedElementsByChunk(els, text);

    for (const [chunkIndex, chunkEls] of byChunk) {
      sortByIndexAttr(chunkEls, 'editableModifiedEqIdx');

      const sourceEqs = extractDisplayEquations(chunks[chunkIndex]);
      const lines = chunks[chunkIndex].split('\n');

      // Header-anchored resolution with positional fallback (same approach
      // as Tables); the LaTeX body line repeating in one chunk is rare.
      const resolved = resolveByHeader({
        chunkEls,
        sources: sourceEqs,
        getHeader: (e) => e.headerLine,
        headerAttr: 'editableModifiedEqHeader',
        idxAttr: 'editableModifiedEqIdx',
      });

      const plan = chunkEls
        .map((el, i) => ({ el, target: resolved[i] }))
        .filter(p => p.target)
        .sort((a, b) => b.target.startLine - a.target.startLine);

      for (const { el, target } of plan) {
        const dims = editableRegistry.get(el).toDimensions();
        const attrs = buildAbsoluteAttrString(dims, { include: ['left', 'top'] });
        wrapLinesWithAbsoluteFence(lines, target, attrs);
      }

      chunks[chunkIndex] = lines.join('\n');
    }

    return chunks.join('');
  },
});

// ---------------------------------------------------------------------------
// Classification and lifecycle
// ---------------------------------------------------------------------------

/**
 * Run all registered classifiers against the current slide and return the
 * combined valid/warn lists.
 * @returns {{ valid: Array<{el: Element, classifier: Classifier}>, warn: Element[] }}
 */
function classifyElements() {
  const reveal = document.querySelector('.reveal');
  const currentSlide = reveal?.querySelector('.slides section.present:not(.slide-background)') ?? reveal;

  const valid = [];
  const warn  = [];

  for (const classifier of _classifiers) {
    const result = classifier.classify(currentSlide);
    result.valid.forEach(el => valid.push({ el, classifier }));
    result.warn.forEach(({ el, reason }) => {
      warn.push(el);
      _warnReasons.set(el, reason);
    });
  }

  return { valid, warn };
}

/**
 * (Re-)classify elements and attach click handlers.
 * Called on entry and on every slide change.
 */
function applyClassification() {
  restoreAriaLabels();
  document.querySelectorAll(`.${VALID_CLASS}, .${WARN_CLASS}`).forEach(el => {
    el.classList.remove(VALID_CLASS, WARN_CLASS);
  });
  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;

  const { valid, warn } = classifyElements();

  valid.forEach(({ el, classifier }) => {
    el.classList.add(VALID_CLASS);
    const typeLabel = classifier.label ? ` (${classifier.label})` : '';
    applyAriaLabel(el, `Click to modify${typeLabel}`);
    el.addEventListener('click', (e) => onValidElementClick(e, classifier), { signal });
  });
  warn.forEach(el => {
    el.classList.add(WARN_CLASS);
    const reason = _warnReasons.get(el);
    applyAriaLabel(el, reason ? `Cannot modify: ${reason}` : 'Cannot modify');
  });

  document.addEventListener('keydown', onModifyModeKeyDown, { signal });
}

function onModifyModeKeyDown(e) {
  if (e.key !== 'Escape') return;
  // Don't swallow Escape while the user is editing a heading inline —
  // that classifier has its own Escape handler to revert the edit.
  if (document.querySelector('.editable-heading-active')) return;
  e.preventDefault();
  exitModifyMode();
  document.querySelector('.toolbar-modify')?.focus();
}

/**
 * Populate the modify panel with the list of activatable element types.
 * Called each time modify mode is entered so the list reflects current classifiers.
 */
function buildModifyPanel() {
  const panel = document.querySelector('.toolbar-panel-modify');
  if (!panel) return;
  panel.innerHTML = '';
}

/**
 * Enter modify mode: classify elements, attach click handlers, and listen for
 * slide changes so classification stays current as the user navigates.
 */
export function enterModifyMode() {
  _active = true;
  document.querySelector('.reveal')?.classList.add(ROOT_CLASS);
  buildModifyPanel();
  showRightPanel('modify');
  applyClassification();
  Reveal.on('slidechanged', applyClassification);
}

/**
 * Exit modify mode: remove all classification classes, listeners, and the
 * toolbar active state.
 */
export function exitModifyMode({ resetPanel = true } = {}) {
  _active = false;
  document.querySelector('.reveal')?.classList.remove(ROOT_CLASS);
  Reveal.off('slidechanged', applyClassification);
  abortController?.abort();
  abortController = null;

  for (const classifier of _classifiers) {
    if (typeof classifier.cleanup === 'function') classifier.cleanup();
  }

  restoreAriaLabels();
  document.querySelectorAll(`.${VALID_CLASS}, .${WARN_CLASS}`).forEach(el => {
    el.classList.remove(VALID_CLASS, WARN_CLASS);
  });

  document.querySelector('.toolbar-modify')?.classList.remove('active');
  if (resetPanel) showRightPanel('default');
}

/**
 * Toggle modify mode on/off and sync the toolbar button.
 */
export function toggleModifyMode() {
  if (_active) {
    exitModifyMode();
  } else {
    enterModifyMode();
    document.querySelector('.toolbar-modify')?.classList.add('active');
  }
}

/**
 * Handle click on a valid element in modify mode.
 * Activates the element and exits modify mode.
 * @param {MouseEvent}  e
 * @param {Classifier}  classifier
 */
function onValidElementClick(e, classifier) {
  e.stopPropagation();
  const el = e.currentTarget;
  const stayActive = classifier.activate(el);
  if (!stayActive) exitModifyMode();
}
