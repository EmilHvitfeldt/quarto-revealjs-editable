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

| File                   | What it tests                              | Related Issue |
|------------------------|--------------------------------------------|---------------|
| `basic.qmd`            | Basic image and text editable              | -             |
| `no-editable.qmd`      | No injection when no `.editable` elements  | -             |
| `special-chars.qmd`    | Backslashes, LaTeX, trailing spaces        | #16           |
| `shortcode.qmd`        | Quarto shortcodes in editable divs         | #15           |
| `utf8.qmd`             | Accented characters and emoji              | -             |
| `include-header.qmd`   | Custom scripts in header don't break       | #21           |
| `windows-paths.qmd`    | Windows-style paths with backslashes       | #13, #14      |
| `round-trip.qmd`       | LaTeX + shortcodes + backslashes together  | #15, #16      |
| `latex.qmd`            | Complex LaTeX equations                    | #16           |
| `multiple-elements.qmd`| Multiple images and divs in one document   | -             |

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

### What the E2E tests check

| Test | What it verifies |
|------|------------------|
| Save Edits transforms content | `{.editable}` becomes `{.absolute width=... height=...}` |
| Elements wrapped correctly | Editable elements get positioned containers with resize handles |
| Dimensions extracted | `extracteditableEltDimensions()` returns width/height/left/top |
| Clipboard works | `copyQmdToClipboard()` writes to clipboard |
| Shortcodes preserved | `{{< meta title >}}` survives the save process |
| LaTeX preserved | `\dfrac`, `\lambda`, etc. survive the save process |

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

| Issue | Description                           | Covered by |
|-------|---------------------------------------|------------|
| #8    | Clipboard feature                     | Shell + E2E |
| #13   | Windows path separator                | `windows-paths.qmd` |
| #14   | Backslash corruption                  | `windows-paths.qmd`, `round-trip.qmd` |
| #15   | Shortcodes resolved incorrectly       | `shortcode.qmd`, `round-trip.qmd`, E2E |
| #16   | Backslashes removed (LaTeX)           | `special-chars.qmd`, `latex.qmd`, E2E |
| #21   | Content leaks with include-in-header  | `include-header.qmd` |
