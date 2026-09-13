import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { HttpService } from '../http/http.service';
import { PasswordPolicyService } from './password-policy.service';
import { passwordValidator } from '../utils/password.validator';

/** Descriptions of the password validation policies Fineract ships with. */
const BASIC = 'Password must be at least 1 character and not more than 50 characters long';
const STANDARD =
  'Password must be at least 6 characters, no more than 50 characters long, must include at least one upper case letter, one lower case letter, one numeric digit and no space';
const STRONG =
  'Password must be 12 to 50 characters long, containing at least one uppercase letter, one lowercase letter, one numeric digit, and one special character, with no spaces or consecutive repeating characters';

describe('PasswordPolicyService', () => {
  let get: jest.Mock<(url: string) => Observable<any>>;

  /** Builds the service with a password preferences response. */
  function setup(response: Observable<any>): PasswordPolicyService {
    get = jest.fn(() => response) as any;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PasswordPolicyService,
        { provide: HttpService, useValue: { skipErrorHandler: () => ({ get }) } },
        { provide: TranslateService, useValue: { instant: jest.fn((key: string) => key) } }
      ]
    });
    return TestBed.inject(PasswordPolicyService);
  }

  /** Policies as returned by `/passwordpreferences/template`. */
  function policies(activeDescription: string, extra: any = {}): any[] {
    return [
      { id: 1, description: BASIC, active: activeDescription === BASIC },
      { id: 2, description: STANDARD, active: activeDescription === STANDARD },
      { id: 3, description: STRONG, active: activeDescription === STRONG, ...extra }
    ].map((policy: any) => (policy.description === activeDescription ? { ...policy, ...extra } : policy));
  }

  beforeEach(() => {
    get = jest.fn() as any;
  });

  it('derives the rules of the active basic policy', () => {
    const service = setup(of(policies(BASIC)));
    service.load().subscribe();

    expect(service.rules()).toEqual(
      expect.objectContaining({
        minLength: 1,
        maxLength: 50,
        requireUppercase: false,
        requireLowercase: false,
        requireDigit: false,
        requireSpecialCharacter: false,
        disallowSpaces: false,
        disallowRepeatedCharacters: false,
        description: BASIC
      })
    );
  });

  it('derives the rules of the active standard policy', () => {
    const service = setup(of(policies(STANDARD)));
    service.load().subscribe();

    expect(service.rules()).toEqual(
      expect.objectContaining({
        minLength: 6,
        maxLength: 50,
        requireUppercase: true,
        requireLowercase: true,
        requireDigit: true,
        requireSpecialCharacter: false,
        disallowSpaces: true,
        disallowRepeatedCharacters: false
      })
    );
  });

  it('derives the rules of the active strong policy', () => {
    const service = setup(of(policies(STRONG)));
    service.load().subscribe();

    expect(service.rules()).toEqual(
      expect.objectContaining({
        minLength: 12,
        maxLength: 50,
        requireUppercase: true,
        requireLowercase: true,
        requireDigit: true,
        requireSpecialCharacter: true,
        disallowSpaces: true,
        disallowRepeatedCharacters: true
      })
    );
  });

  it('prefers the regex exposed by the active policy', () => {
    const service = setup(of(policies(BASIC, { validationRegex: '^.{4,20}$' })));
    service.load().subscribe();

    expect(service.rules()).toEqual(expect.objectContaining({ pattern: '^.{4,20}$', minLength: 4, maxLength: 20 }));
  });

  it('falls back to the default rules when the policy cannot be read', () => {
    const service = setup(throwError(() => new Error('403')));
    service.load().subscribe();

    expect(service.rules()).toEqual(
      expect.objectContaining({ requireUppercase: true, requireSpecialCharacter: true, maxLength: 50 })
    );
  });

  it('requests the password preferences only once', () => {
    const service = setup(of(policies(BASIC)));
    service.load().subscribe();
    service.load().subscribe();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('requests the password preferences again after a refresh', () => {
    const service = setup(of(policies(BASIC)));
    service.load().subscribe();
    service.refresh();

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('revalidates a control once the active policy is known', () => {
    let emit: (policies: any[]) => void;
    const service = setup(
      new Observable<any>((subscriber) => {
        emit = (value: any[]) => subscriber.next(value);
      })
    );
    const control = new FormControl('short', [
      passwordValidator(
        () => service.rules(),
        (c) => service.ensureLoaded(c)
      )
    ]);

    expect(control.hasError('minlength')).toBe(true);

    emit(policies(BASIC));

    expect(control.valid).toBe(true);
  });

  it('describes the active policy with its translated description', () => {
    get = jest.fn(() => of(policies(STANDARD))) as any;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PasswordPolicyService,
        { provide: HttpService, useValue: { skipErrorHandler: () => ({ get }) } },
        { provide: TranslateService, useValue: { instant: jest.fn(() => 'Mot de passe...') } }
      ]
    });
    const service = TestBed.inject(PasswordPolicyService);
    service.load().subscribe();

    expect(service.describe()).toBe('Mot de passe...');
  });

  it('describes the active policy with its raw description when untranslated', () => {
    const service = setup(of(policies(STANDARD)));
    service.load().subscribe();

    expect(service.describe()).toBe(STANDARD);
  });
});
