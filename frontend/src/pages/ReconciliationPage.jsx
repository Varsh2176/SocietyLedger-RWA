import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { FormField } from '../components/common/FormField';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { USER_ROLES } from '../services/apiContract';
import { fundsService } from '../services/fundsService';
import { reconciliationService } from '../services/reconciliationService';
import { formatDate, formatINR } from '../utils/formatters';
import { getReconciliationBadgeVariant, getReconciliationDisplayStatus } from '../utils/reconciliationStatus';

function money(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return formatINR(Number(value));
}

function paiseToRupees(paise) {
  if (paise === undefined || paise === null || Number.isNaN(Number(paise))) return null;
  return Number(paise) / 100;
}

function recordedVariance(record) {
  if (record?.differenceAmountRupees != null) return record.differenceAmountRupees;
  if (record?.differenceAmount != null) return record.differenceAmount;
  if (record?.statementClosingBalancePaise == null || record?.bookClosingBalancePaise == null) return null;
  return (record.statementClosingBalancePaise - record.bookClosingBalancePaise) / 100;
}

function sessionId(record) {
  return record?.id || record?._id;
}

function rowId(row) {
  return row?._id || row?.id;
}

export function ReconciliationPage() {
  const { role } = useAuth();
  const { addToast } = useToast();
  const canPrepare = role === USER_ROLES.ADMIN || role === USER_ROLES.TREASURER;
  const [sessions, setSessions] = useState([]);
  const [funds, setFunds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({
    fundId: '',
    accountName: '',
    statementPeriodStart: '',
    statementPeriodEnd: '',
    statementOpeningBalance: '',
    statementClosingBalance: '',
    notes: '',
  });
  const [statementText, setStatementText] = useState('');
  const [matchChoice, setMatchChoice] = useState({});
  const [resolutionDrafts, setResolutionDrafts] = useState({});
  const [finalizeNotes, setFinalizeNotes] = useState('');

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const result = await reconciliationService.getReconciliations();
      if (!result.isLiveBackend) {
        throw new Error('Reconciliation sessions could not be loaded from the server.');
      }
      setSessions(result.reconciliations || []);
      if (canPrepare) {
        const fundResult = await fundsService.getFunds();
        setFunds(fundResult.isLiveBackend ? fundResult.funds || [] : []);
      }
    } catch (error) {
      setHasError(true);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [canPrepare]);

  const loadWorkspace = useCallback(async (id) => {
    setIsLoading(true);
    setHasError(false);
    try {
      const result = await reconciliationService.getReconciliationById(id);
      if (!result.isLiveBackend || !result.reconciliation) {
        throw new Error('This reconciliation session could not be loaded from the server.');
      }
      setWorkspace(result.reconciliation);
      setLedgerRows(result.availableLedgerTransactions || []);
      setSelectedId(id);
    } catch (error) {
      setHasError(true);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const reportError = (title, error) => {
    addToast({ title, message: error.message, type: 'error' });
  };

  const createSession = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const created = await reconciliationService.createReconciliation({
        fundId: draft.fundId,
        accountName: draft.accountName,
        statementPeriodStart: draft.statementPeriodStart,
        statementPeriodEnd: draft.statementPeriodEnd,
        statementOpeningBalance: draft.statementOpeningBalance === '' ? undefined : Number(draft.statementOpeningBalance),
        statementClosingBalance: Number(draft.statementClosingBalance),
        notes: draft.notes,
      });
      const id = sessionId(created);
      addToast({ title: 'Session created', message: 'The bank statement session is ready for import.', type: 'success' });
      setShowCreate(false);
      if (id) await loadWorkspace(id);
      else await loadSessions();
    } catch (error) {
      reportError('Session not created', error);
    } finally {
      setIsSaving(false);
    }
  };

  const importStatement = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await reconciliationService.importStatement(selectedId, { rawCsvText: statementText });
      setStatementText('');
      addToast({ title: 'Statement imported', message: 'Imported rows are shown from the saved session.', type: 'success' });
      await loadWorkspace(selectedId);
    } catch (error) {
      reportError('Statement not imported', error);
    } finally {
      setIsSaving(false);
    }
  };

  const matchRow = async (statementTxId) => {
    setIsSaving(true);
    try {
      await reconciliationService.matchTransaction(selectedId, statementTxId, matchChoice[statementTxId]);
      addToast({ title: 'Match recorded', message: 'The statement row is linked to the ledger voucher.', type: 'success' });
      await loadWorkspace(selectedId);
    } catch (error) {
      reportError('Match not recorded', error);
    } finally {
      setIsSaving(false);
    }
  };

  const unmatchRow = async (statementTxId) => {
    setIsSaving(true);
    try {
      await reconciliationService.unmatchTransaction(selectedId, statementTxId);
      addToast({ title: 'Match removed', message: 'The statement row is unmatched.', type: 'success' });
      await loadWorkspace(selectedId);
    } catch (error) {
      reportError('Match not removed', error);
    } finally {
      setIsSaving(false);
    }
  };

  const resolveItem = async (discrepancyId) => {
    const draftResolution = resolutionDrafts[discrepancyId] || {};
    setIsSaving(true);
    try {
      await reconciliationService.resolveDiscrepancy(selectedId, discrepancyId, {
        explanation: draftResolution.explanation,
        correctiveAction: draftResolution.correctiveAction,
        status: 'RESOLVED',
      });
      addToast({ title: 'Discrepancy resolved', message: 'The resolution was saved on this session.', type: 'success' });
      await loadWorkspace(selectedId);
    } catch (error) {
      reportError('Discrepancy not resolved', error);
    } finally {
      setIsSaving(false);
    }
  };

  const finalizeSession = async () => {
    setIsSaving(true);
    try {
      await reconciliationService.finalizeReconciliation(selectedId, finalizeNotes);
      addToast({ title: 'Session finalized', message: 'This reconciliation is locked against further changes.', type: 'success' });
      await loadWorkspace(selectedId);
    } catch (error) {
      reportError('Session not finalized', error);
    } finally {
      setIsSaving(false);
    }
  };

  const session = workspace;
  const locked = session?.isFinalized === true;
  const rows = session?.statementTransactions || [];
  const matched = rows.filter((row) => row.status === 'MATCHED');
  const unmatched = rows.filter((row) => row.status !== 'MATCHED');
  const discrepancies = session?.discrepancies || [];
  const variance = session ? recordedVariance(session) : null;
  const label = session ? getReconciliationDisplayStatus({
    displayStatus: session.displayStatus,
    isFinalized: session.isFinalized,
    differenceAmount: variance,
    openDiscrepanciesCount: discrepancies.filter((item) => item.status === 'OPEN').length,
    totalStatementRows: rows.length,
    matchedTransactionsCount: session.matchedTransactionsCount,
  }) : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <CreditCard size={22} /> Bank reconciliation
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Statement sessions for this society. Balances and periods come from the reconciliation record.
          </p>
        </div>
        <div className="flex gap-2">
          {selectedId && (
            <Button variant="outline" icon={ArrowLeft} onClick={() => { setSelectedId(null); setWorkspace(null); loadSessions(); }}>
              All sessions
            </Button>
          )}
          {canPrepare && !selectedId && (
            <Button onClick={() => setShowCreate((current) => !current)}>New session</Button>
          )}
        </div>
      </div>

      {isLoading && <LoadingState message="Loading reconciliation sessions..." />}
      {hasError && !isLoading && (
        <ErrorState title="Reconciliation unavailable" message={errorMessage} onRetry={selectedId ? () => loadWorkspace(selectedId) : loadSessions} />
      )}

      {!isLoading && !hasError && !selectedId && showCreate && canPrepare && (
        <form onSubmit={createSession} className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          <FormField label="Fund" htmlFor="rec-fund" required>
            <Select
              id="rec-fund"
              value={draft.fundId}
              onChange={(event) => setDraft({ ...draft, fundId: event.target.value })}
              placeholder="Select a fund"
              options={funds.map((fund) => ({ value: fund.id || fund._id, label: fund.name }))}
            />
          </FormField>
          <FormField label="Account name" htmlFor="rec-account" required>
            <Input id="rec-account" value={draft.accountName} onChange={(event) => setDraft({ ...draft, accountName: event.target.value })} />
          </FormField>
          <FormField label="Statement period start" htmlFor="rec-start" required>
            <Input id="rec-start" type="date" value={draft.statementPeriodStart} onChange={(event) => setDraft({ ...draft, statementPeriodStart: event.target.value })} />
          </FormField>
          <FormField label="Statement period end" htmlFor="rec-end" required>
            <Input id="rec-end" type="date" value={draft.statementPeriodEnd} onChange={(event) => setDraft({ ...draft, statementPeriodEnd: event.target.value })} />
          </FormField>
          <FormField label="Statement opening balance (₹)" htmlFor="rec-open">
            <Input id="rec-open" type="number" step="0.01" value={draft.statementOpeningBalance} onChange={(event) => setDraft({ ...draft, statementOpeningBalance: event.target.value })} />
          </FormField>
          <FormField label="Statement closing balance (₹)" htmlFor="rec-close" required>
            <Input id="rec-close" type="number" step="0.01" value={draft.statementClosingBalance} onChange={(event) => setDraft({ ...draft, statementClosingBalance: event.target.value })} />
          </FormField>
          <div className="md:col-span-2">
            <Button type="submit" isLoading={isSaving}>Create session</Button>
          </div>
        </form>
      )}

      {!isLoading && !hasError && !selectedId && (
        <div className="space-y-3">
          {sessions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No reconciliation sessions have been recorded for this society.
            </div>
          )}
          {sessions.map((item) => {
            const itemLabel = getReconciliationDisplayStatus(item);
            return (
              <button
                key={sessionId(item)}
                type="button"
                onClick={() => loadWorkspace(sessionId(item))}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-slate-300"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.accountName}</p>
                    <p className="text-xs text-slate-500">{item.fund} · {item.statementPeriod || 'Period not recorded'}</p>
                  </div>
                  <StatusBadge variant={getReconciliationBadgeVariant(itemLabel)} size="sm">{itemLabel}</StatusBadge>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <p>Statement closing: <strong>{money(item.statementClosingBalance)}</strong></p>
                  <p>Book closing: <strong>{money(item.bookClosingBalance)}</strong></p>
                  <p>Variance: <strong>{money(item.differenceAmount)}</strong></p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && !hasError && session && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{session.accountName}</h2>
                <p className="text-xs text-slate-500">
                  {formatDate(session.statementPeriodStart)} – {formatDate(session.statementPeriodEnd)}
                  {session.fund?.name ? ` · ${session.fund.name}` : ''}
                </p>
              </div>
              <StatusBadge variant={getReconciliationBadgeVariant(label)}>{label}</StatusBadge>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
              <p>Opening: <strong>{money(session.statementOpeningBalanceRupees ?? paiseToRupees(session.statementOpeningBalancePaise))}</strong></p>
              <p>Statement closing: <strong>{money(session.statementClosingBalanceRupees ?? paiseToRupees(session.statementClosingBalancePaise))}</strong></p>
              <p>Book closing: <strong>{money(session.bookClosingBalanceRupees ?? paiseToRupees(session.bookClosingBalancePaise))}</strong></p>
              <p>Variance: <strong>{money(variance)}</strong></p>
            </div>
            {locked && (
              <p className="mt-3 text-xs font-medium text-emerald-800">
                Finalized {session.finalizedAt ? formatDate(session.finalizedAt) : ''}. This session can no longer be changed.
              </p>
            )}
          </div>

          {canPrepare && !locked && (
            <form onSubmit={importStatement} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
              <FormField label="Bank statement CSV" htmlFor="rec-csv">
                <textarea
                  id="rec-csv"
                  value={statementText}
                  onChange={(event) => setStatementText(event.target.value)}
                  rows={5}
                  placeholder={'date,description,reference,debit,credit\n2026-10-15,Vendor payment,NEFT-100,18500,0'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                />
              </FormField>
              <Button type="submit" isLoading={isSaving}>Import statement</Button>
            </form>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Unmatched statement entries ({unmatched.length})</h3>
            <div className="mt-3 space-y-3">
              {unmatched.length === 0 && <p className="text-xs text-slate-500">No unmatched statement rows.</p>}
              {unmatched.map((row) => {
                const id = rowId(row);
                return (
                  <div key={id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_16rem_auto] md:items-center">
                    <div className="text-xs">
                      <p className="font-semibold text-slate-900">{row.description}</p>
                      <p className="text-slate-500">{formatDate(row.date)} · {row.reference || 'No reference'} · {row.type}</p>
                      <p className="font-mono">{money(paiseToRupees(row.amountPaise))}</p>
                    </div>
                    {!locked && (
                      <Select
                        value={matchChoice[id] || ''}
                        onChange={(event) => setMatchChoice({ ...matchChoice, [id]: event.target.value })}
                        placeholder="Ledger voucher"
                        options={ledgerRows.filter((tx) => !tx.isMatchedInThisSession).map((tx) => ({
                          value: tx.id || tx._id,
                          label: `${tx.reference} · ${money(tx.amount)}`,
                        }))}
                      />
                    )}
                    {!locked && (
                      <Button size="sm" onClick={() => matchRow(id)} isLoading={isSaving} disabled={!matchChoice[id]}>Match</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Matched statement entries ({matched.length})</h3>
            <div className="mt-3 space-y-2">
              {matched.length === 0 && <p className="text-xs text-slate-500">No matched statement rows.</p>}
              {matched.map((row) => {
                const id = rowId(row);
                const ledger = row.matchedTransaction;
                return (
                  <div key={id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs">
                      <p className="font-semibold text-slate-900">{row.description}</p>
                      <p className="text-slate-500">
                        {formatDate(row.date)} · {money(paiseToRupees(row.amountPaise))} · Ledger {ledger?.reference || 'linked'}
                      </p>
                    </div>
                    {!locked && <Button size="sm" variant="outline" onClick={() => unmatchRow(id)} isLoading={isSaving}>Unmatch</Button>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Discrepancies</h3>
            <div className="mt-3 space-y-3">
              {discrepancies.length === 0 && <p className="text-xs text-slate-500">No discrepancies have been recorded.</p>}
              {discrepancies.map((item) => {
                const id = rowId(item);
                return (
                  <div key={id} className="space-y-2 rounded-xl border border-slate-200 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <StatusBadge variant={item.status === 'OPEN' ? 'warning' : 'success'} size="sm">{item.status}</StatusBadge>
                    </div>
                    <p className="text-slate-600">{item.explanation || 'No explanation recorded.'}</p>
                    {item.amountPaise != null && <p className="font-mono">{money(paiseToRupees(item.amountPaise))}</p>}
                    {item.status === 'OPEN' && !locked && (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Input
                          placeholder="Explanation"
                          value={resolutionDrafts[id]?.explanation || ''}
                          onChange={(event) => setResolutionDrafts({
                            ...resolutionDrafts,
                            [id]: { ...resolutionDrafts[id], explanation: event.target.value },
                          })}
                        />
                        <Input
                          placeholder="Corrective action"
                          value={resolutionDrafts[id]?.correctiveAction || ''}
                          onChange={(event) => setResolutionDrafts({
                            ...resolutionDrafts,
                            [id]: { ...resolutionDrafts[id], correctiveAction: event.target.value },
                          })}
                        />
                        <Button size="sm" onClick={() => resolveItem(id)} isLoading={isSaving}>Resolve discrepancy</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {!locked && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
              <FormField label="Finalization notes" htmlFor="rec-notes">
                <Input id="rec-notes" value={finalizeNotes} onChange={(event) => setFinalizeNotes(event.target.value)} />
              </FormField>
              <Button variant="primary" onClick={finalizeSession} isLoading={isSaving}>Finalize session</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
