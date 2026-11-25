import React, { useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { CustomerAccount, ProviderAccount, UserRole } from '../types.ts';

interface RoleAuthFlowProps {
  initialRole: UserRole | null;
  sessionNotice?: string | null;
  onBackToIntro: () => void;
  onAuthenticated: (user: CustomerAccount | ProviderAccount, token: string) => void;
}

export const RoleAuthFlow: React.FC<RoleAuthFlowProps> = ({
  initialRole,
  sessionNotice,
  onBackToIntro,
  onAuthenticated,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(initialRole);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authMethod, setAuthMethod] = useState<'gmail' | 'phone'>('gmail');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(sessionNotice || null);
  const [configWarning, setConfigWarning] = useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data: { configWarning?: string | null }) => {
        if (active && data.configWarning) {
          setConfigWarning(data.configWarning);
        }
      })
      .catch(() => {
        // ignore transient status check
      });
    return () => {
      active = false;
    };
  }, []);

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setAuthMode(nextMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setError(null);

    const trimmedId = identifier.trim();
    if (authMethod === 'gmail') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedId)) {
        setError('Please enter a valid Gmail or email address.');
        return;
      }
    } else {
      const digits = trimmedId.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Please enter a valid 10-digit phone number.');
        return;
      }
    }

    if (authMode === 'signup') {
      if (name.trim().length < 2) {
        setError('Please enter your full name (at least 2 characters).');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          authMethod,
          identifier: trimmedId,
          name: authMode === 'signup' ? name.trim() : undefined,
          password,
        }),
      });
      const data = (await res.json()) as {
        user?: CustomerAccount | ProviderAccount;
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.user || !data.token) {
        setError(
          data.error ||
            (authMode === 'signup'
              ? 'Unable to create account right now.'
              : 'Unable to sign in right now.')
        );
        return;
      }
      onAuthenticated(data.user, data.token);
    } catch {
      setError('Network error while connecting to authentication server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedRole) {
    return (
      <div className="bg-obsidian-glow min-h-[calc(100vh-120px)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={onBackToIntro}
            className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to overview</span>
          </button>

          <div className="mt-6">
            <p className="text-xs font-medium text-[#A78BFA]">Account Portal</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
              How would you like to use UrbanFix?
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              Customers and Service Providers sign up or sign in through dedicated portals. Only
              registered accounts can access the workspace.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedRole('customer')}
              className="surface-card group flex flex-col justify-between rounded-3xl p-7 text-left transition-all hover:border-[#7C5CFF]/60"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25213D] text-[#A78BFA]">
                  <UserCheck className="h-5 w-5" />
                </div>
                <h2 className="mt-5 font-display text-xl font-bold text-white">
                  I am a Customer
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Upload a photo, video, or voice note in Kannada, Hindi, or English. Get an instant AI
                  repair diagnosis, fair price quote, safety tips, and match nearby technicians.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4 text-sm font-semibold text-white">
                <span>Sign up / Log in with Gmail or Phone</span>
                <span className="text-[#A78BFA] transition-transform group-hover:translate-x-1">→</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('provider')}
              className="surface-card group flex flex-col justify-between rounded-3xl p-7 text-left transition-all hover:border-[#7C5CFF]/60"
            >
              <div>
                <div className="btn-violet-primary flex h-12 w-12 items-center justify-center rounded-2xl text-white">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h2 className="mt-5 font-display text-xl font-bold text-white">
                  I am a Service Provider
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Set your skills, certifications, and service radius. View pre-diagnosed customer job
                  requests within your coverage zone and manage active bookings.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4 text-sm font-semibold text-[#A78BFA]">
                <span>Partner Sign up / Log in</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isProvider = selectedRole === 'provider';

  return (
    <div className="bg-obsidian-glow min-h-[calc(100vh-120px)] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={() => {
            setSelectedRole(null);
            setError(null);
          }}
          className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Switch role</span>
        </button>

        <div className="surface-card mt-5 rounded-3xl p-6 sm:p-8">
          <p className="text-xs font-semibold text-[#A78BFA]">
            {isProvider ? 'Service Provider Portal' : 'Customer Portal'}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white">
            {authMode === 'signup'
              ? isProvider
                ? 'Create Partner Account'
                : 'Create Customer Account'
              : isProvider
              ? 'Sign in to Partner Hub'
              : 'Sign in to UrbanFix'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-300">
            {authMode === 'signup'
              ? 'Register once with Gmail or phone number and a password to start using UrbanFix.'
              : 'Sign in with your registered Gmail or phone number and password.'}
          </p>

          {/* Explicit Sign In vs Sign Up Switcher */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-[#0B0B10] p-1">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${
                authMode === 'signin'
                  ? 'bg-[#7C5CFF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${
                authMode === 'signup'
                  ? 'bg-[#7C5CFF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Sign Up</span>
            </button>
          </div>

          {/* Segmented Contact Method (Gmail / Phone) */}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-[#0E0E15] p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('gmail');
                setError(null);
                setIdentifier('');
              }}
              className={`flex min-h-[38px] items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors ${
                authMethod === 'gmail'
                  ? 'bg-[#252536] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Gmail</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('phone');
                setError(null);
                setIdentifier('');
              }}
              className={`flex min-h-[38px] items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors ${
                authMethod === 'phone'
                  ? 'bg-[#252536] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Phone Number</span>
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
            {authMode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-slate-300">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isProvider ? 'e.g. Karthik Gowda' : 'e.g. Priya Sharma'}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#1C1C27] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-id" className="block text-xs font-medium text-slate-300">
                {authMethod === 'gmail' ? 'Gmail Address' : 'Mobile Phone Number'}
              </label>
              <input
                id="auth-id"
                type={authMethod === 'gmail' ? 'email' : 'tel'}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={authMethod === 'gmail' ? 'name@gmail.com' : '+91 98765 43210'}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#1C1C27] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#7C5CFF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={authMode === 'signup' ? 6 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    authMode === 'signup' ? 'Create password (min 6 characters)' : 'Enter password'
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#1C1C27] py-2.5 pr-10 pl-3.5 text-sm text-white placeholder:text-slate-500 focus:border-[#7C5CFF] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authMode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-medium text-slate-300"
                >
                  Confirm Password
                </label>
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#1C1C27] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>
            )}

            {configWarning && (
              <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {configWarning}
              </p>
            )}

            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-violet-primary min-h-[48px] w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
            >
              {isSubmitting
                ? authMode === 'signup'
                  ? 'Creating account...'
                  : 'Signing in...'
                : authMode === 'signup'
                ? `Create Account & Enter ${isProvider ? 'Partner Hub' : 'UrbanFix'}`
                : `Sign In to ${isProvider ? 'Partner Hub' : 'UrbanFix'}`}
            </button>
          </form>

          <div className="mt-5 border-t border-white/[0.08] pt-4 text-center text-xs text-slate-400">
            {authMode === 'signin' ? (
              <p>
                New to UrbanFix?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-semibold text-[#A78BFA] underline underline-offset-2 hover:text-white"
                >
                  Sign up first to create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="font-semibold text-[#A78BFA] underline underline-offset-2 hover:text-white"
                >
                  Sign in here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
