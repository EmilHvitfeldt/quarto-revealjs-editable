/**
 * Arrow system for creating and editing SVG arrows on slides.
 * Integrates with the quarto-arrows extension for shortcode serialization.
 * @module arrows
 */

import { CONFIG } from './config.js';
import { getSlideScale, getCurrentSlide, getCurrentSlideIndex, getQmdHeadingIndex, debug } from './utils.js';
import { getColorPalette, rgbToHex } from './colors.js';
import { NewElementRegistry } from './registries.js';
import { pushUndoState } from './undo.js';

/** @type {boolean} Whether the arrow extension warning has been shown this session */
let arrowExtensionWarningShown = false;

/**
 * Check if the quarto-arrows extension appears to be installed.
 */
export function hasArrowExtension() {
  if (window._quarto_arrow_extension) return true;

  const arrowSvgs = document.querySelectorAll('svg defs marker[id^="arrow-"]');
  if (arrowSvgs.length > 0) return true;

  const arrowPaths = document.querySelectorAll('svg path[marker-end^="url(#arrow-"]');
  if (arrowPaths.length > 0) return true;

  return false;
}

/**
 * Show a custom modal dialog for arrow extension warning.
 */
function showArrowExtensionModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "editable-modal-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
    `;

    const modal = document.createElement("div");
    modal.className = "editable-modal";
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 450px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      font-family: system-ui, -apple-system, sans-serif;
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">Arrow Extension Required</h3>
      <p style="margin: 0 0 12px 0; color: #555; line-height: 1.5;">
        Arrows are saved as <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">{{&lt; arrow &gt;}}</code> shortcodes which require the <a href="https://github.com/EmilHvitfeldt/quarto-arrows" target="_blank" style="color: var(--editable-accent-color, #007cba);">quarto-arrows</a> extension to render.
      </p>
      <p style="margin: 0 0 16px 0; color: #555;">
        Install with:<br>
        <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 3px; display: inline-block; margin-top: 4px;">quarto add EmilHvitfeldt/quarto-arrows</code>
      </p>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
        Continue? (Arrows will work in the editor but won't render until the extension is installed)
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="editable-modal-cancel" style="
          padding: 8px 16px;
          border: 1px solid #ccc;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Cancel</button>
        <button class="editable-modal-confirm" style="
          padding: 8px 16px;
          border: none;
          background: var(--editable-accent-color, #007cba);
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Continue</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    modal.querySelector(".editable-modal-cancel").onclick = () => cleanup(false);
    modal.querySelector(".editable-modal-confirm").onclick = () => cleanup(true);
    overlay.onclick = (e) => {
      if (e.target === overlay) cleanup(false);
    };

    modal.querySelector(".editable-modal-confirm").focus();
  });
}

/**
 * Show a one-time informational message about arrow extension dependency.
 */
export async function showArrowExtensionWarning() {
  if (arrowExtensionWarningShown) return true;

  const detected = hasArrowExtension();
  if (detected) {
    arrowExtensionWarningShown = true;
    return true;
  }

  const confirmed = await showArrowExtensionModal();
  if (confirmed) {
    arrowExtensionWarningShown = true;
  }
  return confirmed;
}

/** @type {Object|null} Currently selected arrow data */
let activeArrow = null;

/** @type {boolean} Whether the global click-outside handler has been registered */
let globalClickOutsideHandlerRegistered = false;

/** @type {Object} Cached references to arrow control DOM elements */
const arrowControlRefs = {
  colorPicker: null,
  widthInput: null,
  headSelect: null,
  dashSelect: null,
  lineSelect: null,
  opacityInput: null,
  colorPresetsRow: null,
  labelInput: null,
  labelPositionSelect: null,
  labelOffsetInput: null,
  smoothToggle: null,
  waypointBadge: null,
  curveToggle: null,
};

/**
 * Available arrow head styles for the quarto-arrows extension.
 * @type {string[]}
 */
export const ARROW_HEAD_STYLES = ["arrow", "stealth", "diamond", "circle", "square", "bar", "none"];

/**
 * Set the active (selected) arrow. Only one arrow can be active at a time.
 * @param {Object|null} arrowData - Arrow to select, or null to deselect
 */
export function setActiveArrow(arrowData) {
  if (activeArrow && activeArrow !== arrowData) {
    activeArrow.isActive = false;
    updateArrowActiveState(activeArrow);
  }

  activeArrow = arrowData;
  if (arrowData) {
    arrowData.isActive = true;
    updateArrowActiveState(arrowData);
  }

  updateArrowStylePanel(arrowData);
}

/**
 * Get the currently active arrow.
 * @returns {Object|null} Active arrow data or null
 */
export function getActiveArrow() {
  return activeArrow;
}

/**
 * Clean up all event listeners for an arrow.
 * @param {Object} arrowData - Arrow data object
 */
export function cleanupArrowListeners(arrowData) {
  if (arrowData._dragController) {
    arrowData._dragController.abort();
    arrowData._dragController = null;
  }

  const handles = [
    arrowData._startHandle,
    arrowData._endHandle,
    arrowData._control1Handle,
    arrowData._control2Handle
  ];

  for (const handle of handles) {
    if (handle && handle._dragController) {
      handle._dragController.abort();
      handle._dragController = null;
    }
  }

  // Clean up waypoint handles
  if (arrowData._waypointHandles) {
    for (const handle of arrowData._waypointHandles) {
      if (handle && handle._dragController) {
        handle._dragController.abort();
        handle._dragController = null;
      }
    }
  }
}

/**
 * Create arrow style controls for the toolbar (color, width, head, dash, etc.).
 * @returns {HTMLElement} Container with all arrow style controls
 */
export function createArrowStyleControls() {
  const container = document.createElement("div");
  container.className = "arrow-style-controls";
  container.style.display = "none";

  // Color presets row
  const colorPresetsRow = document.createElement("div");
  colorPresetsRow.className = "arrow-color-presets";

  const defaultColors = ["#000000"];
  const paletteColors = getColorPalette();
  const allColors = [...defaultColors, ...paletteColors.filter(c => c.toLowerCase() !== "#000000")];

  allColors.forEach(color => {
    const swatch = document.createElement("button");
    swatch.className = "arrow-color-swatch";
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.addEventListener("click", () => {
      if (activeArrow) {
        pushUndoState();
        activeArrow.color = color;
        updateArrowAppearance(activeArrow);
        const picker = container.querySelector("#arrow-style-color");
        if (picker) picker.value = color;
        colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach(s => s.classList.remove("selected"));
        swatch.classList.add("selected");
      }
    });
    colorPresetsRow.appendChild(swatch);
  });
  container.appendChild(colorPresetsRow);

  // Color picker for custom colors
  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.id = "arrow-style-color";
  colorPicker.className = "arrow-toolbar-color";
  colorPicker.value = "#000000";
  colorPicker.title = "Custom color";
  colorPicker.addEventListener("focus", () => {
    if (activeArrow) pushUndoState();
  });
  colorPicker.addEventListener("input", (e) => {
    if (activeArrow) {
      activeArrow.color = e.target.value;
      updateArrowAppearance(activeArrow);
      colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach(s => s.classList.remove("selected"));
    }
  });
  container.appendChild(colorPicker);

  // Width input
  const widthInput = document.createElement("input");
  widthInput.type = "number";
  widthInput.id = "arrow-style-width";
  widthInput.className = "arrow-toolbar-width";
  widthInput.min = "1";
  widthInput.max = "20";
  widthInput.value = "2";
  widthInput.title = "Width";
  widthInput.addEventListener("focus", () => {
    if (activeArrow) pushUndoState();
  });
  widthInput.addEventListener("input", (e) => {
    if (activeArrow) {
      const val = parseInt(e.target.value);
      if (!isNaN(val)) {
        activeArrow.width = Math.max(1, Math.min(20, val));
        updateArrowAppearance(activeArrow);
      }
    }
  });
  container.appendChild(widthInput);

  // Head style select
  const headSelect = document.createElement("select");
  headSelect.id = "arrow-style-head";
  headSelect.className = "arrow-toolbar-select";
  headSelect.title = "Head style";
  ARROW_HEAD_STYLES.forEach(style => {
    const opt = document.createElement("option");
    opt.value = style;
    opt.textContent = style.charAt(0).toUpperCase() + style.slice(1);
    headSelect.appendChild(opt);
  });
  headSelect.addEventListener("change", (e) => {
    if (activeArrow) {
      pushUndoState();
      activeArrow.head = e.target.value;
      updateArrowAppearance(activeArrow);
    }
  });
  container.appendChild(headSelect);

  // Dash select
  const dashSelect = document.createElement("select");
  dashSelect.id = "arrow-style-dash";
  dashSelect.className = "arrow-toolbar-select";
  dashSelect.title = "Dash style";
  ["solid", "dashed", "dotted"].forEach(style => {
    const opt = document.createElement("option");
    opt.value = style;
    opt.textContent = style.charAt(0).toUpperCase() + style.slice(1);
    dashSelect.appendChild(opt);
  });
  dashSelect.addEventListener("change", (e) => {
    if (activeArrow) {
      pushUndoState();
      activeArrow.dash = e.target.value;
      updateArrowAppearance(activeArrow);
    }
  });
  container.appendChild(dashSelect);

  // Line select
  const lineSelect = document.createElement("select");
  lineSelect.id = "arrow-style-line";
  lineSelect.className = "arrow-toolbar-select";
  lineSelect.title = "Line style";
  ["single", "double", "triple"].forEach(style => {
    const opt = document.createElement("option");
    opt.value = style;
    opt.textContent = style.charAt(0).toUpperCase() + style.slice(1);
    lineSelect.appendChild(opt);
  });
  lineSelect.addEventListener("change", (e) => {
    if (activeArrow) {
      pushUndoState();
      activeArrow.line = e.target.value;
      updateArrowAppearance(activeArrow);
    }
  });
  container.appendChild(lineSelect);

  // Opacity input
  const opacityInput = document.createElement("input");
  opacityInput.type = "range";
  opacityInput.id = "arrow-style-opacity";
  opacityInput.className = "arrow-toolbar-opacity";
  opacityInput.min = "0";
  opacityInput.max = "1";
  opacityInput.step = "0.1";
  opacityInput.value = "1";
  opacityInput.title = "Opacity";
  opacityInput.addEventListener("mousedown", () => {
    if (activeArrow) pushUndoState();
  });
  opacityInput.addEventListener("input", (e) => {
    if (activeArrow) {
      activeArrow.opacity = parseFloat(e.target.value);
      updateArrowAppearance(activeArrow);
    }
  });
  container.appendChild(opacityInput);

  // Curve mode toggle
  const curveToggle = document.createElement("button");
  curveToggle.id = "arrow-style-curve";
  curveToggle.className = "arrow-toolbar-curve";
  curveToggle.innerHTML = "⤴ Curve";
  curveToggle.title = "Toggle curve mode";
  curveToggle.addEventListener("click", () => {
    if (activeArrow) {
      pushUndoState();
      // Clear waypoints if they exist (switching to curve mode)
      if (activeArrow.waypoints && activeArrow.waypoints.length > 0) {
        activeArrow.waypoints = [];
        activeArrow.smooth = false;
        rebuildWaypointHandles(activeArrow);
        updateSmoothToggleInToolbar(activeArrow);
      }
      toggleCurveMode(activeArrow);
      updateCurveToggleInToolbar(activeArrow);
    }
  });
  container.appendChild(curveToggle);

  // Smooth toggle (for waypoints)
  const smoothToggle = document.createElement("button");
  smoothToggle.id = "arrow-style-smooth";
  smoothToggle.className = "arrow-toolbar-smooth";
  smoothToggle.innerHTML = "〰 Smooth";
  smoothToggle.title = "Toggle smooth curves through waypoints";
  smoothToggle.style.display = "none"; // Hidden by default, shown when waypoints exist
  smoothToggle.addEventListener("click", () => {
    if (activeArrow && activeArrow.waypoints && activeArrow.waypoints.length > 0) {
      pushUndoState();
      activeArrow.smooth = !activeArrow.smooth;
      updateArrowPath(activeArrow);
      updateSmoothToggleInToolbar(activeArrow);
    }
  });
  container.appendChild(smoothToggle);

  // Waypoint count badge
  const waypointBadge = document.createElement("span");
  waypointBadge.id = "arrow-style-waypoint-count";
  waypointBadge.className = "arrow-toolbar-waypoint-badge";
  waypointBadge.style.display = "none"; // Hidden by default
  waypointBadge.title = "Number of waypoints (double-click arrow to add, right-click waypoint to remove)";
  container.appendChild(waypointBadge);

  // Label section separator
  const labelSeparator = document.createElement("div");
  labelSeparator.className = "arrow-toolbar-separator";
  labelSeparator.textContent = "Label";
  container.appendChild(labelSeparator);

  // Label text input
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.id = "arrow-style-label";
  labelInput.className = "arrow-toolbar-label";
  labelInput.placeholder = "Label text...";
  labelInput.title = "Label text";
  labelInput.addEventListener("input", (e) => {
    if (activeArrow) {
      activeArrow.label = e.target.value;
      updateArrowLabel(activeArrow);
    }
  });
  container.appendChild(labelInput);

  // Label position select
  const labelPositionSelect = document.createElement("select");
  labelPositionSelect.id = "arrow-style-label-position";
  labelPositionSelect.className = "arrow-toolbar-select";
  labelPositionSelect.title = "Label position";
  ["start", "middle", "end"].forEach(pos => {
    const opt = document.createElement("option");
    opt.value = pos;
    opt.textContent = pos.charAt(0).toUpperCase() + pos.slice(1);
    labelPositionSelect.appendChild(opt);
  });
  labelPositionSelect.value = CONFIG.ARROW_DEFAULT_LABEL_POSITION;
  labelPositionSelect.addEventListener("change", (e) => {
    if (activeArrow) {
      activeArrow.labelPosition = e.target.value;
      updateArrowLabel(activeArrow);
    }
  });
  container.appendChild(labelPositionSelect);

  // Label offset input
  const labelOffsetInput = document.createElement("input");
  labelOffsetInput.type = "number";
  labelOffsetInput.id = "arrow-style-label-offset";
  labelOffsetInput.className = "arrow-toolbar-width";
  labelOffsetInput.value = CONFIG.ARROW_DEFAULT_LABEL_OFFSET.toString();
  labelOffsetInput.title = "Label offset (positive = above, negative = below)";
  labelOffsetInput.addEventListener("input", (e) => {
    if (activeArrow) {
      const val = parseInt(e.target.value);
      if (!isNaN(val)) {
        activeArrow.labelOffset = val;
        updateArrowLabel(activeArrow);
      }
    }
  });
  container.appendChild(labelOffsetInput);

  // Cache references for efficient updates
  arrowControlRefs.colorPicker = colorPicker;
  arrowControlRefs.widthInput = widthInput;
  arrowControlRefs.headSelect = headSelect;
  arrowControlRefs.dashSelect = dashSelect;
  arrowControlRefs.lineSelect = lineSelect;
  arrowControlRefs.opacityInput = opacityInput;
  arrowControlRefs.colorPresetsRow = colorPresetsRow;
  arrowControlRefs.labelInput = labelInput;
  arrowControlRefs.labelPositionSelect = labelPositionSelect;
  arrowControlRefs.labelOffsetInput = labelOffsetInput;
  arrowControlRefs.smoothToggle = smoothToggle;
  arrowControlRefs.waypointBadge = waypointBadge;
  arrowControlRefs.curveToggle = curveToggle;

  return container;
}

/**
 * Update the arrow style panel to show/hide based on selection.
 * Shows arrow controls when an arrow is selected, hides normal toolbar buttons.
 * @param {Object|null} arrowData - Selected arrow or null
 */
export function updateArrowStylePanel(arrowData) {
  const toolbar = document.getElementById("editable-toolbar");
  if (!toolbar) return;

  const buttonsContainer = toolbar.querySelector(".editable-toolbar-buttons");
  let arrowControls = toolbar.querySelector(".arrow-style-controls");

  if (!arrowControls) {
    arrowControls = createArrowStyleControls();
    toolbar.appendChild(arrowControls);
  }

  if (arrowData) {
    const { colorPicker, widthInput, headSelect, dashSelect, lineSelect, opacityInput, colorPresetsRow, labelInput, labelPositionSelect, labelOffsetInput } = arrowControlRefs;

    if (colorPicker) {
      const colorValue = arrowData.color === "black" ? "#000000" : arrowData.color;
      colorPicker.value = colorValue;
      if (colorPresetsRow) {
        colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach(s => {
          s.classList.toggle("selected", s.style.backgroundColor === colorValue ||
            rgbToHex(s.style.backgroundColor) === colorValue.toLowerCase());
        });
      }
    }
    if (widthInput) {
      widthInput.value = arrowData.width.toString();
    }
    if (headSelect) {
      headSelect.value = arrowData.head || "arrow";
    }
    if (dashSelect) {
      dashSelect.value = arrowData.dash || "solid";
    }
    if (lineSelect) {
      lineSelect.value = arrowData.line || "single";
    }
    if (opacityInput) {
      opacityInput.value = (arrowData.opacity !== undefined ? arrowData.opacity : 1).toString();
    }
    if (labelInput) {
      labelInput.value = arrowData.label || "";
    }
    if (labelPositionSelect) {
      labelPositionSelect.value = arrowData.labelPosition || CONFIG.ARROW_DEFAULT_LABEL_POSITION;
    }
    if (labelOffsetInput) {
      labelOffsetInput.value = (arrowData.labelOffset !== undefined ? arrowData.labelOffset : CONFIG.ARROW_DEFAULT_LABEL_OFFSET).toString();
    }

    updateCurveToggleInToolbar(arrowData);
    updateSmoothToggleInToolbar(arrowData);

    buttonsContainer.style.display = "none";
    arrowControls.style.display = "flex";
  } else {
    buttonsContainer.style.display = "flex";
    arrowControls.style.display = "none";
  }
}

function updateCurveToggleInToolbar(arrowData) {
  const curveToggle = document.querySelector("#arrow-style-curve");
  if (!curveToggle) return;

  const hasWaypoints = arrowData && arrowData.waypoints && arrowData.waypoints.length > 0;

  if (hasWaypoints) {
    // Clicking will clear waypoints and switch to curve mode
    curveToggle.classList.remove("disabled");
    curveToggle.classList.remove("active");
    curveToggle.title = "Switch to curve mode (clears waypoints)";
  } else {
    curveToggle.classList.remove("disabled");
    curveToggle.title = "Toggle curve mode";
    if (arrowData && arrowData.curveMode) {
      curveToggle.classList.add("active");
    } else {
      curveToggle.classList.remove("active");
    }
  }
}

/**
 * Update smooth toggle button state in toolbar.
 * @param {Object} arrowData - Arrow data object
 */
function updateSmoothToggleInToolbar(arrowData) {
  const smoothToggle = arrowControlRefs.smoothToggle || document.querySelector("#arrow-style-smooth");
  const waypointBadge = arrowControlRefs.waypointBadge || document.querySelector("#arrow-style-waypoint-count");

  if (!smoothToggle || !waypointBadge) return;

  const hasWaypoints = arrowData && arrowData.waypoints && arrowData.waypoints.length > 0;

  if (hasWaypoints) {
    smoothToggle.style.display = "";
    waypointBadge.style.display = "";
    waypointBadge.textContent = `${arrowData.waypoints.length} wp`;

    if (arrowData.smooth) {
      smoothToggle.classList.add("active");
    } else {
      smoothToggle.classList.remove("active");
    }
  } else {
    smoothToggle.style.display = "none";
    waypointBadge.style.display = "none";
  }
}

/**
 * Update arrow visual appearance based on its data (color, width, dash, etc.).
 * @param {Object} arrowData - Arrow data object
 */
export function updateArrowAppearance(arrowData) {
  if (!arrowData._path) return;

  arrowData._path.setAttribute("stroke", arrowData.color);
  arrowData._path.setAttribute("stroke-width", arrowData.width);

  // Update label color to match arrow
  if (arrowData._labelText) {
    arrowData._labelText.setAttribute("fill", arrowData.color);
  }

  const dashPatterns = {
    solid: "none",
    dashed: `${arrowData.width * 4},${arrowData.width * 2}`,
    dotted: `${arrowData.width},${arrowData.width * 2}`
  };
  const dashArray = dashPatterns[arrowData.dash] || "none";
  if (dashArray === "none") {
    arrowData._path.removeAttribute("stroke-dasharray");
  } else {
    arrowData._path.setAttribute("stroke-dasharray", dashArray);
  }

  const opacity = arrowData.opacity !== undefined ? arrowData.opacity : 1;
  arrowData._path.setAttribute("opacity", opacity);

  updateArrowLineStyle(arrowData);
  updateArrowheadMarker(arrowData);
}

function offsetPointPerpendicular(x, y, tangentX, tangentY, offsetAmount) {
  const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
  if (len === 0) return { x, y };
  const normalX = -tangentY / len;
  const normalY = tangentX / len;
  return {
    x: x + normalX * offsetAmount,
    y: y + normalY * offsetAmount
  };
}

function createOffsetPathD(arrowData, offsetAmount) {
  const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y } = arrowData;

  if (control1X !== null && control2X !== null) {
    const startTangent = { x: control1X - fromX, y: control1Y - fromY };
    const endTangent = { x: toX - control2X, y: toY - control2Y };
    const c1Tangent = { x: control2X - fromX, y: control2Y - fromY };
    const c2Tangent = { x: toX - control1X, y: toY - control1Y };

    const newFrom = offsetPointPerpendicular(fromX, fromY, startTangent.x, startTangent.y, offsetAmount);
    const newC1 = offsetPointPerpendicular(control1X, control1Y, c1Tangent.x, c1Tangent.y, offsetAmount);
    const newC2 = offsetPointPerpendicular(control2X, control2Y, c2Tangent.x, c2Tangent.y, offsetAmount);
    const newTo = offsetPointPerpendicular(toX, toY, endTangent.x, endTangent.y, offsetAmount);

    return `M ${newFrom.x},${newFrom.y} C ${newC1.x},${newC1.y} ${newC2.x},${newC2.y} ${newTo.x},${newTo.y}`;
  } else if (control1X !== null) {
    const startTangent = { x: control1X - fromX, y: control1Y - fromY };
    const controlTangent = { x: toX - fromX, y: toY - fromY };
    const endTangent = { x: toX - control1X, y: toY - control1Y };

    const newFrom = offsetPointPerpendicular(fromX, fromY, startTangent.x, startTangent.y, offsetAmount);
    const newC1 = offsetPointPerpendicular(control1X, control1Y, controlTangent.x, controlTangent.y, offsetAmount);
    const newTo = offsetPointPerpendicular(toX, toY, endTangent.x, endTangent.y, offsetAmount);

    return `M ${newFrom.x},${newFrom.y} Q ${newC1.x},${newC1.y} ${newTo.x},${newTo.y}`;
  } else {
    const tangent = { x: toX - fromX, y: toY - fromY };
    const newFrom = offsetPointPerpendicular(fromX, fromY, tangent.x, tangent.y, offsetAmount);
    const newTo = offsetPointPerpendicular(toX, toY, tangent.x, tangent.y, offsetAmount);

    return `M ${newFrom.x},${newFrom.y} L ${newTo.x},${newTo.y}`;
  }
}

function updateArrowLineStyle(arrowData) {
  if (!arrowData._svg || !arrowData._path) return;

  const existingLines = arrowData._svg.querySelectorAll(".arrow-extra-line");
  existingLines.forEach(line => line.remove());

  const lineStyle = arrowData.line || "single";
  if (lineStyle === "single") {
    arrowData._path.setAttribute("stroke", arrowData.color);
    arrowData._path.style.visibility = "visible";
    return;
  }

  const offset = arrowData.width * 1.5;

  const createOffsetPath = (offsetAmount) => {
    const extraPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    extraPath.className.baseVal = "arrow-extra-line";
    extraPath.setAttribute("stroke", arrowData.color);
    extraPath.setAttribute("stroke-width", arrowData.width);
    extraPath.setAttribute("fill", "none");
    extraPath.style.pointerEvents = "none";

    const dashPatterns = {
      solid: "none",
      dashed: `${arrowData.width * 4},${arrowData.width * 2}`,
      dotted: `${arrowData.width},${arrowData.width * 2}`
    };
    const dashArray = dashPatterns[arrowData.dash] || "none";
    if (dashArray !== "none") {
      extraPath.setAttribute("stroke-dasharray", dashArray);
    }

    const opacity = arrowData.opacity !== undefined ? arrowData.opacity : 1;
    extraPath.setAttribute("opacity", opacity);

    const offsetPathD = createOffsetPathD(arrowData, offsetAmount);
    extraPath.setAttribute("d", offsetPathD);

    return extraPath;
  };

  if (lineStyle === "double") {
    const line1 = createOffsetPath(-offset);
    const line2 = createOffsetPath(offset);
    arrowData._svg.insertBefore(line1, arrowData._path);
    arrowData._svg.insertBefore(line2, arrowData._path);
    arrowData._path.style.visibility = "visible";
    arrowData._path.setAttribute("stroke", "transparent");
  } else if (lineStyle === "triple") {
    const line1 = createOffsetPath(-offset);
    const line2 = createOffsetPath(offset);
    arrowData._svg.insertBefore(line1, arrowData._path);
    arrowData._svg.insertBefore(line2, arrowData._path);
    arrowData._path.style.visibility = "visible";
    arrowData._path.setAttribute("stroke", arrowData.color);
  }
}

function updateArrowheadMarker(arrowData) {
  if (!arrowData._svg || !arrowData._markerId) return;

  const marker = arrowData._svg.querySelector(`#${arrowData._markerId}`);
  if (!marker) return;

  const markerPath = marker.querySelector("path");
  if (!markerPath) return;

  markerPath.setAttribute("fill", arrowData.color);

  const size = 10;
  let pathD;
  let refX = 0;

  switch (arrowData.head) {
    case "stealth":
      const w = size * 1.2;
      pathD = `M 0 0 L ${w} ${size/2} L 0 ${size} L ${w*0.3} ${size/2} z`;
      refX = w * 0.3;
      break;
    case "diamond":
      pathD = `M 0 ${size/2} L ${size/2} 0 L ${size} ${size/2} L ${size/2} ${size} z`;
      refX = size / 2;
      break;
    case "circle":
      const r = size / 2;
      pathD = `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${size} A ${r} ${r} 0 1 1 ${r} 0`;
      refX = r;
      marker.setAttribute("refY", r);
      break;
    case "square":
      pathD = `M 0 0 L ${size} 0 L ${size} ${size} L 0 ${size} z`;
      refX = size / 2;
      break;
    case "bar":
      const bw = size / 3;
      pathD = `M 0 0 L ${bw} 0 L ${bw} ${size} L 0 ${size} z`;
      refX = bw / 2;
      break;
    case "none":
      pathD = "";
      break;
    default:
      pathD = `M 0 0 L ${size} ${size/2} L 0 ${size} z`;
      refX = 0;
      marker.setAttribute("refY", size / 2);
  }

  markerPath.setAttribute("d", pathD);
  marker.setAttribute("refX", refX);

  if (arrowData.head === "none") {
    arrowData._path.removeAttribute("marker-end");
  } else {
    arrowData._path.setAttribute("marker-end", `url(#${arrowData._markerId})`);
  }
}

/**
 * Update arrow UI visibility based on active/selected state.
 * Shows/hides handles and guide lines.
 * @param {Object} arrowData - Arrow data object
 */
export function updateArrowActiveState(arrowData) {
  if (!arrowData._container) return;

  const showControls = arrowData.isActive;

  if (arrowData._startHandle) {
    arrowData._startHandle.style.display = showControls ? "" : "none";
  }
  if (arrowData._endHandle) {
    arrowData._endHandle.style.display = showControls ? "" : "none";
  }

  if (arrowData._control1Handle) {
    arrowData._control1Handle.style.display = (showControls && arrowData.curveMode) ? "" : "none";
  }
  if (arrowData._control2Handle) {
    arrowData._control2Handle.style.display = (showControls && arrowData.curveMode) ? "" : "none";
  }

  if (arrowData._guideLine1) {
    arrowData._guideLine1.style.display = (showControls && arrowData.curveMode && arrowData.control1X !== null) ? "" : "none";
  }
  if (arrowData._guideLine2) {
    arrowData._guideLine2.style.display = (showControls && arrowData.curveMode && arrowData.control2X !== null) ? "" : "none";
  }

  if (showControls) {
    arrowData._container.classList.add("active");
  } else {
    arrowData._container.classList.remove("active");
  }
}

/**
 * Add a new arrow to the current slide.
 * Shows extension warning if quarto-arrows isn't detected.
 * @returns {Promise<HTMLElement|null>} Arrow container element or null
 */
export async function addNewArrow() {
  if (!(await showArrowExtensionWarning())) {
    return null;
  }

  const currentSlide = getCurrentSlide();
  if (!currentSlide) {
    console.warn("No current slide found");
    return null;
  }

  pushUndoState();
  const slideIndex = getCurrentSlideIndex();
  const slideWidth = currentSlide.offsetWidth || 960;
  const slideHeight = currentSlide.offsetHeight || 700;

  const centerX = slideWidth / 2;
  const centerY = slideHeight / 2;
  const halfLength = CONFIG.NEW_ARROW_LENGTH / 2;

  const arrowData = {
    fromX: centerX - halfLength,
    fromY: centerY,
    toX: centerX + halfLength,
    toY: centerY,
    control1X: null,
    control1Y: null,
    control2X: null,
    control2Y: null,
    curveMode: false,
    waypoints: [],
    smooth: false,
    color: CONFIG.ARROW_DEFAULT_COLOR,
    width: CONFIG.ARROW_DEFAULT_WIDTH,
    head: "arrow",
    dash: "solid",
    line: "single",
    opacity: 1,
    label: "",
    labelPosition: CONFIG.ARROW_DEFAULT_LABEL_POSITION,
    labelOffset: CONFIG.ARROW_DEFAULT_LABEL_OFFSET,
    isActive: true,
  };

  const arrowContainer = createArrowElement(arrowData);
  currentSlide.appendChild(arrowContainer);

  arrowData.element = arrowContainer;

  const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");
  if (isOnNewSlide) {
    const newSlideEntry = NewElementRegistry.newSlides.find(
      (s) => s.element === currentSlide
    );
    NewElementRegistry.addArrow(arrowData, slideIndex, newSlideEntry || null);
  } else {
    const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);
    const originalSlideIndex =
      qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
    NewElementRegistry.addArrow(arrowData, originalSlideIndex, null);
  }

  debug("Added new arrow to slide", slideIndex, "-> QMD heading index", getQmdHeadingIndex(slideIndex));
  return arrowContainer;
}

/**
 * Create the DOM elements for an arrow (SVG, handles, hit area).
 * @param {Object} arrowData - Arrow data object
 * @returns {HTMLElement} Arrow container element
 */
export function createArrowElement(arrowData) {
  const container = document.createElement("div");
  container.className = "editable-arrow-container editable-new";
  container.style.position = "absolute";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.pointerEvents = "none";
  container.style.zIndex = "100";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.overflow = "visible";

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  const markerId = "arrowhead-" + Math.random().toString(36).substring(2, 11);
  marker.setAttribute("id", markerId);
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "10");
  marker.setAttribute("refX", "0");
  marker.setAttribute("refY", "5");
  marker.setAttribute("orient", "auto");
  marker.setAttribute("markerUnits", "strokeWidth");

  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  arrowPath.setAttribute("fill", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
  hitArea.setAttribute("stroke", "transparent");
  hitArea.setAttribute("stroke-width", "20");
  hitArea.setAttribute("stroke-linecap", "round");
  hitArea.setAttribute("fill", "none");
  hitArea.style.pointerEvents = "auto";
  hitArea.style.cursor = "pointer";
  svg.appendChild(hitArea);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
  path.setAttribute("stroke-width", arrowData.width || CONFIG.ARROW_DEFAULT_WIDTH);
  path.setAttribute("fill", "none");
  path.setAttribute("marker-end", `url(#${markerId})`);
  path.style.pointerEvents = "none";
  svg.appendChild(path);

  // Label text element
  const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  labelText.className.baseVal = "editable-arrow-label";
  labelText.setAttribute("text-anchor", "middle");
  labelText.setAttribute("dominant-baseline", "middle");
  labelText.setAttribute("fill", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
  labelText.style.pointerEvents = "none";
  labelText.style.userSelect = "none";
  labelText.style.fontSize = "14px";
  labelText.style.fontFamily = "system-ui, -apple-system, sans-serif";
  svg.appendChild(labelText);

  const guideLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  guideLine1.setAttribute("stroke", CONFIG.ARROW_CONTROL1_COLOR);
  guideLine1.setAttribute("stroke-width", "1");
  guideLine1.setAttribute("stroke-dasharray", "4,4");
  guideLine1.setAttribute("opacity", "0.6");
  guideLine1.style.display = "none";
  svg.appendChild(guideLine1);

  const guideLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  guideLine2.setAttribute("stroke", CONFIG.ARROW_CONTROL2_COLOR);
  guideLine2.setAttribute("stroke-width", "1");
  guideLine2.setAttribute("stroke-dasharray", "4,4");
  guideLine2.setAttribute("opacity", "0.6");
  guideLine2.style.display = "none";
  svg.appendChild(guideLine2);

  container.appendChild(svg);

  arrowData._path = path;
  arrowData._hitArea = hitArea;
  arrowData._svg = svg;
  arrowData._markerId = markerId;
  arrowData._guideLine1 = guideLine1;
  arrowData._guideLine2 = guideLine2;
  arrowData._labelText = labelText;
  arrowData._container = container;

  const startHandle = createArrowHandle(arrowData, "start");
  const endHandle = createArrowHandle(arrowData, "end");
  container.appendChild(startHandle);
  container.appendChild(endHandle);

  arrowData._startHandle = startHandle;
  arrowData._endHandle = endHandle;

  const control1Handle = createArrowHandle(arrowData, "control1");
  const control2Handle = createArrowHandle(arrowData, "control2");
  control1Handle.style.display = "none";
  control2Handle.style.display = "none";
  container.appendChild(control1Handle);
  container.appendChild(control2Handle);

  arrowData._control1Handle = control1Handle;
  arrowData._control2Handle = control2Handle;

  // Initialize waypoint handles array
  arrowData._waypointHandles = [];

  // Create handles for any existing waypoints
  if (arrowData.waypoints && arrowData.waypoints.length > 0) {
    for (let i = 0; i < arrowData.waypoints.length; i++) {
      const handle = createWaypointHandle(arrowData, i);
      container.appendChild(handle);
      arrowData._waypointHandles.push(handle);
    }
  }

  const arrowDragController = new AbortController();
  arrowData._dragController = arrowDragController;

  let isDraggingArrow = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let arrowDragScale = 1;

  const startArrowDrag = (e) => {
    e.stopPropagation();
    setActiveArrow(arrowData);

    pushUndoState();
    isDraggingArrow = true;
    arrowDragScale = getSlideScale();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    dragStartX = clientX;
    dragStartY = clientY;

    hitArea.style.cursor = "grabbing";
  };

  const onArrowDrag = (e) => {
    if (!isDraggingArrow) return;
    e.preventDefault();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const deltaX = (clientX - dragStartX) / arrowDragScale;
    const deltaY = (clientY - dragStartY) / arrowDragScale;

    arrowData.fromX += deltaX;
    arrowData.fromY += deltaY;
    arrowData.toX += deltaX;
    arrowData.toY += deltaY;

    if (arrowData.control1X !== null) {
      arrowData.control1X += deltaX;
      arrowData.control1Y += deltaY;
    }
    if (arrowData.control2X !== null) {
      arrowData.control2X += deltaX;
      arrowData.control2Y += deltaY;
    }

    // Move waypoints along with arrow
    if (arrowData.waypoints && arrowData.waypoints.length > 0) {
      for (const wp of arrowData.waypoints) {
        wp.x += deltaX;
        wp.y += deltaY;
      }
    }

    dragStartX = clientX;
    dragStartY = clientY;

    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
  };

  const endArrowDrag = () => {
    isDraggingArrow = false;
    hitArea.style.cursor = "grab";
  };

  hitArea.addEventListener("mousedown", startArrowDrag);
  document.addEventListener("mousemove", onArrowDrag, { signal: arrowDragController.signal });
  document.addEventListener("mouseup", endArrowDrag, { signal: arrowDragController.signal });

  // Double-click to add waypoint
  hitArea.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = container.getBoundingClientRect();
    const scale = getSlideScale();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Find the best insertion index based on path segment closest to click
    const insertIndex = findWaypointInsertIndex(arrowData, x, y);
    addWaypoint(arrowData, x, y, insertIndex);
  });

  hitArea.style.cursor = "grab";

  updateArrowPath(arrowData);
  updateArrowHandles(arrowData);
  updateArrowLabel(arrowData);

  setActiveArrow(arrowData);

  // Register global click-outside handler once (not per-arrow)
  if (!globalClickOutsideHandlerRegistered) {
    globalClickOutsideHandlerRegistered = true;
    document.addEventListener("click", (e) => {
      if (activeArrow &&
          !e.target.closest(".editable-arrow-container") &&
          !e.target.closest(".editable-toolbar")) {
        setActiveArrow(null);
      }
    });
  }

  return container;
}

/**
 * Create a draggable handle for an arrow endpoint or control point.
 * @param {Object} arrowData - Arrow data object
 * @param {string} position - Handle position ("start", "end", "control1", "control2")
 * @returns {HTMLElement} Handle element
 */
function createArrowHandle(arrowData, position) {
  const handle = document.createElement("div");
  handle.className = `editable-arrow-handle editable-arrow-handle-${position}`;
  handle.style.position = "absolute";

  const isControlPoint = position === "control1" || position === "control2";
  const handleSize = isControlPoint ? CONFIG.ARROW_CONTROL_HANDLE_SIZE : CONFIG.ARROW_HANDLE_SIZE;

  let bgColor;
  if (position === "start") bgColor = "#007cba";
  else if (position === "end") bgColor = "#28a745";
  else if (position === "control1") bgColor = CONFIG.ARROW_CONTROL1_COLOR;
  else if (position === "control2") bgColor = CONFIG.ARROW_CONTROL2_COLOR;

  handle.style.width = handleSize + "px";
  handle.style.height = handleSize + "px";
  handle.style.borderRadius = "50%";
  handle.style.backgroundColor = bgColor;
  handle.style.border = "2px solid white";
  handle.style.cursor = "move";
  handle.style.pointerEvents = "auto";
  handle.style.transform = "translate(-50%, -50%)";
  handle.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
  handle.setAttribute("role", "slider");
  handle.setAttribute("aria-label", `Arrow ${position} point`);
  handle.setAttribute("tabindex", "0");

  const handleDragController = new AbortController();
  handle._dragController = handleDragController;

  let isDragging = false;
  let cachedScale = 1;

  const startDrag = (e) => {
    pushUndoState();
    isDragging = true;
    cachedScale = getSlideScale();
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrag = (e) => {
    if (!isDragging) return;
    if (!arrowData.element) return;

    const rect = arrowData.element.getBoundingClientRect();
    const scale = cachedScale;

    let clientX, clientY;
    if (e.type.startsWith("touch")) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;

    if (position === "start") {
      arrowData.fromX = x;
      arrowData.fromY = y;
    } else if (position === "end") {
      arrowData.toX = x;
      arrowData.toY = y;
    } else if (position === "control1") {
      arrowData.control1X = x;
      arrowData.control1Y = y;
    } else if (position === "control2") {
      arrowData.control2X = x;
      arrowData.control2Y = y;
    }

    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);

    e.preventDefault();
  };

  const stopDrag = () => {
    isDragging = false;
  };

  handle.addEventListener("mousedown", startDrag);
  handle.addEventListener("touchstart", startDrag);
  document.addEventListener("mousemove", onDrag, { signal: handleDragController.signal });
  document.addEventListener("touchmove", onDrag, { signal: handleDragController.signal });
  document.addEventListener("mouseup", stopDrag, { signal: handleDragController.signal });
  document.addEventListener("touchend", stopDrag, { signal: handleDragController.signal });

  return handle;
}

/**
 * Create a draggable handle for a waypoint.
 * @param {Object} arrowData - Arrow data object
 * @param {number} waypointIndex - Index of the waypoint in the waypoints array
 * @returns {HTMLElement} Handle element
 */
function createWaypointHandle(arrowData, waypointIndex) {
  const handle = document.createElement("div");
  handle.className = "editable-arrow-handle editable-arrow-handle-waypoint";
  handle.style.position = "absolute";
  handle.dataset.waypointIndex = waypointIndex;

  const handleSize = CONFIG.ARROW_WAYPOINT_HANDLE_SIZE;
  const bgColor = CONFIG.ARROW_WAYPOINT_COLOR;

  handle.style.width = handleSize + "px";
  handle.style.height = handleSize + "px";
  handle.style.borderRadius = "50%";
  handle.style.backgroundColor = bgColor;
  handle.style.border = "2px solid white";
  handle.style.cursor = "move";
  handle.style.pointerEvents = "auto";
  handle.style.transform = "translate(-50%, -50%)";
  handle.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
  handle.setAttribute("role", "slider");
  handle.setAttribute("aria-label", `Arrow waypoint ${waypointIndex + 1}`);
  handle.setAttribute("tabindex", "0");

  const handleDragController = new AbortController();
  handle._dragController = handleDragController;

  let isDragging = false;
  let cachedScale = 1;

  const startDrag = (e) => {
    pushUndoState();
    isDragging = true;
    cachedScale = getSlideScale();
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrag = (e) => {
    if (!isDragging) return;
    if (!arrowData.element) return;

    const rect = arrowData.element.getBoundingClientRect();
    const scale = cachedScale;

    let clientX, clientY;
    if (e.type.startsWith("touch")) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;

    const wpIndex = parseInt(handle.dataset.waypointIndex, 10);
    if (arrowData.waypoints[wpIndex]) {
      arrowData.waypoints[wpIndex].x = x;
      arrowData.waypoints[wpIndex].y = y;
    }

    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);

    e.preventDefault();
  };

  const stopDrag = () => {
    isDragging = false;
  };

  handle.addEventListener("mousedown", startDrag);
  handle.addEventListener("touchstart", startDrag);
  document.addEventListener("mousemove", onDrag, { signal: handleDragController.signal });
  document.addEventListener("touchmove", onDrag, { signal: handleDragController.signal });
  document.addEventListener("mouseup", stopDrag, { signal: handleDragController.signal });
  document.addEventListener("touchend", stopDrag, { signal: handleDragController.signal });

  // Right-click to delete waypoint
  handle.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const wpIndex = parseInt(handle.dataset.waypointIndex, 10);
    removeWaypoint(arrowData, wpIndex);
  });

  // Delete key to remove waypoint when focused
  handle.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const wpIndex = parseInt(handle.dataset.waypointIndex, 10);
      removeWaypoint(arrowData, wpIndex);
    }
  });

  return handle;
}

/**
 * Calculate distance from a point to a line segment.
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} x1 - Line start X
 * @param {number} y1 - Line start Y
 * @param {number} x2 - Line end X
 * @param {number} y2 - Line end Y
 * @returns {number} Distance to segment
 */
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Segment is a point
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  // Project point onto line, clamped to segment
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/**
 * Find the best index to insert a waypoint based on click position.
 * Returns the index in the waypoints array where the new waypoint should be inserted.
 * @param {Object} arrowData - Arrow data object
 * @param {number} clickX - Click X coordinate
 * @param {number} clickY - Click Y coordinate
 * @returns {number} Index to insert at
 */
function findWaypointInsertIndex(arrowData, clickX, clickY) {
  const { fromX, fromY, toX, toY, waypoints } = arrowData;

  // Build list of all points (start, waypoints, end)
  const points = [
    { x: fromX, y: fromY },
    ...(waypoints || []),
    { x: toX, y: toY }
  ];

  // If no waypoints yet, insert at index 0 (between start and end)
  if (!waypoints || waypoints.length === 0) {
    return 0;
  }

  // Find which segment is closest to the click
  let minDist = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const dist = distanceToSegment(
      clickX, clickY,
      points[i].x, points[i].y,
      points[i + 1].x, points[i + 1].y
    );
    if (dist < minDist) {
      minDist = dist;
      bestIndex = i;
    }
  }

  // bestIndex is the segment index (0 = start-to-first-waypoint)
  // We want to insert the new waypoint at waypoints[bestIndex]
  return bestIndex;
}

/**
 * Add a waypoint to an arrow at the specified position.
 * @param {Object} arrowData - Arrow data object
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} [insertIndex] - Index to insert at (default: end)
 */
export function addWaypoint(arrowData, x, y, insertIndex) {
  pushUndoState();

  // If in curve mode, switch to waypoint mode (clear control points)
  if (arrowData.curveMode) {
    arrowData.curveMode = false;
    arrowData.control1X = null;
    arrowData.control1Y = null;
    arrowData.control2X = null;
    arrowData.control2Y = null;
    if (arrowData._container) {
      arrowData._container.classList.remove("curve-mode");
    }
    if (arrowData._guideLine1) arrowData._guideLine1.style.display = "none";
    if (arrowData._guideLine2) arrowData._guideLine2.style.display = "none";
    if (arrowData._control1Handle) arrowData._control1Handle.style.display = "none";
    if (arrowData._control2Handle) arrowData._control2Handle.style.display = "none";
  }

  if (!arrowData.waypoints) {
    arrowData.waypoints = [];
  }

  const newWaypoint = { x, y };
  if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= arrowData.waypoints.length) {
    arrowData.waypoints.splice(insertIndex, 0, newWaypoint);
  } else {
    arrowData.waypoints.push(newWaypoint);
  }

  // Rebuild all waypoint handles (indices may have changed)
  rebuildWaypointHandles(arrowData);
  updateArrowPath(arrowData);
  updateArrowHandles(arrowData);
  updateArrowStylePanel(arrowData);
}

/**
 * Remove a waypoint from an arrow.
 * @param {Object} arrowData - Arrow data object
 * @param {number} waypointIndex - Index of waypoint to remove
 */
export function removeWaypoint(arrowData, waypointIndex) {
  if (!arrowData.waypoints || waypointIndex < 0 || waypointIndex >= arrowData.waypoints.length) {
    return;
  }

  pushUndoState();
  arrowData.waypoints.splice(waypointIndex, 1);

  // Rebuild all waypoint handles (indices have changed)
  rebuildWaypointHandles(arrowData);
  updateArrowPath(arrowData);
  updateArrowHandles(arrowData);
  updateArrowStylePanel(arrowData);
}

/**
 * Rebuild all waypoint handles for an arrow.
 * Called when waypoints are added or removed.
 * @param {Object} arrowData - Arrow data object
 */
function rebuildWaypointHandles(arrowData) {
  // Remove existing waypoint handles
  if (arrowData._waypointHandles) {
    for (const handle of arrowData._waypointHandles) {
      if (handle._dragController) {
        handle._dragController.abort();
      }
      handle.remove();
    }
  }

  arrowData._waypointHandles = [];

  // Create new handles for each waypoint
  if (arrowData.waypoints && arrowData.waypoints.length > 0) {
    for (let i = 0; i < arrowData.waypoints.length; i++) {
      const handle = createWaypointHandle(arrowData, i);
      arrowData._container.appendChild(handle);
      arrowData._waypointHandles.push(handle);
    }
  }

  // Update handle positions
  updateArrowHandles(arrowData);
}

/**
 * Generate Catmull-Rom spline path through a series of points.
 * Uses tension parameter of 0 for standard Catmull-Rom.
 * @param {Array<{x: number, y: number}>} points - Points to interpolate
 * @returns {string} SVG path d attribute
 */
function catmullRomPath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

    // Catmull-Rom to cubic bezier conversion
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
}

/**
 * Generate polyline path through waypoints.
 * @param {number} fromX - Start X
 * @param {number} fromY - Start Y
 * @param {Array<{x: number, y: number}>} waypoints - Intermediate points
 * @param {number} toX - End X
 * @param {number} toY - End Y
 * @returns {string} SVG path d attribute
 */
function waypointPolylinePath(fromX, fromY, waypoints, toX, toY) {
  let path = `M ${fromX},${fromY}`;
  for (const wp of waypoints) {
    path += ` L ${wp.x},${wp.y}`;
  }
  path += ` L ${toX},${toY}`;
  return path;
}

/**
 * Update the SVG path for an arrow based on its coordinates.
 * Handles straight lines, quadratic curves, cubic Bezier curves, and waypoints.
 * @param {Object} arrowData - Arrow data object
 */
export function updateArrowPath(arrowData) {
  if (!arrowData._path) return;

  const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y, waypoints, smooth } = arrowData;
  let pathD;

  // Waypoint mode takes precedence over curve mode
  if (waypoints && waypoints.length > 0) {
    const allPoints = [
      { x: fromX, y: fromY },
      ...waypoints,
      { x: toX, y: toY }
    ];

    if (smooth) {
      pathD = catmullRomPath(allPoints);
    } else {
      pathD = waypointPolylinePath(fromX, fromY, waypoints, toX, toY);
    }
  } else if (control1X !== null && control2X !== null) {
    pathD = `M ${fromX},${fromY} C ${control1X},${control1Y} ${control2X},${control2Y} ${toX},${toY}`;
  } else if (control1X !== null) {
    pathD = `M ${fromX},${fromY} Q ${control1X},${control1Y} ${toX},${toY}`;
  } else {
    pathD = `M ${fromX},${fromY} L ${toX},${toY}`;
  }

  arrowData._path.setAttribute("d", pathD);

  if (arrowData._hitArea) {
    arrowData._hitArea.setAttribute("d", pathD);
  }

  if (arrowData._guideLine1 && arrowData.curveMode) {
    if (control1X !== null) {
      arrowData._guideLine1.setAttribute("x1", fromX);
      arrowData._guideLine1.setAttribute("y1", fromY);
      arrowData._guideLine1.setAttribute("x2", control1X);
      arrowData._guideLine1.setAttribute("y2", control1Y);
      arrowData._guideLine1.style.display = "";
    } else {
      arrowData._guideLine1.style.display = "none";
    }
  }

  if (arrowData._guideLine2 && arrowData.curveMode) {
    if (control2X !== null) {
      arrowData._guideLine2.setAttribute("x1", toX);
      arrowData._guideLine2.setAttribute("y1", toY);
      arrowData._guideLine2.setAttribute("x2", control2X);
      arrowData._guideLine2.setAttribute("y2", control2Y);
      arrowData._guideLine2.style.display = "";
    } else {
      arrowData._guideLine2.style.display = "none";
    }
  }

  if (arrowData.line && arrowData.line !== "single") {
    updateArrowLineStyle(arrowData);
  }

  // Update label position when path changes
  updateArrowLabel(arrowData);
}

/**
 * Update handle positions to match arrow coordinates.
 * @param {Object} arrowData - Arrow data object
 */
export function updateArrowHandles(arrowData) {
  if (arrowData._startHandle) {
    arrowData._startHandle.style.left = arrowData.fromX + "px";
    arrowData._startHandle.style.top = arrowData.fromY + "px";
  }
  if (arrowData._endHandle) {
    arrowData._endHandle.style.left = arrowData.toX + "px";
    arrowData._endHandle.style.top = arrowData.toY + "px";
  }
  if (arrowData._control1Handle && arrowData.control1X !== null) {
    arrowData._control1Handle.style.left = arrowData.control1X + "px";
    arrowData._control1Handle.style.top = arrowData.control1Y + "px";
  }
  if (arrowData._control2Handle && arrowData.control2X !== null) {
    arrowData._control2Handle.style.left = arrowData.control2X + "px";
    arrowData._control2Handle.style.top = arrowData.control2Y + "px";
  }

  // Update waypoint handles
  if (arrowData._waypointHandles && arrowData.waypoints) {
    for (let i = 0; i < arrowData._waypointHandles.length; i++) {
      const handle = arrowData._waypointHandles[i];
      const wp = arrowData.waypoints[i];
      if (handle && wp) {
        handle.style.left = wp.x + "px";
        handle.style.top = wp.y + "px";
      }
    }
  }
}

/**
 * Calculate a point on a Bezier curve at parameter t.
 * @param {number} t - Parameter from 0 to 1
 * @param {Object} arrowData - Arrow data object
 * @returns {{x: number, y: number, angle: number}} Point coordinates and tangent angle
 */
function getPointOnArrow(t, arrowData) {
  const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y } = arrowData;

  let x, y, dx, dy;

  if (control1X !== null && control2X !== null) {
    // Cubic Bezier
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    x = mt3 * fromX + 3 * mt2 * t * control1X + 3 * mt * t2 * control2X + t3 * toX;
    y = mt3 * fromY + 3 * mt2 * t * control1Y + 3 * mt * t2 * control2Y + t3 * toY;

    // Derivative for tangent
    dx = 3 * mt2 * (control1X - fromX) + 6 * mt * t * (control2X - control1X) + 3 * t2 * (toX - control2X);
    dy = 3 * mt2 * (control1Y - fromY) + 6 * mt * t * (control2Y - control1Y) + 3 * t2 * (toY - control2Y);
  } else if (control1X !== null) {
    // Quadratic Bezier
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    x = mt2 * fromX + 2 * mt * t * control1X + t2 * toX;
    y = mt2 * fromY + 2 * mt * t * control1Y + t2 * toY;

    // Derivative for tangent
    dx = 2 * mt * (control1X - fromX) + 2 * t * (toX - control1X);
    dy = 2 * mt * (control1Y - fromY) + 2 * t * (toY - control1Y);
  } else {
    // Straight line
    x = fromX + t * (toX - fromX);
    y = fromY + t * (toY - fromY);
    dx = toX - fromX;
    dy = toY - fromY;
  }

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return { x, y, angle };
}

/**
 * Update the arrow label position and rotation.
 * @param {Object} arrowData - Arrow data object
 */
export function updateArrowLabel(arrowData) {
  if (!arrowData._labelText) return;

  const label = arrowData.label || "";
  arrowData._labelText.textContent = label;

  if (!label) {
    arrowData._labelText.style.display = "none";
    return;
  }

  arrowData._labelText.style.display = "";

  // Determine t value based on position
  let t;
  switch (arrowData.labelPosition) {
    case "start":
      t = 0.15;
      break;
    case "end":
      t = 0.85;
      break;
    case "middle":
    default:
      t = 0.5;
  }

  const point = getPointOnArrow(t, arrowData);
  const offset = arrowData.labelOffset !== undefined ? arrowData.labelOffset : CONFIG.ARROW_DEFAULT_LABEL_OFFSET;

  // Calculate perpendicular offset
  const angleRad = point.angle * (Math.PI / 180);
  const offsetX = -Math.sin(angleRad) * offset;
  const offsetY = Math.cos(angleRad) * offset;

  const labelX = point.x + offsetX;
  const labelY = point.y + offsetY;

  arrowData._labelText.setAttribute("x", labelX);
  arrowData._labelText.setAttribute("y", labelY);

  // Rotate label to follow arrow direction, but keep text readable (not upside down)
  let rotationAngle = point.angle;
  if (rotationAngle > 90 || rotationAngle < -90) {
    rotationAngle += 180;
  }

  arrowData._labelText.setAttribute("transform", `rotate(${rotationAngle}, ${labelX}, ${labelY})`);

  // Update label color to match arrow
  arrowData._labelText.setAttribute("fill", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
}

/**
 * Toggle between straight line and curve mode for an arrow.
 * When entering curve mode, creates default control points.
 * @param {Object} arrowData - Arrow data object
 */
export function toggleCurveMode(arrowData) {
  arrowData.curveMode = !arrowData.curveMode;

  if (arrowData.curveMode) {
    // Clear any existing waypoints (mutually exclusive modes)
    if (arrowData.waypoints && arrowData.waypoints.length > 0) {
      arrowData.waypoints = [];
      arrowData.smooth = false;
      rebuildWaypointHandles(arrowData);
    }

    const { fromX, fromY, toX, toY } = arrowData;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len * 50;
    const perpY = dx / len * 50;

    arrowData.control1X = fromX + dx / 3 + perpX;
    arrowData.control1Y = fromY + dy / 3 + perpY;
    arrowData.control2X = fromX + 2 * dx / 3 + perpX;
    arrowData.control2Y = fromY + 2 * dy / 3 + perpY;

    if (arrowData._container) {
      arrowData._container.classList.add("curve-mode");
    }

    // Show control handles
    if (arrowData._control1Handle) arrowData._control1Handle.style.display = "";
    if (arrowData._control2Handle) arrowData._control2Handle.style.display = "";

  } else {
    arrowData.control1X = null;
    arrowData.control1Y = null;
    arrowData.control2X = null;
    arrowData.control2Y = null;

    if (arrowData._container) {
      arrowData._container.classList.remove("curve-mode");
    }

    if (arrowData._guideLine1) arrowData._guideLine1.style.display = "none";
    if (arrowData._guideLine2) arrowData._guideLine2.style.display = "none";
    if (arrowData._control1Handle) arrowData._control1Handle.style.display = "none";
    if (arrowData._control2Handle) arrowData._control2Handle.style.display = "none";

  }

  updateArrowPath(arrowData);
  updateArrowHandles(arrowData);
  updateSmoothToggleInToolbar(arrowData);
}

