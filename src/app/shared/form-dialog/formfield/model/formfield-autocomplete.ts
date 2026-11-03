/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { UntypedFormGroup } from '@angular/forms';
import { Observable } from 'rxjs';

/**
 * Optional autocomplete behaviour for an input form field.
 * When set, the field shows a dropdown of suggestions returned by `search`.
 * Free text is still allowed; selecting a suggestion is optional.
 */
export interface FormfieldAutocomplete<T = any> {
  /** Returns the suggestions for the typed (trimmed) term. */
  search: (term: string) => Observable<T[]>;
  /** Text shown for a suggestion in the dropdown. */
  displayWith: (option: T) => string;
  /** Value written into this field's control when a suggestion is selected. */
  optionValue: (option: T) => string;
  /** Called after a suggestion is selected, e.g. to fill other fields of the form. */
  onSelect?: (option: T, form: UntypedFormGroup) => void;
  /** Minimum trimmed term length before `search` is called. Defaults to 1. */
  minLength?: number;
  /** Debounce in milliseconds before searching. Defaults to 300. */
  debounceMs?: number;
}
