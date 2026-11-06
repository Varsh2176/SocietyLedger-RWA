import { USER_ROLES, ROUTE_PERMISSIONS } from '../services/apiContract.js';

const ROLE_HOME = {
  [USER_ROLES.RESIDENT]: '/resident-portal',
  [USER_ROLES.ADMIN]: '/',
  [USER_ROLES.TREASURER]: '/',
  [USER_ROLES.AUDITOR]: '/',
  [USER_ROLES.COMMITTEE_MEMBER]: '/',
};

const PATH_RULES = [
  { match: (path) => path === '/' || path === '/dashboard', roles: ROUTE_PERMISSIONS.GOVERNANCE_DASHBOARD },
  { match: (path) => path === '/resident-portal', roles: ROUTE_PERMISSIONS.RESIDENT_PORTAL },
  { match: (path) => path === '/funds', roles: ROUTE_PERMISSIONS.FUNDS },
  { match: (path) => path === '/transactions', roles: ROUTE_PERMISSIONS.TRANSACTIONS },
  { match: (path) => path === '/approvals', roles: ROUTE_PERMISSIONS.APPROVALS },
  { match: (path) => path === '/events', roles: ROUTE_PERMISSIONS.EVENTS },
  { match: (path) => path === '/compliance', roles: ROUTE_PERMISSIONS.COMPLIANCE },
  { match: (path) => path === '/reconciliation', roles: ROUTE_PERMISSIONS.RECONCILIATION },
  { match: (path) => path === '/audit', roles: ROUTE_PERMISSIONS.AUDIT },
  { match: (path) => path === '/reports', roles: ROUTE_PERMISSIONS.REPORTS },
  { match: (path) => path === '/settings', roles: ROUTE_PERMISSIONS.SETTINGS },
];

export function homePathForRole(role) {
  return ROLE_HOME[role] || '/';
}

export function accessDeniedPath(role) {
  if (role === USER_ROLES.RESIDENT) return '/resident-portal';
  return '/unauthorized';
}

/**
 * Residents who open the unauthorized page go back to the portal.
 * Every other role stays on that page.
 */
export function redirectForAuthenticatedPath(role, pathname) {
  if (role === USER_ROLES.RESIDENT && pathname === '/unauthorized') {
    return '/resident-portal';
  }
  return null;
}

function safeInternalPath(pathname) {
  if (typeof pathname !== 'string') return null;
  const path = pathname.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('://')) {
    return null;
  }
  return path.split('?')[0].split('#')[0];
}

export function isPathAllowedForRole(pathname, role) {
  const path = safeInternalPath(pathname);
  if (!path || !ROLE_HOME[role]) return false;
  if (path === '/login' || path === '/register' || path === '/unauthorized') return false;
  const rule = PATH_RULES.find((entry) => entry.match(path));
  return Boolean(rule && rule.roles.includes(role));
}

/**
 * Choose the page to open after login, registration, or session restoration.
 * An intended path is kept only when that role may open it.
 */
export function resolvePostAuthPath(role, intendedPath) {
  if (isPathAllowedForRole(intendedPath, role)) return safeInternalPath(intendedPath);
  return homePathForRole(role);
}
