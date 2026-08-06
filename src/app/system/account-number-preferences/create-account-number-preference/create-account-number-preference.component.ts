/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';

/** Custom Services */
import { SystemService } from '../../system.service';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

/** Prefix type that requires a user supplied prefix string, see AccountNumberPrefixType.PREFIX_SHORT_NAME. */
const PREFIX_SHORT_NAME_CODE = 'accountNumberPrefixType.prefixShortName';

/** Maximum length of the prefix character column. */
const PREFIX_CHARACTER_MAX_LENGTH = 50;

/**
 * Create Account Number Preference Component.
 */
@Component({
  selector: 'mifosx-create-account-number-preference',
  templateUrl: './create-account-number-preference.component.html',
  styleUrls: ['./create-account-number-preference.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateAccountNumberPreferenceComponent implements OnInit {
  private formBuilder = inject(UntypedFormBuilder);
  private systemService = inject(SystemService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /** Account Number Preferences Form */
  accountNumberPreferenceForm: UntypedFormGroup;
  /** Account Number Preferences Template Data */
  accountNumberPreferencesTemplateData: any;
  /** Prefix Type Data */
  prefixTypeData: any[];
  /** True when the selected prefix type expects a user supplied prefix character. */
  isPrefixCharacterRequired = false;
  /** Maximum length of the prefix character. */
  prefixCharacterMaxLength = PREFIX_CHARACTER_MAX_LENGTH;

  /**
   * Retrieves the account number preferences template data from `resolve`.
   * @param {FormBuilder} formBuilder Form Builder.
   * @param {SystemService} systemService Accounting Service.
   * @param {ActivatedRoute} route Activated Route.
   * @param {Router} router Router for navigation.
   */
  constructor() {
    this.route.data.subscribe((data: { accountNumberPreferencesTemplate: any }) => {
      this.accountNumberPreferencesTemplateData = data.accountNumberPreferencesTemplate;
    });
  }

  /**
   * Creates the account number preference form.
   * Subscribe on Form Controls to change Prefix Type data.
   */
  ngOnInit() {
    this.createAccountNumberPreferenceForm();
    this.getPrefixTypeValue();
  }

  /**
   * Subscribes on Form Controls to change Prefix Type data.
   */
  getPrefixTypeValue() {
    this.accountNumberPreferenceForm.get('accountType').valueChanges.subscribe((accountId) => {
      this.prefixTypeData =
        this.accountNumberPreferencesTemplateData.prefixTypeOptions[
          `accountType.${this.accountNumberPreferencesTemplateData.accountTypeOptions.find((accountType: any) => accountType.id === accountId).value.toLowerCase()}`
        ];
      /** The previously selected prefix type is not necessarily valid for the new account type. */
      this.accountNumberPreferenceForm.get('prefixType').setValue('');
    });

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
   * Creates the account number preference form.
   */
  createAccountNumberPreferenceForm() {
    this.accountNumberPreferenceForm = this.formBuilder.group({
      accountType: [
        '',
        Validators.required
      ],
      prefixType: [''],
      prefixCharacter: ['']
    });
  }

  /**
   * Submits the account number preference form and creates a account number preference,
   * if successful redirects to view created account number preference.
   */
  submit() {
    const accountNumberPreference = this.accountNumberPreferenceForm.value;
    if (accountNumberPreference.prefixType === '') {
      accountNumberPreference.prefixType = undefined;
    }
    if (!this.isPrefixCharacterRequired) {
      accountNumberPreference.prefixCharacter = undefined;
    }
    this.systemService.createAccountNumberPreference(accountNumberPreference).subscribe((response: any) => {
      this.router.navigate(
        [
          '../',
          response.resourceId
        ],
        { relativeTo: this.route }
      );
    });
  }
}
