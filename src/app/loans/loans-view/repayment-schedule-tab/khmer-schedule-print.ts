/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { RepaymentSchedule } from 'app/loans/models/loan-account.model';

/**
 * Khmer script needs OpenType shaping, which jsPDF cannot do. This builds a
 * self-contained HTML document (Khmer labels + Noto Sans Khmer webfont) in a
 * new window and triggers the browser's print dialog, where the user saves it
 * as PDF. The same template can later be rendered server-side (e.g. Gotenberg)
 * without changes.
 */

const LABELS = {
  title: 'តារាងកាលវិភាគសងប្រាក់កម្ចី',
  clientInfo: 'ព័ត៌មានអតិថិជន',
  clientName: 'ឈ្មោះអតិថិជន',
  mobileNo: 'លេខទូរស័ព្ទ',
  loanInfo: 'ព័ត៌មានកម្ចី',
  loanAccountNo: 'លេខគណនីកម្ចី',
  loanProduct: 'ផលិតផលកម្ចី',
  principal: 'ប្រាក់ដើម',
  interestRate: 'អត្រាការប្រាក់ប្រចាំឆ្នាំ',
  numberOfRepayments: 'ចំនួនដងនៃការសង',
  disbursementDate: 'កាលបរិច្ឆេទបើកប្រាក់',
  currency: 'រូបិយប័ណ្ណ',
  printedOn: 'បោះពុម្ពថ្ងៃទី',
  // table headers
  no: 'ល.រ',
  dueDate: 'កាលបរិច្ឆេទត្រូវសង',
  principalDue: 'ប្រាក់ដើម',
  interest: 'ការប្រាក់',
  fees: 'កម្រៃសេវា',
  penalties: 'ប្រាក់ពិន័យ',
  totalDue: 'សរុបត្រូវសង',
  paid: 'បានសង',
  outstanding: 'នៅជំពាក់',
  balance: 'សមតុល្យប្រាក់ដើម',
  total: 'សរុប'
};

const CURRENCY_NAMES_KM: Record<string, string> = {
  KHR: 'ប្រាក់រៀល (KHR)',
  USD: 'ដុល្លារអាមេរិក (USD)'
};

export interface KhmerPrintClient {
  displayName?: string;
  mobileNo?: string;
}

export interface KhmerPrintLoan {
  accountNo?: string;
  clientName?: string;
  loanProductName?: string;
  principal?: number;
  annualInterestRate?: number;
  numberOfRepayments?: number;
  currency?: { code?: string; displaySymbol?: string };
  timeline?: { actualDisbursementDate?: number[]; expectedDisbursementDate?: number[] };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );
}

function formatAmount(value: number | undefined | null): string {
  if (value == null) {
    return '';
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKhmerDate(date: number[] | Date | undefined): string {
  if (!date) {
    return '';
  }
  const jsDate = Array.isArray(date) ? new Date(date[0], date[1] - 1, date[2]) : date;
  return new Intl.DateTimeFormat('km-KH', { day: '2-digit', month: 'long', year: 'numeric' }).format(jsDate);
}

export function buildKhmerScheduleHtml(
  loan: KhmerPrintLoan,
  schedule: RepaymentSchedule,
  client: KhmerPrintClient,
  businessDate: Date
): string {
  const currencyCode = loan.currency?.code ?? '';
  const currencyName = CURRENCY_NAMES_KM[currencyCode] ?? currencyCode;
  const disbursementDate = loan.timeline?.actualDisbursementDate ?? loan.timeline?.expectedDisbursementDate;

  const infoRow = (label: string, value: string) =>
    value ? `<div class="info-row"><span class="info-label">${label}</span><span>${value}</span></div>` : '';

  const bodyRows = (schedule.periods ?? [])
    .filter((period) => period.period != null)
    .map(
      (period) => `
        <tr>
          <td class="num">${period.period}</td>
          <td>${formatKhmerDate(period.dueDate)}</td>
          <td class="num">${formatAmount(period.principalDue)}</td>
          <td class="num">${formatAmount(period.interestDue)}</td>
          <td class="num">${formatAmount(period.feeChargesDue)}</td>
          <td class="num">${formatAmount(period.penaltyChargesDue)}</td>
          <td class="num">${formatAmount(period.totalDueForPeriod)}</td>
          <td class="num">${formatAmount(period.totalPaidForPeriod)}</td>
          <td class="num">${formatAmount(period.totalOutstandingForPeriod)}</td>
          <td class="num">${formatAmount(period.principalLoanBalanceOutstanding)}</td>
        </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="km">
<head>
<meta charset="utf-8" />
<title>${LABELS.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans Khmer', 'Khmer OS', 'Khmer MN', 'Khmer Sangam MN', sans-serif;
    font-size: 11px; color: #1a1a1a; margin: 0; padding: 16px;
  }
  h1 { font-size: 18px; text-align: center; margin: 0 0 12px; }
  h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 1px solid #999; padding-bottom: 3px; }
  .info-sections { display: flex; gap: 40px; }
  .info-section { flex: 1; }
  .info-row { display: flex; padding: 2px 0; }
  .info-label { width: 170px; font-weight: 700; flex-shrink: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #444; padding: 3px 6px; }
  th { background: #2679b8; color: #fff; font-weight: 700; text-align: center; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) { background: #f2f2f2; }
  tfoot td { font-weight: 700; background: #2679b8; color: #fff; }
  tbody tr, tfoot tr { break-inside: avoid; }
  thead { display: table-header-group; }
  .printed-on { margin-top: 10px; font-size: 10px; text-align: right; color: #555; }
</style>
</head>
<body>
  <h1>${LABELS.title}</h1>
  <div class="info-sections">
    <div class="info-section">
      <h2>${LABELS.clientInfo}</h2>
      ${infoRow(LABELS.clientName, escapeHtml(client.displayName ?? loan.clientName))}
      ${infoRow(LABELS.mobileNo, escapeHtml(client.mobileNo))}
    </div>
    <div class="info-section">
      <h2>${LABELS.loanInfo}</h2>
      ${infoRow(LABELS.loanAccountNo, escapeHtml(loan.accountNo))}
      ${infoRow(LABELS.loanProduct, escapeHtml(loan.loanProductName))}
      ${infoRow(LABELS.currency, escapeHtml(currencyName))}
      ${infoRow(LABELS.principal, formatAmount(loan.principal))}
      ${infoRow(LABELS.interestRate, loan.annualInterestRate != null ? `${loan.annualInterestRate}%` : '')}
      ${infoRow(LABELS.numberOfRepayments, escapeHtml(loan.numberOfRepayments))}
      ${infoRow(LABELS.disbursementDate, formatKhmerDate(disbursementDate))}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${LABELS.no}</th>
        <th>${LABELS.dueDate}</th>
        <th>${LABELS.principalDue}</th>
        <th>${LABELS.interest}</th>
        <th>${LABELS.fees}</th>
        <th>${LABELS.penalties}</th>
        <th>${LABELS.totalDue}</th>
        <th>${LABELS.paid}</th>
        <th>${LABELS.outstanding}</th>
        <th>${LABELS.balance}</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2">${LABELS.total}</td>
        <td class="num">${formatAmount(schedule.totalPrincipalExpected)}</td>
        <td class="num">${formatAmount(schedule.totalInterestCharged)}</td>
        <td class="num">${formatAmount(schedule.totalFeeChargesCharged)}</td>
        <td class="num">${formatAmount(schedule.totalPenaltyChargesCharged)}</td>
        <td class="num">${formatAmount(schedule.totalRepaymentExpected)}</td>
        <td class="num">${formatAmount(schedule.totalRepayment)}</td>
        <td class="num">${formatAmount(schedule.totalOutstanding)}</td>
        <td class="num"></td>
      </tr>
    </tfoot>
  </table>
  <div class="printed-on">${LABELS.printedOn} ${formatKhmerDate(businessDate)}</div>
  <script>
    window.onload = function () {
      var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      fontsReady.then(function () {
        setTimeout(function () { window.print(); }, 300);
      });
    };
  </script>
</body>
</html>`;

  return html;
}

export function openKhmerSchedulePrintView(
  loan: KhmerPrintLoan,
  schedule: RepaymentSchedule,
  client: KhmerPrintClient,
  businessDate: Date
): void {
  const html = buildKhmerScheduleHtml(loan, schedule, client, businessDate);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Popup blocked: unable to open the Khmer schedule print view');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
