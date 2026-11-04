'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/auth-context';
import {
  User,
  Mail,
  Shield,
  Globe,
  Image as ImageIcon,
  Upload,
  Trash2,
  Check,
  Sparkles,
  Lock,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { fetchApi } from '../../../lib/api';

export default function AccountPage() {
  const { user, refreshUser } = useAuth();

  // Avatar & Appearance State
  const [avatarUrl, setAvatarUrl] = useState('');
  const [language, setLanguage] = useState('en');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Username State
  const [newUsername, setNewUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Email State
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatarUrl || '');
      setLanguage(user.language || 'en');
      setNewUsername(user.username || '');
      setNewEmail(user.email || '');
    }
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image or GIF file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Image size must be less than 5MB.');
      return;
    }

    setProfileError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setAvatarUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // 1. Update Profile (Avatar & Language)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError('');
    setProfileSuccess(false);

    try {
      await fetchApi('/api/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          avatarUrl: avatarUrl.trim() || null,
          language,
        }),
      });

      await refreshUser();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile settings.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 2. Update Username
  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    setIsSavingUsername(true);
    setUsernameError('');
    setUsernameSuccess(false);

    try {
      await fetchApi('/api/account/username', {
        method: 'PATCH',
        body: JSON.stringify({ username: newUsername.trim() }),
      });

      await refreshUser();
      setUsernameSuccess(true);
      setTimeout(() => setUsernameSuccess(false), 3000);
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username.');
    } finally {
      setIsSavingUsername(false);
    }
  };

  // 3. Update Email (requires current password)
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !emailCurrentPassword) {
      setEmailError('Please provide your new email and current password.');
      return;
    }

    setIsSavingEmail(true);
    setEmailError('');
    setEmailSuccess(false);

    try {
      await fetchApi('/api/account/email', {
        method: 'PATCH',
        body: JSON.stringify({
          email: newEmail.trim(),
          currentPassword: emailCurrentPassword,
        }),
      });

      await refreshUser();
      setEmailCurrentPassword('');
      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 3000);
    } catch (err: any) {
      setEmailError(err.message || 'Failed to update email address.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  // 4. Update Password (requires current password)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordError('Please provide your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsSavingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      await fetchApi('/api/account/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Account Settings &amp; Security
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          Manage your account credentials, login credentials, and profile customization
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Update Username Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>Change Username</CardTitle>
                <CardDescription>
                  Update your public display and login username
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleUpdateUsername} className="p-4 pt-0 space-y-4 text-xs flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">
                  Current Username
                </label>
                <div className="p-2 bg-surface-elevated border border-border rounded-control font-mono text-text-muted">
                  {user?.username}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">
                  New Username <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter new username"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-text-muted mt-0.5 block">
                  Letters, numbers, underscores, and hyphens (min 3 chars).
                </span>
              </div>

              {usernameError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-control text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{usernameError}</span>
                </div>
              )}

              {usernameSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-control text-xs text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Username updated successfully!</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSavingUsername || !newUsername.trim() || newUsername === user?.username}
              >
                {isSavingUsername ? 'Saving...' : 'Update Username'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Update Email Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>Change Email Address</CardTitle>
                <CardDescription>
                  Requires your current password for security verification
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleUpdateEmail} className="p-4 pt-0 space-y-4 text-xs flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">
                  New Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="yourname@domain.com"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">
                  Current Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={emailCurrentPassword}
                    onChange={(e) => setEmailCurrentPassword(e.target.value)}
                    placeholder="Enter current password to confirm"
                    className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {emailError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-control text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{emailError}</span>
                </div>
              )}

              {emailSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-control text-xs text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Email address updated successfully!</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSavingEmail || !newEmail.trim() || !emailCurrentPassword}
              >
                {isSavingEmail ? 'Saving...' : 'Update Email'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <div>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your account password with your current password verification
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleUpdatePassword} className="p-4 pt-0 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">
                Current Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">
                New Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">
                Confirm New Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {passwordError && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-control text-xs text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-control text-xs text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Password updated successfully!</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSavingPassword || !currentPassword || !newPassword || newPassword.length < 8}
            >
              {isSavingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Profile Customization Card (Avatar & Language) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <div>
              <CardTitle>Avatar &amp; Appearance</CardTitle>
              <CardDescription>
                Upload or link a custom profile picture or animated GIF to personalize your session
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSaveProfile} className="space-y-5 p-4 pt-0 text-xs">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-4 bg-surface-elevated/50 border border-border rounded-control">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-surface border-2 border-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.15)] flex items-center justify-center font-mono text-xl font-bold text-primary overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile Avatar"
                    className="w-full h-full object-cover"
                    onError={() => setProfileError('Failed to load image preview from provided URL.')}
                  />
                ) : (
                  user?.username ? user.username.slice(0, 2).toUpperCase() : 'U'
                )}
              </div>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  title="Remove avatar"
                  className="absolute -top-1.5 -right-1.5 p-1 bg-surface border border-rose-500/40 text-rose-400 rounded-full hover:bg-rose-500 hover:text-white transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-3 flex-1 w-full">
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">
                  Avatar Image or Animated GIF URL
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ImageIcon className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://example.com/avatar.gif or image URL"
                      className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-elevated border border-border text-text-primary rounded-control text-xs font-medium transition-colors shrink-0">
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    <span>Upload GIF/Image</span>
                    <input
                      type="file"
                      accept="image/*,.gif"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-[10px] text-text-muted mt-1">
                  Supports animated GIFs, PNG, JPG, WebP (up to 5MB file upload or direct HTTPS link).
                </p>
              </div>

              {/* Language Selector */}
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">
                  Interface Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                >
                  <option value="en">English (US / Default)</option>
                  <option value="es">Español (Spanish)</option>
                  <option value="de">Deutsch (German)</option>
                  <option value="fr">Français (French)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="pt">Português (Portuguese)</option>
                </select>
              </div>
            </div>
          </div>

          {profileError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-control text-xs text-rose-400">
              {profileError}
            </div>
          )}

          {profileSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-control text-xs text-emerald-400 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Profile settings updated successfully!</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSavingProfile}
            >
              <Check className="w-4 h-4 mr-1.5" />
              {isSavingProfile ? 'Saving...' : 'Save Appearance'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Session & Identity Details Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Session &amp; Identity Details</CardTitle>
            <CardDescription>
              Basic identity information tied to your Obsidian session.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-4 p-4 pt-0 text-xs">
          <div className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-control">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-text-muted" />
              <span className="text-text-secondary">Username</span>
            </div>
            <span className="font-semibold text-text-primary font-mono">
              {user?.username}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-control">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-text-muted" />
              <span className="text-text-secondary">Email Address</span>
            </div>
            <span className="font-mono text-text-primary">
              {user?.email}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-control">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-text-muted" />
              <span className="text-text-secondary">Role</span>
            </div>
            <Badge variant={user?.isAdmin ? 'info' : 'default'}>
              {user?.isAdmin ? 'ADMINISTRATOR' : 'CUSTOMER'}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
