import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import {
  Landmark,
  User,
  Mail,
  Phone,
  Home,
  Tag,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { FormField } from '../../components/common/FormField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  registrationFieldErrorsFromApi,
  validateRegistrationForm,
} from '../../utils/registrationValidation';
import { resolvePostAuthPath } from '../../utils/landingPath';

export function RegisterPage() {
  const { register, isAuthenticated, isLoading: authLoading, role } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  if (isAuthenticated && !authLoading) {
    return <Navigate to={resolvePostAuthPath(role)} replace />;
  }

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    apartmentNumber: '',
    societyCode: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors = validateRegistrationForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        apartmentNumber: formData.apartmentNumber,
        societyCode: formData.societyCode,
        password: formData.password,
      });

      addToast({
        title: 'Registration Submitted',
        message: result.message || 'Your account has been registered.',
        type: 'success',
      });
      navigate(resolvePostAuthPath(result.user?.role), { replace: true });
    } catch (err) {
      const fieldErrors = registrationFieldErrorsFromApi(err.details);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
      setServerError(err.message || 'Registration failed. Please check the entered data.');
      if (err.isNetworkError) {
        addToast({
          title: 'Backend Unreachable',
          message: import.meta.env.DEV
            ? 'Could not connect to the backend API at http://localhost:5000.'
            : 'Could not connect to the SocietyLedger API.',
          type: 'error',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <Landmark size={26} />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Create Resident Account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Join your apartment community or Resident Welfare Association
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Server Error Alert */}
          {serverError && (
            <div
              className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
              role="alert"
            >
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Registration Failed: </span>
                <span>{serverError}</span>
              </div>
            </div>
          )}

          {/* Role Governance Notice */}
          <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">Governance Role Assignment: </span>
              <span>
                The invitation code joins you to one society as a <strong>Resident</strong>. Treasurer, Auditor, and Committee Member access is assigned later by the Society Administrator.
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Full Name"
                htmlFor="name"
                required={true}
                error={errors.name}
              >
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  icon={User}
                  error={Boolean(errors.name)}
                  disabled={isSubmitting || authLoading}
                />
              </FormField>

              <FormField
                label="Phone Number"
                htmlFor="phone"
                required={true}
                error={errors.phone}
              >
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  icon={Phone}
                  error={Boolean(errors.phone)}
                  disabled={isSubmitting || authLoading}
                />
              </FormField>
            </div>

            {/* Email Address */}
            <FormField
              label="Email Address"
              htmlFor="email"
              required={true}
              error={errors.email}
              hint="Official email for financial statements and voting ballots"
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ramesh@example.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                icon={Mail}
                error={Boolean(errors.email)}
                disabled={isSubmitting || authLoading}
              />
            </FormField>

            {/* Flat/Apartment Number & Society Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Apartment / Flat No."
                htmlFor="apartmentNumber"
                required={true}
                error={errors.apartmentNumber}
                hint="e.g. Block A - 402"
              >
                <Input
                  id="apartmentNumber"
                  type="text"
                  placeholder="Block A - 402"
                  value={formData.apartmentNumber}
                  onChange={(e) => handleChange('apartmentNumber', e.target.value)}
                  icon={Home}
                  error={Boolean(errors.apartmentNumber)}
                  disabled={isSubmitting || authLoading}
                />
              </FormField>

              <FormField
                label="Society Invitation Code"
                htmlFor="societyCode"
                required={true}
                error={errors.societyCode}
                hint="Required. Provided by your RWA management"
              >
                <Input
                  id="societyCode"
                  type="text"
                  placeholder="INV-GWD-2026"
                  value={formData.societyCode}
                  onChange={(e) => handleChange('societyCode', e.target.value)}
                  icon={Tag}
                  error={Boolean(errors.societyCode)}
                  disabled={isSubmitting || authLoading}
                />
              </FormField>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Password"
                htmlFor="password"
                required={true}
                error={errors.password}
              >
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    icon={Lock}
                    error={Boolean(errors.password)}
                    disabled={isSubmitting || authLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <FormField
                label="Confirm Password"
                htmlFor="confirmPassword"
                required={true}
                error={errors.confirmPassword}
              >
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    icon={Lock}
                    error={Boolean(errors.confirmPassword)}
                    disabled={isSubmitting || authLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting || authLoading}
                icon={ArrowRight}
                iconPosition="right"
              >
                Complete Registration
              </Button>
            </div>
          </form>

          {/* Login Link */}
          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
            <span>Already have an account? </span>
            <Link
              to="/login"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Sign In to your society
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
