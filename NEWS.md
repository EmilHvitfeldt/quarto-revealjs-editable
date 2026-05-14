# Changelog

All notable changes to the quarto-revealjs-editable extension will be documented in this file.

## [Unreleased]

### Added

- **Modify mode** — a new way to make existing elements editable in the browser without marking them with `{.editable}` in source. Click the **Modify** button in the menu bar, then click any highlighted element on the current slide to activate it; on save, the change is written back to your `.qmd` as `{.absolute …}` positioning. Elements that can't be activated (e.g. multi-figure code chunks) show an amber warning ring with a reason.

  *Supported element types* (first-time activation):
  - **Images and videos**: plain images, inline images embedded mid-paragraph, plain videos
  - **Text blocks**: plain paragraphs (with Quill rich-text editing), bullet/ordered lists, blockquotes
  - **Structured blocks**: tables — pipe, grid, raw HTML, list-table (#117); display equations `$$…$$` (#115); non-executed display code blocks
  - **Executable chunks**: code-chunk outputs (HTML tables, printed text, interactive widgets) and Observable JS `{ojs}` (#113); single-figure code-chunk figures (#112); diagram chunks — Mermaid and Graphviz (#114)
  - **Containers**: fenced divs (classed, id-keyed, callouts, column layouts)
  - **Slide titles** (`## heading`) with an inline formatting toolbar (bold, italic, underline, strikethrough, text/background color)
  - **Positioned arrows** previously saved as `{{< arrow … position="absolute" >}}` shortcodes from the [`quarto-arrows`](https://github.com/EmilHvitfeldt/quarto-arrows) extension; arrows using kwargs not yet round-tripped (`bend`, `fragment`, `head-fill`, …) are warn-classified rather than silently dropped on save

  *Re-activating saved positions* (#140): elements previously saved as `::: {.absolute …}` are re-activatable on the next render. Typed inner elements keep their type-specific capabilities — paragraphs keep Quill editing; tables and equations stay move-only; lists, blockquotes, display code, code chunks, and figures keep their first-activation capabilities. On save the existing `{.absolute …}` block is rewritten in place — no nested wrappers. Generic `{.absolute}` images and `{.absolute}` divs (without `{.editable}`) are re-activatable the same way.

  *UX and accessibility*: entering modify mode switches the toolbar's right zone to an element-list panel showing what's classifiable on the current slide. Clicking a valid element auto-exits modify mode after activation; pressing **Escape** exits without activating, returning focus to the Modify button (#151). Valid and warn elements carry screen-reader `aria-label`s (`Click to modify (<type>)` / `Cannot modify: <reason>`); originals are restored on exit. The Modify button stays visible even when context panels (image, arrow, text) are shown.

### Fixed

- **Arrow undo/redo** - Undo and redo for arrows (drag, color, width, head style, curve mode) were silently broken due to a bundle initialization order issue: `registerRestoreArrowDOM` was called at module level in `arrows.js` before `undo.js` had initialized `restoreArrowDOMFn`, causing it to be reset to `null`. Fixed by moving the registration into an `initArrows()` function called at runtime during plugin init.
- **Modify mode: not working in Positron viewer** - `quarto preview` injects a `.slide-background` element with the `present` class inside `.slides`. The classifier now uses `section.present:not(.slide-background)` to reliably select the current slide content, fixing modify mode in the Positron / VS Code preview pane.
- **Modify mode: display equation saved at slide-left instead of its visible position** - Activating a display equation and saving wrote `{.absolute left=0px …}` regardless of where the equation was visually centered. `pickEquationRenderNode` matched MathJax v2's `<div class="MathJax_Display">` centering wrapper first — that wrapper spans the full slide content width, so its left edge is the slide-left edge (0 in element-space), not the visible math's left. On re-render the `.absolute` div shrink-wrapped to the math glyphs and landed at slide-left. Selector priority now prefers the actual rendered-glyphs node (`mjx-container`, `.katex`, `.MathJax_Display .MathJax`) over the engine-specific centering wrapper.
- **Modify mode: typed-positioned re-activation lost the wrapper's width** - Clicking an already-positioned typed inner (e.g. a `<p>` inside `::: {.absolute width=400px}`) hoisted the inner out of its wrapper so the container could position absolutely on the slide. After the hoist, the inner element had no width constraint and `setupEltStyles` captured its post-hoist `offsetWidth` — typically the unconstrained flow width, which jumped to the full slide width. The `makePositionedClassifier` activate flow now sets `el.style.width`/`style.height` from the source `pos` BEFORE `extraActivate` hoists, so setup keeps the wrapper's intended dimensions.
- **Modify mode: code-chunk figure's `fig-cap` wasn't bundled with the figure** - Quarto renders `#| fig-cap:` as a sibling `<p class="caption">` next to the chunk's `<img>`. Activating the figure wrapped only the img, so the caption stayed in place when the figure was dragged. Activation now moves the immediate caption sibling into the editable-container so it tracks the figure.
- **Modify mode: video jumped to natural mp4 dimensions on activation** - Activating an inline video would unset reveal's `max-width: 95%` constraint *before* dimensions were captured, so the editable video grew to the raw mp4 resolution (often 1920×1080) and overflowed the slide — dragging then pushed the visible portion off-screen. `beforeSetup` now records the rendered (constrained) `getBoundingClientRect` size first and writes it back as explicit `style.width`/`style.height`, then lifts the max constraints.
- **Modify mode: heading color placeholder leaked to source** - Applying a brand color to heading text wrote `__BRAND_SHORTCODE_<name>__` placeholders to the QMD instead of `{{< brand color <name> >}}` shortcodes, so re-rendering wouldn't apply the color. `headingHtmlToMarkdown` now performs the same placeholder-to-shortcode resolution pass that `serialization.js` runs for body content.
- **Modify mode: heading bold/underline didn't serialize** - Clicking Bold or Underline on a slide heading produced no `**…**` / `[…]{.underline}` on save. Chromium's `document.execCommand('bold')` emitted `<span style="font-weight: normal">` because the `<h2>` is already bold by default, and `<u>` / `text-decoration: underline` spans weren't recognised by the heading serializer. Replaced the toolbar's `execCommand` with a manual range-wrap (`toggleInlineWrap`) so each button reliably toggles a `<b>` / `<i>` / `<u>` / `<s>` tag, and taught `headingHtmlToMarkdown` to handle the underline forms.

## [8.0.0] - 2026-04-27

### Added

- **Image context panel** - Selecting an image switches the menu bar to image-specific controls: opacity slider, border radius, crop mode, horizontal/vertical flip, replace image, and reset. All serialize to the QMD `style=` attribute; flips and rotation compose into a single `transform:` declaration.

### Changed

- **Menu bar** - Replaced the floating draggable toolbar with a fixed top bar spanning the full viewport width. Slides resize to fill the remaining area. Context panels (arrow styling, image controls, Quill formatting) appear in the right zone when an element is selected.

## [7.0.0] - 2025-03-25

### Added

- **Arrow support** - Add arrows to slides via the toolbar (requires [quarto-arrows](https://github.com/EmilHvitfeldt/quarto-arrows) extension)
  - Automatic detection of arrow extension with helpful install message if missing
  - Add Arrow button (➡️) in the Add submenu
  - Draggable start and end point handles
  - Curve mode toggle for Bezier curves with two control points
  - Guide lines showing control point connections in curve mode
  - Arrows serialized as `{{< arrow from="x,y" to="x,y" ... >}}` shortcodes
  - 20px invisible hit area for easier arrow selection
  - Active selection UI - only selected arrow shows handles/controls
  - Arrow styling controls integrated into main toolbar (color, width, head style, dash, line style, opacity)
  - Color presets using brand palette (or defaults) with custom color picker
  - Brand colors saved as `{{< brand color name >}}` shortcodes in arrow color attribute
  - Drag arrows by their body to move entire arrow while preserving shape
  - **Label support** - Add text labels to arrows (#58)
    - Label text input in style controls
    - Label position selector (start, middle, end)
    - Label offset for perpendicular distance from arrow line
    - Labels automatically rotate to follow arrow direction
    - Labels follow arrow when dragged and update color to match arrow
  - **Waypoints and smooth curves** - Complex multi-point arrow paths (#59)
    - Double-click on arrow path to add waypoints
    - Waypoints shown as amber handles, distinct from start/end (blue/green) and control points
    - Double-click or right-click waypoint to remove it (Delete key also works)
    - Smooth toggle for Catmull-Rom spline interpolation through waypoints
    - Waypoints and smooth attributes serialized in shortcode (`waypoints="x1,y1 x2,y2"`, `smooth="true"`)
    - Curve mode and waypoint mode are mutually exclusive (clicking Curve clears waypoints)
    - Waypoint badge shows count in toolbar when waypoints exist
  - **Undo/redo support** - Arrow operations (creation, movement, styling, curve mode) integrated with Ctrl+Z/Ctrl+Y (#65)

### Fixed

- **Race condition in Quill initialization** - Added guards to prevent duplicate initialization when `initializeQuillForElement` is called multiple times for the same element before first call completes (#85)
- **Arrow click-outside handler performance** - Changed from per-arrow click handlers to a single global handler, eliminating redundant event listeners (#60)

---

## [6.0.0] - 2026-03-16

### Added

- **Quill Rich Text Editor** - Replaced basic contentEditable with full-featured Quill editor
  - Bold, italic, underline, strikethrough formatting
  - Text color and background color with color picker
  - Text alignment (left, center, right)
  - Formatting saved as Quarto markdown syntax
- **Color Picker** - New color selection interface
  - 18 preset color swatches
  - "Unset" option to remove color formatting
  - "Custom..." option for full color spectrum via native picker
- **Brand Color Support** - Automatically uses colors from `_brand.yml` palette
  - Detects `color.palette` in `_brand.yml`
  - Shows brand colors in picker instead of defaults
  - Saves brand colors as `{{< brand color name >}}` shortcodes
- **Floating toolbar** with quick access to common actions
  - Draggable toolbar on the right side of slides
  - Save button (💾) to download edited QMD
  - Copy button (📋) to copy QMD to clipboard
  - Add Text button (📝) to create new editable text on current slide
  - Add Slide button (➕) to insert new slide after current
  - Customizable colors via CSS custom properties
- **Add new text elements** directly in the browser
  - New elements appear centered on the slide
  - Full functionality: move, resize, rotate, font controls, edit mode
  - Marked with dashed border to distinguish from original content
- **Add new slides** directly in the browser
  - New slides inserted after current slide
  - Automatically navigates to the new slide
  - Saved with `## New Slide` heading

### Fixed

- **Images not appearing on first load** - Images now wait until fully loaded before setup, preventing 0x0 sizing (#33)
- **Text fields with tiny dimensions** - Divs now wait for CSS layout to complete before setup, preventing 1x1 pixel sizing (#34)
- **Rotation not centered** - Fixed rotation calculation to use screen coordinates consistently, elements now rotate around their true center (#35)
- **Toolbar jumps when dragged** - Toolbar no longer shifts to cursor when starting to drag, now stays in place (#36)
- **Unedited content preserved** - Divs that aren't modified keep their original content (preserves LaTeX, shortcodes, etc.)
- **Text shifting** when entering edit mode fixed (Quill initialized at page load)
- **Drag handler** no longer blocks text editing in edit mode
- **Strikethrough regex** no longer incorrectly matches `<span>` tags
- **Background-color** no longer saved as color
- **Shortcodes** no longer stripped by HTML cleanup
- **Standalone `:::` in user text content** no longer breaks document structure
  - Uses longer fences (`::::` or more) when content contains `:::`
- **`::: {.editable}` in user text content** no longer gets incorrectly replaced
  - Regex now only matches in valid contexts (div fence or image syntax)
- **HTML entities** in user content (like `>`) are now properly decoded when saving
- **Newlines in user content** (via `<br>` tags) are properly preserved when saving

### Changed

- Color style attributes now use single quotes for shortcode compatibility
- Save flow now processes new elements alongside original elements
- `replaceEditableOccurrences` uses context-aware matching to avoid false positives

---

## [5.0.0] - 2026-03-09

### Added

- **Rotation support** for images and text divs
  - Orange circular handle at top center of elements
  - Hold Shift while rotating to snap to 15° increments
  - Keyboard shortcuts: Ctrl+Left/Right to rotate, Ctrl+Shift for 15° steps
  - Rotation saved to QMD as `transform: rotate(Xdeg)` in style attribute
- **Undo/redo support** for element positioning and styling (#26)
  - Ctrl+Z (Cmd+Z on Mac) to undo, Ctrl+Y or Ctrl+Shift+Z to redo
  - Tracks position, size, rotation, font size, and text alignment changes
  - Separate from browser's native undo in text edit mode
- **"Copy qmd to Clipboard" button** in Tools menu for easier workflow (#8)
- **Accessibility support**: Editable elements are now fully keyboard accessible
  - Arrow keys move elements, Shift+Arrow keys resize
  - Containers are focusable with proper ARIA attributes
  - All controls have aria-labels for screen readers
  - Shift+Tab exits element to return to normal slide navigation
- **CSS customization**: Styles now use CSS custom properties for easy theming (#27)
  - `--editable-accent-color`, `--editable-accent-active`, `--editable-handle-size`, etc.
  - All inline styles moved to `.editable-container`, `.resize-handle`, `.editable-button` classes
- **Performance improvements**: Added `requestAnimationFrame` throttling for smooth drag/resize

### Fixed

- Menu buttons now have proper hover effect matching other tools (#7)
- Raw qmd content no longer leaks into slides when `include-in-header` contains a `<script>` (#21)
- Shortcodes are now preserved when saving, instead of being resolved (#15)
- Backslashes no longer removed from content (LaTeX, regex, paths) (#16)
- Windows path separators now handled correctly (#13, #14)
- Content with colons no longer breaks regex parsing

---

## [4.0.0] - 2025-11-19

### Added

- Documentation for `max-width` and `max-height` usage (#17)
- Note about shortcodes not working in editable divs

### Fixed

- Partial fix for backslash handling (fully resolved in next release)

---

## [3.0.0] - 2025-09-24

### Added

- Support for bare `::: editable` syntax in addition to `::: {.editable}` (#11)

### Changed

- Minor internal refactoring

---

## [2.0.0] - 2025-08-21

### Added

- Text in editable divs is now directly editable (contentEditable support)
- Edit mode toggle button for div elements

### Fixed

- Extension now works correctly when slides are part of a Quarto project (#3)

---

## [1.0.0] - 2025-08-19

### Added

- Initial release
- Drag and drop positioning for images and divs with `.editable` class
- Resize handles on all four corners
- Shift+drag to preserve aspect ratio while resizing
- Font size controls (A-/A+) for text divs
- Text alignment controls (left/center/right) for text divs
- "Save Edits" button to download modified QMD file
- Lua filter to inject source file content for round-trip editing