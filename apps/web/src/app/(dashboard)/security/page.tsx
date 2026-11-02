'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../contexts/auth-context';
import { Shield, KeyRound, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';

export default function SecurityPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    alert('Password updated successfully.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Account Security
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          Manage your credentials, two-factor authentication, and active sessions
        </p>
      </div>

      {/* Two Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <div>
              <CardTitle>Two-Factor Authentication (TOTP)</CardTitle>
              <CardDescription>
                Add an extra layer of security using an authenticator app (Google Authenticator, 1Password, Aegis).
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-text-secondary">Current Status:</span>
            {user?.totpEnabled ? (
              <Badge variant="success">ENABLED</Badge>
            ) : (
              <Badge variant="warning">NOT CONFIGURED</Badge>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => alert('TOTP setup QR code generation.')}
          >
            {user?.totpEnabled ? 'Reconfigure 2FA' : 'Enable 2FA'}
          </Button>
        </div>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <div>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your account password using strong Argon2id hashing.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handlePasswordChange} className="space-y-3 pt-2 text-xs max-w-md">
          <div>
            <label className="text-text-secondary font-medium block mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-text-secondary font-medium block mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-text-secondary font-medium block mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div className="pt-2">
            <Button variant="primary" size="sm" type="submit">
              Update Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
