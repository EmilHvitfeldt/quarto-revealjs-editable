# Contributing Guide

This document provides checklists and guidelines for contributing to the quarto-revealjs-editable extension.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/EmilHvitfeldt/quarto-revealjs-editable.git
cd quarto-revealjs-editable

# Install extension build dependencies
cd _extensions/editable
npm install

# Install test dependencies
cd ../../testing
npm install
npx playwright install chromium
```

## Building the JavaScript

The JavaScript source code is in `_extensions/editable/src/` and is bundled into `editable.js` using esbuild.

```bash
cd _extensions/editable

# Build once
npm run build

# Build and watch for changes (development)
npm run watch

# Build minified (production)
npm run build:minify
```

**Important:** After making JavaScript changes in `src/`, you must run `npm run build` before testing.

## Running Tests

```bash
# Shell tests (fast, checks Quarto rendering)
cd testing
./run-tests.sh

# E2E tests (browser-based, checks JavaScript)
npm run test:e2e
```

**Important:** After making JavaScript changes:

```bash
# 1. Rebuild the bundled JS
cd _extensions/editable
npm run build

# 2. Rebuild the test HTML
cd ../../testing
quarto render basic.qmd
```

---

## Adding a New Feature Checklist

### 1. JavaScript Implementation (`_extensions/editable/src/`)

- [ ] **State management** - If the feature needs persistent state:
  - [ ] Add property to `EditableElement.state` (with default value)
  - [ ] Update `syncToDOM()` to apply state to DOM
  - [ ] Update `syncFromDOM()` to read state from DOM
  - [ ] Update `toDimensions()` to include state in serialization output

- [ ] **Capability** - If the feature is a new interaction type (like move, resize, rotate):
  - [ ] Create new capability in `Capabilities` object with:
    - `name` - Capability identifier
    - `init(context)` - Initialize capability state
    - `createHandles(context)` or `createControls(context)` - Create UI elements
    - `attachEvents(context)` - Attach event listeners
    - `onMove(context, e)` - Handle pointer movement (if applicable)
    - `onStop(context)` - Cleanup when interaction ends
    - `isActive(context)` - Return whether capability is currently active
    - `handleKeyboard(context, e, editableElt)` - Handle keyboard input (if applicable)
  - [ ] Add capability to `ELEMENT_CAPABILITIES` for relevant element types

- [ ] **Control button** - If the feature needs a UI button:
  - [ ] Register with `ControlRegistry.register()` providing:
    - `icon` - Button text/icon
    - `ariaLabel` - Accessibility label
    - `title` - Tooltip text
    - `className` - CSS class for styling
    - `appliesTo` - Array of element types (`["img"]`, `["div"]`, or `["img", "div"]`)
    - `onClick` - Click handler function

- [ ] **Serialization** - If the feature saves to QMD:
  - [ ] Add entry to `PropertySerializers` with:
    - `type` - Either `"attr"` (goes in attribute list) or `"style"` (goes in style attribute)
    - `serialize(value)` - Function returning the QMD string (or `null` to skip)

- [ ] **Undo support** - Add `pushUndoState()` call before state changes

- [ ] **Keyboard passthrough** - If adding keyboard shortcuts, update existing capabilities to pass through your modifier key combination

### 2. CSS (`_extensions/editable/editable.css`)

- [ ] Add CSS custom properties to `:root` for theming (colors, sizes, etc.)
- [ ] Add styles for new UI elements (handles, buttons, containers)
- [ ] Use existing custom properties where appropriate for consistency
- [ ] Include hover/focus/active states with `.editable-container.active` selector

### 3. Tests

- [ ] **E2E tests** (`testing/e2e/ui-controls.spec.js`):
  - [ ] Test that UI elements are created with correct attributes
  - [ ] Test that state changes work correctly
  - [ ] Test keyboard shortcuts (if applicable)
  - [ ] Test serialization to QMD (if applicable)
  - [ ] Test undo/redo integration (if applicable)
  - [ ] Test CSS custom properties (if applicable)

- [ ] **If adding a new `.spec.js` with its own `.qmd` fixture**:
  - [ ] Add `quarto render` for the new `.qmd` to `testing/run-tests.sh` (under `--- Modify Mode Tests ---` or a relevant section). CI runs `run-tests.sh` before Playwright, so any spec that calls `throw new Error('Run quarto render ... first')` will fail in CI if this step is missing. This has caused repeated CI failures — don't skip it.

- [ ] **Rebuild test HTML** after JavaScript changes:
  ```bash
  cd testing && quarto render basic.qmd
  ```

- [ ] **Run all tests**:
  ```bash
  ./run-tests.sh
  npm run test:e2e
  ```

### 4. Documentation

- [ ] **README.md** - User-facing documentation:
  - [ ] Update feature description if needed
  - [ ] Add usage instructions (mouse and keyboard)
  - [ ] Update Keyboard Navigation section if adding shortcuts
  - [ ] Update Undo/Redo section if tracking new state
  - [ ] Update CSS Customization section if adding custom properties

- [ ] **NEWS.md** - Changelog:
  - [ ] Add entry under `[Unreleased]` section
  - [ ] Include issue number if applicable

- [ ] **ARCHITECTURE.md** - Internal documentation:
  - [ ] Update state object if adding new properties
  - [ ] Update capability list if adding new capability
  - [ ] Update ELEMENT_CAPABILITIES mapping
  - [ ] Update PropertySerializers if adding serialization

- [ ] **testing/README.md** - Test documentation:
  - [ ] Add new test descriptions to appropriate section
  - [ ] Update issue coverage table if applicable

---

## Adding a New Property Checklist

For simpler additions that just need a new state property (not a full capability):

- [ ] Add to `EditableElement.state`
- [ ] Update `syncToDOM()` and `syncFromDOM()`
- [ ] Add `PropertySerializer`
- [ ] Add UI control via `ControlRegistry.register()` (optional)
- [ ] Add tests
- [ ] Update documentation

---

## Adding a New Element Type Checklist

To support a new HTML element type (e.g., `video.editable`):

- [ ] Update `getEditableElements()` query selector
- [ ] Add entry to `ELEMENT_CAPABILITIES` with appropriate capabilities
- [ ] Update Lua filter if special handling needed (`_extensions/editable/editable.lua`)
- [ ] Add test file for new element type
- [ ] Update documentation

---

## Adding a Positioned (Re-activation) Classifier Checklist

When a typed element gets saved it ends up wrapped in `::: {.absolute …}` (or carrying `{.absolute}` itself). To let modify mode re-activate that saved form, add a *positioned* classifier alongside the first-activation one. Read the "Re-activating Already-Positioned Elements" section in `ARCHITECTURE.md` first.

- [ ] Activate the **inner element**, not the `div.absolute` wrapper — the wrapper is source-anchor metadata only. This is the project-wide rule; see `ARCHITECTURE.md`.
- [ ] Build the classifier with `makePositionedClassifier(...)` from `src/modify-mode-positioned.js` and register it via `ModifyModeClassifier.register(...)`.
- [ ] **Register before `Positioned divs` and `Fenced divs`.** Outer classifiers filter out inner elements claimed by typed positioned classifiers; that filtering only works if the typed classifier registered first.
- [ ] Use `findFenceForPositionedElement` with appropriate `Anchors` to locate the wrapping fence in the slide chunk. Prefer identity anchors (`byId`, `byClass`, type-specific) over `byPosition`/`byIndex` so caption edits and reordering don't break the match.
- [ ] In the first-activation classifier's `classify()`, drop any inline `.absolute` filter — now redundant since `isAlreadyPositioned(el)` is the canonical check and the typed positioned classifier claims the wrapper first.
- [ ] Add an E2E fixture in `testing/` rendering an already-positioned instance, and add the `quarto render` call for that fixture to `testing/run-tests.sh` (CI runs this before Playwright; missing render steps have caused repeated failures).
- [ ] Add a unit test asserting the registration order: the typed positioned classifier is registered before `Positioned divs` and `Fenced divs`.
- [ ] Update `NEWS.md`, `README.md`, and `docs/features.qmd` (re-activation is a user-visible feature).

---

## Code Style Guidelines

- Use `const` for constants, `let` for variables that change
- Use meaningful names for functions and variables
- Add comments for complex logic
- Keep functions focused and reasonably sized
- Use the capability system for new interaction types
- Use CSS custom properties for all visual styling
- Include ARIA attributes for accessibility

---

## Pull Request Checklist

Before submitting a PR:

- [ ] All shell tests pass (`./run-tests.sh`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Documentation is updated
- [ ] NEWS.md has an entry for the change
- [ ] Code follows existing patterns and style
