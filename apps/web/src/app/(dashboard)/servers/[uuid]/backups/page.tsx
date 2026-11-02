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

  const { data: backups, isLoading } = useQuery({
    queryKey: ['server-backups', uuid],
    queryFn: () => fetchApi<any[]>(`/api/client/servers/${uuid}/backups`),
  });

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
  });

  const deleteMutation = useMutation({
    mutationFn: (backupUuid: string) =>
      fetchApi(`/api/client/servers/${uuid}/backups/${backupUuid}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-backups', uuid] });
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
  });

  return (
    <div className="space-y-4">
      {/* Header action */}
      <div className="flex items-center justify-between bg-surface border border-border rounded-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Server Backups</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Create snapshot archives of game files and databases
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Create Backup
        </Button>
      </div>

      {/* Creation Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Create New Backup</h3>
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Start Backup
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
                    ) : (
                      <Badge variant="warning">PROCESSING</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-text-muted text-[11px]">
                    {new Date(backup.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-2">
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
