'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import {
  Archive,
  Plus,
  RotateCcw,
  Trash2,
  CheckCircle,
  XCircle,
  Lock,
  Download,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';
import { formatBytes } from '../../../../../lib/utils';

export default function ServerBackupsPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();
  const [backupName, setBackupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [downloadingUuid, setDownloadingUuid] = useState<string | null>(null);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);

  const { data: server } = useQuery({
    queryKey: ['client-server', uuid],
    queryFn: () => fetchApi<any>(`/api/client/servers/${uuid}`),
  });

  const { data: backups, isLoading } = useQuery({
    queryKey: ['server-backups', uuid],
    queryFn: () => fetchApi<any[]>(`/api/client/servers/${uuid}/backups`),
    refetchInterval: (query) => {
      const data = query.state.data as any[];
      return data?.some((b: any) => !b.isSuccessful && !b.completedAt) ? 3000 : false;
    },
  });

  const backupLimit = server?.backupLimit ?? 0;
  const currentCount = (backups || []).length;
  const isLimitReached = backupLimit <= 0 || currentCount >= backupLimit;

  const handleDownloadBackup = async (backup: any) => {
    setDownloadingUuid(backup.uuid);
    try {
      // 1. Direct Node FQDN Download (primary method from Wings daemon on remote node)
      let directSuccess = false;
      try {
        const res = await fetchApi<{ url: string; filename: string }>(
          `/api/client/servers/${uuid}/backups/${backup.uuid}/download`,
        );

        if (res?.url) {
          const isMixedContent =
            typeof window !== 'undefined' &&
            window.location.protocol === 'https:' &&
            res.url.startsWith('http://');

          if (!isMixedContent) {
            const a = document.createElement('a');
            a.href = res.url;
            a.download = res.filename || `${backup.name || 'backup'}.tar.gz`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            directSuccess = true;
          }
        }
      } catch (err: any) {
        console.warn('Direct node download link generation failed, trying proxy stream fallback:', err);
      }

      if (directSuccess) return;

      // 2. Fallback: Stream through panel proxy if mixed-content or direct network blockage
      let token = typeof window !== 'undefined' ? localStorage.getItem('obsidian_session_token') : null;
      if (!token && typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|;\s*)session=([^;]+)/);
        if (match && match[1]) {
          token = decodeURIComponent(match[1]);
          try {
            localStorage.setItem('obsidian_session_token', token);
          } catch {}
        }
      }

      const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
      const downloadUrl = `/api/client/servers/${uuid}/backups/${backup.uuid}/stream${tokenQuery}`;

      const safeName = (backup.name || 'backup').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = safeName.endsWith('.tar.gz') ? safeName : `${safeName}.tar.gz`;

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Failed to download backup: ${err.message || 'Unknown error'}`);
    } finally {
      setTimeout(() => setDownloadingUuid(null), 1000);
    }
  };

  const handleCopyLink = async (backup: any) => {
    try {
      const res = await fetchApi<{ url: string; filename: string }>(
        `/api/client/servers/${uuid}/backups/${backup.uuid}/download`,
      );
      if (res?.url) {
        await navigator.clipboard.writeText(res.url);
        setCopiedUuid(backup.uuid);
        setTimeout(() => setCopiedUuid(null), 2500);
      }
    } catch (err: any) {
      alert(`Failed to get node download link: ${err.message || 'Unknown error'}`);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/client/servers/${uuid}/backups`, {
        method: 'POST',
        body: JSON.stringify({ name: backupName }),
      }),
    onSuccess: () => {
      setIsCreating(false);
      setBackupName('');
      queryClient.invalidateQueries({ queryKey: ['server-backups', uuid] });
    },
    onError: (err: any) => {
      alert(`Failed to create backup: ${err.message || 'Unknown error'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (backupUuid: string) =>
      fetchApi(`/api/client/servers/${uuid}/backups/${backupUuid}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-backups', uuid] });
    },
    onError: (err: any) => {
      alert(`Failed to delete backup: ${err.message || 'Unknown error'}`);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (backupUuid: string) =>
      fetchApi(`/api/client/servers/${uuid}/backups/${backupUuid}/restore`, {
        method: 'POST',
        body: JSON.stringify({ truncateDirectory: false }),
      }),
    onSuccess: () => {
      alert('Backup restoration started in background on Wings daemon.');
    },
    onError: (err: any) => {
      alert(`Failed to restore backup: ${err.message || 'Unknown error'}`);
    },
  });

  return (
    <div className="space-y-4">
      {/* Header action */}
      <div className="flex items-center justify-between bg-surface border border-border rounded-card p-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-text-primary">Server Backups</h3>
            {server && (
              <Badge
                variant={backupLimit <= 0 ? 'error' : currentCount >= backupLimit ? 'warning' : 'outline'}
                className="text-[10px] font-mono tracking-wide"
              >
                {backupLimit <= 0
                  ? 'Backups Disabled (0 Limit)'
                  : `${currentCount} / ${backupLimit} Backups Used`}
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Create snapshot archives of game files and server data
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          disabled={isLimitReached}
          onClick={() => setIsCreating(true)}
          title={
            backupLimit <= 0
              ? 'Backups are disabled for this server by an administrator.'
              : currentCount >= backupLimit
              ? `Backup limit reached (${currentCount}/${backupLimit}). Delete an existing backup to create a new one.`
              : 'Create Backup'
          }
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Create Backup
        </Button>
      </div>

      {/* Creation Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Create New Backup</h3>
            {isLimitReached ? (
              <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-control text-xs text-status-error">
                {backupLimit <= 0
                  ? 'Backups are disabled for this server (backup limit is 0). Contact your administrator.'
                  : `You have reached the server backup limit of ${backupLimit}. Please delete an existing backup before creating a new one.`}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs text-text-secondary">Backup Name (Optional)</label>
                <input
                  type="text"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  placeholder="e.g. Before 1.20 upgrade"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={createMutation.isPending || isLimitReached}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Starting...' : 'Start Backup'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Backups List */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading backups...</div>
        ) : (backups || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No backups created yet for this server.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {backups?.map((backup: any) => (
                <tr key={backup.uuid} className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="px-5 py-3.5 flex items-center gap-2 font-medium text-text-primary">
                    <Archive className="w-4 h-4 text-text-muted" />
                    <span>{backup.name}</span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-text-secondary text-[11px]">
                    {backup.bytes > 0 ? formatBytes(backup.bytes) : 'Calculating...'}
                  </td>
                  <td className="px-5 py-3.5">
                    {backup.isSuccessful ? (
                      <Badge variant="success">READY</Badge>
                    ) : backup.isSuccessful === false && backup.completedAt ? (
                      <Badge variant="error">FAILED</Badge>
                    ) : (
                      <Badge variant="warning" className="animate-pulse">PROCESSING</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-text-muted text-[11px]">
                    {new Date(backup.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-2">
                    {backup.isSuccessful && (
                      <div className="inline-flex items-center gap-1.5 align-middle">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={downloadingUuid === backup.uuid}
                          onClick={() => handleDownloadBackup(backup)}
                          title="Download backup archive (.tar.gz) using Node FQDN"
                          className="text-primary hover:text-primary-hover border-primary/30"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          {downloadingUuid === backup.uuid ? 'Downloading...' : 'Download'}
                        </Button>
                        <button
                          onClick={() => handleCopyLink(backup)}
                          title="Copy direct Node download link (for curl / wget)"
                          className="p-1.5 text-text-muted hover:text-primary transition-colors rounded hover:bg-surface-elevated"
                        >
                          {copiedUuid === backup.uuid ? (
                            <CheckCircle className="w-3.5 h-3.5 text-status-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (confirm('Restore this backup? Existing files may be overwritten.')) {
                          restoreMutation.mutate(backup.uuid);
                        }
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
                    </Button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this backup permanently?')) {
                          deleteMutation.mutate(backup.uuid);
                        }
                      }}
                      className="p-1.5 text-text-muted hover:text-status-error transition-colors rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
