-- Pure Lua base64 encoder
local function b64encode(data)
  local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  return ((data:gsub('.', function(x)
    local r, b64 = '', x:byte()
    for i = 8, 1, -1 do r = r .. (b64 % 2^i - b64 % 2^(i-1) > 0 and '1' or '0') end
    return r
  end) .. '0000'):gsub('%d%d%d%d%d%d', function(x)
    if #x < 6 then return '' end
    local c = 0
    for i = 1, 6 do c = c + (x:sub(i,i) == '1' and 2^(6-i) or 0) end
    return b:sub(c+1, c+1)
  end) .. ({'', '==', '='})[#data % 3 + 1])
end

function Pandoc(doc)
  local text = assert(io.open(quarto.doc.input_file, "r")):read("a")
  local encoded = b64encode(text)

  local script = "<script>\n"
  script = script .. "window._input_file = atob('" .. encoded .. "');\n"
  script = script .. "window._input_filename = '" .. quarto.doc.input_file .. "';\n"
  script = script .. "</script>"

  local tmpfile = os.tmpname() .. ".html"
  local f = assert(io.open(tmpfile, "w"))
  f:write(script)
  f:close()

  quarto.doc.include_file("in-header", tmpfile)
  return doc
end
