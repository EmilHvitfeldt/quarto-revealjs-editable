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
![](image.png){.editable}
```

or like so for text.

```markdown
::: {.editable}
some text here
:::

or

::: editable
some text here
:::
```

Note that this extension will completely rewrite the `{}`.

Once you have rerendered the slides, each image with the id should be movable and resizable using the corners.
Holding shift while pulling the corners respects aspect ratios.

Once you are happy with the sizes, open the menu (M), go to tools, and click "Save Edits". This will prompt you to save a file. Choose the same folder you are working in to overwrite the document you are in. Rerender, and the elements should be locked in place.

## Keyboard Navigation

Editable elements support keyboard navigation for accessibility:

- **Tab** to focus an editable element (controls will appear)
- **Arrow keys** to move the element (10px per press)
- **Shift + Arrow keys** to resize the element
- **Shift + Tab** to exit and return to normal slide navigation
- All control buttons are keyboard accessible

Note that this extension adds the file name of the slides qmd file to the document itself, if you don't want that you happen, remove `editable` from `filters` before making the document public. And rerender the document.

> [!TIP]
> sometimes you might find that images don't stay the size that you dragged them to be. this is because the default is to set `max-width` and `max-height` to `95%`. We can undo that by adding the following to out scss file.
> ```scss
> .reveal img {
>   max-width: unset;
>   max-height: unset;
> }
> ```

## Customizing Appearance

You can customize the appearance of editable controls using CSS custom properties. Add these to your custom SCSS/CSS file:

```scss
:root {
  --editable-accent-color: #ff6600;      /* Main accent color (handles, buttons, border) */
  --editable-accent-active: #00cc00;     /* Color when edit mode is active */
  --editable-handle-size: 12px;            /* Size of resize corner handles */
  --editable-handle-border-color: #000;  /* Border color around handles */
  --editable-border-width: 3px;            /* Border width when hovering */
  --editable-transition: 0.3s;             /* Animation duration */
}
```

## Demo Video

![](demo-text.gif)

## Example

Here is the source code for a minimal example: [example.qmd](example.qmd).

