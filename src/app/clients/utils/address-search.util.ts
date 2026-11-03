/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { UntypedFormGroup } from '@angular/forms';
import { Observable } from 'rxjs';

import { FormfieldAutocomplete } from 'app/shared/form-dialog/formfield/model/formfield-autocomplete';
import { AddressSuggestion } from 'app/clients/models/address-suggestion.model';

/** Minimum typed length before searching existing addresses. */
export const ADDRESS_SEARCH_MIN_LENGTH = 2;

/**
 * Administrative-hierarchy fields copied from a selected existing address.
 * House-specific fields (street, city / house no., coordinates), postal code (not used in Cambodia)
 * and address type are never copied.
 */
export const ADDRESS_HIERARCHY_FIELDS: (keyof AddressSuggestion)[] = [
  'addressLine2',
  'addressLine3',
  'townVillage',
  'countyDistrict',
  'stateProvinceId',
  'countryId'
];

/** Fields whose value must exist in the address template options to be applied. */
const OPTION_FIELDS: Partial<Record<keyof AddressSuggestion, string>> = {
  stateProvinceId: 'stateProvinceIdOptions',
  countryId: 'countryIdOptions'
};

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function findOptionName(addressTemplate: any, optionsKey: string, id: unknown): string | undefined {
  return addressTemplate?.[optionsKey]?.find((option: any) => option.id === id)?.name;
}

/**
 * Builds the label shown for a suggestion: village, commune, district, province.
 */
export function formatAddressSuggestion(suggestion: AddressSuggestion, addressTemplate?: any): string {
  const stateName =
    suggestion.stateName ?? findOptionName(addressTemplate, 'stateProvinceIdOptions', suggestion.stateProvinceId);
  return [
    suggestion.addressLine1,
    suggestion.addressLine2,
    suggestion.addressLine3,
    stateName
  ]
    .filter(hasValue)
    .join(', ');
}

/**
 * Copies the administrative hierarchy of a selected suggestion into the address form.
 * Only fields present in the form (i.e. enabled) and present in the suggestion are set.
 */
export function applyAddressSuggestion(form: UntypedFormGroup, suggestion: AddressSuggestion, addressTemplate?: any) {
  for (const field of ADDRESS_HIERARCHY_FIELDS) {
    const control = form.get(field);
    const value = suggestion[field];
    if (!control || !hasValue(value)) {
      continue;
    }
    const optionsKey = OPTION_FIELDS[field];
    if (optionsKey && findOptionName(addressTemplate, optionsKey, value) === undefined) {
      continue;
    }
    control.setValue(value);
    control.markAsDirty();
  }
}

/**
 * Autocomplete config for the Address Line 1 (village) field that searches existing addresses
 * and fills the rest of the hierarchy on selection.
 * @param search Address search function, e.g. `ClientsService.searchAddresses`
 * @param addressTemplate Client address template (state/country options)
 */
export function buildAddressLine1Autocomplete(
  search: (prefix: string) => Observable<AddressSuggestion[]>,
  addressTemplate?: any
): FormfieldAutocomplete<AddressSuggestion> {
  return {
    search,
    minLength: ADDRESS_SEARCH_MIN_LENGTH,
    displayWith: (suggestion) => formatAddressSuggestion(suggestion, addressTemplate),
    optionValue: (suggestion) => suggestion.addressLine1,
    onSelect: (suggestion, form) => applyAddressSuggestion(form, suggestion, addressTemplate)
  };
}
