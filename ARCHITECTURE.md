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
│  Undo/Redo System       undoStack, redoStack, state snapshots   │
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
      rotation: 0,               // Rotation angle in degrees
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
  rotate: {
    name: "rotate",
    createHandles(context) { },  // Create rotation handle at top center
    // Uses angle calculation from center to mouse position
    // Shift key snaps to 15° increments
    // Ctrl/Cmd + arrow keys for keyboard rotation
  },
  fontControls: {
    createControls(context) { }, // Create UI elements
  },
  editText: { /* similar to fontControls */ },
};
```

**Element type mapping:**
```javascript
const ELEMENT_CAPABILITIES = {
  img: ["move", "resize", "rotate"],
  div: ["move", "resize", "rotate", "fontControls", "editText"],
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
  rotation: {
    type: "style",
    serialize: (v) => v ? `transform: rotate(${round(v)}deg);` : null,
  },
};
```

**Output format:**
```
{.absolute width=200px height=150px left=100px top=50px style="font-size: 18px;"}
```

### 5. New Element Registry

The New Element Registry tracks elements and slides added dynamically during a session.

```javascript
const NewElementRegistry = {
  newDivs: [],      // Dynamically added text divs
  newSlides: [],    // Dynamically added slides

  addDiv(div, slideIndex) { },
  addSlide(slide, afterSlideIndex, insertAfterNewSlide = null) { },
  countNewSlidesBefore(index) { },
  clear() { },
  hasNewElements() { },
};
```

**Stored data for each new slide:**
```javascript
{
  element: slideElement,        // The DOM element
  afterSlideIndex: 0,           // Original slide index to insert after
  insertAfterNewSlide: null,    // Parent new slide (for chained insertions)
  insertionOrder: 0,            // Creation order for sorting
}
```

**Tree-based ordering:** When new slides are inserted after other new slides (chained insertions), a tree structure is built using `insertAfterNewSlide` as parent references. The `flattenSlideTree()` function performs a depth-first traversal to determine correct output order, ensuring slides like A→B→C maintain their chain relationship in the saved document.

New elements are marked with the `editable-new` class to distinguish them from original elements during save.

### 6. Toolbar Registry

The Toolbar Registry manages the floating toolbar actions.

```javascript
const ToolbarRegistry = {
  actions: new Map(),

  register(name, config) {
    // config: { icon, label, title, onClick, className }
  },

  getActions() { },           // Get all registered actions
  createButton(config) { },   // Create a button element
};
```

**Registered actions:**
- `save` - Save edits to file
- `copy` - Copy QMD to clipboard
- `addText` - Add new editable text to current slide
- `addSlide` - Add new slide after current

### 7. Undo/Redo System

The Undo/Redo system tracks state changes and allows users to revert or replay edits.

```javascript
const undoStack = [];  // Stack of previous states
const redoStack = [];  // Stack of undone states (cleared on new action)
```

**Key functions:**
- `captureAllState()` - Creates snapshot of all elements' current state
- `restoreState(snapshots)` - Restores all elements to a previous snapshot
- `pushUndoState()` - Captures current state before an action (called at start of drag/resize/button clicks)
- `undo()` - Pops from undoStack, pushes current to redoStack, restores
- `redo()` - Pops from redoStack, pushes current to undoStack, restores
- `canUndo()` / `canRedo()` - Check if stacks have entries

**Keyboard shortcuts:**
- `Ctrl+Z` / `Cmd+Z` - Undo
- `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` - Redo

**Integration points:**
State is captured at the START of actions, before changes occur:
- `Capabilities.move` - `pushUndoState()` called in `startDrag()`
- `Capabilities.resize` - `pushUndoState()` called in `startResize()`
- `ControlRegistry` buttons - `pushUndoState()` called in each `onClick`
- Keyboard handlers - `pushUndoState()` called before arrow key moves

**Note:** Text editing via contentEditable uses the browser's native undo, which operates separately from this system.

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
   │
4. Create floating toolbar (from ToolbarRegistry)
   │
5. Setup undo/redo keyboard shortcuts
```

### Save Flow

```
1. User clicks "Save Edits" or "Copy to Clipboard"
   │
2. getTransformedQmd()
   │
   ├─▶ Read original QMD from window._input_file
   │
   ├─▶ insertNewSlides() - Add new slide headings at correct positions
   │   └─▶ Uses NewElementRegistry.newSlides
   │
   ├─▶ insertNewDivs() - Add new text elements to their slides
   │   └─▶ Uses NewElementRegistry.newDivs
   │
   ├─▶ extractEditableEltDimensions() (original elements only)
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

### Adding a New Capability (e.g., skew)

> **Note:** Rotation is now built-in. This example shows how to add a hypothetical "skew" capability.

1. **Define the capability:**
```javascript
Capabilities.skew = {
  name: "skew",

  init(context) {
    context.isSkewing = false;
    context.skewStartX = 0;
    context.initialSkewX = 0;
  },

  createHandles(context) {
    const handle = document.createElement("div");
    handle.className = "skew-handle";
    handle.setAttribute("aria-label", "Skew element");
    context.container.appendChild(handle);
  },

  attachEvents(context) {
    const handle = context.container.querySelector(".skew-handle");
    handle.addEventListener("mousedown", (e) => {
      context.isSkewing = true;
      // ... skew start logic
    });
  },

  onMove(context, e) {
    if (!context.isSkewing) return;
    // ... calculate skew angle
    context.element.style.transform = `skewX(${angle}deg)`;
  },

  onStop(context) {
    context.isSkewing = false;
  },

  isActive(context) {
    return context.isSkewing;
  },
};
```

2. **Register for element types:**
```javascript
const ELEMENT_CAPABILITIES = {
  img: ["move", "resize", "rotate", "skew"],  // Add skew
  div: ["move", "resize", "rotate", "fontControls", "editText", "skew"],
};
```

3. **Add state and serializer:**
```javascript
// In EditableElement
this.state = { /* ... */ skewX: 0 };

// In PropertySerializers
PropertySerializers.skewX = {
  type: "style",
  serialize: (v) => v !== 0 ? `transform: skewX(${v}deg);` : null,
};
```

4. **Add CSS for the handle:**
```css
.skew-handle {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  /* ... styling */
}
```

### Adding a New Toolbar Action

1. **Register the action:**
```javascript
ToolbarRegistry.register("myAction", {
  icon: "🔧",
  label: "My Action",
  title: "Description of my action",
  className: "toolbar-my-action",
  onClick: () => {
    // Action implementation
  },
});
```

2. **Add CSS for the button:**
```css
.editable-toolbar-button.toolbar-my-action {
  background-color: #your-color;
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
  img: ["move", "resize", "rotate"],
  div: ["move", "resize", "rotate", "fontControls", "editText"],
  video: ["move", "resize", "rotate"],  // New element type
};
```

3. **Update Lua filter** (if needed for special handling)

---

## CSS Architecture

Styles use CSS custom properties for easy theming:

```css
:root {
  /* Element controls */
  --editable-accent-color: #007cba;
  --editable-accent-active: #28a745;
  --editable-handle-size: 10px;
  --editable-border-width: 2px;
  --editable-transition: 0.2s;

  /* Floating toolbar */
  --editable-toolbar-bg: rgba(255, 255, 255, 0.95);
  --editable-toolbar-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  --editable-toolbar-border-radius: 8px;
  --editable-toolbar-save-color: #007cba;
  --editable-toolbar-copy-color: #6c757d;
  --editable-toolbar-add-text-color: #28a745;
  --editable-toolbar-add-slide-color: #17a2b8;
}
```

**Key classes:**
- `.editable-container` - Wrapper around editable elements
- `.editable-container.active` - When hovered/focused
- `.resize-handle` - Corner resize handles
- `.handle-nw`, `.handle-ne`, `.handle-sw`, `.handle-se` - Position-specific
- `.editable-font-controls` - Container for text controls
- `.editable-button` - Base button class
- `.editable-toolbar` - Floating toolbar container
- `.editable-toolbar-button` - Toolbar action buttons
- `.editable-new` - Marker for dynamically added elements
- `.editable-new-slide` - Marker for dynamically added slides

---

## Testing

### Shell Tests (`run-tests.sh`)
- Verify Quarto rendering works
- Check content preservation (LaTeX, shortcodes, backslashes)
- Test base64 encoding/decoding
- Verify toolbar and registry functions exist

### E2E Tests (Playwright) - 139 tests across 3 spec files

**save-edits.spec.js** - Core save functionality (8 tests)
**ui-controls.spec.js** - UI elements, accessibility, CSS, undo/redo, rotation (55 tests)
**toolbar.spec.js** - Floating toolbar, new elements, save integration, edge cases (76 tests)

Key test areas:
- UI controls exist and function
- Drag and resize work correctly
- Keyboard navigation
- Accessibility attributes
- CSS classes applied correctly
- Undo/redo functionality
- Floating toolbar actions
- New element creation and tracking
- Save integration with correct ordering (30 tests verifying element positions in saved QMD)

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
5. **Check undo/redo:** `console.log(canUndo(), canRedo())` to check stack status
