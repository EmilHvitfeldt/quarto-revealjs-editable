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

function Pandoc(doc)
  local filename = quarto.doc.input_file
  local text = assert(io.open(filename, "r")):read("a")
  local encoded = b64encode(text)

  local script = "<script>\n"
  script = script .. "window._input_file = atob('" .. encoded .. "');\n"
  script = script .. "window._input_filename = '" .. filename .. "';\n"
  script = script .. "</script>"

  local tmpfile = os.tmpname() .. ".html"
  local f = assert(io.open(tmpfile, "w"))
  f:write(script)
  f:close()

  quarto.doc.include_file("in-header", tmpfile)
  return doc
end
