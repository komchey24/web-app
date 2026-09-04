/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { RepaymentSchedule, RepaymentSchedulePeriod } from 'app/loans/models/loan-account.model';

/**
 * Khmer script needs OpenType shaping, which jsPDF cannot do. This builds a
 * self-contained HTML document (Khmer labels + Noto Sans Khmer webfont) in a
 * new window and triggers the browser's print dialog, where the user saves it
 * as PDF. The same template can later be rendered server-side (e.g. Gotenberg)
 * without changes.
 *
 * The layout mirrors the collection sheet in `docs/samples/repayment-table.pdf`:
 * A4 portrait, client/loan facts in two columns, one row per installment and
 * blank columns for penalties, the collector's signature and remarks.
 *
 * Long schedules print the installments in two side-by-side halves so they
 * still fit a single sheet — see SINGLE_COLUMN_MAX_ROWS.
 */

const LABELS = {
  title: 'កាលវិភាគសងប្រាក់',
  // client / loan facts
  clientCode: 'កូដអតិថិជន',
  contractNo: 'លេខកិច្ចសន្យា',
  clientName: 'ឈ្មោះអតិថិជន',
  mobileNo: 'ទូរស័ព្ទ',
  address: 'អាស័យដ្ឋាន',
  loanOfficer: 'មន្ត្រីឥណទាន',
  loanOfficerMobileNo: 'ទូរស័ព្ទ',
  numberOfRepayments: 'ចំនួនកាលវិភាគ',
  principal: 'ចំនួនទឹកប្រាក់',
  currency: 'រូបិយប័ណ្ណ',
  disbursementDate: 'កាលបរិច្ឆេទខ្ចីប្រាក់',
  firstRepaymentDate: 'ថ្ងៃបង់ដំបូង',
  maturityDate: 'ថ្ងៃផុតកំណត់',
  cycle: 'ជំហាន',
  cyclePrefix: 'ទី',
  // table headers
  no: 'ល.រ',
  dueDate: 'កាលបរិច្ឆេទត្រូវបង់',
  day: 'ថ្ងៃ',
  totalDue: 'ប្រាក់ត្រូវបង់សរុប',
  penalties: 'ពិន័យ',
  receiverSignature: 'ហត្ថលេខាអ្នកទទួលប្រាក់',
  remarks: 'ផ្សេងៗ',
  // footer
  payerSignature: 'ហត្ថលេខាអ្នកប្រគល់ប្រាក់',
  borrowerThumbprint: 'ស្នាមមេដៃកូនបំណុល',
  dateLine: 'ថ្ងៃ'
};

const WEEKDAYS_KM = [
  'អាទិត្យ',
  'ចន្ទ',
  'អង្គារ',
  'ពុធ',
  'ព្រហស្បតិ៍',
  'សុក្រ',
  'សៅរ៍'
];

/**
 * Above this many installments the single-column table no longer fits one A4
 * page, so the schedule is printed in two side-by-side halves. Derived from the
 * ~273mm printable height less the title, the facts block and the signature
 * footer, at ~28px per row — retune here if that furniture changes.
 */
const SINGLE_COLUMN_MAX_ROWS = 22;

/**
 * Halving the column widths leaves no room for the full headers, and Khmer has
 * no inter-word spaces to wrap at, so the two-column layout uses these instead.
 */
const SHORT_HEADERS = {
  dueDate: 'ថ្ងៃបង់',
  totalDue: 'សរុប',
  receiverSignature: 'ហត្ថលេខា'
};

export interface KhmerPrintAddress {
  street?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  countyDistrict?: string;
  stateName?: string;
  countryName?: string;
  isActive?: boolean;
}

export interface KhmerPrintClient {
  accountNo?: string;
  displayName?: string;
  mobileNo?: string;
  addresses?: KhmerPrintAddress[];
}

export interface KhmerPrintLoan {
  accountNo?: string;
  clientName?: string;
  loanProductName?: string;
  loanOfficerName?: string;
  /** Resolved from the /staff endpoint — not part of the loan payload itself */
  loanOfficerMobileNo?: string;
  loanCounter?: number;
  loanProductCounter?: number;
  principal?: number;
  approvedPrincipal?: number;
  annualInterestRate?: number;
  numberOfRepayments?: number;
  currency?: { code?: string; displaySymbol?: string; decimalPlaces?: number };
  timeline?: {
    actualDisbursementDate?: number[];
    expectedDisbursementDate?: number[];
    actualMaturityDate?: number[];
    expectedMaturityDate?: number[];
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );
}

function toDate(date: number[] | Date | undefined | null): Date | null {
  if (!date) {
    return null;
  }
  return Array.isArray(date) ? new Date(date[0], date[1] - 1, date[2]) : date;
}

function formatAmount(value: number | undefined | null, decimalPlaces: number): string {
  if (value == null) {
    return '';
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });
}

/** Sample uses numeric dd/MM/yyyy dates rather than spelled-out Khmer months. */
function formatDate(date: number[] | Date | undefined | null): string {
  const jsDate = toDate(date);
  if (!jsDate) {
    return '';
  }
  const day = String(jsDate.getDate()).padStart(2, '0');
  const month = String(jsDate.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${jsDate.getFullYear()}`;
}

function weekdayKm(date: number[] | Date | undefined | null): string {
  const jsDate = toDate(date);
  return jsDate ? WEEKDAYS_KM[jsDate.getDay()] : '';
}

function formatAddress(client: KhmerPrintClient): string {
  const address = client.addresses?.find((item) => item.isActive) ?? client.addresses?.[0];
  if (!address) {
    return '';
  }
  return [
    address.street,
    address.addressLine1,
    address.addressLine2,
    address.addressLine3,
    address.city,
    address.countyDistrict,
    address.stateName
  ]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(', ');
}

export function buildKhmerScheduleHtml(
  loan: KhmerPrintLoan,
  schedule: RepaymentSchedule,
  client: KhmerPrintClient
): string {
  const decimalPlaces = loan.currency?.decimalPlaces ?? 2;
  const installments = (schedule.periods ?? []).filter((period) => period.period != null);
  const disbursementDate = loan.timeline?.actualDisbursementDate ?? loan.timeline?.expectedDisbursementDate;
  const maturityDate = loan.timeline?.actualMaturityDate ?? loan.timeline?.expectedMaturityDate;
  const firstRepaymentDate = installments[0]?.dueDate;
  const lastRepaymentDate = installments[installments.length - 1]?.dueDate;
  const cycle = loan.loanProductCounter ?? loan.loanCounter;

  // Two halves side by side keep a long schedule on one sheet; a short one is
  // already single-page, so splitting it would only leave a sparse half-table.
  const twoColumn = installments.length > SINGLE_COLUMN_MAX_ROWS;
  const rowsPerColumn = twoColumn ? Math.ceil(installments.length / 2) : installments.length;
  const headers = twoColumn ? { ...LABELS, ...SHORT_HEADERS } : LABELS;
  const twoColumnClass = (name: string) => (twoColumn ? ` class="${name}"` : '');

  const infoRow = (label: string, value: string) =>
    `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`;

  /** `col-divider` draws the thicker rule where the second half starts. */
  const columnClass = (name: string, rightHalf: boolean) => `${name}${rightHalf ? ' col-divider' : ''}`;

  const headerCells = (rightHalf: boolean) => `
        <th class="${columnClass('col-no', rightHalf)}">${headers.no}</th>
        <th class="col-date">${headers.dueDate}</th>
        <th class="col-day">${headers.day}</th>
        <th class="col-amount">${headers.totalDue}</th>
        <th class="col-penalty">${headers.penalties}</th>
        <th class="col-signature">${headers.receiverSignature}</th>
        <th class="col-remarks">${headers.remarks}</th>`;

  // An odd installment count leaves the last right-hand slot empty; it still
  // emits its cells so the grid closes rather than ending mid-row.
  const bodyCells = (period: RepaymentSchedulePeriod | undefined, rightHalf: boolean) => `
          <td class="${columnClass('col-no', rightHalf)}">${period ? period.period : ''}</td>
          <td class="col-date">${period ? formatDate(period.dueDate) : ''}</td>
          <td class="col-day">${period ? weekdayKm(period.dueDate) : ''}</td>
          <td class="amount">${period ? formatAmount(period.totalDueForPeriod, decimalPlaces) : ''}</td>
          <td></td>
          <td></td>
          <td></td>`;

  // Down-then-across: installments 1..rowsPerColumn fill the left half, the
  // rest the right. Every row carries its number, so a schedule long enough to
  // still need a second sheet stays readable even though the left half there
  // continues the left sequence rather than following the right half's last row.
  const bodyRows = Array.from(
    { length: rowsPerColumn },
    (_unused, index) => `
        <tr>${bodyCells(installments[index], false)}${
          twoColumn ? bodyCells(installments[index + rowsPerColumn], true) : ''
        }
        </tr>`
  ).join('');

  const html = `<!doctype html>
<html lang="km">
<head>
<meta charset="utf-8" />
<title>${LABELS.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans Khmer', 'Khmer OS', 'Khmer MN', 'Khmer Sangam MN', sans-serif;
    font-size: 12px; line-height: 1.6; color: #000; margin: 0; padding: 0;
  }
  /* The print window is shown briefly before the dialog opens; frame it like the sheet. */
  @media screen { body { width: 210mm; margin: 0 auto; padding: 12mm; } }
  h1 { font-size: 16px; font-weight: 700; text-align: center; margin: 0 0 8px; }
  .info { display: flex; gap: 32px; margin-bottom: 16px; }
  .info-col { flex: 1; }
  .info-row { display: flex; gap: 8px; }
  .info-col-left .info-label { width: 120px; flex-shrink: 0; }
  .info-col-right .info-label { flex: 1; }
  .info-col-right .info-value { text-align: right; }
  /* Fixed layout: the column percentages below are honoured exactly, so a long
     Khmer header can never widen the table past the printable page width.
     The 2px of slack matters: at exactly 100% the collapsed right-hand border
     falls on the page's clip boundary and Chrome drops it when printing, which
     leaves the table looking open on the right. */
  table { width: calc(100% - 2px); border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 4px; text-align: center; height: 24px; }
  th { background: #d9d9d9; font-weight: 700; font-size: 11px; }
  td.amount { font-variant-numeric: tabular-nums; }
  .col-no { width: 5%; }
  .col-date { width: 16%; }
  .col-day { width: 9%; }
  .col-amount { width: 18%; }
  .col-penalty { width: 14%; }
  .col-signature { width: 22%; }
  .col-remarks { width: 16%; }
  /* Two halves side by side: each half gets the proportions above, roughly
     halved, so the 14 widths still sum to 100%. The day column takes a little
     back from the blank hand-write columns because the longest weekday
     (ព្រហស្បតិ៍) would otherwise spill into the amount beside it. */
  .two-column .col-no { width: 3.5%; }
  .two-column .col-date { width: 8%; }
  .two-column .col-day { width: 7%; }
  .two-column .col-amount { width: 8.5%; }
  .two-column .col-penalty { width: 6%; }
  .two-column .col-signature { width: 10.5%; }
  .two-column .col-remarks { width: 6.5%; }
  .two-column th, .two-column td { padding: 3px 2px; height: 20px; }
  .two-column td { font-size: 10px; }
  .two-column td.col-date, .two-column td.col-day { font-size: 9px; }
  /* Khmer has no inter-word spaces to wrap at, so let a header break anywhere
     rather than overflow its cell, even with the shortened labels. */
  .two-column th { font-size: 9px; line-height: 1.3; overflow-wrap: anywhere; }
  .two-column .col-divider { border-left-width: 3px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .sign-labels { display: flex; justify-content: space-between; margin-top: 8px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 96px; break-inside: avoid; }
  /* The footer is what tips a nearly-full two-column table onto a second
     sheet, so it signs closer to the table there — still room to sign. */
  .two-column-page .signatures { margin-top: 56px; }
  .signature { width: 240px; }
  .signature-line { border-top: 1px solid #000; }
  .signature-date { display: flex; gap: 40px; padding-top: 4px; }
</style>
</head>
<body${twoColumnClass('two-column-page')}>
  <h1>${LABELS.title}</h1>
  <div class="info">
    <div class="info-col info-col-left">
      ${infoRow(LABELS.clientCode, escapeHtml(client.accountNo))}
      ${infoRow(LABELS.contractNo, escapeHtml(loan.accountNo))}
      ${infoRow(LABELS.clientName, escapeHtml(client.displayName ?? loan.clientName))}
      ${infoRow(LABELS.mobileNo, escapeHtml(client.mobileNo))}
      ${infoRow(LABELS.address, escapeHtml(formatAddress(client)))}
      ${infoRow(LABELS.loanOfficer, escapeHtml(loan.loanOfficerName))}
      ${infoRow(LABELS.loanOfficerMobileNo, escapeHtml(loan.loanOfficerMobileNo))}
    </div>
    <div class="info-col info-col-right">
      ${infoRow(LABELS.numberOfRepayments, escapeHtml(loan.numberOfRepayments ?? installments.length))}
      ${infoRow(LABELS.principal, formatAmount(loan.principal ?? loan.approvedPrincipal, decimalPlaces))}
      ${infoRow(LABELS.currency, escapeHtml(loan.currency?.code))}
      ${infoRow(LABELS.disbursementDate, formatDate(disbursementDate))}
      ${infoRow(LABELS.firstRepaymentDate, formatDate(firstRepaymentDate))}
      ${infoRow(LABELS.maturityDate, formatDate(maturityDate ?? lastRepaymentDate))}
      ${infoRow(LABELS.cycle, cycle != null ? `${LABELS.cyclePrefix}${cycle}` : '')}
    </div>
  </div>
  <table${twoColumnClass('two-column')}>
    <thead>
      <tr>${headerCells(false)}${twoColumn ? headerCells(true) : ''}
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="sign-labels">
    <span>${LABELS.payerSignature}</span>
    <span>${LABELS.borrowerThumbprint}</span>
  </div>
  <div class="signatures">
    <div class="signature">
      <div class="signature-line"></div>
      <div class="signature-date"><span>${LABELS.dateLine}</span><span>/</span><span>/</span></div>
    </div>
    <div class="signature">
      <div class="signature-line"></div>
      <div class="signature-date"><span>${LABELS.dateLine}</span><span>/</span><span>/</span></div>
    </div>
  </div>
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
  client: KhmerPrintClient
): void {
  const html = buildKhmerScheduleHtml(loan, schedule, client);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Popup blocked: unable to open the Khmer schedule print view');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
