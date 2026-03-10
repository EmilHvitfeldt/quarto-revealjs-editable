# Refactoring Plan for Extensibility

This document outlines refactoring opportunities to support future features like rotation, new element types, and more.

## Current Architecture Issues

### 1. Monolithic `setupDraggableElt` Function (~430 lines)

**Problem:** This single function handles:
- Container creation
- Style setup
- Resize handle creation
- Font controls (for divs only)
- Hover effects
- Keyboard navigation
- Mouse/touch event handling
- Drag logic
- Resize logic

**Impact:** Adding rotation would require modifying this massive function in multiple places.

### 2. No Element Type Abstraction

**Current approach:**
```javascript
if (elt.tagName.toLowerCase() === "div") {
  // div-specific controls
}
```

**Problem:** Adding support for videos, tables, or custom elements requires adding more conditionals everywhere.

### 3. Hardcoded Properties in Dimension Extraction

**Current:**
```javascript
const dimensionData = {
  width, height, left, top,
  // conditionally: fontSize, textAlign
};
```

**Problem:** Adding `rotation`, `opacity`, `zIndex`, etc. requires modifying:
- `extractEditableEltDimensions()`
- `formatEditableEltStrings()`
- UI controls
- Keyboard handlers

### 4. Duplicate Code ✅ RESOLVED (Phase 1)

- ~~`handleMouseMove` and `handleTouchMove` are identical~~ → Combined into `handlePointerMove`
- ~~`saveMovedElts` and `copyQmdToClipboard` share transformation logic~~ → Extracted to `getTransformedQmd()`

### 5. Mixed Concerns in `createResizeHandles` ✅ RESOLVED (Phase 1)

~~This function creates:~~
- ~~Resize handles~~
- ~~ARIA attributes~~
- ~~Font controls (for divs)~~
- ~~Button event handlers~~

Now split into separate `createResizeHandles()` and `createFontControls()` functions.

---

## Proposed Architecture

### 1. Element State Manager

Create a centralized state object per element:

```javascript
class EditableElement {
  constructor(element) {
    this.element = element;
    this.container = null;
    this.state = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,      // Future
      opacity: 1,       // Future
      zIndex: 0,        // Future
      // Element-type specific
      fontSize: null,
      textAlign: null,
    };
    this.capabilities = [];
  }

  getState() { return { ...this.state }; }
  setState(updates) { /* update state and DOM */ }
  toQmdAttributes() { /* generate {.absolute ...} string */ }
}
```

### 2. Capability/Plugin System

Register capabilities per element type:

```javascript
const CAPABILITIES = {
  move: { /* drag logic */ },
  resize: { /* resize logic */ },
  rotate: { /* rotation logic - future */ },
  fontControls: { /* font size, alignment */ },
  editText: { /* contentEditable toggle */ },
};

const ELEMENT_CAPABILITIES = {
  img: ['move', 'resize', 'rotate'],
  div: ['move', 'resize', 'fontControls', 'editText'],
  video: ['move', 'resize'],  // Future
};
```

### 3. Control Registry

Separate control creation from element setup:

```javascript
const ControlRegistry = {
  controls: new Map(),

  register(name, config) {
    // config: { icon, ariaLabel, title, onClick, appliesTo }
    this.controls.set(name, config);
  },

  getControlsFor(elementType) {
    return [...this.controls.values()]
      .filter(c => c.appliesTo.includes(elementType));
  }
};

// Registration
ControlRegistry.register('decreaseFont', {
  icon: 'A-',
  ariaLabel: 'Decrease font size',
  onClick: (element) => changeFontSize(element, -2),
  appliesTo: ['div'],
});

ControlRegistry.register('rotate', {
  icon: '↻',
  ariaLabel: 'Rotate element',
  appliesTo: ['img', 'div'],  // Future
});
```

### 4. Interaction Handlers Module

Separate input handling from business logic:

```javascript
// interactions.js
const Interactions = {
  createDragHandler(element, callbacks) {
    return {
      onStart: (e) => { /* ... */ },
      onMove: (e) => { /* ... */ },
      onEnd: (e) => { /* ... */ },
    };
  },

  createResizeHandler(element, callbacks) { /* ... */ },
  createRotateHandler(element, callbacks) { /* ... */ },  // Future

  // Unified mouse/touch handling
  attachPointerEvents(target, handlers) {
    target.addEventListener('mousedown', handlers.onStart);
    target.addEventListener('touchstart', handlers.onStart);
    // ... etc
  }
};
```

### 5. Property Serializer

Generic property serialization:

```javascript
const PropertySerializers = {
  width: (v) => `width=${round(v)}px`,
  height: (v) => `height=${round(v)}px`,
  left: (v) => `left=${round(v)}px`,
  top: (v) => `top=${round(v)}px`,
  rotation: (v) => v !== 0 ? `data-rotation="${v}"` : null,  // Future
  fontSize: (v) => v ? `font-size: ${v}px` : null,
  textAlign: (v) => v ? `text-align: ${v}` : null,
};

function serializeElement(state) {
  const attrs = [];
  const styles = [];

  for (const [key, value] of Object.entries(state)) {
    const serializer = PropertySerializers[key];
    if (serializer && value != null) {
      const result = serializer(value);
      if (result) {
        if (key === 'fontSize' || key === 'textAlign') {
          styles.push(result);
        } else {
          attrs.push(result);
        }
      }
    }
  }

  let str = `{.absolute ${attrs.join(' ')}`;
  if (styles.length) str += ` style="${styles.join(' ')}"`;
  str += '}';
  return str;
}
```

---

## Proposed File Structure

```
_extensions/editable/
├── editable.js          # Main entry point, plugin init
├── editable.lua         # Quarto filter (unchanged)
├── editable.css         # Styles (unchanged)
├── modules/
│   ├── state.js         # EditableElement class, state management
│   ├── capabilities.js  # Capability definitions (move, resize, rotate)
│   ├── controls.js      # Control registry and UI creation
│   ├── interactions.js  # Mouse/touch/keyboard handlers
│   ├── serializer.js    # State to QMD attribute conversion
│   └── utils.js         # Shared utilities (scale, coordinates)
```

**Note:** For a Quarto extension, these would likely be bundled into a single file, but the logical separation helps maintainability.

---

## Migration Path

### Phase 1: Extract Utilities (Low risk) ✅ COMPLETE
- Extract `getSlideScale`, `getClientCoordinates` to utils
- Combine `handleMouseMove`/`handleTouchMove`
- Extract shared logic from `saveMovedElts`/`copyQmdToClipboard`

### Phase 2: State Management (Medium risk) ✅ COMPLETE
- Create `EditableElement` class with centralized state
- Create `editableRegistry` Map to track all elements
- Refactor dimension extraction to use `toDimensions()` method
- State updates for font size and alignment changes
- Keyboard navigation uses state via `setState()`/`getState()`

### Phase 3: Capability System (Medium risk)
- Define capability interface
- Extract move/resize logic into capabilities
- Register capabilities per element type

### Phase 4: Control Registry (Low risk)
- Create control registry
- Migrate existing controls to registry
- Add rotation control

---

## Example: Adding Rotation (After Refactoring)

```javascript
// 1. Add to capabilities.js
Capabilities.register('rotate', {
  init(element) {
    element.state.rotation = 0;
  },
  createHandle(element) {
    return createRotateHandle(element);
  },
  onInteraction(element, angle) {
    element.setState({ rotation: angle });
    element.container.style.transform = `rotate(${angle}deg)`;
  }
});

// 2. Add to serializer.js
PropertySerializers.rotation = (v) =>
  v !== 0 ? `data-rotation="${v}"` : null;

// 3. Register for element types
ELEMENT_CAPABILITIES.img.push('rotate');
ELEMENT_CAPABILITIES.div.push('rotate');

// 4. Add CSS
.editable-container {
  transform-origin: center center;
}
.rotate-handle { /* styles */ }
```

---

## Summary

| Area | Current | Proposed |
|------|---------|----------|
| Element setup | 1 monolithic function | Composable capabilities |
| State | Scattered in DOM/variables | Centralized state object |
| Controls | Hardcoded per element type | Registry-based |
| Properties | Hardcoded in multiple places | Generic serializers |
| Event handling | Duplicated code | Unified pointer handling |

This refactoring would make adding rotation a ~50 line change instead of modifying 10+ places in the codebase.
