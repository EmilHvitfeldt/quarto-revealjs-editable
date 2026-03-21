-- Standard base64 encoder (RFC 4648), pure Lua
local function b64encode(data)
  local chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local result = {}
  local pad = 0

  for i = 1, #data, 3 do
    local b1 = data:byte(i) or 0
    local b2 = data:byte(i+1) or 0
    local b3 = data:byte(i+2) or 0

    if i+1 > #data then pad = 2
    elseif i+2 > #data then pad = 1 end

    local n = b1 * 65536 + b2 * 256 + b3

    table.insert(result, chars:sub(math.floor(n / 262144) % 64 + 1, math.floor(n / 262144) % 64 + 1))
    table.insert(result, chars:sub(math.floor(n / 4096)   % 64 + 1, math.floor(n / 4096)   % 64 + 1))
    table.insert(result, pad == 2 and '=' or chars:sub(math.floor(n / 64) % 64 + 1, math.floor(n / 64) % 64 + 1))
    table.insert(result, pad >= 1 and '=' or chars:sub(n % 64 + 1, n % 64 + 1))
  end

  return table.concat(result)
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

-- Check if document has any editable elements (Div or Image with class "editable")
-- Walk AST inside Pandoc to avoid module-level state that persists across files
local function has_editable_elements(doc)
  local found = false
  local filter = {
    Div = function(el)
      if has_editable_class(el) then found = true end
    end,
    Image = function(el)
      if has_editable_class(el) then found = true end
    end
  }
  pandoc.walk_block(pandoc.Div(doc.blocks), filter)
  return found
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

  -- Simple YAML parsing for color palette
  -- Look for lines under color: palette: that have hex colors
  local in_color_section = false
  local in_palette_section = false

  for line in brand_content:gmatch("[^\r\n]+") do
    -- Check for color: section
    if line:match("^color:") then
      in_color_section = true
      in_palette_section = false
    elseif line:match("^%S") and not line:match("^color:") then
      -- New top-level section, exit color section
      in_color_section = false
      in_palette_section = false
    elseif in_color_section and line:match("^%s+palette:") then
      in_palette_section = true
    elseif in_color_section and line:match("^%s+%S") and not line:match("^%s+palette:") and in_palette_section then
      -- Check if this is still in palette (same or deeper indent) or new section
      local indent = line:match("^(%s+)")
      if indent and #indent <= 2 then
        in_palette_section = false
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

  local script = "<script>\n"
  -- Use TextDecoder to properly handle UTF-8 encoded characters (accents, etc.)
  -- atob() alone returns a binary Latin-1 string and corrupts non-ASCII chars.
  script = script .. "window._input_file = new TextDecoder('utf-8').decode(\n"
  script = script .. "  Uint8Array.from(atob('" .. encoded .. "'), function(c) { return c.charCodeAt(0); })\n"
  script = script .. ");\n"
  script = script .. "window._input_filename = '" .. escaped_filename .. "';\n"

  -- Inject brand palette colors if available
  local brand_colors, color_names = get_brand_palette_colors()
  if #brand_colors > 0 then
    script = script .. "window._quarto_brand_palette = ["
    for i, color in ipairs(brand_colors) do
      if i > 1 then script = script .. "," end
      script = script .. "'" .. color .. "'"
    end
    script = script .. "];\n"

    -- Also inject the color name mapping (hex -> name)
    script = script .. "window._quarto_brand_color_names = {"
    local first = true
    for hex, name in pairs(color_names) do
      if not first then script = script .. "," end
      first = false
      script = script .. "'" .. hex .. "':'" .. name .. "'"
    end
    script = script .. "};\n"
  end

  -- Inject arrow extension detection flag
  if has_arrow_extension() then
    script = script .. "window._quarto_arrow_extension = true;\n"
  end

  script = script .. "</script>"

  quarto.doc.include_text("in-header", script)
  return doc
end
