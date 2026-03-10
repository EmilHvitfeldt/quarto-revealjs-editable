// Configuration constants
const CONFIG = {
  // Sizing
  MIN_ELEMENT_SIZE: 50,
  HANDLE_SIZE: 10,
  KEYBOARD_MOVE_STEP: 10,
  HANDLE_OFFSET: -6,
  BORDER_WIDTH: 2,

  // Font
  MIN_FONT_SIZE: 8,
  DEFAULT_FONT_SIZE: 16,
  FONT_SIZE_STEP: 2,

  // Colors
  ACCENT_COLOR: "#007cba",
  ACCENT_COLOR_ACTIVE: "#28a745",
  HANDLE_BORDER_COLOR: "#fff",

  // Timing
  TRANSITION_DURATION: "0.2s",
  HOVER_TIMEOUT: 500,

  // UI
  FONT_CONTROLS_OFFSET: -30,
  FONT_CONTROLS_GAP: 5,
  BUTTON_BORDER_RADIUS: 3,
  BUTTON_MARGIN: 10,
};

window.Revealeditable = function () {
  return {
    id: "Revealeditable",
    init: function (deck) {
      deck.on("ready", function () {
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
    container.style.border = CONFIG.BORDER_WIDTH + "px solid transparent";
    elt.parentNode.insertBefore(container, elt);
    container.appendChild(elt);
    return container;
  }

  function setupEltStyles(elt) {
    elt.style.cursor = "move";
    elt.style.position = "relative";
    // Preserve current rendered size (computed by CSS/reveal.js) rather than scaling
    elt.style.width = elt.offsetWidth + "px";
    elt.style.height = elt.offsetHeight + "px";
    elt.style.display = "block";
  }

  function createResizeHandles(container) {
    // Make container focusable for keyboard navigation
    container.setAttribute("tabindex", "0");
    container.setAttribute("role", "application");
    container.setAttribute("aria-label", "Editable element. Use arrow keys to move, Shift+arrows to resize.");

    const handles = ["nw", "ne", "sw", "se"];
    const handleLabels = {
      nw: "Resize from top-left corner",
      ne: "Resize from top-right corner",
      sw: "Resize from bottom-left corner",
      se: "Resize from bottom-right corner"
    };

    handles.forEach((position) => {
      const handle = document.createElement("div");
      handle.className = "resize-handle";
      handle.style.position = "absolute";
      handle.style.width = CONFIG.HANDLE_SIZE + "px";
      handle.style.height = CONFIG.HANDLE_SIZE + "px";
      handle.style.backgroundColor = CONFIG.ACCENT_COLOR;
      handle.style.border = "1px solid " + CONFIG.HANDLE_BORDER_COLOR;
      handle.style.cursor = position + "-resize";
      handle.style.opacity = "0";
      handle.style.transition = "opacity " + CONFIG.TRANSITION_DURATION;

      // Accessibility attributes
      handle.setAttribute("role", "slider");
      handle.setAttribute("aria-label", handleLabels[position]);
      handle.setAttribute("tabindex", "-1");

      if (position.includes("n")) handle.style.top = CONFIG.HANDLE_OFFSET + "px";
      if (position.includes("s")) handle.style.bottom = CONFIG.HANDLE_OFFSET + "px";
      if (position.includes("w")) handle.style.left = CONFIG.HANDLE_OFFSET + "px";
      if (position.includes("e")) handle.style.right = CONFIG.HANDLE_OFFSET + "px";

      handle.dataset.position = position;
      container.appendChild(handle);
    });

    if (elt.tagName.toLowerCase() === "div") {
      const fontControls = document.createElement("div");
      fontControls.className = "font-controls";
      fontControls.style.position = "absolute";
      fontControls.style.top = CONFIG.FONT_CONTROLS_OFFSET + "px";
      fontControls.style.left = "0";
      fontControls.style.opacity = "0";
      fontControls.style.transition = "opacity " + CONFIG.TRANSITION_DURATION;
      fontControls.style.display = "flex";
      fontControls.style.gap = CONFIG.FONT_CONTROLS_GAP + "px";

      const decreaseBtn = createButton("A-", "24px", "4px 12px");
      decreaseBtn.style.marginRight = "0";
      decreaseBtn.setAttribute("aria-label", "Decrease font size");
      decreaseBtn.title = "Decrease font size";

      const increaseBtn = createButton("A+", "24px", "4px 12px");
      increaseBtn.style.marginRight = CONFIG.BUTTON_MARGIN + "px";
      increaseBtn.setAttribute("aria-label", "Increase font size");
      increaseBtn.title = "Increase font size";

      const alignLeftBtn = createButton("⇤", "20px", "4px 12px");
      alignLeftBtn.setAttribute("aria-label", "Align text left");
      alignLeftBtn.title = "Align Left";

      const alignCenterBtn = createButton("⇔", "20px", "4px 12px");
      alignCenterBtn.setAttribute("aria-label", "Align text center");
      alignCenterBtn.title = "Align Center";

      const alignRightBtn = createButton("⇥", "20px", "4px 12px");
      alignRightBtn.setAttribute("aria-label", "Align text right");
      alignRightBtn.title = "Align Right";

      const editBtn = createButton("✎", "20px", "4px 12px");
      editBtn.style.marginLeft = CONFIG.BUTTON_MARGIN + "px";
      editBtn.setAttribute("aria-label", "Toggle edit mode");
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
        changeFontSize(elt, -CONFIG.FONT_SIZE_STEP);
      });

      increaseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        changeFontSize(elt, CONFIG.FONT_SIZE_STEP);
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
        editBtn.style.backgroundColor = !isEditable ? CONFIG.ACCENT_COLOR_ACTIVE : CONFIG.ACCENT_COLOR;
        editBtn.title = !isEditable ? "Exit Edit Mode" : "Toggle Edit Mode";
        if (!isEditable) {
          elt.focus();
        }
      });
    }
  }

  function setupHoverEffects(container, isDraggingFn, isResizingFn) {
    function showControls() {
      container.style.border = CONFIG.BORDER_WIDTH + "px solid " + CONFIG.ACCENT_COLOR;
      container
        .querySelectorAll(".resize-handle")
        .forEach((h) => (h.style.opacity = "1"));
      const fontControls = container.querySelector(".font-controls");
      if (fontControls) fontControls.style.opacity = "1";
    }

    function hideControls() {
      container.style.border = CONFIG.BORDER_WIDTH + "px solid transparent";
      container
        .querySelectorAll(".resize-handle")
        .forEach((h) => (h.style.opacity = "0"));
      const fontControls = container.querySelector(".font-controls");
      if (fontControls) fontControls.style.opacity = "0";
    }

    container.addEventListener("mouseenter", showControls);

    container.addEventListener("mouseleave", () => {
      if (!isDraggingFn() && !isResizingFn()) {
        hideControls();
      }
    });

    // Show controls on focus for keyboard users
    container.addEventListener("focus", showControls);
    container.addEventListener("blur", (e) => {
      // Don't hide if focus moved to a child element (button)
      if (!container.contains(e.relatedTarget)) {
        hideControls();
      }
    });

    // Keyboard navigation - stop propagation to prevent reveal.js slide navigation
    container.addEventListener("keydown", (e) => {
      // Shift+Tab blurs the container to return to normal slide navigation
      if (e.key === "Tab" && e.shiftKey) {
        container.blur();
        e.preventDefault();
        return;
      }

      // Only handle arrow keys
      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
        return;
      }

      // Stop reveal.js from handling arrow keys when container is focused
      e.preventDefault();
      e.stopPropagation();

      const step = CONFIG.KEYBOARD_MOVE_STEP || 10;
      const currentLeft = parseFloat(container.style.left) || container.offsetLeft;
      const currentTop = parseFloat(container.style.top) || container.offsetTop;

      if (e.shiftKey) {
        // Shift + arrows = resize
        const currentWidth = parseFloat(elt.style.width) || elt.offsetWidth;
        const currentHeight = parseFloat(elt.style.height) || elt.offsetHeight;

        switch (e.key) {
          case "ArrowRight":
            elt.style.width = Math.max(CONFIG.MIN_ELEMENT_SIZE, currentWidth + step) + "px";
            break;
          case "ArrowLeft":
            elt.style.width = Math.max(CONFIG.MIN_ELEMENT_SIZE, currentWidth - step) + "px";
            break;
          case "ArrowDown":
            elt.style.height = Math.max(CONFIG.MIN_ELEMENT_SIZE, currentHeight + step) + "px";
            break;
          case "ArrowUp":
            elt.style.height = Math.max(CONFIG.MIN_ELEMENT_SIZE, currentHeight - step) + "px";
            break;
        }
      } else {
        // Arrows = move
        switch (e.key) {
          case "ArrowRight":
            container.style.left = (currentLeft + step) + "px";
            break;
          case "ArrowLeft":
            container.style.left = (currentLeft - step) + "px";
            break;
          case "ArrowDown":
            container.style.top = (currentTop + step) + "px";
            break;
          case "ArrowUp":
            container.style.top = (currentTop - step) + "px";
            break;
        }
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
    const scale = slidesContainerEl
      ? parseFloat(window.getComputedStyle(slidesContainerEl).getPropertyValue("--slide-scale")) || 1
      : 1;

    return {
      clientX: (isTouch ? e.touches[0].clientX : e.clientX) / scale,
      clientY: (isTouch ? e.touches[0].clientY : e.clientY) / scale,
    };
  }

  function startDrag(e) {
    if (e.target.parentElement.contentEditable === "true") return;
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
        newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialWidth + widthChange);
        newHeight = newWidth / aspectRatio;
      } else if (resizeHandle.includes("s") || resizeHandle.includes("n")) {
        const heightChange = resizeHandle.includes("s") ? deltaY : -deltaY;
        newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialHeight + heightChange);
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
        newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialWidth + deltaX);
      }
      if (resizeHandle.includes("w")) {
        newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialWidth - deltaX);
        newX = initialX + (initialWidth - newWidth);
      }
      if (resizeHandle.includes("s")) {
        newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialHeight + deltaY);
      }
      if (resizeHandle.includes("n")) {
        newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, initialHeight - deltaY);
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
      setTimeout(() => {
        if (!container.matches(":hover")) {
          container.style.border = CONFIG.BORDER_WIDTH + "px solid transparent";
          container
            .querySelectorAll(".resize-handle")
            .forEach((h) => (h.style.opacity = "0"));
          const fontControls = container.querySelector(".font-controls");
          if (fontControls) fontControls.style.opacity = "0";
        }
      }, CONFIG.HOVER_TIMEOUT);
    }

    isDragging = false;
    isResizing = false;
    resizeHandle = null;
  }

  function changeFontSize(element, delta) {
    const currentFontSize =
      parseFloat(window.getComputedStyle(element).fontSize) || CONFIG.DEFAULT_FONT_SIZE;
    const newFontSize = Math.max(CONFIG.MIN_FONT_SIZE, currentFontSize + delta);
    element.style.fontSize = newFontSize + "px";
  }

  function createButton(text, fontSize, padding) {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.fontSize = fontSize;
    button.style.padding = padding;
    button.style.backgroundColor = CONFIG.ACCENT_COLOR;
    button.style.color = "white";
    button.style.border = "none";
    button.style.cursor = "pointer";
    button.style.borderRadius = CONFIG.BUTTON_BORDER_RADIUS + "px";
    return button;
  }
}

function saveMovedElts() {
  let index = readIndexQmd();
  const Elt_dim = extractEditableEltDimensions();

  index = updateTextDivs(index);

  const Elt_attr = formatEditableEltStrings(Elt_dim);
  index = replaceEditableOccurrences(index, Elt_attr);

  downloadString(index);
}

// Function to read index.qmd file (decoded from base64 by atob() at load time)
function readIndexQmd() {
  if (!window._input_file) {
    console.error("_input_file not found. Was the editable filter applied?");
    return "";
  }
  return window._input_file;
}

// Function to copy the modified qmd content to clipboard (closes #8)
function copyQmdToClipboard() {
  let index = readIndexQmd();
  const Elt_dim = extractEditableEltDimensions();

  index = updateTextDivs(index);

  const Elt_attr = formatEditableEltStrings(Elt_dim);
  index = replaceEditableOccurrences(index, Elt_attr);

  navigator.clipboard.writeText(index).then(function () {
    console.log("qmd content copied to clipboard");
  }).catch(function (err) {
    console.error("Failed to copy to clipboard:", err);
  });
}

// Function to get data-filename attribute from editable div
function getEditableFilename() {
  return window._input_filename.split(/[/\\]/).pop();
}

// Function to extract width and height of Elts with editable id
function extractEditableEltDimensions() {
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

function updateTextDivs(text) {
  const divs = getEditableDivs();
  const replacements = Array.from(divs).map(htmlToQuarto);

  // Match fenced divs: ::: {.editable} or ::: editable followed by content and closing :::
  // Using [\s\S]*? for non-greedy match of any character including newlines
  const regex = /::: ?(?:\{\.editable[^}]*\}|editable)[\s\S]*?\n:::/g;

  let index = 0;
  return text.replace(regex, () => {
    return replacements[index++] || "";
  });
}

function htmlToQuarto(div) {
  let text = div.innerHTML;
  text = text.trim();

  // Handle br tags first (self-closing or not)
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Handle tags with potential attributes using regex
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<code[^>]*>/gi, "`");
  text = text.replace(/<\/code>/gi, "`");
  text = text.replace(/<strong[^>]*>/gi, "**");
  text = text.replace(/<\/strong>/gi, "**");
  text = text.replace(/<em[^>]*>/gi, "*");
  text = text.replace(/<\/em>/gi, "*");
  text = text.replace(/<del[^>]*>/gi, "~~");
  text = text.replace(/<\/del>/gi, "~~");

  // Clean up excessive newlines (3+ -> 2)
  text = text.replace(/\n{3,}/g, "\n\n");

  text = "::: {.editable}\n" + text.trim() + "\n:::";

  return text;
}

function replaceEditableOccurrences(text, replacements) {
  // Match {.editable} or {.editable ...} patterns
  // Note: ::: editable divs are normalized to {.editable} by updateTextDivs first
  const regex = /\{\.editable[^}]*\}/g;

  let index = 0;
  return text.replace(regex, () => {
    return replacements[index++] || "";
  });
}

function formatEditableEltStrings(dimensions) {
  // Round to 1 decimal place for cleaner output
  const round = (n) => Math.round(n * 10) / 10;

  return dimensions.map((dim) => {
    let str = `{.absolute width=${round(dim.width)}px height=${round(dim.height)}px left=${round(dim.left)}px top=${round(dim.top)}px`;
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
  const filename = getEditableFilename();
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
