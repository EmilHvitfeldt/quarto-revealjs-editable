/**
 * File IO: reading QMD source, serializing edits, saving and copying.
 * @module io
 */

import { debug } from './utils.js';
import {
  extractEditableEltDimensions,
  formatEditableEltStrings,
  replaceEditableOccurrences,
  updateTextDivs,
  insertNewSlides,
  insertNewDivs,
  insertNewArrows,
} from './serialization.js';

/**
 * Read the original QMD content from the injected global variable.
 * @returns {string} Original QMD content or empty string
 */
export function readIndexQmd() {
  if (!window._input_file) {
    console.error("_input_file not found. Was the editable filter applied?");
    return "";
  }
  return window._input_file;
}

/**
 * Get the filename for saving.
 * @returns {string} Filename from injected global
 */
function getEditableFilename() {
  if (!window._input_filename) return 'untitled.qmd';
  return window._input_filename.split(/[/\\]/).pop();
}

/**
 * Get the transformed QMD content with all edits applied.
 * @returns {string} Complete QMD content
 */
export function getTransformedQmd() {
  let content = readIndexQmd();
  if (!content) return "";

  const { text: contentWithSlides, slideLinePositions } = insertNewSlides(content);
  content = contentWithSlides;
  content = insertNewDivs(content, slideLinePositions);
  content = insertNewArrows(content, slideLinePositions);

  const dimensions = extractEditableEltDimensions();
  content = updateTextDivs(content);
  const attributes = formatEditableEltStrings(dimensions);
  const srcReplacements = dimensions.map(d => d.src || null);
  content = replaceEditableOccurrences(content, attributes, srcReplacements);

  return content;
}

/**
 * Download a string as a file. Uses File System Access API if available.
 * @param {string} content - Content to download
 * @param {string} [mimeType="text/plain"] - MIME type
 */
async function downloadString(content, mimeType = "text/plain") {
  const filename = getEditableFilename();

  if ("showSaveFilePicker" in window) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Text files", accept: { [mimeType]: [".txt", ".qmd", ".md"] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      debug("File saved successfully");
      return;
    } catch (error) {
      debug("File picker cancelled or failed, using fallback method");
    }
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Save edits to a file (triggers download dialog).
 */
export function saveMovedElts() {
  try {
    const content = getTransformedQmd();
    if (content) downloadString(content);
  } catch (error) {
    console.error("Error saving:", error);
    alert("Error saving: " + error.message);
  }
}

/**
 * Copy the transformed QMD content to clipboard.
 */
export function copyQmdToClipboard() {
  const content = getTransformedQmd();
  if (!content) return;
  navigator.clipboard.writeText(content).then(() => {
    debug("qmd content copied to clipboard");
  }).catch((err) => {
    console.error("Failed to copy to clipboard:", err);
  });
}
