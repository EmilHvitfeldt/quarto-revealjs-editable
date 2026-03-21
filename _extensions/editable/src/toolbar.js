/**
 * Floating toolbar for save, copy, and add actions.
 * @module toolbar
 */

import { ToolbarRegistry } from './registries.js';

/**
 * Create the floating toolbar with actions from ToolbarRegistry.
 * Toolbar is draggable via the handle.
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

  // Create drag handle
  const dragHandle = document.createElement("div");
  dragHandle.className = "editable-toolbar-handle";
  dragHandle.innerHTML = "⋮⋮";
  dragHandle.title = "Drag to move toolbar";
  toolbar.appendChild(dragHandle);

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

  // Make toolbar draggable
  makeToolbarDraggable(toolbar, dragHandle);

  // Add to document
  document.body.appendChild(toolbar);

  return toolbar;
}

/**
 * Make the toolbar draggable via its handle.
 * @param {HTMLElement} toolbar - The toolbar element
 * @param {HTMLElement} handle - The drag handle element
 */
function makeToolbarDraggable(toolbar, handle) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  function startDrag(e) {
    if (e.target !== handle && !handle.contains(e.target)) return;

    isDragging = true;
    handle.style.cursor = "grabbing";

    const rect = toolbar.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;

    if (e.type === "touchstart") {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else {
      startX = e.clientX;
      startY = e.clientY;
    }

    // Switch from right positioning to left positioning
    // Clear the transform that was used for initial centering
    toolbar.style.right = "auto";
    toolbar.style.transform = "none";
    toolbar.style.left = initialX + "px";
    toolbar.style.top = initialY + "px";

    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;

    let clientX, clientY;
    if (e.type === "touchmove") {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    toolbar.style.left = (initialX + deltaX) + "px";
    toolbar.style.top = (initialY + deltaY) + "px";
  }

  function stopDrag() {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = "grab";
    }
  }

  handle.addEventListener("mousedown", startDrag);
  handle.addEventListener("touchstart", startDrag);
  document.addEventListener("mousemove", drag);
  document.addEventListener("touchmove", drag);
  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("touchend", stopDrag);
}
