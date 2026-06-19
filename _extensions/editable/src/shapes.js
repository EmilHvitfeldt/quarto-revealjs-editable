/**
 * Shape context panel for the top bar toolbar.
 * Shown when a shape (quarto-shapes `.shape-wrapper`) is selected; mirrors the
 * image panel pattern. Lets the user change the shape type, fill, stroke,
 * stroke width, and (for callouts) the pointer direction.
 * @module shapes
 */

import { pushUndoState } from './undo.js';
import { editableRegistry } from './editable-element.js';
import { showRightPanel } from './toolbar.js';
import { registerDeselectShape, deselectImage, deselectArrow } from './selection.js';
import { getActiveArrow } from './arrows.js';
import { normalizeColor } from './colors.js';
import { isCallout, parseDirection, SHAPE_GROUPS } from './shape-svg.js';

/** @type {HTMLElement|null} The currently active shape element */
export let activeShape = null;

/** Cached references to control inputs for fast sync. */
export const shapeControlRefs = {
  typeSelect: null,
  fillInput: null,
  fillClearBtn: null,
  strokeInput: null,
  strokeClearBtn: null,
  widthSelect: null,
  directionCell: null,
  directionSelect: null,
};

/**
 * Run fn only when there is an active shape with an editableElt.
 * @param {Function} fn - (editableEl) => void
 */
function withActiveShape(fn) {
  if (!activeShape) return;
  const el = editableRegistry.get(activeShape);
  if (!el) return;
  fn(el);
}

registerDeselectShape(() => setActiveShape(null));

/** @type {HTMLElement|null} Draggable pointer-direction handle for callouts. */
let directionHandle = null;

function removeDirectionHandle() {
  if (directionHandle) {
    directionHandle.remove();
    directionHandle = null;
  }
}

/**
 * Position the direction handle on the callout's perimeter in the current
 * pointer direction. Uses percentages so it follows resizing automatically.
 */
function positionDirectionHandle() {
  if (!directionHandle || !activeShape) return;
  const el = editableRegistry.get(activeShape);
  if (!el) return;
  const rad = (parseDirection(el.state.direction) * Math.PI) / 180;
  // 46% ≈ where the spike apex sits in the 0–100 viewBox (edge + spike length).
  directionHandle.style.left = `${50 + 46 * Math.sin(rad)}%`;
  directionHandle.style.top = `${50 - 46 * Math.cos(rad)}%`;
}

/**
 * Create/position the direction handle for the active callout, or remove it
 * when the active shape is not a callout (or nothing is selected).
 */
function syncDirectionHandle() {
  const el = activeShape && editableRegistry.get(activeShape);
  if (!el || !isCallout(el.state.shapeType)) {
    removeDirectionHandle();
    return;
  }
  if (!directionHandle) {
    directionHandle = document.createElement("div");
    directionHandle.className = "shape-direction-handle";
    directionHandle.setAttribute("role", "slider");
    directionHandle.setAttribute("aria-label", "Drag to aim the callout pointer");
    directionHandle.title = "Drag to aim the pointer";
    directionHandle.addEventListener("mousedown", startDirectionDrag);
    directionHandle.addEventListener("touchstart", startDirectionDrag);
  }
  if (el.container && directionHandle.parentNode !== el.container) {
    el.container.appendChild(directionHandle);
  }
  positionDirectionHandle();
}

function startDirectionDrag(e) {
  e.preventDefault();
  e.stopPropagation();
  const el = activeShape && editableRegistry.get(activeShape);
  if (!el || !el.container) return;
  pushUndoState();

  const rect = el.container.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const onMove = (me) => {
    const clientX = me.touches ? me.touches[0].clientX : me.clientX;
    const clientY = me.touches ? me.touches[0].clientY : me.clientY;
    // Compass degrees: 0 = up, measured clockwise. Scale-invariant.
    let deg = Math.round((Math.atan2(clientX - cx, -(clientY - cy)) * 180) / Math.PI);
    if (deg < 0) deg += 360;
    el.setState({ direction: deg });
    positionDirectionHandle();
    if (shapeControlRefs.directionSelect) shapeControlRefs.directionSelect.value = String(deg);
  };
  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("touchmove", onMove);
  document.addEventListener("touchend", onUp);
}

/**
 * Set the active shape and swap in the shape panel.
 * @param {HTMLElement|null} shapeEl
 */
export function setActiveShape(shapeEl) {
  if (shapeEl && shapeEl !== activeShape) {
    deselectImage();
    deselectArrow();
  }
  activeShape = shapeEl;
  if (shapeEl) {
    updateShapeStylePanel(shapeEl);
    showRightPanel('shape');
    syncDirectionHandle();
  } else {
    removeDirectionHandle();
    if (!getActiveArrow()) showRightPanel('default');
  }
}

/**
 * Enable double-click plain-text editing of a shape's `.shape-content`.
 * Text edits are written back to the QMD fence body on save.
 * @param {HTMLElement} shapeEl - The `.shape-wrapper` element
 */
export function enableShapeTextEditing(shapeEl) {
  const content = shapeEl.querySelector(".shape-content");
  if (!content) return;
  shapeEl.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startShapeTextEdit(shapeEl, content);
  });
}

function startShapeTextEdit(shapeEl, content) {
  if (content.getAttribute("contenteditable") === "true") return;
  pushUndoState();
  content.setAttribute("contenteditable", "true");
  content.classList.add("shape-content-editing");
  content.focus();

  // Place the caret at the end of any existing text.
  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const onInput = () => { shapeEl.dataset.editableShapeTextDirty = "true"; };
  const onKey = (ev) => {
    if (ev.key === "Escape") { ev.preventDefault(); content.blur(); }
  };
  const finish = () => {
    content.removeAttribute("contenteditable");
    content.classList.remove("shape-content-editing");
    content.removeEventListener("blur", finish);
    content.removeEventListener("keydown", onKey);
    content.removeEventListener("input", onInput);
  };
  content.addEventListener("input", onInput);
  content.addEventListener("keydown", onKey);
  content.addEventListener("blur", finish);
}

/**
 * Sync all panel controls to the current state of shapeEl.
 * @param {HTMLElement} shapeEl
 */
export function updateShapeStylePanel(shapeEl) {
  const editableEl = editableRegistry.get(shapeEl);
  if (!editableEl) return;
  const s = editableEl.state;

  if (shapeControlRefs.typeSelect) {
    shapeControlRefs.typeSelect.value = s.shapeType || "";
  }
  if (shapeControlRefs.fillInput) {
    shapeControlRefs.fillInput.value = s.fill ? normalizeColor(s.fill) : "#000000";
  }
  if (shapeControlRefs.strokeInput) {
    shapeControlRefs.strokeInput.value = s.stroke ? normalizeColor(s.stroke) : "#000000";
  }
  if (shapeControlRefs.widthSelect) {
    shapeControlRefs.widthSelect.value = s.strokeWidth || "";
  }
  if (shapeControlRefs.directionCell) {
    const isCalloutShape = isCallout(s.shapeType);
    shapeControlRefs.directionCell.parentElement.style.opacity = isCalloutShape ? "" : "0.4";
    if (shapeControlRefs.directionSelect) {
      shapeControlRefs.directionSelect.disabled = !isCalloutShape;
      shapeControlRefs.directionSelect.value = s.direction != null ? String(s.direction) : "down";
    }
  }
}

/**
 * Create the shape style controls panel DOM. Uses the same label/cell grid as
 * the image panel.
 * @returns {HTMLElement}
 */
export function createShapeStyleControls() {
  const container = document.createElement("div");
  container.className = "shape-style-controls";

  const centerWrap = document.createElement("div");
  centerWrap.className = "shape-center-wrap";

  const controlsWrap = document.createElement("div");
  controlsWrap.className = "shape-controls-wrap";

  function addCell(labelText) {
    const label = document.createElement("span");
    label.className = "shape-ctrl-label";
    label.textContent = labelText;
    controlsWrap.appendChild(label);
    const cell = document.createElement("div");
    cell.className = "shape-ctrl-cell";
    controlsWrap.appendChild(cell);
    return cell;
  }

  buildTypeControl(addCell);
  buildColorControl(addCell, "Fill", "fill");
  buildColorControl(addCell, "Stroke", "stroke");
  buildWidthControl(addCell);
  buildDirectionControl(addCell);
  buildTextControl(addCell);

  centerWrap.appendChild(controlsWrap);
  container.appendChild(centerWrap);
  return container;
}

function buildTypeControl(addCell) {
  const cell = addCell("Shape");
  const select = document.createElement("select");
  select.className = "shape-toolbar-select shape-toolbar-type";
  select.title = "Shape type";
  for (const group of SHAPE_GROUPS) {
    const og = document.createElement("optgroup");
    og.label = group.group;
    for (const item of group.items) {
      const opt = document.createElement("option");
      opt.value = item.name;
      opt.textContent = item.label;
      og.appendChild(opt);
    }
    select.appendChild(og);
  }
  select.addEventListener("change", () => {
    pushUndoState();
    withActiveShape((el) => {
      el.setState({ shapeType: select.value });
      updateShapeStylePanel(activeShape);
      syncDirectionHandle();
    });
  });
  shapeControlRefs.typeSelect = select;
  cell.appendChild(select);
}

function buildColorControl(addCell, labelText, prop) {
  const cell = addCell(labelText);
  const wrap = document.createElement("div");
  wrap.className = "shape-btn-group";

  const input = document.createElement("input");
  input.type = "color";
  input.className = "shape-toolbar-color";
  input.title = `${labelText} color`;
  input.addEventListener("input", () => {
    pushUndoState();
    withActiveShape((el) => el.setState({ [prop]: input.value }));
  });

  const clearBtn = document.createElement("button");
  clearBtn.className = "shape-toolbar-btn shape-toolbar-clear";
  clearBtn.textContent = "∅";
  clearBtn.title = `No ${labelText.toLowerCase()}`;
  clearBtn.addEventListener("click", () => {
    pushUndoState();
    withActiveShape((el) => el.setState({ [prop]: null }));
  });

  wrap.appendChild(input);
  wrap.appendChild(clearBtn);
  cell.appendChild(wrap);

  if (prop === "fill") {
    shapeControlRefs.fillInput = input;
    shapeControlRefs.fillClearBtn = clearBtn;
  } else {
    shapeControlRefs.strokeInput = input;
    shapeControlRefs.strokeClearBtn = clearBtn;
  }
}

function buildWidthControl(addCell) {
  const cell = addCell("Width");
  const select = document.createElement("select");
  select.className = "shape-toolbar-select shape-toolbar-width";
  select.title = "Stroke width";
  for (const [value, label] of [["", "Default"], ["sm", "S"], ["md", "M"], ["lg", "L"], ["xl", "XL"]]) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    pushUndoState();
    withActiveShape((el) => el.setState({ strokeWidth: select.value || null }));
  });
  shapeControlRefs.widthSelect = select;
  cell.appendChild(select);
}

function buildTextControl(addCell) {
  const cell = addCell("Text");
  const btn = document.createElement("button");
  btn.className = "shape-toolbar-btn shape-toolbar-text";
  btn.textContent = "✎";
  btn.title = "Edit text inside the shape (or double-click it)";
  btn.setAttribute("aria-label", "Edit shape text");
  btn.addEventListener("click", () => {
    if (!activeShape) return;
    const content = activeShape.querySelector(".shape-content");
    if (content) startShapeTextEdit(activeShape, content);
  });
  cell.appendChild(btn);
}

function buildDirectionControl(addCell) {
  const cell = addCell("Direction");
  const select = document.createElement("select");
  select.className = "shape-toolbar-select shape-toolbar-direction";
  select.title = "Callout pointer direction";
  for (const [value, label] of [["up", "Up"], ["right", "Right"], ["down", "Down"], ["left", "Left"], ["45", "↗ 45°"], ["135", "↘ 135°"], ["225", "↙ 225°"], ["315", "↖ 315°"]]) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    pushUndoState();
    withActiveShape((el) => {
      el.setState({ direction: select.value });
      positionDirectionHandle();
    });
  });
  shapeControlRefs.directionCell = cell;
  shapeControlRefs.directionSelect = select;
  cell.appendChild(select);
}
