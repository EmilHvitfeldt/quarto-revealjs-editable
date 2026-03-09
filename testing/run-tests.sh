#!/bin/bash

cd "$(dirname "$0")"

# Create symlink to _extensions if it doesn't exist
if [ ! -e "_extensions" ]; then
  ln -s ../_extensions _extensions
fi

echo "=== Quarto Editable Extension Tests ==="
echo ""

FAILED=0

# Helper function to run a test
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

run_render_test "Test 1: Basic rendering" "basic.qmd" "inject"
run_render_test "Test 2: No editable elements" "no-editable.qmd" "no-inject"
run_render_test "Test 3: Special characters" "special-chars.qmd" "inject"
run_render_test "Test 4: Shortcodes" "shortcode.qmd" "inject"
run_render_test "Test 5: UTF-8 content" "utf8.qmd" "inject"
run_render_test "Test 6: Include-in-header (#21)" "include-header.qmd" "inject"
run_render_test "Test 7: Backslash preservation (#13, #14)" "windows-paths.qmd" "base64"

echo ""
if [ $FAILED -eq 0 ]; then
  echo "=== All tests passed! ==="
  exit 0
else
  echo "=== Some tests failed ==="
  exit 1
fi
