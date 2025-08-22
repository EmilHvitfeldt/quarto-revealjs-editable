window.Revealeditable = function () {
  return {
    id: "Revealeditable",
    init: function (deck) {
      document.addEventListener("DOMContentLoaded", function () {
        const editableElements = getEditableElements();

        editableElements.forEach(setupDraggableElt);

        createHorizontalMenuBar();
      });
    },
  };
};

function createHorizontalMenuBar() {
  // Create the menu bar container
  const menuBar = document.createElement("div");
  menuBar.id = "horizontal-menu-bar";
  menuBar.style.position = "fixed";
  menuBar.style.top = "50%";
  menuBar.style.right = "20px";
  menuBar.style.transform = "translateY(-50%)";
  menuBar.style.display = "flex";
  menuBar.style.flexDirection = "column";
  menuBar.style.gap = "10px";
  menuBar.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
  menuBar.style.padding = "10px";
  menuBar.style.borderRadius = "8px";
  menuBar.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
  menuBar.style.zIndex = "1000";
  menuBar.style.backdropFilter = "blur(5px)";
  menuBar.style.cursor = "move";

  // Make the menu bar draggable
  makeDraggable(menuBar);

  // Create drag handle (three dots)
  const dragHandle = document.createElement("div");
  dragHandle.innerHTML = "...";
  dragHandle.style.fontSize = "18px";
  dragHandle.style.color = "#666";
  dragHandle.style.cursor = "grab";
  dragHandle.style.padding = "4px 8px";
  dragHandle.style.userSelect = "none";
  dragHandle.title = "Drag to move menu";

  dragHandle.addEventListener("mousedown", () => {
    dragHandle.style.cursor = "grabbing";
  });

  document.addEventListener("mouseup", () => {
    dragHandle.style.cursor = "grab";
  });

  // Create and add the Save button
  const saveButton = document.createElement("button");
  saveButton.textContent = "💾";
  saveButton.style.backgroundColor = "#007cba";
  saveButton.style.color = "white";
  saveButton.style.border = "none";
  saveButton.style.padding = "8px 12px";
  saveButton.style.borderRadius = "4px";
  saveButton.style.cursor = "pointer";
  saveButton.style.fontSize = "14px";
  saveButton.style.fontWeight = "500";
  saveButton.addEventListener("click", saveMovedElts);

  // Hover effects for the save button
  saveButton.addEventListener("mouseenter", () => {
    saveButton.style.backgroundColor = "#005a8b";
    saveButton.textContent = "💾 Save Edits";
  });
  saveButton.addEventListener("mouseleave", () => {
    saveButton.style.backgroundColor = "#007cba";
    saveButton.textContent = "💾";
  });

  // Create and add the Add Text Element button
  const addTextButton = document.createElement("button");
  addTextButton.textContent = "📝";
  addTextButton.style.backgroundColor = "#28a745";
  addTextButton.style.color = "white";
  addTextButton.style.border = "none";
  addTextButton.style.padding = "8px 12px";
  addTextButton.style.borderRadius = "4px";
  addTextButton.style.cursor = "pointer";
  addTextButton.style.fontSize = "14px";
  addTextButton.style.fontWeight = "500";
  addTextButton.title = "Add text";

  addTextButton.addEventListener("click", () => {
    const parentDiv = document.querySelector("section.slide.present");
    const newDiv = document.createElement("div");
    newDiv.textContent = "Text";
    newDiv.classList.add("editable");
    newDiv.classList.add("editable-new-div");
    parentDiv.appendChild(newDiv);
    setupDraggableElt(newDiv);
  });

  // Hover effects for the add text button
  addTextButton.addEventListener("mouseenter", () => {
    addTextButton.style.backgroundColor = "#218838";
    addTextButton.textContent = "📝 Add Text";
  });
  addTextButton.addEventListener("mouseleave", () => {
    addTextButton.style.backgroundColor = "#28a745";
    addTextButton.textContent = "📝";
  });

  // Create and add the Add Slide button
  const addSlideButton = document.createElement("button");
  addSlideButton.textContent = "📄";
  addSlideButton.style.backgroundColor = "#17a2b8";
  addSlideButton.style.color = "white";
  addSlideButton.style.border = "none";
  addSlideButton.style.padding = "8px 12px";
  addSlideButton.style.borderRadius = "4px";
  addSlideButton.style.cursor = "pointer";
  addSlideButton.style.fontSize = "14px";
  addSlideButton.style.fontWeight = "500";
  addSlideButton.title = "Add new slide";

  addSlideButton.addEventListener("click", () => {
    const originalDiv = document.querySelector("section.slide.present");
    const newSlide = document.createElement("section");
    newSlide.className = "slide level2 new-slide";
    newSlide.style.display = "block";
    originalDiv.insertAdjacentElement("afterend", newSlide);
    Reveal.next();
  });

  // Hover effects for the add slide button
  addSlideButton.addEventListener("mouseenter", () => {
    addSlideButton.style.backgroundColor = "#138496";
    addSlideButton.textContent = "📄 Add Slide";
  });
  addSlideButton.addEventListener("mouseleave", () => {
    addSlideButton.style.backgroundColor = "#17a2b8";
    addSlideButton.textContent = "📄";
  });

  menuBar.appendChild(dragHandle);
  menuBar.appendChild(saveButton);
  menuBar.appendChild(addTextButton);
  menuBar.appendChild(addSlideButton);
  document.body.appendChild(menuBar);

  return menuBar;
}

function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  element.addEventListener("mousedown", startDrag);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", stopDrag);

  function startDrag(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = element.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;

    element.style.position = "fixed";
    element.style.transform = "none";
    // Don't set a fixed width, let the menu maintain its natural width
    element.style.left = initialX + "px";
    element.style.top = initialY + "px";
    element.style.right = "auto"; // Remove right positioning

    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    element.style.left = initialX + deltaX + "px";
    element.style.top = initialY + deltaY + "px";
  }

  function stopDrag() {
    isDragging = false;
  }
}

function addButtonToMenuBar(text, onClick, options = {}) {
  const menuBar = document.getElementById("horizontal-menu-bar");
  if (!menuBar) return null;

  const button = document.createElement("button");
  button.textContent = text;
  button.style.backgroundColor = options.backgroundColor || "#6c757d";
  button.style.color = options.color || "white";
  button.style.border = "none";
  button.style.padding = options.padding || "8px 12px";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = "14px";
  button.style.fontWeight = "500";
  button.addEventListener("click", onClick);

  // Hover effects
  const originalBg = options.backgroundColor || "#6c757d";
  const hoverBg = options.hoverBackgroundColor || "#5a6268";
  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = hoverBg;
  });
  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = originalBg;
  });

  menuBar.appendChild(button);
  return button;
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

  index = addNewSlides(index);
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

function getNewSlideDivIndices(nodeList) {
  const indices = [];
  for (let i = 0; i < nodeList.length; i++) {
    if (nodeList[i].classList.contains("new-slide")) {
      indices.push(i);
    }
  }

  return indices;
}

function countNormalSlidesBefore(divs, index) {
  if (index == 0) {
    return 0;
  }

  const previous = Array.from(divs).slice(0, index);
  const n_new_slides = getNewSlideDivIndices(previous).length;

  return previous.length - n_new_slides;
}

function addNewSlides(text) {
  all_html_slides = document.querySelectorAll("section:not(#title-slide)");

  new_slide_inds = getNewSlideDivIndices(all_html_slides);

  if (new_slide_inds.length < 1) {
    return text;
  }

  const lines = text.split("\n");

  // Find all elements in lines that start with "## " preceded by an empty line
  const headingsAfterEmptyLines = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    const previousLine = lines[i - 1].trim();

    // Check if current line starts with "## " and previous line is empty
    if (currentLine.startsWith("## ") && previousLine === "") {
      headingsAfterEmptyLines.push(i);
    }
  }

  for (let i = new_slide_inds.length - 1; i >= 0; i--) {
    nSlidesBefore = countNormalSlidesBefore(all_html_slides, new_slide_inds[i]);

    // fix bug when you add multiple slides at the end
    if (nSlidesBefore == headingsAfterEmptyLines.length) {
      lines.push("");
      lines.push("## ");
      lines.push("");
    } else {
      lines.splice(headingsAfterEmptyLines[nSlidesBefore], 0, "## ", "");
    }
  }

  text = lines.join("\n");

  return text;
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
