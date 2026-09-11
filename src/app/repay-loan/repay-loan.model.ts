/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Which field the teller is searching on. */
export type SearchMode = 'loanAccountNo' | 'client';

/**
 * A loan that is in a state where it can accept a repayment.
 *
 * Normalises the two shapes a candidate can arrive in: a `/search` hit
 * (resource=loans) and a `/clients/{id}/accounts` loan account.
 */
export interface RepayableLoan {
  loanId: number;
  accountNo: string;
  productName: string;
  clientId: number | null;
  clientName: string;
  statusCode: string;
  statusValue: string;
}
