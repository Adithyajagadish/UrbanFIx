import React, { useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import type { CustomerAccount, ProviderAccount, UserRole } from './types.ts';
import { IntroScreen } from './components/IntroScreen.tsx';
import { RoleAuthFlow } from './components/RoleAuthFlow.tsx';
import { CustomerWorkspace } from './components/CustomerWorkspace.tsx';
import { ProviderWorkspace } from './components/ProviderWorkspace.tsx';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

type ScreenView = 'intro' | 'auth' | 'app';

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [screen, setScreen] = useState<ScreenView>('intro');
  const [preferredAuthRole, setPreferredAuthRole] = useState<UserRole | null>(null);
  const [activeUser, setActiveUser] = useState<CustomerAccount | ProviderAccount | null>(null);
  const [authToken, setAuthToken] = useState<string>('');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [customerTab, setCustomerTab] = useState<'explore' | 'diagnose' | 'bookings'>('explore');

  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  const handleAuthenticated = (user: CustomerAccount | ProviderAccount, token: string) => {
    setActiveUser(user);
    setAuthToken(token);
    setSessionNotice(null);
    setScreen('app');
    if (user.role === 'customer') {
      setCustomerTab('explore');
    }
  };

  const handleSignOut = () => {
    setActiveUser(null);
    setAuthToken('');
    setPreferredAuthRole(null);
    setSessionNotice(null);
    setScreen('intro');
  };

  const handleSessionExpired = () => {
    const prevRole = activeUser?.role || null;
    setActiveUser(null);
    setAuthToken('');
    setPreferredAuthRole(prevRole);
    setSessionNotice('Your session expired. Please sign in again.');
    setScreen('auth');
  };

  const openRoleAuth = (role: UserRole | null) => {
    setSessionNotice(null);
    setPreferredAuthRole(role);
    setScreen('auth');
  };

  const appShell = (
    <div className="min-h-screen flex flex-col bg-[#0B0B10] text-white">
      {mapsQuotaExceeded && (
        <div className="bg-amber-950/90 border-b border-amber-500/40 text-amber-100 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-white hover:text-amber-200"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* 3-Zone Dark Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0B0B10]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              if (!activeUser) {
                setScreen('intro');
              } else if (activeUser.role === 'customer') {
                setCustomerTab('explore');
              }
            }}
            className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            UrbanFix
          </button>

          {/* Zone 2: Concise Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            {activeUser?.role === 'customer' ? (
              <>
                <button
                  type="button"
                  onClick={() => setCustomerTab('explore')}
                  className={`transition-colors hover:text-white whitespace-nowrap shrink-0 ${
                    customerTab === 'explore' ? 'text-white underline underline-offset-4' : ''
                  }`}
                >
                  Home Hub
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTab('diagnose')}
                  className={`transition-colors hover:text-white whitespace-nowrap shrink-0 ${
                    customerTab === 'diagnose' ? 'text-white underline underline-offset-4' : ''
                  }`}
                >
                  AI Diagnosis
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTab('bookings')}
                  className={`transition-colors hover:text-white whitespace-nowrap shrink-0 ${
                    customerTab === 'bookings' ? 'text-white underline underline-offset-4' : ''
                  }`}
                >
                  My Bookings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveUser(null);
                    setAuthToken('');
                    openRoleAuth('provider');
                  }}
                  className="transition-colors hover:text-white whitespace-nowrap shrink-0"
                >
                  Provider Hub
                </button>
              </>
            ) : activeUser?.role === 'provider' ? (
              <>
                <button
                  type="button"
                  onClick={() => setScreen('app')}
                  className="text-white underline underline-offset-4 whitespace-nowrap shrink-0"
                >
                  Partner Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveUser(null);
                    setAuthToken('');
                    openRoleAuth('customer');
                  }}
                  className="transition-colors hover:text-white whitespace-nowrap shrink-0"
                >
                  Customer Portal
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setScreen('intro')}
                  className="transition-colors hover:text-white whitespace-nowrap shrink-0"
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => openRoleAuth('customer')}
                  className="transition-colors hover:text-white whitespace-nowrap shrink-0"
                >
                  Customer Login
                </button>
                <button
                  type="button"
                  onClick={() => openRoleAuth('provider')}
                  className="transition-colors hover:text-white whitespace-nowrap shrink-0"
                >
                  Provider Login
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            {activeUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-white/15 bg-[#1B1B26] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#252534] whitespace-nowrap shrink-0"
              >
                Sign Out ({activeUser.name.split(' ')[0]})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openRoleAuth(null)}
                className="btn-violet-primary rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all whitespace-nowrap shrink-0"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {screen === 'intro' && (
          <IntroScreen
            onGetStarted={() => openRoleAuth(null)}
            onQuickRole={(role) => openRoleAuth(role)}
          />
        )}
        {screen === 'auth' && (
          <RoleAuthFlow
            initialRole={preferredAuthRole}
            sessionNotice={sessionNotice}
            onBackToIntro={() => setScreen('intro')}
            onAuthenticated={handleAuthenticated}
          />
        )}
        {screen === 'app' && activeUser?.role === 'customer' && authToken && (
          <CustomerWorkspace
            customer={activeUser}
            authToken={authToken}
            activeTab={customerTab}
            onTabChange={setCustomerTab}
            onCustomerUpdated={(updated) => setActiveUser(updated)}
            onSessionExpired={handleSessionExpired}
          />
        )}
        {screen === 'app' && activeUser?.role === 'provider' && authToken && (
          <ProviderWorkspace
            provider={activeUser}
            authToken={authToken}
            onProviderUpdated={(updated) => setActiveUser(updated)}
            onSessionExpired={handleSessionExpired}
          />
        )}
      </main>

      <footer className="border-t border-white/[0.08] bg-[#0B0B10] hidden lg:block">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-5 text-xs text-slate-400 sm:flex-row sm:items-center">
          <span className="font-display font-semibold text-white">UrbanFix</span>
          <span>
            AI Home Repair Diagnosis · Kannada, Hindi &amp; English · Transparent Fair Quotes
          </span>
        </div>
      </footer>
    </div>
  );

  if (!MAPS_API_KEY) {
    return appShell;
  }

  return (
    <APIProvider
      apiKey={MAPS_API_KEY}
      libraries={['places', 'marker']}
      language="en"
      region="IN"
    >
      {appShell}
    </APIProvider>
  );
}
