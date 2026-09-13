import { FormControl } from '@angular/forms';

import { describe, it, expect } from '@jest/globals';

import { passwordValidator } from './password.validator';
import { PasswordPolicyRules } from '../services/password-policy.service';

/** Rules of the Fineract "basic" policy: any password of 1 to 50 characters. */
const basicRules: PasswordPolicyRules = {
  minLength: 1,
  maxLength: 50,
  requireUppercase: false,
  requireLowercase: false,
  requireDigit: false,
  requireSpecialCharacter: false,
  disallowSpaces: false,
  disallowRepeatedCharacters: false
};

/** Rules of the Fineract "standard" policy. */
const standardRules: PasswordPolicyRules = {
  ...basicRules,
  minLength: 6,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  disallowSpaces: true
};

/** Rules of a strong policy requiring a special character and no repeats. */
const strongRules: PasswordPolicyRules = {
  ...standardRules,
  minLength: 12,
  requireSpecialCharacter: true,
  disallowRepeatedCharacters: true
};

/** Validates a value against the given rules. */
function validate(value: string, rules: PasswordPolicyRules) {
  return passwordValidator(() => rules)(new FormControl(value));
}

describe('passwordValidator', () => {
  it('accepts any password allowed by the basic policy', () => {
    expect(validate('abc', basicRules)).toBeNull();
    expect(validate('a a', basicRules)).toBeNull();
    expect(validate('aabb', basicRules)).toBeNull();
  });

  it('leaves an empty value to the required validator', () => {
    expect(validate('', strongRules)).toBeNull();
  });

  it('reports the length with the Angular error keys', () => {
    expect(validate('Abc1', standardRules)).toEqual({
      minlength: { requiredLength: 6, actualLength: 4 }
    });
    expect(validate('a'.repeat(51), basicRules)).toEqual({
      maxlength: { requiredLength: 50, actualLength: 51 }
    });
  });

  it('reports only the character classes the policy requires', () => {
    expect(validate('abcdefgh', standardRules)).toEqual({ uppercase: true, number: true });
    expect(validate('Abcdefg1', standardRules)).toBeNull();
  });

  it('accepts a password meeting the standard policy even with repeats and no special character', () => {
    expect(validate('Aabbcc11', standardRules)).toBeNull();
  });

  it('rejects spaces only when the policy disallows them', () => {
    expect(validate('Abcdef 1', standardRules)).toEqual({ spaces: true });
    expect(validate('Abcdef 1', basicRules)).toBeNull();
  });

  it('enforces the special character and repeat rules of a strong policy', () => {
    expect(validate('Abcdefghijk1', strongRules)).toEqual({ specialChar: true });
    expect(validate('Abbcdefghij1!', strongRules)).toEqual({ repeated: true });
    expect(validate('Abcdefghij1!', strongRules)).toBeNull();
  });

  it('enforces the policy regex when the server exposes one', () => {
    const rules: PasswordPolicyRules = { ...basicRules, minLength: 4, maxLength: 20, pattern: '^[a-z]{4,20}$' };

    expect(validate('abcd', rules)).toBeNull();
    expect(validate('abcD', rules)).toEqual({
      pattern: { requiredPattern: '^[a-z]{4,20}$', actualValue: 'abcD' }
    });
  });

  it('reads the rules on every validation', () => {
    let rules = strongRules;
    const control = new FormControl('abcdef', [passwordValidator(() => rules)]);

    expect(control.valid).toBe(false);

    rules = basicRules;
    control.updateValueAndValidity();

    expect(control.valid).toBe(true);
  });
});
