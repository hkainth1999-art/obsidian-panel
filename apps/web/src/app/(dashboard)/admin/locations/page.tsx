'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';

export default function AdminLocationsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [short, setShort] = useState('');
  const [long, setLong] = useState('');

  const { data: locations, isLoading } = useQuery<any[]>({
    queryKey: ['admin-locations'],
    queryFn: () => fetchApi('/api/admin/locations'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/admin/locations', {
        method: 'POST',
        body: JSON.stringify({ short, long }),
      }),
    onSuccess: () => {
      setShowModal(false);
      setShort('');
      setLong('');
      queryClient.invalidateQueries({ queryKey: ['admin-locations'] });
    },
    onError: (err: any) => {
      alert(`Failed to create location: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/api/admin/locations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-locations'] });
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Locations
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Geographic or datacenter grouping for server nodes
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Create Location
        </Button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Create New Location</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  Short Code (e.g. US-EAST)
                </label>
                <input
                  type="text"
                  required
                  value={short}
                  onChange={(e) => setShort(e.target.value)}
                  placeholder="US-EAST"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control font-mono uppercase text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-text-secondary font-medium block mb-1">
                  Description / Long Name
                </label>
                <input
                  type="text"
                  required
                  value={long}
                  onChange={(e) => setLong(e.target.value)}
                  placeholder="North Virginia Datacenter"
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
                disabled={createMutation.isPending || !short || !long}
                onClick={() => createMutation.mutate()}
              >
                Create Location
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Locations List */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading locations...</div>
        ) : (locations || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No locations created yet.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Nodes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {locations?.map((loc: any) => (
                <tr key={loc.id} className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-bold text-primary flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-text-muted" />
                    <span>{loc.short}</span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {loc.long}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="default">
                      {loc._count?.nodes || 0} NODE(S)
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete location ${loc.short}?`)) {
                          deleteMutation.mutate(loc.id);
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
