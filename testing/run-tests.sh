#!/bin/bash

cd "$(dirname "$0")"

# Create symlink to _extensions if it doesn't exist
if [ ! -e "_extensions" ]; then
  ln -s ../_extensions _extensions
fi

echo "=== Quarto Editable Extension Tests ==="
echo ""

FAILED=0

# Test 1: Basic rendering with editable elements
echo "Test 1: Basic rendering..."
if ! quarto render basic.qmd --quiet 2>&1; then
  echo "  ✗ Render failed"
  FAILED=1
elif grep -q "window._input_file" basic.html 2>/dev/null; then
  echo "  ✓ _input_file injected"
else
  echo "  ✗ _input_file missing"
  FAILED=1
fi

# Test 2: No editable elements should skip injection
echo "Test 2: No editable elements..."
if ! quarto render no-editable.qmd --quiet 2>&1; then
  echo "  ✗ Render failed"
  FAILED=1
elif grep -q "window._input_file" no-editable.html 2>/dev/null; then
  echo "  ✗ _input_file should NOT be injected when no .editable elements"
  FAILED=1
else
  echo "  ✓ No injection (correct)"
fi

# Test 3: Special characters (backslashes, LaTeX)
echo "Test 3: Special characters..."
if ! quarto render special-chars.qmd --quiet 2>&1; then
  echo "  ✗ Render failed"
  FAILED=1
elif grep -q "window._input_file" special-chars.html 2>/dev/null; then
  echo "  ✓ Rendered successfully"
else
  echo "  ✗ Injection failed"
  FAILED=1
fi

# Test 4: Shortcodes
echo "Test 4: Shortcodes..."
if ! quarto render shortcode.qmd --quiet 2>&1; then
  echo "  ✗ Render failed"
  FAILED=1
elif grep -q "window._input_file" shortcode.html 2>/dev/null; then
  echo "  ✓ Rendered successfully"
else
  echo "  ✗ Injection failed"
  FAILED=1
fi

# Test 5: UTF-8 content
echo "Test 5: UTF-8 content..."
if ! quarto render utf8.qmd --quiet 2>&1; then
  echo "  ✗ Render failed"
  FAILED=1
elif grep -q "window._input_file" utf8.html 2>/dev/null; then
  echo "  ✓ Rendered successfully"
else
  echo "  ✗ Injection failed"
  FAILED=1
fi

# Test 6: Include-in-header (issue #21)
echo "Test 6: Include-in-header..."
if ! quarto render include-header.qmd --quiet 2>&1; then
  echo "  ✗ Render failed"
  FAILED=1
elif grep -q "window._input_file" include-header.html 2>/dev/null; then
  echo "  ✓ Rendered successfully"
else
  echo "  ✗ Injection failed"
  FAILED=1
fi

# Test 7: Windows paths / backslash preservation (issues #13, #14)
echo "Test 7: Backslash preservation (#13, #14)..."
if ! quarto render windows-paths.qmd --quiet 2>&1; then
  echo "  ✗ Render failed"
  FAILED=1
elif grep -q "atob(" windows-paths.html 2>/dev/null; then
  echo "  ✓ Using base64 encoding"
elif grep "window._input_file" windows-paths.html 2>/dev/null | grep -q 'C:\\\\Users\\\\bob'; then
  echo "  ✓ Backslashes properly escaped"
else
  echo "  ✗ Backslashes not properly escaped"
  FAILED=1
fi

echo ""
if [ $FAILED -eq 0 ]; then
  echo "=== All tests passed! ==="
  exit 0
else
  echo "=== Some tests failed ==="
  exit 1
fi
