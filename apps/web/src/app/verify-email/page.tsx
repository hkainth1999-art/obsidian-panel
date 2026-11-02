'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Hexagon, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !email) {
      setLoading(false);
      setMessage('Missing verification token or email in URL.');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Verification failed.');
        }

        setSuccess(true);
        setMessage(data.message || 'Your email address has been verified!');
      } catch (err: any) {
        setSuccess(false);
        setMessage(err.message || 'Invalid or expired verification link.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token, email]);

  return (
    <div className="bg-surface border border-border rounded-card p-6 shadow-2xl text-center space-y-4">
      {loading ? (
        <div className="py-6 space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs text-text-secondary">Verifying your email token...</p>
        </div>
      ) : success ? (
        <div className="py-4 space-y-4">
          <div className="w-12 h-12 rounded-full bg-status-success/10 border border-status-success/20 flex items-center justify-center text-status-success mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary">Email Verified!</h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            {message}
          </p>
          <Button
            variant="primary"
            className="w-full mt-4"
            onClick={() => (window.location.href = '/login')}
          >
            Proceed to Sign In <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="py-4 space-y-4">
          <div className="w-12 h-12 rounded-full bg-status-error/10 border border-status-error/20 flex items-center justify-center text-status-error mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary">Verification Failed</h2>
          <p className="text-xs text-status-error leading-relaxed">
            {message}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="secondary"
              className="w-full text-xs"
              onClick={() => (window.location.href = '/register')}
            >
              Register a New Account
            </Button>
            <Button
              variant="ghost"
              className="w-full text-xs text-text-muted hover:text-text-primary"
              onClick={() => (window.location.href = '/login')}
            >
              Return to Sign In
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-primary mx-auto mb-4 shadow-xl">
            <Hexagon className="w-7 h-7 fill-primary/10" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Email Verification
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Obsidian Panel Account Activation
          </p>
        </div>

        <Suspense
          fallback={
            <div className="bg-surface border border-border rounded-card p-6 shadow-2xl text-center py-6">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
