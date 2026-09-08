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

/**
 * Fineract serialises a template's entity and type as the name of the referenced row — `"client"`,
 * `"Document"` — and omits the field entirely when the template has none, which is what a template
 * inserted straight into `m_template` with a null `entity_id`/`type_id` looks like. Some payloads
 * carry the whole `{ id, name }` row instead, so both shapes are read here.
 * @param {any} value Raw entity or type from the API.
 * @returns {string} The name, or an empty string when the template has none.
 */
export function templateOptionName(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : (value.name ?? '');
}

/**
 * Resolves the dropdown id for a template's entity or type. Returns null when the template has
 * none, so the required validator holds Submit until one is picked rather than the form blowing up
 * on a missing option.
 * @param {any[]} options Entities or types offered by the template endpoint.
 * @param {any} value Raw entity or type from the API.
 * @returns {any} The matching option id, or null.
 */
export function templateOptionId(options: any[], value: any): any {
  const name = templateOptionName(value);
  const match = (options || []).find((option: any) => option.name === name);
  return match ? match.id : null;
}
