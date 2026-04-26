-- Use Quarto's built-in base64 encoder (available since Quarto 1.4)
local function b64encode(data)
  return quarto.base64.encode(data)
end

-- Check if a Pandoc element has the class "editable"
local function has_editable_class(el)
  if el.attr and el.attr.classes then
    for _, cls in ipairs(el.attr.classes) do
      if cls == 'editable' then return true end
    end
  end
  return false
end

-- Check if quarto-arrows extension is installed
local function has_arrow_extension()
  local input_file = quarto.doc.input_file
  local input_dir = input_file:match("(.*/)")
  if not input_dir then input_dir = "./" end

  local arrow_paths = {
    input_dir .. "_extensions/arrows/_extension.yml",
    input_dir .. "_extensions/EmilHvitfeldt/arrows/_extension.yml",
    "./_extensions/arrows/_extension.yml",
    "./_extensions/EmilHvitfeldt/arrows/_extension.yml"
  }

  for _, path in ipairs(arrow_paths) do
    local f = io.open(path, "r")
    if f then
      f:close()
      return true
    end
  end

  return false
end

-- Extract brand palette colors by reading _brand.yml directly
-- Returns two values: array of hex colors, and table mapping hex -> name
local function get_brand_palette_colors()
  local colors = {}
  local color_names = {}

  -- Try to find and read _brand.yml in the same directory as the input file
  local input_file = quarto.doc.input_file
  local input_dir = input_file:match("(.*/)")
  if not input_dir then input_dir = "./" end

  local brand_paths = {
    input_dir .. "_brand.yml",
    input_dir .. "_brand.yaml",
    "./_brand.yml",
    "./_brand.yaml"
  }

  local brand_content = nil
  for _, path in ipairs(brand_paths) do
    local f = io.open(path, "r")
    if f then
      brand_content = f:read("*a")
      f:close()
      break
    end
  end

  if not brand_content then return colors, color_names end

  -- Simple YAML parsing for color palette.
  -- Handles the common _brand.yml structure; does not support YAML anchors or merge keys.
  -- Look for lines under color: > palette: that have hex colors.
  local in_color_section = false
  local in_palette_section = false

  for line in brand_content:gmatch("[^\r\n]+") do
    -- Skip comment lines before checking section boundaries
    if not line:match("^%s*#") then
      if line:match("^color:") then
        in_color_section = true
        in_palette_section = false
      elseif line:match("^%S") then
        -- New top-level key: exit color section
        in_color_section = false
        in_palette_section = false
      elseif in_color_section and line:match("^%s+palette:") then
        in_palette_section = true
      elseif in_palette_section and line:match("^%s+%S") and not line:match("^%s+palette:") then
        -- Exit palette section if indentation drops back to color-section level (≤2 spaces)
        local indent = line:match("^(%s+)")
        if indent and #indent <= 2 then
          in_palette_section = false
        end
      end
    end

    -- Extract color name and hex value from palette entries
    if in_palette_section then
      local name, hex = line:match("^%s+(%w+):%s*[\"']?(#%x%x%x%x%x%x)[\"']?")
      if name and hex then
        table.insert(colors, hex)
        color_names[hex:lower()] = name
      end
    end
  end

  return colors, color_names
end

function Pandoc(doc)
  -- Always inject the file content when the filter is active.
  -- This allows adding new elements (like arrows) even when
  -- there are no existing .editable elements in the document.

  -- Encode qmd source as base64 and inject into <head>
  local filename = quarto.doc.input_file
  local f = assert(io.open(filename, "r"))
  local text = f:read("a")
  f:close()
  local encoded = b64encode(text)

  -- Escape backslashes and single quotes in filename for safe JS string
  local escaped_filename = filename:gsub("\\", "\\\\"):gsub("'", "\\'")

  -- Build script parts using table.insert + table.concat (O(n) vs O(n²) for repeated ..)
  local parts = { "<script>\n" }
  -- Use TextDecoder to properly handle UTF-8 encoded characters (accents, etc.)
  -- atob() alone returns a binary Latin-1 string and corrupts non-ASCII chars.
  table.insert(parts, "window._input_file = new TextDecoder('utf-8').decode(\n")
  table.insert(parts, "  Uint8Array.from(atob('" .. encoded .. "'), function(c) { return c.charCodeAt(0); })\n")
  table.insert(parts, ");\n")
  table.insert(parts, "window._input_filename = '" .. escaped_filename .. "';\n")

  -- Inject brand palette colors if available
  local brand_colors, color_names = get_brand_palette_colors()
  if #brand_colors > 0 then
    local palette_parts = {}
    for _, color in ipairs(brand_colors) do
      table.insert(palette_parts, "'" .. color .. "'")
    end
    table.insert(parts, "window._quarto_brand_palette = [" .. table.concat(palette_parts, ",") .. "];\n")

    -- Also inject the color name mapping (hex -> name)
    local name_parts = {}
    for hex, name in pairs(color_names) do
      table.insert(name_parts, "'" .. hex .. "':'" .. name .. "'")
    end
    table.insert(parts, "window._quarto_brand_color_names = {" .. table.concat(name_parts, ",") .. "};\n")
  end

  -- Inject arrow extension detection flag
  if has_arrow_extension() then
    table.insert(parts, "window._quarto_arrow_extension = true;\n")
  end

  table.insert(parts, "</script>")

  quarto.doc.include_text("in-header", table.concat(parts))

  return doc
end
