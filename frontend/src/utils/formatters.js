/**
 * SocietyLedger Formatting Utilities
 * Standardized INR currency, date, and status formatters.
 */

/**
 * Format numerical amounts into Indian Rupee (INR) representation.
 * Follows standard Indian numbering system (lakhs, crores).
 * Example: 147000 -> ₹ 1,47,000
 */
export function formatINR(amount, options = {}) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹ 0';
  }

  const { showPaise = false, showSymbol = true } = options;

  const num = Number(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  }).format(num);

  return showSymbol ? `₹ ${formatted}` : formatted;
}

/**
 * Parse paise to rupees
 */
export function paiseToRupees(paise) {
  if (!paise || isNaN(paise)) return 0;
  return Number(paise) / 100;
}

/**
 * Parse rupees to integer paise
 */
export function rupeesToPaise(rupees) {
  if (!rupees || isNaN(rupees)) return 0;
  return Math.round(Number(rupees) * 100);
}

/**
 * Format ISO or standard date string into Indian business date format
 * Example: '2026-10-24' -> '24 Oct 2026'
 */
export function formatDate(dateString, options = {}) {
  if (!dateString) return '—';

  const { includeTime = false } = options;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    if (includeTime) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day} ${month} ${year}, ${hours}:${minutes}`;
    }

    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Maps backend transaction status to human-readable label and StatusBadge variant
 */
export function getStatusConfig(status) {
  const normalized = (status || '').toLowerCase();

  switch (normalized) {
    case 'reconciled':
    case 'verified':
    case 'paid':
      return { variant: 'success', label: 'Reconciled / Paid' };
    case 'approved':
      return { variant: 'info', label: 'Approved' };
    case 'pending':
    case 'pending_approval':
      return { variant: 'warning', label: 'Pending Approval' };
    case 'rejected':
      return { variant: 'danger', label: 'Rejected' };
    case 'reversed':
      return { variant: 'neutral', label: 'Reversed' };
    default:
      return { variant: 'neutral', label: status || 'Unknown' };
  }
}

/**
 * Downloads tabular data as a clean CSV file
 */
export function downloadCSV(headers = [], rows = [], filename = 'society-ledger-report.csv') {
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map(escapeCSV).join(',');
  const dataRows = rows.map((row) => row.map(escapeCSV).join(','));
  const csvContent = [headerRow, ...dataRows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
