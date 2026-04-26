/**
 * Image context panel for the top bar toolbar.
 * Shown when an image element is selected; mirrors the arrow panel pattern.
 * @module images
 */

import { pushUndoState } from './undo.js';
import { editableRegistry } from './editable-element.js';
import { showRightPanel } from './toolbar.js';

/** @type {HTMLElement|null} The currently active image element */
export let activeImage = null;

/** Cached references to control inputs for fast sync */
export const imageControlRefs = {
  opacitySlider: null,
  opacityLabel: null,
  borderRadiusInput: null,
  objectFitBtns: {},
  flipHBtn: null,
  flipVBtn: null,
};

/**
 * Set the active image and sync the panel controls to its current state.
 * @param {HTMLElement|null} imgEl
 */
export function setActiveImage(imgEl) {
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

  const objectFit = s.objectFit ?? null;
  Object.entries(imageControlRefs.objectFitBtns).forEach(([fit, btn]) => {
    btn.classList.toggle("active", fit === objectFit);
  });

  if (imageControlRefs.flipHBtn) {
    imageControlRefs.flipHBtn.classList.toggle("active", !!s.flipH);
  }
  if (imageControlRefs.flipVBtn) {
    imageControlRefs.flipVBtn.classList.toggle("active", !!s.flipV);
  }
}

/**
 * Apply the transform property (rotation + flips) to the element's container.
 * Flips are applied to the element itself (not the container) to avoid
 * interfering with position-based rotation on the container.
 * @param {HTMLElement} imgEl
 */
function applyTransform(imgEl) {
  const editableEl = editableRegistry.get(imgEl);
  if (!editableEl) return;
  const s = editableEl.state;
  const scaleX = s.flipH ? -1 : 1;
  const scaleY = s.flipV ? -1 : 1;
  if (scaleX === 1 && scaleY === 1) {
    imgEl.style.transform = "";
  } else {
    imgEl.style.transform = `scaleX(${scaleX}) scaleY(${scaleY})`;
  }
}

/**
 * Create the image style controls panel DOM.
 * @returns {HTMLElement}
 */
export function createImageStyleControls() {
  const container = document.createElement("div");
  container.className = "image-style-controls";

  // ── Shared helper: labelled control group ────────────────────────────────
  function makeGroup(labelText) {
    const group = document.createElement("div");
    group.className = "image-controls-group";
    const label = document.createElement("span");
    label.className = "image-controls-label";
    label.textContent = labelText;
    group.appendChild(label);
    return group;
  }

  // ── Opacity ──────────────────────────────────────────────────────────────
  const opacityGroup = makeGroup("Opacity");

  const opacitySlider = document.createElement("input");
  opacitySlider.type = "range";
  opacitySlider.min = "0";
  opacitySlider.max = "100";
  opacitySlider.step = "1";
  opacitySlider.value = "100";
  opacitySlider.className = "image-opacity-slider";
  opacitySlider.title = "Opacity";

  const opacityLabel = document.createElement("span");
  opacityLabel.className = "image-opacity-label";
  opacityLabel.textContent = "100%";

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

  opacityGroup.appendChild(opacitySlider);
  opacityGroup.appendChild(opacityLabel);
  container.appendChild(opacityGroup);

  // ── Border radius ────────────────────────────────────────────────────────
  const radiusGroup = makeGroup("Radius");

  const borderRadiusInput = document.createElement("input");
  borderRadiusInput.type = "number";
  borderRadiusInput.min = "0";
  borderRadiusInput.step = "1";
  borderRadiusInput.value = "0";
  borderRadiusInput.className = "image-border-radius-input";
  borderRadiusInput.title = "Border radius (px)";

  const radiusPxLabel = document.createElement("span");
  radiusPxLabel.className = "image-controls-unit";
  radiusPxLabel.textContent = "px";

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

  radiusGroup.appendChild(borderRadiusInput);
  radiusGroup.appendChild(radiusPxLabel);
  container.appendChild(radiusGroup);

  // ── Object fit ───────────────────────────────────────────────────────────
  const fitGroup = makeGroup("Fit");

  const fitWrap = document.createElement("div");
  fitWrap.className = "image-fit-toggle";

  ["cover", "contain", "fill"].forEach(fit => {
    const btn = document.createElement("button");
    btn.className = "image-fit-btn";
    btn.textContent = fit.charAt(0).toUpperCase() + fit.slice(1);
    btn.title = `Object fit: ${fit}`;
    btn.addEventListener("click", () => {
      if (!activeImage) return;
      pushUndoState();
      const editableEl = editableRegistry.get(activeImage);
      if (!editableEl) return;
      const isSame = editableEl.state.objectFit === fit;
      const newFit = isSame ? null : fit;
      editableEl.state.objectFit = newFit;
      activeImage.style.objectFit = newFit ?? "";
      Object.values(imageControlRefs.objectFitBtns).forEach(b => b.classList.remove("active"));
      if (!isSame) btn.classList.add("active");
    });
    imageControlRefs.objectFitBtns[fit] = btn;
    fitWrap.appendChild(btn);
  });

  fitGroup.appendChild(fitWrap);
  container.appendChild(fitGroup);

  // ── Flip ─────────────────────────────────────────────────────────────────
  const flipGroup = makeGroup("Flip");

  const flipWrap = document.createElement("div");
  flipWrap.className = "image-flip-toggle";

  const flipHBtn = document.createElement("button");
  flipHBtn.className = "image-flip-btn";
  flipHBtn.textContent = "⇆ H";
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
  flipVBtn.className = "image-flip-btn";
  flipVBtn.textContent = "⇅ V";
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
  flipGroup.appendChild(flipWrap);
  container.appendChild(flipGroup);

  // ── Replace image ────────────────────────────────────────────────────────
  const replaceGroup = makeGroup("Replace");

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";

  const replaceBtn = document.createElement("button");
  replaceBtn.className = "image-replace-btn";
  replaceBtn.textContent = "Replace";
  replaceBtn.title = "Replace image source";
  replaceBtn.addEventListener("click", () => {
    if (activeImage) fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file || !activeImage) return;
    pushUndoState();
    const reader = new FileReader();
    reader.onload = (e) => {
      activeImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  });

  replaceGroup.appendChild(replaceBtn);
  replaceGroup.appendChild(fileInput);
  container.appendChild(replaceGroup);

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetGroup = makeGroup("");

  const resetBtn = document.createElement("button");
  resetBtn.className = "image-reset-btn";
  resetBtn.textContent = "Reset";
  resetBtn.title = "Reset image style properties";
  resetBtn.addEventListener("click", () => {
    if (!activeImage) return;
    pushUndoState();
    const editableEl = editableRegistry.get(activeImage);
    if (!editableEl) return;
    editableEl.state.opacity = 100;
    editableEl.state.borderRadius = 0;
    editableEl.state.objectFit = null;
    editableEl.state.flipH = false;
    editableEl.state.flipV = false;
    activeImage.style.opacity = "";
    activeImage.style.borderRadius = "";
    activeImage.style.objectFit = "";
    activeImage.style.transform = "";
    updateImageStylePanel(activeImage);
  });

  resetGroup.appendChild(resetBtn);
  container.appendChild(resetGroup);

  return container;
}
