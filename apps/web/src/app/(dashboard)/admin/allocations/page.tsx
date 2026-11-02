'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import { Network, Plus, Trash2, Server } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Card } from '../../../../components/ui/card';

export default function AdminAllocationsPage() {
  const queryClient = useQueryClient();
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [ip, setIp] = useState('0.0.0.0');
  const [alias, setAlias] = useState('');
  const [ports, setPorts] = useState('25565-25575');

  const { data: nodes } = useQuery<any[]>({
    queryKey: ['admin-nodes'],
    queryFn: () => fetchApi('/api/admin/nodes'),
  });

  // Default to first node
  React.useEffect(() => {
    if (nodes && nodes.length > 0 && selectedNodeId === null) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes, selectedNodeId]);

  const { data: allocations, isLoading } = useQuery<any[]>({
    queryKey: ['admin-allocations', selectedNodeId],
    queryFn: () => fetchApi(`/api/admin/nodes/${selectedNodeId}/allocations`),
    enabled: selectedNodeId !== null,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/admin/nodes/${selectedNodeId}/allocations`, {
        method: 'POST',
        body: JSON.stringify({
          ip,
          alias: alias || undefined,
          ports: ports.split(',').map((p) => p.trim()),
        }),
      }),
    onSuccess: (data: any) => {
      setShowModal(false);
      alert(`Created ${data.created} allocation(s).`);
      queryClient.invalidateQueries({ queryKey: ['admin-allocations', selectedNodeId] });
    },
    onError: (err: any) => {
      alert(`Failed to create allocations: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/api/admin/allocations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-allocations', selectedNodeId] });
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Network Allocations
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure IP addresses and assignable port pools for each node
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Node selector dropdown */}
          <select
            value={selectedNodeId || ''}
            onChange={(e) => setSelectedNodeId(Number(e.target.value))}
            className="px-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
          >
            {nodes?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.fqdn})
              </option>
            ))}
          </select>

          <Button
            variant="primary"
            size="md"
            disabled={!selectedNodeId}
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-4 h-4" /> Add Allocations
          </Button>
        </div>
      </div>

      {/* Create Allocations Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Add Port Allocations</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  IP Address (e.g. 0.0.0.0 or node external IP)
                </label>
                <input
                  type="text"
                  required
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control font-mono text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  Ports (Comma separated or range e.g. 25565-25575)
                </label>
                <input
                  type="text"
                  required
                  value={ports}
                  onChange={(e) => setPorts(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control font-mono text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  IP Alias (Optional, e.g. play.example.com)
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="play.example.com"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
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
                disabled={createMutation.isPending || !ip || !ports}
                onClick={() => createMutation.mutate()}
              >
                Create Allocations
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Allocations Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading allocations...</div>
        ) : (allocations || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No allocations registered for this node yet.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">IP Address</th>
                <th className="px-5 py-3">Port</th>
                <th className="px-5 py-3">Alias</th>
                <th className="px-5 py-3">Assigned Server</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono">
              {allocations?.map((alloc: any) => (
                <tr key={alloc.id} className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="px-5 py-3.5 text-text-primary">
                    {alloc.ip}
                  </td>
                  <td className="px-5 py-3.5 text-primary font-bold">
                    {alloc.port}
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {alloc.alias || '-'}
                  </td>
                  <td className="px-5 py-3.5 font-sans">
                    {alloc.server ? (
                      <span className="flex items-center gap-1.5 text-text-primary font-medium">
                        <Server className="w-3.5 h-3.5 text-primary" />
                        {alloc.server.name}
                      </span>
                    ) : (
                      <Badge variant="default">UNASSIGNED</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-sans">
                    {!alloc.server && (
                      <button
                        onClick={() => deleteMutation.mutate(alloc.id)}
                        className="p-1 text-text-muted hover:text-status-error transition-colors rounded"
                        title="Delete unassigned allocation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
