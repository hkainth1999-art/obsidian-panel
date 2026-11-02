'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import { Network, Server, Key, Copy, Check, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Badge } from '../../../../../components/ui/badge';
import { Button } from '../../../../../components/ui/button';

export default function ServerNetworkPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();

  const { data: server, isLoading: isServerLoading } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  const {
    data: networkData,
    isLoading: isNetworkLoading,
    refetch: refetchNetwork,
  } = useQuery({
    queryKey: ['server-network-allocations', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}/network/allocations`),
  });

  const [copied, setCopied] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState<number | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const assignMutation = useMutation({
    mutationFn: (allocId?: number) =>
      fetchApi(`/api/client/servers/${uuid}/network/allocations`, {
        method: 'POST',
        body: allocId ? JSON.stringify({ allocationId: allocId }) : undefined,
      }),
    onSuccess: () => {
      setShowAssignModal(false);
      setSelectedAllocationId(null);
      refetchNetwork();
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
      alert('Additional port/allocation assigned and synced to Wings daemon!');
    },
    onError: (err: any) => {
      alert(`Failed to assign allocation: ${err.message}`);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (allocId: number) =>
      fetchApi(`/api/client/servers/${uuid}/network/allocations/${allocId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      refetchNetwork();
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
      alert('Allocation removed and synced to Wings daemon.');
    },
    onError: (err: any) => {
      alert(`Failed to remove allocation: ${err.message}`);
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (allocId: number) =>
      fetchApi(`/api/client/servers/${uuid}/network/allocations/${allocId}/primary`, {
        method: 'POST',
      }),
    onSuccess: () => {
      refetchNetwork();
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
      alert('Primary connection port updated and synced to Wings daemon!');
    },
    onError: (err: any) => {
      alert(`Failed to set primary allocation: ${err.message}`);
    },
  });

  if (isServerLoading || isNetworkLoading) {
    return <div className="p-8 text-center text-xs text-text-muted">Loading network configuration...</div>;
  }

  const primaryAlloc = networkData?.primary || server?.allocation;
  const assignedAllocs = networkData?.assigned || server?.allocations || [];
  const unassignedAllocs = networkData?.unassigned || [];
  const allocationLimit = networkData?.server?.allocationLimit ?? server?.allocationLimit ?? 0;
  const canAssignMore = allocationLimit === 0 || assignedAllocs.length < allocationLimit;

  return (
    <div className="space-y-6">
      {/* SFTP Connection Details */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>SFTP Connection Details</CardTitle>
            <CardDescription>
              Connect with any SFTP client (FileZilla, Cyberduck, WinSCP) using your Obsidian account password.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              SFTP Host / FQDN
            </span>
            <div className="flex items-center justify-between font-mono text-xs text-text-primary">
              <span>{server?.node?.fqdn}</span>
              <button
                onClick={() => copyToClipboard(server?.node?.fqdn, 'host')}
                className="text-text-muted hover:text-text-primary"
              >
                {copied === 'host' ? <Check className="w-3.5 h-3.5 text-status-running" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              SFTP Port
            </span>
            <div className="flex items-center justify-between font-mono text-xs text-text-primary">
              <span>{server?.node?.daemonSftpPort || 2022}</span>
              <button
                onClick={() => copyToClipboard(String(server?.node?.daemonSftpPort || 2022), 'port')}
                className="text-text-muted hover:text-text-primary"
              >
                {copied === 'port' ? <Check className="w-3.5 h-3.5 text-status-running" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              SFTP Username
            </span>
            <div className="flex items-center justify-between font-mono text-xs text-text-primary">
              <span>{server?.owner?.username}.{server?.uuidShort}</span>
              <button
                onClick={() => copyToClipboard(`${server?.owner?.username}.${server?.uuidShort}`, 'user')}
                className="text-text-muted hover:text-text-primary"
              >
                {copied === 'user' ? <Check className="w-3.5 h-3.5 text-status-running" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Network Allocations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle>Network Allocations &amp; Ports</CardTitle>
              <CardDescription>
                IP addresses and ports bound to this game container on the Wings host ({assignedAllocs.length}
                {allocationLimit > 0 ? ` / ${allocationLimit}` : ''} assigned).
              </CardDescription>
            </div>

            {canAssignMore && unassignedAllocs.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAssignModal(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Assign Port
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Notice for Voice Chat & Geyser */}
        <div className="mb-4 p-3 bg-surface-elevated/60 border border-cyan-500/20 rounded-control text-xs text-text-secondary">
          <span className="text-cyan-400 font-semibold block mb-0.5">⚡ Dual TCP &amp; UDP Binding Active</span>
          Wings automatically maps all assigned allocations for both TCP and UDP. To configure <span className="text-text-primary font-mono font-medium">SimpleVoiceChat (UDP)</span>, <span className="text-text-primary font-mono font-medium">PlasmoVoice</span>, or <span className="text-text-primary font-mono font-medium">Geyser Bedrock (UDP 19132)</span>, simply set the port in your plugin configuration to one of your secondary ports.
        </div>

        <div className="space-y-2">
          {/* Primary allocation */}
          {primaryAlloc && (
            <div className="flex items-center justify-between p-3.5 bg-surface-elevated border border-primary/30 rounded-control">
              <div className="flex items-center gap-3">
                <Network className="w-4 h-4 text-primary" />
                <div>
                  <span className="font-mono text-xs font-bold text-text-primary">
                    {primaryAlloc.alias || primaryAlloc.ip}:{primaryAlloc.port}
                  </span>
                  {primaryAlloc.alias && (
                    <span className="text-[11px] text-text-muted ml-2 font-mono">
                      ({primaryAlloc.ip}:{primaryAlloc.port})
                    </span>
                  )}
                  {primaryAlloc.notes && (
                    <p className="text-[10px] text-text-muted mt-0.5">{primaryAlloc.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info">PRIMARY ALLOCATION</Badge>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted font-sans">
                  TCP &amp; UDP
                </span>
              </div>
            </div>
          )}

          {/* Additional allocations */}
          {assignedAllocs
            ?.filter((a: any) => a.id !== primaryAlloc?.id)
            .map((alloc: any) => (
              <div
                key={alloc.id}
                className="flex items-center justify-between p-3.5 bg-surface-elevated/40 border border-border/80 rounded-control hover:border-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Network className="w-4 h-4 text-text-muted" />
                  <div>
                    <span className="font-mono text-xs text-text-primary">
                      {alloc.alias || alloc.ip}:{alloc.port}
                    </span>
                    {alloc.alias && (
                      <span className="text-[11px] text-text-muted ml-2 font-mono">
                        ({alloc.ip}:{alloc.port})
                      </span>
                    )}
                    {alloc.notes && (
                      <p className="text-[10px] text-text-muted mt-0.5">{alloc.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="default">SECONDARY (UDP/TCP)</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={setPrimaryMutation.isPending}
                    onClick={() => setPrimaryMutation.mutate(alloc.id)}
                    className="text-[11px] py-1 px-2 text-text-secondary hover:text-text-primary"
                    title="Make this the default primary server address"
                  >
                    Make Primary
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={unassignMutation.isPending}
                    onClick={() => {
                      if (confirm(`Unassign port ${alloc.ip}:{alloc.port} from this server?`)) {
                        unassignMutation.mutate(alloc.id);
                      }
                    }}
                    className="text-[11px] py-1 px-2"
                    title="Unassign port from server"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* Assign Port Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Assign Extra Port
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-secondary">
              Select an available unassigned port on this server&apos;s node. Wings will automatically bind it for both TCP and UDP.
            </p>

            <div>
              <label className="text-text-secondary font-medium block text-xs mb-1">
                Available Node Port
              </label>
              <select
                value={selectedAllocationId || ''}
                onChange={(e) => setSelectedAllocationId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
              >
                <option value="">-- Choose port / allocation --</option>
                {unassignedAllocs.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.ip}:{a.port} {a.alias ? `(${a.alias})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowAssignModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={assignMutation.isPending}
                onClick={() => assignMutation.mutate(selectedAllocationId || undefined)}
              >
                {assignMutation.isPending ? 'Assigning...' : 'Assign Port'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
