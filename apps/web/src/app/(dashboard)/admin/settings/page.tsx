'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import { useSettings } from '../../../../contexts/settings-context';
import { Settings, Palette, Shield, Save, CheckCircle2, Mail, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { refreshSettings } = useSettings();

  const [panelName, setPanelName] = useState('Obsidian Panel');
  const [accentColor, setAccentColor] = useState('#06B6D4');
  const [appUrl, setAppUrl] = useState('');
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [requireMfa, setRequireMfa] = useState(false);
  const [mailHost, setMailHost] = useState('');
  const [mailPort, setMailPort] = useState(587);
  const [mailUsername, setMailUsername] = useState('');
  const [mailPassword, setMailPassword] = useState('');
  const [mailEncryption, setMailEncryption] = useState<'tls' | 'ssl' | 'none'>('tls');
  const [mailFromAddress, setMailFromAddress] = useState('');
  const [mailFromName, setMailFromName] = useState('Obsidian Panel');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load current settings from backend
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['admin-settings'],
    queryFn: () => fetchApi('/api/admin/settings'),
  });

  useEffect(() => {
    if (settings) {
      if (settings.panelName) setPanelName(settings.panelName);
      if (settings.accentColor) setAccentColor(settings.accentColor);
      if (settings.appUrl !== undefined) setAppUrl(settings.appUrl);
      if (settings.allowRegistration !== undefined) setAllowRegistration(settings.allowRegistration);
      if (settings.requireMfa !== undefined) setRequireMfa(settings.requireMfa);
      if (settings.mailHost !== undefined) setMailHost(settings.mailHost);
      if (settings.mailPort !== undefined) setMailPort(settings.mailPort);
      if (settings.mailUsername !== undefined) setMailUsername(settings.mailUsername);
      if (settings.mailPassword !== undefined) setMailPassword(settings.mailPassword);
      if (settings.mailEncryption !== undefined) setMailEncryption(settings.mailEncryption);
      if (settings.mailFromAddress !== undefined) setMailFromAddress(settings.mailFromAddress);
      if (settings.mailFromName !== undefined) setMailFromName(settings.mailFromName);
    }
  }, [settings]);

  // Mutation to save settings
  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      fetchApi('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      await refreshSettings();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    },
    onError: (err: any) => {
      alert(`Failed to save settings: ${err.message}`);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      panelName: panelName.trim(),
      accentColor: accentColor.trim(),
      appUrl: appUrl.trim(),
      allowRegistration,
      requireMfa,
      mailHost: mailHost.trim(),
      mailPort: Number(mailPort),
      mailUsername: mailUsername.trim(),
      mailPassword,
      mailEncryption,
      mailFromAddress: mailFromAddress.trim(),
      mailFromName: mailFromName.trim(),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          System &amp; Branding Settings
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          Configure branding identity and security baselines
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-card flex items-center gap-2.5 text-xs text-emerald-400 font-medium animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Branding and panel settings saved successfully! Theme accent color updated.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Branding Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>Branding &amp; Theme</CardTitle>
                <CardDescription>
                  Customize the panel title and accent theme colors. Changes take effect across all pages and navigation.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-text-secondary font-medium block mb-1">
                Panel Name
              </label>
              <input
                type="text"
                required
                value={panelName}
                onChange={(e) => setPanelName(e.target.value)}
                placeholder="e.g. SiliconHost Control Panel"
                className="w-full max-w-md px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-text-secondary font-medium block mb-1">
                Theme Accent Color (HEX)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-9 h-9 rounded-control bg-transparent border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#06B6D4"
                  className="w-32 px-3 py-2 bg-surface-elevated border border-border rounded-control font-mono text-xs text-text-primary focus:outline-none focus:border-primary uppercase"
                />
                {/* Live color preview pill */}
                <span
                  className="px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  Accent Preview
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Public Application URL (Pre-filled from installation) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <div>
                  <CardTitle>Public Application URL (APP_URL)</CardTitle>
                  <CardDescription>
                    The public FQDN that users and Wings daemons connect back to. Pre-filled from your installation setup.
                  </CardDescription>
                </div>
              </div>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary font-mono font-medium">
                Installation Setup
              </span>
            </div>
          </CardHeader>

          <div className="pt-2">
            <label className="text-xs text-text-secondary font-medium block mb-1">
              Application Public Endpoint
            </label>
            <input
              type="text"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="https://panel.siliconhost.online"
              className="w-full max-w-lg px-3 py-2 bg-surface-elevated border border-border rounded-control font-mono text-xs text-text-primary focus:outline-none focus:border-primary"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Must match the remote endpoint defined in your Wings nodes' <code className="text-primary font-mono">config.yml</code>.
            </p>
          </div>
        </Card>

        {/* Mail Server (SMTP) Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <div>
                  <CardTitle>Mail Server (SMTP) Settings</CardTitle>
                  <CardDescription>
                    Configure outbound SMTP mail delivery for verification, password resets, and user notifications.
                  </CardDescription>
                </div>
              </div>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary font-mono font-medium">
                Installation Setup
              </span>
            </div>
          </CardHeader>

          <div className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-text-secondary font-medium block mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={mailHost}
                  onChange={(e) => setMailHost(e.target.value)}
                  placeholder="smtp.mailgun.org or mail.example.com"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={mailPort}
                  onChange={(e) => setMailPort(Number(e.target.value))}
                  placeholder="587"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  SMTP Username
                </label>
                <input
                  type="text"
                  value={mailUsername}
                  onChange={(e) => setMailUsername(e.target.value)}
                  placeholder="postmaster@domain.com"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  SMTP Password
                </label>
                <input
                  type="password"
                  value={mailPassword}
                  onChange={(e) => setMailPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  Encryption
                </label>
                <select
                  value={mailEncryption}
                  onChange={(e) => setMailEncryption(e.target.value as any)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="tls">STARTTLS (Port 587)</option>
                  <option value="ssl">SSL / TLS (Port 465)</option>
                  <option value="none">None (Port 25)</option>
                </select>
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  From Address
                </label>
                <input
                  type="email"
                  value={mailFromAddress}
                  onChange={(e) => setMailFromAddress(e.target.value)}
                  placeholder="noreply@domain.com"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  From Name
                </label>
                <input
                  type="text"
                  value={mailFromName}
                  onChange={(e) => setMailFromName(e.target.value)}
                  placeholder="Obsidian Panel"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Security & Access Policies */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>Access &amp; Authentication Policy</CardTitle>
                <CardDescription>
                  Global rules for registrations, user sessions, and MFA.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <div className="space-y-3 pt-2 text-xs">
            <label className="flex items-center gap-2.5 text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={allowRegistration}
                onChange={(e) => setAllowRegistration(e.target.checked)}
                className="accent-primary"
              />
              <span>Allow public user self-registration (Default: Disabled)</span>
            </label>

            <label className="flex items-center gap-2.5 text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={requireMfa}
                onChange={(e) => setRequireMfa(e.target.checked)}
                className="accent-primary"
              />
              <span>Enforce mandatory Two-Factor Authentication (TOTP) for administrators</span>
            </label>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={saveMutation.isPending || isLoading}
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saveMutation.isPending ? 'Saving...' : 'Save System Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
