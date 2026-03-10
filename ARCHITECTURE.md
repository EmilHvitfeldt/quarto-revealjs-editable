# Architecture Guide

This document describes the internal architecture of the quarto-revealjs-editable extension for developers who want to understand, maintain, or extend the codebase.

## Overview

The extension consists of two main parts:

1. **Lua Filter** (`editable.lua`) - Runs at build time to inject source file content
2. **JavaScript Plugin** (`editable.js`) - Runs at runtime to enable drag/resize/edit functionality

```
┌─────────────────────────────────────────────────────────────────┐
│                        Build Time                               │
│  ┌───────-───┐    ┌──────────-───┐    ┌───────────────────────┐ │
│  │ .qmd file │───▶│ editable.lua │───▶│ HTML with _input_file │ │
│  └────────-──┘    └─────────-────┘    └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Runtime                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐    │
│  │ editable.js │───▶│ User edits   │───▶│ Save/Copy .qmd   │    │
│  │   plugin    │    │ elements     │    │ with new coords  │    │
│  └─────────────┘    └──────────────┘    └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
_extensions/editable/
├── _extension.yml      # Quarto extension manifest
├── editable.lua        # Lua filter (build time)
├── editable.js         # JavaScript plugin (runtime)
└── editable.css        # Styles with CSS custom properties
```

## JavaScript Architecture

The JavaScript code is organized into several interconnected systems:

```
┌─────────────────────────────────────────────────────────────────┐
│                     editable.js Structure                       │
├─────────────────────────────────────────────────────────────────┤
│  CONFIG                 Runtime constants                       │
├─────────────────────────────────────────────────────────────────┤
│  EditableElement        State management per element            │
│  editableRegistry       Map of all managed elements             │
├─────────────────────────────────────────────────────────────────┤
│  Capabilities           move, resize, fontControls, editText    │
│  ELEMENT_CAPABILITIES   Maps element types to capabilities      │
├─────────────────────────────────────────────────────────────────┤
│  ControlRegistry        UI button definitions                   │
│  PropertySerializers    State-to-QMD conversion                 │
├─────────────────────────────────────────────────────────────────┤
│  Utility Functions      round, getSlideScale, createButton, etc.│
├─────────────────────────────────────────────────────────────────┤
│  setupDraggableElt      Main element setup function             │
├─────────────────────────────────────────────────────────────────┤
│  Save/Export            getTransformedQmd, serializeToQmd       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Systems

### 1. Element State Management

Each editable element is wrapped in an `EditableElement` instance that maintains centralized state.

```javascript
class EditableElement {
  constructor(element) {
    this.element = element;      // The DOM element (img or div)
    this.container = null;       // The wrapper container
    this.type = "img" | "div";   // Element type
    this.state = {
      x: 0,                      // Container left position
      y: 0,                      // Container top position
      width: 0,                  // Element width
      height: 0,                 // Element height
      fontSize: null,            // Font size (div only)
      textAlign: null,           // Text alignment (div only)
    };
  }
}
```

**Key methods:**
- `getState()` - Returns copy of current state
- `setState(updates)` - Updates state and syncs to DOM
- `syncToDOM()` - Writes state values to DOM elements
- `syncFromDOM()` - Reads current DOM values into state
- `toDimensions()` - Returns state formatted for serialization

**Registry:**
```javascript
const editableRegistry = new Map();  // DOM element -> EditableElement
```

### 2. Capability System

Capabilities are modular behaviors that can be attached to elements. Each capability handles a specific type of interaction.

```javascript
const Capabilities = {
  move: {
    name: "move",
    init(context) { },           // Initialize capability state
    attachEvents(context) { },   // Attach event listeners
    onMove(context, e) { },      // Handle pointer move
    onStop(context) { },         // Cleanup when interaction ends
    isActive(context) { },       // Check if currently active
    handleKeyboard(context, e, editableElt) { },  // Handle arrow keys
  },
  resize: { /* similar interface */ },
  fontControls: {
    createControls(context) { }, // Create UI elements
  },
  editText: { /* similar to fontControls */ },
};
```

**Element type mapping:**
```javascript
const ELEMENT_CAPABILITIES = {
  img: ["move", "resize"],
  div: ["move", "resize", "fontControls", "editText"],
};
```

**Context object** (shared between capabilities):
```javascript
const context = {
  element: elt,           // The editable element
  container: container,   // The wrapper container
  editableElt: editableElt, // EditableElement instance
  handlers: {},           // Stored event handlers
  rafId: null,            // requestAnimationFrame ID
  cachedScale: 1,         // Cached slide scale for performance
};
```

### 3. Control Registry

The Control Registry manages UI buttons that appear on editable elements.

```javascript
const ControlRegistry = {
  controls: new Map(),

  register(name, config) {
    // config: { icon, ariaLabel, title, onClick, appliesTo, className }
  },

  getControlsFor(elementType) {
    // Returns controls applicable to the element type
  },

  createButton(config, element) {
    // Creates a button element from config
  },
};
```

**Registered controls:**
- `decreaseFont` - Decrease font size (div)
- `increaseFont` - Increase font size (div)
- `alignLeft` - Left align text (div)
- `alignCenter` - Center align text (div)
- `alignRight` - Right align text (div)
- `editMode` - Toggle contentEditable (div)

### 4. Property Serializers

Property Serializers convert element state to QMD attribute strings.

```javascript
const PropertySerializers = {
  width: {
    type: "attr",  // Goes in attribute list
    serialize: (v) => `width=${round(v)}px`,
  },
  fontSize: {
    type: "style", // Goes in style attribute
    serialize: (v) => v ? `font-size: ${v}px;` : null,
  },
};
```

**Output format:**
```
{.absolute width=200px height=150px left=100px top=50px style="font-size: 18px;"}
```

---

## Data Flow

### Initialization Flow

```
1. Reveal.js ready event
   │
2. Query all img.editable and div.editable
   │
3. For each element:
   │
   ├─▶ Create EditableElement (state manager)
   │
   ├─▶ Register in editableRegistry
   │
   ├─▶ Create container wrapper
   │
   ├─▶ Get capabilities for element type
   │
   ├─▶ Initialize each capability
   │
   ├─▶ Create UI elements (handles, buttons)
   │
   ├─▶ Attach event listeners
   │
   └─▶ Setup hover/focus/keyboard handlers
```

### Save Flow

```
1. User clicks "Save Edits" or "Copy to Clipboard"
   │
2. getTransformedQmd()
   │
   ├─▶ Read original QMD from window._input_file
   │
   ├─▶ extractEditableEltDimensions()
   │   └─▶ For each element: editableElt.toDimensions()
   │
   ├─▶ updateTextDivs() - Convert div innerHTML to Quarto markdown
   │
   ├─▶ formatEditableEltStrings()
   │   └─▶ For each dimension: serializeToQmd()
   │       └─▶ Use PropertySerializers to build attribute string
   │
   └─▶ replaceEditableOccurrences() - Replace {.editable} with {.absolute ...}
   │
3. Download file or copy to clipboard
```

---

## Extending the Extension

### Adding a New Property (e.g., opacity)

1. **Add to EditableElement state:**
```javascript
this.state = {
  // ... existing properties
  opacity: 1,  // New property
};
```

2. **Update syncToDOM/syncFromDOM:**
```javascript
syncToDOM() {
  // ... existing code
  if (this.state.opacity !== null) {
    this.element.style.opacity = this.state.opacity;
  }
}
```

3. **Add PropertySerializer:**
```javascript
PropertySerializers.opacity = {
  type: "style",
  serialize: (v) => v !== 1 ? `opacity: ${v};` : null,
};
```

4. **Add UI control (optional):**
```javascript
ControlRegistry.register("decreaseOpacity", {
  icon: "◐",
  ariaLabel: "Decrease opacity",
  title: "Decrease Opacity",
  className: "editable-button-opacity",
  appliesTo: ["img", "div"],
  onClick: (element) => {
    const editableElt = editableRegistry.get(element);
    if (editableElt) {
      const newOpacity = Math.max(0.1, (editableElt.state.opacity || 1) - 0.1);
      editableElt.setState({ opacity: newOpacity });
    }
  },
});
```

### Adding a New Capability (e.g., rotation)

1. **Define the capability:**
```javascript
Capabilities.rotate = {
  name: "rotate",

  init(context) {
    context.isRotating = false;
    context.rotationStart = 0;
    context.initialRotation = 0;
  },

  createHandles(context) {
    const handle = document.createElement("div");
    handle.className = "rotate-handle";
    handle.setAttribute("aria-label", "Rotate element");
    context.container.appendChild(handle);
  },

  attachEvents(context) {
    const handle = context.container.querySelector(".rotate-handle");
    handle.addEventListener("mousedown", (e) => {
      context.isRotating = true;
      // ... rotation start logic
    });
  },

  onMove(context, e) {
    if (!context.isRotating) return;
    // ... calculate rotation angle
    context.container.style.transform = `rotate(${angle}deg)`;
  },

  onStop(context) {
    context.isRotating = false;
  },

  isActive(context) {
    return context.isRotating;
  },
};
```

2. **Register for element types:**
```javascript
const ELEMENT_CAPABILITIES = {
  img: ["move", "resize", "rotate"],  // Add rotate
  div: ["move", "resize", "fontControls", "editText", "rotate"],
};
```

3. **Add state and serializer:**
```javascript
// In EditableElement
this.state = { /* ... */ rotation: 0 };

// In PropertySerializers
PropertySerializers.rotation = {
  type: "attr",
  serialize: (v) => v !== 0 ? `data-rotation="${v}"` : null,
};
```

4. **Add CSS for the handle:**
```css
.rotate-handle {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  /* ... styling */
}
```

### Adding a New Element Type (e.g., video)

1. **Update DOM query:**
```javascript
function getEditableElements() {
  return document.querySelectorAll("img.editable, div.editable, video.editable");
}
```

2. **Register capabilities:**
```javascript
const ELEMENT_CAPABILITIES = {
  img: ["move", "resize"],
  div: ["move", "resize", "fontControls", "editText"],
  video: ["move", "resize"],  // New element type
};
```

3. **Update Lua filter** (if needed for special handling)

---

## CSS Architecture

Styles use CSS custom properties for easy theming:

```css
:root {
  --editable-accent-color: #007cba;
  --editable-accent-active: #28a745;
  --editable-handle-size: 10px;
  --editable-border-width: 2px;
  --editable-transition: 0.2s;
}
```

**Key classes:**
- `.editable-container` - Wrapper around editable elements
- `.editable-container.active` - When hovered/focused
- `.resize-handle` - Corner resize handles
- `.handle-nw`, `.handle-ne`, `.handle-sw`, `.handle-se` - Position-specific
- `.editable-font-controls` - Container for text controls
- `.editable-button` - Base button class

---

## Testing

### Shell Tests (`run-tests.sh`)
- Verify Quarto rendering works
- Check content preservation (LaTeX, shortcodes, backslashes)
- Test base64 encoding/decoding

### E2E Tests (Playwright)
- UI controls exist and function
- Drag and resize work correctly
- Keyboard navigation
- Accessibility attributes
- CSS classes applied correctly

Run tests:
```bash
# Shell tests
./testing/run-tests.sh

# E2E tests
cd testing && npm run test:e2e
```

---

## Performance Considerations

1. **Cached slide scale** - Scale is cached at interaction start to avoid repeated DOM queries
2. **requestAnimationFrame throttling** - Pointer move events are throttled to animation frames
3. **State synchronization** - `syncFromDOM()` is only called when needed (e.g., before serialization)

---

## Debugging Tips

1. **Check registry:** `console.log(editableRegistry)` to see all managed elements
2. **Check capabilities:** `console.log(ELEMENT_CAPABILITIES)` to see element-capability mapping
3. **Check controls:** `console.log(ControlRegistry.controls)` to see registered controls
4. **Inspect state:** `editableRegistry.get(element).getState()` for element state
