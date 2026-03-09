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

-- Walk the AST looking for Div or Image elements with class "editable".
-- These are the only elements the JS targets: div.editable and img.editable.
-- Using the AST avoids any risk of false positives on the word "editable"
-- appearing in plain text or code blocks.
local found_editable = false

function Div(el)
  if has_editable_class(el) then
    found_editable = true
  end
  return el
end

function Image(el)
  if has_editable_class(el) then
    found_editable = true
  end
  return el
end

function Pandoc(doc)
  -- No editable elements found: skip injection entirely.
  -- This keeps the generated HTML clean after a save (when all {.editable}
  -- have been replaced by {.absolute ...}) and avoids unnecessary base64
  -- encoding when the filter is active but unused.
  if not found_editable then return doc end

  -- Encode qmd source as base64 and inject into <head>
  local filename = quarto.doc.input_file
  local text = assert(io.open(filename, "r")):read("a")
  local encoded = b64encode(text)

  local script = "<script>\n"
  -- Use TextDecoder to properly handle UTF-8 encoded characters (accents, etc.)
  -- atob() alone returns a binary Latin-1 string and corrupts non-ASCII chars.
  script = script .. "window._input_file = new TextDecoder('utf-8').decode(\n"
  script = script .. "  Uint8Array.from(atob('" .. encoded .. "'), function(c) { return c.charCodeAt(0); })\n"
  script = script .. ");\n"
  script = script .. "window._input_filename = '" .. filename .. "';\n"
  script = script .. "</script>"

  quarto.doc.include_text("in-header", script)
  return doc
end
