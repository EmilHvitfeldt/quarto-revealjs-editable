/**
 * Top bar toolbar with left (persistent) and right (contextual) zones.
 *
 * Left zone: title + save + copy — always visible.
 * Right zone: swappable panels.
 *   - "default" panel: Add + Modify (shown when nothing is selected)
 *   - "arrow"   panel: arrow style controls (shown when an arrow is selected)
 *   - future panels: image controls, etc.
 *
 * @module toolbar
 */

import { ToolbarRegistry } from './registries.js';
import { createImageStyleControls } from './images.js';

/** @type {HTMLElement|null} The right-zone container */
let rightZoneEl = null;

/** @type {HTMLElement|null} The text panel container (populated by registries.js on first edit) */
export let textPanelEl = null;

/** @type {HTMLElement[]} Elements to hide when a context panel is active */
const contextHideElements = [];

/**
 * Switch the visible panel in the right zone.
 * All panels are hidden except the one matching panelName.
 * @param {string} panelName - e.g. 'default', 'arrow'
 */
export function showRightPanel(panelName) {
  if (!rightZoneEl) return;
  rightZoneEl.querySelectorAll('.toolbar-panel').forEach(panel => {
    panel.style.display = panel.classList.contains(`toolbar-panel-${panelName}`) ? '' : 'none';
  });
  const isContext = panelName !== 'default';
  contextHideElements.forEach(el => {
    el.style.display = isContext ? 'none' : '';
  });
}

/**
 * Create the fixed top bar toolbar.
 * @returns {HTMLElement} The toolbar element
 */
export function createFloatingToolbar() {
  if (document.getElementById("editable-toolbar")) {
    return document.getElementById("editable-toolbar");
  }

  const toolbar = document.createElement("div");
  toolbar.id = "editable-toolbar";
  toolbar.className = "editable-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Editable tools");

  // ── Left zone ─────────────────────────────────────────────────────────────
  const leftZone = document.createElement("div");
  leftZone.className = "editable-toolbar-left";

  const leftButtonStack = document.createElement("div");
  leftButtonStack.className = "editable-toolbar-button-stack";
  const unstackedButtons = [];
  ToolbarRegistry.getActionsForZone("left").forEach(action => {
    const btn = action.submenu
      ? ToolbarRegistry.createSubmenuButton(action)
      : ToolbarRegistry.createButton(action);
    if (action.stacked === false) {
      unstackedButtons.push({ btn, action });
    } else {
      leftButtonStack.appendChild(btn);
    }
  });
  contextHideElements.push(leftButtonStack);
  leftZone.appendChild(leftButtonStack);
  unstackedButtons.forEach(({ btn, action }) => {
    leftZone.appendChild(btn);
    if (action.hideOnContext) contextHideElements.push(btn);
  });

  toolbar.appendChild(leftZone);

  // ── Right zone ────────────────────────────────────────────────────────────
  const rightZone = document.createElement("div");
  rightZone.className = "editable-toolbar-right";
  rightZoneEl = rightZone;

  // Default panel: shown when no element is selected
  const defaultPanel = document.createElement("div");
  defaultPanel.className = "toolbar-panel toolbar-panel-default";
  ToolbarRegistry.getActionsForZone("right").forEach(action => {
    defaultPanel.appendChild(
      action.submenu
        ? ToolbarRegistry.createSubmenuButton(action)
        : ToolbarRegistry.createButton(action)
    );
  });
  rightZone.appendChild(defaultPanel);

  // Arrow panel: empty container, populated by arrows.js on first selection
  const arrowPanel = document.createElement("div");
  arrowPanel.className = "toolbar-panel toolbar-panel-arrow";
  arrowPanel.style.display = "none";
  rightZone.appendChild(arrowPanel);

  // Image panel: shown when an image element is selected
  const imagePanel = document.createElement("div");
  imagePanel.className = "toolbar-panel toolbar-panel-image";
  imagePanel.style.display = "none";
  imagePanel.appendChild(createImageStyleControls());
  rightZone.appendChild(imagePanel);

  // Text panel: holds the active Quill toolbar when a div is in edit mode
  const textPanel = document.createElement("div");
  textPanel.className = "toolbar-panel toolbar-panel-text";
  textPanel.style.display = "none";
  rightZone.appendChild(textPanel);
  textPanelEl = textPanel;

  // Modify panel: shown when modify mode is active; lists activatable element types
  const modifyPanel = document.createElement("div");
  modifyPanel.className = "toolbar-panel toolbar-panel-modify";
  modifyPanel.style.display = "none";
  rightZone.appendChild(modifyPanel);

  toolbar.appendChild(rightZone);
  document.body.appendChild(toolbar);
  document.documentElement.classList.add("has-editable-toolbar");

  // Trigger reveal.js relayout to account for the 100px top bar
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });

  return toolbar;
}
