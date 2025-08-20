# editable Extension For Quarto Revealjs

This Revealjs plugin allows the repositioning and resizing of images and text divs directly in the previewed slides.

## Installing

```bash
quarto add emilhvitfeldt/quarto-revealjs-editable
```

This will install the extension under the `_extensions` subdirectory.
If you're using version control, you will want to check in this directory.

## Using

Designate the extension as a `revealjs-plugins` in the yaml file like so:

```yaml
revealjs-plugins:
  - editable
filters:
  - editable
```

To designate that you want to move and resize an image or a div, add the `editable` id to the image like so.

```markdown
![](image.png){#editable}
```

or like so for text.

```markdown
::: {.editable}
some text here
:::
```

Note that this extension will completely rewrite the `{}`.

Once you have rerendered the slides, each image with the id should be movable and resizable using the corners.
Holding shift while pulling the corners respects aspect ratios.

Once you are happy with the sizes, open the menu (M), go to tools, and click "Save Moved Elements". This will prompt you to save a file. Choose the same folder you are working in to overwrite the document you are in. Rerender, and the elements should be locked in place.

Note that this extension adds the file name of the slides qmd file to the document itself, if you don't want that you happen, remove `editable` from `filters` before making the document public. And rerender the document.

## Demo Video

![](demo-text.gif)

## Example

Here is the source code for a minimal example: [example.qmd](example.qmd).

