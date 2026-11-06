/**
 * Visible reconciliation label.
 * "Reconciled & Matched" is reserved for a session the backend has finalized
 * with no balance variance. A zero-variance session that is still editable
 * stays pending finalization.
 */
export function getReconciliationDisplayStatus(rec) {
  if (!rec || typeof rec !== 'object') return 'In Progress';

  if (typeof rec.displayStatus === 'string' && rec.displayStatus.trim()) {
    return rec.displayStatus.trim();
  }

  const difference = Number(rec.differenceAmount);
  const zeroVariance = difference === 0;
  const finalized = rec.isFinalized === true;
  const openDiscrepancies = Number(rec.openDiscrepanciesCount ?? rec.unmatchedEntries?.length ?? 0);
  const totalRows = Number(rec.totalStatementRows ?? rec.statementTransactions?.length ?? 0);
  const matched = Number(rec.matchedCount ?? rec.matchedTransactionsCount ?? 0);
  const matchesComplete = openDiscrepancies === 0 && (totalRows === 0 || matched >= totalRows);

  if (finalized && zeroVariance) return 'Reconciled & Matched';
  if (!finalized && zeroVariance && matchesComplete) return 'Matched — Pending Finalization';
  if (!zeroVariance || openDiscrepancies > 0) return 'Discrepancy Detected';
  if (finalized) return 'Finalized';
  return 'In Progress';
}

export function getReconciliationBadgeVariant(label) {
  if (label === 'Reconciled & Matched') return 'success';
  if (label === 'Matched — Pending Finalization') return 'info';
  if (label === 'Discrepancy Detected') return 'warning';
  return 'neutral';
}
