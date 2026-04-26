/**
 * Reveal.js slide menu integration: save and copy menu items.
 * @module menu
 */

import { saveMovedElts, copyQmdToClipboard } from './io.js';

/**
 * Add save and copy buttons to the Reveal.js slide menu.
 */
export function addSaveMenuButton() {
  const slideMenuItems = document.querySelector(
    "div.slide-menu-custom-panel ul.slide-menu-items"
  );
  if (!slideMenuItems) return;

  const existingItems = slideMenuItems.querySelectorAll("li[data-item]");
  let maxDataItem = 0;
  existingItems.forEach((item) => {
    const v = parseInt(item.getAttribute("data-item")) || 0;
    if (v > maxDataItem) maxDataItem = v;
  });

  function addMenuHoverBehavior(li) {
    li.addEventListener("mouseenter", () => {
      slideMenuItems.querySelectorAll(".slide-tool-item.selected").forEach((el) => {
        el.classList.remove("selected");
      });
      li.classList.add("selected");
    });
    li.addEventListener("mouseleave", () => li.classList.remove("selected"));
  }

  function makeMenuItem(dataItem, kbdText, label, onClick) {
    const li = document.createElement("li");
    li.className = "slide-tool-item";
    li.setAttribute("data-item", dataItem.toString());
    const a = document.createElement("a");
    a.href = "#";
    const kbd = document.createElement("kbd");
    kbd.textContent = kbdText;
    a.appendChild(kbd);
    a.appendChild(document.createTextNode(" " + label));
    a.addEventListener("click", (e) => { e.preventDefault(); onClick(); });
    li.appendChild(a);
    addMenuHoverBehavior(li);
    return li;
  }

  slideMenuItems.appendChild(makeMenuItem(maxDataItem + 1, "?", "Save Edits", saveMovedElts));
  slideMenuItems.appendChild(makeMenuItem(maxDataItem + 2, "c", "Copy qmd to Clipboard", copyQmdToClipboard));
}
