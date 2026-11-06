import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { Breadcrumbs } from './Breadcrumbs';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SessionExpiredModal } from '../auth/SessionExpiredModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
      setSignOutConfirmOpen(false);
      addToast({
        title: 'Signed Out',
        message: 'Your active session has been safely closed.',
        type: 'info',
      });
      navigate('/login', { replace: true });
    } catch (err) {
      addToast({
        title: 'Sign Out Error',
        message: err.message || 'Error communicating with backend during sign out.',
        type: 'error',
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Static Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
        <Sidebar className="w-64 border-r border-slate-800" />
      </div>

      {/* Mobile Slide-out Navigation */}
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        <Topbar
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onTriggerSignOut={() => setSignOutConfirmOpen(true)}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>

      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        isOpen={signOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        onConfirm={handleConfirmSignOut}
        title="Sign Out Confirmation"
        message="Are you sure you want to exit your active session? You will be redirected to the sign-in portal and session cookies will be invalidated."
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        variant="primary"
        isLoading={isSigningOut}
      />

      {/* Global Session Expired Modal */}
      <SessionExpiredModal />
    </div>
  );
}
