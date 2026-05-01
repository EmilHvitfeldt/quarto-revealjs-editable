# Changelog

All notable changes to the quarto-revealjs-editable extension will be documented in this file.

## [Unreleased]

### Added

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