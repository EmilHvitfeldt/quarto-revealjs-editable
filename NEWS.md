# Changelog

All notable changes to the quarto-revealjs-editable extension will be documented in this file.

## [Unreleased]

### Added

- **Modify mode: re-activate already-positioned typed elements** (#140) - Elements that have already been positioned and saved (wrapped in `::: {.absolute …}`) are now re-activatable in modify mode for every supported typed inner element: paragraphs (`<p>`), blockquotes, bullet/ordered lists, tables, figures, and display code (`<pre>`). Previously only `{.absolute}` images and generic `{.absolute}` divs were re-activatable; positioned paragraphs etc. were classified as generic divs and lost their type-specific capabilities (Quill text editing for paragraphs, capability overrides for lists/tables). The typed positioned classifier targets the *inner* semantic element, reads position from the wrapping `div.absolute`, and on save rewrites the existing `{.absolute …}` block in place — no nested wrappers. The generic `Positioned divs` classifier skips wrappers claimed by a typed classifier (via `data-typed-positioned-claimed`) to avoid overlapping green rings. Display equations and code chunk outputs / figures are not yet covered (their inner DOM is span-based or has multi-child wrappers); those continue to re-activate via the generic `Positioned divs` path.
- **Modify mode: code chunk figures (single-figure chunks)** (#112) - Executable code chunks (` ```{r} `, ` ```{python} `, …) that produce exactly one `<img>` figure are now activatable in modify mode. Click the highlighted figure to enable drag, resize, and rotate. Chunks are matched to their QMD source by `#| label:` or fence-token label for named chunks, falling back to positional index for unnamed chunks. On save the entire source chunk (fence + body) is wrapped in `::: {.absolute left=Xpx top=Ypx width=Wpx height=Hpx} ... :::`. Multi-figure chunks (2+ outputs) continue to show an amber warning ring and are not clickable.
- **Modify mode: display equations (move only)** (#115) - Block equations (`$$...$$`) are now activatable in modify mode. Both single-line (`$$E = mc^2$$`) and multi-line (`$$\n…\n$$`) forms are supported. Click a highlighted equation to enable drag — resize and rotate are intentionally not provided, since the equation's size is determined by its LaTeX content rather than a wrapper dimension; text editing is also not provided (the content is raw LaTeX, not prose). Equations are matched to their QMD source by the LaTeX body line, with a positional fallback when the same line appears more than once on a slide. Equations inside fenced code blocks or other `:::` fenced divs are skipped. On save, the `$$...$$` block is wrapped in `::: {.absolute left=Xpx top=Ypx}\noriginal source\n:::`.
- **Modify mode: diagram chunks** (#114) - Mermaid (` ```{mermaid} `) and Graphviz (` ```{dot} `) diagram chunks are now activatable in modify mode. Their SVG output is rendered into the same `<div class="cell">` wrapper used by other executable chunks, so they are handled by the Code chunk outputs classifier: move + resize, named-chunk matching by `#| label:` or fence-token label with positional fallback, and write-back as `::: {.absolute left=Xpx top=Ypx width=Wpx height=Hpx}\n```{mermaid}\n…\n```\n:::`.
- **Modify mode: tables (move only)** (#117) - Tables are now activatable in modify mode. Supported source syntaxes: pipe tables (`| A | B |` … `|---|---|`), grid tables (`+---+---+` borders), raw HTML tables (`<table>...</table>`), and list tables (`::: {.list-table}` … `:::`). A trailing Pandoc caption line (`: caption {#tbl-id}` or `Table: caption`) is included in the wrapped block so the caption stays anchored to the table. Click a highlighted table to enable drag — resize and rotate are intentionally not provided, since a table's size is determined by its content and column definitions rather than a CSS dimension on a wrapper. Tables are matched to their QMD source by the first (header) row of the table, with positional fallback when the same header row appears more than once. On save, the entire table block (plus caption, if any) is wrapped in `::: {.absolute left=Xpx top=Ypx}\noriginal table source\n:::`. Computational table outputs (from executable `{r}`/`{python}`/`{ojs}` chunks) are handled by the code-output classifier rather than this path.
- **Modify mode: code chunk outputs and Observable JS** (#113) - Executable code chunks that produce non-image output (HTML tables, printed text, interactive widgets) and `{ojs}` chunks are now activatable in modify mode. Click a highlighted `<div class="cell">` to enable drag and resize (text editing is not provided — the content is generated output, not user-written prose). Chunks are matched to their QMD source by `#| label:` or fence-token label for named chunks, falling back to positional index for unnamed chunks. On save, the entire ` ```{lang} ... ``` ` chunk is wrapped in `::: {.absolute left=Xpx top=Ypx width=Wpx height=Hpx} ... :::`. Chunks producing only images are excluded — the figure is handled by the Images classifier.
- **Modify mode: display code blocks** - Non-executed fenced code blocks (` ```python `, ` ```r `, plain ` ``` ` with no language) are now activatable in modify mode. Click a highlighted code block to enable drag and resize (text editing is not provided — the source remains literal code). Blocks are matched to their QMD source by position among top-level code fences on the slide, anchored to the first non-empty line of code content. On save, the entire fenced code block is wrapped in `::: {.absolute left=Xpx top=Ypx width=Wpx height=Hpx} ... :::`. Executable code chunks (` ```{python} `, ` ```{r} `, ` ```{ojs} `) are handled by the Code chunk outputs classifier.
- **Modify mode: arrows from previous save** - Positioned arrows that exist in the source as `{{< arrow ... position="absolute" ... >}}` shortcodes (rendered via the [`quarto-arrows`](https://github.com/EmilHvitfeldt/quarto-arrows) extension) are now activatable in modify mode. Click a highlighted arrow to enable drag and resize via the standard arrow handles; the source's color, width, head, dash, line, opacity, label, curve, and waypoints are preserved. On save the matching shortcode is rewritten in-place with the new coordinates. Arrows whose shortcodes use kwargs the editable system doesn't yet round-trip (`bend`, `fragment`, `aria-label`, `class`, `head-fill`, …) are warn-classified rather than activated, so their source attrs aren't silently dropped.
- **Modify mode: inline images** - Images embedded inside a paragraph (`text ![](img.png) more text`) are now activatable in modify mode. Click the highlighted image to enable drag, resize, and rotate; on save the inline `](src)` is updated in-place with `{.absolute ...}` attributes, leaving the surrounding paragraph text intact. Activation is a one-way transform: once saved with `.absolute`, the image is no longer inline on re-render — Quarto positions it out of flow and the paragraph reads as one continuous sentence. Paragraphs that contain an image are no longer themselves classified in modify mode (the image is the meaningful target), avoiding overlapping click rings.
- **Modify mode: bullet lists, ordered lists, blockquotes** - Unordered lists (`- item`), ordered lists (`1. item`), and blockquotes (`> text`) are now activatable in modify mode. Click a highlighted element to enable drag and resize (text editing is not included — list/quote structure does not round-trip cleanly through Quill). Blocks are matched to QMD source by position (Nth list of that type on the slide). On save, the block is wrapped in `::: {.absolute left=Xpx top=Ypx width=Wpx height=Hpx}\noriginal source\n:::`.
- **Modify mode: plain paragraphs** - Plain paragraph text is now activatable in modify mode. Click a highlighted paragraph to enable drag, resize, rotate, and text editing via the Quill rich text editor. Paragraphs are matched to their QMD source by position (Nth paragraph on the slide). On save, the paragraph is wrapped in `::: {.absolute left=Xpx top=Ypx width=Wpx height=Hpx}\ntext\n:::`. If the text was edited, the Quill output is used; otherwise the original QMD source text is preserved.
- **Modify mode: fenced divs** - Fenced divs are now activatable in modify mode. Classed divs (`::: {.my-class}`), callout blocks (`::: {.callout-note}`), and column layouts (`::: {.columns}`) are classified as valid in modify mode. Click a highlighted div to enable drag, resize, and rotate (text editing is also available for classed and callout divs). Column layouts support move only. On save, the opening fence line is updated with `.absolute` positioning attributes while existing class attrs are preserved.
- **Modify mode: slide title editing** - Slide `## ` headings are now activatable in modify mode. Click the highlighted title to open a formatting toolbar (bold, italic, underline, strikethrough, text color, background color) and edit the heading inline. Press Enter or click away to finish; the title can be re-activated to edit again. On save the `## Heading text` line is updated in place with inline formatting serialized to Quarto markdown (`**bold**`, `*italic*`, `~~strike~~`, `[text]{style='color: ...'}`).
- **Modify mode: video support** - Videos inserted with `![](video.mp4)` markdown syntax are now activatable in modify mode. Click a highlighted video to enable drag, resize, and rotate. On save the `](src)` reference is updated in-place with `{.absolute ...}` positioning, using the same approach as plain images.
- **Modify mode: `{.absolute}` images** - Images previously saved with `{.absolute}` attributes (but without `{.editable}`) are now activatable in modify mode. Click a highlighted image to enable drag, resize, and rotate. On save the existing `](src){.absolute ...}` block is updated in-place using both the image src and position as a matching key.
- **Modify mode: `{.absolute}` divs** - Divs previously saved with `{.absolute}` attributes (but without `{.editable}`) are now activatable in modify mode. Click a highlighted div to enable drag, resize, and rotate. On save the existing `{.absolute ...}` attribute block is updated in-place; no wrapper is added.
- **Modify mode: element list panel** - Entering modify mode now switches the toolbar right zone to a panel listing the element types that can be activated (e.g. "Images", "Positioned divs").
- **Modify mode: auto-exit on activation** - Clicking a valid element now automatically exits modify mode after activating it.
- **Modify mode: button always visible** - The Modify button is no longer hidden when context panels (image, arrow, text) are shown.

### Fixed

- **Arrow undo/redo** - Undo and redo for arrows (drag, color, width, head style, curve mode) were silently broken due to a bundle initialization order issue: `registerRestoreArrowDOM` was called at module level in `arrows.js` before `undo.js` had initialized `restoreArrowDOMFn`, causing it to be reset to `null`. Fixed by moving the registration into an `initArrows()` function called at runtime during plugin init.
- **Modify mode: not working in Positron viewer** - `quarto preview` injects a `.slide-background` element with the `present` class inside `.slides`. The classifier now uses `section.present:not(.slide-background)` to reliably select the current slide content, fixing modify mode in the Positron / VS Code preview pane.

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