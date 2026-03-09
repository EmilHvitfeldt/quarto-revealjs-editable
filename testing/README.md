# Test Fixtures

Test files for the editable extension.

## Running Tests

### Shell tests (rendering & content verification)
```bash
./run-tests.sh
```

### E2E tests (browser-based, requires Node.js)
```bash
npm install
npm run test:e2e
```

### All tests
```bash
npm run test:all
```

## Test Cases

### Basic Tests

| File                 | Tests                                      | Related Issue |
|----------------------|--------------------------------------------|---------------|
| `basic.qmd`          | Basic image and text editable              | -             |
| `no-editable.qmd`    | No injection when no `.editable` elements  | -             |
| `special-chars.qmd`  | Backslashes, LaTeX, trailing spaces        | #16           |
| `shortcode.qmd`      | Quarto shortcodes in editable divs         | #15           |
| `utf8.qmd`           | Accented characters and emoji              | -             |
| `include-header.qmd` | Custom scripts in header don't break       | #21           |
| `windows-paths.qmd`  | Windows-style paths with backslashes       | #13, #14      |

### Content Preservation Tests

| File                 | Tests                                      | Related Issue |
|----------------------|--------------------------------------------|---------------|
| `round-trip.qmd`     | LaTeX, shortcodes, backslashes survive     | #15, #16      |
| `latex.qmd`          | Complex LaTeX equations preserved          | #16           |

### Multiple Elements Tests

| File                   | Tests                                    | Related Issue |
|------------------------|------------------------------------------|---------------|
| `multiple-elements.qmd`| Multiple images and divs in one document | -             |

### Feature Tests

| Test                 | Description                                | Related Issue |
|----------------------|--------------------------------------------|---------------|
| Clipboard feature    | `copyQmdToClipboard` function exists       | #8            |

## Test Types

1. **Render tests** - Verify Quarto renders without errors
2. **Injection tests** - Verify `window._input_file` is injected (or not)
3. **Content preservation tests** - Verify base64-decoded content matches original patterns
4. **Feature tests** - Verify specific features (clipboard button) exist

## Coverage Summary

| Issue | Description                              | Test Coverage |
|-------|------------------------------------------|---------------|
| #8    | Clipboard feature                        | ✓ Feature test + E2E |
| #13   | Windows path separator in save dialog    | ✓ windows-paths.qmd |
| #14   | Backslash corruption when saving         | ✓ windows-paths.qmd, round-trip.qmd |
| #15   | Shortcodes resolved when saving          | ✓ shortcode.qmd, round-trip.qmd + E2E |
| #16   | Backslashes removed (LaTeX, spaces)      | ✓ special-chars.qmd, latex.qmd, round-trip.qmd + E2E |
| #21   | Content leaks with include-in-header     | ✓ include-header.qmd |

## E2E Tests (Playwright)

Located in `e2e/save-edits.spec.js`:

| Test | What it verifies |
|------|------------------|
| Save Edits transforms editable to absolute | `{.editable}` → `{.absolute width=... height=...}` |
| Editable elements wrapped in containers | Containers have `position: absolute` and resize handles |
| Dimensions extracted correctly | `extracteditableEltDimensions()` returns valid data |
| Copy to clipboard works | `copyQmdToClipboard()` writes transformed content |
| Shortcodes preserved | `{{< meta title >}}` survives save |
| LaTeX preserved | `\dfrac`, `\lambda`, etc. survive save |
