'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import { Layers, Plus, Upload, Download, Trash2, Box, FileText, Sparkles } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';

export default function AdminNestsPage() {
  const queryClient = useQueryClient();
  const [showNestModal, setShowNestModal] = useState(false);
  const [showEggModal, setShowEggModal] = useState(false);
  const [selectedNestId, setSelectedNestId] = useState<number | null>(null);

  // Form states
  const [nestName, setNestName] = useState('');
  const [nestDescription, setNestDescription] = useState('');
  const [eggJsonText, setEggJsonText] = useState('');

  const { data: nests, isLoading } = useQuery<any[]>({
    queryKey: ['admin-nests'],
    queryFn: () => fetchApi('/api/admin/nests'),
  });

  const { data: eggs } = useQuery<any[]>({
    queryKey: ['admin-eggs'],
    queryFn: () => fetchApi('/api/admin/eggs'),
  });

  const seedMinecraftMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/admin/nests/seed-minecraft', {
        method: 'POST',
      }),
    onSuccess: (data: any) => {
      alert(`Successfully seeded Minecraft Java nest and eggs (Paper, Fabric, Forge, Purpur, Vanilla, Velocity)!`);
      queryClient.invalidateQueries({ queryKey: ['admin-nests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-eggs'] });
    },
    onError: (err: any) => {
      alert(`Seeding failed: ${err.message}`);
    },
  });

  const createNestMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/admin/nests', {
        method: 'POST',
        body: JSON.stringify({ name: nestName, description: nestDescription }),
      }),
    onSuccess: () => {
      setShowNestModal(false);
      setNestName('');
      setNestDescription('');
      queryClient.invalidateQueries({ queryKey: ['admin-nests'] });
    },
  });

  const importEggMutation = useMutation({
    mutationFn: () => {
      let parsed = {};
      try {
        parsed = JSON.parse(eggJsonText);
      } catch (err: any) {
        throw new Error('Invalid JSON format');
      }
      return fetchApi(`/api/admin/eggs/import/${selectedNestId}`, {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
    },
    onSuccess: () => {
      setShowEggModal(false);
      setEggJsonText('');
      alert('Egg imported successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-eggs'] });
    },
    onError: (err: any) => {
      alert(`Egg import failed: ${err.message}`);
    },
  });

  const handleExportEgg = async (eggId: number, eggName: string) => {
    try {
      const exported = await fetchApi(`/api/admin/eggs/${eggId}/export`);
      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `egg-${eggName.toLowerCase().replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Nests & Eggs
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure game categories and import Pterodactyl-compatible game eggs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            disabled={seedMinecraftMutation.isPending}
            onClick={() => {
              if (confirm('Auto-seed Minecraft Java nest with Paper, Fabric, Forge, Purpur, Vanilla, and Velocity eggs?')) {
                seedMinecraftMutation.mutate();
              }
            }}
          >
            <Sparkles className="w-4 h-4 text-primary" /> {seedMinecraftMutation.isPending ? 'Seeding Eggs...' : 'Auto-Seed Minecraft Eggs'}
          </Button>
          <Button variant="secondary" size="md" onClick={() => setShowNestModal(true)}>
            <Plus className="w-4 h-4" /> New Nest
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={!nests || nests.length === 0}
            onClick={() => {
              if (nests && nests.length > 0) setSelectedNestId(nests[0].id);
              setShowEggModal(true);
            }}
          >
            <Upload className="w-4 h-4" /> Import Egg JSON
          </Button>
        </div>
      </div>

      {/* Create Nest Modal */}
      {showNestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Create Game Nest</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-secondary font-medium block mb-1">Nest Name</label>
                <input
                  type="text"
                  required
                  value={nestName}
                  onChange={(e) => setNestName(e.target.value)}
                  placeholder="e.g. Minecraft or Source Engine"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-text-secondary font-medium block mb-1">Description</label>
                <input
                  type="text"
                  value={nestDescription}
                  onChange={(e) => setNestDescription(e.target.value)}
                  placeholder="Servers running Java or Bedrock Minecraft"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowNestModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={createNestMutation.isPending || !nestName}
                onClick={() => createNestMutation.mutate()}
              >
                Create Nest
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Egg Modal */}
      {showEggModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Import Official Pterodactyl Egg</h3>
            <p className="text-xs text-text-muted">
              Paste the contents of any official Pterodactyl egg JSON file below. Obsidian will parse startup commands, environment variables, install scripts, and Docker images.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-secondary font-medium block mb-1">Target Nest</label>
                <select
                  value={selectedNestId || ''}
                  onChange={(e) => setSelectedNestId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                >
                  {nests?.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">Egg JSON Data</label>
                <textarea
                  rows={10}
                  value={eggJsonText}
                  onChange={(e) => setEggJsonText(e.target.value)}
                  placeholder='{ "meta": { "version": "PTDL_v2" }, "name": "Paper", ... }'
                  className="w-full p-3 bg-[#090909] border border-border rounded-control font-mono text-xs text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowEggModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={importEggMutation.isPending || !eggJsonText.trim()}
                onClick={() => importEggMutation.mutate()}
              >
                Import Egg
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Eggs List */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading nests and eggs...</div>
        ) : (eggs || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No game eggs imported yet. Click &quot;New Nest&quot; and &quot;Import Egg JSON&quot; above to add games.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">Egg Name</th>
                <th className="px-5 py-3">Nest</th>
                <th className="px-5 py-3">Author</th>
                <th className="px-5 py-3">Variables</th>
                <th className="px-5 py-3">Servers</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {eggs?.map((egg: any) => (
                <tr key={egg.id} className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-text-primary flex items-center gap-2">
                    <Box className="w-4 h-4 text-primary" />
                    <span>{egg.name}</span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {egg.nest?.name}
                  </td>
                  <td className="px-5 py-3.5 text-text-muted font-mono text-[11px]">
                    {egg.author}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="default">
                      {egg._count?.variables || 0} VARS
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-text-secondary">
                    {egg._count?.servers || 0}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExportEgg(egg.id, egg.name)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Export JSON
                    </Button>
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
