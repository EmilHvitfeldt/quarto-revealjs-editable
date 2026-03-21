// Default color palette for the color pickers
export const DEFAULT_COLOR_PALETTE = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#e60000", "#ff9900", "#ffff00", "#008a00", "#0066cc", "#9933ff",
  "#ff99cc", "#ffcc99", "#ffff99", "#99ff99", "#99ccff", "#cc99ff",
];

// Get color palette - uses brand colors if available, otherwise defaults
export function getColorPalette() {
  // Check if brand palette colors were injected by Quarto
  if (window._quarto_brand_palette && Array.isArray(window._quarto_brand_palette) && window._quarto_brand_palette.length > 0) {
    return window._quarto_brand_palette;
  }
  return DEFAULT_COLOR_PALETTE;
}

// Convert RGB color string to hex format
export function rgbToHex(rgb) {
  // Match rgb(r, g, b) or rgba(r, g, b, a)
  const match = rgb.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Convert a color value to brand shortcode if it's a brand color, otherwise return as-is
// Uses placeholder to avoid being stripped by HTML cleanup regex
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
