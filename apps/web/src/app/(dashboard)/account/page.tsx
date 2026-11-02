'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/auth-context';
import { User, Mail, Shield, Globe, Image as ImageIcon, Upload, Trash2, Check, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { fetchApi } from '../../../lib/api';

export default function AccountPage() {
  const { user, refreshUser } = useAuth();

  const [avatarUrl, setAvatarUrl] = useState('');
  const [language, setLanguage] = useState('en');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatarUrl || '');
      setLanguage(user.language || 'en');
    }
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image or GIF file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size must be less than 5MB.');
      return;
    }

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setAvatarUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    setSaveSuccess(false);

    try {
      await fetchApi('/api/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          avatarUrl: avatarUrl.trim() || null,
          language,
        }),
      });

      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Account Profile &amp; Customization
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          Customize your profile avatar (supports static images &amp; animated GIFs), language preferences, and view identity roles
        </p>
      </div>

      {/* Profile Customization Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <div>
              <CardTitle>Avatar &amp; Appearance</CardTitle>
              <CardDescription>
                Upload or link a custom profile picture or animated GIF to personalize your session across the panel.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSaveProfile} className="space-y-5 pt-2 text-xs">
          {/* Avatar Preview & Controls */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-4 bg-surface-elevated/50 border border-border rounded-control">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-surface border-2 border-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.15)] flex items-center justify-center font-mono text-xl font-bold text-primary overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile Avatar"
                    className="w-full h-full object-cover"
                    onError={() => setErrorMsg('Failed to load image preview from provided URL.')}
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

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-control text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-control text-xs text-emerald-400 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Profile settings and custom avatar updated successfully!</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaving}
            >
              <Check className="w-4 h-4 mr-1.5" />
              {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Profile Details Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Session &amp; Identity Details</CardTitle>
            <CardDescription>
              Basic identity information tied to your Obsidian session.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-4 pt-2 text-xs">
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

          <div className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-control">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-text-muted" />
              <span className="text-text-secondary">Language</span>
            </div>
            <span className="font-mono text-text-primary uppercase">
              {user?.language || 'en'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
