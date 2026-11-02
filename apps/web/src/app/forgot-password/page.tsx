'use client';

import React, { useState } from 'react';
import { Hexagon, Mail, ArrowRight, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to request password reset.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-primary mx-auto mb-4 shadow-xl">
            <Hexagon className="w-7 h-7 fill-primary/10" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Reset Password
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Enter your email to receive a password recovery link
          </p>
        </div>

        <div className="bg-surface border border-border rounded-card p-6 shadow-2xl">
          {error && (
            <div className="mb-4 p-3 bg-status-error/10 border border-status-error/20 rounded-control text-xs text-status-error flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {submitted ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-sm font-semibold text-text-primary">Check Your Email</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                If an account matches <strong className="text-text-primary">{email}</strong>, we have dispatched a secure password reset link.
              </p>
              <p className="text-[11px] text-text-muted">
                The link is valid for 1 hour. Be sure to check your spam or promotional folders.
              </p>
              <div className="pt-2">
                <Button
                  variant="secondary"
                  className="w-full text-xs"
                  onClick={() => (window.location.href = '/login')}
                >
                  Return to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary placeholder:text-text-muted focus:border-primary transition-colors focus:outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full mt-2"
              >
                {loading ? 'Sending link...' : (
                  <>
                    Send Reset Link <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <a
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to Sign In
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
