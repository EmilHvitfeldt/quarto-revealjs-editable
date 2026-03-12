# editable Extension For Quarto Revealjs

This Revealjs plugin allows the repositioning, resizing, and rotating of images and text divs directly in the previewed slides.

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

Once you have rerendered the slides, each image with the id should be movable, resizable, and rotatable.

- **Move**: Drag the element to reposition it
- **Resize**: Use the corner handles (hold Shift to preserve aspect ratio)
- **Rotate**: Use the orange circular handle at the top center (hold Shift to snap to 15° increments)

## Floating Toolbar

A floating toolbar appears on the right side of the slides with quick access to common actions:

| Button | Action |
|--------|--------|
| 💾 Save | Save edits to file |
| 📋 Copy | Copy QMD to clipboard |
| 📝 Text | Add new editable text to current slide |
| ➕ Slide | Add new slide after current |

The toolbar is draggable - grab the handle at the top to reposition it.

## Adding New Elements

You can add new content directly from the toolbar:

- **Add Text**: Creates a new editable text block on the current slide. Position and style it like any other editable element.
- **Add Slide**: Inserts a new blank slide after the current one. The slide will be saved with a `## New Slide` heading.

New elements are marked with a dashed border to distinguish them from original content.

## Saving

Once you are happy with the layout, use the toolbar or menu to save:

- **Toolbar**: Click the 💾 Save button
- **Menu**: Press M, go to Tools, click "Save Edits"

This will prompt you to save a file. Choose the same folder you are working in to overwrite the document. Rerender, and the elements should be locked in place.

## Keyboard Navigation

Editable elements support keyboard navigation for accessibility:

- **Tab** to focus an editable element (controls will appear)
- **Arrow keys** to move the element (10px per press)
- **Shift + Arrow keys** to resize the element
- **Ctrl/Cmd + Left/Right arrows** to rotate (5° per press)
- **Ctrl/Cmd + Shift + Left/Right arrows** to rotate by larger steps (15°)
- **Shift + Tab** to exit and return to normal slide navigation
- All control buttons are keyboard accessible

## Undo/Redo

Made a mistake? Use keyboard shortcuts to undo and redo your changes:

- **Ctrl+Z** (or **Cmd+Z** on Mac) to undo the last action
- **Ctrl+Y** or **Ctrl+Shift+Z** (or **Cmd+Shift+Z** on Mac) to redo

Undo/redo tracks:
- Element position changes (drag)
- Element size changes (resize)
- Element rotation changes
- Font size changes
- Text alignment changes

Note: Text content editing (in edit mode) uses the browser's native undo, which is separate from the extension's undo stack.

## Preparing for Final Presentation

Once you're done editing and want to present your final slides without the editing UI:

### Option 1: Remove the extension entirely (recommended)

Remove both the plugin and filter from your YAML:

```yaml
# Remove these lines:
# revealjs-plugins:
#   - editable
# filters:
#   - editable
```

Then re-render. Your saved positions use `.absolute` positioning which works without the extension.

### Option 2: Hide the toolbar with CSS

If you want to keep the extension installed but hide the toolbar, add to your custom CSS:

```scss
#editable-toolbar {
  display: none;
}

/* Optionally also hide the edit controls on elements */
.editable-container:hover .resize-handle,
.editable-container:hover .rotate-handle,
.editable-container:hover .editable-font-controls {
  display: none;
}
```

### Security Note

The extension embeds the source QMD filename in the HTML for the save feature. If you don't want this in your public slides, remove `editable` from `filters` before your final render.

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
  /* Element controls */
  --editable-accent-color: #ff6600;      /* Main accent color (handles, buttons, border) */
  --editable-accent-active: #00cc00;     /* Color when edit mode is active */
  --editable-rotate-color: #ff6600;      /* Color of the rotation handle */
  --editable-handle-size: 12px;          /* Size of resize corner handles */
  --editable-handle-border-color: #000;  /* Border color around handles */
  --editable-border-width: 3px;          /* Border width when hovering */
  --editable-transition: 0.3s;           /* Animation duration */

  /* Floating toolbar */
  --editable-toolbar-bg: rgba(0, 0, 0, 0.9);       /* Toolbar background */
  --editable-toolbar-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  --editable-toolbar-border-radius: 12px;
  --editable-toolbar-save-color: #28a745;          /* Save button color */
  --editable-toolbar-copy-color: #6c757d;          /* Copy button color */
  --editable-toolbar-add-text-color: #007cba;      /* Add text button color */
  --editable-toolbar-add-slide-color: #17a2b8;     /* Add slide button color */
}
```

## Demo Video

![](demo-text.gif)

## Example

Here is the source code for a minimal example: [example.qmd](example.qmd).

