function Pandoc(doc)
  local text = assert(io.open(quarto.doc.input_file, "r")):read("a")
  text = string.gsub(text, "\"", "\\\"")
  text = string.gsub(text, "\n", "\\n\" + \"")
  text = "\"" .. text .. "\""
  doc.blocks:insert(pandoc.RawBlock("html", "<script> window._input_file = " .. text .. "</script>"))
  doc.blocks:insert(pandoc.RawBlock("html", "<script> window._input_filename = '" .. quarto.doc.input_file .. "'</script>"))
  return doc
end