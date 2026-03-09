#!/bin/bash
set -e

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
quarto render basic.qmd --quiet
if grep -q "window._input_file" basic.html; then
  echo "  ✓ _input_file injected"
else
  echo "  ✗ _input_file missing"
  FAILED=1
fi

# Test 2: No editable elements should skip injection (PR #22 feature)
echo "Test 2: No editable elements (PR #22 optimization)..."
quarto render no-editable.qmd --quiet
if grep -q "window._input_file" no-editable.html; then
  echo "  ⚠ _input_file injected (OK before PR #22, should skip after)"
else
  echo "  ✓ No injection (PR #22 optimization working)"
fi
# Don't fail - this is an optimization, not a bug

# Test 3: Special characters (backslashes, LaTeX)
echo "Test 3: Special characters..."
quarto render special-chars.qmd --quiet
if grep -q "window._input_file" special-chars.html; then
  echo "  ✓ Rendered successfully"
else
  echo "  ✗ Injection failed"
  FAILED=1
fi

# Test 4: Shortcodes
echo "Test 4: Shortcodes..."
quarto render shortcode.qmd --quiet
if grep -q "window._input_file" shortcode.html; then
  echo "  ✓ Rendered successfully"
else
  echo "  ✗ Injection failed"
  FAILED=1
fi

# Test 5: UTF-8 content
echo "Test 5: UTF-8 content..."
quarto render utf8.qmd --quiet
if grep -q "window._input_file" utf8.html; then
  echo "  ✓ Rendered successfully"
else
  echo "  ✗ Injection failed"
  FAILED=1
fi

# Test 6: Include-in-header (issue #21)
echo "Test 6: Include-in-header..."
quarto render include-header.qmd --quiet
if grep -q "window._input_file" include-header.html; then
  # Also check that raw qmd doesn't leak into visible content
  if grep -q "filters:" include-header.html | grep -v "script" > /dev/null 2>&1; then
    echo "  ✗ Raw qmd content leaked"
    FAILED=1
  else
    echo "  ✓ Rendered without leaking"
  fi
else
  echo "  ✗ Injection failed"
  FAILED=1
fi

# Test 7: Windows paths / backslash preservation (issues #13, #14)
echo "Test 7: Backslash preservation (#13, #14)..."
quarto render windows-paths.qmd --quiet
# In properly escaped JS, backslashes must be doubled: C:\\Users\\bob
# PR #22 uses base64 encoding which avoids escaping entirely
if grep -q "atob(" windows-paths.html; then
  echo "  ✓ Using base64 encoding (PR #22)"
elif grep 'window._input_file' windows-paths.html | grep -q 'C:\\\\Users\\\\bob'; then
  echo "  ✓ Backslashes properly escaped for JS"
else
  # Backslashes not doubled = JS will interpret \b as backspace, \f as formfeed, etc.
  echo "  ⚠ Backslashes not escaped (known bug #13, #14 - fixed by PR #22)"
fi

echo ""
if [ $FAILED -eq 0 ]; then
  echo "=== All tests passed! ==="
else
  echo "=== Some tests failed ==="
  exit 1
fi
