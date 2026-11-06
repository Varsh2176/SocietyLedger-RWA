import {
  Reconciliation,
  Fund,
  Transaction,
  AuditLog,
} from '../models/index.js';

/**
 * Bank Reconciliation Controller
 * Enforces strict financial safety:
 * - Matching compares records without asserting automatic validity.
 * - Statement rows never alter ledger balances.
 * - Finalized reconciliations are strictly immutable.
 */

/**
 * Label shown for a reconciliation session.
 * Finalized zero-variance sessions are the only ones described as reconciled.
 */
export function describeReconciliationStatus(record) {
  const differencePaise =
    record.differenceAmountPaise ??
    (record.differenceAmount != null ? Math.round(Number(record.differenceAmount) * 100) : null);
  const zeroVariance = differencePaise === 0;
  const finalized = record.isFinalized === true;
  const openDiscrepancies = Array.isArray(record.discrepancies)
    ? record.discrepancies.filter((item) => item.status === 'OPEN').length
    : Number(record.openDiscrepanciesCount || 0);
  const totalRows = record.statementTransactions?.length ?? Number(record.totalStatementRows || 0);
  const matched = record.matchedTransactionsCount ?? Number(record.matchedCount || 0);
  const matchesComplete = openDiscrepancies === 0 && (totalRows === 0 || matched >= totalRows);

  if (finalized && zeroVariance) return 'Reconciled & Matched';
  if (!finalized && zeroVariance && matchesComplete) return 'Matched — Pending Finalization';
  if (!zeroVariance || openDiscrepancies > 0) return 'Discrepancy Detected';
  if (finalized) return 'Finalized';
  return 'In Progress';
}

/**
 * GET /api/reconciliation
 * List all reconciliation sessions for the user's society.
 */
export async function getReconciliations(req, res, next) {
  try {
    const societyId = req.societyId;
    const { fundId, status } = req.query;

    const filter = { society: societyId };
    if (fundId) filter.fund = fundId;
    if (status && status !== 'ALL') filter.status = status;

    const reconciliations = await Reconciliation.find(filter)
      .populate('fund', 'name code type bankAccount')
      .populate('preparedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .populate('finalizedBy', 'name email role')
      .sort({ statementPeriodEnd: -1 });

    const formatted = reconciliations.map((r) => ({
      id: r._id,
      _id: r._id,
      fund: r.fund?.name || 'General Reserve',
      fundCode: r.fund?.code || '',
      accountName: r.accountName,
      periodStart: r.statementPeriodStart ? r.statementPeriodStart.toISOString().split('T')[0] : null,
      periodEnd: r.statementPeriodEnd ? r.statementPeriodEnd.toISOString().split('T')[0] : null,
      statementClosingBalance: r.statementClosingBalanceRupees,
      bookClosingBalance: r.bookClosingBalanceRupees,
      differenceAmount: r.differenceAmountRupees,
      statementPeriod:
        r.statementPeriodStart && r.statementPeriodEnd
          ? `${r.statementPeriodStart.toISOString().split('T')[0]} – ${r.statementPeriodEnd.toISOString().split('T')[0]}`
          : null,
      unmatchedEntries: (r.discrepancies || [])
        .filter((d) => d.status === 'OPEN')
        .map((d) => ({
          id: d._id,
          description: d.title,
          discrepancyNote: d.explanation,
          amount: d.amountPaise != null ? d.amountPaise / 100 : 0,
        })),
      status: r.status,
      isFinalized: r.isFinalized,
      displayStatus: describeReconciliationStatus(r),
      matchedCount: r.matchedTransactionsCount,
      totalStatementRows: r.statementTransactions?.length || 0,
      discrepanciesCount: r.discrepancies?.length || 0,
      openDiscrepanciesCount: r.discrepancies?.filter((d) => d.status === 'OPEN').length || 0,
      preparedBy: r.preparedBy?.name,
      reviewedBy: r.reviewedBy?.name,
      finalizedBy: r.finalizedBy?.name,
      finalizedAt: r.finalizedAt,
      createdAt: r.createdAt,
    }));

    res.status(200).json({
      success: true,
      message: 'Reconciliations retrieved successfully.',
      data: {
        reconciliations: formatted,
        total: formatted.length,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reconciliation/:id
 * Retrieve single reconciliation session with full matching workspace.
 */
export async function getReconciliationById(req, res, next) {
  try {
    const { id } = req.params;
    const reconciliation = await Reconciliation.findOne({ _id: id, society: req.societyId })
      .populate('fund', 'name code type bankAccount currentBalancePaise currentBalanceRupees')
      .populate('preparedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .populate('finalizedBy', 'name email role')
      .populate('statementTransactions.matchedTransaction', 'reference date amountPaise amountRupees type description vendorName');

    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        message: 'Reconciliation session not found.',
        data: null,
        errors: ['Session not found or belongs to another society'],
      });
    }

    // Also fetch eligible ledger transactions in the same fund and period for matching assistance
    const ledgerTransactions = await Transaction.find({
      society: req.societyId,
      fund: reconciliation.fund._id,
      date: {
        $gte: new Date(new Date(reconciliation.statementPeriodStart).setDate(reconciliation.statementPeriodStart.getDate() - 15)),
        $lte: new Date(new Date(reconciliation.statementPeriodEnd).setDate(reconciliation.statementPeriodEnd.getDate() + 15)),
      },
      status: { $ne: 'REVERSED' },
    }).sort({ date: 1 });

    const matchedLedgerIds = new Set(
      reconciliation.statementTransactions
        .filter((st) => st.matchedTransaction)
        .map((st) => (st.matchedTransaction._id || st.matchedTransaction).toString())
    );

    const availableLedgerTransactions = ledgerTransactions.map((tx) => ({
      id: tx._id,
      _id: tx._id,
      reference: tx.reference,
      date: tx.date.toISOString().split('T')[0],
      type: tx.type,
      amount: tx.amountRupees,
      amountPaise: tx.amountPaise,
      description: tx.description,
      vendorName: tx.vendorName,
      isMatchedInThisSession: matchedLedgerIds.has(tx._id.toString()),
    }));

    res.status(200).json({
      success: true,
      message: 'Reconciliation session retrieved successfully.',
      data: {
        reconciliation,
        availableLedgerTransactions,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reconciliation
 * Create a new bank reconciliation session.
 */
export async function createReconciliation(req, res, next) {
  try {
    const {
      fundId,
      accountName,
      statementPeriodStart,
      statementPeriodEnd,
      statementClosingBalance,
      statementOpeningBalance,
      notes,
    } = req.body;

    const errors = [];
    if (!fundId) errors.push('Target fund is required');
    if (!accountName || !accountName.trim()) errors.push('Account name is required');
    if (!statementPeriodStart) errors.push('Statement period start date is required');
    if (!statementPeriodEnd) errors.push('Statement period end date is required');
    if (statementClosingBalance === undefined || statementClosingBalance === null) {
      errors.push('Statement closing balance is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed for reconciliation session.',
        data: null,
        errors,
      });
    }

    const fund = await Fund.findOne({ _id: fundId, society: req.societyId });
    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found.',
        data: null,
        errors: ['Invalid fund reference'],
      });
    }

    const statementClosingPaise = Math.round(Number(statementClosingBalance) * 100);
    const statementOpeningPaise = statementOpeningBalance != null ? Math.round(Number(statementOpeningBalance) * 100) : 0;
    const bookClosingPaise = fund.currentBalancePaise;

    const reconciliation = await Reconciliation.create({
      society: req.societyId,
      fund: fund._id,
      accountName: accountName.trim(),
      statementPeriodStart: new Date(statementPeriodStart),
      statementPeriodEnd: new Date(statementPeriodEnd),
      statementOpeningBalancePaise: statementOpeningPaise,
      statementClosingBalancePaise: statementClosingPaise,
      bookOpeningBalancePaise: statementOpeningPaise,
      bookClosingBalancePaise: bookClosingPaise,
      status: 'IN_PROGRESS',
      preparedBy: req.user._id,
      notes: notes?.trim() || null,
      statementTransactions: [],
      discrepancies: [],
    });

    res.status(201).json({
      success: true,
      message: 'Reconciliation session initialized.',
      data: { reconciliation },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reconciliation/:id/import-statement
 * Safe validated statement transaction import (CSV rows or structured JSON).
 * Idempotency controls prevent duplicate reference imports.
 * Never alters ledger transactions or balances.
 */
export async function importStatement(req, res, next) {
  try {
    const { id } = req.params;
    const { rows, rawCsvText } = req.body;

    const reconciliation = await Reconciliation.findOne({ _id: id, society: req.societyId });
    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        message: 'Reconciliation session not found.',
        data: null,
        errors: ['Session not found'],
      });
    }

    if (reconciliation.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Cannot import into finalized reconciliation session.',
        data: null,
        errors: ['Finalized sessions are immutable'],
      });
    }

    let parsedRows = [];

    // Parse structured rows or CSV text
    if (Array.isArray(rows) && rows.length > 0) {
      parsedRows = rows;
    } else if (rawCsvText && typeof rawCsvText === 'string') {
      const lines = rawCsvText.trim().split(/\r?\n/);
      if (lines.length > 1) {
        const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 4) {
            const rowObj = {};
            header.forEach((h, idx) => {
              rowObj[h] = cols[idx];
            });
            parsedRows.push({
              date: rowObj.date,
              description: rowObj.description || rowObj.particulars,
              reference: rowObj.reference || rowObj.ref || rowObj['chq/ref no'],
              credit: rowObj.credit || rowObj['deposit'],
              debit: rowObj.debit || rowObj['withdrawal'],
              amount: rowObj.amount,
              type: rowObj.type,
            });
          }
        }
      }
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid statement rows provided for import.',
        data: null,
        errors: ['Import payload contains no readable data rows'],
      });
    }

    const existingRefs = new Set(
      reconciliation.statementTransactions
        .filter((st) => st.reference)
        .map((st) => st.reference.toLowerCase())
    );

    const importedEntries = [];
    const duplicates = [];

    for (const r of parsedRows) {
      if (!r.date || isNaN(new Date(r.date).getTime())) continue;

      let amountPaise = 0;
      let txType = 'DEBIT';

      if (r.credit && Number(r.credit) > 0) {
        amountPaise = Math.round(Number(r.credit) * 100);
        txType = 'CREDIT';
      } else if (r.debit && Number(r.debit) > 0) {
        amountPaise = Math.round(Number(r.debit) * 100);
        txType = 'DEBIT';
      } else if (r.amount && Number(r.amount) > 0) {
        amountPaise = Math.round(Number(r.amount) * 100);
        txType = r.type?.toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT';
      }

      if (amountPaise <= 0) continue;

      const refClean = r.reference?.trim() || null;
      if (refClean && existingRefs.has(refClean.toLowerCase())) {
        duplicates.push(refClean);
        continue; // Idempotency check: prevent duplicate imports
      }

      if (refClean) existingRefs.add(refClean.toLowerCase());

      importedEntries.push({
        date: new Date(r.date),
        description: r.description?.trim() || 'Bank Transaction',
        reference: refClean,
        amountPaise,
        type: txType,
        status: 'UNMATCHED',
        matchedTransaction: null,
      });
    }

    reconciliation.statementTransactions.push(...importedEntries);

    // Rule-based automated discrepancy flags (NOT assertions of fraud)
    if (duplicates.length > 0) {
      reconciliation.discrepancies.push({
        title: `Possible Duplicate Statement References (${duplicates.length})`,
        type: 'DUPLICATE_REFERENCE',
        severity: 'MEDIUM',
        explanation: `Statement import detected recurring references already logged: ${duplicates.slice(0, 3).join(', ')}`,
        status: 'OPEN',
      });
    }

    await reconciliation.save();

    res.status(200).json({
      success: true,
      message: `Successfully imported ${importedEntries.length} statement transactions. ${
        duplicates.length > 0 ? `(${duplicates.length} duplicate references skipped)` : ''
      }`,
      data: {
        importedCount: importedEntries.length,
        skippedDuplicateCount: duplicates.length,
        totalStatementRows: reconciliation.statementTransactions.length,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reconciliation/:id/match
 * Manually match a statement row with a ledger voucher.
 * Validates amounts, dates, and fund associations.
 */
export async function matchTransaction(req, res, next) {
  try {
    const { id } = req.params;
    const { statementTxId, ledgerTxId, notes } = req.body;

    const reconciliation = await Reconciliation.findOne({ _id: id, society: req.societyId });
    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        message: 'Reconciliation session not found.',
        data: null,
        errors: ['Session not found'],
      });
    }

    if (reconciliation.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify matches on a finalized reconciliation session.',
        data: null,
        errors: ['Finalized sessions are immutable'],
      });
    }

    const stTx = reconciliation.statementTransactions.id(statementTxId);
    if (!stTx) {
      return res.status(404).json({
        success: false,
        message: 'Statement transaction row not found.',
        data: null,
        errors: ['Invalid statement transaction reference'],
      });
    }

    const ledgerTx = await Transaction.findOne({ _id: ledgerTxId, society: req.societyId });
    if (!ledgerTx) {
      return res.status(404).json({
        success: false,
        message: 'Ledger transaction voucher not found.',
        data: null,
        errors: ['Invalid ledger transaction reference'],
      });
    }

    // Verify fund match
    if (ledgerTx.fund.toString() !== reconciliation.fund.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Fund mismatch between statement session and ledger voucher.',
        data: null,
        errors: ['Cannot match transactions belonging to different funds'],
      });
    }

    // Check amount discrepancy
    const amountDifference = Math.abs(stTx.amountPaise - ledgerTx.amountPaise);
    let matchConfidence = 'MANUAL';

    if (amountDifference > 0) {
      // Record discrepancy flag
      reconciliation.discrepancies.push({
        title: `Amount Mismatch on Voucher ${ledgerTx.reference}`,
        type: 'AMOUNT_MISMATCH',
        severity: 'HIGH',
        amountPaise: amountDifference,
        explanation: `Statement shows ₹${stTx.amountPaise / 100} while Ledger voucher ${ledgerTx.reference} records ₹${ledgerTx.amountPaise / 100}. Discrepancy: ₹${amountDifference / 100}.`,
        status: 'OPEN',
      });
    } else {
      matchConfidence = 'EXACT_REF_AND_AMOUNT';
    }

    // Check date discrepancy (> 10 days)
    const dayDiff = Math.abs((new Date(stTx.date) - new Date(ledgerTx.date)) / (1000 * 60 * 60 * 24));
    if (dayDiff > 10) {
      reconciliation.discrepancies.push({
        title: `Date Discrepancy on Voucher ${ledgerTx.reference}`,
        type: 'DATE_DISCREPANCY',
        severity: 'LOW',
        explanation: `Statement cleared on ${new Date(stTx.date).toISOString().split('T')[0]} but voucher dated ${new Date(ledgerTx.date).toISOString().split('T')[0]} (${Math.round(dayDiff)} days transit delay).`,
        status: 'OPEN',
      });
    }

    stTx.status = 'MATCHED';
    stTx.matchedTransaction = ledgerTx._id;
    stTx.matchConfidence = matchConfidence;
    if (notes) stTx.notes = notes.trim();

    reconciliation.matchedTransactionsCount = reconciliation.statementTransactions.filter(
      (st) => st.status === 'MATCHED'
    ).length;

    await reconciliation.save();

    res.status(200).json({
      success: true,
      message: 'Transaction match successfully recorded.',
      data: {
        matchedStatementRow: stTx,
        matchedCount: reconciliation.matchedTransactionsCount,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reconciliation/:id/unmatch
 * Remove a match link from a statement transaction.
 */
export async function unmatchTransaction(req, res, next) {
  try {
    const { id } = req.params;
    const { statementTxId } = req.body;

    const reconciliation = await Reconciliation.findOne({ _id: id, society: req.societyId });
    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        message: 'Reconciliation session not found.',
        data: null,
        errors: ['Session not found'],
      });
    }

    if (reconciliation.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify matches on a finalized reconciliation session.',
        data: null,
        errors: ['Finalized sessions are immutable'],
      });
    }

    const stTx = reconciliation.statementTransactions.id(statementTxId);
    if (!stTx) {
      return res.status(404).json({
        success: false,
        message: 'Statement transaction not found.',
        data: null,
        errors: ['Invalid statement transaction reference'],
      });
    }

    stTx.status = 'UNMATCHED';
    stTx.matchedTransaction = null;
    stTx.matchConfidence = null;

    reconciliation.matchedTransactionsCount = reconciliation.statementTransactions.filter(
      (st) => st.status === 'MATCHED'
    ).length;

    await reconciliation.save();

    res.status(200).json({
      success: true,
      message: 'Transaction unmatched successfully.',
      data: {
        unmatchedStatementRow: stTx,
        matchedCount: reconciliation.matchedTransactionsCount,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reconciliation/:id/discrepancies/:discrepancyId/resolve
 * Record explanation and resolution action on a discrepancy item.
 */
export async function resolveDiscrepancy(req, res, next) {
  try {
    const { id, discrepancyId } = req.params;
    const { explanation, correctiveAction, status = 'RESOLVED' } = req.body;

    if (!explanation || !explanation.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Explanation is required to resolve a discrepancy.',
        data: null,
        errors: ['Explanation must be provided'],
      });
    }

    const reconciliation = await Reconciliation.findOne({ _id: id, society: req.societyId });
    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        message: 'Reconciliation session not found.',
        data: null,
        errors: ['Session not found'],
      });
    }

    if (reconciliation.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Cannot resolve discrepancies on a finalized reconciliation session.',
        data: null,
        errors: ['Finalized sessions are immutable'],
      });
    }

    const disc = reconciliation.discrepancies.id(discrepancyId);
    if (!disc) {
      return res.status(404).json({
        success: false,
        message: 'Discrepancy item not found.',
        data: null,
        errors: ['Invalid discrepancy ID'],
      });
    }

    disc.explanation = explanation.trim();
    if (correctiveAction) disc.correctiveAction = correctiveAction.trim();
    disc.status = status;
    disc.resolvedBy = req.user._id;
    disc.resolvedAt = new Date();

    await reconciliation.save();

    res.status(200).json({
      success: true,
      message: `Discrepancy marked as ${status}.`,
      data: { discrepancy: disc },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reconciliation/:id/finalize
 * Finalize reconciliation session.
 * Requires authorized reviewer (Auditor, Treasurer, Admin).
 * Locks the session as immutable and updates Fund lastReconciledAt.
 */
export async function finalizeReconciliation(req, res, next) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const reconciliation = await Reconciliation.findOne({ _id: id, society: req.societyId });
    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        message: 'Reconciliation session not found.',
        data: null,
        errors: ['Session not found'],
      });
    }

    if (reconciliation.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Reconciliation is already finalized and locked.',
        data: null,
        errors: ['Cannot re-finalize an already finalized session'],
      });
    }

    const diffPaise = reconciliation.statementClosingBalancePaise - reconciliation.bookClosingBalancePaise;
    const hasOpenDiscrepancies = reconciliation.discrepancies.some((d) => d.status === 'OPEN');

    if (diffPaise !== 0 && hasOpenDiscrepancies) {
      return res.status(400).json({
        success: false,
        message: 'Cannot finalize session with unresolved discrepancies and unexplained balance variance.',
        data: {
          differencePaise: diffPaise,
          differenceRupees: diffPaise / 100,
        },
        errors: ['Resolve open discrepancy items or provide formal audit resolution before finalization'],
      });
    }

    reconciliation.isFinalized = true;
    reconciliation.finalizedBy = req.user._id;
    reconciliation.reviewedBy = req.user._id;
    reconciliation.finalizedAt = new Date();
    reconciliation.reconciledAt = new Date();
    reconciliation.status = diffPaise === 0 ? 'RECONCILED' : 'DISCREPANCY_UNRESOLVED';
    if (notes) reconciliation.notes = notes.trim();

    await reconciliation.save();

    // Update Fund's lastReconciledAt timestamp
    await Fund.findByIdAndUpdate(reconciliation.fund, {
      lastReconciledAt: new Date(),
    });

    // Record Immutable Audit Log
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'FINALIZE_RECONCILIATION',
      entityType: 'RECONCILIATION',
      entityId: reconciliation._id,
      entityRef: `${reconciliation.accountName} (${reconciliation.status})`,
      details: `Reconciliation finalized by ${req.user.name} (${req.user.role}). Status: ${reconciliation.status}. Variance: ₹${diffPaise / 100}.`,
      severity: diffPaise === 0 ? 'INFO' : 'MEDIUM',
    });

    res.status(200).json({
      success: true,
      message: `Reconciliation session formally finalized as ${reconciliation.status}. Record is now locked against modification.`,
      data: {
        reconciliation,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
