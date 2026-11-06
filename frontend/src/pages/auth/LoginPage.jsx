import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Landmark, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { FormField } from '../../components/common/FormField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { resolvePostAuthPath } from '../../utils/landingPath';

export function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading, role } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const intendedPath = location.state?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restored sessions leave the login page for an authorized destination.
  if (isAuthenticated && !authLoading) {
    return <Navigate to={resolvePostAuthPath(role, intendedPath)} replace />;
  }

  const validate = () => {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Registered email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await login({ email, password });
      addToast({
        title: 'Authentication Successful',
        message: result.message || 'Welcome to SocietyLedger.',
        type: 'success',
      });
      navigate(resolvePostAuthPath(result.user?.role, intendedPath), { replace: true });
    } catch (err) {
      setServerError(err.message || 'Authentication failed. Please verify your credentials.');
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
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <Landmark size={26} />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Sign In to SocietyLedger
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Financial Transparency and Governance for Resident Welfare Associations
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Server Error Alert */}
          {serverError && (
            <div
              className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
              role="alert"
            >
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Sign In Failed: </span>
                <span>{serverError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Field */}
            <FormField
              label="Email Address"
              htmlFor="email"
              required={true}
              error={errors.email}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@society.org"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                icon={Mail}
                error={Boolean(errors.email)}
                disabled={isSubmitting || authLoading}
              />
            </FormField>

            {/* Password Field with Show/Hide */}
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
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                  }}
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

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 flex items-center gap-1">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Protected by RWA Governance</span>
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting || authLoading}
                icon={ArrowRight}
                iconPosition="right"
              >
                Sign In
              </Button>
            </div>
          </form>

          {/* Registration Link */}
          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
            <span>New member or resident? </span>
            <Link
              to="/register"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Register your account
            </Link>
          </div>
        </div>

        {/* Security Notice */}
        <p className="mt-4 text-center text-[11px] text-slate-400">
          SocietyLedger enforces session-cookie authentication. Plaintext credentials and access tokens are never stored locally.
        </p>
      </div>
    </div>
  );
}
