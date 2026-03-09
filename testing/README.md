# Test Fixtures

Test files for the editable extension. Run locally with:

```bash
./run-tests.sh
```

## Test Cases

| File                 | Tests                                      | Related Issue |
|----------------------|--------------------------------------------|---------------|
| `basic.qmd`          | Basic image and text editable              | -             |
| `no-editable.qmd`    | No injection when no `.editable` elements  | -             |
| `special-chars.qmd`  | Backslashes, LaTeX, trailing spaces        | #16           |
| `shortcode.qmd`      | Quarto shortcodes in editable divs         | #15           |
| `utf8.qmd`           | Accented characters and emoji              | -             |
| `include-header.qmd` | Custom scripts in header                   | #21           |
| `windows-paths.qmd`  | Windows-style paths with backslashes       | #13, #14      |
