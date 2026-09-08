/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Template text that a WYSIWYG editor cannot round trip: a full HTML document, a `<style>` or
 * `<script>` block, or a Mustache section/inverted-section/partial tag. TinyMCE parses its input as
 * a body fragment, so it silently drops everything outside `<body>` and rewrites the rest — saving
 * such a template through the rich text editor destroys it. These are edited as source instead.
 */
const ADVANCED_TEMPLATE_MARKERS =
  /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<style[\s>]|<script[\s>]|{{[#^>/]/i;

/**
 * Whether the template text has to be edited and displayed as source rather than as rich text.
 * @param {string} text Template text.
 * @returns {boolean} True when the text is a full HTML document or carries styles, scripts or Mustache sections.
 */
export function isAdvancedTemplateText(text: string): boolean {
  return ADVANCED_TEMPLATE_MARKERS.test(text || '');
}

/**
 * Whether the template text is a complete HTML document rather than a body fragment.
 * @param {string} text Template text.
 * @returns {boolean} True for a full document.
 */
export function isFullHtmlDocument(text: string): boolean {
  return /<!doctype\s+html|<html[\s>]/i.test(text || '');
}

/**
 * Builds the document handed to the preview frame. A full document is previewed as it stands; a
 * fragment is wrapped so it inherits a readable font instead of the frame's 16px serif default.
 * @param {string} text Template text.
 * @returns {string} A self contained HTML document.
 */
export function wrapTemplateTextForPreview(text: string): string {
  const content = text || '';
  if (isFullHtmlDocument(content)) {
    return content;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body { font-family: "Noto Sans Khmer", Roboto, "Helvetica Neue", sans-serif; font-size: 14px; margin: 16px; }
    img { max-width: 100%; }
    table { border-collapse: collapse; }
  </style></head><body>${content}</body></html>`;
}
