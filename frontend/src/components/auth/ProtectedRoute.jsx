import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../common/LoadingState';
import { accessDeniedPath } from '../../utils/landingPath';

export function ProtectedRoute({ allowedRoles = [], children }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingState
          message="Verifying governance credentials..."
          description="Restoring secure society session with backend services."
        />
      </div>
    );
  }

  // Not authenticated: redirect to login preserving destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but insufficient role authorization.
  // Residents return to their portal. Other roles see the unauthorized page.
  if (allowedRoles.length > 0 && (!role || !allowedRoles.includes(role))) {
    const deniedPath = accessDeniedPath(role);
    if (deniedPath === location.pathname) {
      return children ? children : <Outlet />;
    }
    return (
      <Navigate
        to={deniedPath}
        state={deniedPath === '/unauthorized' ? {
          requiredRoles: allowedRoles,
          attemptedPath: location.pathname,
        } : undefined}
        replace
      />
    );
  }

  return children ? children : <Outlet />;
}
