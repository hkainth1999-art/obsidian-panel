'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { formatDate } from '../../../lib/utils';

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState('');
  const [allowedIpsInput, setAllowedIpsInput] = useState('');

  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys, isLoading } = useQuery<any[]>({
    queryKey: ['account-api-keys'],
    queryFn: () => fetchApi('/api/account/api-keys'),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const allowedIps = allowedIpsInput
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      return fetchApi('/api/account/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          description: description.trim(),
          allowedIps,
        }),
      });
    },
    onSuccess: (res: any) => {
      setShowModal(false);
      setDescription('');
      setAllowedIpsInput('');
      setNewlyCreatedToken(res.secretToken);
      queryClient.invalidateQueries({ queryKey: ['account-api-keys'] });
    },
    onError: (err: any) => {
      alert(`Failed to create API key: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/api/account/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-api-keys'] });
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
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Account API Keys
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage personal client API tokens (<code className="text-primary font-mono">ptlc_...</code>) for automating tasks with your servers.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Create API Key
        </Button>
      </div>

      <Card className="overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated text-text-muted uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-3 px-4">Identifier</th>
                <th className="py-3 px-4">Description</th>
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
                    Loading API keys...
                  </td>
                </tr>
              ) : !keys || keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Key className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium text-text-primary">No API keys yet</p>
                    <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-4">
                      API keys allow programmatic access to your game servers without exposing your web session.
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
                      <Plus className="w-3.5 h-3.5" /> Generate First Key
                    </Button>
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-text-primary">
                      <span className="text-primary">{k.identifier}</span>
                      <span className="text-text-muted text-[10px]">••••••••</span>
                    </td>
                    <td className="py-3.5 px-4 text-text-primary font-medium">
                      {k.description}
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
                        <span className="text-text-muted italic text-[11px]">Any IP</span>
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
                          if (confirm(`Revoke API key "${k.identifier}"?`)) {
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

      {/* Modal: Create */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Create Client API Key</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-secondary font-medium block mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Discord Bot, Backup Script"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">Allowed IPs (Optional)</label>
                <input
                  type="text"
                  value={allowedIpsInput}
                  onChange={(e) => setAllowedIpsInput(e.target.value)}
                  placeholder="e.g. 192.168.1.1 (leave blank for any IP)"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={createMutation.isPending || !description.trim()}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Generating...' : 'Create Key'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Secret */}
      {newlyCreatedToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-primary/40 rounded-card p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-text-primary">Client API Key Created</h3>
            </div>

            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>This token will not be displayed again. Store it securely.</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 bg-surface-elevated border border-border p-2 rounded font-mono text-xs text-primary break-all select-all">
                <span className="flex-1">{newlyCreatedToken}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(newlyCreatedToken)}
                  className="shrink-0 h-7"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="primary" size="sm" onClick={() => setNewlyCreatedToken(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
