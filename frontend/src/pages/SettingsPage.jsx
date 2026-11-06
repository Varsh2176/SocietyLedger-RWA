import React, { useCallback, useEffect, useState } from 'react';
import { Settings, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { FormField } from '../components/common/FormField';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { useToast } from '../context/ToastContext';
import { adminService } from '../services/adminService';
import { USER_ROLES } from '../services/apiContract';
import { formatDate } from '../utils/formatters';

const TABS = [
  { id: 'profile', label: 'Society profile' },
  { id: 'residents', label: 'Residents' },
  { id: 'roles', label: 'Roles' },
  { id: 'invitation', label: 'Invitation code' },
];

const ROLE_OPTIONS = Object.values(USER_ROLES).map((role) => ({ value: role, label: role }));

function emptyProfile() {
  return {
    name: '',
    registrationNumber: '',
    contactEmail: '',
    contactPhone: '',
    fiscalYearStartMonth: 4,
    address: { street: '', city: '', state: '', pincode: '' },
  };
}

export function SettingsPage() {
  const { addToast } = useToast();
  const [tab, setTab] = useState('profile');
  const [society, setSociety] = useState(null);
  const [profile, setProfile] = useState(emptyProfile());
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [societyResult, memberResult] = await Promise.all([
        adminService.getSociety(),
        adminService.getMembers(),
      ]);
      setSociety(societyResult);
      setProfile({
        name: societyResult.name || '',
        registrationNumber: societyResult.registrationNumber || '',
        contactEmail: societyResult.contactEmail || '',
        contactPhone: societyResult.contactPhone || '',
        fiscalYearStartMonth: societyResult.fiscalYearStartMonth || 4,
        address: {
          street: societyResult.address?.street || '',
          city: societyResult.address?.city || '',
          state: societyResult.address?.state || '',
          pincode: societyResult.address?.pincode || '',
        },
      });
      setMembers(memberResult);
      setRoleDrafts(Object.fromEntries(memberResult.map((member) => [member.id, member.role])));
    } catch (error) {
      setHasError(true);
      addToast({ title: 'Settings unavailable', message: error.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const residents = members.filter((member) => member.role === 'Resident');

  const saveProfile = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const updated = await adminService.updateSociety({
        ...profile,
        fiscalYearStartMonth: Number(profile.fiscalYearStartMonth),
      });
      setSociety((current) => ({ ...current, ...updated, invitationCode: current?.invitationCode }));
      addToast({ title: 'Profile saved', message: 'Society details were updated.', type: 'success' });
    } catch (error) {
      addToast({ title: 'Profile not saved', message: error.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const changeStatus = async (member) => {
    setIsSaving(true);
    try {
      const updated = await adminService.updateMemberStatus(member.id, !member.isActive);
      setMembers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelected(updated);
      addToast({
        title: updated.isActive ? 'Account activated' : 'Account deactivated',
        message: updated.email,
        type: 'success',
      });
    } catch (error) {
      addToast({ title: 'Status not changed', message: error.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveRole = async (member) => {
    setIsSaving(true);
    try {
      const updated = await adminService.updateMemberRole(member.id, roleDrafts[member.id]);
      setMembers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelected((current) => (current?.id === updated.id ? updated : current));
      addToast({ title: 'Role updated', message: `${updated.email} is now ${updated.role}.`, type: 'success' });
    } catch (error) {
      setRoleDrafts((current) => ({ ...current, [member.id]: member.role }));
      addToast({ title: 'Role not changed', message: error.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const rotateCode = async () => {
    setIsSaving(true);
    try {
      const invitationCode = await adminService.rotateInvitationCode();
      setSociety((current) => ({ ...current, invitationCode }));
      addToast({ title: 'Invitation code rotated', message: 'The previous code no longer works.', type: 'success' });
    } catch (error) {
      addToast({ title: 'Code not rotated', message: error.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const memberColumns = [
    { key: 'name', header: 'Name', render: (row) => (
      <button type="button" className="font-medium text-slate-900" onClick={() => setSelected(row)}>
        {row.name}
      </button>
    ) },
    { key: 'email', header: 'Email', render: (row) => row.email },
    { key: 'apartmentNumber', header: 'Flat', render: (row) => row.apartmentNumber || '—' },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <StatusBadge variant={row.isActive ? 'success' : 'neutral'} size="sm">
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings size={22} /> Society administration
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Manage this society’s profile, residents, roles, and invitation code.
          </p>
        </div>
        <Button variant="outline" icon={RefreshCw} onClick={load} isLoading={isLoading}>Refresh</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === item.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState message="Loading society administration..." />}
      {hasError && !isLoading && (
        <ErrorState title="Could not load administration" message="The administrator settings could not be retrieved." onRetry={load} />
      )}

      {!isLoading && !hasError && tab === 'profile' && (
        <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <FormField label="Society name" htmlFor="society-name" required>
            <Input id="society-name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
          </FormField>
          <FormField label="Registration number" htmlFor="society-registration" required>
            <Input id="society-registration" value={profile.registrationNumber} onChange={(event) => setProfile({ ...profile, registrationNumber: event.target.value })} />
          </FormField>
          <FormField label="Contact email" htmlFor="society-email">
            <Input id="society-email" type="email" value={profile.contactEmail} onChange={(event) => setProfile({ ...profile, contactEmail: event.target.value })} />
          </FormField>
          <FormField label="Contact phone" htmlFor="society-phone">
            <Input id="society-phone" value={profile.contactPhone} onChange={(event) => setProfile({ ...profile, contactPhone: event.target.value })} />
          </FormField>
          <FormField label="Street" htmlFor="society-street">
            <Input id="society-street" value={profile.address.street} onChange={(event) => setProfile({ ...profile, address: { ...profile.address, street: event.target.value } })} />
          </FormField>
          <FormField label="City" htmlFor="society-city">
            <Input id="society-city" value={profile.address.city} onChange={(event) => setProfile({ ...profile, address: { ...profile.address, city: event.target.value } })} />
          </FormField>
          <FormField label="State" htmlFor="society-state">
            <Input id="society-state" value={profile.address.state} onChange={(event) => setProfile({ ...profile, address: { ...profile.address, state: event.target.value } })} />
          </FormField>
          <FormField label="PIN code" htmlFor="society-pin">
            <Input id="society-pin" value={profile.address.pincode} onChange={(event) => setProfile({ ...profile, address: { ...profile.address, pincode: event.target.value } })} />
          </FormField>
          <FormField label="Fiscal year starts" htmlFor="society-fy">
            <Select
              id="society-fy"
              value={String(profile.fiscalYearStartMonth)}
              onChange={(event) => setProfile({ ...profile, fiscalYearStartMonth: Number(event.target.value) })}
              options={[
                { value: '1', label: 'January' },
                { value: '2', label: 'February' },
                { value: '3', label: 'March' },
                { value: '4', label: 'April' },
                { value: '5', label: 'May' },
                { value: '6', label: 'June' },
                { value: '7', label: 'July' },
                { value: '8', label: 'August' },
                { value: '9', label: 'September' },
                { value: '10', label: 'October' },
                { value: '11', label: 'November' },
                { value: '12', label: 'December' },
              ]}
            />
          </FormField>
          <div className="md:col-span-2">
            <Button type="submit" isLoading={isSaving}>Save society profile</Button>
          </div>
        </form>
      )}

      {!isLoading && !hasError && tab === 'residents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <DataTable
              columns={memberColumns}
              data={residents}
              onRowClick={setSelected}
              emptyTitle="No residents"
              emptyDescription="Residents who join with the invitation code will appear here."
            />
          </div>
          <MemberDetail member={selected} isSaving={isSaving} onToggle={changeStatus} />
        </div>
      )}

      {!isLoading && !hasError && tab === 'roles' && (
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                <p className="text-xs text-slate-500">{member.email} · {member.apartmentNumber || 'No flat'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={roleDrafts[member.id] || member.role}
                  onChange={(event) => setRoleDrafts({ ...roleDrafts, [member.id]: event.target.value })}
                  options={ROLE_OPTIONS}
                />
                <Button size="sm" onClick={() => saveRole(member)} isLoading={isSaving}>Save role</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !hasError && tab === 'invitation' && (
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <ShieldCheck size={18} className="text-blue-600 mt-0.5" />
            <p>Only a Society Administrator can see this code. Registration with it creates a Resident account.</p>
          </div>
          <p className="font-mono text-lg font-semibold tracking-wide text-slate-900">{society?.invitationCode}</p>
          <Button variant="danger" onClick={rotateCode} isLoading={isSaving}>Rotate invitation code</Button>
        </div>
      )}
    </div>
  );
}

function MemberDetail({ member, isSaving, onToggle }) {
  if (!member) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs text-slate-500">
        Select a resident to view details.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 text-sm">
      <h2 className="font-semibold text-slate-900">{member.name}</h2>
      <p className="text-slate-600">{member.email}</p>
      <p className="text-slate-600">Phone: {member.phone || '—'}</p>
      <p className="text-slate-600">Flat: {member.apartmentNumber || '—'}</p>
      <p className="text-slate-600">Role: {member.role}</p>
      <p className="text-slate-600">Verification: {member.verificationStatus}</p>
      <p className="text-slate-600">Last login: {member.lastLoginAt ? formatDate(member.lastLoginAt) : '—'}</p>
      <Button variant={member.isActive ? 'dangerOutline' : 'primary'} onClick={() => onToggle(member)} isLoading={isSaving}>
        {member.isActive ? 'Deactivate account' : 'Activate account'}
      </Button>
    </div>
  );
}
