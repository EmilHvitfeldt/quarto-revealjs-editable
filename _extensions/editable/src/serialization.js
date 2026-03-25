/**
 * Serialization utilities for converting element state to QMD format.
 * Handles property serialization, HTML-to-Quarto conversion, and QMD transformation.
 * @module serialization
 */

import { CONFIG } from './config.js';
import { round, getOriginalEditableElements, getOriginalEditableDivs } from './utils.js';
import { getBrandColorOutput, normalizeColor } from './colors.js';
import { editableRegistry } from './editable-element.js';
import { NewElementRegistry } from './registries.js';
import { quillInstances } from './quill.js';

/**
 * Find all level-2 heading line indices (slide boundaries) in QMD lines.
 * @param {string[]} lines - Array of QMD lines
 * @returns {number[]} Array of line indices where slide headings start
 */
function findSlideHeadingLines(lines) {
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : "";
    if (line.startsWith("## ") && (i === 0 || prevLine === "")) {
      headings.push(i);
    }
  }
  return headings;
}

/**
 * Property serializers for converting state values to QMD attribute strings.
 * Each serializer specifies its type ("attr" for attributes, "style" for CSS)
 * and a serialize function that returns the formatted string.
 * @type {Object<string, {type: string, serialize: Function}>}
 * @example
 * // Add a new serializer
 * PropertySerializers.opacity = {
 *   type: "style",
 *   serialize: (v) => v !== 1 ? `opacity: ${v};` : null
 * };
 */
export const PropertySerializers = {
  // Core position/size properties (go in attribute list)
  width: {
    type: "attr",
    serialize: (v) => `width=${round(v)}px`,
  },
  height: {
    type: "attr",
    serialize: (v) => `height=${round(v)}px`,
  },
  left: {
    type: "attr",
    serialize: (v) => `left=${round(v)}px`,
  },
  top: {
    type: "attr",
    serialize: (v) => `top=${round(v)}px`,
  },

  // Style properties (go in style attribute)
  fontSize: {
    type: "style",
    serialize: (v) => (v ? `font-size: ${v}px;` : null),
  },
  textAlign: {
    type: "style",
    serialize: (v) => (v ? `text-align: ${v};` : null),
  },
  rotation: {
    type: "style",
    serialize: (v) => (v ? `transform: rotate(${round(v)}deg);` : null),
  },
};

/**
 * Serialize dimensions object to QMD attribute string.
 * @param {Object} dimensions - Dimension values from EditableElement.toDimensions()
 * @returns {string} Formatted attribute string (e.g., "{.absolute width=200px ...}")
 */
export function serializeToQmd(dimensions) {
  const attrs = [];
  const styles = [];

  for (const [key, value] of Object.entries(dimensions)) {
    const serializer = PropertySerializers[key];
    if (serializer && value != null) {
      const result = serializer.serialize(value);
      if (result) {
        if (serializer.type === "style") {
          styles.push(result);
        } else {
          attrs.push(result);
        }
      }
    }
  }

  let str = `{.absolute ${attrs.join(" ")}`;
  if (styles.length > 0) {
    str += ` style="${styles.join(" ")}"`;
  }
  str += "}";
  return str;
}

/**
 * Get the fence string needed for div content.
 * If content contains :::, uses :::: (or longer) to avoid conflicts.
 * @param {string} content - The content to be fenced
 * @returns {string} Fence string (e.g., ":::" or "::::")
 */
export function getFenceForContent(content) {
  // Find the longest sequence of colons at the start of any line
  const matches = content.match(/^:+/gm) || [];
  let maxColons = 3; // Default fence is :::
  for (const match of matches) {
    if (match.length >= maxColons) {
      maxColons = match.length + 1;
    }
  }
  return ":".repeat(maxColons);
}

/**
 * Convert element innerHTML to Quarto/Markdown text with proper formatting.
 * Handles Quill editor content, HTML tags, and brand color shortcodes.
 * @param {HTMLElement} element - The element to convert
 * @returns {string} Quarto-formatted markdown text
 */
export function elementToText(element) {
  // If Quill was used, get content from .ql-editor
  const quillEditor = element.querySelector(".ql-editor");
  let text = quillEditor ? quillEditor.innerHTML.trim() : element.innerHTML.trim();

  // Convert HTML tags to Quarto/Markdown equivalents
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Handle Quill alignment classes on paragraphs using placeholder approach
  text = text.replace(/<p[^>]*class="[^"]*ql-align-(center|right|justify)[^"]*"[^>]*>/gi,
    (match, align) => `__ALIGN_START_${align}__`);
  text = text.replace(/__ALIGN_START_(center|right|justify)__([\s\S]*?)<\/p>/gi,
    (match, align, content) => `__ALIGN_START_${align}__${content}__ALIGN_END_${align}__\n\n`);

  // Handle remaining p tags (left-aligned or no alignment)
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<code[^>]*>/gi, "`");
  text = text.replace(/<\/code>/gi, "`");

  // Bold: <strong> and <b> → **text**
  text = text.replace(/<strong[^>]*>/gi, "**");
  text = text.replace(/<\/strong>/gi, "**");
  text = text.replace(/<b[^>]*>/gi, "**");
  text = text.replace(/<\/b>/gi, "**");

  // Italic: <em> and <i> → *text*
  text = text.replace(/<em[^>]*>/gi, "*");
  text = text.replace(/<\/em>/gi, "*");
  text = text.replace(/<i[^>]*>/gi, "*");
  text = text.replace(/<\/i>/gi, "*");

  // Strikethrough: <del> and <s> and <strike> → ~~text~~
  text = text.replace(/<del[^>]*>/gi, "~~");
  text = text.replace(/<\/del>/gi, "~~");
  text = text.replace(/<s(?![a-z])[^>]*>/gi, "~~");
  text = text.replace(/<\/s(?![a-z])>/gi, "~~");
  text = text.replace(/<strike[^>]*>/gi, "~~");
  text = text.replace(/<\/strike>/gi, "~~");

  // Underline: <u> → [text]{.underline}
  text = text.replace(/<u[^>]*>/gi, "[");
  text = text.replace(/<\/u>/gi, "]{.underline}");

  // Background color spans (must be processed BEFORE color to avoid false matches)
  text = text.replace(/<span[^>]*style="[^"]*background-color:\s*([^;"]+)[^"]*"[^>]*>/gi, '[__BG_START__$1__');
  text = text.replace(/__BG_START__([^_]+)__([^<]*)<\/span>/gi, (match, colorVal, content) => {
    const colorOutput = getBrandColorOutput(colorVal);
    return `${content}]{style='background-color: ${colorOutput}'}`;
  });

  // Color spans: <span style="color: ...">text</span> → [text]{style="color: ..."}
  text = text.replace(/<span[^>]*style="[^"]*(?<!background-)color:\s*([^;"]+)[^"]*"[^>]*>/gi, (match, colorVal) => {
    if (colorVal.trim().toLowerCase() === 'inherit') {
      return '';
    }
    return `[__COLOR_START__${colorVal}__`;
  });
  text = text.replace(/__COLOR_START__([^_]+)__([^<]*)<\/span>/gi, (match, colorVal, content) => {
    const colorOutput = getBrandColorOutput(colorVal);
    return `${content}]{style='color: ${colorOutput}'}`;
  });

  // Links: <a href="url">text</a> → [text](url)
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "[$2]($1)");

  // Remove any remaining HTML tags (cleanup)
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Clean up excessive newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  // Convert brand color placeholders back to shortcodes
  text = text.replace(/__BRAND_SHORTCODE_(\w+)__/g, '{{< brand color $1 >}}');

  // Convert alignment placeholders to fenced div syntax
  text = text.replace(/__ALIGN_START_(center|right|justify)__([\s\S]*?)__ALIGN_END_\1__/g,
    (match, align, content) => {
      const trimmed = content.trim();
      const innerFence = getFenceForContent(trimmed);
      return `${innerFence} {style="text-align: ${align}"}\n${trimmed}\n${innerFence}`;
    });

  return text.trim();
}

/**
 * Serialize an arrow to quarto-arrows shortcode format.
 * @param {Object} arrow - Arrow data object
 * @returns {string} Arrow shortcode (e.g., '{{< arrow from="x,y" to="x,y" ... >}}')
 */
export function serializeArrowToShortcode(arrow) {
  const fromX = round(arrow.fromX);
  const fromY = round(arrow.fromY);
  const toX = round(arrow.toX);
  const toY = round(arrow.toY);

  let shortcode = `{{< arrow from="${fromX},${fromY}" to="${toX},${toY}"`;

  // Add control points if they exist (curved arrow)
  if (arrow.control1X !== null && arrow.control1Y !== null) {
    const c1x = round(arrow.control1X);
    const c1y = round(arrow.control1Y);
    shortcode += ` control1="${c1x},${c1y}"`;
  }

  if (arrow.control2X !== null && arrow.control2Y !== null) {
    const c2x = round(arrow.control2X);
    const c2y = round(arrow.control2Y);
    shortcode += ` control2="${c2x},${c2y}"`;
  }

  // Add waypoints if they exist
  if (arrow.waypoints && arrow.waypoints.length > 0) {
    const waypointsStr = arrow.waypoints
      .map(wp => `${round(wp.x)},${round(wp.y)}`)
      .join(" ");
    shortcode += ` waypoints="${waypointsStr}"`;

    // Add smooth only if waypoints exist and smooth is enabled
    if (arrow.smooth) {
      shortcode += ` smooth="true"`;
    }
  }

  // Add styling (only if non-default)
  const normalizedArrowColor = normalizeColor(arrow.color);
  if (arrow.color && normalizedArrowColor !== "#000000") {
    const colorOutput = getBrandColorOutput(arrow.color);
    shortcode += ` color="${colorOutput}"`;
  }

  if (arrow.width && arrow.width !== CONFIG.ARROW_DEFAULT_WIDTH) {
    shortcode += ` width="${arrow.width}"`;
  }

  if (arrow.head && arrow.head !== "arrow") {
    shortcode += ` head="${arrow.head}"`;
  }

  if (arrow.dash && arrow.dash !== "solid") {
    shortcode += ` dash="${arrow.dash}"`;
  }

  if (arrow.line && arrow.line !== "single") {
    shortcode += ` line="${arrow.line}"`;
  }

  if (arrow.opacity !== undefined && arrow.opacity !== 1) {
    shortcode += ` opacity="${arrow.opacity}"`;
  }

  // Label attributes
  if (arrow.label) {
    shortcode += ` label="${arrow.label}"`;
  }

  if (arrow.label && arrow.labelPosition && arrow.labelPosition !== "middle") {
    shortcode += ` label-position="${arrow.labelPosition}"`;
  }

  if (arrow.label && arrow.labelOffset !== undefined && arrow.labelOffset !== CONFIG.ARROW_DEFAULT_LABEL_OFFSET) {
    shortcode += ` label-offset="${arrow.labelOffset}"`;
  }

  shortcode += ` position="absolute" >}}`;

  return shortcode;
}

/**
 * Extract dimensions from all original editable elements.
 * @returns {Object[]} Array of dimension objects for serialization
 */
export function extractEditableEltDimensions() {
  // Only process original elements, not dynamically added ones
  const editableElements = getOriginalEditableElements();
  const dimensions = [];

  editableElements.forEach((elt) => {
    const editableElt = editableRegistry.get(elt);
    if (editableElt) {
      // Use centralized state
      dimensions.push(editableElt.toDimensions());
    } else {
      // Fallback for elements not in registry (shouldn't happen)
      const width = elt.style.width ? parseFloat(elt.style.width) : elt.offsetWidth;
      const height = elt.style.height ? parseFloat(elt.style.height) : elt.offsetHeight;

      const parentContainer = elt.parentNode;
      const left = parentContainer.style.left
        ? parseFloat(parentContainer.style.left)
        : parentContainer.offsetLeft;
      const top = parentContainer.style.top
        ? parseFloat(parentContainer.style.top)
        : parentContainer.offsetTop;

      dimensions.push({ width, height, left, top });
    }
  });

  return dimensions;
}

/**
 * Insert new slides (with their associated divs and arrows) into QMD content.
 * Handles tree-based ordering for chained slide insertions.
 * @param {string} text - Original QMD content
 * @returns {{text: string, slideLinePositions: Map}} Updated text and position map
 */
export function insertNewSlides(text) {
  if (NewElementRegistry.newSlides.length === 0) {
    return { text, slideLinePositions: new Map() };
  }

  const lines = text.split("\n");
  const slideHeadingLines = findSlideHeadingLines(lines);

  // Build a map of new slides to their associated divs
  const divsByNewSlide = new Map();
  for (const divInfo of NewElementRegistry.newDivs) {
    if (divInfo.newSlideRef) {
      if (!divsByNewSlide.has(divInfo.newSlideRef)) {
        divsByNewSlide.set(divInfo.newSlideRef, []);
      }
      divsByNewSlide.get(divInfo.newSlideRef).push(divInfo);
    }
  }

  // Build a map of new slides to their associated arrows
  const arrowsByNewSlide = new Map();
  for (const arrowInfo of NewElementRegistry.newArrows) {
    if (arrowInfo.newSlideRef) {
      if (!arrowsByNewSlide.has(arrowInfo.newSlideRef)) {
        arrowsByNewSlide.set(arrowInfo.newSlideRef, []);
      }
      arrowsByNewSlide.get(arrowInfo.newSlideRef).push(arrowInfo);
    }
  }

  // Build tree structure for slides with same afterSlideIndex
  function flattenSlideTree(slides) {
    const childrenOf = new Map();
    const roots = [];

    for (const slide of slides) {
      if (slide.insertAfterNewSlide && slides.includes(slide.insertAfterNewSlide)) {
        if (!childrenOf.has(slide.insertAfterNewSlide)) {
          childrenOf.set(slide.insertAfterNewSlide, []);
        }
        childrenOf.get(slide.insertAfterNewSlide).push(slide);
      } else {
        roots.push(slide);
      }
    }

    roots.sort((a, b) => b.insertionOrder - a.insertionOrder);

    for (const [, children] of childrenOf) {
      children.sort((a, b) => b.insertionOrder - a.insertionOrder);
    }

    const result = [];
    function visit(slide) {
      result.push(slide);
      const children = childrenOf.get(slide) || [];
      for (const child of children) {
        visit(child);
      }
    }
    for (const root of roots) {
      visit(root);
    }
    return result;
  }

  // Group slides by afterSlideIndex
  const slidesByAfterIndex = new Map();
  for (const slide of NewElementRegistry.newSlides) {
    const idx = slide.afterSlideIndex;
    if (!slidesByAfterIndex.has(idx)) {
      slidesByAfterIndex.set(idx, []);
    }
    slidesByAfterIndex.get(idx).push(slide);
  }

  const afterIndices = [...slidesByAfterIndex.keys()].sort((a, b) => b - a);

  const slideLinePositions = new Map();

  for (const afterIdx of afterIndices) {
    const slidesForThisIndex = slidesByAfterIndex.get(afterIdx);
    const orderedSlides = flattenSlideTree(slidesForThisIndex);

    const targetHeadingIndex = afterIdx;
    let baseInsertLineIndex;
    if (targetHeadingIndex >= slideHeadingLines.length) {
      baseInsertLineIndex = lines.length;
    } else if (targetHeadingIndex + 1 < slideHeadingLines.length) {
      baseInsertLineIndex = slideHeadingLines[targetHeadingIndex + 1];
    } else {
      baseInsertLineIndex = lines.length;
    }

    for (let i = orderedSlides.length - 1; i >= 0; i--) {
      const newSlide = orderedSlides[i];

      const newSlideContent = ["", CONFIG.NEW_SLIDE_HEADING, ""];

      const divsForThisSlide = divsByNewSlide.get(newSlide) || [];
      for (const divInfo of divsForThisSlide) {
        const editableElt = editableRegistry.get(divInfo.element);
        if (editableElt) {
          const dims = editableElt.toDimensions();
          const attrStr = serializeToQmd(dims);
          const textContent =
            elementToText(divInfo.element) || CONFIG.NEW_TEXT_CONTENT;

          const fence = getFenceForContent(textContent);

          newSlideContent.push("");
          newSlideContent.push(`${fence} ${attrStr}`);
          newSlideContent.push(textContent);
          newSlideContent.push(fence);
        }
      }

      const arrowsForThisSlide = arrowsByNewSlide.get(newSlide) || [];
      for (const arrowInfo of arrowsForThisSlide) {
        const shortcode = serializeArrowToShortcode(arrowInfo);
        newSlideContent.push("");
        newSlideContent.push(shortcode);
        newSlideContent.push("");
      }

      slideLinePositions.set(newSlide, baseInsertLineIndex + 1);

      lines.splice(baseInsertLineIndex, 0, ...newSlideContent);

      for (const [slide, pos] of slideLinePositions) {
        if (slide !== newSlide && pos >= baseInsertLineIndex) {
          slideLinePositions.set(slide, pos + newSlideContent.length);
        }
      }
    }

    const totalLinesAdded = orderedSlides.reduce((sum, slide) => {
      const divs = divsByNewSlide.get(slide) || [];
      const arrows = arrowsByNewSlide.get(slide) || [];
      return sum + 3 + divs.length * 4 + arrows.length * 3;
    }, 0);

    for (let j = 0; j < slideHeadingLines.length; j++) {
      if (slideHeadingLines[j] >= baseInsertLineIndex) {
        slideHeadingLines[j] += totalLinesAdded;
      }
    }
  }

  return { text: lines.join("\n"), slideLinePositions };
}

/**
 * Insert new text divs into QMD content (for divs on original slides).
 * @param {string} text - QMD content (may already have new slides inserted)
 * @param {Map} [slideLinePositions=new Map()] - Position map from insertNewSlides
 * @returns {string} Updated QMD content
 */
export function insertNewDivs(text, slideLinePositions = new Map()) {
  const divsOnOriginalSlides = NewElementRegistry.newDivs.filter(
    (div) => !div.newSlideRef
  );

  if (divsOnOriginalSlides.length === 0) {
    return text;
  }

  const lines = text.split("\n");
  const slideHeadingLines = findSlideHeadingLines(lines);

  const divsBySlide = new Map();
  for (const newDiv of divsOnOriginalSlides) {
    const slideIdx = newDiv.slideIndex;
    if (!divsBySlide.has(slideIdx)) {
      divsBySlide.set(slideIdx, []);
    }
    divsBySlide.get(slideIdx).push(newDiv);
  }

  const slideIndices = [...divsBySlide.keys()].sort((a, b) => b - a);

  for (const slideIdx of slideIndices) {
    const divsForSlide = divsBySlide.get(slideIdx);

    let insertLineIndex;
    if (slideIdx >= slideHeadingLines.length) {
      insertLineIndex = lines.length;
    } else if (slideIdx + 1 < slideHeadingLines.length) {
      insertLineIndex = slideHeadingLines[slideIdx + 1];
    } else {
      insertLineIndex = lines.length;
    }

    const newContent = [];
    for (const divInfo of divsForSlide) {
      const editableElt = editableRegistry.get(divInfo.element);
      if (editableElt) {
        const dims = editableElt.toDimensions();
        const attrStr = serializeToQmd(dims);
        const textContent =
          elementToText(divInfo.element) || CONFIG.NEW_TEXT_CONTENT;

        const fence = getFenceForContent(textContent);

        newContent.push("");
        newContent.push(`${fence} ${attrStr}`);
        newContent.push(textContent);
        newContent.push(fence);
      }
    }

    if (newContent.length > 0) {
      lines.splice(insertLineIndex, 0, ...newContent);

      for (let i = 0; i < slideHeadingLines.length; i++) {
        if (slideHeadingLines[i] >= insertLineIndex) {
          slideHeadingLines[i] += newContent.length;
        }
      }
    }
  }

  return lines.join("\n");
}

/**
 * Insert new arrows into QMD content (for arrows on original slides).
 * @param {string} text - QMD content
 * @param {Map} [slideLinePositions=new Map()] - Position map from insertNewSlides
 * @returns {string} Updated QMD content
 */
export function insertNewArrows(text, slideLinePositions = new Map()) {
  const arrowsOnOriginalSlides = NewElementRegistry.newArrows.filter(
    (arrow) => !arrow.newSlideRef
  );

  if (arrowsOnOriginalSlides.length === 0) {
    return text;
  }

  const lines = text.split("\n");
  const slideHeadingLines = findSlideHeadingLines(lines);

  const arrowsBySlide = new Map();
  for (const arrow of arrowsOnOriginalSlides) {
    const slideIdx = arrow.slideIndex;
    if (!arrowsBySlide.has(slideIdx)) {
      arrowsBySlide.set(slideIdx, []);
    }
    arrowsBySlide.get(slideIdx).push(arrow);
  }

  const slideIndices = [...arrowsBySlide.keys()].sort((a, b) => b - a);

  for (const slideIdx of slideIndices) {
    const arrowsForSlide = arrowsBySlide.get(slideIdx);

    let insertLineIndex;
    if (slideIdx >= slideHeadingLines.length) {
      insertLineIndex = lines.length;
    } else if (slideIdx + 1 < slideHeadingLines.length) {
      insertLineIndex = slideHeadingLines[slideIdx + 1];
    } else {
      insertLineIndex = lines.length;
    }

    const newContent = [];
    for (const arrow of arrowsForSlide) {
      const shortcode = serializeArrowToShortcode(arrow);
      newContent.push("");
      newContent.push(shortcode);
      newContent.push("");
    }

    if (newContent.length > 0) {
      lines.splice(insertLineIndex, 0, ...newContent);

      for (let i = 0; i < slideHeadingLines.length; i++) {
        if (slideHeadingLines[i] >= insertLineIndex) {
          slideHeadingLines[i] += newContent.length;
        }
      }
    }
  }

  return lines.join("\n");
}

/**
 * Update existing text div content in QMD (converts HTML to Quarto markdown).
 * @param {string} text - QMD content
 * @returns {string} Updated QMD content with converted div contents
 */
export function updateTextDivs(text) {
  const divs = getOriginalEditableDivs();
  const replacements = Array.from(divs).map(htmlToQuarto);

  const regex = /^(:{3,}) ?(?:\{\.editable[^}]*\}|editable)\n([\s\S]*?)\n\1$/gm;

  let index = 0;
  return text.replace(regex, (match, fence, originalContent) => {
    const replacement = replacements[index++];
    if (replacement === null) {
      const contentFence = getFenceForContent(originalContent);
      return `${contentFence} {.editable}\n${originalContent}\n${contentFence}`;
    }
    return replacement || "";
  });
}

/**
 * Convert a div's HTML content to Quarto fenced div format.
 * Returns null if div wasn't modified (preserves original content).
 * @param {HTMLElement} div - The div element
 * @returns {string|null} Quarto fenced div or null if unmodified
 */
export function htmlToQuarto(div) {
  const quillData = quillInstances.get(div);
  if (quillData && !quillData.isDirty) {
    return null;
  }

  const text = elementToText(div);

  const fence = getFenceForContent(text);
  return `${fence} {.editable}\n` + text.trim() + `\n${fence}`;
}

/**
 * Replace {.editable} attribute strings with {.absolute ...} in QMD.
 * @param {string} text - QMD content
 * @param {string[]} replacements - Array of replacement attribute strings
 * @returns {string} Updated QMD content
 */
export function replaceEditableOccurrences(text, replacements) {
  const regex = /(?:^(:{3,}) |(?<=\]\([^)]*\)))\{\.editable[^}]*\}/gm;

  let index = 0;
  return text.replace(regex, (match, fenceColons) => {
    const isDiv = fenceColons !== undefined;
    const prefix = isDiv ? fenceColons + ' ' : '';
    return prefix + (replacements[index++] || "");
  });
}

/**
 * Format dimension objects as QMD attribute strings.
 * @param {Object[]} dimensions - Array of dimension objects
 * @returns {string[]} Array of formatted attribute strings
 */
export function formatEditableEltStrings(dimensions) {
  return dimensions.map((dim) => serializeToQmd(dim));
}
