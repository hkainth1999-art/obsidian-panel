'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import {
  Layers,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
  Play,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Info,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';
import { Input } from '../../../../../components/ui/input';

export type ReleaseCategory = 'all' | 'release' | 'snapshot' | 'beta' | 'alpha' | 'lts';

interface VersionItem {
  version: string;
  build?: string;
  releaseType: 'release' | 'snapshot' | 'beta' | 'alpha' | 'lts';
  javaVersion: string;
  downloadUrl?: string;
  releaseTime?: string;
}

interface SoftwareCatalog {
  id: string;
  name: string;
  type: 'server' | 'proxy' | 'modded';
  description: string;
  icon: string;
  defaultJar: string;
  recommendedJava: string;
  totalCount: number;
  versions: VersionItem[];
}

const ITEMS_PER_PAGE = 36;

export default function ServerVersionManagerPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();

  const [selectedSoftwareId, setSelectedSoftwareId] = useState<string>('paper');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReleaseType, setSelectedReleaseType] = useState<ReleaseCategory>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [installingVersion, setInstallingVersion] = useState<VersionItem | null>(null);
  const [confirmWipe, setConfirmWipe] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch Server details for current active jar & variables
  const { data: server } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  // Fetch Version catalog
  const { data: catalog = [], isLoading } = useQuery<SoftwareCatalog[]>({
    queryKey: ['server-versions', uuid],
    queryFn: () => fetchApi<SoftwareCatalog[]>(`/api/client/servers/${uuid}/versions`),
    staleTime: 15 * 60 * 1000,
  });

  // Install version mutation
  const installMutation = useMutation({
    mutationFn: (payload: { software: string; version: string; customJarName?: string }) =>
      fetchApi(`/api/client/servers/${uuid}/versions/install`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data: any) => {
      setFeedback({
        type: 'success',
        message: data?.message || 'Software version installed successfully! You can now start the server.',
      });
      setInstallingVersion(null);
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
      queryClient.invalidateQueries({ queryKey: ['server-files', uuid] });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: `Installation failed: ${err.message || 'Unknown network error'}`,
      });
      setInstallingVersion(null);
    },
  });

  const selectedSoftware = catalog.find((s) => s.id === selectedSoftwareId) || catalog[0];

  // Reset pagination when changing software, search, or filter
  const handleSelectSoftware = (id: string) => {
    setSelectedSoftwareId(id);
    setSearchQuery('');
    setSelectedReleaseType('all');
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleFilterChange = (filter: ReleaseCategory) => {
    setSelectedReleaseType(filter);
    setCurrentPage(1);
  };

  // Filtered versions based on search and type
  const filteredVersions = useMemo(() => {
    if (!selectedSoftware) return [];
    return (selectedSoftware.versions || []).filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || v.version.toLowerCase().includes(q);
      const matchesType =
        selectedReleaseType === 'all' ||
        v.releaseType === selectedReleaseType ||
        (selectedReleaseType === 'beta' && (v.releaseType === 'beta' || v.releaseType === 'alpha'));
      return matchesSearch && matchesType;
    });
  }, [selectedSoftware, searchQuery, selectedReleaseType]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredVersions.length / ITEMS_PER_PAGE));
  const paginatedVersions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVersions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVersions, currentPage]);

  // Find active jar & installed version
  const jarVar = server?.variables?.find((v: any) =>
    server?.egg?.variables?.some((ev: any) => ev.id === v.variableId && ev.envVariable === 'SERVER_JARFILE'),
  );
  const currentJar = jarVar?.variableValue || 'paper.jar';

  const mcVerVar = server?.variables?.find((v: any) =>
    ['MINECRAFT_VERSION', 'MC_VERSION', 'VANILLA_VERSION'].includes(v.variable?.envVariable) ||
    server?.egg?.variables?.some((ev: any) => ev.id === v.variableId && ['MINECRAFT_VERSION', 'MC_VERSION', 'VANILLA_VERSION'].includes(ev.envVariable)),
  );
  const installedVersion = mcVerVar?.variableValue && mcVerVar.variableValue !== 'latest' ? mcVerVar.variableValue : (mcVerVar?.variableValue || null);

  const confirmInstall = () => {
    if (!installingVersion || !selectedSoftware) return;
    setFeedback(null);
    installMutation.mutate({
      software: selectedSoftware.id,
      version: installingVersion.version,
      customJarName: selectedSoftware.defaultJar,
    });
  };

  // Badges per release type
  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'lts':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'release':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'snapshot':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'beta':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'alpha':
        return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
      default:
        return 'bg-surface border-border text-text-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-card bg-surface border border-border">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-text-primary tracking-tight">Software Version Manager</h1>
            <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
              All Versions & Betas Included
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Switch between Vanilla, PaperMC, Purpur, Fabric, or Proxies with 1-click automatic JAR download & EULA setup.
          </p>
        </div>

        {/* Current Server Setup Badge */}
        <div className="flex flex-wrap items-center gap-3">
          {installedVersion && (
            <div className="flex items-center gap-2.5 p-2 px-3.5 rounded-control bg-status-running/10 border border-status-running/30">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-running opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-running"></span>
              </span>
              <div className="text-left">
                <span className="text-[9.5px] text-status-running font-semibold uppercase tracking-wider block">Installed Version</span>
                <span className="text-xs font-mono font-bold text-text-primary">
                  {installedVersion}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2.5 p-2 px-3.5 rounded-control bg-surface-elevated border border-border">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div className="text-left">
              <span className="text-[9.5px] text-text-muted uppercase tracking-wider block">Active Server JAR</span>
              <span className="text-xs font-mono font-medium text-text-primary">{currentJar}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-control border text-xs flex items-center justify-between gap-3 animate-fade-in ${
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
          {feedback.type === 'success' && (
            <a
              href={`/servers/${uuid}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-status-running text-black font-semibold rounded text-[11px] hover:bg-status-running/90 transition-colors"
            >
              Go to Console <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Software Tabs Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {catalog.map((sw) => {
          const isSelected = sw.id === selectedSoftwareId;
          const count = sw.totalCount || sw.versions?.length || 0;
          return (
            <button
              key={sw.id}
              onClick={() => handleSelectSoftware(sw.id)}
              className={`p-3 rounded-card text-left transition-all border flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary/30'
                  : 'bg-surface hover:bg-surface-elevated border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold truncate">{sw.name}</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border">
                  {sw.type}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-muted truncate mt-1">
                <span>{sw.defaultJar}</span>
                <span className="font-mono font-medium text-text-secondary">{count} ver</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Software Details & Versions View */}
      {selectedSoftware && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
              <div>
                <div className="flex items-center gap-2.5">
                  <CardTitle>{selectedSoftware.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    Default: {selectedSoftware.defaultJar}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-text-muted/30 text-text-muted">
                    {filteredVersions.length} of {selectedSoftware.totalCount || selectedSoftware.versions.length} versions
                  </Badge>
                </div>
                <CardDescription className="mt-1 text-xs">{selectedSoftware.description}</CardDescription>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[190px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    placeholder="Search version (e.g. 1.21, snapshot, rc)..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-8 h-8 text-xs bg-surface-elevated border-border"
                  />
                </div>

                <div className="flex items-center rounded-control bg-surface-elevated border border-border p-0.5 text-[11px]">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'release', label: 'Releases' },
                      { id: 'snapshot', label: 'Snapshots / RCs' },
                      { id: 'beta', label: 'Betas / Alphas' },
                      { id: 'lts', label: 'LTS / Popular' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleFilterChange(tab.id)}
                      className={`px-2.5 py-1 rounded capitalize transition-colors ${
                        selectedReleaseType === tab.id
                          ? 'bg-primary text-black font-semibold shadow-xs'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Versions Table / Grid */}
          <div className="p-4 pt-0">
            {isLoading ? (
              <div className="p-16 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <span>Loading complete version repository from official upstream APIs...</span>
              </div>
            ) : filteredVersions.length === 0 ? (
              <div className="p-12 text-center text-xs text-text-muted">
                No versions found matching &quot;{searchQuery}&quot; with filter &quot;{selectedReleaseType}&quot;.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {paginatedVersions.map((v) => {
                    const badgeClass = getBadgeStyle(v.releaseType);
                    const isInstalled = Boolean(
                      installedVersion &&
                      (v.version === installedVersion ||
                       v.version.toLowerCase() === installedVersion.toLowerCase() ||
                       (installedVersion.includes(v.version) && v.version.length >= 3))
                    );

                    return (
                      <div
                        key={v.version}
                        className={`p-3 rounded-control transition-all flex items-center justify-between gap-2.5 group ${
                          isInstalled
                            ? 'bg-status-running/10 border-2 border-status-running/60 shadow-md ring-1 ring-status-running/20'
                            : 'bg-surface-elevated border border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-text-primary font-mono truncate" title={v.version}>
                              {v.version}
                            </span>
                            {isInstalled ? (
                              <span className="text-[8.5px] uppercase px-1.5 py-0.2 rounded font-bold bg-status-running/25 text-status-running border border-status-running/40 flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Installed
                              </span>
                            ) : (
                              <span
                                className={`text-[8.5px] uppercase px-1.5 py-0.2 rounded font-semibold border ${badgeClass}`}
                              >
                                {v.releaseType}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[10.5px] text-text-muted">
                            <Cpu className="w-3 h-3 text-text-muted flex-shrink-0" />
                            <span className="truncate">{v.javaVersion}</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant={isInstalled ? 'primary' : 'secondary'}
                          onClick={() => {
                            setInstallingVersion(v);
                            setConfirmWipe(false);
                          }}
                          disabled={installMutation.isPending}
                          className={`h-7 px-2.5 text-[11px] font-semibold gap-1 transition-all flex-shrink-0 ${
                            isInstalled
                              ? 'bg-status-running hover:bg-status-running/90 text-black border-transparent'
                              : 'border-border hover:border-primary hover:text-primary'
                          }`}
                        >
                          <Download className="w-3 h-3" />
                          {isInstalled ? 'Reinstall' : 'Install'}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border mt-4 pt-4 text-xs text-text-muted">
                    <span>
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                      {Math.min(currentPage * ITEMS_PER_PAGE, filteredVersions.length)} of {filteredVersions.length}{' '}
                      versions
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="h-7 px-2"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <span className="px-2 font-mono text-[11px] text-text-primary font-semibold">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="h-7 px-2"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* Installation Confirmation Modal */}
      {installingVersion && selectedSoftware && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-card max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-control bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Install Server Software</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Confirm clean installation and software update.
                </p>
              </div>
            </div>

            <div className="space-y-3 p-3.5 bg-surface-elevated border border-border rounded-control text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted">Software:</span>
                <span className="font-semibold text-text-primary">{selectedSoftware.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted">Version:</span>
                <span className="font-mono font-bold text-primary">{installingVersion.version}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted">Installed JAR:</span>
                <span className="font-mono text-text-primary">{selectedSoftware.defaultJar}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">Required Java:</span>
                <span className="text-text-secondary">{installingVersion.javaVersion}</span>
              </div>
            </div>

            {/* Critical Data Warning */}
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-control flex items-start gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              <div className="space-y-1">
                <span className="font-bold text-rose-200">Warning: All server files will be wiped!</span>
                <p className="text-[11px] leading-relaxed text-rose-300/90">
                  Changing or reinstalling the server version will completely delete all existing files (world data, plugins, configurations, and logs) to install a clean build.
                </p>
              </div>
            </div>

            {/* Checkbox Acknowledgment */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-control bg-surface-elevated/70 border border-border cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmWipe}
                onChange={(e) => setConfirmWipe(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-0 focus:ring-offset-0 bg-surface cursor-pointer"
              />
              <span className="text-xs text-text-secondary leading-snug">
                I understand that all existing files will be cleared and replaced with a clean installation.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInstallingVersion(null)}
                disabled={installMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmInstall}
                disabled={!confirmWipe || installMutation.isPending}
                className={`gap-2 ${confirmWipe ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'opacity-50 cursor-not-allowed bg-surface-elevated text-text-muted border border-border'}`}
              >
                {installMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Installing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Wipe Files & Install
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
