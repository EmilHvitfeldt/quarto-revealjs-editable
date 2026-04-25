# Testing

This extension has two types of tests:

1. **Shell tests** - Fast, checks that Quarto renders correctly
2. **E2E tests** - Browser-based, checks that "Save Edits" works

## Quick Start

```bash
# Run the basic tests (just needs Quarto)
./run-tests.sh

# Run browser tests too (needs Node.js)
npm install
npm run test:e2e
```

---

## Shell Tests (`run-tests.sh`)

**What they test:** Rendering works, content is preserved in base64 encoding

**Requirements:** Just Quarto

**When to run:** Always - these are the main tests

```bash
./run-tests.sh
```

### Test Files

| File                     | What it tests                             | Related Issue |
|--------------------------|-------------------------------------------|---------------|
| `basic.qmd`              | Basic image and text editable             | -             |
| `no-editable.qmd`        | No injection when no `.editable` elements | -             |
| `special-chars.qmd`      | Backslashes, LaTeX, trailing spaces       | #16           |
| `shortcode.qmd`          | Quarto shortcodes in editable divs        | #15           |
| `utf8.qmd`               | Accented characters and emoji             | -             |
| `include-header.qmd`     | Custom scripts in header don't break      | #21           |
| `windows-paths.qmd`      | Windows-style paths with backslashes      | #13, #14      |
| `round-trip.qmd`         | LaTeX + shortcodes + backslashes together | #15, #16      |
| `latex.qmd`              | Complex LaTeX equations                   | #16           |
| `multiple-elements.qmd`  | Multiple images and divs in one document  | -             |
| `colons-in-content.qmd`  | Content with colons (regex fix)           | -             |
| `bare-syntax.qmd`        | Both `::: editable` and `::: {.editable}` | -             |
| `space in name.qmd`      | Filenames with spaces handled correctly   | -             |

### What the shell tests check

1. **Render succeeds** - Quarto doesn't error
2. **Injection works** - `window._input_file` appears in HTML (or doesn't when not needed)
3. **Content preserved** - Base64-decoded content contains expected patterns (`\frac`, `{{< meta >}}`, etc.)
4. **Clipboard code exists** - The `copyQmdToClipboard` function is present

---

## E2E Tests (Playwright)

**What they test:** JavaScript works correctly in a real browser

**Requirements:** Node.js + Playwright

**When to run:** When changing JavaScript code, or before releases

```bash
npm install                    # First time only
npx playwright install chromium  # First time only
npm run test:e2e
```

### E2E Test Files

**Total: 227 E2E tests across 5 spec files**

**`e2e/save-edits.spec.js`** - Core save functionality (8 tests):

| Test                          | What it verifies                                   |
|-------------------------------|---------------------------------------------------|
| Save Edits transforms content | `{.editable}` → `{.absolute width=... height=...}` |
| Containers wrapped correctly  | `position: absolute` and resize handles            |
| Dimensions extracted          | `extractEditableEltDimensions()` returns valid data |
| Clipboard works               | `copyQmdToClipboard()` writes to clipboard         |
| Shortcodes in base64          | `{{< meta title >}}` preserved in source           |
| Content with colons           | Div content with `:` handled correctly (regex fix) |
| Both div syntaxes work        | `::: editable` and `::: {.editable}` both work     |
| LaTeX preserved               | `\dfrac`, `\lambda` survive save                   |

**`e2e/ui-controls.spec.js`** - UI elements (23 tests + see sections below):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| Font controls exist              | 6 buttons (A-, A+, align×3, edit)                 |
| Font size changes                | Style updates correctly                           |
| Text alignment works             | `textAlign` style can be set                      |
| Edit mode works                  | `contentEditable` toggles                         |
| Resize handles created           | 4 handles (nw, ne, sw, se)                        |
| Menu buttons added               | Save & Copy buttons in menu                       |
| Dragging image                   | Container position changes after drag             |
| Resizing image                   | Element dimensions change after resize            |
| Dragging div                     | Div container position changes after drag         |
| Resize with shift key            | Aspect ratio preserved during resize              |
| Resize from NW corner            | Position adjusts when resizing from top-left      |
| Resize minimum size              | Cannot resize below 50px                          |
| Font size decrease minimum       | Cannot decrease font below 8px                    |
| Font size increase button        | A+ button increases font size                     |
| Alignment buttons                | Left/center/right buttons set `textAlign`         |
| Edit mode button                 | Edit button toggles `contentEditable`             |
| Multiple elements independent    | Each element has its own container and handlers   |
| Multiple elements dimensions     | `extractEditableEltDimensions()` returns all      |
| No global variable pollution     | Save functions don't leak globals                 |
| Missing _input_file handled      | Graceful error when filter not applied            |
| Dimension rounding               | Output values rounded to 1 decimal place          |
| htmlToQuarto conversion          | `<strong>`→`**`, `<em>`→`*`, `<code>`→backticks   |
| Strikethrough conversion         | `<del>`→`~~`                                      |

**`e2e/ui-controls.spec.js`** - Accessibility (8 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| Containers focusable             | `tabindex="0"`, `role`, `aria-label` attributes   |
| Resize handles ARIA labels       | Each handle has `role="slider"` and label         |
| Font buttons ARIA labels         | All 6 buttons have `aria-label` attributes        |
| Focus shows controls             | Controls appear on focus (not just hover)         |
| Arrow keys move element          | Keyboard navigation moves element by 10px         |
| Shift+Arrow keys resize          | Keyboard navigation resizes element               |
| Keyboard resize min size         | Cannot resize below 50px with keyboard            |
| Shift+Tab blurs container        | Returns to normal slide navigation                |

**`e2e/ui-controls.spec.js`** - CSS Customization (7 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| Container class                  | `.editable-container` class applied               |
| Handle position classes          | `.handle-nw`, `.handle-ne`, etc. classes          |
| Font controls class              | `.editable-font-controls` class applied           |
| Button class                     | `.editable-button` class on all buttons           |
| CSS custom properties loaded     | Default values from editable.css                  |
| CSS properties overridable       | Custom values can override defaults               |
| Active class toggle              | `.active` class can be toggled                    |

**`e2e/ui-controls.spec.js`** - Undo/Redo (7 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| Undo stack functions exist       | `undo`, `redo`, `canUndo`, `canRedo` available    |
| Undo reverts drag position       | Position restored after undo                      |
| Redo restores undone action      | Redo brings back undone changes                   |
| canUndo false when empty         | Returns false when stack is empty                 |
| canUndo true after action        | Returns true after pushUndoState                  |
| New action clears redo stack     | Redo stack cleared when new action taken          |
| Ctrl+Z triggers undo             | Keyboard shortcut works                           |

**`e2e/ui-controls.spec.js`** - Rotation (10 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| Rotate handle created            | `.rotate-handle` exists with proper ARIA          |
| Rotate handle for div            | Divs also have rotate handles                     |
| Rotation state in EditableElement| `rotation` property in state                      |
| setState for rotation            | Rotation updates DOM transform                    |
| Rotation serialized to QMD       | `transform: rotate(Xdeg)` in style attribute      |
| Zero rotation not serialized     | No transform when rotation is 0                   |
| Ctrl+Arrow rotates               | 5° rotation per keypress                          |
| Ctrl+Shift+Arrow rotates 15°     | Larger rotation step with Shift                   |
| Rotation in undo/redo            | Rotation changes can be undone                    |
| Rotate color CSS property        | `--editable-rotate-color` custom property         |

**`e2e/toolbar.spec.js`** - Floating Toolbar (4 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| Toolbar is created and visible   | Toolbar exists with handle, buttons, role="toolbar"|
| Toolbar has all expected buttons | Save, copy, add-text, add-slide buttons with ARIA |
| Toolbar is draggable             | Drag handle changes toolbar position              |
| Toolbar buttons have hover labels| Each button has .toolbar-icon and .toolbar-label  |

**`e2e/toolbar.spec.js`** - Add Text Element (7 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| addNewTextElement creates element| Element count increases, has .editable-new class  |
| New text element has resize handles| 4 resize handles, rotate handle, font controls   |
| New text element tracked in registry| NewElementRegistry tracks with correct count    |
| New text element edit mode works | contentEditable="true" when edit button clicked   |
| New text element can be edited   | Text content changes when typing in edit mode     |
| Arrow keys don't move in edit mode| Element position unchanged when editing text     |
| New text element centered on slide| Positioned within 30-70% of slide width/height   |

**`e2e/toolbar.spec.js`** - Add Slide (3 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| addNewSlide creates a new slide  | Slide count increases, has .editable-new-slide    |
| New slide tracked in registry    | NewElementRegistry tracks with correct count      |
| Reveal.js navigates to new slide | Reveal.getIndices().h incremented by 1            |

**`e2e/toolbar.spec.js`** - NewElementRegistry (4 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| Registry starts empty            | newDivs/newSlides empty, hasNewElements() false   |
| addDiv tracks divs               | Count, slideIndex, content stored correctly       |
| addSlide tracks slides           | Count and afterSlideIndex stored correctly        |
| clear resets state               | hasNewElements() changes from true to false       |

**`e2e/toolbar.spec.js`** - ToolbarRegistry (2 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| Has expected actions             | getActions() returns save, copy, addText, addSlide|
| createButton creates valid button| Correct tagName, classes, ARIA, title attributes  |

**`e2e/toolbar.spec.js`** - Save Integration for New Elements (30 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| New text excluded from original processing | getOriginalEditableElements() excludes new |
| getTransformedQmd includes new divs | QMD contains text and `::: {.absolute` syntax  |
| getTransformedQmd includes new slides | QMD contains `## New Slide` heading          |
| Multiple new elements saved correctly | Correct count of each element type           |
| Save includes new text in download | Downloaded QMD contains text with positioning  |
| Save includes new slide in download | Downloaded QMD contains `## New Slide`        |
| New slide at correct position    | `## New Slide` appears after correct slide heading|
| Add slide then add text to it    | Text appears after slide heading, before next    |
| Complex ordering (4,1,3,2)       | Slides inserted at various positions maintain order|
| 3 slides with text on 2nd        | All slides and markers in correct order (1,2,3)  |
| Text on original after adding new| Text on original slide, not new slide            |
| Multiple text on same new slide  | All 3 elements saved after slide heading         |
| New slides at different positions| Each group positioned correctly                  |
| Text positioning preserved       | x/y/width/height attributes saved                |
| Empty text element content       | Div block still saved when content cleared       |
| Special characters preserved     | Colons, braces, markdown, fences preserved       |
| Deep nesting of new slides       | 4 slides A→B→C→D in chain, correct order         |
| Mixed positions with text        | Slides with text after multiple originals        |
| Text only on last slide in chain | Text appears after third heading                 |
| Original modifications alongside | Both moved element AND new elements saved        |
| New slide after last original    | New slide appears at end of document             |
| Font styling saved               | fontSize and textAlign in saved QMD              |
| Rotation saved                   | `transform: rotate(45deg)` in saved QMD          |
| Copy to clipboard includes new   | Clipboard contains new elements                  |
| New slide with no content        | Empty slide heading still saved                  |
| Interleaved operations           | Add slide → text original → slide → text correct |
| Unicode and emoji preserved      | 中文, émojis 🎉 preserved in saved content       |
| Multi-line text preserved        | Newlines in content preserved                    |
| New slide between middle slides  | Correct position in multi-slide document         |
| Multiple text on different slides| Each text on correct corresponding slide         |

**`e2e/arrows.spec.js`** - Arrow Feature (92 tests):

| Category | Tests | Description |
|----------|-------|-------------|
| Toolbar Integration | 1 | Add submenu includes Arrow option |
| Arrow Extension Detection | 4 | Detection with/without extension, warning once, cancel aborts |
| Arrow Creation | 4 | Creates container, has elements, centered, starts active |
| Arrow Selection | 3 | Click outside deselects, click hit area selects, only one active |
| Handle Dragging | 3 | Start/end handles draggable, SVG path updates |
| Curve Mode | 8 | Toggle works, control handles appear, Bezier path, guide lines, active state |
| Title Slide Handling | 2 | Title slide detection, arrows on content slides |
| Serialization | 2 | Valid coordinates, Bezier path format |
| Save Without Editable | 1 | Save works with only arrows |
| Active State UI | 2 | Handles hidden/shown based on selection |
| Hit Area | 2 | Wider stroke for easy selection, matches visible path |
| Edge Cases - Multiple Arrows | 4 | Multiple arrows, unique IDs, selection |
| Edge Cases - Title Slide | 1 | Arrow on title slide |
| Edge Cases - Existing Arrows | 1 | Shortcode arrows rendered |
| Edge Cases - Coordinate Boundaries | 3 | Edge positions, zero length, short distance |
| Edge Cases - Slide Navigation | 2 | State preserved, immediate navigation |
| Edge Cases - Curve Mode | 3 | Control points adjust, rapid toggle, guide lines hidden |
| Edge Cases - Accessibility | 2 | ARIA attributes, keyboard focus |
| Edge Cases - Z-Index | 2 | Container and handle z-index |
| Edge Cases - Performance | 2 | Many arrows, responsiveness |
| Edge Cases - Copy | 1 | Clipboard includes arrows |
| Edge Cases - Hit Area Curves | 1 | Hit area follows curved path |
| Arrow Style Controls | 8 | Toolbar mode switching, color/width/head/dash/opacity/line controls |
| Color Presets | 6 | Presets exist, black first, swatch click, selection state, custom clears |
| Dash Style | 3 | Stroke-dasharray updates, scales with width, persists |
| Line Style | 5 | Double/triple lines, extra paths follow arrow, color/dash match |
| Opacity | 3 | Opacity 0, applies to extra lines, persists |
| Drag Arrow by Body | 4 | Body drag moves all points, curved arrows, grab cursor |
| Style Interactions | 2 | Multiple styles at once, default values for new arrows |
| Event Listener Cleanup | 4 | AbortControllers attached, not aborted, separate per arrow, drag works |

---

---

## Layout Considerations

The toolbar is a fixed 100px top bar. E2E tests that click toolbar buttons or measure viewport-relative positions should account for this offset:

- The toolbar occupies `y: 0–100px` in the viewport
- The reveal.js presentation area starts at `y: 100px`
- Toolbar buttons (Save, Copy, Add) are in the left zone; arrow style controls appear in the right zone when an arrow is selected

---

## Testing Conventions

### Save Integration Tests Must Verify Ordering

When writing tests for new element save functionality, **always verify the order** of elements in the saved QMD, not just their presence. Use `indexOf()` comparisons:

```javascript
// ✗ BAD: Only checks presence
expect(qmd).toContain('## New Slide');
expect(qmd).toContain('TEXT_MARKER');

// ✓ GOOD: Checks presence AND order
expect(qmd).toContain('## New Slide');
expect(qmd).toContain('TEXT_MARKER');
const slidePos = qmd.indexOf('## New Slide');
const textPos = qmd.indexOf('TEXT_MARKER');
expect(textPos).toBeGreaterThan(slidePos); // Text appears AFTER slide heading
```

For multiple elements, verify relative positions:
```javascript
const pos1 = qmd.indexOf('MARKER_1');
const pos2 = qmd.indexOf('MARKER_2');
const pos3 = qmd.indexOf('MARKER_3');
expect(pos1).toBeLessThan(pos2);
expect(pos2).toBeLessThan(pos3);
```

See `toolbar.spec.js` "New Elements in Save Flow" section for 30 examples.

### Edge Case Tests

`toolbar.spec.js` includes 26 edge case tests covering:

| Category | Tests | Description |
|----------|-------|-------------|
| Content that could break parsing | 6 | Fake headings, fence syntax, code blocks, list markers |
| Document structure | 1 | Title-only documents with no ## headings |
| Numeric/positioning | 6 | Negative rotation, boundary positions, decimal rounding |
| Insertion order | 4 | Deep nesting, wide trees, chained vs direct insertion |
| State management | 3 | Multiple saves, registry clearing, no-new-elements save |
| Text content | 4 | Whitespace, paragraphs, long text, HTML-like content |
| Output format | 2 | Fence closure validation, blank line formatting |

---

## CI Workflow

On GitHub Actions:

```
┌─────────────────────────────────────────┐
│         Shell tests (parallel)          │
├─────────────┬─────────────┬─────────────┤
│   Ubuntu    │   macOS     │   Windows   │
└──────┬──────┴──────┬──────┴──────┬──────┘
       └─────────────┼─────────────┘
                     ▼
              ┌─────────────┐
              │  E2E tests  │
              │  (Ubuntu)   │
              └─────────────┘
```

- Shell tests run on **all platforms** to catch OS-specific issues
- E2E tests run on **Ubuntu only** (JS behavior is the same everywhere)

---

## Issue Coverage

| Issue | Description                          | Covered by                                |
|-------|--------------------------------------|-------------------------------------------|
| #8    | Clipboard feature                    | Shell + E2E                               |
| #13   | Windows path separator               | `windows-paths.qmd`                       |
| #14   | Backslash corruption                 | `windows-paths.qmd`, `round-trip.qmd`     |
| #15   | Shortcodes resolved incorrectly      | `shortcode.qmd`, `round-trip.qmd`, E2E    |
| #16   | Backslashes removed (LaTeX)          | `special-chars.qmd`, `latex.qmd`, E2E     |
| #21   | Content leaks with include-in-header | `include-header.qmd`                      |
| #26   | Undo/redo support                    | E2E (Undo/Redo section)                   |
