/**
 * Arrow system for creating and editing SVG arrows on slides.
 * Integrates with the quarto-arrows extension for shortcode serialization.
 * @module arrows
 */

import { CONFIG } from './config.js';
import { getSlideScale, getRawClient, getCurrentSlide, getCurrentSlideIndex, getQmdHeadingIndex, debug } from './utils.js';
import { getColorPalette, rgbToHex } from './colors.js';
import { NewElementRegistry } from './registries.js';
import { pushUndoState, registerRestoreArrowDOM } from './undo.js';
import { showRightPanel } from './toolbar.js';
import { registerDeselectArrow, deselectImage } from './selection.js';

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
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "editable-modal-title");

    const modal = document.createElement("div");
    modal.className = "editable-modal";

    const title = document.createElement("h3");
    title.id = "editable-modal-title";
    title.className = "editable-modal-title";
    title.textContent = "Arrow Extension Required";

    const p1 = document.createElement("p");
    p1.className = "editable-modal-body";
    p1.innerHTML = 'Arrows are saved as <code class="editable-modal-code">{{&lt; arrow &gt;}}</code> shortcodes which require the <a href="https://github.com/EmilHvitfeldt/quarto-arrows" target="_blank" class="editable-modal-link">quarto-arrows</a> extension to render.';

    const p2 = document.createElement("p");
    p2.className = "editable-modal-body";
    const installCode = document.createElement("code");
    installCode.className = "editable-modal-code editable-modal-code-block";
    installCode.textContent = "quarto add EmilHvitfeldt/quarto-arrows";
    p2.appendChild(document.createTextNode("Install with:"));
    p2.appendChild(document.createElement("br"));
    p2.appendChild(installCode);

    const p3 = document.createElement("p");
    p3.className = "editable-modal-body editable-modal-body-small";
    p3.textContent = "Continue? (Arrows will work in the editor but won't render until the extension is installed)";

    const btnRow = document.createElement("div");
    btnRow.className = "editable-modal-buttons";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "editable-modal-cancel";
    cancelBtn.textContent = "Cancel";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "editable-modal-confirm";
    confirmBtn.textContent = "Continue";

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    modal.appendChild(title);
    modal.appendChild(p1);
    modal.appendChild(p2);
    modal.appendChild(p3);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = (result) => { overlay.remove(); resolve(result); };

    cancelBtn.onclick = () => cleanup(false);
    confirmBtn.onclick = () => cleanup(true);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };

    // Focus trap: keep Tab inside the modal
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { cleanup(false); return; }
      if (e.key !== "Tab") return;
      const focusable = [...modal.querySelectorAll("button, a, [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    confirmBtn.focus();
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

function syncOpacitySliderColor(color) {
  const el = arrowControlRefs.opacityInput;
  if (el) el.style.setProperty("--arrow-opacity-color", color);
}

/**
 * Available arrow head styles for the quarto-arrows extension.
 * @type {string[]}
 */
export const ARROW_HEAD_STYLES = ["arrow", "stealth", "diamond", "circle", "square", "bar", "none"];

/**
 * Set the active (selected) arrow. Only one arrow can be active at a time.
 * @param {Object|null} arrowData - Arrow to select, or null to deselect
 */
registerDeselectArrow(() => setActiveArrow(null));
registerRestoreArrowDOM((snapshots) => {
  for (const snapshot of snapshots) {
    updateArrowPath(snapshot.arrowData);
    updateArrowHandles(snapshot.arrowData);
    updateArrowAppearance(snapshot.arrowData);
    updateArrowActiveState(snapshot.arrowData);
  }
});

export function setActiveArrow(arrowData) {
  if (activeArrow && activeArrow !== arrowData) {
    activeArrow.isActive = false;
    updateArrowActiveState(activeArrow);
  }
  if (arrowData && arrowData !== activeArrow) {
    deselectImage();
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

  // ── Shared helpers ───────────────────────────────────────────────────────

  // Position a fixed popover below an anchor element.
  function openPopoverBelow(popover, anchor) {
    const rect = anchor.getBoundingClientRect();
    popover.style.top = (rect.bottom + 4) + "px";
    popover.style.left = rect.left + "px";
    popover.style.display = "";
  }

  // Create a wa-input number spinner with scroll-wheel support.
  // opts: { id, className, title, defaultValue, min, max, onUndo, onUpdate, updateFn }
  function createNumberInput({ id, className, title, defaultValue, min, max, onUndo, onUpdate, updateFn }) {
    const input = document.createElement("input");
    input.type = "number";
    input.id = id;
    input.className = className;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    input.value = defaultValue.toString();
    input.title = title;
    input.addEventListener("focus", () => { if (activeArrow && onUndo) onUndo(); });
    input.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (activeArrow) {
        if (onUndo) onUndo();
        const delta = e.deltaY < 0 ? 1 : -1;
        const raw = (parseInt(input.value) || 0) + delta;
        const clamped = min !== undefined || max !== undefined
          ? Math.max(min ?? -Infinity, Math.min(max ?? Infinity, raw))
          : raw;
        input.value = clamped.toString();
        onUpdate(clamped);
        updateFn(activeArrow);
      }
    }, { passive: false });
    input.addEventListener("input", (e) => {
      if (activeArrow) {
        const val = parseInt(e.target.value);
        if (!isNaN(val)) {
          const clamped = min !== undefined || max !== undefined
            ? Math.max(min ?? -Infinity, Math.min(max ?? Infinity, val))
            : val;
          onUpdate(clamped);
          updateFn(activeArrow);
        }
      }
    });
    return input;
  }

  // ── Color section: two stacked buttons ──────────────────────────────────
  const colorSection = document.createElement("div");
  colorSection.className = "arrow-color-section";

  // Top button: triggers native OS color picker
  const colorPickerBtn = document.createElement("button");
  colorPickerBtn.className = "arrow-color-btn";
  colorPickerBtn.style.backgroundColor = "#000000";
  colorPickerBtn.title = "Custom color";

  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.id = "arrow-style-color";
  colorPicker.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
  colorPicker.value = "#000000";
  colorPickerBtn.appendChild(colorPicker);
  colorPickerBtn.addEventListener("click", () => colorPicker.click());
  colorPicker.addEventListener("focus", () => {
    if (activeArrow) pushUndoState();
  });
  colorPicker.addEventListener("input", (e) => {
    if (activeArrow) {
      activeArrow.color = e.target.value;
      updateArrowAppearance(activeArrow);
      colorPickerBtn.style.backgroundColor = e.target.value;
      syncOpacitySliderColor(e.target.value);
      colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach(s => s.classList.remove("selected"));
    }
  });
  colorSection.appendChild(colorPickerBtn);

  // Bottom button: toggles preset swatches popover
  const presetsToggleBtn = document.createElement("button");
  presetsToggleBtn.className = "arrow-color-btn arrow-color-presets-toggle";
  presetsToggleBtn.title = "Preset colors";
  colorSection.appendChild(presetsToggleBtn);

  // Floating presets popover (appended to body, not toolbar)
  const colorPresetsPopover = document.createElement("div");
  colorPresetsPopover.className = "arrow-color-presets-popover";
  colorPresetsPopover.style.display = "none";
  document.body.appendChild(colorPresetsPopover);

  const colorPresetsRow = document.createElement("div");
  colorPresetsRow.className = "arrow-color-presets";
  colorPresetsPopover.appendChild(colorPresetsRow);

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
        colorPicker.value = color;
        colorPickerBtn.style.backgroundColor = color;
        syncOpacitySliderColor(color);
        colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach(s => s.classList.remove("selected"));
        swatch.classList.add("selected");
        colorPresetsPopover.style.display = "none";
      }
    });
    colorPresetsRow.appendChild(swatch);
  });

  presetsToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = colorPresetsPopover.style.display !== "none";
    colorPresetsPopover.style.display = "none";
    if (!isOpen) openPopoverBelow(colorPresetsPopover, presetsToggleBtn);
  });

  // Prevent mousedown from deselecting the active arrow
  colorPresetsPopover.addEventListener("mousedown", (e) => e.preventDefault());


  // Centering wrapper — holds color section + controls as one unit
  const centerWrap = document.createElement("div");
  centerWrap.className = "arrow-center-wrap";
  centerWrap.appendChild(colorSection);
  container.appendChild(centerWrap);

  // Wrapping sub-container for all non-color controls
  const controlsWrap = document.createElement("div");
  controlsWrap.className = "arrow-controls-wrap";

  // Helper: icon-select button — shows the active icon, click opens a dropdown
  // with icon + label for each option. Exposes .value getter/setter.
  function createIconSelect(options, onChange) {
    const wrapper = document.createElement("div");
    wrapper.className = "arrow-icon-select";

    const btn = document.createElement("button");
    btn.className = "arrow-icon-select-btn";

    let currentValue = options[0].value;

    const dropdown = document.createElement("div");
    dropdown.className = "arrow-icon-select-dropdown";
    dropdown.style.display = "none";
    document.body.appendChild(dropdown);

    options.forEach(({ value, icon, title }) => {
      const item = document.createElement("button");
      item.className = "arrow-icon-select-item";
      item.dataset.value = value;
      item.innerHTML = `<span class="arrow-icon-select-icon">${icon}</span><span>${title}</span>`;
      item.addEventListener("mousedown", (e) => e.preventDefault());
      item.addEventListener("click", () => {
        if (activeArrow) {
          pushUndoState();
          onChange(value);
        }
        wrapper.value = value;
        dropdown.style.display = "none";
      });
      dropdown.appendChild(item);
    });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display !== "none";
      document.querySelectorAll(".arrow-icon-select-dropdown").forEach(d => d.style.display = "none");
      if (!isOpen) openPopoverBelow(dropdown, btn);
    });

    wrapper.appendChild(btn);

    Object.defineProperty(wrapper, "value", {
      get() { return currentValue; },
      set(val) {
        currentValue = val;
        const opt = options.find(o => o.value === val);
        if (opt) btn.innerHTML = opt.icon;
        dropdown.querySelectorAll(".arrow-icon-select-item").forEach(item => {
          item.classList.toggle("active", item.dataset.value === val);
        });
      }
    });

    // Set initial value
    wrapper.value = options[0].value;

    return wrapper;
  }

  // Width input
  const widthInput = createNumberInput({
    id: "arrow-style-width",
    className: "arrow-toolbar-width",
    title: "Width",
    defaultValue: 2,
    min: 1,
    max: 20,
    onUndo: () => pushUndoState(),
    onUpdate: (val) => { activeArrow.width = val; },
    updateFn: updateArrowAppearance,
  });
  controlsWrap.appendChild(widthInput);

  // Head style icon-select
  const headSelect = createIconSelect([
    { value: "arrow",   icon: "→", title: "Arrow" },
    { value: "stealth", icon: "▶", title: "Stealth" },
    { value: "diamond", icon: "◆", title: "Diamond" },
    { value: "circle",  icon: "●", title: "Circle" },
    { value: "square",  icon: "■", title: "Square" },
    { value: "bar",     icon: "|", title: "Bar" },
    { value: "none",    icon: "✕", title: "None" },
  ], (value) => { activeArrow.head = value; updateArrowAppearance(activeArrow); });
  headSelect.id = "arrow-style-head";
  headSelect.value = "arrow";
  controlsWrap.appendChild(headSelect);

  // Dash style icon-select
  const dashSelect = createIconSelect([
    { value: "solid",  icon: "─", title: "Solid" },
    { value: "dashed", icon: "╌", title: "Dashed" },
    { value: "dotted", icon: "·", title: "Dotted" },
  ], (value) => { activeArrow.dash = value; updateArrowAppearance(activeArrow); });
  dashSelect.id = "arrow-style-dash";
  dashSelect.value = "solid";
  controlsWrap.appendChild(dashSelect);

  // Line style icon-select
  const lineSelect = createIconSelect([
    { value: "single", icon: "─", title: "Single" },
    { value: "double", icon: "═", title: "Double" },
    { value: "triple", icon: "≡", title: "Triple" },
  ], (value) => { activeArrow.line = value; updateArrowAppearance(activeArrow); });
  lineSelect.id = "arrow-style-line";
  lineSelect.value = "single";
  controlsWrap.appendChild(lineSelect);

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
  controlsWrap.appendChild(opacityInput);

  // Curve mode toggle
  const curveToggle = document.createElement("button");
  curveToggle.id = "arrow-style-curve";
  curveToggle.className = "arrow-toolbar-curve arrow-toolbar-btn";
  curveToggle.innerHTML = "⤴";
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
  controlsWrap.appendChild(curveToggle);

  // Smooth toggle (for waypoints)
  const smoothToggle = document.createElement("button");
  smoothToggle.id = "arrow-style-smooth";
  smoothToggle.className = "arrow-toolbar-smooth arrow-toolbar-btn";
  smoothToggle.innerHTML = "〰";
  smoothToggle.title = "Toggle smooth curves through waypoints";
  smoothToggle.addEventListener("click", () => {
    if (activeArrow && activeArrow.waypoints && activeArrow.waypoints.length > 0) {
      pushUndoState();
      activeArrow.smooth = !activeArrow.smooth;
      updateArrowPath(activeArrow);
      updateSmoothToggleInToolbar(activeArrow);
    }
  });
  // Waypoint count badge
  const waypointBadge = document.createElement("span");
  waypointBadge.id = "arrow-style-waypoint-count";
  waypointBadge.className = "arrow-toolbar-waypoint-badge";
  waypointBadge.title = "Number of waypoints (double-click arrow to add, double-click waypoint to remove)";

  // Label section: text input on row 1, position + offset on row 2
  const labelSection = document.createElement("div");
  labelSection.className = "arrow-label-section";

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.id = "arrow-style-label";
  labelInput.className = "arrow-toolbar-label";
  labelInput.placeholder = "Label...";
  labelInput.title = "Label text";
  labelInput.addEventListener("input", (e) => {
    if (activeArrow) {
      activeArrow.label = e.target.value;
      updateArrowLabel(activeArrow);
    }
  });
  labelSection.appendChild(labelInput);

  const labelSubRow = document.createElement("div");
  labelSubRow.className = "arrow-label-subrow";

  const labelPositionSelect = createIconSelect([
    { value: "start",  icon: "◄", title: "Label at start" },
    { value: "middle", icon: "◆", title: "Label at middle" },
    { value: "end",    icon: "►", title: "Label at end" },
  ], (value) => { if (activeArrow) { activeArrow.labelPosition = value; updateArrowLabel(activeArrow); } });
  labelPositionSelect.id = "arrow-style-label-position";
  labelPositionSelect.value = CONFIG.ARROW_DEFAULT_LABEL_POSITION;
  labelSubRow.appendChild(labelPositionSelect);

  const labelOffsetInput = createNumberInput({
    id: "arrow-style-label-offset",
    className: "arrow-toolbar-width",
    title: "Label offset (positive = above, negative = below)",
    defaultValue: CONFIG.ARROW_DEFAULT_LABEL_OFFSET,
    onUpdate: (val) => { activeArrow.labelOffset = val; },
    updateFn: updateArrowLabel,
  });
  labelSubRow.appendChild(labelOffsetInput);

  labelSection.appendChild(labelSubRow);
  controlsWrap.appendChild(labelSection);
  controlsWrap.appendChild(smoothToggle);
  controlsWrap.appendChild(waypointBadge);
  centerWrap.appendChild(controlsWrap);

  // Cache references for efficient updates
  arrowControlRefs.colorPicker = colorPicker;
  arrowControlRefs.colorPickerBtn = colorPickerBtn;
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

  const arrowPanel = toolbar.querySelector(".toolbar-panel-arrow");
  if (!arrowPanel) return;

  let arrowControls = arrowPanel.querySelector(".arrow-style-controls");
  if (!arrowControls) {
    arrowControls = createArrowStyleControls();
    arrowPanel.appendChild(arrowControls);
  }

  if (arrowData) {
    const { colorPicker, colorPickerBtn, widthInput, headSelect, dashSelect, lineSelect, opacityInput, colorPresetsRow, labelInput, labelPositionSelect, labelOffsetInput } = arrowControlRefs;

    if (colorPicker) {
      const colorValue = arrowData.color === "black" ? "#000000" : arrowData.color;
      colorPicker.value = colorValue;
      if (colorPickerBtn) colorPickerBtn.style.backgroundColor = colorValue;
      syncOpacitySliderColor(colorValue);
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

    showRightPanel('arrow');
  } else {
    showRightPanel('default');
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

  waypointBadge.textContent = hasWaypoints ? `${arrowData.waypoints.length} wp` : "0 wp";
  smoothToggle.classList.toggle("active", !!(arrowData && arrowData.smooth && hasWaypoints));
}

/**
 * Update arrow visual appearance based on its data (color, width, dash, etc.).
 * @param {Object} arrowData - Arrow data object
 */
function getDashArray(dash, width) {
  if (dash === "dashed") return `${width * 4},${width * 2}`;
  if (dash === "dotted") return `${width},${width * 2}`;
  return "none";
}

export function updateArrowAppearance(arrowData) {
  if (!arrowData._path) return;

  arrowData._path.setAttribute("stroke", arrowData.color);
  arrowData._path.setAttribute("stroke-width", arrowData.width);

  // Update label color to match arrow
  if (arrowData._labelText) {
    arrowData._labelText.setAttribute("fill", arrowData.color);
  }

  const dashArray = getDashArray(arrowData.dash, arrowData.width);
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

export function offsetPointPerpendicular(x, y, tangentX, tangentY, offsetAmount) {
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

  const offset = arrowData.width * CONFIG.ARROW_DOUBLE_LINE_OFFSET_MULTIPLIER;

  const createOffsetPath = (offsetAmount) => {
    const extraPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    extraPath.className.baseVal = "arrow-extra-line";
    extraPath.setAttribute("stroke", arrowData.color);
    extraPath.setAttribute("stroke-width", arrowData.width);
    extraPath.setAttribute("fill", "none");
    extraPath.style.pointerEvents = "none";

    const dashArray = getDashArray(arrowData.dash, arrowData.width);
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
  const slideWidth = currentSlide.offsetWidth || CONFIG.DEFAULT_SLIDE_WIDTH;
  const slideHeight = currentSlide.offsetHeight || CONFIG.DEFAULT_SLIDE_HEIGHT;

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

    ({ clientX: dragStartX, clientY: dragStartY } = getRawClient(e));

    hitArea.style.cursor = "grabbing";
  };

  const onArrowDrag = (e) => {
    if (!isDraggingArrow) return;
    e.preventDefault();

    const { clientX, clientY } = getRawClient(e);
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
      // Close any open dropdowns/popovers unless the click was inside one
      if (!e.target.closest(".arrow-color-presets-popover") &&
          !e.target.closest(".arrow-icon-select-dropdown")) {
        document.querySelectorAll(".arrow-icon-select-dropdown, .arrow-color-presets-popover")
          .forEach(el => el.style.display = "none");
      }
      if (activeArrow &&
          !e.target.closest(".editable-arrow-container") &&
          !e.target.closest(".editable-toolbar") &&
          !e.target.closest(".arrow-color-presets-popover") &&
          !e.target.closest(".arrow-icon-select-dropdown")) {
        setActiveArrow(null);
      }
    });
  }

  return container;
}

/**
 * Create the base handle DOM element and attach drag events.
 * @param {string} className - CSS class for the handle
 * @param {string} ariaLabel - Accessible label
 * @param {number} size - Handle diameter in px
 * @param {string} bgColor - Background color
 * @returns {{handle: HTMLElement, controller: AbortController}} Handle and its abort controller
 */
function createHandleElement(className, ariaLabel, size, bgColor) {
  const handle = document.createElement("div");
  handle.className = className;
  handle.style.position = "absolute";
  handle.style.width = size + "px";
  handle.style.height = size + "px";
  handle.style.borderRadius = "50%";
  handle.style.backgroundColor = bgColor;
  handle.style.border = "2px solid white";
  handle.style.cursor = "move";
  handle.style.pointerEvents = "auto";
  handle.style.transform = "translate(-50%, -50%)";
  handle.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
  handle.setAttribute("role", "slider");
  handle.setAttribute("aria-label", ariaLabel);
  handle.setAttribute("tabindex", "0");

  const controller = new AbortController();
  handle._dragController = controller;
  return { handle, controller };
}

/**
 * Attach mouse/touch drag listeners that call onDrag each move event.
 * @param {HTMLElement} handle
 * @param {AbortController} controller
 * @param {Function} onDrag - (e) => void, receives move events
 */
function setupHandleDrag(handle, controller, onDrag) {
  let isDragging = false;
  let cachedScale = 1;

  const startDrag = (e) => {
    pushUndoState();
    isDragging = true;
    cachedScale = getSlideScale();
    e.preventDefault();
    e.stopPropagation();
  };

  const duringDrag = (e) => {
    if (!isDragging) return;
    onDrag(e, cachedScale);
  };

  const stopDrag = () => { isDragging = false; };

  handle.addEventListener("mousedown", startDrag);
  handle.addEventListener("touchstart", startDrag);
  document.addEventListener("mousemove", duringDrag, { signal: controller.signal });
  document.addEventListener("touchmove", duringDrag, { signal: controller.signal });
  document.addEventListener("mouseup", stopDrag, { signal: controller.signal });
  document.addEventListener("touchend", stopDrag, { signal: controller.signal });
}

/**
 * Create a draggable handle for an arrow endpoint or control point.
 * @param {Object} arrowData - Arrow data object
 * @param {string} position - Handle position ("start", "end", "control1", "control2")
 * @returns {HTMLElement} Handle element
 */
function createArrowHandle(arrowData, position) {
  const isControlPoint = position === "control1" || position === "control2";
  const handleSize = isControlPoint ? CONFIG.ARROW_CONTROL_HANDLE_SIZE : CONFIG.ARROW_HANDLE_SIZE;
  // start/end colors come from CSS vars (--editable-arrow-start-color / --editable-arrow-end-color)
  const bgColor = position === "control1" ? CONFIG.ARROW_CONTROL1_COLOR
                : position === "control2" ? CONFIG.ARROW_CONTROL2_COLOR
                : "";

  const { handle, controller } = createHandleElement(
    `editable-arrow-handle editable-arrow-handle-${position}`,
    `Arrow ${position} point`,
    handleSize,
    bgColor
  );

  setupHandleDrag(handle, controller, (e, scale) => {
    if (!arrowData.element) return;
    const rect = arrowData.element.getBoundingClientRect();
    const { clientX, clientY } = getRawClient(e);
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    if (position === "start") { arrowData.fromX = x; arrowData.fromY = y; }
    else if (position === "end") { arrowData.toX = x; arrowData.toY = y; }
    else if (position === "control1") { arrowData.control1X = x; arrowData.control1Y = y; }
    else if (position === "control2") { arrowData.control2X = x; arrowData.control2Y = y; }
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    e.preventDefault();
  });

  return handle;
}

/**
 * Create a draggable handle for a waypoint.
 * @param {Object} arrowData - Arrow data object
 * @param {number} waypointIndex - Index of the waypoint in the waypoints array
 * @returns {HTMLElement} Handle element
 */
function createWaypointHandle(arrowData, waypointIndex) {
  const { handle, controller } = createHandleElement(
    "editable-arrow-handle editable-arrow-handle-waypoint",
    `Arrow waypoint ${waypointIndex + 1}`,
    CONFIG.ARROW_WAYPOINT_HANDLE_SIZE,
    CONFIG.ARROW_WAYPOINT_COLOR
  );
  handle.dataset.waypointIndex = waypointIndex;

  setupHandleDrag(handle, controller, (e, scale) => {
    if (!arrowData.element) return;
    const rect = arrowData.element.getBoundingClientRect();
    const { clientX, clientY } = getRawClient(e);
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
  });

  const deleteWaypoint = (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeWaypoint(arrowData, parseInt(handle.dataset.waypointIndex, 10));
  };

  handle.addEventListener("dblclick", deleteWaypoint);
  handle.addEventListener("contextmenu", deleteWaypoint);
  handle.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") deleteWaypoint(e);
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
export function distanceToSegment(px, py, x1, y1, x2, y2) {
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
export function catmullRomPath(points) {
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
export function getPointOnArrow(t, arrowData) {
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
      t = CONFIG.ARROW_LABEL_T_START;
      break;
    case "end":
      t = CONFIG.ARROW_LABEL_T_END;
      break;
    case "middle":
    default:
      t = CONFIG.ARROW_LABEL_T_MIDDLE;
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
  if (rotationAngle > CONFIG.ARROW_LABEL_FLIP_THRESHOLD || rotationAngle < -CONFIG.ARROW_LABEL_FLIP_THRESHOLD) {
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
    const perpX = -dy / len * CONFIG.ARROW_CONTROL_POINT_DISPLACEMENT;
    const perpY = dx / len * CONFIG.ARROW_CONTROL_POINT_DISPLACEMENT;

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

