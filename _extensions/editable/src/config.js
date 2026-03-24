/**
 * Configuration constants for the editable extension.
 * Visual styling is defined in editable.css via CSS custom properties.
 * @type {Object}
 */
export const CONFIG = {
  // Debug mode - set window.EDITABLE_DEBUG = true to enable
  DEBUG: typeof window !== 'undefined' && window.EDITABLE_DEBUG,

  // Sizing constraints
  MIN_ELEMENT_SIZE: 50,
  KEYBOARD_MOVE_STEP: 10,

  // Font constraints
  MIN_FONT_SIZE: 8,
  DEFAULT_FONT_SIZE: 16,
  FONT_SIZE_STEP: 2,

  // Timing
  HOVER_TIMEOUT: 500,

  // Undo/Redo
  MAX_UNDO_STACK_SIZE: 50,

  // New element defaults
  NEW_TEXT_CONTENT: "New text",
  NEW_TEXT_WIDTH: 200,
  NEW_TEXT_HEIGHT: 50,
  NEW_SLIDE_HEADING: "## New Slide",

  // Arrow defaults
  NEW_ARROW_LENGTH: 150,
  ARROW_HANDLE_SIZE: 12,
  ARROW_CONTROL_HANDLE_SIZE: 10,
  ARROW_DEFAULT_COLOR: "black",
  ARROW_DEFAULT_WIDTH: 2,
  ARROW_CONTROL1_COLOR: "#ff6600",
  ARROW_CONTROL2_COLOR: "#9933ff",
  ARROW_WAYPOINT_COLOR: "#f59e0b",
  ARROW_WAYPOINT_HANDLE_SIZE: 10,
  ARROW_DEFAULT_LABEL_POSITION: "middle",
  ARROW_DEFAULT_LABEL_OFFSET: 10,

  // Polling config
  POLL_MAX_ATTEMPTS: 50,
  POLL_INTERVAL_MS: 100,

  // Quill Editor CDN
  QUILL_CSS:
    "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css",
  QUILL_JS:
    "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js",
};
