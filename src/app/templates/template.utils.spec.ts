/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
  isAdvancedTemplateText,
  isFullHtmlDocument,
  templateOptionId,
  templateOptionName,
  wrapTemplateTextForPreview
} from './template.utils';

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

  describe('templateOptionName', () => {
    it('reads a name string', () => {
      expect(templateOptionName('client')).toBe('client');
    });

    it('reads an object valued entity', () => {
      expect(templateOptionName({ id: 0, name: 'client' })).toBe('client');
    });

    it('returns blank when the template has no entity or type', () => {
      expect(templateOptionName(undefined)).toBe('');
      expect(templateOptionName(null)).toBe('');
      expect(templateOptionName({ id: 0 })).toBe('');
    });
  });

  describe('templateOptionId', () => {
    const entities = [
      { id: 0, name: 'client' },
      { id: 1, name: 'loan' }
    ];

    it('resolves the dropdown id', () => {
      expect(templateOptionId(entities, 'loan')).toBe(1);
      expect(templateOptionId(entities, { id: 1, name: 'loan' })).toBe(1);
    });

    it('returns null rather than throwing when the template has none', () => {
      expect(templateOptionId(entities, undefined)).toBeNull();
      expect(templateOptionId(entities, 'branch')).toBeNull();
      expect(templateOptionId(undefined, 'loan')).toBeNull();
    });
  });
});
