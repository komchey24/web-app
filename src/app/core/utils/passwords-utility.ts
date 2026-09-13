/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { inject, Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { passwordValidator } from './password.validator';
import { PasswordPolicyRules, PasswordPolicyService } from '../services/password-policy.service';

@Injectable({
  providedIn: 'root'
})
export class PasswordsUtility {
  private passwordPolicyService = inject(PasswordPolicyService);

  /** Rules enforced by the active password validation policy. */
  public get rules(): PasswordPolicyRules {
    return this.passwordPolicyService.rules();
  }

  /** Shortest password the active password validation policy accepts. */
  public get minPasswordLength(): number {
    return this.rules.minLength;
  }

  /**
   * Description of the active password validation policy, ready to be displayed.
   * @returns {string} Requirements of the active policy.
   */
  public getPasswordPolicyDescription(): string {
    return this.passwordPolicyService.describe();
  }

  /**
   * Validators enforcing the active password validation policy.
   *
   * The policy is fetched from the server the first time a password is validated;
   * until it arrives the deployment configured rules apply and the control is
   * revalidated once the real policy is known.
   * @returns {ValidatorFn[]} Password validators.
   */
  public getPasswordValidators(): ValidatorFn[] {
    return [
      Validators.required,
      passwordValidator(
        () => this.rules,
        (control: AbstractControl) => this.passwordPolicyService.ensureLoaded(control)
      )
    ];
  }

  /**
   * Confirm Change Password of Users
   * @param controlNameToCompare Form Control Name to be compared.
   */
  public confirmPassword(controlNameToCompare: string): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
      if (c.value == null || c.value.length === 0) {
        return null;
      }
      const controlToCompare = c.root.get(controlNameToCompare);
      if (controlToCompare) {
        const subscription: Subscription = controlToCompare.valueChanges.subscribe(() => {
          c.updateValueAndValidity();
          subscription.unsubscribe();
        });
      }
      return controlToCompare && controlToCompare.value !== c.value ? { notequal: true } : null;
    };
  }
}
