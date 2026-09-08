/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { isAdvancedTemplateText, isFullHtmlDocument, wrapTemplateTextForPreview } from './template-text.utils';

describe('template text utils', () => {
  describe('isAdvancedTemplateText', () => {
    it('accepts a rich text fragment', () => {
      expect(isAdvancedTemplateText('<p>Dear {{client.displayName}},</p>')).toBe(false);
      expect(isAdvancedTemplateText('')).toBe(false);
      expect(isAdvancedTemplateText(null)).toBe(false);
    });

    it('flags a full HTML document', () => {
      expect(isAdvancedTemplateText('<!DOCTYPE html>\n<html lang="km"><body>x</body></html>')).toBe(true);
    });

    it('flags styles and scripts', () => {
      expect(isAdvancedTemplateText('<style>body { margin: 0; }</style>')).toBe(true);
      expect(isAdvancedTemplateText('<script>var a = 1;</script>')).toBe(true);
    });

    it('flags Mustache sections but not plain variables', () => {
      expect(isAdvancedTemplateText('{{#rows}}<tr></tr>{{/rows}}')).toBe(true);
      expect(isAdvancedTemplateText('{{^hasRows}}none{{/hasRows}}')).toBe(true);
      expect(isAdvancedTemplateText('Hello {{reportName}}')).toBe(false);
    });
  });

  describe('wrapTemplateTextForPreview', () => {
    it('leaves a full document untouched', () => {
      const document = '<!DOCTYPE html><html><body>x</body></html>';
      expect(wrapTemplateTextForPreview(document)).toBe(document);
      expect(isFullHtmlDocument(document)).toBe(true);
    });

    it('wraps a fragment in a document', () => {
      const preview = wrapTemplateTextForPreview('<p>hello</p>');
      expect(preview).toContain('<!DOCTYPE html>');
      expect(preview).toContain('<p>hello</p>');
    });

    it('handles empty text', () => {
      expect(wrapTemplateTextForPreview('')).toContain('<body></body>');
    });
  });
});
