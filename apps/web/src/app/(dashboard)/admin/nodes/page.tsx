'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import {
  HardDrive,
  Plus,
  Activity,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Server,
  FileCode,
  X,
  Trash2,
  Network,
  Sliders,
  ExternalLink,
  Terminal,
  Key,
  Info,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { formatMemory } from '../../../../lib/utils';

// Black Neumorphic progress bar for nodes
function NeumorphicNodeProgressBar({
  percent,
  color = 'cyan',
}: {
  percent: number;
  color?: 'cyan' | 'amber' | 'emerald' | 'purple';
}) {
  const clamped = Math.max(0, Math.min(100, percent));

  let glowColor = 'from-cyan-500 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]';
  if (color === 'emerald') glowColor = 'from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]';
  if (color === 'amber') glowColor = 'from-amber-500 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]';
  if (color === 'purple') glowColor = 'from-purple-500 to-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]';

  return (
    <div className="w-full h-2 rounded-full bg-[#050608] shadow-[inset_2px_2px_4px_#020304,inset_-2px_-2px_4px_#10131a] p-[1.5px] overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${glowColor} transition-all duration-300`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function NodeHeartbeatBadge({ nodeId }: { nodeId: number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['node-heartbeat', nodeId],
    queryFn: () => fetchApi(`/api/admin/nodes/${nodeId}/test-connection`, { method: 'POST' }),
    refetchInterval: 12000,
    retry: false,
  });

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#070a10] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] text-[10px] font-mono text-zinc-400">
        <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
        POLLING...
      </span>
    );
  }

  if (data?.online) {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#070a10] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)] text-[10px] font-mono text-emerald-400 font-bold">
        {/* Optical jewel LED lens */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-running opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
        </span>
        WINGS ONLINE {data.systemInfo?.version ? `(${data.systemInfo.version})` : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#070a10] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)] text-[10px] font-mono text-rose-400 font-bold">
      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]"></span>
      WINGS OFFLINE
    </span>
  );
}

export default function AdminNodesPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [configNodeId, setConfigNodeId] = useState<number | null>(null);
  const [allocationsNodeId, setAllocationsNodeId] = useState<number | null>(null);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [configTab, setConfigTab] = useState<'command' | 'token' | 'manual'>('command');
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [modalTestStatus, setModalTestStatus] = useState<any>(null);
  const [isTestingModal, setIsTestingModal] = useState(false);

  // Form state for node creation
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationId, setLocationId] = useState<number>(1);
  const [fqdn, setFqdn] = useState('');
  const [scheme, setScheme] = useState('https');
  const [behindProxy, setBehindProxy] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [daemonPort, setDaemonPort] = useState(8080);
  const [daemonSftpPort, setDaemonSftpPort] = useState(2022);
  const [memory, setMemory] = useState(16384);
  const [memoryOverallocate, setMemoryOverallocate] = useState(0);
  const [disk, setDisk] = useState(102400);
  const [diskOverallocate, setDiskOverallocate] = useState(0);
  const [uploadSize, setUploadSize] = useState(100);

  // Initial port allocations options
  const [createAllocations, setCreateAllocations] = useState(true);
  const [initialIp, setInitialIp] = useState('0.0.0.0');
  const [initialPorts, setInitialPorts] = useState('25565-25575');

  // In-modal quick allocation state
  const [newAllocIp, setNewAllocIp] = useState('0.0.0.0');
  const [newAllocPorts, setNewAllocPorts] = useState('');

  // Queries
  const { data: nodes, isLoading } = useQuery<any[]>({
    queryKey: ['admin-nodes'],
    queryFn: () => fetchApi('/api/admin/nodes'),
  });

  const { data: locations } = useQuery<any[]>({
    queryKey: ['admin-locations'],
    queryFn: () => fetchApi('/api/admin/locations'),
  });

  const { data: nodeConfig, isLoading: isConfigLoading } = useQuery<any>({
    queryKey: ['node-config-details', configNodeId],
    queryFn: () => fetchApi(`/api/admin/nodes/${configNodeId}/configuration`),
    enabled: configNodeId !== null,
  });

  const { data: nodeAllocations, isLoading: isAllocationsLoading } = useQuery<any[]>({
    queryKey: ['admin-node-allocations', allocationsNodeId],
    queryFn: () => fetchApi(`/api/admin/nodes/${allocationsNodeId}/allocations`),
    enabled: allocationsNodeId !== null,
  });

  // Create node mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const newNode = await fetchApi('/api/admin/nodes', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          locationId: Number(locationId),
          fqdn,
          scheme,
          behindProxy,
          daemonPort: Number(daemonPort),
          daemonSftpPort: Number(daemonSftpPort),
          memory: Number(memory),
          memoryOverallocate: Number(memoryOverallocate),
          disk: Number(disk),
          diskOverallocate: Number(diskOverallocate),
          uploadSize: Number(uploadSize),
        }),
      });

      // Optionally create initial port allocations
      if (createAllocations && initialPorts.trim() && newNode?.id) {
        try {
          await fetchApi(`/api/admin/nodes/${newNode.id}/allocations`, {
            method: 'POST',
            body: JSON.stringify({
              ip: initialIp.trim() || '0.0.0.0',
              ports: initialPorts.split(',').map((p) => p.trim()),
            }),
          });
        } catch (e: any) {
          console.warn('Initial allocations failed:', e.message);
        }
      }

      return newNode;
    },
    onSuccess: (newNode: any) => {
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setFqdn('');
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
      if (newNode?.id) {
        setConfigNodeId(newNode.id);
        setConfigTab('command');
        setModalTestStatus(null);
      }
    },
    onError: (err: any) => {
      alert(`Failed to create node: ${err.message}`);
    },
  });

  // Quick add allocation mutation
  const addAllocMutation = useMutation({
    mutationFn: async () => {
      if (!allocationsNodeId || !newAllocPorts.trim()) return;
      return fetchApi(`/api/admin/nodes/${allocationsNodeId}/allocations`, {
        method: 'POST',
        body: JSON.stringify({
          ip: newAllocIp.trim() || '0.0.0.0',
          ports: newAllocPorts.split(',').map((p) => p.trim()),
        }),
      });
    },
    onSuccess: (data: any) => {
      setNewAllocPorts('');
      queryClient.invalidateQueries({ queryKey: ['admin-node-allocations', allocationsNodeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
      alert(`Successfully added ${data.created || 'port'} allocation(s)!`);
    },
    onError: (err: any) => {
      alert(`Failed to add allocation: ${err.message}`);
    },
  });

  // Delete allocation mutation
  const deleteAllocMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/api/admin/allocations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-node-allocations', allocationsNodeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  // Test connection mutation
  const testConnMutation = useMutation({
    mutationFn: (nodeId: number) =>
      fetchApi(`/api/admin/nodes/${nodeId}/test-connection`, { method: 'POST' }),
    onSuccess: (data: any) => {
      if (data.online) {
        alert(`✅ Wings Online!\nVersion: ${data.systemInfo?.version}\nOS: ${data.systemInfo?.os}\nCPUs: ${data.systemInfo?.cpu_count}`);
      } else {
        alert(`❌ Connection Failed:\n${data.message}`);
      }
    },
  });

  // Delete node mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/api/admin/nodes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  const copyCommand = (cmd: string) => {
    if (cmd) {
      navigator.clipboard.writeText(cmd);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  const copyCurl = (cmd: string) => {
    if (cmd) {
      navigator.clipboard.writeText(cmd);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    }
  };

  const copyToken = (tok: string) => {
    if (tok) {
      navigator.clipboard.writeText(tok);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const copyYaml = () => {
    if (nodeConfig?.yaml) {
      navigator.clipboard.writeText(nodeConfig.yaml);
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  };

  const testModalConnection = async () => {
    if (!configNodeId) return;
    setIsTestingModal(true);
    try {
      const res = await fetchApi(`/api/admin/nodes/${configNodeId}/test-connection`, {
        method: 'POST',
      });
      setModalTestStatus(res);
      queryClient.invalidateQueries({ queryKey: ['node-heartbeat', configNodeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
    } catch (e: any) {
      setModalTestStatus({ online: false, message: e.message });
    } finally {
      setIsTestingModal(false);
    }
  };

  const selectedAllocNode = nodes?.find((n) => n.id === allocationsNodeId);
  const selectedConfigNode = nodes?.find((n) => n.id === configNodeId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Nodes Management
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure host machines, resource limits, and network port pools running Pterodactyl Wings
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/allocations">
            <Button variant="secondary" size="md">
              <Network className="w-4 h-4" /> All Allocations
            </Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              if (locations?.length) setLocationId(locations[0].id);
              setShowCreateModal(true);
            }}
          >
            <Plus className="w-4 h-4" /> Register Node
          </Button>
        </div>
      </div>

      {/* Wings Connection & Configuration Modal */}
      {configNodeId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl bg-surface border border-border rounded-card p-6 space-y-5 shadow-2xl my-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-primary">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text-primary">
                      Connect &amp; Configure Node
                    </h3>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {selectedConfigNode?.name || `Node #${configNodeId}`}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 font-mono">
                    {selectedConfigNode?.scheme}://{selectedConfigNode?.fqdn}:{selectedConfigNode?.daemonPort} &bull; {selectedConfigNode?.location?.short}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setConfigNodeId(null);
                  setModalTestStatus(null);
                }}
                className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Connection Heartbeat / Test Banner */}
            <div className="flex items-center justify-between p-3 rounded-control bg-surface-elevated border border-border">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-primary" />
                <div>
                  <span className="text-xs font-semibold text-text-primary block">
                    Daemon Heartbeat Status
                  </span>
                  <div className="text-[11px] text-text-muted font-mono flex items-center gap-1.5 mt-0.5">
                    {isTestingModal ? (
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Testing daemon connection...
                      </span>
                    ) : modalTestStatus ? (
                      modalTestStatus.online ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" /> ONLINE &mdash; Wings v{modalTestStatus.systemInfo?.version || '1.x'} ({modalTestStatus.systemInfo?.os || 'Linux'})
                        </span>
                      ) : (
                        <span className="text-rose-400 font-medium flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" /> OFFLINE &mdash; {modalTestStatus.message || 'Could not connect to Wings'}
                        </span>
                      )
                    ) : (
                      <span className="text-text-muted flex items-center gap-1.5">
                        <NodeHeartbeatBadge nodeId={configNodeId} />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled={isTestingModal}
                onClick={testModalConnection}
                className="shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isTestingModal ? 'animate-spin' : ''}`} />
                {isTestingModal ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-control border border-border">
              <button
                type="button"
                onClick={() => setConfigTab('command')}
                className={`flex-1 py-2 text-xs font-medium rounded-control transition-all flex items-center justify-center gap-2 ${
                  configTab === 'command'
                    ? 'bg-surface text-text-primary shadow-sm font-semibold'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-primary" />
                Simple Command (Auto-Deploy)
              </button>
              <button
                type="button"
                onClick={() => setConfigTab('token')}
                className={`flex-1 py-2 text-xs font-medium rounded-control transition-all flex items-center justify-center gap-2 ${
                  configTab === 'token'
                    ? 'bg-surface text-text-primary shadow-sm font-semibold'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Token Configuration
              </button>
              <button
                type="button"
                onClick={() => setConfigTab('manual')}
                className={`flex-1 py-2 text-xs font-medium rounded-control transition-all flex items-center justify-center gap-2 ${
                  configTab === 'manual'
                    ? 'bg-surface text-text-primary shadow-sm font-semibold'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-sky-400" />
                Manual Configuration (config.yml)
              </button>
            </div>

            {/* Tab 1: Simple Command */}
            {configTab === 'command' && (
              <div className="space-y-4 text-xs">
                {/* Wings Auto Deploy Command */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      Option A: Official Wings Configure Command
                    </span>
                    <span className="text-[10px] text-text-muted">Pterodactyl Wings standard</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Run this command on your node machine. Wings will automatically fetch its configuration from the panel and generate <code className="text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">/etc/pterodactyl/config.yml</code>.
                  </p>
                  <div className="relative">
                    <pre className="p-3 bg-[#07090e] border border-border rounded-control font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all pr-24">
                      {isConfigLoading
                        ? 'Loading command...'
                        : nodeConfig?.configureCommand ||
                          `cd /etc/pterodactyl && sudo wings configure --panel-url ${typeof window !== 'undefined' ? window.location.origin : ''} --token ${nodeConfig?.token} --node ${configNodeId}`}
                    </pre>
                    <button
                      onClick={() =>
                        copyCommand(
                          nodeConfig?.configureCommand ||
                            `cd /etc/pterodactyl && sudo wings configure --panel-url ${window.location.origin} --token ${nodeConfig?.token} --node ${configNodeId}`
                        )
                      }
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-surface-elevated hover:bg-surface border border-border rounded text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
                    >
                      {copiedCommand ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-status-running" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Command
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 1-Line Curl Setup */}
                <div className="space-y-2 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      Option B: One-Line Curl Deployment Command
                    </span>
                    <span className="text-[10px] text-text-muted">Instant YAML download &amp; restart</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Downloads and writes the exact YAML configuration directly to <code className="text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">/etc/pterodactyl/config.yml</code> and restarts the Wings service.
                  </p>
                  <div className="relative">
                    <pre className="p-3 bg-[#07090e] border border-border rounded-control font-mono text-[11px] text-cyan-400 overflow-x-auto whitespace-pre-wrap break-all pr-24">
                      {isConfigLoading
                        ? 'Loading curl command...'
                        : nodeConfig?.quickDeployCommand ||
                          `sudo mkdir -p /etc/pterodactyl && curl -fsSL "${typeof window !== 'undefined' ? window.location.origin : ''}/api/application/nodes/${configNodeId}/configuration/raw?token=${nodeConfig?.token}" | sudo tee /etc/pterodactyl/config.yml > /dev/null && sudo systemctl restart wings`}
                    </pre>
                    <button
                      onClick={() =>
                        copyCurl(
                          nodeConfig?.quickDeployCommand ||
                            `sudo mkdir -p /etc/pterodactyl && curl -fsSL "${window.location.origin}/api/application/nodes/${configNodeId}/configuration/raw?token=${nodeConfig?.token}" | sudo tee /etc/pterodactyl/config.yml > /dev/null && sudo systemctl restart wings`
                        )
                      }
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-surface-elevated hover:bg-surface border border-border rounded text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
                    >
                      {copiedCurl ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-status-running" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Command
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Service start reminder */}
                <div className="p-3 bg-surface-elevated border border-border rounded-control space-y-1">
                  <span className="text-[11px] font-semibold text-text-primary flex items-center gap-1">
                    <Info className="w-3 h-3 text-primary" /> Start &amp; Enable Service
                  </span>
                  <p className="text-[11px] text-text-muted">
                    After configuring, ensure Wings is active and set to boot automatically:
                  </p>
                  <code className="block p-2 bg-[#050608] border border-border rounded font-mono text-[11px] text-text-primary select-all">
                    sudo systemctl enable --now wings
                  </code>
                </div>
              </div>
            )}

            {/* Tab 2: Token Configuration */}
            {configTab === 'token' && (
              <div className="space-y-4 text-xs">
                <p className="text-text-muted text-[11px]">
                  Use these token credentials to connect your daemon or authenticate automated configuration workflows:
                </p>

                {/* Combined Deploy Token */}
                <div className="p-3.5 bg-surface-elevated border border-border rounded-control space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-text-primary flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      Combined Node Deploy Token (Token ID + Secret)
                    </label>
                    <span className="text-[10px] text-text-muted font-mono">Bearer Token Format</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={nodeConfig?.token || 'Loading...'}
                      className="flex-1 px-3 py-2 bg-surface border border-border rounded text-xs text-text-primary font-mono select-all focus:outline-none"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => copyToken(nodeConfig?.token || '')}
                    >
                      {copiedToken ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy Token
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Individual parameters grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-surface-elevated border border-border rounded-control space-y-1">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Token ID</span>
                    <code className="text-xs font-mono text-primary font-semibold block select-all">
                      {nodeConfig?.daemonTokenId || '...'}
                    </code>
                  </div>

                  <div className="p-3 bg-surface-elevated border border-border rounded-control space-y-1">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Node UUID</span>
                    <code className="text-xs font-mono text-text-primary block select-all">
                      {nodeConfig?.nodeUuid || '...'}
                    </code>
                  </div>

                  <div className="p-3 bg-surface-elevated border border-border rounded-control space-y-1">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Node ID</span>
                    <code className="text-xs font-mono text-text-primary block select-all">
                      {nodeConfig?.nodeId || configNodeId}
                    </code>
                  </div>

                  <div className="p-3 bg-surface-elevated border border-border rounded-control space-y-1">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Panel Remote URL</span>
                    <code className="text-xs font-mono text-text-primary block select-all">
                      {nodeConfig?.panelUrl || (typeof window !== 'undefined' ? window.location.origin : '')}
                    </code>
                  </div>
                </div>

                {/* Daemon Token Secret */}
                <div className="p-3 bg-surface-elevated border border-border rounded-control space-y-1">
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Daemon Secret Token</span>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono text-text-secondary select-all break-all">
                      {nodeConfig?.daemonToken || '...'}
                    </code>
                    <button
                      onClick={() => copyToken(nodeConfig?.daemonToken || '')}
                      className="px-2 py-1 bg-surface border border-border rounded text-[10px] text-text-muted hover:text-text-primary shrink-0"
                    >
                      Copy Secret
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Manual Configuration (that was present) */}
            {configTab === 'manual' && (
              <div className="space-y-3 text-xs">
                <p className="text-xs text-text-muted">
                  Save this exact file on your hosting node to <code className="text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">/etc/pterodactyl/config.yml</code> and start Wings with <code className="text-text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">systemctl start wings</code>.
                </p>

                <div className="relative">
                  <pre className="p-4 bg-[#090909] border border-border rounded-control font-mono text-xs text-text-primary max-h-80 overflow-y-auto">
                    {isConfigLoading ? 'Generating configuration...' : nodeConfig?.yaml}
                  </pre>
                  <button
                    onClick={copyYaml}
                    className="absolute top-3 right-3 px-2.5 py-1 bg-surface-elevated hover:bg-surface border border-border rounded text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
                  >
                    {copiedConfig ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-status-running" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy YAML
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                disabled={isTestingModal}
                onClick={testModalConnection}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isTestingModal ? 'animate-spin' : ''}`} />
                {isTestingModal ? 'Testing...' : 'Test Connection'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setConfigNodeId(null);
                  setModalTestStatus(null);
                }}
              >
                Done / Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Node In-Page Allocations Manager Modal */}
      {allocationsNodeId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    Port Allocations &mdash; {selectedAllocNode?.name}
                  </h3>
                  <p className="text-[11px] text-text-muted font-mono">{selectedAllocNode?.fqdn}</p>
                </div>
              </div>
              <button
                onClick={() => setAllocationsNodeId(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Add Ports */}
            <div className="p-3 bg-surface-elevated border border-border rounded-control space-y-2">
              <span className="text-xs font-semibold text-text-primary block">Quick Add Port Allocations</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-text-muted block mb-0.5">IP Address</label>
                  <input
                    type="text"
                    value={newAllocIp}
                    onChange={(e) => setNewAllocIp(e.target.value)}
                    placeholder="0.0.0.0 or Node IP"
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-text-muted block mb-0.5">Ports (e.g. 25565 or 25565-25575)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAllocPorts}
                      onChange={(e) => setNewAllocPorts(e.target.value)}
                      placeholder="25565, 25566, 25570-25580"
                      className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={addAllocMutation.isPending || !newAllocPorts.trim()}
                      onClick={() => addAllocMutation.mutate()}
                    >
                      {addAllocMutation.isPending ? 'Adding...' : 'Add Ports'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Allocations Table */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[350px] border border-border rounded-control">
              {isAllocationsLoading ? (
                <div className="p-8 text-center text-xs text-text-muted">Loading allocations...</div>
              ) : (nodeAllocations || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  No allocations found on this node. Use the quick add form above to allocate port pools.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-elevated border-b border-border text-text-muted font-medium sticky top-0">
                    <tr>
                      <th className="px-3 py-2">IP Address</th>
                      <th className="px-3 py-2">Port</th>
                      <th className="px-3 py-2">Alias</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {nodeAllocations?.map((alloc: any) => (
                      <tr key={alloc.id} className="hover:bg-surface-elevated/40">
                        <td className="px-3 py-2 font-mono text-text-primary">{alloc.ip}</td>
                        <td className="px-3 py-2 font-mono font-bold text-primary">{alloc.port}</td>
                        <td className="px-3 py-2 text-text-muted">{alloc.alias || '&mdash;'}</td>
                        <td className="px-3 py-2">
                          {alloc.serverId ? (
                            <Badge variant="success">Assigned (Server #{alloc.serverId})</Badge>
                          ) : (
                            <Badge variant="outline">Available</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!alloc.serverId && (
                            <button
                              onClick={() => deleteAllocMutation.mutate(alloc.id)}
                              className="text-text-muted hover:text-status-error transition-colors p-1"
                              title="Delete Port"
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

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[11px] text-text-muted">
                Total allocations: <strong>{nodeAllocations?.length || 0}</strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setAllocationsNodeId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Node Modal (Full Pterodactyl Options) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-xl bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl my-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" /> Register Wings Node
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
              {/* Section 1: Basic Node Info */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  1. Basic Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Node Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. US-Node-01"
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Location *</label>
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    >
                      {locations?.map((l: any) => (
                        <option key={l.id} value={l.id}>
                          {l.short} &mdash; {l.long}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-text-secondary font-medium block mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Ryzen 9 7950X, 128GB DDR5, High Performance Node"
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Section 2: Host & Connectivity */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  2. Connectivity & Security
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-text-secondary font-medium block mb-1">FQDN or Host IP *</label>
                    <input
                      type="text"
                      required
                      value={fqdn}
                      onChange={(e) => setFqdn(e.target.value)}
                      placeholder="node1.example.com"
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Scheme</label>
                    <select
                      value={scheme}
                      onChange={(e) => setScheme(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="https">https (SSL)</option>
                      <option value="http">http (Non-SSL)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Daemon Listen Port</label>
                    <input
                      type="number"
                      value={daemonPort}
                      onChange={(e) => setDaemonPort(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Daemon SFTP Port</label>
                    <input
                      type="number"
                      value={daemonSftpPort}
                      onChange={(e) => setDaemonSftpPort(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-text-secondary">
                    <input
                      type="checkbox"
                      checked={behindProxy}
                      onChange={(e) => setBehindProxy(e.target.checked)}
                      className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
                    />
                    <span>Behind Proxy (Cloudflare / SSL terminator)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-text-secondary">
                    <input
                      type="checkbox"
                      checked={maintenanceMode}
                      onChange={(e) => setMaintenanceMode(e.target.checked)}
                      className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
                    />
                    <span>Maintenance Mode</span>
                  </label>
                </div>
              </div>

              {/* Section 3: Hardware Resources & Overallocation */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  3. Hardware Allocations & Limits
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Total Memory (MiB)</label>
                    <input
                      type="number"
                      min={1}
                      max={2147483647}
                      value={memory}
                      onChange={(e) => setMemory(Math.min(2147483647, Math.max(0, Number(e.target.value))))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">Max: 2,147,483,647 MiB (~2 PB)</p>
                  </div>
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Memory Overallocate (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={2147483647}
                      value={memoryOverallocate}
                      onChange={(e) => setMemoryOverallocate(Math.min(2147483647, Math.max(0, Number(e.target.value))))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Total Disk Space (MiB)</label>
                    <input
                      type="number"
                      min={1}
                      max={2147483647}
                      value={disk}
                      onChange={(e) => setDisk(Math.min(2147483647, Math.max(0, Number(e.target.value))))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">Max: 2,147,483,647 MiB (~2 PB)</p>
                  </div>
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Disk Overallocate (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={2147483647}
                      value={diskOverallocate}
                      onChange={(e) => setDiskOverallocate(Math.min(2147483647, Math.max(0, Number(e.target.value))))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-text-secondary font-medium block mb-1">Max Web Upload Size (MiB)</label>
                  <input
                    type="number"
                    value={uploadSize}
                    onChange={(e) => setUploadSize(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              {/* Section 4: Initial Port Allocations (Like Pterodactyl) */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                    4. Initial Port Allocation (Pterodactyl Style)
                  </h4>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={createAllocations}
                      onChange={(e) => setCreateAllocations(e.target.checked)}
                      className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
                    />
                    <span>Create ports immediately</span>
                  </label>
                </div>

                {createAllocations && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-elevated border border-border rounded-control">
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Allocation IP</label>
                      <input
                        type="text"
                        value={initialIp}
                        onChange={(e) => setInitialIp(e.target.value)}
                        placeholder="0.0.0.0 or Node IP"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Ports Range / List</label>
                      <input
                        type="text"
                        value={initialPorts}
                        onChange={(e) => setInitialPorts(e.target.value)}
                        placeholder="25565-25575 or 25565, 25566"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <p className="text-[10px] text-text-muted col-span-2">
                      Tip: Specify individual ports separated by commas, or port ranges using hyphens (e.g. <code className="text-primary font-mono">25565-25575, 27015-27020</code>).
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={createMutation.isPending || !name || !fqdn}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Registering...' : 'Register Node'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Nodes List / Zero State */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-text-muted">Loading nodes...</div>
      ) : (nodes || []).length === 0 ? (
        <div className="border border-border/80 border-dashed rounded-card p-12 text-center bg-surface/30">
          <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted mx-auto mb-4">
            <HardDrive className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">
            No nodes connected
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-6">
            Register your first Wings game-hosting node. Once registered, you will be given an official configuration file to paste onto the daemon machine.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              if (locations?.length) setLocationId(locations[0].id);
              setShowCreateModal(true);
            }}
          >
            <Plus className="w-4 h-4" /> Register First Node
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {nodes?.map((node) => (
            <div
              key={node.id}
              className="bg-[#090b0f] border border-white/[0.04] rounded-2xl p-5 shadow-[6px_6px_16px_#030406,-6px_-6px_16px_#12151d,inset_0_1px_0_rgba(255,255,255,0.03)] flex flex-col justify-between gap-4.5 relative overflow-hidden"
            >
              {/* Top Neumorphic Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#050608] shadow-[inset_2px_2px_4px_#020304,inset_-2px_-2px_4px_#10131a] border border-black/80 flex items-center justify-center text-primary">
                    <Server className="w-5 h-5 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-bold font-mono tracking-tight text-text-primary">
                        {node.name}
                      </h3>
                      <NodeHeartbeatBadge nodeId={node.id} />
                    </div>
                    <p className="text-xs font-mono text-zinc-400 mt-0.5">
                      {node.scheme}://{node.fqdn}:{node.daemonPort} &bull; <span className="text-primary font-semibold">{node.location?.short}</span>
                    </p>
                  </div>
                </div>

                {/* Black Neumorphic Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAllocationsNodeId(node.id)}
                    title="Manage Port Allocations for this Node"
                    className="px-2.5 py-1.5 rounded-xl bg-[#0c0e14] border border-white/[0.04] text-text-secondary hover:text-text-primary shadow-[3px_3px_6px_#030406,-3px_-3px_6px_#12151d] active:shadow-[inset_2px_2px_4px_#020304,inset_-2px_-2px_4px_#10131a] text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                  >
                    <Network className="w-3.5 h-3.5 text-primary" /> Allocations
                  </button>
                  <button
                    onClick={() => testConnMutation.mutate(node.id)}
                    title="Test authenticated connection to Wings daemon"
                    className="px-2.5 py-1.5 rounded-xl bg-[#0c0e14] border border-white/[0.04] text-text-secondary hover:text-text-primary shadow-[3px_3px_6px_#030406,-3px_-3px_6px_#12151d] active:shadow-[inset_2px_2px_4px_#020304,inset_-2px_-2px_4px_#10131a] text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Test
                  </button>
                  <button
                    onClick={() => {
                      setConfigNodeId(node.id);
                      setConfigTab('command');
                      setModalTestStatus(null);
                    }}
                    title="Connect & configure Wings daemon (command, token, or manual config)"
                    className="px-2.5 py-1.5 rounded-xl bg-[#0c0e14] border border-white/[0.04] text-text-secondary hover:text-text-primary shadow-[3px_3px_6px_#030406,-3px_-3px_6px_#12151d] active:shadow-[inset_2px_2px_4px_#020304,inset_-2px_-2px_4px_#10131a] text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                  >
                    <Terminal className="w-3.5 h-3.5 text-sky-400" /> Connect
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete node ${node.name}?`)) {
                        deleteMutation.mutate(node.id);
                      }
                    }}
                    className="p-1.5 rounded-xl bg-[#0c0e14] border border-rose-500/10 text-zinc-400 hover:text-rose-400 shadow-[3px_3px_6px_#030406,-3px_-3px_6px_#12151d] active:shadow-[inset_2px_2px_4px_#020304,inset_-2px_-2px_4px_#10131a] transition-colors"
                    title="Delete Node"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Neumorphic Resource Allocation Gauges with Exact Utilization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Memory Allocation Gauge */}
                <div className="p-3.5 rounded-xl bg-[#050608] border border-black/80 shadow-[inset_3px_3px_6px_#020304,inset_-3px_-3px_6px_#0f1218] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-cyan-400" /> Memory Pool
                    </span>
                    <span className="text-cyan-400 font-bold drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]">
                      {Math.round(node.stats.memoryUsagePercent)}%
                    </span>
                  </div>
                  <NeumorphicNodeProgressBar percent={node.stats.memoryUsagePercent} color="cyan" />
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
                    <span className="text-zinc-500">USED / LIMIT</span>
                    <span className="text-cyan-300 font-bold">
                      {formatMemory(node.stats.allocatedMemory)} / {formatMemory(node.memory)}
                    </span>
                  </div>
                  <div className="text-[9.5px] font-mono text-zinc-500 text-right">
                    Remaining: <span className="text-zinc-300">{formatMemory(Math.max(0, node.memory - node.stats.allocatedMemory))}</span>
                  </div>
                </div>

                {/* Disk Allocation Gauge */}
                <div className="p-3.5 rounded-xl bg-[#050608] border border-black/80 shadow-[inset_3px_3px_6px_#020304,inset_-3px_-3px_6px_#0f1218] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3 text-amber-400" /> Storage Pool
                    </span>
                    <span className="text-amber-400 font-bold drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">
                      {Math.round(node.stats.diskUsagePercent)}%
                    </span>
                  </div>
                  <NeumorphicNodeProgressBar percent={node.stats.diskUsagePercent} color="amber" />
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
                    <span className="text-zinc-500">USED / LIMIT</span>
                    <span className="text-amber-300 font-bold">
                      {formatMemory(node.stats.allocatedDisk)} / {formatMemory(node.disk)}
                    </span>
                  </div>
                  <div className="text-[9.5px] font-mono text-zinc-500 text-right">
                    Remaining: <span className="text-zinc-300">{formatMemory(Math.max(0, node.disk - node.stats.allocatedDisk))}</span>
                  </div>
                </div>
              </div>

              {/* Neumorphic Live Telemetry Activity Spectrum */}
              <div className="p-3 rounded-xl bg-[#050608] border border-black/80 shadow-[inset_3px_3px_6px_#020304,inset_-3px_-3px_6px_#0f1218] relative overflow-hidden">
                <div className="flex items-center justify-between text-[10.5px] font-mono mb-2 relative z-20">
                  <span className="text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                    <Activity className="w-3 h-3 text-emerald-400" /> Daemon Telemetry Analyzer
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase">12s Polling Pulse</span>
                </div>

                <div className="h-8 w-full flex items-end gap-1.5 pt-1 relative z-20">
                  {[25, 45, 30, 60, 40, 75, 50, Math.round(node.stats.memoryUsagePercent || 15), Math.round(node.stats.diskUsagePercent || 10)].map((val, idx) => (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col justify-end gap-[1px] h-full"
                    >
                      <div
                        className="w-full rounded-full transition-all duration-500 bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_8px_#10b981]"
                        style={{ height: `${Math.max(15, Math.min(val, 100))}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Chassis Details Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[11px] font-mono text-zinc-400">
                <div className="flex items-center gap-2">
                  <span>HOSTED SERVERS: <strong className="text-text-primary">{node.stats.totalServers}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span>ALLOCATED: <strong className="text-text-primary">{node.stats.allocatedPorts} / {node.stats.totalAllocations}</strong> Ports</span>
                  <button
                    onClick={() => setAllocationsNodeId(node.id)}
                    className="text-primary hover:underline font-semibold"
                  >
                    (Manage)
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
