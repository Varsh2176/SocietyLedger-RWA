import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function SessionExpiredModal() {
  const { sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();

  const handleRelogin = () => {
    clearSessionExpired();
    navigate('/login');
  };

  return (
    <ConfirmDialog
      isOpen={sessionExpired}
      onClose={handleRelogin}
      onConfirm={handleRelogin}
      title="Session Expired"
      message="Your authenticated session has expired or the token was invalidated by the backend. Please sign in again to resume managing society records."
      confirmLabel="Sign In Again"
      cancelLabel="Close"
      variant="warning"
    />
  );
}
