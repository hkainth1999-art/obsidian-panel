'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/auth-context';
import { Hexagon, Mail, Lock, User, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/button';

export default function RegisterPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already authenticated, redirect to /servers immediately
  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace('/servers');
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed. Please try again.');
      }

      setSuccessMessage(
        data.message || 'Account created! Please check your email inbox to verify your account.',
      );
    } catch (err: any) {
      setError(err.message || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-primary mx-auto mb-4 shadow-xl">
            <Hexagon className="w-7 h-7 fill-primary/10" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Create an Account
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Join Obsidian Panel to manage your game servers
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-card p-6 shadow-2xl">
          {error && (
            <div className="mb-4 p-3 bg-status-error/10 border border-status-error/20 rounded-control text-xs text-status-error flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-sm font-semibold text-text-primary">Check Your Email</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                {successMessage}
              </p>
              <p className="text-[11px] text-text-muted">
                Sent to <strong className="text-text-primary">{email}</strong>. Check your spam folder if you do not see it within a couple minutes.
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
                <label className="text-xs font-medium text-text-secondary">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="yourusername"
                    className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary placeholder:text-text-muted focus:border-primary transition-colors focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Email Address (Gmail, etc.)</label>
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary placeholder:text-text-muted focus:border-primary transition-colors focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
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
                {loading ? 'Creating Account...' : (
                  <>
                    Register Account <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <span className="text-xs text-text-muted">Already have an account? </span>
                <a
                  href="/login"
                  className="text-xs text-primary font-medium hover:underline transition-colors"
                >
                  Sign In
                </a>
              </div>
            </form>
          )}
        </div>

        <p className="text-[11px] text-center text-text-muted mt-6">
          Powered by Obsidian Panel &bull; Compatible with Wings v1.11.13
        </p>
      </div>
    </div>
  );
}
