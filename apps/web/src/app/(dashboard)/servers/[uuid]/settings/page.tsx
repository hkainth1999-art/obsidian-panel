'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import { RotateCcw, Trash2, AlertTriangle, Info, Sliders } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';

export default function ServerSettingsPage({
  params,
}: {
  params: { uuid: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const uuid = params.uuid;

  const { data: server, isLoading } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  const reinstallMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/client/servers/${uuid}/reinstall`, {
        method: 'POST',
      }),
    onSuccess: () => {
      alert('Reinstallation initiated on Wings daemon! Server files are being downloaded.');
      router.push(`/servers/${uuid}`);
    },
    onError: (err: any) => {
      alert(`Reinstall failed: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/admin/servers/${uuid}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      alert('Server deleted.');
      router.push('/servers');
    },
    onError: (err: any) => {
      alert(`Deletion failed: ${err.message}`);
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-text-muted">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Information Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Server Details</CardTitle>
            <CardDescription>
              Internal identifiers and hardware limits for this instance.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              UUID (Pterodactyl Wings)
            </span>
            <span className="text-text-primary break-all">{server?.uuid}</span>
          </div>

          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              Short Identifier
            </span>
            <span className="text-text-primary">{server?.uuidShort}</span>
          </div>
        </div>
      </Card>

      {/* Danger Zone: Reinstall */}
      <Card className="border-status-stopping/30 bg-status-stopping/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-status-stopping/15 text-status-stopping rounded-control mt-0.5">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-status-stopping">Reinstall Server</CardTitle>
              <CardDescription>
                Reruns the egg installation script inside the container. Some game files might be overwritten or deleted.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="pt-2">
          <Button
            variant="secondary"
            className="border-status-stopping/40 text-status-stopping hover:bg-status-stopping/10"
            disabled={reinstallMutation.isPending}
            onClick={() => {
              if (confirm('Are you sure you want to reinstall this game server?')) {
                reinstallMutation.mutate();
              }
            }}
          >
            Reinstall Server
          </Button>
        </div>
      </Card>

      {/* Danger Zone: Delete */}
      <Card className="border-status-error/30 bg-status-error/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-status-error/15 text-status-error rounded-control mt-0.5">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-status-error">Delete Server</CardTitle>
              <CardDescription>
                Permanently deletes the server container, all game data, allocations, and backups from the Wings node. This action cannot be undone.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="pt-2">
          <Button
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => {
              const confirmName = prompt(`Type "${server?.name}" to confirm permanent deletion:`);
              if (confirmName === server?.name) {
                deleteMutation.mutate();
              }
            }}
          >
            Delete Server Permanently
          </Button>
        </div>
      </Card>
    </div>
  );
}
