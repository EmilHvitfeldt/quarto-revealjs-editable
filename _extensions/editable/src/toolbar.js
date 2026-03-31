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

/** @type {HTMLElement|null} The right-zone container */
let rightZoneEl = null;

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

  const title = document.createElement("span");
  title.className = "editable-toolbar-title";
  title.textContent = "Editable";
  leftZone.appendChild(title);

  const divider = document.createElement("div");
  divider.className = "editable-toolbar-divider";
  leftZone.appendChild(divider);

  ToolbarRegistry.getActionsForZone("left").forEach(action => {
    leftZone.appendChild(
      action.submenu
        ? ToolbarRegistry.createSubmenuButton(action)
        : ToolbarRegistry.createButton(action)
    );
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

  toolbar.appendChild(rightZone);
  document.body.appendChild(toolbar);

  // Trigger reveal.js relayout to account for the 100px top bar
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });

  return toolbar;
}
