function Pandoc(doc)
  doc.blocks:insert(pandoc.RawBlock("html", "<script> window._input_filename = '" .. quarto.doc.input_file .. "'</script>"))
  return doc
end