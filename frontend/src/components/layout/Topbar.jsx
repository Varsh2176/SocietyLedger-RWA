import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Bell,
  User,
  LogOut,
  ChevronDown,
  Building2,
  Shield,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { readSocietyIdentity } from '../../utils/societyIdentity';

export function Topbar({ onOpenMobileNav, onTriggerSignOut }) {
  const { user, role } = useAuth();
  const society = readSocietyIdentity(user);
  const { isDark, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const notifMenuRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMockNotificationClick = () => {
    addToast({
      title: 'Governance Notice',
      message: 'Monthly audit review scheduled for Nov 1st.',
      type: 'info',
    });
    setIsNotifOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 backdrop-blur-xs sm:px-6 transition-colors">
      {/* Left: Mobile Nav Toggle & Community Badge */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 lg:hidden"
          aria-label="Open sidebar navigation"
        >
          <Menu size={20} />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800 pl-3">
          <Building2 size={16} className="text-slate-400 dark:text-slate-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {society.name || 'Society details unavailable'}
          </span>
          {society.registrationNumber && (
            <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              Reg. No: {society.registrationNumber}
            </span>
          )}
        </div>
      </div>

      {/* Right: Theme Toggle, Notification and User Profile */}
      <div className="flex items-center gap-2.5">
        {/* Light / Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={notifMenuRef}>
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            aria-label="Notifications"
            aria-expanded={isNotifOpen}
          >
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-lg z-50">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Governance Alerts</span>
                <span className="rounded bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                  1 New
                </span>
              </div>
              <div className="mt-2 space-y-2">
                <div
                  onClick={handleMockNotificationClick}
                  className="cursor-pointer rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">FY 26-27 Audit Cycle</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Click to view notice. Ledger verification scheduled.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 p-1.5 pr-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 dark:bg-blue-600 text-xs font-semibold text-white uppercase">
              {user?.name ? user.name.charAt(0) : <User size={15} />}
            </div>
            <div className="hidden text-left sm:block">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                {user?.name || 'Member'}
              </div>
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                {role || 'Resident'}
              </div>
            </div>
            <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 shadow-lg z-50">
              <div className="border-b border-slate-100 dark:border-slate-800 px-3.5 py-2">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{user?.name || 'Active Member'}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email || 'No email attached'}</p>
                <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded w-fit">
                  <Shield size={11} />
                  <span>Role: {role || 'Resident'}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onTriggerSignOut();
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
