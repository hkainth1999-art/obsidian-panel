'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Code2,
  Terminal,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { formatDate } from '../../../../lib/utils';

export default function AdminApiKeysPage() {
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [description, setDescription] = useState('');
  const [allowedIpsInput, setAllowedIpsInput] = useState('');

  // One-time secret display modal
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Queries
  const { data: keys, isLoading } = useQuery<any[]>({
    queryKey: ['admin-api-keys'],
    queryFn: () => fetchApi('/api/admin/api-keys'),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => {
      const allowedIps = allowedIpsInput
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      return fetchApi('/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          description: description.trim(),
          allowedIps,
        }),
      });
    },
    onSuccess: (res: any) => {
      setShowCreateModal(false);
      setDescription('');
      setAllowedIpsInput('');
      setNewlyCreatedToken(res.secretToken);
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
    },
    onError: (err: any) => {
      alert(`Failed to create API key: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/api/admin/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
    },
    onError: (err: any) => {
      alert(`Failed to revoke API key: ${err.message}`);
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
            <Key className="w-5 h-5 text-primary" />
            Application API Keys
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Generate and manage Pterodactyl-compatible <code className="text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">ptla_...</code> tokens for Discord bots, WHMCS, billing modules, and automation.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setShowCreateModal(true)}
          className="shrink-0"
        >
          <Plus className="w-4 h-4" /> Create API Key
        </Button>
      </div>

      {/* API Reference Banner */}
      <Card className="p-4 bg-surface-elevated/40 border border-primary/20">
        <div className="flex items-start gap-3">
          <Terminal className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2 text-xs text-text-secondary flex-1">
            <div className="font-semibold text-text-primary flex items-center gap-2">
              <span>Standard Pterodactyl Application API Endpoint Integration</span>
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                100% Pterodactyl Compatible
              </Badge>
            </div>
            <p>
              Use these keys in external tools with header <code className="bg-surface px-1.5 py-0.5 rounded font-mono text-text-primary">Authorization: Bearer ptla_secret_token</code>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-surface p-2 rounded border border-border">
                <span className="text-primary block font-semibold mb-0.5">/api/application/servers</span>
                <span className="text-text-muted text-[10px]">Provision, suspend, build & limits</span>
              </div>
              <div className="bg-surface p-2 rounded border border-border">
                <span className="text-primary block font-semibold mb-0.5">/api/application/users</span>
                <span className="text-text-muted text-[10px]">Create, list & manage client accounts</span>
              </div>
              <div className="bg-surface p-2 rounded border border-border">
                <span className="text-primary block font-semibold mb-0.5">/api/application/nodes</span>
                <span className="text-text-muted text-[10px]">Bare-metal nodes, config & allocations</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* API Keys Table */}
      <Card className="overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated text-text-muted uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-3 px-4">Identifier</th>
                <th className="py-3 px-4">Description / Memo</th>
                <th className="py-3 px-4">Allowed IPs</th>
                <th className="py-3 px-4">Last Used</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    Loading Application API keys...
                  </td>
                </tr>
              ) : !keys || keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Key className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium text-text-primary">No Application API keys yet</p>
                    <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-4">
                      Create a key with <code className="text-primary">ptla_</code> permissions to enable bot automation or billing integration.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowCreateModal(true)}
                    >
                      <Plus className="w-3.5 h-3.5" /> Generate First Key
                    </Button>
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-text-primary">
                      <div className="flex items-center gap-1.5">
                        <span className="text-primary">{k.identifier}</span>
                        <span className="text-text-muted text-[10px]">••••••••</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-text-primary font-medium">
                      {k.description}
                      {k.user && (
                        <span className="block text-[11px] text-text-muted">
                          by {k.user.username}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {k.allowedIps && k.allowedIps.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {k.allowedIps.map((ip: string) => (
                            <Badge key={ip} variant="outline" className="text-[10px] font-mono">
                              {ip}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-text-muted italic text-[11px]">Any IP (Unrestricted)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-text-muted font-mono text-[11px]">
                      {k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-text-muted font-mono text-[11px]">
                      {formatDate(k.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                        onClick={() => {
                          if (
                            confirm(
                              `Are you sure you want to revoke API key "${k.identifier}"? Any connected bots or billing modules will lose access immediately.`,
                            )
                          ) {
                            deleteMutation.mutate(k.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Create API Key */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-text-primary">Generate Application API Key</h3>
            </div>
            <p className="text-xs text-text-muted">
              Application keys provide administrative root privileges across servers, nodes, allocations, and user accounts.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4 pt-1"
            >
              <div>
                <label className="text-xs text-text-secondary font-medium block mb-1">
                  Description / Memo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. WHMCS Billing Module, Discord Bot, Migration Script"
                  className="w-full px-3 py-2 text-xs bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs text-text-secondary font-medium block mb-1">
                  Allowed IP Addresses <span className="text-text-muted">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={allowedIpsInput}
                  onChange={(e) => setAllowedIpsInput(e.target.value)}
                  placeholder="Enter one IP per line or comma-separated (e.g. 192.168.1.5, 10.0.0.0/24). Leave blank to allow all IPs."
                  className="w-full px-3 py-2 text-xs bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono text-[11px]"
                />
                <span className="text-[10px] text-text-muted mt-0.5 block">
                  Restricts API requests exclusively to specified IPv4/IPv6 addresses or CIDR blocks.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createMutation.isPending || !description.trim()}
                >
                  {createMutation.isPending ? 'Generating...' : 'Create Key'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: One-Time Secret Display */}
      {newlyCreatedToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-surface border border-primary/40 rounded-card p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-primary">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h3 className="text-base font-bold text-text-primary">
                Application API Key Created
              </h3>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-card flex items-start gap-2 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                <strong>Important:</strong> This secret key will <strong>never</strong> be shown again. Copy and store it in a secure location (e.g. in your bot or WHMCS configuration).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-text-secondary font-medium">Secret API Token</label>
              <div className="flex items-center gap-2 bg-surface-elevated border border-border p-2.5 rounded font-mono text-xs text-primary break-all select-all">
                <span className="flex-1">{newlyCreatedToken}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(newlyCreatedToken)}
                  className="shrink-0 h-8"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Key
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs text-text-secondary font-medium">Quick cURL Verification Example</label>
              <pre className="p-2.5 bg-black/50 border border-border rounded text-[11px] font-mono text-text-muted overflow-x-auto select-all">
{`curl -X GET "https://${typeof window !== 'undefined' ? window.location.host : 'panel.siliconhost.online'}/api/application/servers" \\
  -H "Authorization: Bearer ${newlyCreatedToken}" \\
  -H "Accept: application/json"`}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setNewlyCreatedToken(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

