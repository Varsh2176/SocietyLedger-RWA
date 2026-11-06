import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { UnauthorizedPage } from '../pages/UnauthorizedPage';
import { DashboardPage } from '../pages/DashboardPage';
import { FundsPage } from '../pages/FundsPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { ApprovalsPage } from '../pages/ApprovalsPage';
import { EventsPage } from '../pages/EventsPage';
import { CompliancePage } from '../pages/CompliancePage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { ReconciliationPage } from '../pages/ReconciliationPage';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ResidentPortalPage } from '../pages/ResidentPortalPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ROUTE_PERMISSIONS } from '../services/apiContract';

export const router = createBrowserRouter([
  // Public Authentication Routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },

  // Protected Application Routes wrapped by AppLayout & ProtectedRoute
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.GOVERNANCE_DASHBOARD}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'dashboard',
        element: <Navigate to="/" replace />,
      },
      {
        path: 'resident-portal',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.RESIDENT_PORTAL}>
            <ResidentPortalPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'funds',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.FUNDS}>
            <FundsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'transactions',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.TRANSACTIONS}>
            <TransactionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'approvals',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.APPROVALS}>
            <ApprovalsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'events',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.EVENTS}>
            <EventsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'compliance',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.COMPLIANCE}>
            <CompliancePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reconciliation',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.RECONCILIATION}>
            <ReconciliationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.AUDIT}>
            <AuditLogsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.REPORTS}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.SETTINGS}>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'unauthorized',
        element: <UnauthorizedPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
