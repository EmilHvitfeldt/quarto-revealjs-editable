/**
 * Top bar toolbar for save, copy, and add actions.
 * @module toolbar
 */

import { ToolbarRegistry } from './registries.js';

/**
 * Create the fixed top bar toolbar with actions from ToolbarRegistry.
 * @returns {HTMLElement} The toolbar element
 */
export function createFloatingToolbar() {
  // Check if toolbar already exists
  if (document.getElementById("editable-toolbar")) {
    return document.getElementById("editable-toolbar");
  }

  // Create toolbar container
  const toolbar = document.createElement("div");
  toolbar.id = "editable-toolbar";
  toolbar.className = "editable-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Editable tools");

  // Title label at the far left
  const title = document.createElement("span");
  title.className = "editable-toolbar-title";
  title.textContent = "Editable";
  toolbar.appendChild(title);

  // Create buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "editable-toolbar-buttons";

  // Add buttons from registry
  ToolbarRegistry.getActions().forEach((action) => {
    let element;
    if (action.submenu) {
      // Create button with submenu
      element = ToolbarRegistry.createSubmenuButton(action);
    } else {
      // Create regular button
      element = ToolbarRegistry.createButton(action);
    }
    buttonsContainer.appendChild(element);
  });

  toolbar.appendChild(buttonsContainer);

  // Add to document
  document.body.appendChild(toolbar);

  // Trigger reveal.js relayout to account for the 100px top bar
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });

  return toolbar;
}
