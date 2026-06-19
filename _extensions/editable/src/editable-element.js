/**
 * Element state management for editable elements.
 * Provides centralized state tracking and DOM synchronization.
 * @module editable-element
 */

/**
 * Registry mapping DOM elements to their EditableElement instances.
 * @type {Map<HTMLElement, EditableElement>}
 */
export const editableRegistry = new Map();

import { renderShapeSvg, isCallout, isKnownShape } from './shape-svg.js';

/** Map quarto-shapes stroke-width class suffix → CSS stroke-width value. */
const SHAPE_STROKE_WIDTHS = { sm: 1, md: 3, lg: 6, xl: 10 };

/**
 * Read the `shape-<name>` type from a `.shape-wrapper` element's class list.
 * Ignores modifier classes (shape-sm, shape-stroke-md, shape-rotate-45, …).
 * @param {HTMLElement} el
 * @returns {string|null}
 */
export function getShapeType(el) {
  for (const cls of el.classList) {
    const m = cls.match(/^shape-(.+)$/);
    if (m && isKnownShape(m[1])) return m[1];
  }
  return null;
}

/**
 * Wraps a DOM element with editable capabilities.
 * Manages state synchronization between internal state and DOM.
 */
export class EditableElement {
  /**
   * @param {HTMLElement} element - The DOM element to wrap
   */
  constructor(element) {
    /** @type {HTMLElement} The wrapped DOM element */
    this.element = element;
    /** @type {HTMLElement|null} The wrapper container for positioning */
    this.container = null;
    /** @type {string} Element type ("img", "div", "video", or "shape") */
    this.type = element.classList?.contains("shape-wrapper")
      ? "shape"
      : element.tagName.toLowerCase();
    /**
     * Whether `syncToDOM` writes `element.style.height`. Set to false for
     * content-sized elements (blockquote/callout-style) where the visible
     * height must follow the inner content, not the wrapper. `state.height`
     * is still tracked for resize feedback / serialization.
     * @type {boolean}
     */
    this.syncHeight = true;

    // Prefer pre-set inline style (sub-pixel accurate) over offsetWidth (integer-truncated).
    let width = element.style.width ? parseFloat(element.style.width) : element.offsetWidth;
    let height = element.style.height ? parseFloat(element.style.height) : element.offsetHeight;
    if (this.type === "img" && (width === 0 || height === 0)) {
      width = element.naturalWidth || width;
      height = element.naturalHeight || height;
    }

    /**
     * Internal state object tracking all editable properties.
     * @type {{x: number, y: number, width: number, height: number, rotation: number, fontSize: number|null, textAlign: string|null, opacity: number, borderRadius: number, objectFit: string|null, flipH: boolean, flipV: boolean}}
     */
    this.state = {
      x: 0,
      y: 0,
      width: width,
      height: height,
      rotation: 0,
      // Div-specific properties
      fontSize: null,
      textAlign: null,
      // Image-specific properties
      src: null,
      opacity: 100,
      borderRadius: 0,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      cropLeft: 0,
      flipH: false,
      flipV: false,
      // Shape-specific properties
      shapeType: null,
      fill: null,
      stroke: null,
      strokeWidth: null, // "sm" | "md" | "lg" | "xl"
      direction: null,   // callout pointer direction (keyword or degrees)
    };

    if (this.type === "shape") {
      this.state.shapeType = getShapeType(element);
      // Direction is baked into the rendered SVG and absent from the DOM, so
      // modify mode stamps it from the QMD source for round-tripping.
      if (element.dataset?.editableShapeDirection) {
        this.state.direction = element.dataset.editableShapeDirection;
      }
      // Tracks what SVG is currently rendered, so syncToDOM only regenerates
      // the inner <svg> when the type or direction actually changes.
      this._renderedShape = this.state.shapeType;
      this._renderedDirection = null;
    }
  }

  /**
   * Get a copy of current state.
   * @returns {Object} Copy of state object
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update state and optionally sync to DOM.
   * @param {Object} updates - Properties to update
   * @param {boolean} [syncToDOM=true] - Whether to apply changes to DOM
   */
  setState(updates, syncToDOM = true) {
    Object.assign(this.state, updates);

    if (syncToDOM) {
      this.syncToDOM();
    }
  }

  /**
   * Apply internal state to DOM elements.
   * Called after state changes to update visual representation.
   */
  syncToDOM() {
    if (this.container) {
      this.container.style.left = this.state.x + "px";
      this.container.style.top = this.state.y + "px";
      // Apply rotation to container
      if (this.state.rotation !== 0) {
        this.container.style.transform = `rotate(${this.state.rotation}deg)`;
      } else {
        this.container.style.transform = "";
      }
    }

    this.element.style.width = this.state.width + "px";
    if (this.syncHeight) {
      this.element.style.height = this.state.height + "px";
    }

    if (this.state.fontSize !== null) {
      this.element.style.fontSize = this.state.fontSize + "px";
    }
    if (this.state.textAlign !== null) {
      this.element.style.textAlign = this.state.textAlign;
    }

    if (this.type === "img") {
      this.element.style.opacity = this.state.opacity !== 100 ? this.state.opacity / 100 : "";
      this.element.style.borderRadius = this.state.borderRadius ? `${this.state.borderRadius}px` : "";
      const { cropTop: ct, cropRight: cr, cropBottom: cb, cropLeft: cl } = this.state;
      this.element.style.clipPath = (ct || cr || cb || cl)
        ? `inset(${ct}px ${cr}px ${cb}px ${cl}px)`
        : "";
      const scaleX = this.state.flipH ? -1 : 1;
      const scaleY = this.state.flipV ? -1 : 1;
      this.element.style.transform = (scaleX !== 1 || scaleY !== 1)
        ? `scaleX(${scaleX}) scaleY(${scaleY})`
        : "";
    }

    if (this.type === "shape") {
      this.syncShapeToDOM();
    }
  }

  /**
   * Apply shape styling to the `.shape-wrapper` element and regenerate the
   * inner `<svg>` when the shape type or callout direction has changed.
   * Fill/stroke/stroke-width are written as the same CSS custom properties
   * quarto-shapes' stylesheet reads, so the live preview matches the saved
   * output.
   */
  syncShapeToDOM() {
    const s = this.state;

    // Fill / stroke colors → CSS custom properties (empty string clears them).
    this.element.style.setProperty("--shape-fill", s.fill || "");
    this.element.style.setProperty("--shape-stroke", s.stroke || "");
    this.element.style.setProperty(
      "--shape-stroke-width",
      s.strokeWidth && SHAPE_STROKE_WIDTHS[s.strokeWidth] != null
        ? String(SHAPE_STROKE_WIDTHS[s.strokeWidth])
        : ""
    );

    // Keep the shape-<type> class in sync with state.shapeType.
    if (s.shapeType) {
      for (const cls of [...this.element.classList]) {
        const m = cls.match(/^shape-(.+)$/);
        if (m && isKnownShape(m[1]) && m[1] !== s.shapeType) {
          this.element.classList.remove(cls);
        }
      }
      this.element.classList.add(`shape-${s.shapeType}`);
    }

    // Regenerate the SVG only when type or direction changed.
    const direction = isCallout(s.shapeType) ? s.direction : null;
    if (s.shapeType && (this._renderedShape !== s.shapeType || this._renderedDirection !== direction)) {
      const svg = this.element.querySelector(".shape-svg");
      if (svg) {
        svg.outerHTML = renderShapeSvg(s.shapeType, { direction });
      }
      this._renderedShape = s.shapeType;
      this._renderedDirection = direction;
    }
  }

  /**
   * Read current values from DOM into state.
   * Called before serialization to capture any direct DOM changes.
   */
  syncFromDOM() {
    if (this.container) {
      this.state.x = this.container.style.left
        ? parseFloat(this.container.style.left)
        : this.container.offsetLeft;
      this.state.y = this.container.style.top
        ? parseFloat(this.container.style.top)
        : this.container.offsetTop;

      // Parse rotation from transform
      const transform = this.container.style.transform || "";
      const rotateMatch = transform.match(/rotate\(([^)]+)deg\)/);
      this.state.rotation = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
    }

    this.state.width = this.element.style.width
      ? parseFloat(this.element.style.width)
      : this.element.offsetWidth;
    this.state.height = this.element.style.height
      ? parseFloat(this.element.style.height)
      : this.element.offsetHeight;

    if (this.type === "div") {
      if (this.element.style.fontSize) {
        this.state.fontSize = parseFloat(this.element.style.fontSize);
      }
      if (this.element.style.textAlign) {
        this.state.textAlign = this.element.style.textAlign;
      }
    }

    if (this.type === "img") {
      const opacityStr = this.element.style.opacity;
      this.state.opacity = opacityStr !== "" ? Math.round(parseFloat(opacityStr) * 100) : 100;
      const radiusStr = this.element.style.borderRadius;
      this.state.borderRadius = radiusStr ? parseFloat(radiusStr) : 0;
      const clipPath = this.element.style.clipPath || "";
      const insetMatch = clipPath.match(/inset\(([^)]+)\)/);
      if (insetMatch) {
        const parts = insetMatch[1].split(/\s+/).map(parseFloat);
        this.state.cropTop = parts[0] || 0;
        this.state.cropRight = parts[1] ?? parts[0] ?? 0;
        this.state.cropBottom = parts[2] ?? parts[0] ?? 0;
        this.state.cropLeft = parts[3] ?? parts[1] ?? parts[0] ?? 0;
      } else {
        this.state.cropTop = this.state.cropRight = this.state.cropBottom = this.state.cropLeft = 0;
      }
      const transform = this.element.style.transform || "";
      this.state.flipH = /scaleX\(-1\)/.test(transform);
      this.state.flipV = /scaleY\(-1\)/.test(transform);
    }

    if (this.type === "shape") {
      this.state.shapeType = getShapeType(this.element) || this.state.shapeType;
      const fill = this.element.style.getPropertyValue("--shape-fill").trim();
      const stroke = this.element.style.getPropertyValue("--shape-stroke").trim();
      this.state.fill = fill || null;
      this.state.stroke = stroke || null;
      for (const cls of this.element.classList) {
        const m = cls.match(/^shape-stroke-(sm|md|lg|xl)$/);
        if (m) this.state.strokeWidth = m[1];
      }
    }
  }

  /**
   * Generate dimension object for serialization to QMD.
   * Syncs from DOM first to capture current values.
   * @returns {Object} Dimensions formatted for PropertySerializers
   */
  /**
   * Return all resize handle elements in this element's container.
   * @returns {HTMLElement[]}
   */
  getResizeHandles() {
    if (!this.container) return [];
    return Array.from(this.container.querySelectorAll(".resize-handle"));
  }

  toDimensions() {
    this.syncFromDOM();

    const dims = {
      width: this.state.width,
      height: this.state.height,
      left: this.state.x,
      top: this.state.y,
    };

    // Include rotation if set
    if (this.state.rotation !== 0) {
      dims.rotation = this.state.rotation;
    }

    if (this.type === "div") {
      if (this.state.fontSize !== null) {
        dims.fontSize = this.state.fontSize;
      }
      if (this.state.textAlign !== null) {
        dims.textAlign = this.state.textAlign;
      }
    }

    if (this.type === "img") {
      if (this.state.src !== null) {
        dims.src = this.state.src;
      }
      if (this.state.opacity !== 100) {
        dims.opacity = this.state.opacity;
      }
      if (this.state.borderRadius) {
        dims.borderRadius = this.state.borderRadius;
      }
      const { cropTop: ct, cropRight: cr, cropBottom: cb, cropLeft: cl } = this.state;
      if (ct || cr || cb || cl) {
        dims.cropTop = ct;
        dims.cropRight = cr;
        dims.cropBottom = cb;
        dims.cropLeft = cl;
      }
      if (this.state.flipH || this.state.flipV) {
        dims.flipH = this.state.flipH;
        dims.flipV = this.state.flipV;
      }
    }

    if (this.type === "shape") {
      dims.shapeType = this.state.shapeType;
      if (this.state.fill) dims.fill = this.state.fill;
      if (this.state.stroke) dims.stroke = this.state.stroke;
      if (this.state.strokeWidth) dims.strokeWidth = this.state.strokeWidth;
      if (this.state.direction != null && isCallout(this.state.shapeType)) {
        dims.direction = this.state.direction;
      }
    }

    return dims;
  }
}
