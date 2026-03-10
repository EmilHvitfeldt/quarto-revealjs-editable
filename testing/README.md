# Testing

This extension has two types of tests:

1. **Shell tests** - Fast, checks that Quarto renders correctly
2. **E2E tests** - Browser-based, checks that "Save Edits" works

## Quick Start

```bash
# Run the basic tests (just needs Quarto)
./run-tests.sh

# Run browser tests too (needs Node.js)
npm install
npm run test:e2e
```

---

## Shell Tests (`run-tests.sh`)

**What they test:** Rendering works, content is preserved in base64 encoding

**Requirements:** Just Quarto

**When to run:** Always - these are the main tests

```bash
./run-tests.sh
```

### Test Files

| File                     | What it tests                             | Related Issue |
|--------------------------|-------------------------------------------|---------------|
| `basic.qmd`              | Basic image and text editable             | -             |
| `no-editable.qmd`        | No injection when no `.editable` elements | -             |
| `special-chars.qmd`      | Backslashes, LaTeX, trailing spaces       | #16           |
| `shortcode.qmd`          | Quarto shortcodes in editable divs        | #15           |
| `utf8.qmd`               | Accented characters and emoji             | -             |
| `include-header.qmd`     | Custom scripts in header don't break      | #21           |
| `windows-paths.qmd`      | Windows-style paths with backslashes      | #13, #14      |
| `round-trip.qmd`         | LaTeX + shortcodes + backslashes together | #15, #16      |
| `latex.qmd`              | Complex LaTeX equations                   | #16           |
| `multiple-elements.qmd`  | Multiple images and divs in one document  | -             |
| `colons-in-content.qmd`  | Content with colons (regex fix)           | -             |
| `bare-syntax.qmd`        | Both `::: editable` and `::: {.editable}` | -             |

### What the shell tests check

1. **Render succeeds** - Quarto doesn't error
2. **Injection works** - `window._input_file` appears in HTML (or doesn't when not needed)
3. **Content preserved** - Base64-decoded content contains expected patterns (`\frac`, `{{< meta >}}`, etc.)
4. **Clipboard code exists** - The `copyQmdToClipboard` function is present

---

## E2E Tests (Playwright)

**What they test:** JavaScript works correctly in a real browser

**Requirements:** Node.js + Playwright

**When to run:** When changing JavaScript code, or before releases

```bash
npm install                    # First time only
npx playwright install chromium  # First time only
npm run test:e2e
```

### E2E Test Files

**`e2e/save-edits.spec.js`** - Core save functionality (8 tests):

| Test                          | What it verifies                                   |
|-------------------------------|---------------------------------------------------|
| Save Edits transforms content | `{.editable}` → `{.absolute width=... height=...}` |
| Containers wrapped correctly  | `position: absolute` and resize handles            |
| Dimensions extracted          | `extracteditableEltDimensions()` returns valid data |
| Clipboard works               | `copyQmdToClipboard()` writes to clipboard         |
| Shortcodes in base64          | `{{< meta title >}}` preserved in source           |
| Content with colons           | Div content with `:` handled correctly (regex fix) |
| Both div syntaxes work        | `::: editable` and `::: {.editable}` both work     |
| LaTeX preserved               | `\dfrac`, `\lambda` survive save                   |

**`e2e/ui-controls.spec.js`** - UI elements (21 tests):

| Test                             | What it verifies                                  |
|----------------------------------|---------------------------------------------------|
| Font controls exist              | 6 buttons (A-, A+, align×3, edit)                 |
| Font size changes                | Style updates correctly                           |
| Text alignment works             | `textAlign` style can be set                      |
| Edit mode works                  | `contentEditable` toggles                         |
| Resize handles created           | 4 handles (nw, ne, sw, se)                        |
| Menu buttons added               | Save & Copy buttons in menu                       |
| Dragging image                   | Container position changes after drag             |
| Resizing image                   | Element dimensions change after resize            |
| Dragging div                     | Div container position changes after drag         |
| Resize with shift key            | Aspect ratio preserved during resize              |
| Resize from NW corner            | Position adjusts when resizing from top-left      |
| Resize minimum size              | Cannot resize below 50px                          |
| Font size decrease minimum       | Cannot decrease font below 8px                    |
| Font size increase button        | A+ button increases font size                     |
| Alignment buttons                | Left/center/right buttons set `textAlign`         |
| Edit mode button                 | Edit button toggles `contentEditable`             |
| Multiple elements independent    | Each element has its own container and handlers   |
| Multiple elements dimensions     | `extracteditableEltDimensions()` returns all      |
| No global variable pollution     | Save functions don't leak globals                 |
| htmlToQuarto conversion          | `<strong>`→`**`, `<em>`→`*`, `<code>`→backticks   |
| Strikethrough conversion         | `<del>`→`~~`                                      |

---

## CI Workflow

On GitHub Actions:

```
┌─────────────────────────────────────────┐
│         Shell tests (parallel)          │
├─────────────┬─────────────┬─────────────┤
│   Ubuntu    │   macOS     │   Windows   │
└──────┬──────┴──────┬──────┴──────┬──────┘
       └─────────────┼─────────────┘
                     ▼
              ┌─────────────┐
              │  E2E tests  │
              │  (Ubuntu)   │
              └─────────────┘
```

- Shell tests run on **all platforms** to catch OS-specific issues
- E2E tests run on **Ubuntu only** (JS behavior is the same everywhere)

---

## Issue Coverage

| Issue | Description                          | Covered by                                |
|-------|--------------------------------------|-------------------------------------------|
| #8    | Clipboard feature                    | Shell + E2E                               |
| #13   | Windows path separator               | `windows-paths.qmd`                       |
| #14   | Backslash corruption                 | `windows-paths.qmd`, `round-trip.qmd`     |
| #15   | Shortcodes resolved incorrectly      | `shortcode.qmd`, `round-trip.qmd`, E2E    |
| #16   | Backslashes removed (LaTeX)          | `special-chars.qmd`, `latex.qmd`, E2E     |
| #21   | Content leaks with include-in-header | `include-header.qmd`                      |
