'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Crown,
  Ban,
  UserMinus,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';

export default function ServerPlayersPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'online' | 'ops' | 'whitelist' | 'banned'>('online');
  const [search, setSearch] = useState('');

  // Form Inputs
  const [newOpName, setNewOpName] = useState('');
  const [newWhitelistName, setNewWhitelistName] = useState('');
  const [banPlayerName, setBanPlayerName] = useState('');
  const [banPlayerReason, setBanPlayerReason] = useState('');

  // Status feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Queries
  const { data: server } = useQuery<any>({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  const {
    data: playerData,
    isLoading: isPlayersLoading,
    refetch: refetchPlayers,
  } = useQuery<any>({
    queryKey: ['server-players', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}/players`),
    refetchInterval: 6000,
  });

  // Query online server status for real-time online players
  const primaryIp = server?.allocation?.alias || server?.allocation?.ip || server?.node?.fqdn;
  const primaryPort = server?.allocation?.port;

  const { data: onlineStatus, refetch: refetchOnline } = useQuery<any>({
    queryKey: ['mc-status-online', primaryIp, primaryPort],
    queryFn: async () => {
      if (!primaryIp || !primaryPort) return null;
      try {
        const res = await fetch(`https://api.mcsrvstat.us/3/${primaryIp}:${primaryPort}`);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    enabled: Boolean(primaryIp && primaryPort),
    refetchInterval: 10000,
  });

  const notifySuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
    refetchPlayers();
    refetchOnline();
  };

  const notifyError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 5000);
  };

  // Mutations
  const opMutation = useMutation({
    mutationFn: (name: string) =>
      fetchApi(`/api/client/servers/${uuid}/players/op`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: (data: any) => {
      setNewOpName('');
      notifySuccess(data.message || 'Operator permissions granted!');
    },
    onError: (err: any) => notifyError(err.message),
  });

  const deopMutation = useMutation({
    mutationFn: (name: string) =>
      fetchApi(`/api/client/servers/${uuid}/players/op/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      }),
    onSuccess: (data: any) => notifySuccess(data.message || 'Operator permissions revoked.'),
    onError: (err: any) => notifyError(err.message),
  });

  const addWhitelistMutation = useMutation({
    mutationFn: (name: string) =>
      fetchApi(`/api/client/servers/${uuid}/players/whitelist`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: (data: any) => {
      setNewWhitelistName('');
      notifySuccess(data.message || 'Player added to whitelist!');
    },
    onError: (err: any) => notifyError(err.message),
  });

  const removeWhitelistMutation = useMutation({
    mutationFn: (name: string) =>
      fetchApi(`/api/client/servers/${uuid}/players/whitelist/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      }),
    onSuccess: (data: any) => notifySuccess(data.message || 'Player removed from whitelist.'),
    onError: (err: any) => notifyError(err.message),
  });

  const toggleWhitelistMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      fetchApi(`/api/client/servers/${uuid}/players/whitelist/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: (data: any) => notifySuccess(data.message || 'Whitelist status updated.'),
    onError: (err: any) => notifyError(err.message),
  });

  const banMutation = useMutation({
    mutationFn: ({ name, reason }: { name: string; reason?: string }) =>
      fetchApi(`/api/client/servers/${uuid}/players/ban`, {
        method: 'POST',
        body: JSON.stringify({ name, reason }),
      }),
    onSuccess: (data: any) => {
      setBanPlayerName('');
      setBanPlayerReason('');
      notifySuccess(data.message || 'Player has been banned.');
    },
    onError: (err: any) => notifyError(err.message),
  });

  const pardonMutation = useMutation({
    mutationFn: (name: string) =>
      fetchApi(`/api/client/servers/${uuid}/players/pardon`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: (data: any) => notifySuccess(data.message || 'Player has been unbanned/pardoned.'),
    onError: (err: any) => notifyError(err.message),
  });

  const kickMutation = useMutation({
    mutationFn: ({ name, reason }: { name: string; reason?: string }) =>
      fetchApi(`/api/client/servers/${uuid}/players/kick`, {
        method: 'POST',
        body: JSON.stringify({ name, reason }),
      }),
    onSuccess: (data: any) => notifySuccess(data.message || 'Player kicked from server.'),
    onError: (err: any) => notifyError(err.message),
  });

  const opsList = playerData?.ops || [];
  const whitelist = playerData?.whitelist || [];
  const bannedPlayers = playerData?.bannedPlayers || [];
  const whitelistActive = playerData?.whitelistEnabled ?? false;
  const onlinePlayers = onlineStatus?.players?.list || [];
  const onlineCount = onlineStatus?.players?.online ?? 0;
  const maxPlayers = onlineStatus?.players?.max ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Minecraft Player Management
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage live online players, server operators (OPs), whitelist access, and blacklisted/banned users
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              refetchPlayers();
              refetchOnline();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
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

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface border border-border rounded-card space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" /> Online Players
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-text-primary">
              {onlineCount} {maxPlayers > 0 ? `/ ${maxPlayers}` : ''}
            </span>
            <Badge variant={onlineCount > 0 ? 'success' : 'default'} className="text-[10px]">
              {onlineCount > 0 ? 'ACTIVE' : 'IDLE'}
            </Badge>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-card space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-400" /> Server Operators
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-amber-400">
              {opsList.length}
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">
              ops.json
            </Badge>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-card space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" /> Whitelist Status
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-cyan-400">
              {whitelist.length}
            </span>
            <Badge variant={whitelistActive ? 'info' : 'default'} className="text-[10px]">
              {whitelistActive ? 'ENFORCED' : 'OFF'}
            </Badge>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-card space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5 text-rose-400" /> Banned / Blacklist
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-rose-400">
              {bannedPlayers.length}
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-400">
              Blocked
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
        <button
          onClick={() => setActiveTab('online')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
            activeTab === 'online'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Online Players ({onlineCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('ops')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
            activeTab === 'ops'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Operators ({opsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('whitelist')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
            activeTab === 'whitelist'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Whitelist ({whitelist.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('banned')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
            activeTab === 'banned'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Ban className="w-3.5 h-3.5" />
          <span>Banned / Blacklist ({bannedPlayers.length})</span>
        </button>
      </div>

      {/* Tab 1: Online Players */}
      {activeTab === 'online' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Currently Connected Players ({onlinePlayers.length || onlineCount})
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Real-time players actively connected to this Minecraft server instance
                </p>
              </div>

              <span className="text-[10px] font-mono text-text-muted bg-surface-elevated px-2 py-1 rounded border border-border">
                {primaryIp}:{primaryPort}
              </span>
            </div>

            {onlinePlayers.length === 0 ? (
              <div className="p-12 text-center text-xs text-text-muted space-y-2">
                <Users className="w-8 h-8 text-zinc-600 mx-auto" />
                <p>No players are currently online.</p>
                <p className="text-[11px] text-text-secondary">
                  Join the server at <span className="font-mono text-primary">{primaryIp}:{primaryPort}</span> to appear here!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {onlinePlayers.map((player: any) => {
                  const playerName = typeof player === 'string' ? player : player.name;
                  const playerUuid = typeof player === 'object' ? player.uuid : null;
                  const isOp = opsList.some((op: any) => op.name?.toLowerCase() === playerName?.toLowerCase());

                  return (
                    <div key={playerName} className="p-3.5 flex items-center justify-between hover:bg-surface-elevated/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/48`}
                          alt={playerName}
                          className="w-9 h-9 rounded-lg border border-border shadow-sm shrink-0"
                          onError={(e) => {
                            (e.target as any).src = 'https://mc-heads.net/avatar/MHF_Steve/48';
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-primary font-mono">{playerName}</span>
                            {isOp && (
                              <Badge variant="warning" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10">
                                <Crown className="w-2.5 h-2.5 mr-1" /> OP
                              </Badge>
                            )}
                          </div>
                          {playerUuid && (
                            <span className="text-[10px] text-text-muted font-mono">{playerUuid}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isOp ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={opMutation.isPending}
                            onClick={() => opMutation.mutate(playerName)}
                            className="text-amber-400 hover:text-amber-300 border-amber-500/30"
                          >
                            <Crown className="w-3 h-3 mr-1" /> Make OP
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={deopMutation.isPending}
                            onClick={() => deopMutation.mutate(playerName)}
                          >
                            De-OP
                          </Button>
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={kickMutation.isPending}
                          onClick={() => {
                            const reason = prompt(`Reason for kicking ${playerName}? (Optional)`);
                            if (reason !== null) kickMutation.mutate({ name: playerName, reason });
                          }}
                          className="text-orange-400 hover:text-orange-300 border-orange-500/30"
                        >
                          <UserMinus className="w-3 h-3 mr-1" /> Kick
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          disabled={banMutation.isPending}
                          onClick={() => {
                            const reason = prompt(`Reason for banning ${playerName}? (Optional)`);
                            if (reason !== null) banMutation.mutate({ name: playerName, reason });
                          }}
                        >
                          <Ban className="w-3 h-3 mr-1" /> Ban
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

      {/* Tab 2: Server Operators (OPs) */}
      {activeTab === 'ops' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" /> Add Server Operator (OP)
                </CardTitle>
                <CardDescription>
                  Give a player administrative permissions and access to in-game commands (/gamemode, /tp, /give, etc.).
                </CardDescription>
              </div>
            </CardHeader>

            <div className="p-4 pt-1 flex gap-2">
              <input
                type="text"
                placeholder="Enter exact Minecraft username (e.g. Notch, Alex)..."
                value={newOpName}
                onChange={(e) => setNewOpName(e.target.value)}
                className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
              />
              <Button
                variant="primary"
                size="md"
                disabled={!newOpName.trim() || opMutation.isPending}
                onClick={() => opMutation.mutate(newOpName.trim())}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {opMutation.isPending ? 'Granting OP...' : 'Grant Operator'}
              </Button>
            </div>
          </Card>

          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Active Operators ({opsList.length})
              </h3>
              <span className="text-[11px] font-mono text-text-muted">Stored in ops.json</span>
            </div>

            {opsList.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No server operators assigned yet. Use the input above to grant OP status.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {opsList.map((op: any) => (
                  <div key={op.name || op.uuid} className="p-3.5 flex items-center justify-between hover:bg-surface-elevated/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://mc-heads.net/avatar/${encodeURIComponent(op.name)}/48`}
                        alt={op.name}
                        className="w-9 h-9 rounded-lg border border-border shrink-0"
                        onError={(e) => {
                          (e.target as any).src = 'https://mc-heads.net/avatar/MHF_Steve/48';
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-primary font-mono">{op.name}</span>
                          <Badge variant="warning" className="text-[10px] border-amber-500/30 text-amber-400">
                            Level {op.level || 4} OP
                          </Badge>
                          {op.bypassesPlayerLimit && (
                            <Badge variant="outline" className="text-[10px] text-zinc-400">Bypasses Slots</Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted font-mono">{op.uuid}</span>
                      </div>
                    </div>

                    <Button
                      variant="danger"
                      size="sm"
                      disabled={deopMutation.isPending}
                      onClick={() => {
                        if (confirm(`Revoke operator privileges from "${op.name}"?`)) {
                          deopMutation.mutate(op.name);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke OP
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Whitelist */}
      {activeTab === 'whitelist' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-cyan-400" /> Whitelist Access Control
                  </CardTitle>
                  <CardDescription>
                    When whitelist is enabled, only approved players in this list can connect to the server.
                  </CardDescription>
                </div>

                <Button
                  variant={whitelistActive ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={toggleWhitelistMutation.isPending}
                  onClick={() => toggleWhitelistMutation.mutate(!whitelistActive)}
                >
                  {whitelistActive ? (
                    <>
                      <ToggleRight className="w-4 h-4 mr-1 text-emerald-400" /> Whitelist Active (Enabled)
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 mr-1 text-text-muted" /> Whitelist Inactive (Disabled)
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <div className="p-4 pt-1 flex gap-2">
              <input
                type="text"
                placeholder="Enter player username to whitelist..."
                value={newWhitelistName}
                onChange={(e) => setNewWhitelistName(e.target.value)}
                className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
              />
              <Button
                variant="primary"
                size="md"
                disabled={!newWhitelistName.trim() || addWhitelistMutation.isPending}
                onClick={() => addWhitelistMutation.mutate(newWhitelistName.trim())}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {addWhitelistMutation.isPending ? 'Adding...' : 'Add to Whitelist'}
              </Button>
            </div>
          </Card>

          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Whitelisted Players ({whitelist.length})
              </h3>
              <span className="text-[11px] font-mono text-text-muted">Stored in whitelist.json</span>
            </div>

            {whitelist.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No players currently on the whitelist.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {whitelist.map((player: any) => (
                  <div key={player.name || player.uuid} className="p-3.5 flex items-center justify-between hover:bg-surface-elevated/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://mc-heads.net/avatar/${encodeURIComponent(player.name)}/48`}
                        alt={player.name}
                        className="w-9 h-9 rounded-lg border border-border shrink-0"
                        onError={(e) => {
                          (e.target as any).src = 'https://mc-heads.net/avatar/MHF_Steve/48';
                        }}
                      />
                      <div>
                        <span className="text-xs font-bold text-text-primary font-mono block">{player.name}</span>
                        <span className="text-[10px] text-text-muted font-mono">{player.uuid}</span>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={removeWhitelistMutation.isPending}
                      onClick={() => removeWhitelistMutation.mutate(player.name)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-400" /> Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Banned Players (Blacklist) */}
      {activeTab === 'banned' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-rose-400" /> Ban Malicious Player
                </CardTitle>
                <CardDescription>
                  Permanently ban a player by username. They will be disconnected immediately and denied re-entry.
                </CardDescription>
              </div>
            </CardHeader>

            <div className="p-4 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Player username..."
                value={banPlayerName}
                onChange={(e) => setBanPlayerName(e.target.value)}
                className="px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="Ban reason / audit note (optional)..."
                value={banPlayerReason}
                onChange={(e) => setBanPlayerReason(e.target.value)}
                className="px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
              />
              <Button
                variant="danger"
                size="md"
                disabled={!banPlayerName.trim() || banMutation.isPending}
                onClick={() =>
                  banMutation.mutate({
                    name: banPlayerName.trim(),
                    reason: banPlayerReason.trim() || undefined,
                  })
                }
              >
                <Ban className="w-4 h-4 mr-1.5" />
                {banMutation.isPending ? 'Banning...' : 'Ban Player'}
              </Button>
            </div>
          </Card>

          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Banned Players ({bannedPlayers.length})
              </h3>
              <span className="text-[11px] font-mono text-text-muted">Stored in banned-players.json</span>
            </div>

            {bannedPlayers.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No players are currently banned from this server.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {bannedPlayers.map((player: any) => (
                  <div key={player.name || player.uuid} className="p-3.5 flex items-center justify-between hover:bg-surface-elevated/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://mc-heads.net/avatar/${encodeURIComponent(player.name)}/48`}
                        alt={player.name}
                        className="w-9 h-9 rounded-lg border border-rose-500/30 shrink-0"
                        onError={(e) => {
                          (e.target as any).src = 'https://mc-heads.net/avatar/MHF_Steve/48';
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-rose-400 font-mono">{player.name}</span>
                          <span className="text-[10px] text-text-muted">
                            Reason: {player.reason || 'Banned by operator'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono mt-0.5">
                          <span>Banned: {player.created ? new Date(player.created).toLocaleDateString() : 'N/A'}</span>
                          &bull;
                          <span>Source: {player.source || 'Console'}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pardonMutation.isPending}
                      onClick={() => pardonMutation.mutate(player.name)}
                      className="text-emerald-400 hover:text-emerald-300 border-emerald-500/30"
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1" /> Pardon / Unban
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
