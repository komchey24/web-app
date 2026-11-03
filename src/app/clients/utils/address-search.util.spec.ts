/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { of } from 'rxjs';

import { AddressSuggestion } from 'app/clients/models/address-suggestion.model';
import {
  ADDRESS_SEARCH_MIN_LENGTH,
  applyAddressSuggestion,
  buildAddressLine1Autocomplete,
  formatAddressSuggestion
} from './address-search.util';

const addressTemplate = {
  stateProvinceIdOptions: [{ id: 12, name: 'Kampong Cham' }],
  countryIdOptions: [{ id: 3, name: 'Cambodia' }]
};

const suggestion: AddressSuggestion = {
  addressLine1: 'Village A',
  addressLine2: 'Commune B',
  addressLine3: 'District C',
  stateProvinceId: 12,
  countryId: 3
};

function buildForm(): UntypedFormGroup {
  return new UntypedFormGroup({
    addressLine1: new UntypedFormControl('Vil'),
    addressLine2: new UntypedFormControl(''),
    addressLine3: new UntypedFormControl(''),
    city: new UntypedFormControl('House 12'),
    street: new UntypedFormControl('St 1'),
    postalCode: new UntypedFormControl(''),
    stateProvinceId: new UntypedFormControl(''),
    countryId: new UntypedFormControl('')
  });
}

describe('address-search util', () => {
  describe('formatAddressSuggestion', () => {
    it('joins village, commune, district and province resolved from the template', () => {
      expect(formatAddressSuggestion(suggestion, addressTemplate)).toBe(
        'Village A, Commune B, District C, Kampong Cham'
      );
    });

    it('prefers the stateName returned by the backend and skips empty parts', () => {
      expect(
        formatAddressSuggestion({ addressLine1: 'Village A', addressLine2: null, stateName: 'Takeo' }, addressTemplate)
      ).toBe('Village A, Takeo');
    });
  });

  describe('applyAddressSuggestion', () => {
    it('fills the administrative hierarchy and marks the controls dirty', () => {
      const form = buildForm();

      applyAddressSuggestion(form, suggestion, addressTemplate);

      expect(form.get('addressLine2')?.value).toBe('Commune B');
      expect(form.get('addressLine3')?.value).toBe('District C');
      expect(form.get('stateProvinceId')?.value).toBe(12);
      expect(form.get('countryId')?.value).toBe(3);
      expect(form.get('addressLine2')?.dirty).toBe(true);
    });

    it('never touches house-specific fields or postal code', () => {
      const form = buildForm();

      applyAddressSuggestion(form, { ...suggestion, postalCode: '12000' } as any, addressTemplate);

      expect(form.get('city')?.value).toBe('House 12');
      expect(form.get('street')?.value).toBe('St 1');
      expect(form.get('postalCode')?.value).toBe('');
      expect(form.get('addressLine1')?.value).toBe('Vil');
    });

    it('skips state and country ids that are not in the template options', () => {
      const form = buildForm();

      applyAddressSuggestion(form, { ...suggestion, stateProvinceId: 99, countryId: 98 }, addressTemplate);

      expect(form.get('stateProvinceId')?.value).toBe('');
      expect(form.get('countryId')?.value).toBe('');
    });

    it('ignores fields that are disabled (absent from the form) and empty suggestion values', () => {
      const form = new UntypedFormGroup({ addressLine2: new UntypedFormControl('Existing') });

      applyAddressSuggestion(form, { addressLine1: 'Village A', addressLine2: '', addressLine3: 'District C' });

      expect(form.get('addressLine2')?.value).toBe('Existing');
      expect(form.get('addressLine3')).toBeNull();
    });
  });

  describe('buildAddressLine1Autocomplete', () => {
    it('wires search, option value and selection to the address helpers', () => {
      const search = jest.fn((_prefix: string) => of([suggestion]));
      const autocomplete = buildAddressLine1Autocomplete(search, addressTemplate);
      const form = buildForm();

      autocomplete.search('Vil');
      autocomplete.onSelect?.(suggestion, form);

      expect(search).toHaveBeenCalledWith('Vil');
      expect(autocomplete.minLength).toBe(ADDRESS_SEARCH_MIN_LENGTH);
      expect(autocomplete.optionValue(suggestion)).toBe('Village A');
      expect(autocomplete.displayWith(suggestion)).toBe('Village A, Commune B, District C, Kampong Cham');
      expect(form.get('addressLine2')?.value).toBe('Commune B');
    });
  });
});
