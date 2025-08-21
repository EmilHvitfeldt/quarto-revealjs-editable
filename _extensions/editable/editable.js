window.Revealeditable = function () {
  return {
    id: "Revealeditable",
    init: function (deck) {
      document.addEventListener("DOMContentLoaded", function () {
        const editableElements = getEditableElements();

        editableElements.forEach(setupDraggableElt);

        // Find the slide-menu-items ul inside menu-custom-panel div
        const slideMenuItems = document.querySelector(
          "div.slide-menu-custom-panel ul.slide-menu-items"
        );

        if (slideMenuItems) {
          // Find the highest data-item value
          const existingItems =
            slideMenuItems.querySelectorAll("li[data-item]");
          let maxDataItem = 0;
          existingItems.forEach((item) => {
            const dataValue = parseInt(item.getAttribute("data-item")) || 0;
            if (dataValue > maxDataItem) {
              maxDataItem = dataValue;
            }
          });

          // Create the new li element
          const newLi = document.createElement("li");
          newLi.className = "slide-tool-item";
          newLi.setAttribute("data-item", (maxDataItem + 1).toString());
          newLi.innerHTML =
            '<a href="#" onclick="saveMovedElts()"><kbd>?</kbd> Save Edits</a>';

          // Append to the ul
          slideMenuItems.appendChild(newLi);
        }
      });
    },
  };
};

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

    // Create font size controls for div elements
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

      // Create text alignment controls
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

      // Add event listeners for font size controls
      decreaseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        changeFontSize(elt, -2);
      });

      increaseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        changeFontSize(elt, 2);
      });

      // Add event listeners for text alignment controls
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

      // Add event listener for edit button
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isEditable = elt.contentEditable === "true";
        elt.contentEditable = !isEditable;
        editBtn.style.backgroundColor = !isEditable ? "#28a745" : "#007cba";
        editBtn.title = !isEditable ? "Exit Edit Mode" : "Toggle Edit Mode";
        if (!isEditable) {
          elt.focus();
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

    // revealjs scales this .slides container element so that
    // the slide fits completely in the viewport. We have to
    // adjust the mouse/touch positions by this scaling.
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

    // Check if Shift key is pressed for aspect ratio preservation
    const preserveAspectRatio = e.shiftKey;
    const aspectRatio = initialWidth / initialHeight;

    if (preserveAspectRatio) {
      // For corner handles, use the larger delta to maintain aspect ratio
      if (resizeHandle.includes("e") || resizeHandle.includes("w")) {
        const widthChange = resizeHandle.includes("e") ? deltaX : -deltaX;
        newWidth = Math.max(50, initialWidth + widthChange);
        newHeight = newWidth / aspectRatio;
      } else if (resizeHandle.includes("s") || resizeHandle.includes("n")) {
        const heightChange = resizeHandle.includes("s") ? deltaY : -deltaY;
        newHeight = Math.max(50, initialHeight + heightChange);
        newWidth = newHeight * aspectRatio;
      }

      // Adjust position for west/north handles when preserving aspect ratio
      if (resizeHandle.includes("w")) {
        newX = initialX + (initialWidth - newWidth);
      }
      if (resizeHandle.includes("n")) {
        newY = initialY + (initialHeight - newHeight);
      }
    } else {
      // Original free resize behavior
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
    const newFontSize = Math.max(8, currentFontSize + delta); // Minimum font size of 8px
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
  index = readIndexQmd();
  Elt_dim = extracteditableEltDimensions();

  index = udpdateTextDivs(index);

  Elt_attr = formateditableEltStrings(Elt_dim);
  index = replaceeditableOccurrences(index, Elt_attr);
  downloadString(index);
}
// Function to read index.qmd file
function readIndexQmd() {
  return window._input_file;
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

    // Get parent container (div) position
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

    // Add font-size for div elements if it's set
    if (elt.tagName.toLowerCase() === "div" && elt.style.fontSize) {
      dimensionData.fontSize = parseFloat(elt.style.fontSize);
    }
    // Add text-align for div elements if it's set
    if (elt.tagName.toLowerCase() === "div" && elt.style.textAlign) {
      dimensionData.textAlign = elt.style.textAlign;
    }

    dimensions.push(dimensionData);
  });

  return dimensions;
}

// Function to replace all occurrences that start with "{.editable" and go until the first "}" with replacements from array
function udpdateTextDivs(text) {
  divs = getEditableDivs();
  replacements = Array.from(divs).map(htmlToQuarto);

  const regex = /::: ?\{\.editable[^}]*\}[^:::]*\:::/g;

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

// Function to replace all occurrences that start with "{.editable" and go until the first "}" with replacements from array
function replaceeditableOccurrences(text, replacements) {
  const regex = /\{\.editable[^}]*\}/g;
  let index = 0;
  return text.replace(regex, () => {
    return replacements[index++] || "";
  });
}

// Function to format editable dimensions as strings
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

// Function to make a string available as a downloadable file
async function downloadString(content, mimeType = "text/plain") {
  filename = geteditableFilename();
  // Check if the File System Access API is supported
  if ("showSaveFilePicker" in window) {
    try {
      // Show file picker dialog
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Text files",
            accept: { [mimeType]: [".txt", ".qmd", ".md"] },
          },
        ],
      });

      // Create a writable stream and write the content
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      console.log("File saved successfully");
      return;
    } catch (error) {
      // User cancelled or error occurred, fall back to traditional method
      console.log("File picker cancelled or failed, using fallback method");
    }
  }

  // Fallback to traditional download method
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
