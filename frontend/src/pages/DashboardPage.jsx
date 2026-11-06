import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { USER_ROLES } from '../services/apiContract';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { TreasurerDashboard } from './dashboards/TreasurerDashboard';
import { CommitteeDashboard } from './dashboards/CommitteeDashboard';
import { AuditorDashboard } from './dashboards/AuditorDashboard';

export function DashboardPage() {
  const { role } = useAuth();

  if (role === USER_ROLES.RESIDENT) {
    return <Navigate to="/resident-portal" replace />;
  }
  if (role === USER_ROLES.ADMIN) return <AdminDashboard />;
  if (role === USER_ROLES.TREASURER) return <TreasurerDashboard />;
  if (role === USER_ROLES.COMMITTEE_MEMBER) return <CommitteeDashboard />;
  if (role === USER_ROLES.AUDITOR) return <AuditorDashboard />;

  return <Navigate to="/unauthorized" replace />;
}
