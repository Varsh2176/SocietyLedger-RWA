import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  ReceiptText,
  CheckSquare,
  CalendarDays,
  ShieldCheck,
  CreditCard,
  BarChart3,
  Settings,
  Landmark,
  BadgeAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_PERMISSIONS } from '../../services/apiContract';
import { homePathForRole } from '../../utils/landingPath';
import { readSocietyIdentity } from '../../utils/societyIdentity';

export const navigationItems = [
  {
    group: 'Financial Transparency',
    items: [
      {
        name: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.DASHBOARD,
      },
      {
        name: 'Resident Portal',
        href: '/resident-portal',
        icon: Users,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.RESIDENT_PORTAL,
      },
      {
        name: 'Funds & Reserves',
        href: '/funds',
        icon: Wallet,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.FUNDS,
      },
      {
        name: 'Transactions & Ledger',
        href: '/transactions',
        icon: ReceiptText,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.TRANSACTIONS,
      },
      {
        name: 'Financial Reports',
        href: '/reports',
        icon: BarChart3,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.REPORTS,
      },
    ],
  },
  {
    group: 'Governance & Audit',
    items: [
      {
        name: 'Expense Approvals',
        href: '/approvals',
        icon: CheckSquare,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.APPROVALS,
      },
      {
        name: 'Community Events',
        href: '/events',
        icon: CalendarDays,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.EVENTS,
      },
      {
        name: 'Tax & Compliance',
        href: '/compliance',
        icon: Landmark,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.COMPLIANCE,
      },
      {
        name: 'Bank Reconciliation',
        href: '/reconciliation',
        icon: CreditCard,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.RECONCILIATION,
      },
      {
        name: 'Audit Trail & Compliance',
        href: '/audit',
        icon: ShieldCheck,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.AUDIT,
      },
    ],
  },
  {
    group: 'Administration',
    items: [
      {
        name: 'Settings & Roles',
        href: '/settings',
        icon: Settings,
        badge: null,
        allowedRoles: ROUTE_PERMISSIONS.SETTINGS,
      },
    ],
  },
];

export function Sidebar({ onCloseMobile, className = '' }) {
  const { role, user } = useAuth();
  const society = readSocietyIdentity(user);

  return (
    <aside className={`flex h-full flex-col bg-slate-900 text-slate-100 ${className}`}>
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
          <Landmark size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
            SocietyLedger
            <span className="rounded bg-blue-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-blue-300">
              RWA
            </span>
          </span>
          <span className="text-[11px] text-slate-400">Financial Governance</span>
        </div>
      </div>

      {/* Active Role Indicator */}
      <div className="mx-3.5 mt-3.5 rounded-lg bg-slate-800/80 p-3 border border-slate-750">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Active Role
          </p>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        </div>
        <p className="text-xs font-semibold text-white mt-1 truncate">
          {role || 'Resident'}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
          {society.name || 'Society details unavailable'}
        </p>
        {society.registrationNumber && (
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Reg. {society.registrationNumber}</p>
        )}
        {user?.apartmentNumber && (
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Unit: {user.apartmentNumber}</p>
        )}
      </div>

      {/* Role-Filtered Navigation Groups */}
      <nav aria-label="Main Navigation" className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        {navigationItems.map((section) => {
          // Filter items based on user's active role
          const visibleItems = section.items.filter((item) => {
            if (item.name === 'Resident Portal' && homePathForRole(role) === '/resident-portal') return false;
            if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
            if (!role) return true;
            return item.allowedRoles.includes(role);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.group}>
              <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                {section.group}
              </h3>
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const href = item.name === 'Dashboard' ? homePathForRole(role) : item.href;
                  const exact = href === '/' || href === '/resident-portal';
                  return (
                    <li key={item.name}>
                      <NavLink
                        to={href}
                        end={exact}
                        onClick={onCloseMobile}
                        className={({ isActive }) =>
                          `group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-xs'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className="flex-shrink-0" aria-hidden="true" />
                          <span>{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-300">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-slate-800 p-3.5">
        <div className="rounded-lg bg-slate-850 p-2.5 text-[11px] text-slate-400 flex items-center gap-2">
          <BadgeAlert size={15} className="text-blue-400 flex-shrink-0" />
          <span>Role-aware routing enabled. Backend authorization enforced.</span>
        </div>
      </div>
    </aside>
  );
}
