'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import { Users, UserPlus, Trash2, Shield } from 'lucide-react';
import { Button } from '../../../../../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Badge } from '../../../../../components/ui/badge';
import { Permission } from '@obsidian/permissions';

export default function ServerUsersPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    Permission.CONTROL_CONSOLE,
    Permission.CONTROL_START,
    Permission.CONTROL_STOP,
    Permission.CONTROL_RESTART,
    Permission.FILE_READ,
  ]);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: subusers, isLoading } = useQuery<any[]>({
    queryKey: ['server-subusers', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}/subusers`),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/client/servers/${uuid}/subusers`, {
        method: 'POST',
        body: JSON.stringify({ email, permissions: selectedPermissions }),
      }),
    onSuccess: () => {
      setShowAddModal(false);
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['server-subusers', uuid] });
    },
    onError: (err: any) => {
      alert(`Failed to add subuser: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (subuserId: number) =>
      fetchApi(`/api/client/servers/${uuid}/subusers/${subuserId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-subusers', uuid] });
    },
  });

  const allPermissionList = [
    { key: Permission.CONTROL_CONSOLE, label: 'Access Console' },
    { key: Permission.CONTROL_START, label: 'Start Server' },
    { key: Permission.CONTROL_STOP, label: 'Stop Server' },
    { key: Permission.CONTROL_RESTART, label: 'Restart Server' },
    { key: Permission.FILE_READ, label: 'Read Files' },
    { key: Permission.FILE_UPDATE, label: 'Write Files' },
    { key: Permission.FILE_DELETE, label: 'Delete Files' },
    { key: Permission.BACKUP_CREATE, label: 'Create Backups' },
    { key: Permission.BACKUP_RESTORE, label: 'Restore Backups' },
  ];

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-surface border border-border rounded-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Subuser Management</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Grant team members granular permissions to manage this server
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          <UserPlus className="w-3.5 h-3.5" /> Add Subuser
        </Button>
      </div>

      {/* Add Subuser Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-border rounded-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Invite Subuser</h3>

            <div className="space-y-1.5">
              <label className="text-xs text-text-secondary">User Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@domain.com"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary block">
                Assign Permissions
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {allPermissionList.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(p.key)}
                      onChange={() => togglePermission(p.key)}
                      className="accent-primary"
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={addMutation.isPending || !email}
                onClick={() => addMutation.mutate()}
              >
                Invite Subuser
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Subusers List */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading subusers...</div>
        ) : (subusers || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No subusers have been invited to this server yet.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Permissions</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {subusers?.map((sub: any) => (
                <tr key={sub.id} className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-text-primary flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>{sub.user.username}</span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary font-mono text-[11px]">
                    {sub.user.email}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="default">
                      {sub.permissions.length} PERMISSION(S)
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove access for ${sub.user.username}?`)) {
                          deleteMutation.mutate(sub.id);
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
