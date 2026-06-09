# editable Extension For Quarto Revealjs

This Revealjs plugin lets you edit slide elements — images, videos, text, tables, code, equations, titles, arrows, and more — directly in the rendered presentation. Move, resize, rotate, restyle, and save changes back to your `.qmd` source.

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

Render normally, then click the **Modify** button in the menu bar to make any element on the current slide editable. No source markup required.

Optionally, pre-mark elements with `{.editable}` to have them active immediately without entering modify mode first:

```markdown
![](image.png){.editable}

::: {.editable}
some text here
:::
```

Once rendered, editable elements (whether activated via modify mode or pre-marked) can be:

- **Moved**: Drag to reposition
- **Resized**: Use corner handles (Shift to preserve aspect ratio)
- **Rotated**: Use the orange handle at top center (Shift to snap to 15°)

## Features

- Modify mode: click any element on a rendered slide to make it editable
- Menu bar for quick actions (save, copy, add text, add slide, add arrow)
- Rich text editing with formatting (bold, italic, colors, alignment)
- Image controls panel: opacity, border radius, crop, flip H/V, replace image, reset
- Arrow support with straight and curved (Bezier) arrows (requires [quarto-arrows](https://github.com/EmilHvitfeldt/quarto-arrows))
- Brand color support via `_brand.yml`
- Keyboard navigation for accessibility
- Undo/Redo support

## Documentation

For complete documentation including all features, customization options, and keyboard shortcuts, visit the **[documentation site](https://emilhvitfeldt.github.io/quarto-revealjs-editable/)**.

## Example

See [example.qmd](example.qmd) for a minimal working example.
