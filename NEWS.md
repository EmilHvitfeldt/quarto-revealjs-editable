# Changelog

All notable changes to the quarto-revealjs-editable extension will be documented in this file.

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