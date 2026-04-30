# Claude Code Guidelines for quarto-revealjs-editable

## Project Overview

Quarto extension that makes reveal.js presentation elements (images, divs) editable in the browser. Users can drag, resize, rotate elements and save changes back to the source QMD file.

## Reference Documents

Read these before making non-trivial changes:

- **`ARCHITECTURE.md`** — deep technical reference: data flow diagrams, full save pipeline, modify mode lifecycle, arrow data model, image panel state properties. Read this when working on serialization, modify mode, arrows, or anything where the how-it-works matters.
- **`CONTRIBUTING.md`** — checklists for adding features, properties, element types, and tests. Read this when implementing anything new — it lists every file that needs updating and has caused repeated CI failures when skipped.

## Key Files

```
_extensions/editable/
├── src/             # ← EDIT THESE (JavaScript source modules)
│   └── __tests__/   # Vitest unit tests
├── editable.js      # GENERATED — bundled output, do not edit directly
├── quill.css        # GENERATED — bundled from node_modules, do not edit directly
├── editable.css     # Styles with CSS custom properties — edit this for styling
├── editable.lua     # Lua filter for Quarto processing
├── _extension.yml   # Quarto extension manifest
├── _schema.yml      # Extension schema
└── _snippets.json   # Editor snippets

testing/
├── e2e/             # Playwright tests (*.spec.js)
├── *.qmd            # Test documents
├── run-tests.sh     # Shell tests
├── README.md        # Test fixture docs
├── playwright.config.js
└── package.json     # npm dependencies

docs/                # Quarto documentation website (*.qmd source files)

CONTRIBUTING.md      # Contribution guidelines and checklists
NEWS.md              # Changelog
ARCHITECTURE.md      # Technical architecture details
README.md            # User-facing documentation
```

## Architecture Patterns

### Concept-to-File Map

| Concept | File |
|---|---|
| `EditableElement` class, `editableRegistry` | `src/editable-element.js` |
| `Capabilities`, `ELEMENT_CAPABILITIES` | `src/capabilities.js` |
| `PropertySerializers`, QMD transformation | `src/serialization.js` |
| `ControlRegistry`, `ToolbarRegistry`, `NewElementRegistry` | `src/registries.js` |
| Toolbar UI, swappable right panels | `src/toolbar.js` |
| Arrow SVG system | `src/arrows.js` |
| Modify mode classifier registry (opt-in per-element editing) | `src/modify-mode.js` |
| Undo/redo stacks | `src/undo.js` |
| Save / copy to clipboard | `src/io.js` |
| Image/video controls (crop, flip, opacity) | `src/images.js` |
| Quill rich text editor integration | `src/quill.js` |
| Brand color palette | `src/colors.js` |
| Cross-module deselect coordination | `src/selection.js` |
| Element lifecycle, DOM wrapping | `src/element-setup.js` |
| Global constants | `src/config.js` |
| Utility functions, slide index math | `src/utils.js` |

### Core Classes
- `EditableElement` - Wraps each editable DOM element with state management
  - `state` object tracks position, size, rotation, font size, alignment
  - `syncToDOM()` / `syncFromDOM()` - Sync state with DOM
  - `toDimensions()` - Serialize state for QMD output

### Modify Mode
Activated via the toolbar "Modify" button. Lets the user click plain (non-editable) elements on the current slide to make them editable. Elements are classified by a `ModifyModeClassifier` registry into:
- **valid** — green ring, clickable to activate
- **warn** — amber ring, not clickable (e.g. element inside a figure with siblings)
- **ignored** — already editable or unrecognised

Use `ModifyModeClassifier.register()` to add support for new element types.

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
- `editText` - Quill rich text editing

`ELEMENT_CAPABILITIES` maps element types to their capabilities:
- `img` → move, resize, rotate
- `video` → move, resize, rotate
- `div` → move, resize, rotate, fontControls, editText

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

## Known Constraints

- **Vertical slides not supported** — only horizontal (`indexh`) slides; `indexv` is not processed
- **Slide separators** — only `##` headings are recognized as slide boundaries; `---` is not supported
- **No `console.log`** in production code
- **New E2E spec files need a `quarto render` entry in `run-tests.sh`** — CI runs `run-tests.sh` before Playwright; any spec that throws `'Run quarto render ... first'` will fail in CI if the render step is missing. This has caused repeated failures — don't skip it.

## Development Loop

**JavaScript changes** (`src/` files): must rebuild before testing.

```bash
# 1. Rebuild the bundle (run from _extensions/editable/)
cd _extensions/editable && npm run build

# 2. Re-render the relevant test fixture (run from testing/)
cd testing && quarto render basic.qmd   # or whichever fixture is relevant

# 3. Then run tests
```

**Lua changes** (`editable.lua`): no build step needed, just re-render.

```bash
cd testing && quarto render basic.qmd
```

Never edit `_extensions/editable/editable.js` or `quill.css` directly — both are overwritten by every build.

## Testing

All test commands must be run from their respective directories.

```bash
# Unit tests — fast, run after changes to serialization/colors/undo/utils/arrows math
cd _extensions/editable && npm run test:run

# Shell tests — verify Quarto rendering and _input_file injection
cd testing && ./run-tests.sh

# E2E tests — full browser behavior
cd testing && npm run test:e2e

# Single E2E spec file
cd testing && npx playwright test e2e/arrows.spec.js --reporter=list

# Re-render a specific test fixture after a build
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

### Adding a new element type
Touch all of these:
- `src/capabilities.js` — add entry to `ELEMENT_CAPABILITIES`
- `src/element-setup.js` — handle DOM wrapping for the new type
- `src/modify-mode.js` — register a `ModifyModeClassifier` so modify mode can classify it
- `src/serialization.js` — add any new `PropertySerializers` entries

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

After any non-trivial change, update the relevant docs. Use the full checklist in `CONTRIBUTING.md`; the table below maps change type to affected files:

| Change type | Files to update |
|---|---|
| Any user-visible feature | `NEWS.md` (under `[Unreleased]`), `README.md`, `docs/features.qmd` |
| New/changed state property | `ARCHITECTURE.md` (state table), `CONTRIBUTING.md` (checklist) |
| New capability | `ARCHITECTURE.md`, `CONTRIBUTING.md` |
| New serializer | `ARCHITECTURE.md` (PropertySerializers section) |
| New/changed CSS custom property | `README.md` (CSS Customization section) |
| New E2E spec or test fixture | `testing/README.md`, `testing/run-tests.sh` (add `quarto render`) |
| New keyboard shortcut | `README.md` (Keyboard Navigation section) |
