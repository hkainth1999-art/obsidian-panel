'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/layout/sidebar';
import { useAuth } from '../../contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Mail, Clock, Send, RefreshCw, X, AlertTriangle } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Hourly verification reminder popup
  useEffect(() => {
    if (!user || user.emailVerifiedAt || user.isAdmin) {
      setShowEmailModal(false);
      return;
    }

    const checkIntervalMs = 60 * 60 * 1000; // 1 hour

    const evaluatePrompt = () => {
      if (typeof window === 'undefined') return;
      const lastPromptStr = localStorage.getItem('obsidian_email_prompt_ts');
      const now = Date.now();
      if (!lastPromptStr || now - Number(lastPromptStr) >= checkIntervalMs) {
        setShowEmailModal(true);
      }
    };

    // Evaluate immediately on mount
    evaluatePrompt();

    // Re-check every 30 seconds so modal triggers after 1 hour even without page reload
    const interval = setInterval(evaluatePrompt, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleDismissEmailModal = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('obsidian_email_prompt_ts', String(Date.now()));
    }
    setShowEmailModal(false);
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResendingEmail(true);
    setResendStatus(null);
    try {
      const res = await (await import('../../lib/api')).fetchApi('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      setResendStatus(res.message || 'Verification link sent to your email!');
      if (typeof window !== 'undefined') {
        localStorage.setItem('obsidian_email_prompt_ts', String(Date.now()));
      }
    } catch (err: any) {
      setResendStatus(err.message || 'Failed to send verification link.');
    } finally {
      setResendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-text-muted font-mono">Loading Obsidian Panel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex">
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen bg-background min-w-0">
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto min-w-0">
          {/* Unverified email warning banner */}
          {user && !user.emailVerifiedAt && !user.isAdmin && (
            <div className="mb-6 p-4 rounded-card bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Email Verification Required
                </div>
                <p className="text-xs text-text-muted">
                  Your email address (<span className="text-text-primary font-mono">{user.email}</span>) is unverified. Please check your inbox to verify your account.
                </p>
                {resendStatus && (
                  <p className="text-[11px] font-medium text-primary mt-1">{resendStatus}</p>
                )}
              </div>
              <button
                type="button"
                disabled={resendingEmail}
                onClick={handleResendVerification}
                className="shrink-0 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-control text-xs font-medium text-amber-200 transition-colors disabled:opacity-50"
              >
                {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </div>
          )}

          {children}
        </main>
      </div>

      {/* Hourly Email Verification Reminder Modal */}
      {showEmailModal && user && !user.emailVerifiedAt && !user.isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-surface border border-amber-500/40 rounded-card max-w-md w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
            {/* Gradient accent top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-primary to-amber-500" />

            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-control bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <Mail className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-text-primary">Verify Your Email Address</h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Hourly Reminder
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Your email address is unverified. Please verify your account to ensure server notifications and full account security.
                </p>
              </div>
            </div>

            <div className="p-3 bg-surface-elevated border border-border rounded-control flex items-center justify-between text-xs">
              <span className="text-text-muted">Account Email:</span>
              <span className="font-mono font-medium text-text-primary">{user.email}</span>
            </div>

            {resendStatus && (
              <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-control text-xs font-medium text-primary text-center">
                {resendStatus}
              </div>
            )}

            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={handleDismissEmailModal}
                className="px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary transition-colors flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" /> Remind in 1 hour
              </button>

              <button
                type="button"
                disabled={resendingEmail}
                onClick={handleResendVerification}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold rounded-control shadow transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {resendingEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Resend Verification
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
