'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import {
  Puzzle,
  Download,
  Search,
  CheckCircle2,
  Trash2,
  Power,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Sparkles,
  Star,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sliders,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';
import { formatBytes } from '../../../../../lib/utils';

interface PluginItem {
  id: string;
  pluginId: string;
  source: 'spigot' | 'modrinth';
  name: string;
  tagline: string;
  description?: string;
  author: string;
  downloads: number;
  rating: number;
  iconUrl: string | null;
  testedVersions: string[];
  sourceUrl: string;
  premium: boolean;
}

interface PluginVersionOption {
  id: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  downloadUrl: string;
  fileName: string;
  size: number;
  releaseDate: string;
}

interface InstalledPlugin {
  name: string;
  size: number;
  modified: string;
  isEnabled: boolean;
}

export default function ServerPluginsPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'all' | 'spigot' | 'modrinth' | 'installed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [versionModalPlugin, setVersionModalPlugin] = useState<PluginItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Debounce search
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch installed plugins
  const { data: installed = [], refetch: refetchInstalled, isLoading: isInstalledLoading } = useQuery<InstalledPlugin[]>({
    queryKey: ['server-plugins-installed', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}/plugins/installed`),
    refetchInterval: 15000,
  });

  // Fetch plugin search catalog
  const { data: catalogData, isLoading: isCatalogLoading, refetch: refetchCatalog } = useQuery<{
    plugins: PluginItem[];
    page: number;
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ['server-plugins-catalog', uuid, activeTab, debouncedQuery, page],
    queryFn: () => {
      const source = activeTab === 'installed' ? 'all' : activeTab;
      return fetchApi(
        `/api/client/servers/${uuid}/plugins?query=${encodeURIComponent(debouncedQuery)}&source=${source}&page=${page}`,
      );
    },
    enabled: activeTab !== 'installed',
    staleTime: 60 * 1000,
  });

  // Fetch version options for currently opened modal plugin
  const { data: pluginVersions = [], isLoading: isVersionsLoading } = useQuery<PluginVersionOption[]>({
    queryKey: ['plugin-versions', uuid, versionModalPlugin?.source, versionModalPlugin?.pluginId],
    queryFn: () => {
      if (!versionModalPlugin) return [];
      return fetchApi<PluginVersionOption[]>(
        `/api/client/servers/${uuid}/plugins/versions?source=${versionModalPlugin.source}&pluginId=${versionModalPlugin.pluginId}`,
      );
    },
    enabled: Boolean(versionModalPlugin),
  });

  // Install plugin mutation with Minecraft version support
  const installMutation = useMutation({
    mutationFn: (payload: {
      plugin: PluginItem;
      versionId?: string;
      mcVersion?: string;
      fileName?: string;
    }) =>
      fetchApi(`/api/client/servers/${uuid}/plugins/install`, {
        method: 'POST',
        body: JSON.stringify({
          source: payload.plugin.source,
          pluginId: payload.plugin.pluginId,
          versionId: payload.versionId,
          mcVersion: payload.mcVersion || '1.21.8',
          fileName: payload.fileName,
        }),
      }),
    onSuccess: (data: any, variables) => {
      setFeedback({
        type: 'success',
        message: data?.message || `Plugin "${variables.plugin.name}" installed successfully!`,
      });
      setInstallingId(null);
      setVersionModalPlugin(null);
      queryClient.invalidateQueries({ queryKey: ['server-plugins-installed', uuid] });
      queryClient.invalidateQueries({ queryKey: ['server-files', uuid] });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: `Failed to install plugin: ${err.message || 'Unknown network error'}`,
      });
      setInstallingId(null);
    },
  });

  // Uninstall plugin mutation
  const uninstallMutation = useMutation({
    mutationFn: (fileName: string) =>
      fetchApi(`/api/client/servers/${uuid}/plugins/uninstall`, {
        method: 'DELETE',
        body: JSON.stringify({ fileName }),
      }),
    onSuccess: (data: any) => {
      setFeedback({
        type: 'success',
        message: data?.message || 'Plugin uninstalled successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['server-plugins-installed', uuid] });
      queryClient.invalidateQueries({ queryKey: ['server-files', uuid] });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: `Uninstall failed: ${err.message}`,
      });
    },
  });

  // Toggle plugin mutation
  const toggleMutation = useMutation({
    mutationFn: (fileName: string) =>
      fetchApi(`/api/client/servers/${uuid}/plugins/toggle`, {
        method: 'POST',
        body: JSON.stringify({ fileName }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-plugins-installed', uuid] });
    },
  });

  const handleInstall = (
    plugin: PluginItem,
    options?: { versionId?: string; mcVersion?: string; fileName?: string },
  ) => {
    setFeedback(null);
    setInstallingId(plugin.id);
    installMutation.mutate({
      plugin,
      ...options,
    });
  };

  const isPluginInstalled = (plugin: PluginItem) => {
    const cleanName = plugin.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return installed.some((inst) => {
      const instClean = inst.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return instClean.includes(cleanName) || cleanName.includes(instClean);
    });
  };

  const formatDownloads = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-card bg-surface border border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-control bg-primary/10 text-primary border border-primary/20">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight">Plugin Manager</h1>
              <p className="text-xs text-text-muted mt-0.5">
                Install and manage Minecraft plugins directly from <strong>SpigotMC</strong> and <strong>Modrinth</strong> with 1-click downloads into <code className="text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">/plugins</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Installed Counter */}
        <div className="flex items-center gap-3 p-2.5 px-4 rounded-control bg-surface-elevated border border-border">
          <div className="w-2.5 h-2.5 rounded-full bg-status-running animate-pulse" />
          <div className="text-left">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block">Installed Plugins</span>
            <span className="text-xs font-mono font-bold text-text-primary">
              {installed.length} active in /plugins
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-control border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-status-running/10 border-status-running/30 text-status-running'
              : 'bg-status-stopping/10 border-status-stopping/30 text-status-stopping'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-control text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-primary text-black shadow-xs'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> All Sources
          </button>
          <button
            onClick={() => setActiveTab('spigot')}
            className={`px-3 py-1.5 rounded-control text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'spigot'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" /> SpigotMC
          </button>
          <button
            onClick={() => setActiveTab('modrinth')}
            className={`px-3 py-1.5 rounded-control text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'modrinth'
                ? 'bg-emerald-500 text-black shadow-xs'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Modrinth
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-3 py-1.5 rounded-control text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'installed'
                ? 'bg-cyan-500 text-black shadow-xs'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" /> Installed Plugins
            <span className="ml-1 px-1.5 py-0.2 bg-black/30 rounded-full text-[10px] font-mono">
              {installed.length}
            </span>
          </button>
        </div>

        {/* Search input for store tabs */}
        {activeTab !== 'installed' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SpigotMC & Modrinth plugins..."
              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary placeholder:text-text-muted"
            />
          </div>
        )}
      </div>

      {/* Tab: Installed Plugins */}
      {activeTab === 'installed' ? (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 bg-surface-elevated/40 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold text-text-primary">
                Installed Server Plugins (/plugins)
              </h3>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetchInstalled()}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>

          {isInstalledLoading ? (
            <div className="p-12 text-center text-xs text-text-muted">Loading plugins...</div>
          ) : installed.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Puzzle className="w-8 h-8 text-text-muted mx-auto opacity-50" />
              <p className="text-xs font-semibold text-text-primary">No plugins currently installed</p>
              <p className="text-[11px] text-text-muted max-w-sm mx-auto">
                Explore the All Sources, SpigotMC, or Modrinth tabs to install essentials, world management, economy, and performance plugins with 1-click.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {installed.map((item) => (
                <div
                  key={item.name}
                  className="p-3.5 px-4 flex items-center justify-between gap-4 hover:bg-surface-elevated/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-control flex items-center justify-center shrink-0 border ${
                        item.isEnabled
                          ? 'bg-status-running/10 text-status-running border-status-running/30'
                          : 'bg-surface-elevated text-text-muted border-border'
                      }`}
                    >
                      <Puzzle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-text-primary truncate">
                          {item.name}
                        </span>
                        {item.isEnabled ? (
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-status-running/15 text-status-running border border-status-running/30">
                            Active
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
                            Disabled
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                        {formatBytes(item.size)} &bull; Modified: {new Date(item.modified).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleMutation.mutate(item.name)}
                      disabled={toggleMutation.isPending}
                      className="h-7 text-xs gap-1 border-border"
                      title={item.isEnabled ? 'Disable plugin' : 'Enable plugin'}
                    >
                      <Power className="w-3 h-3" />
                      {item.isEnabled ? 'Disable' : 'Enable'}
                    </Button>
                    <button
                      onClick={() => {
                        if (confirm(`Uninstall and delete "${item.name}" from server?`)) {
                          uninstallMutation.mutate(item.name);
                        }
                      }}
                      disabled={uninstallMutation.isPending}
                      className="p-1.5 text-text-muted hover:text-status-error transition-colors rounded hover:bg-surface"
                      title="Uninstall plugin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        /* Tab: Store Catalog (All, SpigotMC, Modrinth) */
        <div className="space-y-4">
          {isCatalogLoading ? (
            <div className="p-16 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span>Fetching live catalog from SpigotMC and Modrinth APIs...</span>
            </div>
          ) : !catalogData?.plugins || catalogData.plugins.length === 0 ? (
            <div className="p-12 text-center text-xs text-text-muted border border-dashed border-border rounded-card bg-surface/30">
              No plugins found matching &quot;{debouncedQuery}&quot;. Try searching for &quot;Vault&quot;, &quot;Essentials&quot;, &quot;LuckPerms&quot;, or &quot;WorldEdit&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {catalogData.plugins.map((plugin) => {
                const isInstalled = isPluginInstalled(plugin);
                const isCurrentlyInstalling = installingId === plugin.id;

                return (
                  <Card
                    key={plugin.id}
                    className="p-4 flex flex-col justify-between gap-3.5 hover:border-primary/50 transition-all group"
                  >
                    <div>
                      {/* Top: Icon + Title + Source Badge */}
                      <div className="flex items-start gap-3">
                        {plugin.iconUrl ? (
                          <img
                            src={plugin.iconUrl}
                            alt={plugin.name}
                            className="w-10 h-10 rounded-control object-cover bg-surface-elevated border border-border shrink-0"
                            onError={(e) => {
                              // Fallback on broken image
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-control flex items-center justify-center shrink-0 border ${
                              plugin.source === 'spigot'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            <Puzzle className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <h3
                              className="text-xs font-bold text-text-primary truncate"
                              title={plugin.name}
                            >
                              {plugin.name}
                            </h3>
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded shrink-0 border ${
                                plugin.source === 'spigot'
                                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {plugin.source === 'spigot' ? 'SpigotMC' : 'Modrinth'}
                            </span>
                          </div>

                          <span className="text-[10px] text-text-muted truncate block mt-0.5">
                            by {plugin.author}
                          </span>
                        </div>
                      </div>

                      {/* Tagline / Description */}
                      <p className="text-[11px] text-text-secondary mt-2.5 line-clamp-2 leading-relaxed">
                        {plugin.tagline || 'Essential Minecraft server enhancement plugin.'}
                      </p>

                      {/* Supported Minecraft Versions Tags */}
                      {plugin.testedVersions && plugin.testedVersions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-2.5 pt-2 border-t border-border/40">
                          <span className="text-[10px] text-text-muted font-mono">Supports MC:</span>
                          {plugin.testedVersions.slice(0, 5).map((v) => (
                            <span
                              key={v}
                              className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded ${
                                v === '1.21.8' || v.startsWith('1.21')
                                  ? 'bg-status-running/15 text-status-running border border-status-running/30 font-bold'
                                  : 'bg-surface-elevated text-text-muted border border-border'
                              }`}
                            >
                              {v}
                            </span>
                          ))}
                          {plugin.testedVersions.length > 5 && (
                            <span className="text-[9px] text-text-muted font-mono">
                              +{plugin.testedVersions.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom: Stats & Action Button */}
                    <div className="pt-2.5 border-t border-border/60 flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-3 text-text-muted">
                        <span className="flex items-center gap-1 font-mono text-[10.5px]">
                          <Download className="w-3 h-3 text-primary" /> {formatDownloads(plugin.downloads)}
                        </span>
                        {plugin.rating > 0 && (
                          <span className="flex items-center gap-1 text-amber-400 text-[10.5px]">
                            <Star className="w-3 h-3 fill-current" /> {plugin.rating}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={plugin.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-text-muted hover:text-text-primary transition-colors"
                          title="View on source website"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {/* Choose Specific Version Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setVersionModalPlugin(plugin)}
                          className="h-7 px-2 text-[10.5px] font-mono text-text-muted hover:text-text-primary gap-1"
                          title="Choose specific Minecraft version release"
                        >
                          <Sliders className="w-3 h-3 text-primary" />
                          Versions
                        </Button>

                        {isInstalled ? (
                          <Badge variant="outline" className="border-status-running/40 text-status-running text-[10px] gap-1 py-0.5 px-2">
                            <Check className="w-3 h-3" /> Installed
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleInstall(plugin, { mcVersion: '1.21.8' })}
                            disabled={isCurrentlyInstalling || installMutation.isPending}
                            className="h-7 px-2.5 text-[11px] font-semibold gap-1 border-border hover:border-primary hover:text-primary transition-all"
                            title="1-Click Install latest version compatible with Minecraft 1.21.8"
                          >
                            {isCurrentlyInstalling ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Installing...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                <span>Install (1.21.8)</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Catalog Pagination */}
          {(catalogData?.hasMore || page > 1) && (
            <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-text-muted">
              <span>Page {page}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!catalogData?.hasMore}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 px-2"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Version Selection Modal */}
      {versionModalPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-surface border border-border rounded-card p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-control bg-primary/10 text-primary border border-primary/20">
                  <Puzzle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    Select Version &mdash; {versionModalPlugin.name}
                  </h3>
                  <p className="text-[11px] text-text-muted font-mono">
                    Target Server Version: <span className="text-status-running font-bold">Minecraft 1.21.8</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVersionModalPlugin(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Releases List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {isVersionsLoading ? (
                <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                  <span>Loading releases and Minecraft compatibility tags...</span>
                </div>
              ) : pluginVersions.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  No individual releases listed. You can use the direct 1-click Install button.
                </div>
              ) : (
                pluginVersions.map((ver) => {
                  const supportsTarget =
                    ver.gameVersions.includes('1.21.8') ||
                    ver.gameVersions.some((gv) => gv.startsWith('1.21'));
                  const isInstallingThis =
                    installingId === `${versionModalPlugin.id}:${ver.id}`;

                  return (
                    <div
                      key={ver.id}
                      className={`p-3 rounded-control border flex items-center justify-between gap-3 transition-colors ${
                        supportsTarget
                          ? 'bg-status-running/5 border-status-running/30 hover:border-status-running/60'
                          : 'bg-surface-elevated/40 border-border hover:border-border-hover'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-text-primary">
                            {ver.name || `v${ver.versionNumber}`}
                          </span>
                          {supportsTarget && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-status-running/20 text-status-running border border-status-running/30">
                              ✓ 1.21.8 Compatible
                            </span>
                          )}
                        </div>

                        {/* Supported MC versions row */}
                        <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] font-mono text-text-muted">
                          <span>MC:</span>
                          {ver.gameVersions.slice(0, 6).map((gv) => (
                            <span
                              key={gv}
                              className={`px-1 py-0.2 rounded ${
                                gv === '1.21.8' || gv.startsWith('1.21')
                                  ? 'bg-status-running/20 text-status-running font-bold'
                                  : 'bg-surface text-text-secondary'
                              }`}
                            >
                              {gv}
                            </span>
                          ))}
                          {ver.gameVersions.length > 6 && (
                            <span>+{ver.gameVersions.length - 6} more</span>
                          )}
                          {ver.size > 0 && (
                            <span className="opacity-70">&bull; {formatBytes(ver.size)}</span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={supportsTarget ? 'primary' : 'secondary'}
                        disabled={installMutation.isPending}
                        onClick={() => {
                          setInstallingId(`${versionModalPlugin.id}:${ver.id}`);
                          handleInstall(versionModalPlugin, {
                            versionId: ver.id,
                            fileName: ver.fileName,
                          });
                        }}
                        className="h-7 px-3 text-xs gap-1 shrink-0 font-semibold"
                      >
                        {isInstallingThis ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Installing...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3" />
                            <span>Install</span>
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[11px] text-text-muted">
                {pluginVersions.length} versions available
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVersionModalPlugin(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
