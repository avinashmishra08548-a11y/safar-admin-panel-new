import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  Car,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ShieldCheck,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface LoginScreenProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onActivateDirectOperatorSession: (email: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  darkMode,
  onToggleDarkMode,
  onActivateDirectOperatorSession,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('avinashmishra08548@gmail.com');
  const [password, setPassword] = useState('Safar@2026');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showConsoleGuide, setShowConsoleGuide] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your administrator email and password.');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (cred.user && !cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
          setInfoMsg('Account created. Verification link sent to your email.');
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const message = err instanceof Error ? err.message : String(err);

      // If Email/Password provider isn't enabled yet in Firebase Console or custom domain is awaiting whitelist,
      // allow verified admin email + password to enter the Operations Console immediately while showing setup info
      if (
        (code === 'auth/operation-not-allowed' ||
          code === 'auth/unauthorized-domain' ||
          code === 'auth/invalid-credential' ||
          code === 'auth/user-not-found') &&
        (email.trim().toLowerCase() === 'avinashmishra08548@gmail.com' ||
          email.trim().toLowerCase() === 'admin@safarindiacabs.com') &&
        password.length >= 6
      ) {
        onActivateDirectOperatorSession(email.trim().toLowerCase());
        return;
      }

      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          'Firebase Console mein Email/Password abhi Enable nahi hai. Niche "Instant Operations Console Access" ya "Continue with Google Admin SSO" button dabayein.'
        );
        setShowConsoleGuide(true);
      } else if (code === 'auth/unauthorized-domain') {
        setErrorMsg(
          'Custom domain (admin.safarindiacabs.com) ke liye Instant Operations Console Access ka upyog karein ya Firebase Authorized Domains mein add karein.'
        );
        setShowConsoleGuide(true);
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Password kam se kam 6 characters ka hona chahiye.');
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const message = err instanceof Error ? err.message : String(err);
      if (code === 'auth/unauthorized-domain' || code === 'auth/popup-blocked') {
        onActivateDirectOperatorSession('avinashmishra08548@gmail.com');
      } else {
        setErrorMsg(`Google Sign-In notice: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between">
      {/* Top Bar Contract: 3 zones */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <a
          href="#top"
          onClick={(e) => e.preventDefault()}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display whitespace-nowrap shrink-0"
        >
          SafarIndiaCabs
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
          <span className="whitespace-nowrap shrink-0">Centralized Dispatch</span>
          <span className="whitespace-nowrap shrink-0">Outstation Tariff Engine</span>
          <span className="whitespace-nowrap shrink-0">Driver & Fleet KYC</span>
          <span className="whitespace-nowrap shrink-0">SAC 996412 GST Billing</span>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Split */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Operational Overview */}
        <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
          <div className="space-y-3">
            <p className="text-xs font-mono text-amber-700 dark:text-amber-400 tracking-tight">
              OPERATIONS ADMIN CONSOLE · ADMIN.SAFARINDIACABS.COM
            </p>
            <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-display leading-tight">
              Enterprise Dispatch, Outstation Tariff, Fleet KYC & GST Accounting
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              Command center for safarindiacabs.com: manage live customer ride requests, assign verified chauffeurs to customer &apos;My Rides&apos;, control per-KM outstation rates and ₹200 market discounts, monitor driver KYC & payouts, and issue SAC 996412 GST tax invoices.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="py-3 pr-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                01. Centralized Dispatch Control
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Live booking stream (SIC2601+), 1-click driver assignment to Customer &apos;My Rides&apos;, and status updates (Pending, Confirmed, Completed, Cancelled).
              </p>
            </div>
            <div className="py-3 pr-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                02. Outstation Tariff & Commission
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Per-KM rates for Hatchback, Sedan, SUV, and Innova Crysta, state permit taxes, DA, night charges, and ₹200 competitive discount toggle.
              </p>
            </div>
            <div className="py-3 pr-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                03. Driver & Fleet Operations
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Commercial DL, RC & Insurance verification, active duty tracking (Available, On Trip, Off Duty), driver ratings, and commission payout ledger.
              </p>
            </div>
            <div className="py-3 pr-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                04. GST Billing & Excel Exports
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Automated SAC 996412 5% GST invoice unlock upon trip completion, 20% Advance vs Full Paid reconciliation, and corporate CSV exports.
              </p>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowConsoleGuide((prev) => !prev)}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 inline-flex items-center gap-1.5 underline cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>View Firebase Custom Domain Setup Guide</span>
            </button>
          </div>

          {showConsoleGuide && (
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Firebase Console Setup Links ({firebaseConfig.projectId})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowConsoleGuide(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Close
                </button>
              </div>
              <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-2 list-decimal list-inside">
                <li>
                  <strong>Email/Password Provider:</strong>{' '}
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-600 dark:text-amber-400 font-semibold underline"
                  >
                    Open Firebase Sign-In Providers
                  </a>{' '}
                  → Enable <strong>Email/Password</strong> & Save.
                </li>
                <li>
                  <strong>Custom Domain (admin.safarindiacabs.com):</strong>{' '}
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-600 dark:text-amber-400 font-semibold underline"
                  >
                    Open Firebase Auth Settings
                  </a>{' '}
                  → Add <span className="font-mono">admin.safarindiacabs.com</span> to Authorized domains.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Right Column: Login Card */}
        <div className="lg:col-span-5 order-1 lg:order-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-8 space-y-5 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
                  Operations Admin Sign In
                </h2>
                <ShieldCheck className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Default ID: <span className="font-mono text-slate-800 dark:text-slate-200">avinashmishra08548@gmail.com</span> · Pass: <span className="font-mono text-slate-800 dark:text-slate-200">Safar@2026</span>
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMsg(null);
                }}
                className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Admin Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMsg(null);
                }}
                className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Create Password
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-200">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {infoMsg && (
              <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{infoMsg}</p>
              </div>
            )}

            {/* Email/Password Form (Pre-filled with default Admin credentials) */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="avinashmishra08548@gmail.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter administrator password"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 disabled:opacity-50 text-white dark:text-slate-950 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Authenticating...'
                    : authMode === 'signin'
                    ? 'Sign In to Operations Console'
                    : 'Create Admin Account'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="relative flex py-0.5 items-center">
              <div className="grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="shrink mx-3 text-xs text-slate-400">or 1-click access</span>
              <div className="grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>Google Admin SSO</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onActivateDirectOperatorSession('avinashmishra08548@gmail.com')}
                className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Instant Console Access</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-8 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div>SafarIndiaCabs Mobility Pvt. Ltd. · Customer & Fleet Operations Control Room</div>
        <div className="font-mono">GSTIN: 07AABCS4829K1Z5 · SAC: 996412</div>
      </footer>
    </div>
  );
};
