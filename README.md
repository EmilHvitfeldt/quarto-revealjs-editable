# editable Extension For Quarto Revealjs

This Revealjs plugin allows the repositioning, resizing, and rotating of images and text divs directly in the previewed slides.

**[View Full Documentation](https://emilhvitfeldt.github.io/quarto-revealjs-editable/)**

![](demo-text.mp4)

## Installing

```bash
quarto add emilhvitfeldt/quarto-revealjs-editable
```

This will install the extension under the `_extensions` subdirectory.
If you're using version control, you will want to check in this directory.

## Quick Start

Add the extension to your YAML header:

```yaml
revealjs-plugins:
  - editable
filters:
  - editable
```

Mark elements as editable:

```markdown
![](image.png){.editable}

::: {.editable}
some text here
:::
```

Once rendered, editable elements can be:

- **Moved**: Drag to reposition
- **Resized**: Use corner handles (Shift to preserve aspect ratio)
- **Rotated**: Use the orange handle at top center (Shift to snap to 15°)

## Features

- Floating toolbar for quick actions (save, copy, add text, add slide, add arrow)
- Rich text editing with formatting (bold, italic, colors, alignment)
- Arrow support with straight and curved (Bezier) arrows (requires [quarto-arrows](https://github.com/EmilHvitfeldt/quarto-arrows))
- Brand color support via `_brand.yml`
- Keyboard navigation for accessibility
- Undo/Redo support

## Documentation

For complete documentation including all features, customization options, and keyboard shortcuts, visit the **[documentation site](https://emilhvitfeldt.github.io/quarto-revealjs-editable/)**.

## Example

See [example.qmd](example.qmd) for a minimal working example.
