/**
 * Image context panel for the top bar toolbar.
 * Shown when an image element is selected; mirrors the arrow panel pattern.
 * @module images
 */

import { pushUndoState } from './undo.js';
import { editableRegistry } from './editable-element.js';
import { showRightPanel } from './toolbar.js';
import { registerDeselectImage, deselectArrow } from './selection.js';

/** @type {HTMLElement|null} The currently active image element */
export let activeImage = null;

/** @type {HTMLElement|null} Active replace warning popup */
let replaceWarningEl = null;

/**
 * Show a temporary warning popup below the toolbar, anchored to anchorEl.
 * @param {string} message
 * @param {HTMLElement} anchorEl
 */
function showReplaceWarning(message, anchorEl) {
  if (replaceWarningEl) replaceWarningEl.remove();

  const popup = document.createElement("div");
  popup.className = "image-replace-warning";
  popup.textContent = `⚠ ${message}`;
  document.body.appendChild(popup);
  replaceWarningEl = popup;

  const rect = anchorEl.closest("#editable-toolbar")?.getBoundingClientRect()
    ?? anchorEl.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 6}px`;
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";

  const timer = setTimeout(() => {
    popup.remove();
    if (replaceWarningEl === popup) replaceWarningEl = null;
  }, 4000);

  popup.addEventListener("click", () => {
    clearTimeout(timer);
    popup.remove();
    if (replaceWarningEl === popup) replaceWarningEl = null;
  }, { once: true });
}

/** Cached references to control inputs for fast sync */
export const imageControlRefs = {
  opacitySlider: null,
  opacityLabel: null,
  borderRadiusInput: null,
  cropBtn: null,
  flipHBtn: null,
  flipVBtn: null,
};

/** @type {boolean} Whether crop mode is currently active */
let cropModeActive = false;

/** @type {Map<HTMLElement, Function>} Capture-phase listeners attached to resize handles in crop mode */
const cropHandleListeners = new Map();

/**
 * Set the active image and sync the panel controls to its current state.
 * @param {HTMLElement|null} imgEl
 */
registerDeselectImage(() => setActiveImage(null));

export function setActiveImage(imgEl) {
  if (activeImage && activeImage !== imgEl) {
    exitCropMode();
  }
  if (imgEl && imgEl !== activeImage) {
    deselectArrow();
  }
  activeImage = imgEl;
  if (imgEl) {
    updateImageStylePanel(imgEl);
    showRightPanel('image');
  } else {
    showRightPanel('default');
  }
}

/**
 * Sync all panel controls to the current state of imgEl.
 * @param {HTMLElement} imgEl
 */
export function updateImageStylePanel(imgEl) {
  const editableEl = editableRegistry.get(imgEl);
  if (!editableEl) return;
  const s = editableEl.state;

  if (imageControlRefs.opacitySlider) {
    imageControlRefs.opacitySlider.value = s.opacity ?? 100;
    imageControlRefs.opacityLabel.textContent = `${s.opacity ?? 100}%`;
  }

  if (imageControlRefs.borderRadiusInput) {
    imageControlRefs.borderRadiusInput.value = s.borderRadius ?? 0;
  }

  if (imageControlRefs.cropBtn) {
    imageControlRefs.cropBtn.classList.toggle("active", cropModeActive);
  }

  if (imageControlRefs.flipHBtn) {
    imageControlRefs.flipHBtn.classList.toggle("active", !!s.flipH);
  }
  if (imageControlRefs.flipVBtn) {
    imageControlRefs.flipVBtn.classList.toggle("active", !!s.flipV);
  }
}

/**
 * Apply the transform property (rotation + flips) to the image element.
 * @param {HTMLElement} imgEl
 */
function applyTransform(imgEl) {
  const editableEl = editableRegistry.get(imgEl);
  if (!editableEl) return;
  const s = editableEl.state;
  const scaleX = s.flipH ? -1 : 1;
  const scaleY = s.flipV ? -1 : 1;
  imgEl.style.transform = (scaleX !== 1 || scaleY !== 1)
    ? `scaleX(${scaleX}) scaleY(${scaleY})`
    : "";
}

/**
 * Apply current crop state as clip-path on the image.
 * @param {HTMLElement} imgEl
 */
function applyCrop(imgEl) {
  const editableEl = editableRegistry.get(imgEl);
  if (!editableEl) return;
  const { cropTop: ct, cropRight: cr, cropBottom: cb, cropLeft: cl } = editableEl.state;
  imgEl.style.clipPath = (ct || cr || cb || cl)
    ? `inset(${ct}px ${cr}px ${cb}px ${cl}px)`
    : "";

  if (cropModeActive && editableEl.container) {
    const offset = -6; // matches --editable-handle-offset
    editableEl.container.querySelectorAll(".resize-handle").forEach(handle => {
      const pos = handle.dataset.position;
      handle.style.top    = pos.includes("n") ? `${ct + offset}px` : "";
      handle.style.bottom = pos.includes("s") ? `${cb + offset}px` : "";
      handle.style.left   = pos.includes("w") ? `${cl + offset}px` : "";
      handle.style.right  = pos.includes("e") ? `${cr + offset}px` : "";
    });
  }
}

/**
 * Enter crop mode: intercept the existing corner resize handles so dragging
 * them adjusts crop insets instead of element size.
 */
function enterCropMode() {
  if (!activeImage) return;
  cropModeActive = true;
  if (imageControlRefs.cropBtn) imageControlRefs.cropBtn.classList.add("active");

  const editableEl = editableRegistry.get(activeImage);
  if (!editableEl?.container) return;
  editableEl.container.classList.add("crop-mode");

  applyCrop(activeImage); // position handles to match any existing crop

  editableEl.container.querySelectorAll(".resize-handle").forEach(handle => {
    const listener = (e) => onCropHandleMousedown(e, activeImage);
    handle.addEventListener("mousedown", listener, true); // capture — fires before resize
    cropHandleListeners.set(handle, listener);
  });
}

/**
 * Exit crop mode: restore normal resize behaviour on corner handles.
 */
function exitCropMode() {
  cropModeActive = false;
  if (imageControlRefs.cropBtn) imageControlRefs.cropBtn.classList.remove("active");

  cropHandleListeners.forEach((listener, handle) => {
    handle.removeEventListener("mousedown", listener, true);
  });
  cropHandleListeners.clear();

  if (activeImage) {
    const editableEl = editableRegistry.get(activeImage);
    if (editableEl?.container) {
      editableEl.container.classList.remove("crop-mode");
      editableEl.container.querySelectorAll(".resize-handle").forEach(handle => {
        handle.style.top = "";
        handle.style.bottom = "";
        handle.style.left = "";
        handle.style.right = "";
      });
    }
  }
}

/**
 * Capture-phase mousedown on a corner handle in crop mode.
 * Stops the resize from starting and instead drags crop insets.
 * Corner mapping:
 *   nw → cropTop + cropLeft
 *   ne → cropTop + cropRight
 *   sw → cropBottom + cropLeft
 *   se → cropBottom + cropRight
 * @param {MouseEvent} e
 * @param {HTMLElement} imgEl
 */
function onCropHandleMousedown(e, imgEl) {
  e.stopImmediatePropagation(); // prevent resize capability from firing
  e.preventDefault();

  pushUndoState();

  const pos = e.currentTarget.dataset.position; // 'nw' | 'ne' | 'sw' | 'se'
  const startX = e.clientX;
  const startY = e.clientY;
  const editableEl = editableRegistry.get(imgEl);
  if (!editableEl) return;

  const startCrop = {
    top:    editableEl.state.cropTop,
    right:  editableEl.state.cropRight,
    bottom: editableEl.state.cropBottom,
    left:   editableEl.state.cropLeft,
  };

  // Compute slide scale once so crop deltas match element coordinate space
  const rect = imgEl.getBoundingClientRect();
  const slideScale = rect.width > 0 ? rect.width / imgEl.offsetWidth : 1;

  function onMove(me) {
    const el = editableRegistry.get(imgEl);
    if (!el) return;
    const dx = (me.clientX - startX) / slideScale;
    const dy = (me.clientY - startY) / slideScale;
    const maxW = imgEl.offsetWidth / 2;
    const maxH = imgEl.offsetHeight / 2;

    if (pos.includes("n")) el.state.cropTop    = Math.max(0, Math.min(maxH, startCrop.top    + dy));
    if (pos.includes("s")) el.state.cropBottom = Math.max(0, Math.min(maxH, startCrop.bottom - dy));
    if (pos.includes("w")) el.state.cropLeft   = Math.max(0, Math.min(maxW, startCrop.left   + dx));
    if (pos.includes("e")) el.state.cropRight  = Math.max(0, Math.min(maxW, startCrop.right  - dx));

    applyCrop(imgEl);
  }

  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/**
 * Create the image style controls panel DOM.
 * Uses the same two-row grid layout as the arrow panel:
 * row 1 = label, row 2 = control.
 * @returns {HTMLElement}
 */
export function createImageStyleControls() {
  const container = document.createElement("div");
  container.className = "image-style-controls";

  // Centering wrapper — mirrors .arrow-center-wrap
  const centerWrap = document.createElement("div");
  centerWrap.className = "image-center-wrap";

  // Two-row grid — mirrors .arrow-controls-wrap
  const controlsWrap = document.createElement("div");
  controlsWrap.className = "image-controls-wrap";

  // ── Shared helper: add a labelled cell to the grid ───────────────────────
  // Returns the control container (row 2) for appending the actual widget.
  function addCell(labelText) {
    const label = document.createElement("span");
    label.className = "image-ctrl-label";
    label.textContent = labelText;
    controlsWrap.appendChild(label);   // row 1

    const cell = document.createElement("div");
    cell.className = "image-ctrl-cell";
    controlsWrap.appendChild(cell);    // row 2
    return cell;
  }

  // ── Opacity ──────────────────────────────────────────────────────────────
  const opacityCell = addCell("Opacity");

  const opacitySlider = document.createElement("input");
  opacitySlider.type = "range";
  opacitySlider.min = "0";
  opacitySlider.max = "100";
  opacitySlider.step = "1";
  opacitySlider.value = "100";
  opacitySlider.className = "image-toolbar-opacity";
  opacitySlider.title = "Opacity";

  const opacityLabel = document.createElement("span");
  opacityLabel.className = "image-opacity-label";
  opacityLabel.style.display = "none";

  opacitySlider.addEventListener("mousedown", () => {
    if (activeImage) pushUndoState();
  });
  opacitySlider.addEventListener("input", () => {
    if (!activeImage) return;
    const val = parseInt(opacitySlider.value, 10);
    opacityLabel.textContent = `${val}%`;
    const editableEl = editableRegistry.get(activeImage);
    if (editableEl) {
      editableEl.state.opacity = val;
      activeImage.style.opacity = val / 100;
    }
  });

  imageControlRefs.opacitySlider = opacitySlider;
  imageControlRefs.opacityLabel = opacityLabel;
  opacityCell.appendChild(opacitySlider);
  opacityCell.appendChild(opacityLabel);

  // ── Border radius ────────────────────────────────────────────────────────
  const radiusCell = addCell("Radius");

  const borderRadiusInput = document.createElement("input");
  borderRadiusInput.type = "number";
  borderRadiusInput.min = "0";
  borderRadiusInput.step = "1";
  borderRadiusInput.value = "0";
  borderRadiusInput.className = "image-toolbar-btn image-toolbar-radius";
  borderRadiusInput.title = "Border radius (px)";

  borderRadiusInput.addEventListener("focus", () => {
    if (activeImage) pushUndoState();
  });
  borderRadiusInput.addEventListener("input", () => {
    if (!activeImage) return;
    const val = Math.max(0, parseInt(borderRadiusInput.value, 10) || 0);
    const editableEl = editableRegistry.get(activeImage);
    if (editableEl) {
      editableEl.state.borderRadius = val;
      activeImage.style.borderRadius = val ? `${val}px` : "";
    }
  });

  imageControlRefs.borderRadiusInput = borderRadiusInput;
  radiusCell.appendChild(borderRadiusInput);

  // ── Crop ─────────────────────────────────────────────────────────────────
  const cropCell = addCell("Crop");
  const cropBtn = document.createElement("button");
  cropBtn.className = "image-toolbar-btn";
  cropBtn.textContent = "✂";
  cropBtn.title = "Toggle crop mode — drag edge handles to crop";
  cropBtn.addEventListener("click", () => {
    if (!activeImage) return;
    if (cropModeActive) {
      exitCropMode();
    } else {
      enterCropMode();
    }
  });
  imageControlRefs.cropBtn = cropBtn;
  cropCell.appendChild(cropBtn);

  // ── Flip ─────────────────────────────────────────────────────────────────
  const flipCell = addCell("Flip");
  const flipWrap = document.createElement("div");
  flipWrap.className = "image-btn-group";

  const flipHBtn = document.createElement("button");
  flipHBtn.className = "image-toolbar-btn";
  flipHBtn.textContent = "⇆";
  flipHBtn.title = "Flip horizontal";
  flipHBtn.addEventListener("click", () => {
    if (!activeImage) return;
    pushUndoState();
    const editableEl = editableRegistry.get(activeImage);
    if (!editableEl) return;
    editableEl.state.flipH = !editableEl.state.flipH;
    flipHBtn.classList.toggle("active", editableEl.state.flipH);
    applyTransform(activeImage);
  });
  imageControlRefs.flipHBtn = flipHBtn;

  const flipVBtn = document.createElement("button");
  flipVBtn.className = "image-toolbar-btn";
  flipVBtn.textContent = "⇅";
  flipVBtn.title = "Flip vertical";
  flipVBtn.addEventListener("click", () => {
    if (!activeImage) return;
    pushUndoState();
    const editableEl = editableRegistry.get(activeImage);
    if (!editableEl) return;
    editableEl.state.flipV = !editableEl.state.flipV;
    flipVBtn.classList.toggle("active", editableEl.state.flipV);
    applyTransform(activeImage);
  });
  imageControlRefs.flipVBtn = flipVBtn;

  flipWrap.appendChild(flipHBtn);
  flipWrap.appendChild(flipVBtn);
  flipCell.appendChild(flipWrap);

  // ── Replace image ────────────────────────────────────────────────────────
  const replaceCell = addCell("Replace");

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";

  const replaceBtn = document.createElement("button");
  replaceBtn.className = "image-toolbar-btn";
  replaceBtn.textContent = "Replace";
  replaceBtn.title = "Replace image source";
  replaceBtn.addEventListener("click", () => {
    if (activeImage) fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file || !activeImage) return;
    pushUndoState();
    const editableEl = editableRegistry.get(activeImage);
    if (editableEl) editableEl.state.src = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const tmp = new Image();
      tmp.onload = () => {
        const img = activeImage;
        const el = editableRegistry.get(img);
        if (!el) return;
        const currentWidth = el.state.width;
        const newHeight = Math.round(currentWidth * tmp.naturalHeight / tmp.naturalWidth);
        el.state.height = newHeight;
        img.style.height = `${newHeight}px`;
        if (el.container) el.container.style.height = `${newHeight}px`;
      };
      tmp.src = dataUrl;
      activeImage.src = dataUrl;
      showReplaceWarning(`Place "${file.name}" next to your QMD file.`, replaceBtn);
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  });

  replaceCell.appendChild(replaceBtn);
  replaceCell.appendChild(fileInput);

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetCell = addCell("");

  const resetBtn = document.createElement("button");
  resetBtn.className = "image-toolbar-btn image-toolbar-reset";
  resetBtn.textContent = "Reset";
  resetBtn.title = "Reset image style properties";
  resetBtn.addEventListener("click", () => {
    if (!activeImage) return;
    pushUndoState();
    const editableEl = editableRegistry.get(activeImage);
    if (!editableEl) return;
    editableEl.state.opacity = 100;
    editableEl.state.borderRadius = 0;
    editableEl.state.cropTop = 0;
    editableEl.state.cropRight = 0;
    editableEl.state.cropBottom = 0;
    editableEl.state.cropLeft = 0;
    editableEl.state.flipH = false;
    editableEl.state.flipV = false;
    activeImage.style.opacity = "";
    activeImage.style.borderRadius = "";
    activeImage.style.clipPath = "";
    activeImage.style.transform = "";
    exitCropMode();
    updateImageStylePanel(activeImage);
  });
  resetCell.appendChild(resetBtn);

  centerWrap.appendChild(controlsWrap);
  container.appendChild(centerWrap);

  return container;
}
