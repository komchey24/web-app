/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TranslateModule } from '@ngx-translate/core';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { RepayLoanComponent } from './repay-loan.component';
import { AlertService } from 'app/core/alert/alert.service';
import { Dates } from 'app/core/utils/dates';
import { ClientsService } from 'app/clients/clients.service';
import { LoansService } from 'app/loans/loans.service';
import { LoanProductService } from 'app/products/loan-products/services/loan-product.service';
import { SearchService } from 'app/search/search.service';
import { SettingsService } from 'app/settings/settings.service';
import { AuthenticationService } from 'app/core/authentication/authentication.service';

const loanSearchHit = (code: string, value: string) => ({
  entityId: 1,
  entityAccountNo: '000000001',
  entityName: 'Personal Loan - Standard',
  entityType: 'LOAN',
  parentId: 7,
  parentName: 'Marcus Potcheu',
  entityStatus: { id: 300, code, value }
});

const clientSearchHit = () => ({
  entityId: 7,
  entityAccountNo: '000000007',
  entityName: 'Marcus Potcheu',
  entityType: 'CLIENT',
  parentId: 1,
  parentName: 'Head Office',
  entityStatus: { id: 300, code: 'clientStatusType.active', value: 'Active' }
});

const loanAccount = (id: number, status: Record<string, unknown>) => ({
  id,
  accountNo: `00000000${id}`,
  productName: 'My - Progressive Loan',
  status
});

const ACTIVE = { id: 300, code: 'loanStatusType.active', value: 'Active', active: true, overpaid: false };
const OVERPAID = { id: 700, code: 'loanStatusType.overpaid', value: 'Overpaid', active: false, overpaid: true };
const CLOSED = {
  id: 600,
  code: 'loanStatusType.closed.obligations.met',
  value: 'Closed (obligations met)',
  active: false,
  overpaid: false
};

describe('RepayLoanComponent', () => {
  let component: RepayLoanComponent;
  let fixture: ComponentFixture<RepayLoanComponent>;
  let searchService: any;
  let clientsService: any;
  let loansService: any;
  let alertService: any;
  let router: any;

  const template = { amount: 500, currency: { code: 'USD', decimalPlaces: 2 }, paymentTypeOptions: [{ id: 1 }] };
  const details = {
    id: 1,
    accountNo: '000000001',
    clientName: 'Marcus Potcheu',
    loanProductName: 'My - Progressive Loan',
    status: ACTIVE,
    summary: { principalOutstanding: 1000, totalOutstanding: 1200, totalOverdue: 0 }
  };

  const setup = async () => {
    searchService = { getSearchResults: jest.fn(() => of([])) };
    clientsService = {
      getClientAccountData: jest.fn(() => of({ loanAccounts: [], workingCapitalLoanAccounts: [] }))
    };
    loansService = {
      getLoanAccountDetails: jest.fn(() => of(details)),
      getLoanActionTemplate: jest.fn(() => of(template)),
      submitLoanActionButton: jest.fn(() => of({ resourceId: 99 }))
    };
    alertService = { alert: jest.fn() };
    router = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        RepayLoanComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        { provide: SearchService, useValue: searchService },
        { provide: ClientsService, useValue: clientsService },
        { provide: LoansService, useValue: loansService },
        { provide: AlertService, useValue: alertService },
        { provide: Router, useValue: router },
        { provide: LoanProductService, useValue: { initialize: jest.fn(), isLoanProduct: true } },
        {
          provide: SettingsService,
          useValue: { businessDate: new Date(2026, 0, 15), dateFormat: 'dd MMMM yyyy', language: { code: 'en' } }
        },
        { provide: Dates, useValue: { formatDate: jest.fn(() => '15 January 2026') } },
        { provide: AuthenticationService, useValue: { getCredentials: () => ({ permissions: ['ALL_FUNCTIONS'] }) } },
        provideNativeDateAdapter(),
        provideAnimationsAsync()
      ]
    }).compileComponents();

    TestBed.inject(FaIconLibrary).addIcons(faSearch);

    fixture = TestBed.createComponent(RepayLoanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const runSearch = (query: string, mode: 'loanAccountNo' | 'client' = 'loanAccountNo') => {
    component.searchForm.controls.searchMode.setValue(mode);
    component.searchForm.controls.query.setValue(query);
    component.search();
  };

  beforeEach(setup);

  it('starts in loan-account mode with nothing selected', () => {
    expect(component.searchMode).toBe('loanAccountNo');
    expect(component.searchForm.invalid).toBe(true);
    expect(component.repaymentForm).toBeNull();
    expect(component.candidateLoans).toEqual([]);
    expect(component.searchPerformed).toBe(false);
  });

  it('auto-selects the loan when the account number matches one active loan', () => {
    searchService.getSearchResults.mockReturnValue(of([loanSearchHit('loanStatusType.active', 'Active')]));

    runSearch('000000001');

    expect(searchService.getSearchResults).toHaveBeenCalledWith('000000001', 'loans');
    expect(component.selectedLoan?.loanId).toBe(1);
    expect(component.showLoanSelector).toBe(false);
    expect(loansService.getLoanAccountDetails).toHaveBeenCalledTimes(1);
    expect(loansService.getLoanActionTemplate).toHaveBeenCalledWith('1', 'repayment');
    expect(component.repaymentForm?.value.transactionAmount).toBe(500);
  });

  it('accepts an overpaid loan', () => {
    searchService.getSearchResults.mockReturnValue(of([loanSearchHit('loanStatusType.overpaid', 'Overpaid')]));

    runSearch('000000001');

    expect(component.selectedLoan?.loanId).toBe(1);
  });

  it('filters out a closed loan and shows the empty state', () => {
    searchService.getSearchResults.mockReturnValue(
      of([loanSearchHit('loanStatusType.closed.obligations.met', 'Closed (obligations met)')])
    );

    runSearch('000000001');

    expect(component.candidateLoans).toEqual([]);
    expect(component.noResults).toBe(true);
    expect(component.repaymentForm).toBeNull();
    expect(loansService.getLoanAccountDetails).not.toHaveBeenCalled();
  });

  it('offers a dropdown when a client has several repayable loans', () => {
    searchService.getSearchResults.mockReturnValue(of([clientSearchHit()]));
    clientsService.getClientAccountData.mockReturnValue(
      of({
        loanAccounts: [
          loanAccount(1, ACTIVE),
          loanAccount(2, OVERPAID),
          loanAccount(3, CLOSED)
        ]
      })
    );

    runSearch('Marcus', 'client');

    expect(searchService.getSearchResults).toHaveBeenCalledWith('Marcus', 'clients');
    expect(component.candidateLoans.length).toBe(2);
    expect(component.showLoanSelector).toBe(true);
    expect(component.selectedLoan).toBeNull();
    expect(component.repaymentForm).toBeNull();
  });

  it('auto-selects when a client has exactly one repayable loan', () => {
    searchService.getSearchResults.mockReturnValue(of([clientSearchHit()]));
    clientsService.getClientAccountData.mockReturnValue(
      of({ loanAccounts: [
          loanAccount(1, ACTIVE),
          loanAccount(3, CLOSED)
        ] })
    );

    runSearch('254757440276', 'client');

    expect(component.selectedLoan?.loanId).toBe(1);
    expect(component.selectedLoan?.clientName).toBe('Marcus Potcheu');
    expect(component.repaymentForm).not.toBeNull();
  });

  it('never offers working capital loan accounts', () => {
    searchService.getSearchResults.mockReturnValue(of([clientSearchHit()]));
    clientsService.getClientAccountData.mockReturnValue(
      of({ loanAccounts: [], workingCapitalLoanAccounts: [loanAccount(9, ACTIVE)] })
    );

    runSearch('Marcus', 'client');

    expect(component.candidateLoans).toEqual([]);
    expect(component.noResults).toBe(true);
  });

  it('clears results and the form when the search mode changes', () => {
    searchService.getSearchResults.mockReturnValue(of([loanSearchHit('loanStatusType.active', 'Active')]));
    runSearch('000000001');
    expect(component.selectedLoan).not.toBeNull();

    component.searchForm.controls.searchMode.setValue('client');

    expect(component.searchForm.controls.query.value).toBe('');
    expect(component.candidateLoans).toEqual([]);
    expect(component.selectedLoan).toBeNull();
    expect(component.repaymentForm).toBeNull();
    expect(component.searchPerformed).toBe(false);
  });

  it('adds and removes the five payment detail controls', () => {
    searchService.getSearchResults.mockReturnValue(of([loanSearchHit('loanStatusType.active', 'Active')]));
    runSearch('000000001');

    component.addPaymentDetails();
    expect(component.repaymentForm?.contains('accountNumber')).toBe(true);
    expect(component.repaymentForm?.contains('checkNumber')).toBe(true);
    expect(component.repaymentForm?.contains('routingCode')).toBe(true);
    expect(component.repaymentForm?.contains('receiptNumber')).toBe(true);
    expect(component.repaymentForm?.contains('bankNumber')).toBe(true);

    component.addPaymentDetails();
    expect(component.repaymentForm?.contains('accountNumber')).toBe(false);
    expect(component.repaymentForm?.contains('bankNumber')).toBe(false);
  });

  it('posts the Fineract repayment payload', () => {
    searchService.getSearchResults.mockReturnValue(of([loanSearchHit('loanStatusType.active', 'Active')]));
    runSearch('000000001');
    component.repaymentForm?.patchValue({ transactionAmount: 250, paymentTypeId: 1, note: 'counter' });

    component.submit();

    expect(loansService.submitLoanActionButton).toHaveBeenCalledTimes(1);
    const [
      loanId,
      payload,
      command
    ] = loansService.submitLoanActionButton.mock.calls[0];
    expect(loanId).toBe('1');
    expect(command).toBe('repayment');
    expect(payload).toEqual({
      transactionDate: '15 January 2026',
      transactionAmount: 250,
      externalId: null,
      paymentTypeId: 1,
      note: 'counter',
      dateFormat: 'dd MMMM yyyy',
      locale: 'en'
    });
    expect(payload.skipInterestRefund).toBeUndefined();
    expect(payload.classificationId).toBeUndefined();
  });

  it('stays on the screen and resets after a successful repayment', () => {
    searchService.getSearchResults.mockReturnValue(of([loanSearchHit('loanStatusType.active', 'Active')]));
    runSearch('000000001');
    component.addPaymentDetails();
    const formBeforeSubmit = component.repaymentForm;

    component.submit();

    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(loansService.getLoanAccountDetails).toHaveBeenCalledTimes(2);
    expect(loansService.getLoanActionTemplate).toHaveBeenCalledTimes(2);
    expect(component.repaymentForm).not.toBe(formBeforeSubmit);
    expect(component.repaymentForm?.value.transactionAmount).toBe(500);
    expect(component.isSubmitting).toBe(false);
    expect(component.showPaymentDetails).toBe(false);
    expect(component.selectedLoan?.loanId).toBe(1);
  });

  it('leaves the error interceptor to report a failed repayment', () => {
    searchService.getSearchResults.mockReturnValue(of([loanSearchHit('loanStatusType.active', 'Active')]));
    runSearch('000000001');
    loansService.submitLoanActionButton.mockReturnValue(throwError(() => new Error('400')));

    component.submit();

    expect(component.isSubmitting).toBe(false);
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(component.selectedLoan?.loanId).toBe(1);
    expect(component.repaymentForm).not.toBeNull();
  });

  it('ignores a submit while one is in flight or the form is invalid', () => {
    searchService.getSearchResults.mockReturnValue(of([loanSearchHit('loanStatusType.active', 'Active')]));
    runSearch('000000001');

    component.isSubmitting = true;
    component.submit();
    expect(loansService.submitLoanActionButton).not.toHaveBeenCalled();

    component.isSubmitting = false;
    component.repaymentForm?.controls.transactionAmount.setValue(0);
    component.submit();
    expect(loansService.submitLoanActionButton).not.toHaveBeenCalled();
  });
});
