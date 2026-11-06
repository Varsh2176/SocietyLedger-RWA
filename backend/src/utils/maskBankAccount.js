/**
 * Mask a society bank account for resident-facing responses.
 * Keeps the bank name and the last four digits. Never returns the full number.
 */
export function maskBankAccount(bankAccount) {
  if (!bankAccount || typeof bankAccount !== 'string') {
    return 'Designated Society Bank Account';
  }

  const bankName = bankAccount.split('-')[0]?.trim() || 'Bank';
  const trailingDigits = bankAccount.match(/(\d{4})\s*$/);
  const last4 = trailingDigits ? trailingDigits[1] : '****';
  return `${bankName} - A/C ****${last4}`;
}

export const PUBLISHED_TRANSACTION_STATUSES = ['APPROVED', 'PAID', 'RECONCILED'];

export const PUBLISHED_EVENT_STATUSES = ['APPROVED', 'IN_PROGRESS', 'COMPLETED', 'SETTLED'];
