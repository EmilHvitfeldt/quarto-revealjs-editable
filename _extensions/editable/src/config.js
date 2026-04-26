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

  // Rotation steps (degrees)
  ROTATE_SNAP_STEP: 15,
  ROTATE_KEY_STEP: 5,

  // Arrow geometry
  ARROW_DOUBLE_LINE_OFFSET_MULTIPLIER: 1.5,  // offset = width * this
  ARROW_CONTROL_POINT_DISPLACEMENT: 50,      // perpendicular offset for bezier control points
  ARROW_LABEL_T_START: 0.15,
  ARROW_LABEL_T_END: 0.85,
  ARROW_LABEL_T_MIDDLE: 0.5,
  ARROW_LABEL_FLIP_THRESHOLD: 90,            // degrees, label flips past this angle
  ARROW_HANDLE_OFFSET: -6,                   // px, center handles on path point

  // Polling config
  POLL_MAX_ATTEMPTS: 50,
  POLL_INTERVAL_MS: 100,

  // New fence default
  NEW_FENCE_LENGTH: 3,
};
