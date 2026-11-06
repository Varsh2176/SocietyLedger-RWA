import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldX, ArrowLeft, Home, UserCheck } from 'lucide-react';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { homePathForRole, redirectForAuthenticatedPath } from '../utils/landingPath';
import { USER_ROLES } from '../services/apiContract';

export function UnauthorizedPage() {
  const { role } = useAuth();
  const location = useLocation();
  const residentRedirect = redirectForAuthenticatedPath(role, location.pathname);
  if (residentRedirect) {
    return <Navigate to={residentRedirect} replace />;
  }

  const requiredRoles = location.state?.requiredRoles || [];
  const attemptedPath = location.state?.attemptedPath || '';

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-4 ring-8 ring-red-50/50">
        <ShieldX size={36} />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
          HTTP 403 Forbidden
        </span>
        <StatusBadge variant="danger" size="sm">
          Access Restricted
        </StatusBadge>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Unauthorized Governance Action
      </h1>

      <p className="mt-2 text-xs text-slate-600 max-w-md leading-relaxed">
        Your current account role does not have authorization to access this section
        {attemptedPath ? <strong className="font-mono text-slate-800"> ({attemptedPath})</strong> : ''}.
        Financial governance policies enforce strict role segregation.
      </p>

      {/* Role Comparison Card */}
      <div className="mt-6 w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 text-xs">
          <span className="text-slate-500">Your Active Role:</span>
          <StatusBadge variant="neutral" size="sm">
            {role || 'Unauthenticated'}
          </StatusBadge>
        </div>

        {requiredRoles.length > 0 && (
          <div className="mt-2.5 flex items-start justify-between text-xs">
            <span className="text-slate-500 mt-0.5">Required Role(s):</span>
            <div className="flex flex-wrap gap-1 justify-end max-w-xs">
              {requiredRoles.map((r) => (
                <StatusBadge key={r} variant="info" size="sm">
                  {r}
                </StatusBadge>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500">
          To request elevated permissions (Treasurer, Committee Member, Auditor), contact your Society Secretary or Administrator.
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex items-center gap-3">
        <Link to={homePathForRole(role)}>
          <Button variant="primary" size="md" icon={role === USER_ROLES.RESIDENT ? UserCheck : Home}>
            {role === USER_ROLES.RESIDENT ? 'Return to Resident Portal' : 'Return to Dashboard'}
          </Button>
        </Link>
      </div>
    </div>
  );
}
