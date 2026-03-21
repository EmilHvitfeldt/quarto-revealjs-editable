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
    /** @type {string} Element type ("img" or "div") */
    this.type = element.tagName.toLowerCase();

    // Get dimensions - for images, use naturalWidth/naturalHeight if offset values are 0
    let width = element.offsetWidth;
    let height = element.offsetHeight;
    if (this.type === "img" && (width === 0 || height === 0)) {
      width = element.naturalWidth || width;
      height = element.naturalHeight || height;
    }

    /**
     * Internal state object tracking all editable properties.
     * @type {{x: number, y: number, width: number, height: number, rotation: number, fontSize: number|null, textAlign: string|null}}
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
    };
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
    this.element.style.height = this.state.height + "px";

    if (this.state.fontSize !== null) {
      this.element.style.fontSize = this.state.fontSize + "px";
    }
    if (this.state.textAlign !== null) {
      this.element.style.textAlign = this.state.textAlign;
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
  }

  /**
   * Generate dimension object for serialization to QMD.
   * Syncs from DOM first to capture current values.
   * @returns {Object} Dimensions formatted for PropertySerializers
   */
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

    return dims;
  }
}
