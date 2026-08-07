/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports. */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';

/** Custom Services. */
import { Currency } from 'app/shared/models/general.model';
import { InputAmountComponent } from '../../../../shared/input-amount/input-amount.component';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import { LoanAccountActionsBaseComponent } from '../loan-account-actions-base.component';

/** One preview row: the current schedule figures alongside what they become. */
interface AdjustedPeriod {
  period: number;
  dueDate: number[];
  principalDue: number;
  currentInterestDue: number;
  currentTotalDue: number;
  newInterestDue: number;
  newTotalDue: number;
}

/**
 * Adjust Interest component.
 *
 * The officer enters a single target installment total (principal + interest) and every installment is set to it, with
 * interest back-solved as (target - principal). Used to round installments to a collectible figure on FLAT loans, e.g.
 * 105,650 KHR -> 105,700 KHR.
 */
@Component({
  selector: 'mifosx-adjust-installment-amount',
  templateUrl: './adjust-installment-amount.component.html',
  styleUrls: ['./adjust-installment-amount.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    InputAmountComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdjustInstallmentAmountComponent extends LoanAccountActionsBaseComponent implements OnInit {
  private formBuilder = inject(UntypedFormBuilder);
  private changeDetectorRef = inject(ChangeDetectorRef);

  /** Adjust installment amount form. */
  adjustInstallmentAmountForm: UntypedFormGroup;
  currency: Currency;

  /** Installments of the currently persisted schedule, disbursement row excluded. */
  private schedulePeriods: any[] = [];
  /** Lowest amount that still leaves every installment with a non-negative interest portion. */
  minimumInstallmentAmount = 0;

  previewPeriods: AdjustedPeriod[] = [];
  currentTotalInterest = 0;
  currentTotalRepayment = 0;
  newTotalInterest = 0;
  newTotalRepayment = 0;

  constructor() {
    super();
  }

  ngOnInit(): void {
    if (this.dataObject.currency) {
      this.currency = this.dataObject.currency;
    }

    this.schedulePeriods = (this.dataObject.repaymentSchedule?.periods || []).filter((period: any) => period.period);
    this.minimumInstallmentAmount = this.schedulePeriods.reduce(
      (maximum: number, period: any) => Math.max(maximum, period.principalDue || 0),
      0
    );
    this.currentTotalInterest = this.sum(this.schedulePeriods.map((period: any) => period.interestDue || 0));
    this.currentTotalRepayment = this.sum(this.schedulePeriods.map((period: any) => this.currentTotalDue(period)));

    const currentInstallmentAmount = this.schedulePeriods.length ? this.currentTotalDue(this.schedulePeriods[0]) : null;

    this.adjustInstallmentAmountForm = this.formBuilder.group({
      installmentAmount: [
        this.dataObject.adjustedInstallmentAmount ?? currentInstallmentAmount,
        [
          Validators.required,
          Validators.min(this.minimumInstallmentAmount)
        ]
      ]
    });

    this.adjustInstallmentAmountForm.controls.installmentAmount.valueChanges.subscribe(() => {
      this.buildPreview();
      this.changeDetectorRef.markForCheck();
    });
    this.buildPreview();
  }

  /**
   * Recomputes the preview client side. No server round trip is needed: principal per installment is untouched by the
   * adjustment, so the result is fully determined by (target - principal).
   */
  private buildPreview(): void {
    const installmentAmount = Number(this.adjustInstallmentAmountForm.value.installmentAmount);
    if (!installmentAmount || installmentAmount < this.minimumInstallmentAmount) {
      this.previewPeriods = [];
      this.newTotalInterest = 0;
      this.newTotalRepayment = 0;
      return;
    }

    this.previewPeriods = this.schedulePeriods.map((period: any) => ({
      period: period.period,
      dueDate: period.dueDate,
      principalDue: period.principalDue || 0,
      currentInterestDue: period.interestDue || 0,
      currentTotalDue: this.currentTotalDue(period),
      newInterestDue: installmentAmount - (period.principalDue || 0),
      newTotalDue: installmentAmount
    }));

    this.newTotalInterest = this.sum(this.previewPeriods.map((period) => period.newInterestDue));
    this.newTotalRepayment = this.sum(this.previewPeriods.map((period) => period.newTotalDue));
  }

  /** Principal + interest only; fees and penalties are not part of the adjusted amount. */
  private currentTotalDue(period: any): number {
    return (period.principalDue || 0) + (period.interestDue || 0);
  }

  private sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  get interestDelta(): number {
    return this.newTotalInterest - this.currentTotalInterest;
  }

  get repaymentDelta(): number {
    return this.newTotalRepayment - this.currentTotalRepayment;
  }

  submit(): void {
    const data = {
      installmentAmount: this.adjustInstallmentAmountForm.value.installmentAmount * 1,
      locale: this.settingsService.language.code
    };
    this.loanService.loanActionButtons(this.loanId, 'adjustInstallmentAmount', data).subscribe(() => {
      this.gotoLoanView('repayment-schedule');
    });
  }
}
