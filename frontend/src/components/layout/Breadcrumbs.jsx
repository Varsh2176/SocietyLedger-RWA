import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNameMap = {
  '': 'Overview',
  'dashboard': 'Dashboard',
  'funds': 'Funds & Reserves',
  'transactions': 'Transactions & Ledger',
  'approvals': 'Expense Approvals',
  'events': 'Events & Governance',
  'audit': 'Audit & Compliance',
  'reports': 'Financial Reports',
  'resident-portal': 'Resident Transparency Portal',
  'settings': 'Settings & Roles',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center text-xs text-slate-500">
      <ol className="flex items-center gap-1.5 flex-wrap">
        <li className="flex items-center">
          <Link
            to="/"
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Home size={13} aria-hidden="true" />
            <span>Home</span>
          </Link>
        </li>

        {pathnames.map((name, index) => {
          const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const displayName = routeNameMap[name.toLowerCase()] || decodeURIComponent(name);

          return (
            <li key={routeTo} className="flex items-center gap-1.5">
              <ChevronRight size={12} className="text-slate-400" aria-hidden="true" />
              {isLast ? (
                <span className="font-semibold text-slate-900" aria-current="page">
                  {displayName}
                </span>
              ) : (
                <Link
                  to={routeTo}
                  className="text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {displayName}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
