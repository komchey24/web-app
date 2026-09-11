/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { Routes } from '@angular/router';

/** Custom Services */
import { Route } from '../core/route/route.service';

/** Custom Components */
import { RepayLoanComponent } from './repay-loan.component';

/**
 * Routes for the `/repay-loan` teller shortcut.
 *
 * A single shell-wrapped screen with no resolver: the loan is not known until the
 * teller searches for one, so there is nothing to prefetch before activation.
 */
export const REPAY_LOAN_ROUTES: Routes = [
  Route.withShell([
    {
      path: '',
      pathMatch: 'full',
      component: RepayLoanComponent,
      data: { title: 'Repay Loan', breadcrumb: 'Repay Loan', routeParamBreadcrumb: false }
    }
  ])
];
