/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { of } from 'rxjs';

import { FormfieldComponent } from './formfield.component';
import { InputBase } from './model/input-base';

describe('FormfieldComponent autocomplete', () => {
  let fixture: ComponentFixture<FormfieldComponent>;
  let component: FormfieldComponent;
  let search: jest.Mock<(term: string) => any>;
  let onSelect: jest.Mock<(option: any, form: UntypedFormGroup) => void>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FormfieldComponent,
        TranslateModule.forRoot()
      ],
      providers: [provideNoopAnimations()]
    }).compileComponents();

    search = jest.fn((term: string) => of([{ name: `${term}-result` }]));
    onSelect = jest.fn();

    fixture = TestBed.createComponent(FormfieldComponent);
    component = fixture.componentInstance;
    component.form = new UntypedFormGroup({ village: new UntypedFormControl('') });
    component.formfield = new InputBase({
      controlName: 'village',
      label: 'Village',
      autocomplete: {
        search,
        minLength: 2,
        displayWith: (option: any) => option.name,
        optionValue: (option: any) => option.name,
        onSelect
      }
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('searches only after the debounce once the minimum length is reached', () => {
    jest.useFakeTimers();
    const results: any[][] = [];
    const sub = component.autocompleteOptions$.subscribe((options) => results.push(options));

    component.form.get('village')?.setValue('a');
    jest.advanceTimersByTime(300);
    component.form.get('village')?.setValue(' ab ');
    jest.advanceTimersByTime(299);
    expect(search).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(search).toHaveBeenCalledWith('ab');
    expect(search).not.toHaveBeenCalledWith('a');
    expect(results).toEqual([
      [],
      [{ name: 'ab-result' }]
    ]);
    sub.unsubscribe();
  });

  it('passes the selected option and form to onSelect', () => {
    const option = { name: 'x' };

    component.onAutocompleteSelected(option);

    expect(onSelect).toHaveBeenCalledWith(option, component.form);
  });

  it('renders the autocomplete trigger on the input', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');

    expect(input.getAttribute('aria-autocomplete')).toBe('list');
  });

  it('keeps searching after the search function throws synchronously', () => {
    jest.useFakeTimers();
    const results: any[][] = [];
    search.mockImplementation((term: string) => {
      if (term === 'ab') {
        throw new TypeError('boom');
      }
      return of([{ name: `${term}-result` }]);
    });
    const sub = component.autocompleteOptions$.subscribe((options) => results.push(options));

    component.form.get('village')?.setValue('ab');
    jest.advanceTimersByTime(300);
    component.form.get('village')?.setValue('abc');
    jest.advanceTimersByTime(300);

    expect(results).toContainEqual([]);
    expect(results).toContainEqual([{ name: 'abc-result' }]);
    sub.unsubscribe();
  });
});
