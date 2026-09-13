/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PasswordPolicyRules } from '../services/password-policy.service';

/**
 * Validates a password against the rules of the active Fineract password
 * validation policy.
 *
 * Error keys mirror the Angular built in ones (`minlength`, `maxlength`,
 * `pattern`) so that templates can report them the usual way.
 * @param {() => PasswordPolicyRules} getRules Rules of the active policy, read on every validation.
 * @param {(control: AbstractControl) => void} onValidate Notified before validating, to load the policy.
 * @returns {ValidatorFn} Password validator.
 */
export function passwordValidator(
  getRules: () => PasswordPolicyRules,
  onValidate?: (control: AbstractControl) => void
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    onValidate?.(control);
    const value = control.value;
    if (!value) return null; // No validation if the field is empty

    const rules = getRules();
    const errors: ValidationErrors = {};

    if (value.length < rules.minLength) {
      errors['minlength'] = { requiredLength: rules.minLength, actualLength: value.length };
    }
    if (value.length > rules.maxLength) {
      errors['maxlength'] = { requiredLength: rules.maxLength, actualLength: value.length };
    }
    if (rules.requireUppercase && !/[A-Z]/.test(value)) {
      errors['uppercase'] = true;
    }
    if (rules.requireLowercase && !/[a-z]/.test(value)) {
      errors['lowercase'] = true;
    }
    if (rules.requireDigit && !/\d/.test(value)) {
      errors['number'] = true;
    }
    // Consecutive repeating characters (e.g., aa, 11, @@)
    if (rules.disallowRepeatedCharacters && /(.)\1/.test(value)) {
      errors['repeated'] = true;
    }
    // Any special character (non-alphanumeric, non-space)
    if (rules.requireSpecialCharacter && !/[^\w\s]/.test(value)) {
      errors['specialChar'] = true;
    }
    if (rules.disallowSpaces && /\s/.test(value)) {
      errors['spaces'] = true;
    }
    // The policy regex, when the server exposes one, is the authority.
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      errors['pattern'] = { requiredPattern: rules.pattern, actualValue: value };
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}
