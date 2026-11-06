const PUBLISHED_EVENT_STATUSES = new Set(['APPROVED', 'IN_PROGRESS', 'COMPLETED', 'SETTLED']);
const ACTUAL_SPENDING_STATUSES = new Set(['COMPLETED', 'SETTLED']);
const HIDDEN_FUND_STATUSES = new Set(['SUSPENDED', 'CLOSED']);

const STATUS_LABELS = {
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  SETTLED: 'Settled',
};

function fundingStatus(event) {
  return event?.fundingFundStatus || event?.fundingFund?.status || null;
}

/**
 * Keeps events the resident transparency API is allowed to publish.
 * Proposed, cancelled, and events funded by a suspended or closed fund are omitted
 * even if a response includes them.
 */
export function selectPublishedEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => {
    if (!event || !PUBLISHED_EVENT_STATUSES.has(event.status)) return false;
    return !HIDDEN_FUND_STATUSES.has(fundingStatus(event));
  });
}

export function eventShowsActualSpending(event) {
  return Boolean(event)
    && ACTUAL_SPENDING_STATUSES.has(event.status)
    && event.actualExpenditure != null
    && !HIDDEN_FUND_STATUSES.has(fundingStatus(event));
}

export function publishedEventStatusLabel(status) {
  return STATUS_LABELS[status] || null;
}
