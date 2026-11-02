import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Car, Lock, Mail, ArrowRight, AlertCircle, HelpCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

export const LoginScreen: React.FC = () => {
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('avinashmishra08548@gmail.com');
  const [password, setPassword] = useState('');
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
          setInfoMsg('Account created. A verification link has been sent to your email address.');
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const message = err instanceof Error ? err.message : String(err);
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in your Firebase Console. Use Google Admin Sign-In below or follow the 30-second Firebase Console setup steps.'
        );
        setShowConsoleGuide(true);
      } else if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setErrorMsg('Invalid email or password. If this is your first time, switch to "Register Admin Password" or sign in with Google.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Password must be at least 6 characters long.');
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
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Google Sign-In failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-8 px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-amber-400">
            <Car className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 font-display">
            SafarIndiaCabs
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
          <span className="whitespace-nowrap shrink-0">admin.safarindiacabs.com</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap shrink-0">Customer App & Website Control Room</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap shrink-0">SAC 996412 GST Compliant</span>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setShowConsoleGuide((prev) => !prev)}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Firebase Auth Setup Guide
          </button>
        </div>
      </header>

      {/* Main Content Split */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Operational Overview */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-mono text-amber-700 tracking-tight">
              CUSTOMER OPERATIONS PORTAL · SAFARINDIACABS.COM
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight font-display leading-tight">
              Centralized Dispatch, Outstation Tariff Engine & GST Billing Control
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Manage real-time customer bookings from safarindiacabs.com, assign verified chauffeurs to customer rides, control per-KM outstation rates with the ₹200 market discount engine, and issue SAC 996412 GST tax invoices.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div className="py-3 pr-4">
              <div className="text-sm font-semibold text-slate-900">
                01. Live Booking Control Room
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Filter by Booking ID (SIC2601), Customer Phone, Pickup Date, or Status. Assign Driver Name, Phone & Vehicle Plate directly to customer &apos;My Rides&apos;.
              </p>
            </div>
            <div className="py-3 pr-4">
              <div className="text-sm font-semibold text-slate-900">
                02. Outstation Tariff & ₹200 Discount
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Configure Hatchback, Sedan, SUV, and Innova Crysta per-KM rates, state taxes, driver allowance (DA), night charges, and ₹200 competitive discount.
              </p>
            </div>
            <div className="py-3 pr-4">
              <div className="text-sm font-semibold text-slate-900">
                03. One-Click GST Invoice Unlock
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Marking any trip &apos;Completed&apos; automatically generates and unlocks the final 5% GST Invoice on the customer&apos;s safarindiacabs.com account.
              </p>
            </div>
            <div className="py-3 pr-4">
              <div className="text-sm font-semibold text-slate-900">
                04. 20% Advance vs Full Payment Logs
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Track 20% online booking advances vs full payments, balance collectible by driver, duplicate GST invoices, and 1-click Excel/CSV export.
              </p>
            </div>
          </div>

          {showConsoleGuide && (
            <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Enabling Email/Password Sign-In in Firebase Console
                </h2>
                <button
                  type="button"
                  onClick={() => setShowConsoleGuide(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Google Sign-In is pre-configured automatically. To also use Email/Password authentication in your Firebase project (<span className="font-mono text-slate-800">{firebaseConfig.projectId}</span>):
              </p>
              <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside">
                <li>
                  Open the Firebase Console for project <span className="font-mono font-medium">{firebaseConfig.projectId}</span> and go to <strong>Authentication → Sign-in method</strong>.
                </li>
                <li>
                  Click <strong>Add new provider</strong>, select <strong>Email/Password</strong>, toggle <strong>Enable</strong> on, and click <strong>Save</strong>.
                </li>
                <li>
                  Return here and use <strong>Register Admin Password</strong> or sign in directly with your verified Google Admin account below.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Right Column: Login Card */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 font-display">
                  Operations Admin Sign In
                </h2>
                <ShieldCheck className="w-5 h-5 text-slate-700" />
              </div>
              <p className="text-xs text-slate-500">
                Authenticate to access <span className="font-mono text-slate-700">admin.safarindiacabs.com</span>
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMsg(null);
                }}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  authMode === 'signin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Email & Password Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMsg(null);
                }}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  authMode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Register Admin Password
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {infoMsg && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{infoMsg}</p>
              </div>
            )}

            {/* Email/Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="block text-xs font-medium text-slate-700">
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
                    placeholder="admin@safarindiacabs.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="block text-xs font-medium text-slate-700">
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
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Authenticating...'
                    : authMode === 'signin'
                    ? 'Sign In with Email & Password'
                    : 'Create Admin Account'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-slate-200"></div>
              <span className="shrink mx-3 text-xs text-slate-400">or instant verified SSO</span>
              <div className="grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue with Google Admin SSO</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div>SafarIndiaCabs Mobility Pvt. Ltd. · Customer Operations Control Room</div>
        <div className="font-mono">GSTIN: 07AABCS4829K1Z5 · SAC: 996412</div>
      </footer>
    </div>
  );
};
