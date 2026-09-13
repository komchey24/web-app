/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { Injectable, inject, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/** rxjs Imports */
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

/** Translation Imports */
import { TranslateService } from '@ngx-translate/core';

/** Custom Services */
import { HttpService } from '../http/http.service';

/** Environment Configuration */
import { environment } from '../../../environments/environment';

/**
 * Client side representation of a Fineract password validation policy.
 *
 * Fineract stores one regex per policy (`m_password_validation_policy`) and only the
 * active policy is enforced on the server. The API exposes the human readable
 * description of every policy, and — depending on the Fineract version — the regex
 * itself, so the rules below are resolved from whatever the active policy provides.
 */
export interface PasswordPolicyRules {
  /** Minimum number of characters accepted by the active policy. */
  minLength: number;
  /** Maximum number of characters accepted by the active policy. */
  maxLength: number;
  /** Whether at least one upper case letter is required. */
  requireUppercase: boolean;
  /** Whether at least one lower case letter is required. */
  requireLowercase: boolean;
  /** Whether at least one numeric digit is required. */
  requireDigit: boolean;
  /** Whether at least one special (non alphanumeric) character is required. */
  requireSpecialCharacter: boolean;
  /** Whether whitespace is rejected. */
  disallowSpaces: boolean;
  /** Whether consecutive repeating characters are rejected. */
  disallowRepeatedCharacters: boolean;
  /** Regex enforced by the server, when the active policy exposes one. */
  pattern?: string;
  /** Description of the active policy, as authored by the server. */
  description?: string;
}

/** Password validation policy as returned by `/passwordpreferences/template`. */
interface PasswordValidationPolicy {
  id: number;
  description?: string;
  active?: boolean;
  key?: string;
  /** Fineract exposes the regex under one of these names, or not at all. */
  validationRegex?: string;
  regex?: string;
  validation_regex?: string;
}

/** Longest password Fineract accepts, whichever policy is active. */
const MAX_PASSWORD_LENGTH = 50;

/**
 * Resolves the password rules the Fineract instance actually enforces, so that
 * client side validation matches the active password preference instead of
 * rejecting passwords the server would accept.
 */
@Injectable({
  providedIn: 'root'
})
export class PasswordPolicyService {
  private http = inject(HttpService);
  private translateService = inject(TranslateService);

  /** Rules of the active policy, reactive so that `OnPush` templates pick up the loaded policy. */
  readonly rules = signal<PasswordPolicyRules>(configuredRules());

  /** In flight/cached request for the password preferences. */
  private policyRequest: Observable<PasswordPolicyRules> | null = null;
  /** Controls waiting for the active policy to be resolved. */
  private pendingControls = new Set<AbstractControl>();
  /** Whether the active policy has been resolved (successfully or not). */
  private resolved = false;

  /**
   * Loads the active policy once and revalidates the given control when it arrives.
   *
   * Called from the password validator, so a form created before the policy is
   * known is revalidated against the real rules as soon as they are available.
   * @param {AbstractControl} control Control being validated.
   */
  ensureLoaded(control?: AbstractControl): void {
    if (!this.resolved && control) {
      this.pendingControls.add(control);
    }
    this.load().subscribe();
  }

  /**
   * Loads the active password validation policy, caching the result.
   * @returns {Observable<PasswordPolicyRules>} Rules of the active policy.
   */
  load(): Observable<PasswordPolicyRules> {
    if (!this.policyRequest) {
      this.policyRequest = this.http
        .skipErrorHandler()
        .get('/passwordpreferences/template')
        .pipe(
          map((policies: PasswordValidationPolicy[]) => resolveRules(activePolicy(policies))),
          catchError(() => of(configuredRules())),
          tap((rules: PasswordPolicyRules) => this.applyRules(rules)),
          shareReplay(1)
        );
    }
    return this.policyRequest;
  }

  /**
   * Drops the cached policy, so the next form picks up a changed password preference.
   */
  refresh(): void {
    this.policyRequest = null;
    this.resolved = false;
    this.load().subscribe();
  }

  /**
   * Message describing the active policy, ready to be displayed.
   *
   * Prefers the translation of the server authored description and falls back to
   * the description itself, then to the generic password validation message.
   * @returns {string} Description of the active policy.
   */
  describe(): string {
    const description = this.rules().description;
    if (description) {
      const key = `labels.passwordPreferences.${description}`;
      const translated = this.translateService.instant(key);
      return translated === key ? description : translated;
    }
    return this.translateService.instant('labels.commons.Password validation', {
      minchar: this.rules().minLength
    });
  }

  /** Publishes the resolved rules and revalidates the controls waiting for them. */
  private applyRules(rules: PasswordPolicyRules): void {
    this.resolved = true;
    this.rules.set(rules);
    const controls = Array.from(this.pendingControls);
    this.pendingControls.clear();
    controls.forEach((control: AbstractControl) => control.updateValueAndValidity({ emitEvent: false }));
  }
}

/** Returns the policy Fineract is currently enforcing. */
function activePolicy(policies: PasswordValidationPolicy[]): PasswordValidationPolicy | null {
  if (!Array.isArray(policies)) {
    return null;
  }
  return policies.find((policy: PasswordValidationPolicy) => policy.active) || null;
}

/**
 * Rules of the deployment configured regex, used when the active policy cannot be
 * resolved from the server.
 */
function configuredRules(): PasswordPolicyRules {
  if (environment.passwordRegex) {
    return { ...rulesFromPattern(environment.passwordRegex) };
  }
  return {
    minLength: environment.minPasswordLength,
    maxLength: MAX_PASSWORD_LENGTH,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSpecialCharacter: true,
    disallowSpaces: true,
    disallowRepeatedCharacters: true
  };
}

/**
 * Resolves the rules of a password validation policy.
 *
 * A deployment configured regex wins, then the regex exposed by the policy, then
 * the requirements stated by the policy description.
 */
function resolveRules(policy: PasswordValidationPolicy | null): PasswordPolicyRules {
  if (environment.passwordRegex) {
    return { ...configuredRules(), description: policy?.description };
  }
  if (!policy) {
    return configuredRules();
  }
  const pattern = policy.validationRegex || policy.regex || policy.validation_regex;
  if (pattern) {
    return { ...rulesFromPattern(pattern), description: policy.description };
  }
  return rulesFromDescription(policy.description) || configuredRules();
}

/** Builds rules that delegate to a regex, keeping the length bounds it declares. */
function rulesFromPattern(pattern: string): PasswordPolicyRules {
  const bounds = /\{(\d+),(\d+)\}/.exec(pattern);
  return {
    minLength: bounds ? Number(bounds[1]) : 1,
    maxLength: bounds ? Number(bounds[2]) : MAX_PASSWORD_LENGTH,
    requireUppercase: false,
    requireLowercase: false,
    requireDigit: false,
    requireSpecialCharacter: false,
    disallowSpaces: false,
    disallowRepeatedCharacters: false,
    pattern
  };
}

/**
 * Derives the rules from a policy description, which is how Fineract states the
 * requirements of the policies it ships with, e.g. "Password must be at least 6
 * characters, no more than 50 characters long, must include at least one upper
 * case letter, one lower case letter, one numeric digit and no space".
 * @returns {PasswordPolicyRules} Rules, or `null` when no length could be read.
 */
function rulesFromDescription(description?: string): PasswordPolicyRules | null {
  if (!description) {
    return null;
  }
  const range = /(\d+)\s*(?:to|-)\s*(\d+)\s*characters/i.exec(description);
  const minimum = /at least\s*(\d+)\s*character/i.exec(description);
  const maximum = /(?:not more than|no more than|maximum of|more that)\s*(\d+)\s*characters/i.exec(description);
  if (!range && !minimum) {
    return null;
  }
  return {
    minLength: range ? Number(range[1]) : Number(minimum[1]),
    maxLength: range ? Number(range[2]) : maximum ? Number(maximum[1]) : MAX_PASSWORD_LENGTH,
    requireUppercase: /upper\s?case/i.test(description),
    requireLowercase: /lower\s?case/i.test(description),
    requireDigit: /numeric|digit|number/i.test(description),
    requireSpecialCharacter: /special character/i.test(description),
    disallowSpaces: /no\s+spaces?|without\s+spaces?|not\s+(?:include|contain)\s+spaces?/i.test(description),
    disallowRepeatedCharacters: /repeat/i.test(description),
    description
  };
}
