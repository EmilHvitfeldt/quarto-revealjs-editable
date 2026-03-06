// ─── Floating dirty-state toolbar ────────────────────────────────────────────

(function () {
  var toolbar = null;
  var hideTimer = null;

  function createToolbar() {
    if (document.getElementById('editable-toolbar')) return;

    var t = document.createElement('div');
    t.id = 'editable-toolbar';
    t.style.cssText = [
      'position: fixed',
      'bottom: 0',
      'left: 0',
      'right: 0',
      'height: 48px',
      'background: rgba(10, 10, 20, 0.78)',
      'backdrop-filter: blur(12px)',
      '-webkit-backdrop-filter: blur(12px)',
      'border-top: 1px solid rgba(255,255,255,0.07)',
      'display: flex',
      'align-items: center',
      'padding: 0 20px',
      'gap: 10px',
      'z-index: 9999',
      'transform: translateY(100%)',
      'transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      'font-family: ui-monospace, "SF Mono", monospace',
      'font-size: 12px',
    ].join(';');

    // dot
    var dot = document.createElement('span');
    dot.id = 'editable-toolbar-dot';
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#e0c36a;display:inline-block;flex-shrink:0;transition:background 0.4s ease';

    // label
    var label = document.createElement('span');
    label.id = 'editable-toolbar-label';
    label.style.cssText = 'color:#bdbdbd;letter-spacing:0.06em;flex:1;';
    label.textContent = 'unsaved changes';

    // dismiss button
    var dismiss = document.createElement('button');
    dismiss.textContent = '×';
    dismiss.style.cssText = 'background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 6px;line-height:1;';
    dismiss.title = 'Dismiss';
    dismiss.addEventListener('click', function () { hideToolbar(); });

    // copy button
    var btnCopy = document.createElement('button');
    btnCopy.id = 'editable-toolbar-copy';
    btnCopy.textContent = '📋 Copy to clipboard';
    btnCopy.style.cssText = 'background:#007cba;border:none;color:white;font-size:12px;font-family:inherit;padding:0 14px;height:30px;border-radius:3px;cursor:pointer;letter-spacing:0.04em;';
    btnCopy.addEventListener('mouseenter', function() { this.style.background='#0090d4'; });
    btnCopy.addEventListener('mouseleave', function() { this.style.background='#007cba'; });
    btnCopy.addEventListener('click', function (e) { e.preventDefault(); copyQmdToClipboard(); });

    // save button
    var btnSave = document.createElement('button');
    btnSave.id = 'editable-toolbar-save';
    btnSave.textContent = '💾 Save edits';
    btnSave.style.cssText = 'background:#da7756;border:none;color:white;font-size:12px;font-family:inherit;padding:0 16px;height:30px;border-radius:3px;cursor:pointer;letter-spacing:0.04em;';
    btnSave.addEventListener('mouseenter', function() { this.style.background='#e08868'; });
    btnSave.addEventListener('mouseleave', function() { this.style.background='#da7756'; });
    btnSave.addEventListener('click', function (e) { e.preventDefault(); saveMovedElts(); });

    t.appendChild(dot);
    t.appendChild(label);
    t.appendChild(dismiss);
    t.appendChild(btnCopy);
    t.appendChild(btnSave);
    document.body.appendChild(t);
    toolbar = t;
  }

  function showToolbar() {
    createToolbar();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    // reset to dirty state
    var dot = document.getElementById('editable-toolbar-dot');
    var label = document.getElementById('editable-toolbar-label');
    if (dot) dot.style.background = '#e0c36a';
    if (label) label.textContent = 'unsaved changes';
    // slide in
    setTimeout(function () {
      toolbar.style.transform = 'translateY(0)';
    }, 10);
  }

  function hideToolbar() {
    if (!toolbar) return;
    toolbar.style.transform = 'translateY(100%)';
  }

  function showSavedFeedback(type) {
    if (!toolbar) return;
    var dot = document.getElementById('editable-toolbar-dot');
    var label = document.getElementById('editable-toolbar-label');
    if (dot) dot.style.background = '#4caf82';
    if (label) {
      if (type === 'copy') {
        label.textContent = 'copied! → paste into your .qmd to apply changes';
      } else {
        label.textContent = 'downloaded! → replace your original .qmd if satisfied';
      }
    }
    hideTimer = setTimeout(function () { hideToolbar(); }, 3500);
  }

  // Expose globally
  window._editableToolbar = {
    show: showToolbar,
    showSaved: showSavedFeedback,
    hide: hideToolbar,
  };
})();

// ─────────────────────────────────────────────────────────────────────────────

window.Revealeditable = function () {
  return {
    id: "Revealeditable",
    init: function (deck) {
      document.addEventListener("DOMContentLoaded", function () {
        const editableElements = getEditableElements();

        editableElements.forEach(setupDraggableElt);

        addSaveMenuButton();
      });
    },
  };
};

function addSaveMenuButton() {
  const slideMenuItems = document.querySelector(
    "div.slide-menu-custom-panel ul.slide-menu-items"
  );

  if (slideMenuItems) {
    const existingItems = slideMenuItems.querySelectorAll("li[data-item]");
    let maxDataItem = 0;
    existingItems.forEach((item) => {
      const dataValue = parseInt(item.getAttribute("data-item")) || 0;
      if (dataValue > maxDataItem) {
        maxDataItem = dataValue;
      }
    });

    const newLi = document.createElement("li");
    newLi.className = "slide-menu-item";
    newLi.setAttribute("data-item", (maxDataItem + 1).toString());

    const newA = document.createElement("a");
    newA.href = "#";
    const kbd = document.createElement("kbd");
    kbd.textContent = "?";
    newA.appendChild(kbd);
    newA.appendChild(document.createTextNode(" Save Edits"));
    newA.addEventListener("click", function (e) {
      e.preventDefault();
      saveMovedElts();
    });
    newLi.appendChild(newA);

    slideMenuItems.appendChild(newLi);

    // Add "Copy qmd to clipboard" button
    const copyLi = document.createElement("li");
    copyLi.className = "slide-tool-item";
    copyLi.setAttribute("data-item", (maxDataItem + 2).toString());

    const copyA = document.createElement("a");
    copyA.href = "#";
    const copyKbd = document.createElement("kbd");
    copyKbd.textContent = "c";
    copyA.appendChild(copyKbd);
    copyA.appendChild(document.createTextNode(" Copy qmd to Clipboard"));
    copyA.addEventListener("click", function (e) {
      e.preventDefault();
      copyQmdToClipboard();
    });
    copyLi.appendChild(copyA);

    slideMenuItems.appendChild(copyLi);
  }
}

function getEditableElements() {
  return document.querySelectorAll("img.editable, div.editable");
}

function getEditableDivs() {
  return document.querySelectorAll("div.editable");
}

function setupDraggableElt(elt) {
  let isDragging = false;
  let isResizing = false;
  let startX, startY, initialX, initialY, initialWidth, initialHeight;
  let resizeHandle = null;

  const container = createEltContainer(elt);
  setupEltStyles(elt);
  createResizeHandles(container);
  setupHoverEffects(
    container,
    () => isDragging,
    () => isResizing
  );
  attachEventListeners();

  function createEltContainer(elt) {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.display = "inline-block";
    container.style.border = "2px solid transparent";
    elt.parentNode.insertBefore(container, elt);
    container.appendChild(elt);
    return container;
  }

  function setupEltStyles(elt) {
    elt.style.cursor = "move";
    elt.style.position = "relative";
    elt.style.width = (elt.naturalWidth || elt.offsetWidth) / 2 + "px";
    elt.style.height = (elt.naturalHeight || elt.offsetHeight) / 2 + "px";
    elt.style.display = "block";
  }

  function createResizeHandles(container) {
    const handles = ["nw", "ne", "sw", "se"];
    handles.forEach((position) => {
      const handle = document.createElement("div");
      handle.className = "resize-handle";
      handle.style.position = "absolute";
      handle.style.width = "10px";
      handle.style.height = "10px";
      handle.style.backgroundColor = "#007cba";
      handle.style.border = "1px solid #fff";
      handle.style.cursor = position + "-resize";
      handle.style.opacity = "0";
      handle.style.transition = "opacity 0.2s";

      if (position.includes("n")) handle.style.top = "-6px";
      if (position.includes("s")) handle.style.bottom = "-6px";
      if (position.includes("w")) handle.style.left = "-6px";
      if (position.includes("e")) handle.style.right = "-6px";

      handle.dataset.position = position;
      container.appendChild(handle);
    });

    if (elt.tagName.toLowerCase() === "div") {
      const fontControls = document.createElement("div");
      fontControls.className = "font-controls";
      fontControls.style.position = "absolute";
      fontControls.style.top = "-30px";
      fontControls.style.left = "0";
      fontControls.style.opacity = "0";
      fontControls.style.transition = "opacity 0.2s";
      fontControls.style.display = "flex";
      fontControls.style.gap = "5px";

      const decreaseBtn = createButton("A-", "24px", "4px 12px");
      decreaseBtn.style.marginRight = "0";

      const increaseBtn = createButton("A+", "24px", "4px 12px");
      increaseBtn.style.marginRight = "10px";

      const alignLeftBtn = createButton("⇤", "20px", "4px 12px");
      alignLeftBtn.title = "Align Left";

      const alignCenterBtn = createButton("⇔", "20px", "4px 12px");
      alignCenterBtn.title = "Align Center";

      const alignRightBtn = createButton("⇥", "20px", "4px 12px");
      alignRightBtn.title = "Align Right";

      const editBtn = createButton("✎", "20px", "4px 12px");
      editBtn.style.marginLeft = "10px";
      editBtn.title = "Toggle Edit Mode";

      fontControls.appendChild(decreaseBtn);
      fontControls.appendChild(increaseBtn);
      fontControls.appendChild(alignLeftBtn);
      fontControls.appendChild(alignCenterBtn);
      fontControls.appendChild(alignRightBtn);
      fontControls.appendChild(editBtn);
      container.appendChild(fontControls);

      decreaseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        changeFontSize(elt, -2);
      });

      increaseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        changeFontSize(elt, 2);
      });

      alignLeftBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        elt.style.textAlign = "left";
      });

      alignCenterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        elt.style.textAlign = "center";
      });

      alignRightBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        elt.style.textAlign = "right";
      });

      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isEditable = elt.contentEditable === "true";
        elt.contentEditable = !isEditable;
        editBtn.style.backgroundColor = !isEditable ? "#28a745" : "#007cba";
        editBtn.title = !isEditable ? "Exit Edit Mode" : "Toggle Edit Mode";
        if (!isEditable) {
          elt.focus();
          // Show dirty toolbar on any text input while in edit mode
          elt.addEventListener("input", function () {
            window._editableToolbar.show();
          }, { once: false });
        }
      });
    }
  }

  function setupHoverEffects(container, isDraggingFn, isResizingFn) {
    container.addEventListener("mouseenter", () => {
      container.style.border = "2px solid #007cba";
      container
        .querySelectorAll(".resize-handle")
        .forEach((h) => (h.style.opacity = "1"));
      const fontControls = container.querySelector(".font-controls");
      if (fontControls) fontControls.style.opacity = "1";
    });

    container.addEventListener("mouseleave", () => {
      if (!isDraggingFn() && !isResizingFn()) {
        container.style.border = "2px solid transparent";
        container
          .querySelectorAll(".resize-handle")
          .forEach((h) => (h.style.opacity = "0"));
        const fontControls = container.querySelector(".font-controls");
        if (fontControls) fontControls.style.opacity = "0";
      }
    });
  }

  function attachEventListeners() {
    elt.addEventListener("mousedown", startDrag);
    elt.addEventListener("touchstart", startDrag);

    container.querySelectorAll(".resize-handle").forEach((handle) => {
      handle.addEventListener("mousedown", startResize);
      handle.addEventListener("touchstart", startResize);
    });

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopAction);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", stopAction);
  }

  function getClientCoordinates(e) {
    const isTouch = e.type.startsWith("touch");
    const slidesContainerEl = document.querySelector(".slides");
    const scale = window
      .getComputedStyle(slidesContainerEl)
      .getPropertyValue("--slide-scale");

    return {
      clientX: (isTouch ? e.touches[0].clientX : e.clientX) / scale,
      clientY: (isTouch ? e.touches[0].clientY : e.clientY) / scale,
    };
  }

  function startDrag(e) {
    if (e.target.parentElement.contentEditable == "true") return;
    if (e.target.classList.contains("resize-handle")) return;

    isDragging = true;
    const { clientX, clientY } = getClientCoordinates(e);

    startX = clientX;
    startY = clientY;
    initialX = container.offsetLeft;
    initialY = container.offsetTop;

    e.preventDefault();
  }

  function startResize(e) {
    isResizing = true;
    resizeHandle = e.target.dataset.position;

    const { clientX, clientY } = getClientCoordinates(e);

    startX = clientX;
    startY = clientY;
    initialWidth = elt.offsetWidth;
    initialHeight = elt.offsetHeight;
    initialX = container.offsetLeft;
    initialY = container.offsetTop;

    e.preventDefault();
    e.stopPropagation();
  }

  function handleMouseMove(e) {
    if (isDragging) {
      drag(e);
    } else if (isResizing) {
      resize(e);
    }
  }

  function handleTouchMove(e) {
    if (isDragging) {
      drag(e);
    } else if (isResizing) {
      resize(e);
    }
  }

  function drag(e) {
    if (!isDragging) return;

    const { clientX, clientY } = getClientCoordinates(e);
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    container.style.left = initialX + deltaX + "px";
    container.style.top = initialY + deltaY + "px";

    e.preventDefault();
  }

  function resize(e) {
    if (!isResizing) return;

    const { clientX, clientY } = getClientCoordinates(e);
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    let newWidth = initialWidth;
    let newHeight = initialHeight;
    let newX = initialX;
    let newY = initialY;

    const preserveAspectRatio = e.shiftKey;
    const aspectRatio = initialWidth / initialHeight;

    if (preserveAspectRatio) {
      if (resizeHandle.includes("e") || resizeHandle.includes("w")) {
        const widthChange = resizeHandle.includes("e") ? deltaX : -deltaX;
        newWidth = Math.max(50, initialWidth + widthChange);
        newHeight = newWidth / aspectRatio;
      } else if (resizeHandle.includes("s") || resizeHandle.includes("n")) {
        const heightChange = resizeHandle.includes("s") ? deltaY : -deltaY;
        newHeight = Math.max(50, initialHeight + heightChange);
        newWidth = newHeight * aspectRatio;
      }

      if (resizeHandle.includes("w")) {
        newX = initialX + (initialWidth - newWidth);
      }
      if (resizeHandle.includes("n")) {
        newY = initialY + (initialHeight - newHeight);
      }
    } else {
      if (resizeHandle.includes("e")) {
        newWidth = Math.max(50, initialWidth + deltaX);
      }
      if (resizeHandle.includes("w")) {
        newWidth = Math.max(50, initialWidth - deltaX);
        newX = initialX + (initialWidth - newWidth);
      }
      if (resizeHandle.includes("s")) {
        newHeight = Math.max(50, initialHeight + deltaY);
      }
      if (resizeHandle.includes("n")) {
        newHeight = Math.max(50, initialHeight - deltaY);
        newY = initialY + (initialHeight - newHeight);
      }
    }

    elt.style.width = newWidth + "px";
    elt.style.height = newHeight + "px";
    container.style.left = newX + "px";
    container.style.top = newY + "px";

    e.preventDefault();
  }

  function stopAction() {
    if (isDragging || isResizing) {
      // Show dirty toolbar when a drag or resize ends
      window._editableToolbar.show();
      setTimeout(() => {
        if (!container.matches(":hover")) {
          container.style.border = "2px solid transparent";
          container
            .querySelectorAll(".resize-handle")
            .forEach((h) => (h.style.opacity = "0"));
          const fontControls = container.querySelector(".font-controls");
          if (fontControls) fontControls.style.opacity = "0";
        }
      }, 500);
    }

    isDragging = false;
    isResizing = false;
    resizeHandle = null;
  }

  function changeFontSize(element, delta) {
    const currentFontSize =
      parseFloat(window.getComputedStyle(element).fontSize) || 16;
    const newFontSize = Math.max(8, currentFontSize + delta);
    element.style.fontSize = newFontSize + "px";
  }

  function createButton(text, fontSize, padding) {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.fontSize = fontSize;
    button.style.padding = padding;
    button.style.backgroundColor = "#007cba";
    button.style.color = "white";
    button.style.border = "none";
    button.style.cursor = "pointer";
    button.style.borderRadius = "3px";
    return button;
  }
}

function saveMovedElts() {
  let index = readIndexQmd();
  Elt_dim = extracteditableEltDimensions();

  index = udpdateTextDivs(index);

  Elt_attr = formateditableEltStrings(Elt_dim);
  index = replaceeditableOccurrences(index, Elt_attr);

  downloadString(index);
  window._editableToolbar.showSaved('save');
}

// Function to read index.qmd file (decoded from base64 by atob() at load time)
function readIndexQmd() {
  return window._input_file;
}

// Function to copy the modified qmd content to clipboard (closes #8)
function copyQmdToClipboard() {
  let index = readIndexQmd();
  Elt_dim = extracteditableEltDimensions();

  index = udpdateTextDivs(index);

  Elt_attr = formateditableEltStrings(Elt_dim);
  index = replaceeditableOccurrences(index, Elt_attr);

  navigator.clipboard.writeText(index).then(function () {
    console.log("qmd content copied to clipboard");
    window._editableToolbar.showSaved('copy');
  }).catch(function (err) {
    console.error("Failed to copy to clipboard:", err);
  });
}

// Function to get data-filename attribute from editable div
function geteditableFilename() {
  return window._input_filename.split(/[/\\]/).pop();
}

// Function to extract width and height of Elts with editable id
function extracteditableEltDimensions() {
  const editableElements = getEditableElements();
  const dimensions = [];

  editableElements.forEach((elt, index) => {
    const width = elt.style.width
      ? parseFloat(elt.style.width)
      : elt.offsetWidth;
    const height = elt.style.height
      ? parseFloat(elt.style.height)
      : elt.offsetHeight;

    const parentContainer = elt.parentNode;
    const left = parentContainer.style.left
      ? parseFloat(parentContainer.style.left)
      : parentContainer.offsetLeft;
    const top = parentContainer.style.top
      ? parseFloat(parentContainer.style.top)
      : parentContainer.offsetTop;

    const dimensionData = {
      width: width,
      height: height,
      left: left,
      top: top,
    };

    if (elt.tagName.toLowerCase() === "div" && elt.style.fontSize) {
      dimensionData.fontSize = parseFloat(elt.style.fontSize);
    }
    if (elt.tagName.toLowerCase() === "div" && elt.style.textAlign) {
      dimensionData.textAlign = elt.style.textAlign;
    }

    dimensions.push(dimensionData);
  });

  return dimensions;
}

function udpdateTextDivs(text) {
  divs = getEditableDivs();
  replacements = Array.from(divs).map(htmlToQuarto);

  const regex = /::: ?(?:\{\.editable[^}]*\}|editable)[^:::]*\:::/g;

  let index = 0;
  return text.replace(regex, () => {
    return replacements[index++] || "";
  });
}

function htmlToQuarto(div) {
  text = div.innerHTML;

  text = text.trim();
  text = text.replaceAll("<p>", "");
  text = text.replaceAll("</p>", "");
  text = text.replaceAll("<code>", "`");
  text = text.replaceAll("</code>", "`");
  text = text.replaceAll("<strong>", "**");
  text = text.replaceAll("</strong>", "**");
  text = text.replaceAll("<em>", "*");
  text = text.replaceAll("</em>", "*");
  text = text.replaceAll("<del>", "~~");
  text = text.replaceAll("</del>", "~~");
  text = text.replaceAll("\n", "\n\n");

  text = "::: {.editable}\n" + text + "\n:::";

  return text;
}

function replaceeditableOccurrences(text, replacements) {
  const regex = /\{\.editable[^}]*\}|::: ?editable/g;

  let index = 0;
  return text.replace(regex, () => {
    return replacements[index++] || "";
  });
}

function formateditableEltStrings(dimensions) {
  return dimensions.map((dim) => {
    let str = `{.absolute width=${dim.width}px height=${dim.height}px left=${dim.left}px top=${dim.top}px`;
    if (dim.fontSize || dim.textAlign) {
      str += ` style="`;
      if (dim.fontSize) {
        str += `font-size: ${dim.fontSize}px;`;
      }
      if (dim.fontSize && dim.textAlign) {
        str += ` `;
      }
      if (dim.textAlign) {
        str += `text-align: ${dim.textAlign};`;
      }
      str += `"`;
    }
    str += "}";
    return str;
  });
}

async function downloadString(content, mimeType = "text/plain") {
  filename = geteditableFilename();
  if ("showSaveFilePicker" in window) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Text files",
            accept: { [mimeType]: [".txt", ".qmd", ".md"] },
          },
        ],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      console.log("File saved successfully");
      return;
    } catch (error) {
      console.log("File picker cancelled or failed, using fallback method");
    }
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
