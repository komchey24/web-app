/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

/** Custom Services */
import { SystemService } from 'app/system/system.service';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

/** Prefix type that requires a user supplied prefix string, see AccountNumberPrefixType.PREFIX_SHORT_NAME. */
const PREFIX_SHORT_NAME_CODE = 'accountNumberPrefixType.prefixShortName';

/** Maximum length of the prefix character column. */
const PREFIX_CHARACTER_MAX_LENGTH = 50;

/**
 * Edit Account Number Preference Component.
 */
@Component({
  selector: 'mifosx-edit-account-number-preference',
  templateUrl: './edit-account-number-preference.component.html',
  styleUrls: ['./edit-account-number-preference.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditAccountNumberPreferenceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private formBuilder = inject(UntypedFormBuilder);
  private systemService = inject(SystemService);
  private router = inject(Router);

  /** Account Number Preference Form */
  accountNumberPreferenceForm: UntypedFormGroup;
  /** Account Number Preference Data */
  accountNumberPreferenceData: any;
  /** Account Number Preferences Template Data */
  accountNumberPreferencesTemplateData: any;
  /** Prefix Type Data */
  prefixTypeData: any[];
  /** True when the selected prefix type expects a user supplied prefix character. */
  isPrefixCharacterRequired = false;
  /** Maximum length of the prefix character. */
  prefixCharacterMaxLength = PREFIX_CHARACTER_MAX_LENGTH;

  /**
   * Retrieves the account number preference and account number preferences template data from `resolve`.
   * @param {FormBuilder} formBuilder Form Builder.
   * @param {SystemService} systemService Accounting Service.
   * @param {ActivatedRoute} route Activated Route.
   * @param {Router} router Router for navigation.
   */
  constructor() {
    this.route.data.subscribe((data: { accountNumberPreference: any; accountNumberPreferencesTemplate: any }) => {
      this.accountNumberPreferenceData = data.accountNumberPreference;
      this.accountNumberPreferencesTemplateData = data.accountNumberPreferencesTemplate;
    });
  }

  /**
   * Sets Prefix type data.
   * Creates and sets account number preference form.
   */
  ngOnInit() {
    this.prefixTypeData =
      this.accountNumberPreferencesTemplateData.prefixTypeOptions[this.accountNumberPreferenceData.accountType.code];
    this.createAccountNumberPreferenceForm();
    this.togglePrefixCharacter(this.accountNumberPreferenceForm.get('prefixType').value);
    this.accountNumberPreferenceForm.get('prefixType').valueChanges.subscribe((prefixTypeId) => {
      this.togglePrefixCharacter(prefixTypeId);
    });
  }

  /**
   * A prefix character is only accepted, and is mandatory, when the prefix type is a
   * user supplied short name. This mirrors the server side validation.
   * @param {any} prefixTypeId Selected prefix type identifier.
   */
  togglePrefixCharacter(prefixTypeId: any) {
    const prefixCharacter = this.accountNumberPreferenceForm.get('prefixCharacter');
    this.isPrefixCharacterRequired = (this.prefixTypeData || []).some(
      (prefixType: any) => prefixType.id === prefixTypeId && prefixType.code === PREFIX_SHORT_NAME_CODE
    );
    if (this.isPrefixCharacterRequired) {
      prefixCharacter.setValidators([
        Validators.required,
        Validators.maxLength(PREFIX_CHARACTER_MAX_LENGTH)
      ]);
    } else {
      prefixCharacter.clearValidators();
      prefixCharacter.setValue('', { emitEvent: false });
    }
    prefixCharacter.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Creates and sets the edit account number preference form.
   */
  createAccountNumberPreferenceForm() {
    this.accountNumberPreferenceForm = this.formBuilder.group({
      accountType: [
        { value: this.accountNumberPreferenceData.accountType.id, disabled: true },
        Validators.required
      ],
      prefixType: [this.accountNumberPreferenceData.prefixType ? this.accountNumberPreferenceData.prefixType.id : 0],
      prefixCharacter: [this.accountNumberPreferenceData.prefixCharacter || '']
    });
  }

  /**
   * Submits the account number preference form and updates the account number preference,
   * if successful redirects to view account number preference.
   */
  submit() {
    const accountNumberPreferenceValue = this.accountNumberPreferenceForm.value;
    if (accountNumberPreferenceValue.prefixType === '') {
      accountNumberPreferenceValue.prefixType = undefined;
    }
    if (!this.isPrefixCharacterRequired) {
      /** Send an empty prefix character only to clear a previously stored one. */
      accountNumberPreferenceValue.prefixCharacter = this.accountNumberPreferenceData.prefixCharacter ? '' : undefined;
    }
    this.systemService
      .updateAccountNumberPreference(this.accountNumberPreferenceData.id, accountNumberPreferenceValue)
      .subscribe((response: any) => {
        this.router.navigate(['../'], { relativeTo: this.route });
      });
  }
}
