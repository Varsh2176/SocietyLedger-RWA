/**
 * SocietyLedger Integration Test Suite
 * Automated verification of financial safety, role permissions, formatters, and service contracts.
 */

import {
  USER_ROLES,
  ROUTE_PERMISSIONS,
  TRANSACTION_STATUS,
  APPROVAL_STATUS,
  COMPLIANCE_STATUS,
} from '../services/apiContract.js';

import {
  formatINR,
  formatDate,
  paiseToRupees,
  rupeesToPaise,
  getStatusConfig,
} from '../utils/formatters.js';

import { approvalsService } from '../services/approvalsService.js';
import { transactionsService } from '../services/transactionsService.js';
import { residentService } from '../services/residentService.js';
import { fundsService } from '../services/fundsService.js';
import { complianceService } from '../services/complianceService.js';
import { reconciliationService } from '../services/reconciliationService.js';
import { auditService } from '../services/auditService.js';
import { documentsService } from '../services/documentsService.js';
import { readSocietyIdentity } from '../utils/societyIdentity.js';
import { getReconciliationDisplayStatus } from '../utils/reconciliationStatus.js';
import { getApiErrorMessage } from '../services/api.js';
import {
  registrationFieldErrorsFromApi,
  validateRegistrationForm,
} from '../utils/registrationValidation.js';
import {
  accessDeniedPath,
  homePathForRole,
  isPathAllowedForRole,
  redirectForAuthenticatedPath,
  resolvePostAuthPath,
} from '../utils/landingPath.js';
import {
  markSessionCleared,
  markSessionEstablished,
  noteSessionRejected,
  shouldReportSessionExpiry,
  stampRequestEpoch,
  mockFallbackAllowed,
  readApiData,
} from '../services/api.js';
import {
  eventShowsActualSpending,
  selectPublishedEvents,
} from '../utils/publishedEvents.js';
import fs from 'fs';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✓ PASS: ${message}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger Phase 9: Integration Test Suite');
  console.log('======================================================\n');

  // Test 1: Role-Based Permissions Verification
  console.log('--- 1. Role-Based Permissions & Route Guards ---');
  assert(Object.values(USER_ROLES).length === 5, 'All 5 system roles are defined');
  assert(ROUTE_PERMISSIONS.DASHBOARD.includes(USER_ROLES.RESIDENT), 'Resident has access to Dashboard');
  assert(ROUTE_PERMISSIONS.RESIDENT_PORTAL.includes(USER_ROLES.RESIDENT), 'Resident opens the resident dashboard');
  assert(!ROUTE_PERMISSIONS.GOVERNANCE_DASHBOARD.includes(USER_ROLES.RESIDENT), 'Resident does not open a governance dashboard');
  assert(ROUTE_PERMISSIONS.GOVERNANCE_DASHBOARD.includes(USER_ROLES.TREASURER), 'Treasurer opens the governance dashboard');
  assert(!ROUTE_PERMISSIONS.SETTINGS.includes(USER_ROLES.RESIDENT), 'Resident is restricted from Settings');
  assert(!ROUTE_PERMISSIONS.APPROVALS.includes(USER_ROLES.RESIDENT), 'Resident is restricted from Approvals');
  assert(ROUTE_PERMISSIONS.APPROVALS.includes(USER_ROLES.TREASURER), 'Treasurer has access to Approvals');
  assert(ROUTE_PERMISSIONS.AUDIT.includes(USER_ROLES.AUDITOR), 'Auditor has access to Audit');
  assert(!ROUTE_PERMISSIONS.SETTINGS.includes(USER_ROLES.AUDITOR), 'Auditor is restricted from Settings');
  assert(ROUTE_PERMISSIONS.SETTINGS.includes(USER_ROLES.ADMIN), 'Society Administrator has access to Settings');

  // Test 2: Financial Formatters & Monetary Handling
  console.log('\n--- 2. Financial Formatters & INR Representation ---');
  assert(formatINR(147000) === '₹ 1,47,000', 'Standard INR formatting handles lakhs correctly');
  assert(formatINR(2840000) === '₹ 28,40,000', 'Standard INR formatting handles multi-lakh reserves');
  assert(formatINR(0) === '₹ 0', 'Zero amount returns ₹ 0');
  assert(formatINR(null) === '₹ 0', 'Null amount returns ₹ 0 safely');
  assert(paiseToRupees(1850000) === 18500, 'Paise correctly converted to Rupees');
  assert(rupeesToPaise(18500) === 1850000, 'Rupees correctly converted to integer Paise');

  // Test 3: Date Parsing
  console.log('\n--- 3. Date Formatting ---');
  assert(formatDate('2026-10-24') === '24 Oct 2026', 'ISO date correctly formatted to Indian business date');
  assert(formatDate(null) === '—', 'Null date safely renders dash');

  // Test 4: Financial Status Enums
  console.log('\n--- 4. Financial & Audit Status Enums ---');
  assert(getStatusConfig('RECONCILED').variant === 'success', 'Reconciled status maps to success badge');
  assert(getStatusConfig('APPROVED').variant === 'info', 'Approved status maps to info badge');
  assert(getStatusConfig('PENDING').variant === 'warning', 'Pending status maps to warning badge');
  assert(getStatusConfig('REJECTED').variant === 'danger', 'Rejected status maps to danger badge');
  assert(getStatusConfig('REVERSED').variant === 'neutral', 'Reversed status maps to neutral badge');

  // Test 5: Separation-of-Duties Enforcement in Expense Approvals
  console.log('\n--- 5. Separation-of-Duties Workflow Policy ---');
  let selfApprovalBlocked = false;
  try {
    // Attempt self-approval where requester email matches current user email
    await approvalsService.decideApproval('appr_002', {
      action: APPROVAL_STATUS.APPROVED,
      comments: 'Self-approval attempt',
      user: { email: 'sunil@society.org', name: 'Sunil Rao' }, // Matches requesterEmail in appr_002
    });
  } catch (err) {
    if (err.message.includes('Separation-of-Duties Violation')) {
      selfApprovalBlocked = true;
    }
  }
  assert(selfApprovalBlocked, 'Requesters are strictly prohibited from self-approving their own expense requests');

  // Test 6: Financial Safety - Reversal Justification Requirement
  console.log('\n--- 6. Financial Safety: Audited Reversals ---');
  let emptyReversalBlocked = false;
  try {
    await transactionsService.reverseTransaction('tx_001', '   ');
  } catch (err) {
    if (err.message.includes('Mandatory reversal justification required')) {
      emptyReversalBlocked = true;
    }
  }
  assert(emptyReversalBlocked, 'Executing a transaction reversal without justification is blocked');

  // Test 7: Resident Privacy & Redaction Standards
  console.log('\n--- 7. Resident Privacy & Transparency Feed ---');
  const transparency = await residentService.getTransparencyData();
  assert(transparency.data.publishedFunds.length > 0, 'Published fund balances retrieved');
  transparency.data.publishedFunds.forEach((f) => {
    // Ensure no raw 16-digit account numbers are exposed
    assert(!/\d{10,18}/.test(f.bankName), `Bank account in ${f.name} is masked/sanitized for resident view`);
  });

  // Test 8: Funds Listing & Searching
  console.log('\n--- 8. Funds Service Search ---');
  const fundsRes = await fundsService.getFunds({ search: 'Corpus' });
  assert(fundsRes.funds.length > 0, 'Fund search returns matching records');
  assert(fundsRes.funds[0].code === 'FND-CORPUS', 'Corpus fund correctly indexed');

  // Test 9: Tax Compliance & Statutory Tracker Service
  console.log('\n--- 9. Tax Compliance & Statutory Tracker Service ---');
  assert(ROUTE_PERMISSIONS.COMPLIANCE.includes(USER_ROLES.ADMIN), 'Admin has access to Compliance');
  assert(ROUTE_PERMISSIONS.COMPLIANCE.includes(USER_ROLES.TREASURER), 'Treasurer has access to Compliance');
  assert(ROUTE_PERMISSIONS.COMPLIANCE.includes(USER_ROLES.AUDITOR), 'Auditor has access to Compliance');
  assert(!ROUTE_PERMISSIONS.COMPLIANCE.includes(USER_ROLES.RESIDENT), 'Resident is restricted from Compliance management');

  const compDashboard = await complianceService.getDashboard();
  assert(compDashboard.data.disclaimer.includes('administrative and governance'), 'Compliance dashboard provides legal disclaimer banner');
  assert(typeof compDashboard.data.summary.totalTasks === 'number', 'Summary returns numerical total task metric');

  const compTasks = await complianceService.getTasks();
  assert(compTasks.tasks.length > 0, 'Compliance task list retrieved');
  assert(compTasks.tasks.some((t) => t.status === 'FILED'), 'Contains filed compliance task');

  // Test 10: Bank Reconciliation, Audit Trail & Document Services
  console.log('\n--- 10. Reconciliation, Audit & Document Repository Services ---');
  const recRes = await reconciliationService.getReconciliations();
  assert(recRes.reconciliations.length > 0, 'Reconciliation sessions retrieved');
  assert(recRes.reconciliations.some((r) => r.status === 'RECONCILED'), 'Contains reconciled session');

  const auditRes = await auditService.getAuditLogs();
  assert(auditRes.logs.length > 0, 'Audit log stream retrieved');
  assert(auditRes.logs.some((l) => l.action === 'APPROVE_EXPENSE' || l.action === 'CREATE_VOUCHER'), 'Contains financial action log');

  const obsRes = await auditService.getObservations();
  assert(obsRes.observations.length > 0, 'Audit observations list retrieved');

  const docsRes = await documentsService.getDocuments();
  assert(docsRes.documents.length > 0, 'Document repository list retrieved');

  console.log('\n--- 11. Society Identity, Reconciliation Status & API Errors ---');
  const north = readSocietyIdentity({
    society: { name: 'North Court RWA', registrationNumber: 'REG-NORTH' },
  });
  const south = readSocietyIdentity({
    society: { name: 'South Court RWA', registrationNumber: 'REG-SOUTH' },
  });
  assert(north.name === 'North Court RWA', 'Society name is read from the authenticated society');
  assert(north.registrationNumber === 'REG-NORTH', 'Registration number is read from the authenticated society');
  assert(south.name === 'South Court RWA' && south.registrationNumber === 'REG-SOUTH', 'A second society keeps its own identity');
  assert(north.name !== south.name, 'Society identities are not interchangeable');

  const missingSociety = readSocietyIdentity({ society: null });
  const idOnly = readSocietyIdentity({ society: '6ae226b9bf65c0cccce713bc' });
  const missingRegistration = readSocietyIdentity({
    society: { name: 'North Court RWA', registrationNumber: null },
  });
  assert(missingSociety.label === 'Society details unavailable', 'Missing society metadata does not invent a name');
  assert(idOnly.name === null && idOnly.registrationNumber === null, 'A bare society id is not treated as profile data');
  assert(missingRegistration.registrationNumber === null, 'A blank registration number stays blank');
  assert(!missingSociety.label.includes('Greenwood'), 'Missing metadata does not fall back to another society');
  assert(!idOnly.label.includes('REG-NORTH'), 'An unresolved society does not show another registration number');

  const pendingMatch = getReconciliationDisplayStatus({
    differenceAmount: 0,
    isFinalized: false,
    openDiscrepanciesCount: 0,
    totalStatementRows: 0,
    matchedCount: 0,
  });
  const finalizedMatch = getReconciliationDisplayStatus({
    differenceAmount: 0,
    isFinalized: true,
    displayStatus: 'Reconciled & Matched',
  });
  assert(
    pendingMatch === 'Matched — Pending Finalization',
    'Zero-variance session is pending finalization before it is locked'
  );
  assert(pendingMatch !== 'Reconciled & Matched', 'Zero variance alone is not a reconciled status');
  assert(
    finalizedMatch === 'Reconciled & Matched',
    'Reconciled status is shown after the backend confirms finalization'
  );

  const lockedError = {
    message: 'Request failed with status code 400',
    response: {
      status: 400,
      data: {
        success: false,
        message: 'Reconciliation is already finalized and locked.',
        errors: ['Cannot re-finalize an already finalized session'],
      },
    },
  };
  const displayedError = getApiErrorMessage(lockedError);
  assert(
    displayedError === 'Reconciliation is already finalized and locked.',
    'API error toast uses the server lock message'
  );
  assert(
    !displayedError.includes('Request failed with status code'),
    'Generic Axios status text is not shown when the server sent a message'
  );
  const networkError = getApiErrorMessage({ message: 'Network Error', code: 'ERR_NETWORK' });
  assert(networkError.includes('Cannot reach the server'), 'Network failures get a connection fallback');
  const leakedError = getApiErrorMessage({
    message: 'Request failed with status code 500',
    response: {
      status: 500,
      data: { message: 'secret token eyJabc.def at Function (C:\\src\\app.js:1:1)' },
    },
  });
  assert(!leakedError.includes('secret'), 'Unsafe server text is not shown to the user');
  assert(!leakedError.includes('eyJabc'), 'Token-like text is not shown to the user');

  console.log('\n--- 12. Registration Validation ---');
  const emptyRegistration = validateRegistrationForm({});
  assert(emptyRegistration.name === 'Full name is required.', 'Registration requires a name');
  assert(emptyRegistration.email === 'Email address is required.', 'Registration requires an email');
  assert(emptyRegistration.password === 'Password is required.', 'Registration requires a password');
  assert(emptyRegistration.phone.includes('Phone number is required'), 'Registration requires a phone number');
  assert(
    emptyRegistration.apartmentNumber.includes('Apartment/Flat unit number is required'),
    'Registration requires an apartment number'
  );
  assert(
    emptyRegistration.societyCode === 'Society invitation code is required.',
    'Registration requires a society invitation code'
  );
  const completeRegistration = validateRegistrationForm({
    name: 'Ramesh Kumar',
    email: 'ramesh@example.com',
    phone: '9876543210',
    apartmentNumber: 'A-402',
    societyCode: 'GW-2021',
    password: 'Password@123',
    confirmPassword: 'Password@123',
  });
  assert(Object.keys(completeRegistration).length === 0, 'A complete registration form has no client errors');
  const apiFieldErrors = registrationFieldErrorsFromApi([
    { field: 'societyCode', message: 'Invalid society invitation code. Please verify with your RWA administration.' },
  ]);
  assert(
    apiFieldErrors.societyCode.includes('Invalid society invitation code'),
    'An invalid invitation code is shown on the invitation field'
  );

  console.log('\n--- 13. Client Role Switching ---');
  const dashboardSource = fs.readFileSync(new URL('../pages/DashboardPage.jsx', import.meta.url), 'utf8');
  const authSource = fs.readFileSync(new URL('../context/AuthContext.jsx', import.meta.url), 'utf8');
  assert(!dashboardSource.includes('Preview UI as Role'), 'The dashboard does not offer a role preview control');
  assert(!dashboardSource.includes('_setDevUser'), 'The dashboard cannot replace the authenticated role');
  assert(!authSource.includes('_setDevUser'), 'Session context does not expose a client role override');

  console.log('\n--- 14. Administrator Settings ---');
  const settingsSource = fs.readFileSync(new URL('../pages/SettingsPage.jsx', import.meta.url), 'utf8');
  const adminRouteSource = fs.readFileSync(new URL('../../../backend/src/routes/adminRoutes.js', import.meta.url), 'utf8');
  assert(!settingsSource.includes('PlaceholderView'), 'Settings is an administrator screen rather than a placeholder');
  assert(settingsSource.includes('Rotate invitation code'), 'Settings can rotate the society invitation code');
  assert(settingsSource.includes('Deactivate account'), 'Settings can deactivate a resident account');
  assert(adminRouteSource.includes("requireRoles('Society Administrator')"), 'Administrator routes require the Society Administrator role');
  assert(!ROUTE_PERMISSIONS.SETTINGS.includes(USER_ROLES.TREASURER), 'Treasurer is restricted from Settings');
  assert(!ROUTE_PERMISSIONS.SETTINGS.includes(USER_ROLES.COMMITTEE_MEMBER), 'Committee Member is restricted from Settings');

  console.log('\n--- 15. Reconciliation Access ---');
  assert(ROUTE_PERMISSIONS.RECONCILIATION.includes(USER_ROLES.ADMIN), 'Society Administrator can open reconciliation');
  assert(ROUTE_PERMISSIONS.RECONCILIATION.includes(USER_ROLES.TREASURER), 'Treasurer can open reconciliation');
  assert(ROUTE_PERMISSIONS.RECONCILIATION.includes(USER_ROLES.AUDITOR), 'Auditor can open reconciliation');
  assert(!ROUTE_PERMISSIONS.RECONCILIATION.includes(USER_ROLES.COMMITTEE_MEMBER), 'Committee Member cannot open reconciliation');
  assert(!ROUTE_PERMISSIONS.RECONCILIATION.includes(USER_ROLES.RESIDENT), 'Resident cannot open reconciliation');
  assert(!ROUTE_PERMISSIONS.AUDIT.includes(USER_ROLES.TREASURER), 'Treasurer remains restricted from the Audit page');
  const auditPageSource = fs.readFileSync(new URL('../pages/AuditLogsPage.jsx', import.meta.url), 'utf8');
  const reconciliationPageSource = fs.readFileSync(new URL('../pages/ReconciliationPage.jsx', import.meta.url), 'utf8');
  assert(!auditPageSource.includes('Bank Statement Reconciliation'), 'The Audit page no longer hosts the reconciliation workspace');
  assert(reconciliationPageSource.includes('Import statement'), 'The reconciliation page can import a bank statement');
  assert(reconciliationPageSource.includes('Finalize session'), 'The reconciliation page can finalize a session');

  console.log('\n--- 16. Role-Based Login Landing ---');
  const rolesAndHomes = [
    [USER_ROLES.RESIDENT, '/resident-portal'],
    [USER_ROLES.ADMIN, '/'],
    [USER_ROLES.TREASURER, '/'],
    [USER_ROLES.AUDITOR, '/'],
    [USER_ROLES.COMMITTEE_MEMBER, '/'],
  ];
  for (const [roleName, home] of rolesAndHomes) {
    assert(homePathForRole(roleName) === home, `${roleName} lands on ${home} when no page was requested`);
    assert(resolvePostAuthPath(roleName) === home, `${roleName} session restoration without a target uses that home`);
  }
  assert(
    resolvePostAuthPath(USER_ROLES.RESIDENT, '/reports') === '/reports',
    'A resident returns to an authorized report page after login'
  );
  assert(
    resolvePostAuthPath(USER_ROLES.RESIDENT, '/settings') === '/resident-portal',
    'A resident is not sent to Settings after login'
  );
  assert(
    resolvePostAuthPath(USER_ROLES.RESIDENT, '/audit') === '/resident-portal',
    'A resident is not sent to Audit after login'
  );
  assert(
    resolvePostAuthPath(USER_ROLES.TREASURER, '/reconciliation') === '/reconciliation',
    'A treasurer returns to reconciliation when that was the requested page'
  );
  assert(
    resolvePostAuthPath(USER_ROLES.TREASURER, '/audit') === '/',
    'A treasurer is not sent to the Audit page after login'
  );
  assert(
    resolvePostAuthPath(USER_ROLES.AUDITOR, '/audit') === '/audit',
    'An auditor returns to an authorized audit page'
  );
  assert(
    resolvePostAuthPath(USER_ROLES.COMMITTEE_MEMBER, '/approvals') === '/approvals',
    'A committee member returns to an authorized approvals page'
  );
  assert(
    resolvePostAuthPath(USER_ROLES.ADMIN, '/settings') === '/settings',
    'An administrator returns to Settings when that was requested'
  );
  assert(resolvePostAuthPath(USER_ROLES.RESIDENT, '/reports') === '/reports', 'Refreshing an authorized resident page stays there');
  assert(accessDeniedPath(USER_ROLES.RESIDENT) === '/resident-portal', 'A resident who opens a restricted route returns to the portal');
  assert(accessDeniedPath(USER_ROLES.TREASURER) === '/unauthorized', 'Other roles still see the unauthorized page');
  assert(!isPathAllowedForRole('https://evil.example/reports', USER_ROLES.RESIDENT), 'An external address is not a login destination');
  assert(!isPathAllowedForRole('//evil.example', USER_ROLES.ADMIN), 'A protocol-relative address is not a login destination');
  assert(!isPathAllowedForRole('/login', USER_ROLES.RESIDENT), 'Login does not redirect back to the login page');
  const loginSource = fs.readFileSync(new URL('../pages/auth/LoginPage.jsx', import.meta.url), 'utf8');
  const registerSource = fs.readFileSync(new URL('../pages/auth/RegisterPage.jsx', import.meta.url), 'utf8');
  const protectedSource = fs.readFileSync(new URL('../components/auth/ProtectedRoute.jsx', import.meta.url), 'utf8');
  assert(loginSource.includes('result.user?.role'), 'Login uses the role returned by the backend');
  assert(registerSource.includes('result.user?.role'), 'Registration uses the role returned by the backend');
  assert(protectedSource.includes("to=\"/login\""), 'An unauthenticated visit is sent to login');
  assert(!loginSource.includes('_setDevUser'), 'Login does not switch roles in the browser');

  console.log('\n--- 17. Published Data and Session Landing ---');
  assert(
    redirectForAuthenticatedPath(USER_ROLES.RESIDENT, '/unauthorized') === '/resident-portal',
    'A resident who opens the unauthorized page returns to the portal'
  );
  assert(
    redirectForAuthenticatedPath(USER_ROLES.TREASURER, '/unauthorized') === null,
    'A treasurer remains on the unauthorized page'
  );
  assert(
    redirectForAuthenticatedPath(USER_ROLES.ADMIN, '/unauthorized') === null,
    'An administrator remains on the unauthorized page'
  );
  assert(
    redirectForAuthenticatedPath(USER_ROLES.AUDITOR, '/unauthorized') === null,
    'An auditor remains on the unauthorized page'
  );
  assert(
    redirectForAuthenticatedPath(USER_ROLES.COMMITTEE_MEMBER, '/unauthorized') === null,
    'A committee member remains on the unauthorized page'
  );
  assert(
    redirectForAuthenticatedPath(USER_ROLES.RESIDENT, '/resident-portal') === null,
    'The resident portal does not redirect again'
  );
  const unauthorizedSource = fs.readFileSync(new URL('../pages/UnauthorizedPage.jsx', import.meta.url), 'utf8');
  assert(unauthorizedSource.includes('redirectForAuthenticatedPath'), 'The unauthorized page uses the resident redirect');
  markSessionCleared();
  const signedOutEpoch = stampRequestEpoch();
  assert(!shouldReportSessionExpiry(signedOutEpoch), 'A signed-out request does not open the sign-in dialog');
  markSessionEstablished();
  const beforeRegistration = stampRequestEpoch();
  markSessionEstablished();
  assert(
    !shouldReportSessionExpiry(beforeRegistration),
    'A request sent before registration does not open the sign-in dialog'
  );
  const activeEpoch = stampRequestEpoch();
  assert(shouldReportSessionExpiry(activeEpoch), 'The authenticated session can still expire');
  assert(noteSessionRejected(), 'Session expiry is reported for the active session');
  assert(!noteSessionRejected(), 'The same expired session does not open the sign-in dialog again');
  const registerSourceBlock = authSource.slice(authSource.indexOf('const register'), authSource.indexOf('const logout'));
  assert(registerSourceBlock.includes('if (result.user)'), 'Registration checks that the backend returned a user');
  assert(registerSourceBlock.includes('markSessionEstablished()'), 'Successful registration establishes the session');
  assert(registerSourceBlock.includes('setSessionExpired(false)'), 'Successful registration closes the sign-in dialog');
  const authServiceSource = fs.readFileSync(new URL('../services/authService.js', import.meta.url), 'utf8');
  assert(
    authServiceSource.includes('You are signed in, and resident verification is still pending.'),
    'The registration message reports a signed-in session with verification still pending'
  );
  assert(
    !authServiceSource.includes('Account awaiting verification.'),
    'The registration message does not hide the signed-in session'
  );
  markSessionCleared();

  console.log('\n--- 18. Published Events and Reporting Labels ---');
  const published = selectPublishedEvents([
    { id: 'proposed', status: 'PROPOSED', title: 'Proposed fair', approvedBudget: 100, actualExpenditure: 10 },
    { id: 'approved', status: 'APPROVED', title: 'Approved meet', approvedBudget: 1000, actualExpenditure: 400 },
    { id: 'progress', status: 'IN_PROGRESS', title: 'Progress drive', approvedBudget: 2000, actualExpenditure: 800 },
    { id: 'completed', status: 'COMPLETED', title: 'Completed drive', approvedBudget: 3000, actualExpenditure: 2500 },
    { id: 'settled', status: 'SETTLED', title: 'Settled drive', approvedBudget: 4000, actualExpenditure: 3500 },
    { id: 'cancelled', status: 'CANCELLED', title: 'Cancelled drive', approvedBudget: 1500, actualExpenditure: 100 },
    { id: 'suspended', status: 'APPROVED', title: 'Suspended fund event', approvedBudget: 1750, actualExpenditure: 999, fundingFundStatus: 'SUSPENDED' },
    { id: 'closed', status: 'COMPLETED', title: 'Closed fund event', approvedBudget: 1800, actualExpenditure: 900, fundingFund: { status: 'CLOSED' } },
  ]);
  const publishedIds = published.map((event) => event.id);
  assert(!publishedIds.includes('proposed'), 'A proposed event is omitted from the resident portal');
  assert(!publishedIds.includes('cancelled'), 'A cancelled event is omitted from the resident portal');
  assert(!publishedIds.includes('suspended'), 'An event funded by a suspended fund is omitted');
  assert(!publishedIds.includes('closed'), 'An event funded by a closed fund is omitted');
  assert(publishedIds.includes('approved'), 'An approved event stays visible');
  assert(publishedIds.includes('progress'), 'An in-progress event stays visible');
  assert(publishedIds.includes('completed'), 'A completed event stays visible');
  assert(publishedIds.includes('settled'), 'A settled event stays visible');
  const byId = Object.fromEntries(published.map((event) => [event.id, event]));
  assert(byId.approved.approvedBudget === 1000, 'An approved event keeps its approved budget');
  assert(!eventShowsActualSpending(byId.approved), 'An approved event hides actual spending');
  assert(!eventShowsActualSpending(byId.progress), 'An in-progress event hides actual spending');
  assert(eventShowsActualSpending(byId.completed), 'A completed event shows actual spending');
  assert(eventShowsActualSpending(byId.settled), 'A settled event shows actual spending');
  assert(selectPublishedEvents([]).length === 0, 'An empty event list stays empty');
  assert(selectPublishedEvents(null).length === 0, 'A missing event list stays empty');

  const portalSource = fs.readFileSync(new URL('../pages/ResidentPortalPage.jsx', import.meta.url), 'utf8');
  assert(portalSource.includes('residentService.getTransparencyData()'), 'The portal loads the transparency response');
  assert(!portalSource.includes('eventsService'), 'The portal does not call a second events API');
  assert(portalSource.includes('selectPublishedEvents(transparencyData.publishedEvents)'), 'Published events come from the transparency response');
  assert(portalSource.includes('eventShowsActualSpending(event)'), 'Actual spending follows the published event rule');
  assert(portalSource.includes('No published events'), 'The portal has an empty event state');
  assert(portalSource.includes('Could not load resident portal'), 'The portal has an error state');
  assert(portalSource.includes('Connecting to resident transparency repository'), 'The portal has a loading state');
  assert(!portalSource.includes('FY 2026-27'), 'The portal does not hardcode a fiscal year');

  const dashboardPageSource = [
    '../pages/DashboardPage.jsx',
    '../pages/dashboards/dashboardShared.jsx',
    '../pages/dashboards/FinancialCharts.jsx',
    '../pages/dashboards/AdminDashboard.jsx',
    '../pages/dashboards/TreasurerDashboard.jsx',
    '../pages/dashboards/CommitteeDashboard.jsx',
    '../pages/dashboards/AuditorDashboard.jsx',
  ].map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
  assert(!dashboardPageSource.includes('Total Income (Month)'), 'Dashboard income is not labeled as a month for every period');
  assert(!dashboardPageSource.includes('Verified Month Expenses'), 'Dashboard expenses are not labeled as a month for every period');
  assert(dashboardPageSource.includes('reportingPeriodShort'), 'Dashboard labels use the selected reporting period');
  assert(dashboardPageSource.includes('fundBalanceDescription'), 'Dashboard fund cards use the fund-visibility description');
  assert(dashboardPageSource.includes('incomeExpenseDescription'), 'Dashboard income and expense cards use the posted-voucher description');

  const reportsSource = fs.readFileSync(new URL('../pages/ReportsPage.jsx', import.meta.url), 'utf8');
  assert(reportsSource.includes('value="current_month"'), 'Reports can request the current month');
  assert(reportsSource.includes('value="last_quarter"'), 'Reports can request the previous quarter');
  assert(reportsSource.includes('value="financial_year"'), 'Reports can request the financial year');
  assert(reportsSource.includes('Financial year to date'), 'The financial-year option describes the year to date');
  assert(!reportsSource.includes('FY 2026-27'), 'Reports do not hardcode a fiscal year');
  assert(!reportsSource.includes('October 2026'), 'Reports do not hardcode a calendar month');
  assert(!reportsSource.includes('q2_fy26'), 'Reports do not offer an unsupported quarter value');
  const reportsServiceSource = fs.readFileSync(new URL('../services/reportsService.js', import.meta.url), 'utf8');
  assert(!reportsServiceSource.includes('FY 2026-27'), 'Report fallbacks do not hardcode a fiscal year');
  assert(dashboardPageSource.includes('chartRangeDescription'), 'Dashboard charts are described separately from the summary period');
  assert(dashboardPageSource.includes('Not the selected summary period'), 'Chart captions say they are not the selected summary period');
  assert(mockFallbackAllowed(undefined) === true, 'The Node test runner can use sample data');
  assert(mockFallbackAllowed({ PROD: true }) === false, 'Production does not present sample financial data');
  assert(
    mockFallbackAllowed({ PROD: true, VITE_ENABLE_MOCK_FALLBACK: 'true' }) === false,
    'Production ignores an explicit demo flag'
  );
  assert(mockFallbackAllowed({ DEV: true }) === false, 'Development does not present sample figures by default');
  assert(
    mockFallbackAllowed({ DEV: true, VITE_ENABLE_MOCK_FALLBACK: 'true' }) === true,
    'Sample data requires an explicit demo flag'
  );
  let missingPayload = false;
  try {
    readApiData({ data: { success: true, data: null } });
  } catch {
    missingPayload = true;
  }
  assert(missingPayload, 'A missing financial payload is treated as unavailable');
  assert(readApiData({ data: { data: { funds: [] } } }).funds.length === 0, 'An empty list remains a successful response');
  assert(
    readApiData({ data: { data: { totalAvailableFunds: 0 } } }).totalAvailableFunds === 0,
    'A zero balance remains a successful response'
  );
  const fundsSource = fs.readFileSync(new URL('../services/fundsService.js', import.meta.url), 'utf8');
  assert(!fundsSource.includes("fiscalYear: data.fiscalYear || 'FY 2026-27'"), 'New funds are not labeled with a fixed fiscal year in the client');
  const createFundSource = fundsSource.slice(fundsSource.indexOf('async createFund'));
  assert(!createFundSource.includes('fiscalYear'), 'Fund creation does not send a fiscal year');
  assert(dashboardPageSource.includes('Sample data — not society records'), 'Sample dashboard data is labeled as sample data');
  assert(portalSource.includes('Sample data — not society records'), 'Sample resident data is labeled as sample data');
  assert(portalSource.includes('Could not load resident portal'), 'An API failure shows the resident error state');
  assert(portalSource.includes('Resident Dashboard'), 'The resident portal is the resident dashboard');

  console.log('\n--- 19. Dedicated Role Dashboards ---');
  const sidebarSource = fs.readFileSync(new URL('../components/layout/Sidebar.jsx', import.meta.url), 'utf8');
  assert(sidebarSource.includes('homePathForRole(role)'), 'Dashboard navigation follows the signed-in role');
  assert(sidebarSource.includes('end={exact}'), 'Dashboard highlighting matches the current page');
  assert(sidebarSource.includes("name: 'Dashboard'"), 'Every role keeps a Dashboard navigation item');
  assert(!isPathAllowedForRole('/', USER_ROLES.RESIDENT), 'A resident cannot open the governance dashboard');
  assert(resolvePostAuthPath(USER_ROLES.RESIDENT, '/') === '/resident-portal', 'Login does not leave a resident on the governance dashboard');
  assert(resolvePostAuthPath(USER_ROLES.RESIDENT, '/dashboard') === '/resident-portal', 'A resident refresh of /dashboard returns to the portal');
  assert(isPathAllowedForRole('/resident-portal', USER_ROLES.RESIDENT), 'A resident can refresh the resident dashboard');
  for (const governanceRole of [USER_ROLES.ADMIN, USER_ROLES.TREASURER, USER_ROLES.COMMITTEE_MEMBER, USER_ROLES.AUDITOR]) {
    assert(isPathAllowedForRole('/', governanceRole), `${governanceRole} can open the governance dashboard`);
    assert(resolvePostAuthPath(governanceRole, '/') === '/', `${governanceRole} login stays on that role's dashboard`);
    assert(!isPathAllowedForRole('/resident-portal', governanceRole), `${governanceRole} cannot open the resident dashboard by URL`);
    assert(resolvePostAuthPath(governanceRole, '/resident-portal') === '/', `${governanceRole} is not sent to the resident dashboard`);
  }
  const treasurerDash = fs.readFileSync(new URL('../pages/dashboards/TreasurerDashboard.jsx', import.meta.url), 'utf8');
  const committeeDash = fs.readFileSync(new URL('../pages/dashboards/CommitteeDashboard.jsx', import.meta.url), 'utf8');
  const auditorDash = fs.readFileSync(new URL('../pages/dashboards/AuditorDashboard.jsx', import.meta.url), 'utf8');
  const adminDash = fs.readFileSync(new URL('../pages/dashboards/AdminDashboard.jsx', import.meta.url), 'utf8');
  assert(adminDash.includes('Society Administrator Dashboard'), 'The administrator dashboard is labeled');
  assert(adminDash.includes('adminService'), 'The administrator dashboard reads the member directory');
  assert(treasurerDash.includes('Treasurer Dashboard'), 'The treasurer dashboard is labeled');
  assert(!treasurerDash.includes('/settings'), 'The treasurer dashboard does not link to settings');
  assert(!treasurerDash.includes('/audit'), 'The treasurer dashboard does not link to audit logs');
  assert(!treasurerDash.includes('auditService'), 'The treasurer dashboard does not request audit logs');
  assert(committeeDash.includes('Committee Dashboard'), 'The committee dashboard is labeled');
  assert(!committeeDash.includes('/reconciliation'), 'The committee dashboard does not link to reconciliation');
  assert(!committeeDash.includes('/settings'), 'The committee dashboard does not link to settings');
  assert(!committeeDash.includes('reconciliationService'), 'The committee dashboard does not request reconciliation');
  assert(auditorDash.includes('Auditor Dashboard'), 'The auditor dashboard is labeled');
  assert(!auditorDash.includes('/settings'), 'The auditor dashboard does not link to settings');
  assert(!auditorDash.includes('/approvals'), 'The auditor dashboard does not link to approval decisions');
  assert(!auditorDash.includes('approvalsService'), 'The auditor dashboard does not request approval decisions');
  assert(dashboardPageSource.includes('Loading the administrator dashboard'), 'The administrator dashboard has a loading state');
  assert(dashboardPageSource.includes('Loading the treasurer dashboard'), 'The treasurer dashboard has a loading state');
  assert(dashboardPageSource.includes('Loading the committee dashboard'), 'The committee dashboard has a loading state');
  assert(dashboardPageSource.includes('Loading the auditor dashboard'), 'The auditor dashboard has a loading state');
  assert(dashboardPageSource.includes('Could not load the administrator dashboard'), 'The administrator dashboard has an error state');
  assert(dashboardPageSource.includes('No pending approvals'), 'Approval sections have an empty state');
  assert(dashboardPageSource.includes('No open audit observations'), 'Observation sections have an empty state');
  assert(dashboardPageSource.includes('No reconciliation sessions'), 'Reconciliation sections have an empty state');
  assert(dashboardPageSource.includes('No pending event proposals'), 'The committee dashboard has an empty proposal state');
  assert(!dashboardPageSource.includes('_setDevUser'), 'Role dashboards do not switch roles in the browser');

  console.log('\n======================================================');
  console.log(`   Verification Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Integration Test Suite Encountered Critical Failure:', err);
  process.exit(1);
});
