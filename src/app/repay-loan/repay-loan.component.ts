/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

/** Custom Services */
import { AlertService } from 'app/core/alert/alert.service';
import { Dates } from 'app/core/utils/dates';
import { ClientsService } from 'app/clients/clients.service';
import { LoansService } from 'app/loans/loans.service';
import { LoanProductService } from 'app/products/loan-products/services/loan-product.service';
import { SearchService } from 'app/search/search.service';
import { SettingsService } from 'app/settings/settings.service';

/** Custom Models / Components */
import { Currency, PaymentType } from 'app/shared/models/general.model';
import { SearchData } from 'app/search/search.model';
import { InputAmountComponent } from 'app/shared/input-amount/input-amount.component';
import { FormatNumberPipe } from '@pipes/format-number.pipe';
import { StatusLookupPipe } from '@pipes/status-lookup.pipe';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import { RepayableLoan, SearchMode } from './repay-loan.model';

/**
 * Repay Loan shortcut.
 *
 * Collapses Clients -> client -> loan account -> Actions -> Make Repayment into a
 * single screen: find the loan, look it over, post the repayment, stay put for the
 * next customer.
 */
@Component({
  selector: 'mifosx-repay-loan',
  templateUrl: './repay-loan.component.html',
  styleUrls: ['./repay-loan.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatRadioGroup,
    MatRadioButton,
    MatSlideToggle,
    MatProgressSpinner,
    CdkTextareaAutosize,
    FaIconComponent,
    InputAmountComponent,
    FormatNumberPipe,
    StatusLookupPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RepayLoanComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private searchService = inject(SearchService);
  private clientsService = inject(ClientsService);
  private loansService = inject(LoansService);
  private loanProductService = inject(LoanProductService);
  private settingsService = inject(SettingsService);
  private dateUtils = inject(Dates);
  private alertService = inject(AlertService);
  private translateService = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  /** Permission Fineract requires to post a repayment. */
  readonly requiredPermission = 'REPAYMENT_LOAN';

  /** Search form: mode, query and the chosen loan. */
  searchForm: FormGroup | null = null;
  /** Repayment form. Rebuilt from scratch on every loan selection. */
  repaymentForm: FormGroup | null = null;

  /** Repayable loans matching the last search. */
  candidateLoans: RepayableLoan[] = [];
  /** The loan being repaid. */
  selectedLoan: RepayableLoan | null = null;
  /** GET /loans/{id} */
  loanDetails: any = null;
  /** GET /loans/{id}/transactions/template?command=repayment */
  repaymentTemplate: any = null;
  /** Payment Type Options */
  paymentTypes: PaymentType[] = [];
  currency: Currency | null = null;

  isSearching = false;
  isLoadingLoan = false;
  isSubmitting = false;
  /** A search has run at least once, so an empty result means "no matches". */
  searchPerformed = false;
  /** More clients matched than we are willing to expand. */
  tooManyClientMatches = false;
  /** Show payment details */
  showPaymentDetails = false;

  /** Minimum Date allowed. */
  minDate = new Date(2000, 0, 1);
  /** Maximum Date allowed. */
  maxDate = new Date();

  /** Clients whose accounts we fan out to in client mode. */
  private static readonly MAX_CLIENTS_TO_EXPAND = 5;
  /** Loan statuses that can accept a repayment. */
  private static readonly REPAYABLE_STATUS_CODES = [
    'loanStatusType.active',
    'loanStatusType.overpaid'
  ];

  constructor() {}

  ngOnInit(): void {
    this.maxDate = this.settingsService.businessDate;
    // Repair the shared singleton in case the teller arrived from a working capital loan.
    this.loanProductService.initialize('loan');
    this.buildSearchForm();
  }

  get searchMode(): SearchMode {
    return this.searchForm?.controls.searchMode.value;
  }

  /** Label for the single query field, which changes with the mode. */
  get queryLabelKey(): string {
    return this.searchMode === 'client' ? 'labels.inputs.Client Search' : 'labels.inputs.Loan Account Number';
  }

  get showLoanSelector(): boolean {
    return this.candidateLoans.length > 1;
  }

  get noResults(): boolean {
    return this.searchPerformed && !this.isSearching && this.candidateLoans.length === 0;
  }

  private buildSearchForm(): void {
    this.searchForm = this.formBuilder.group({
      searchMode: [
        'loanAccountNo' as SearchMode,
        Validators.required
      ],
      query: [
        '',
        Validators.required
      ],
      loanId: [null as number | null]
    });

    this.searchForm.controls.searchMode.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onSearchModeChange());
  }

  /** Switching mode abandons whatever the previous mode found. */
  onSearchModeChange(): void {
    this.searchForm?.controls.query.setValue('', { emitEvent: false });
    this.resetResults();
    this.cdr.markForCheck();
  }

  search(): void {
    const query: string = (this.searchForm?.controls.query.value ?? '').trim();
    if (query === '' || this.isSearching) {
      return;
    }
    this.isSearching = true;
    this.tooManyClientMatches = false;
    this.cdr.markForCheck();

    if (this.searchMode === 'client') {
      this.searchByClient(query);
    } else {
      this.searchByLoanAccountNo(query);
    }
  }

  private searchByLoanAccountNo(query: string): void {
    this.searchService
      .getSearchResults(query, 'loans')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (hits: SearchData[]) => {
          const loans = (hits ?? [])
            .filter((hit: SearchData) => hit.entityType === 'LOAN' && this.isRepayable(hit.entityStatus))
            .map((hit: SearchData) => this.mapSearchHitToCandidate(hit));
          this.applyCandidates(loans);
        },
        error: () => this.applyCandidates([])
      });
  }

  private searchByClient(query: string): void {
    this.searchService
      .getSearchResults(query, 'clients')
      .pipe(
        map((hits: SearchData[]) => (hits ?? []).filter((hit: SearchData) => hit.entityType === 'CLIENT')),
        switchMap((clients: SearchData[]) => {
          if (clients.length === 0) {
            return of([] as RepayableLoan[]);
          }
          this.tooManyClientMatches = clients.length > RepayLoanComponent.MAX_CLIENTS_TO_EXPAND;
          const expanded = clients.slice(0, RepayLoanComponent.MAX_CLIENTS_TO_EXPAND);
          return forkJoin(
            expanded.map((client: SearchData) =>
              this.clientsService.getClientAccountData(String(client.entityId)).pipe(
                map((accounts: any) => this.collectRepayableLoans(client, accounts)),
                // One unreachable client must not sink the whole search.
                catchError(() => of([] as RepayableLoan[]))
              )
            )
          ).pipe(map((perClient: RepayableLoan[][]) => perClient.flat()));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (loans: RepayableLoan[]) => this.applyCandidates(loans),
        error: () => this.applyCandidates([])
      });
  }

  private collectRepayableLoans(client: SearchData, accounts: any): RepayableLoan[] {
    const loanAccounts: any[] = accounts?.loanAccounts ?? [];
    return loanAccounts
      .filter((account: any) => this.isRepayable(account?.status))
      .map((account: any) => this.mapClientLoanToCandidate(client.entityId, client.entityName, account));
  }

  /**
   * `/clients/{id}/accounts` returns real status booleans; `/search` returns only
   * `{ id, code, value }`, so the code list is what carries the loan account path.
   */
  private isRepayable(status: { active?: boolean; overpaid?: boolean; code?: string }): boolean {
    if (status?.active === true || status?.overpaid === true) {
      return true;
    }
    return RepayLoanComponent.REPAYABLE_STATUS_CODES.includes(status?.code ?? '');
  }

  private mapSearchHitToCandidate(hit: SearchData): RepayableLoan {
    return {
      loanId: hit.entityId,
      accountNo: hit.entityAccountNo,
      productName: hit.entityName,
      clientId: hit.parentId ?? null,
      clientName: hit.parentName ?? '',
      statusCode: hit.entityStatus?.code ?? '',
      statusValue: hit.entityStatus?.value ?? ''
    };
  }

  private mapClientLoanToCandidate(clientId: number, clientName: string, account: any): RepayableLoan {
    return {
      loanId: account.id,
      accountNo: account.accountNo,
      productName: account.productName,
      clientId,
      clientName,
      statusCode: account.status?.code ?? '',
      statusValue: account.status?.value ?? ''
    };
  }

  /** One match goes straight through; several offer a dropdown; none is an empty state. */
  private applyCandidates(loans: RepayableLoan[]): void {
    this.candidateLoans = loans;
    this.isSearching = false;
    this.searchPerformed = true;
    this.selectedLoan = null;
    this.clearLoanContext();

    if (loans.length === 1) {
      this.selectLoan(loans[0]);
      return;
    }
    this.searchForm?.controls.loanId.setValue(null, { emitEvent: false });
    this.cdr.markForCheck();
  }

  onLoanSelectionChange(loanId: number): void {
    const loan = this.candidateLoans.find((candidate: RepayableLoan) => candidate.loanId === loanId);
    if (loan) {
      this.selectLoan(loan);
    }
  }

  private selectLoan(loan: RepayableLoan): void {
    this.selectedLoan = loan;
    this.searchForm?.controls.loanId.setValue(loan.loanId, { emitEvent: false });
    this.loadLoanContext(loan.loanId);
  }

  private loadLoanContext(loanId: number): void {
    this.isLoadingLoan = true;
    this.cdr.markForCheck();

    forkJoin({
      details: this.loansService.getLoanAccountDetails(String(loanId)),
      template: this.loansService.getLoanActionTemplate(String(loanId), 'repayment')
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: { details: any; template: any }) => {
          this.loanDetails = result.details;
          this.repaymentTemplate = result.template;
          this.currency = result.template?.currency ?? null;
          this.paymentTypes = result.template?.paymentTypeOptions ?? [];
          this.buildRepaymentForm();
          this.isLoadingLoan = false;
          this.cdr.markForCheck();
        },
        // The error interceptor already surfaces the failure; just stop the spinner.
        error: () => {
          this.isLoadingLoan = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Always builds a brand new FormGroup. `mifosx-input-amount` appends a fresh
   * validator closure on every init, so a reused control accumulates duplicates.
   */
  private buildRepaymentForm(): void {
    this.showPaymentDetails = false;
    this.repaymentForm = this.formBuilder.group({
      transactionDate: [
        this.settingsService.businessDate,
        Validators.required
      ],
      transactionAmount: [
        Number(this.repaymentTemplate?.amount) || 0,
        [
          Validators.required,
          Validators.min(0.001)
        ]
      ],
      externalId: [null],
      paymentTypeId: [null],
      note: ['']
    });
  }

  /**
   * Add payment detail fields to the UI.
   */
  addPaymentDetails(): void {
    this.showPaymentDetails = !this.showPaymentDetails;
    if (!this.repaymentForm) {
      return;
    }
    if (this.showPaymentDetails) {
      this.repaymentForm.addControl('accountNumber', new FormControl(''));
      this.repaymentForm.addControl('checkNumber', new FormControl(''));
      this.repaymentForm.addControl('routingCode', new FormControl(''));
      this.repaymentForm.addControl('receiptNumber', new FormControl(''));
      this.repaymentForm.addControl('bankNumber', new FormControl(''));
    } else {
      this.repaymentForm.removeControl('accountNumber');
      this.repaymentForm.removeControl('checkNumber');
      this.repaymentForm.removeControl('routingCode');
      this.repaymentForm.removeControl('receiptNumber');
      this.repaymentForm.removeControl('bankNumber');
    }
  }

  /** Submits the repayment form */
  submit(): void {
    if (!this.repaymentForm || this.repaymentForm.invalid || this.isSubmitting || !this.selectedLoan) {
      return;
    }
    this.isSubmitting = true;
    this.cdr.markForCheck();

    this.loansService
      .submitLoanActionButton(String(this.selectedLoan.loanId), this.buildPayload(), 'repayment')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => this.handleSubmitSuccess(response),
        // The error interceptor already snackbars the server message.
        error: () => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }
      });
  }

  private buildPayload(): any {
    const formValue: any = { ...this.repaymentForm?.value };
    const locale = this.settingsService.language.code;
    const dateFormat = this.settingsService.dateFormat;
    if (formValue.transactionDate instanceof Date) {
      formValue.transactionDate = this.dateUtils.formatDate(formValue.transactionDate, dateFormat);
    }
    const payload: any = {
      ...formValue,
      dateFormat,
      locale
    };
    payload['transactionAmount'] = payload['transactionAmount'] * 1;
    return payload;
  }

  private handleSubmitSuccess(response: any): void {
    this.isSubmitting = false;
    this.alertService.alert({
      type: 'Success',
      message: this.translateService.instant('labels.messages.repaymentPostedSuccessfully', {
        accountNo: this.selectedLoan?.accountNo ?? '',
        transactionId: response?.resourceId ?? ''
      })
    });
    // Stay on the screen: refresh the loan and hand back an empty form.
    this.repaymentForm = null;
    if (this.selectedLoan) {
      this.loadLoanContext(this.selectedLoan.loanId);
    }
  }

  /** "Change Loan" — back to the result list without re-running the search. */
  clearSelection(): void {
    this.selectedLoan = null;
    this.searchForm?.controls.loanId.setValue(null, { emitEvent: false });
    this.clearLoanContext();
    this.cdr.markForCheck();
  }

  private resetResults(): void {
    this.candidateLoans = [];
    this.selectedLoan = null;
    this.searchPerformed = false;
    this.tooManyClientMatches = false;
    this.searchForm?.controls.loanId.setValue(null, { emitEvent: false });
    this.clearLoanContext();
  }

  private clearLoanContext(): void {
    this.repaymentForm = null;
    this.loanDetails = null;
    this.repaymentTemplate = null;
    this.paymentTypes = [];
    this.currency = null;
    this.showPaymentDetails = false;
  }
}
