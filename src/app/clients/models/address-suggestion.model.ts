/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * A distinct existing address returned by `GET /client/addresses/search?prefix=&limit=`.
 * Used to pre-fill the address hierarchy when entering a client address.
 */
export interface AddressSuggestion {
  addressLine1: string;
  addressLine2?: string | null;
  addressLine3?: string | null;
  townVillage?: string | null;
  countyDistrict?: string | null;
  stateProvinceId?: number | null;
  stateName?: string | null;
  countryId?: number | null;
  countryName?: string | null;
}
