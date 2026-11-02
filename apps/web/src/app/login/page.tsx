'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/auth-context';
import { useSettings } from '../../contexts/settings-context';
import { Hexagon, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, login } = useAuth();
  const { panelName } = useSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      const res = await login({
        username,
        password,
        totpToken: requiresTotp ? totpToken : undefined,
      });

      if (res.requiresTotp) {
        setRequiresTotp(true);
      } else {
        window.location.href = '/servers';
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Subtle background ambient gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-primary mx-auto mb-4 shadow-xl">
            <Hexagon className="w-7 h-7 fill-primary/10" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            {panelName || 'Obsidian Panel'}
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Sign in to manage your game server infrastructure
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-border rounded-card p-6 shadow-2xl">
          {error && (
            <div className="mb-4 p-3 bg-status-error/10 border border-status-error/20 rounded-control text-xs text-status-error flex items-center gap-2">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!requiresTotp ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    Username or Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin or user@domain.com"
                      className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary placeholder:text-text-muted focus:border-primary transition-colors focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-text-secondary">
                      Password
                    </label>
                    <a
                      href="/forgot-password"
                      className="text-[11px] text-primary hover:underline transition-colors"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary placeholder:text-text-muted focus:border-primary transition-colors focus:outline-none"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-primary font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  Two-Factor Authentication Required
                </div>
                <label className="text-xs text-text-secondary">
                  Enter the 6-digit authenticator code or backup recovery code
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={12}
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-center font-mono text-base tracking-widest text-text-primary placeholder:text-text-muted focus:border-primary transition-colors focus:outline-none"
                />
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full mt-2"
            >
              {loading ? (
                'Authenticating...'
              ) : requiresTotp ? (
                'Verify & Continue'
              ) : (
                <>
                  Sign In <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>

            <div className="text-center pt-2">
              <span className="text-xs text-text-muted">Don't have an account? </span>
              <a
                href="/register"
                className="text-xs text-primary font-medium hover:underline transition-colors"
              >
                Create one
              </a>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-center text-text-muted mt-6">
          Powered by Obsidian Panel &bull; Compatible with Wings v1.11.13
        </p>
      </div>
    </div>
  );
}
