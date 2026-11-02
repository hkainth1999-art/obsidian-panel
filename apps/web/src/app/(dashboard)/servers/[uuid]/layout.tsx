'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import { useAuth } from '../../../../contexts/auth-context';
import {
  Play,
  Square,
  RotateCw,
  Power,
  ChevronLeft,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';

export default function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { uuid: string };
}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const uuid = params.uuid;

  const { data: server, isLoading } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
    refetchInterval: 10000,
  });

  const [powerFeedback, setPowerFeedback] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<string | null>(null);

  // Sync initial status from server query only if not already active
  React.useEffect(() => {
    if (!liveState && (server?.liveStatus || server?.status)) {
      setLiveState(server.liveStatus || server.status);
    }
  }, [server?.liveStatus, server?.status, liveState]);

  // Listen for real-time WebSocket status events from Console
  React.useEffect(() => {
    const handleStatusEvent = (e: any) => {
      if (e.detail?.uuid === uuid && e.detail?.status) {
        setLiveState(e.detail.status);
      }
    };
    window.addEventListener('obsidian:server-status', handleStatusEvent);
    return () => window.removeEventListener('obsidian:server-status', handleStatusEvent);
  }, [uuid]);

  const powerMutation = useMutation({
    mutationFn: (action: 'start' | 'stop' | 'restart' | 'kill') =>
      fetchApi(`/api/client/servers/${uuid}/power`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onMutate: (action) => {
      if (action === 'start') setLiveState('starting');
      if (action === 'restart') setLiveState('starting');
      if (action === 'stop') setLiveState('stopping');
      if (action === 'kill') setLiveState('offline');
    },
    onSuccess: (_, action) => {
      setPowerFeedback(`Power action '${action}' dispatched`);
      setTimeout(() => setPowerFeedback(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
    },
    onError: (err: any) => {
      setPowerFeedback(`Failed: ${err.message || 'Action error'}`);
      setTimeout(() => setPowerFeedback(null), 6000);
    },
  });

  // Admin Suspension Mutation
  const suspendMutation = useMutation({
    mutationFn: (action: 'suspend' | 'unsuspend') =>
      fetchApi(`/api/admin/servers/${uuid}/${action}`, {
        method: 'POST',
      }),
    onSuccess: (_, action) => {
      setPowerFeedback(action === 'suspend' ? 'Server suspended by admin' : 'Server unsuspended');
      setTimeout(() => setPowerFeedback(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
    },
    onError: (err: any) => {
      setPowerFeedback(`Suspension error: ${err.message}`);
      setTimeout(() => setPowerFeedback(null), 6000);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-surface/50 border border-border rounded-card animate-pulse" />
        <div className="h-96 bg-surface/30 border border-border rounded-card animate-pulse" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="p-12 text-center">
        <p className="text-text-muted text-sm">Server not found or access denied.</p>
        <Link href="/servers" className="mt-4 inline-block">
          <Button variant="secondary">Back to Servers</Button>
        </Link>
      </div>
    );
  }

  const isSuspended = server.status === 'suspended';
  const currentStatus = isSuspended ? 'suspended' : (liveState || server.liveStatus || server.status || 'offline').toLowerCase();

  const renderStatusBadge = () => {
    switch (currentStatus) {
      case 'running':
      case 'online':
        return <Badge variant="success" className="animate-pulse">ONLINE</Badge>;
      case 'starting':
        return <Badge variant="warning" className="border-amber-500/30 text-amber-400 bg-amber-500/10">STARTING</Badge>;
      case 'stopping':
        return <Badge variant="warning" className="border-amber-500/30 text-amber-400 bg-amber-500/10">STOPPING</Badge>;
      case 'installing':
        return <Badge variant="warning">INSTALLING</Badge>;
      case 'install_failed':
        return <Badge variant="error">INSTALL FAILED</Badge>;
      case 'suspended':
        return <Badge variant="error" className="bg-red-500/20 text-red-400 border-red-500/40">SUSPENDED</Badge>;
      case 'offline':
      default:
        return <Badge variant="default" className="text-text-muted">OFFLINE</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Suspended Alert Banner */}
      {isSuspended && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-card flex items-center justify-between text-xs text-red-400 font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>This game server is currently suspended. Node access and container operations are restricted.</span>
          </div>
          {user?.isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              disabled={suspendMutation.isPending}
              onClick={() => suspendMutation.mutate('unsuspend')}
              className="text-xs bg-red-500/20 hover:bg-red-500/30 text-white border-red-500/40"
            >
              <PlayCircle className="w-3.5 h-3.5 mr-1" /> Unsuspend Server
            </Button>
          )}
        </div>
      )}

      {/* Server Header Banner */}
      <div className="bg-surface border border-border rounded-card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/servers"
              className="p-2 rounded-control bg-surface-elevated border border-border text-text-muted hover:text-text-primary transition-colors"
              title="Back to server list"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-text-primary tracking-tight">
                  {server.name}
                </h1>
                {renderStatusBadge()}
              </div>
              <p className="text-xs font-mono text-text-muted mt-0.5">
                {(server.node?.fqdn || server.allocation?.alias || server.allocation?.ip)}:{server.allocation?.port} &bull; Node: {server.node?.name} &bull; ID: {server.uuidShort}
              </p>
            </div>
          </div>

          {/* Real-Time Power Controls & Admin Suspension */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {powerFeedback && (
              <span
                className={`text-xs px-2.5 py-1 rounded border font-mono animate-fade-in ${
                  powerFeedback.startsWith('Failed') || powerFeedback.startsWith('Suspension error')
                    ? 'bg-status-stopping/10 border-status-stopping/30 text-status-stopping'
                    : 'bg-primary/10 border-primary/30 text-primary'
                }`}
              >
                {powerFeedback}
              </span>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={powerMutation.isPending || isSuspended}
                onClick={() => powerMutation.mutate('start')}
                className="text-status-running hover:border-status-running/40"
              >
                <Play className="w-3.5 h-3.5 fill-status-running" /> Start
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={powerMutation.isPending || isSuspended}
                onClick={() => powerMutation.mutate('restart')}
                className="text-primary hover:border-primary/40"
              >
                <RotateCw className="w-3.5 h-3.5" /> Restart
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={powerMutation.isPending || isSuspended}
                onClick={() => powerMutation.mutate('stop')}
                className="text-status-stopping hover:border-status-stopping/40"
              >
                <Square className="w-3.5 h-3.5 fill-status-stopping" /> Stop
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={powerMutation.isPending || isSuspended}
                onClick={() => {
                  if (confirm('Force kill server process?')) {
                    powerMutation.mutate('kill');
                  }
                }}
              >
                <Power className="w-3.5 h-3.5" /> Kill
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Server View Content */}
      <div>{children}</div>
    </div>
  );
}
