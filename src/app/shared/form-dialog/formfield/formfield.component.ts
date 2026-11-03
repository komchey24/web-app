/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, defer, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';

import { FormfieldBase } from './model/formfield-base';
import { MatCheckbox } from '@angular/material/checkbox';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

@Component({
  selector: 'mifosx-formfield',
  templateUrl: './formfield.component.html',
  styleUrls: ['./formfield.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatCheckbox,
    MatAutocomplete,
    MatAutocompleteTrigger
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormfieldComponent implements OnInit {
  @Input() form: UntypedFormGroup;
  @Input() formfield: FormfieldBase;

  /** Autocomplete suggestions for the field, when the field has autocomplete configured. */
  autocompleteOptions$: Observable<any[]> = of([]);

  ngOnInit() {
    const autocomplete = this.formfield?.autocomplete;
    const control = this.form?.get(this.formfield?.controlName);
    if (!autocomplete || !control) {
      return;
    }
    const minLength = autocomplete.minLength ?? 1;
    this.autocompleteOptions$ = control.valueChanges.pipe(
      debounceTime(autocomplete.debounceMs ?? 300),
      map((value: unknown) => (typeof value === 'string' ? value.trim() : '')),
      distinctUntilChanged(),
      switchMap((term: string) =>
        term.length >= minLength ? defer(() => autocomplete.search(term)).pipe(catchError(() => of([]))) : of([])
      ),
      map((options) => options ?? [])
    );
  }

  /** Notifies the field's autocomplete config that a suggestion was picked. */
  onAutocompleteSelected(option: any) {
    this.formfield.autocomplete?.onSelect?.(option, this.form);
  }
}
