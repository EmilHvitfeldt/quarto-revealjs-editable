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
| `modify-mode-absolute.qmd` | `{.absolute}` divs detectable in modify mode | #119       |
| `modify-mode-absolute-img.qmd` | `{.absolute}` images detectable in modify mode | #122   |
| `modify-mode-fenced-div.qmd` | Fenced divs (classed, callouts, columns) detectable in modify mode | #108 |
| `modify-mode-inline-img.qmd` | Inline images (`text ![](src) text`) detectable in modify mode | #120 |
| `modify-mode-arrows.qmd` | Positioned arrows from previous-save shortcodes detectable in modify mode | #118 |
| `modify-mode-code.qmd`   | Non-executed display code blocks detectable in modify mode | #111 |
| `modify-mode-code-output.qmd` | Code chunk outputs (`{ojs}`, `{r}`, `{python}`) detectable in modify mode | #113 |

> **Important for contributors:** Every `.spec.js` file that uses a dedicated `.qmd` fixture must have a corresponding `quarto render` step in `run-tests.sh`. CI runs `run-tests.sh` before Playwright — if the render step is missing, all tests in that spec will fail with "Run quarto render ... first".

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

**Total: 247 E2E tests across 8 spec files**

**`e2e/image-panel.spec.js`** - Image context panel (14 tests):

| Test | What it verifies |
|---|---|
| Panel exists in DOM on load (hidden) | `.toolbar-panel-image` present with `.image-style-controls`, hidden by default |
| Panel shows on image click | Image panel visible, default panel hidden |
| Panel hides on outside click | Default panel returns after clicking outside |
| Opacity slider updates image | `img.style.opacity` set correctly |
| Opacity slider syncs to state | `editableRegistry` state reflects slider value |
| Border radius input updates image | `img.style.borderRadius` set to `Xpx` |
| Crop button toggles crop-mode class | `.editable-container.crop-mode` added/removed |
| Clicking crop button again exits crop mode | `crop-mode` class removed |
| Dragging nw handle in crop mode updates cropTop/Left | `state.cropTop/Left > 0`, `clip-path` set |
| Handles reposition to match crop insets | Handle inline `top`/`left` match `cropTop/Left - 6px` |
| Exiting crop mode resets handle inline styles | Handle `style.top`/`left` cleared |
| Flip H applies scaleX(-1) | `img.style.transform` contains `scaleX(-1)` |
| Flip V applies scaleY(-1) | `img.style.transform` contains `scaleY(-1)` |
| Flip H and V together | Both scale transforms present |
| Reset reverts all style properties | opacity, borderRadius, transform cleared in DOM and state |
| Ctrl+Z undoes opacity change | Opacity reverts after keyboard undo |
| Image properties serialize to QMD | `opacity:`, `border-radius:` in style string |
| Crop values serialize as clip-path | `clip-path: inset(T R B L)` in style string |
| Replace stores filename in state.src | `state.src === 'new-photo.png'` |
| Replace src included in toDimensions | `dims.src` present when set |
| replaceEditableOccurrences updates image src | `](new-photo.png)` replaces `](old-photo.png)` |
| replaceEditableOccurrences preserves src when null | `](old-photo.png)` unchanged |
| Replacing image recalculates height for aspect ratio | New height = width × (naturalH / naturalW) |
| Flip serializes as scaleX/scaleY | Flips produce correct `transform:` in QMD |
| Rotation and flip compose | Single `transform:` declaration for both; correct values |
| Panel controls sync on re-select | Slider/input values match state when image re-selected |

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

**`e2e/modify-mode.spec.js`** - Modify Mode — images and headings (9 tests):

| Test | What it verifies |
|---|---|
| Modify button exists and is enabled | `.toolbar-modify` visible and not disabled |
| Clicking Modify highlights valid images | `img.modify-mode-valid` count > 0 on current slide |
| Clicking valid image makes it editable | `.editable-container img` appears; toolbar stays active |
| Clicking Modify again exits modify mode | `modify-mode-valid` and `active` classes removed |
| Modified image serializes to correct slide chunk | `{.absolute` only in activated slide's chunk |
| Same image on two slides: modifying slide 1 does not affect slide 2 | `{.absolute` only in slide 1 chunk |
| h2 title is classified as valid in modify mode | `h2.modify-mode-valid` count = 1 |
| Clicking h2 title makes it contentEditable and exits modify mode | `h2[contenteditable="true"]` present |
| Editing h2 title serializes back to QMD | `## Updated Title` in the serialized chunk |

**`e2e/modify-mode-code.spec.js`** - Modify Mode — Display code blocks (5 tests):

| Test | What it verifies |
|---|---|
| Highlighted code-block wrapper gets `modify-mode-valid` | `div.code-copy-outer-scaffold.modify-mode-valid` count = 1 |
| Plain (no-language) `<pre>` is clickable | `pre.modify-mode-valid` count = 1 |
| Clicking a valid code block wraps it in `editable-container` | `.editable-container` appears |
| Multiple code blocks on a slide are all classified valid | Both wrappers stamped with `data-editable-modified-code-idx` |
| Serialize wraps activated code block in fenced div with absolute position | `::: {.absolute …}` surrounds the original ` ``` ` fence |

**`e2e/modify-mode-code-output.spec.js`** - Modify Mode — Code chunk outputs (7 tests):

| Test | What it verifies |
|---|---|
| Fresh OJS cell gets `modify-mode-valid` class | `div.cell.modify-mode-valid` count = 1 |
| Cell has move+resize but not text-editing capabilities | No `.ql-editor` or font-size controls in the container |
| Multiple fresh cells on a slide are all classified valid | Both `div.cell` cells get the green ring |
| Plain code block alongside fresh OJS cell — both classifiers apply without conflict | Code blocks classifier handles the plain ` ``` `, Code chunk outputs handles the `{ojs}` cell |
| `echo=true` cell (visible source + output) is classified and wraps whole chunk on save | `sourceCode cell-code` is not `hidden`; serialize wraps the chunk including the `#\| echo: true` option line |
| Serialize wraps activated fresh cell in fenced div with absolute position | `::: {.absolute …}` surrounds the original ` ```{ojs} ` chunk |
| Already-positioned cells (from previous save) are not double-claimed | Cell inside `div.absolute` gets no green ring; the wrapper is claimed by Positioned divs instead |

**`e2e/modify-mode-arrows.spec.js`** - Modify Mode — Positioned arrows (7 tests):

| Test | What it verifies |
|---|---|
| Positioned arrows on slide get `modify-mode-valid` | Count = number of `position="absolute"` arrows in source |
| Inline arrows (no `position="absolute"`) are not classified | Inline `{{< arrow >}}` does not produce a green ring |
| Arrows with unsupported kwargs (`bend`, etc.) are warn-classified | `modify-mode-warn` ring; not clickable |
| Clicking a valid arrow makes it editable | `.editable-arrow-container.active` with handles appears |
| Arrow style panel shows source values after activation | `toolbar-panel-arrow` visible; width/color inputs reflect source kwargs |
| Serialize updates the activated arrow's shortcode in QMD source | Coordinates rewritten in-place; other shortcodes untouched |
| Non-activated arrows remain unchanged in saved QMD | Source kwargs (`color`, `width`, `bend`) preserved verbatim |

**`e2e/modify-mode-inline-img.spec.js`** - Modify Mode — Inline images (5 tests):

| Test | What it verifies |
|---|---|
| Inline image inside paragraph is classified as valid | `p img.modify-mode-valid` count = 1 |
| Parent paragraph of an inline image is NOT classified as valid | `p.modify-mode-valid` count = 0 |
| Clicking inline image activates only the image and exits modify mode | `.editable-container img` appears, modify mode inactive |
| Serialize replaces inline image src with `.absolute` attributes | Paragraph text preserved, image gains `{.absolute ...}`, paragraph not wrapped in fenced div |
| Multiple inline images in same paragraph: only the clicked one is modified | One occurrence has `.absolute`, the other keeps original `{width=40px}` |

**`e2e/modify-mode-absolute.spec.js`** - Modify Mode — `{.absolute}` divs (6 tests):

| Test | What it verifies |
|---|---|
| `div.absolute` elements get `modify-mode-valid` class | Count > 0 when modify mode entered |
| Clicking valid `div.absolute` wraps it in editable-container | `.editable-container div.absolute` appears |
| Container left/top matches original inline style | `container.style.left/top` ≈ original values after position fix |
| Serialize updates the correct `{.absolute}` block | Slide 1 updated; slide 2 original values intact |
| Two `div.absolute` on same slide both get `modify-mode-valid` | Count = 2 on slide 2 |
| Both divs on slide 2 serialize independently | Two `{.absolute` blocks in slide 2 chunk after activating both |

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
| #102  | Image context panel                  | `e2e/image-panel.spec.js`                 |
| #26   | Undo/redo support                    | E2E (Undo/Redo section)                   |
