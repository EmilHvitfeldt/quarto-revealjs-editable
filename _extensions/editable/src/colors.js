/**
 * Color utilities for the editable extension.
 * Handles color palettes, RGB/hex conversion, and brand color integration.
 * @module colors
 */

/**
 * Default color palette for color pickers when no brand colors are available.
 * @type {string[]}
 */
export const DEFAULT_COLOR_PALETTE = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#e60000", "#ff9900", "#ffff00", "#008a00", "#0066cc", "#9933ff",
  "#ff99cc", "#ffcc99", "#ffff99", "#99ff99", "#99ccff", "#cc99ff",
];

/**
 * Get the color palette for color pickers.
 * Uses brand colors from _brand.yml if injected by Lua filter, otherwise defaults.
 * @returns {string[]} Array of hex color values
 */
export function getColorPalette() {
  // Check if brand palette colors were injected by Quarto
  if (window._quarto_brand_palette && Array.isArray(window._quarto_brand_palette) && window._quarto_brand_palette.length > 0) {
    return window._quarto_brand_palette;
  }
  return DEFAULT_COLOR_PALETTE;
}

/**
 * Convert RGB color string to hex format.
 * @param {string} rgb - RGB color string (e.g., "rgb(255, 107, 107)")
 * @returns {string|null} Hex color string (e.g., "#ff6b6b") or null if invalid
 */
export function rgbToHex(rgb) {
  // Match rgb(r, g, b) or rgba(r, g, b, a)
  const match = rgb.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert a color value to brand shortcode placeholder if it matches a brand color.
 * Uses placeholder format to avoid being stripped by HTML cleanup regex.
 * Placeholders are later converted to {{< brand color name >}} shortcodes.
 * @param {string} colorVal - Color value (hex or rgb format)
 * @returns {string} Brand placeholder or original color value
 * @example
 * // Returns "__BRAND_SHORTCODE_primary__" if #007cba is named "primary"
 * getBrandColorOutput("#007cba")
 */
export function getBrandColorOutput(colorVal) {
  if (!window._quarto_brand_color_names) {
    return colorVal;
  }

  // Normalize the color value
  let normalizedColor = colorVal.toLowerCase().trim();

  // Convert RGB to hex if needed
  if (normalizedColor.startsWith('rgb')) {
    const hexColor = rgbToHex(normalizedColor);
    if (hexColor) {
      normalizedColor = hexColor.toLowerCase();
    }
  }

  // Check if this color has a brand name
  const brandName = window._quarto_brand_color_names[normalizedColor];
  if (brandName) {
    // Use placeholder that won't be stripped by HTML cleanup
    return `__BRAND_SHORTCODE_${brandName}__`;
  }

  // Return original value (not converted) to preserve format
  return colorVal;
}
