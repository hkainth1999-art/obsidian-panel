'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import {
  Key,
  User as UserIcon,
  Mail,
  Shield,
  Server,
  Lock,
  ArrowRightLeft,
  Search,
  ExternalLink,
  Check,
  AlertCircle,
  Eye,
  RefreshCw,
  HardDrive,
  Cpu,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { formatMemory } from '../../../../lib/utils';
import Link from 'next/link';

export default function AdminCredentialsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Edit Credentials State
  const [newPassword, setNewPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [transferTargetUserId, setTransferTargetUserId] = useState<Record<number, number>>({});
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Queries
  const { data: usersData, isLoading: isUsersLoading, refetch: refetchUsers } = useQuery<any>({
    queryKey: ['admin-credentials-users'],
    queryFn: () => fetchApi('/api/admin/users?perPage=100'),
  });

  const {
    data: selectedUserDetails,
    isLoading: isDetailsLoading,
    refetch: refetchDetails,
  } = useQuery<any>({
    queryKey: ['admin-user-details', selectedUserId],
    queryFn: () => fetchApi(`/api/admin/users/${selectedUserId}`),
    enabled: selectedUserId !== null,
  });

  const allUsers = usersData?.data || [];
  const filteredUsers = allUsers.filter(
    (u: any) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      String(u.id).includes(search),
  );

  // Mutations
  const updatePasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      fetchApi(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      setNewPassword('');
      setActionSuccess('Password updated and re-encrypted successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      refetchDetails();
    },
    onError: (err: any) => {
      setActionError(`Failed to update password: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: ({ userId, email }: { userId: number; email: string }) =>
      fetchApi(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => {
      setActionSuccess('User email updated successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      refetchDetails();
      refetchUsers();
    },
    onError: (err: any) => {
      setActionError(`Failed to update email: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    },
  });

  const transferServerMutation = useMutation({
    mutationFn: ({ serverId, newOwnerId }: { serverId: number; newOwnerId: number }) =>
      fetchApi('/api/admin/users/transfer-server', {
        method: 'POST',
        body: JSON.stringify({ serverIdOrUuid: serverId, newOwnerId }),
      }),
    onSuccess: (data: any) => {
      setActionSuccess(data.message || 'Server ownership transferred successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      refetchDetails();
      refetchUsers();
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
    },
    onError: (err: any) => {
      setActionError(`Failed to transfer server: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    },
  });

  const handleSelectUser = (user: any) => {
    setSelectedUserId(user.id);
    setEditEmail(user.email);
    setEditUsername(user.username);
    setNewPassword('');
    setActionSuccess(null);
    setActionError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> Credentials &amp; Account Control
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            1-Click User Lookup: change passwords, update emails, inspect owned servers, and transfer server ownership
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search user by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
            />
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-control text-xs text-emerald-400 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-control text-xs text-rose-400 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Grid: User List (Left) + Detailed Credentials & Servers (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: All Users */}
        <div className="lg:col-span-5 bg-surface border border-border rounded-card overflow-hidden flex flex-col h-[750px]">
          <div className="p-3.5 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                All Users ({filteredUsers.length})
              </h3>
            </div>
            <span className="text-[10px] text-text-muted">Click row for credentials</span>
          </div>

          <div className="divide-y divide-border/50 overflow-y-auto flex-1">
            {isUsersLoading ? (
              <div className="p-8 text-center text-xs text-text-muted">Loading accounts...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">No users found.</div>
            ) : (
              filteredUsers.map((u: any) => {
                const isSelected = selectedUserId === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-l-4 border-l-primary'
                        : 'hover:bg-surface-elevated/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center font-mono text-xs font-bold text-primary shrink-0 overflow-hidden">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                        ) : (
                          u.username.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary truncate">
                            {u.username}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono">#{u.id}</span>
                        </div>
                        <p className="text-[11px] text-text-muted truncate font-mono">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={u.isAdmin ? 'info' : 'default'} className="text-[10px]">
                        {u.isAdmin ? 'ADMIN' : 'USER'}
                      </Badge>
                      <span className="text-[10px] text-text-muted font-mono bg-surface px-1.5 py-0.5 rounded border border-border">
                        {u._count?.servers ?? 0} srv
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected User Credentials & Servers */}
        <div className="lg:col-span-7 space-y-6">
          {!selectedUserId ? (
            <div className="h-[750px] bg-surface border border-border/80 border-dashed rounded-card flex flex-col items-center justify-center p-8 text-center text-text-muted">
              <Key className="w-12 h-12 text-zinc-600 mb-3" />
              <h3 className="text-sm font-semibold text-text-primary">No User Selected</h3>
              <p className="text-xs text-text-muted max-w-sm mt-1">
                Click on any user from the list on the left to view credentials, reset password, change email, and manage or transfer their servers.
              </p>
            </div>
          ) : isDetailsLoading ? (
            <div className="h-[750px] bg-surface border border-border rounded-card flex items-center justify-center text-xs text-text-muted">
              Loading user credentials...
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Overview & Credentials Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-primary/40 shadow-[0_0_15px_rgba(34,197,94,0.15)] flex items-center justify-center font-mono text-base font-bold text-primary overflow-hidden">
                        {selectedUserDetails?.avatarUrl ? (
                          <img
                            src={selectedUserDetails.avatarUrl}
                            alt={selectedUserDetails.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          selectedUserDetails?.username?.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>{selectedUserDetails?.username}</span>
                          <Badge variant={selectedUserDetails?.isAdmin ? 'info' : 'default'} className="text-[10px]">
                            {selectedUserDetails?.isAdmin ? 'ADMINISTRATOR' : 'CUSTOMER'}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="font-mono text-[11px]">
                          UUID: {selectedUserDetails?.uuid} &bull; ID: #{selectedUserDetails?.id}
                        </CardDescription>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => refetchDetails()}
                      title="Refresh details"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>

                <div className="p-4 space-y-4 pt-1 text-xs">
                  {/* Password Change / Lookup */}
                  <div className="p-3 bg-surface-elevated/50 border border-border rounded-control space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text-primary flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        Admin Password Override / Reset
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">Argon2id Hash</span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Enter new account password..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!newPassword || updatePasswordMutation.isPending}
                        onClick={() =>
                          updatePasswordMutation.mutate({
                            userId: selectedUserDetails.id,
                            password: newPassword,
                          })
                        }
                      >
                        {updatePasswordMutation.isPending ? 'Updating...' : 'Set Password'}
                      </Button>
                    </div>
                  </div>

                  {/* Email Change */}
                  <div className="p-3 bg-surface-elevated/50 border border-border rounded-control space-y-2">
                    <span className="font-medium text-text-primary flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-cyan-400" />
                      Email Lookup &amp; Modification
                    </span>

                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!editEmail || editEmail === selectedUserDetails.email || updateEmailMutation.isPending}
                        onClick={() =>
                          updateEmailMutation.mutate({
                            userId: selectedUserDetails.id,
                            email: editEmail,
                          })
                        }
                      >
                        {updateEmailMutation.isPending ? 'Saving...' : 'Update Email'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px] text-text-muted">
                    <div>
                      <span className="block text-text-secondary font-medium">Registration Date</span>
                      <span className="font-mono">{new Date(selectedUserDetails?.createdAt).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="block text-text-secondary font-medium">Two-Factor Authentication</span>
                      <span className={selectedUserDetails?.totpEnabled ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                        {selectedUserDetails?.totpEnabled ? 'Enabled (TOTP Active)' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* User Owned Servers & Transfer Ownership Card */}
              <div className="bg-surface border border-border rounded-card overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                      Owned Servers ({selectedUserDetails?.servers?.length || 0})
                    </h3>
                  </div>
                  <span className="text-[11px] text-text-muted">
                    1-Click Ownership Transfer available per server
                  </span>
                </div>

                {(selectedUserDetails?.servers || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-text-muted">
                    This user does not currently own any game servers.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {selectedUserDetails?.servers?.map((server: any) => {
                      const targetUser = transferTargetUserId[server.id];
                      return (
                        <div key={server.id} className="p-4 space-y-3 hover:bg-surface-elevated/20 transition-colors">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/servers/${server.uuid}`}
                                  className="text-sm font-semibold text-text-primary hover:text-primary transition-colors flex items-center gap-1"
                                >
                                  {server.name}
                                  <ExternalLink className="w-3 h-3 text-text-muted" />
                                </Link>
                                <span className="text-[10px] font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                                  {server.uuidShort}
                                </span>
                              </div>
                              <p className="text-[11px] font-mono text-text-muted mt-0.5">
                                {server.node?.name} &bull; {server.allocation?.ip}:{server.allocation?.port}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge variant={server.status === 'suspended' ? 'error' : server.status === 'running' ? 'success' : 'default'} className="text-[10px]">
                                {server.status?.toUpperCase() || 'OFFLINE'}
                              </Badge>
                              <Link href={`/servers/${server.uuid}`}>
                                <Button variant="secondary" size="sm">
                                  Console
                                </Button>
                              </Link>
                            </div>
                          </div>

                          {/* Quick Specs */}
                          <div className="flex items-center gap-4 text-[10px] text-text-muted font-mono pt-1">
                            <span className="flex items-center gap-1">
                              <Cpu className="w-3 h-3 text-primary" /> {server.cpu}% CPU
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3 text-emerald-400" /> {formatMemory(server.memory)} RAM
                            </span>
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3 text-amber-400" /> {formatMemory(server.disk)} Disk
                            </span>
                          </div>

                          {/* 1-Click Server Transfer */}
                          <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-[11px] font-medium text-text-secondary flex items-center gap-1 shrink-0">
                              <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                              Transfer to Account:
                            </span>

                            <select
                              value={targetUser || ''}
                              onChange={(e) =>
                                setTransferTargetUserId((prev) => ({
                                  ...prev,
                                  [server.id]: Number(e.target.value),
                                }))
                              }
                              className="flex-1 px-2.5 py-1.5 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                            >
                              <option value="">-- Select new owner --</option>
                              {allUsers
                                .filter((u: any) => u.id !== selectedUserDetails.id)
                                .map((u: any) => (
                                  <option key={u.id} value={u.id}>
                                    {u.username} ({u.email})
                                  </option>
                                ))}
                            </select>

                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!targetUser || transferServerMutation.isPending}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Transfer ownership of "${server.name}" to the selected user? They will gain full control of the server container.`,
                                  )
                                ) {
                                  transferServerMutation.mutate({
                                    serverId: server.id,
                                    newOwnerId: targetUser,
                                  });
                                }
                              }}
                              className="text-cyan-400 hover:text-cyan-300 border-cyan-500/30 shrink-0"
                            >
                              Transfer Server
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
