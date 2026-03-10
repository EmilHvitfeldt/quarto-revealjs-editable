#!/bin/bash

cd "$(dirname "$0")"

# Create symlink to _extensions if it doesn't exist
if [ ! -e "_extensions" ]; then
  ln -s ../_extensions _extensions
fi

echo "=== Quarto Editable Extension Tests ==="
echo ""

FAILED=0

# Helper function to run a render test
run_render_test() {
  local test_name="$1"
  local qmd_file="$2"
  local check_type="$3"  # "inject", "no-inject", or "base64"

  echo "$test_name..."

  local html_file="${qmd_file%.qmd}.html"
  local output
  output=$(quarto render "$qmd_file" 2>&1)
  local exit_code=$?

  if [ $exit_code -ne 0 ]; then
    echo "  ✗ Render failed"
    echo "    Error: $output"
    FAILED=1
    return
  fi

  case "$check_type" in
    inject)
      if grep -q "window._input_file" "$html_file" 2>/dev/null; then
        echo "  ✓ Pass"
      else
        echo "  ✗ _input_file missing"
        FAILED=1
      fi
      ;;
    no-inject)
      if grep -q "window._input_file" "$html_file" 2>/dev/null; then
        echo "  ✗ _input_file should NOT be injected"
        FAILED=1
      else
        echo "  ✓ Pass (no injection)"
      fi
      ;;
    base64)
      if grep -q "atob(" "$html_file" 2>/dev/null; then
        echo "  ✓ Pass (base64 encoding)"
      else
        echo "  ✗ base64 encoding not found"
        FAILED=1
      fi
      ;;
  esac
}

# Helper function to verify content is preserved in base64 encoding
verify_content_preserved() {
  local test_name="$1"
  local qmd_file="$2"
  local pattern="$3"  # Pattern that must exist in decoded content

  echo "$test_name..."

  local html_file="${qmd_file%.qmd}.html"

  if [ ! -f "$html_file" ]; then
    echo "  ✗ HTML file not found (render first)"
    FAILED=1
    return
  fi

  # Extract base64 string from HTML
  local encoded
  encoded=$(grep -o "atob('[^']*')" "$html_file" 2>/dev/null | head -1 | sed "s/atob('//;s/')//")

  if [ -z "$encoded" ]; then
    echo "  ✗ No base64 content found"
    FAILED=1
    return
  fi

  # Decode and check for pattern
  local decoded
  decoded=$(echo "$encoded" | base64 -d 2>/dev/null)

  if echo "$decoded" | grep -q "$pattern"; then
    echo "  ✓ Pass (content preserved)"
  else
    echo "  ✗ Pattern '$pattern' not found in decoded content"
    FAILED=1
  fi
}

# Helper to check clipboard feature exists
check_clipboard_feature() {
  local test_name="$1"
  local html_file="$2"

  echo "$test_name..."

  if [ ! -f "$html_file" ]; then
    echo "  ✗ HTML file not found"
    FAILED=1
    return
  fi

  # Find the editable.js file path from HTML
  local js_file
  js_file=$(grep -o '[^"]*editable\.js' "$html_file" 2>/dev/null | head -1)

  if [ -z "$js_file" ]; then
    echo "  ✗ editable.js not referenced in HTML"
    FAILED=1
    return
  fi

  # Make path relative to current directory
  local js_path="${html_file%.html}_files/libs/revealjs/plugin/revealeditable/editable.js"

  if [ ! -f "$js_path" ]; then
    echo "  ✗ editable.js not found at $js_path"
    FAILED=1
    return
  fi

  # Check that copyQmdToClipboard function exists
  if grep -q "copyQmdToClipboard" "$js_path" 2>/dev/null; then
    echo "  ✓ copyQmdToClipboard function present"
  else
    echo "  ✗ copyQmdToClipboard function missing"
    FAILED=1
    return
  fi

  # Check that clipboard button text is in the JS
  if grep -q "Copy qmd to Clipboard" "$js_path" 2>/dev/null; then
    echo "  ✓ Clipboard menu button code present"
  else
    echo "  ✗ Clipboard menu button code missing"
    FAILED=1
  fi
}

# Check multiple editable elements are detected
check_multiple_elements() {
  local test_name="$1"
  local html_file="$2"
  local expected_count="$3"

  echo "$test_name..."

  if [ ! -f "$html_file" ]; then
    echo "  ✗ HTML file not found"
    FAILED=1
    return
  fi

  # Count editable elements in HTML (img.editable and div.editable)
  local count
  count=$(grep -o 'class="[^"]*editable[^"]*"' "$html_file" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$count" -ge "$expected_count" ]; then
    echo "  ✓ Pass ($count editable elements found)"
  else
    echo "  ✗ Expected at least $expected_count elements, found $count"
    FAILED=1
  fi
}

echo "--- Basic Tests ---"
run_render_test "Test 1: Basic rendering" "basic.qmd" "inject"
run_render_test "Test 2: No editable elements" "no-editable.qmd" "no-inject"
run_render_test "Test 3: Special characters" "special-chars.qmd" "inject"
run_render_test "Test 4: Shortcodes" "shortcode.qmd" "inject"
run_render_test "Test 5: UTF-8 content" "utf8.qmd" "inject"
run_render_test "Test 6: Include-in-header (#21)" "include-header.qmd" "inject"
run_render_test "Test 7: Backslash preservation (#13, #14)" "windows-paths.qmd" "base64"

echo ""
echo "--- Content Preservation Tests ---"
run_render_test "Test 8: Round-trip content" "round-trip.qmd" "inject"
verify_content_preserved "Test 8a: LaTeX preserved" "round-trip.qmd" '\\frac'
verify_content_preserved "Test 8b: Shortcode preserved" "round-trip.qmd" '{{< meta title >}}'
verify_content_preserved "Test 8c: Backslash-b preserved" "round-trip.qmd" '\\b should'

run_render_test "Test 9: Complex LaTeX (#16)" "latex.qmd" "inject"
verify_content_preserved "Test 9a: Array preserved" "latex.qmd" '\\begin{array}'
verify_content_preserved "Test 9b: Dfrac preserved" "latex.qmd" '\\dfrac'
verify_content_preserved "Test 9c: Lambda preserved" "latex.qmd" '\\lambda'

echo ""
echo "--- Multiple Elements Tests ---"
run_render_test "Test 10: Multiple elements" "multiple-elements.qmd" "inject"
check_multiple_elements "Test 10a: Element count" "multiple-elements.html" 4

echo ""
echo "--- Regression Tests ---"
run_render_test "Test 11: Content with colons (regex fix)" "colons-in-content.qmd" "inject"
verify_content_preserved "Test 11a: Colons preserved" "colons-in-content.qmd" 'Time: 12:30'
run_render_test "Test 12: Bare ::: editable syntax" "bare-syntax.qmd" "inject"
check_multiple_elements "Test 12a: Both syntaxes create elements" "bare-syntax.html" 2

echo ""
echo "--- Feature Tests ---"
check_clipboard_feature "Test 13: Clipboard feature (#8)" "basic.html"

echo ""
if [ $FAILED -eq 0 ]; then
  echo "=== All tests passed! ==="
  exit 0
else
  echo "=== Some tests failed ==="
  exit 1
fi
