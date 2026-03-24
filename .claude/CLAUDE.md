# Claude Code Guidelines for quarto-revealjs-editable

## Project Overview

Quarto extension that makes reveal.js presentation elements (images, divs) editable in the browser. Users can drag, resize, rotate elements and save changes back to the source QMD file.

## Key Files

```
_extensions/editable/
├── editable.js      # Main JavaScript
├── editable.css     # Styles with CSS custom properties
├── editable.lua     # Lua filter for Quarto processing
├── _extension.yml   # Quarto extension manifest
├── _schema.yml      # Extension schema
└── _snippets.json   # Editor snippets

testing/
├── e2e/             # Playwright tests (*.spec.js)
├── *.qmd            # Test documents
├── run-tests.sh     # Shell tests
├── playwright.config.js
└── package.json     # npm dependencies

docs/                # Quarto documentation website (*.qmd source files)

CONTRIBUTING.md      # Contribution guidelines and checklists
NEWS.md              # Changelog
ARCHITECTURE.md      # Technical architecture details
README.md            # User-facing documentation
```

## Architecture Patterns

### Core Classes
- `EditableElement` - Wraps each editable DOM element with state management
  - `state` object tracks position, size, rotation, font size, alignment
  - `syncToDOM()` / `syncFromDOM()` - Sync state with DOM
  - `toDimensions()` - Serialize state for QMD output

### Registries
- `ControlRegistry` - UI buttons for elements (font size, alignment, edit mode)
- `ToolbarRegistry` - Floating toolbar actions (save, copy, add)
- `NewElementRegistry` - Tracks dynamically added elements/slides/arrows
- `editableRegistry` - Maps DOM elements to EditableElement instances

### Capabilities System
Element behaviors defined in `Capabilities` object:
- `move` - Drag to reposition
- `resize` - Corner handles
- `rotate` - Top handle for rotation
- `fontControls` - Text size/alignment

`ELEMENT_CAPABILITIES` maps element types to their capabilities:
- `img` → move, resize, rotate
- `div` → move, resize, rotate, fontControls

### Serialization
`PropertySerializers` defines how state properties serialize to QMD:
- `type: "attr"` → goes in attribute list (e.g., `width=100px`)
- `type: "style"` → goes in style attribute (e.g., `style="left: 50px"`)

### Color System
- `getColorPalette()` - Returns brand colors if available, else defaults
- `getBrandColorOutput()` - Converts hex to `{{< brand color name >}}` shortcode
- Brand colors from `window._quarto_brand_palette` (injected by Quarto)

### Arrow System
- Arrows use SVG paths with draggable handles
- Curve mode adds Bezier control points
- Arrow styling controls replace toolbar buttons when arrow selected
- Serializes to `{{< arrow from="x,y" to="x,y" ... >}}` shortcode

## Testing

```bash
# Shell tests (fast, Quarto rendering)
cd testing && ./run-tests.sh

# E2E tests (browser, JavaScript behavior)
cd testing && npm run test:e2e

# Single spec file
npx playwright test arrows.spec.js --reporter=list

# After JS changes, rebuild test HTML
cd testing && quarto render basic.qmd
```

## Common Tasks

### Adding a toolbar action
```javascript
ToolbarRegistry.register("name", {
  icon: "...",
  label: "Label",
  title: "Tooltip",
  className: "toolbar-name",
  onClick: () => { ... }
});
```

### Adding arrow styling control
Add in `createArrowStyleControls()`, update `updateArrowStylePanel()` to sync values.

### Adding a property serializer
```javascript
PropertySerializers.propName = {
  type: "attr",  // or "style"
  serialize: (v) => `propName=${v}px`
};
```

## Code Conventions

- Use `const`/`let`, not `var`
- CSS custom properties for all visual styling (`--editable-*`)
- ARIA attributes for accessibility
- `pushUndoState()` before state changes
- Tests verify ordering with `indexOf()`, not just presence

## Documentation Updates

When adding features, follow the checklist in `CONTRIBUTING.md`. Key files to update:
- `NEWS.md` - Changelog entry under `[Unreleased]` (but fixes to features added in the same unreleased version don't need separate entries)
- `ARCHITECTURE.md` - Technical details (state, capabilities, serializers)
- `testing/README.md` - Test documentation
- `README.md` - User-facing docs (if applicable)
- `docs/features.qmd` - Documentation website (if user-visible feature)
