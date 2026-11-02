'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import { useAuth } from '../../../contexts/auth-context';
import {
  Server as ServerIcon,
  LayoutGrid,
  List,
  Plus,
  Cpu,
  HardDrive,
  Activity,
  Folder,
  Radio,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { formatMemory } from '../../../lib/utils';

interface ServerSummary {
  id: number;
  uuid: string;
  uuidShort: string;
  name: string;
  description: string;
  status: string | null;
  node: string;
  allocation: string;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads: string | null;
  };
  isOwner: boolean;
  permissions: string[];
}

export default function ServersPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [showAllServers, setShowAllServers] = useState(false);

  const { data: servers, isLoading, error } = useQuery<ServerSummary[]>({
    queryKey: ['client-servers', showAllServers],
    queryFn: () => fetchApi(`/api/client/servers${showAllServers ? '?all=true' : ''}`),
    refetchInterval: 10000,
  });

  const filteredServers = (servers || []).filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.uuidShort.toLowerCase().includes(search.toLowerCase()) ||
      s.allocation.includes(search),
  );

  const getStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'online':
        return <Badge variant="success">ONLINE</Badge>;
      case 'starting':
        return <Badge variant="warning" className="border-amber-500/30 text-amber-400 bg-amber-500/10">STARTING</Badge>;
      case 'stopping':
        return <Badge variant="warning" className="border-amber-500/30 text-amber-400 bg-amber-500/10">STOPPING</Badge>;
      case 'installing':
        return <Badge variant="warning">INSTALLING</Badge>;
      case 'install_failed':
        return <Badge variant="error">INSTALL FAILED</Badge>;
      case 'suspended':
        return <Badge variant="error">SUSPENDED</Badge>;
      case 'offline':
      default:
        return <Badge variant="default" className="text-text-muted">OFFLINE</Badge>;
    }
  };

  const getServerCardStyle = (status: string | null) => {
    const s = status?.toLowerCase();
    if (s === 'running' || s === 'online') {
      return 'border-emerald-500/40 bg-surface/90 shadow-[inset_0_0_24px_rgba(34,197,94,0.18)] hover:border-emerald-500/70 hover:shadow-[inset_0_0_32px_rgba(34,197,94,0.28)]';
    }
    if (s === 'starting' || s === 'installing' || s === 'stopping') {
      return 'border-amber-500/40 bg-surface/90 shadow-[inset_0_0_24px_rgba(234,179,8,0.18)] hover:border-amber-500/70 hover:shadow-[inset_0_0_32px_rgba(234,179,8,0.28)]';
    }
    // Offline / black card
    return 'border-border/80 bg-[#090b0e] shadow-none hover:border-border-focus hover:bg-[#0d1014]';
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Servers
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage your deployed game instances and real-time operations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Admin Toggle: Show All Servers vs My Servers */}
          {user?.isAdmin && (
            <button
              onClick={() => setShowAllServers(!showAllServers)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium border transition-all ${
                showAllServers
                  ? 'bg-primary/20 border-primary text-primary shadow-sm'
                  : 'bg-surface border-border text-text-muted hover:text-text-primary'
              }`}
              title="Admin server view filter"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{showAllServers ? 'Showing: All Servers' : 'Showing: My Servers'}</span>
            </button>
          )}

          {/* Grid / List View Toggle */}
          <div className="flex items-center bg-surface border border-border rounded-control p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-surface-elevated text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'list'
                  ? 'bg-surface-elevated text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 bg-surface/50 border border-border rounded-card animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Zero State: "No servers yet" */}
      {!isLoading && filteredServers.length === 0 && (
        <div className="border border-border/80 border-dashed rounded-card p-12 text-center bg-surface/30">
          <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted mx-auto mb-4">
            <ServerIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">
            No servers yet
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-2">
            There are currently no game servers provisioned to your account.
          </p>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Please contact an administrator or support to deploy a server or assign you subuser permissions.
          </p>
        </div>
      )}

      {/* Grid View */}
      {!isLoading && viewMode === 'grid' && filteredServers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServers.map((server) => (
            <Link
              key={server.uuid}
              href={`/servers/${server.uuid}`}
              className="group block"
            >
              <Card className={`transition-all duration-300 ${getServerCardStyle(server.status)}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                      {server.name}
                    </h4>
                    <p className="text-[11px] font-mono text-text-muted mt-0.5">
                      {server.allocation} &bull; {server.node}
                    </p>
                  </div>
                  {getStatusBadge(server.status)}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/60">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-primary" /> CPU Limit
                    </span>
                    <span className="text-xs font-mono font-medium text-text-secondary mt-1">
                      {server.limits.cpu > 0 ? `${server.limits.cpu}%` : 'Unlimited'}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <Activity className="w-3 h-3 text-status-running" /> Memory
                    </span>
                    <span className="text-xs font-mono font-medium text-text-secondary mt-1">
                      {server.limits.memory > 0 ? formatMemory(server.limits.memory) : 'Unlimited'}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-status-stopping" /> Disk
                    </span>
                    <span className="text-xs font-mono font-medium text-text-secondary mt-1">
                      {server.limits.disk > 0 ? formatMemory(server.limits.disk) : 'Unlimited'}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* List View */}
      {!isLoading && viewMode === 'list' && filteredServers.length > 0 && (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/50 border-b border-border text-text-muted uppercase text-[10px] font-medium tracking-wider">
              <tr>
                <th className="px-5 py-3">Server Name</th>
                <th className="px-5 py-3">Node & Address</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">CPU</th>
                <th className="px-5 py-3">Memory</th>
                <th className="px-5 py-3">Disk</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {filteredServers.map((server) => (
                <tr
                  key={server.uuid}
                  className="hover:bg-surface-elevated/30 transition-colors"
                >
                  <td className="px-5 py-3.5 font-sans font-medium text-text-primary">
                    <Link
                      href={`/servers/${server.uuid}`}
                      className="hover:text-primary transition-colors"
                    >
                      {server.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {server.node} &bull; {server.allocation}
                  </td>
                  <td className="px-5 py-3.5">
                    {getStatusBadge(server.status)}
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {server.limits.cpu > 0 ? `${server.limits.cpu}%` : 'Unlimited'}
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {server.limits.memory > 0 ? formatMemory(server.limits.memory) : 'Unlimited'}
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {server.limits.disk > 0 ? formatMemory(server.limits.disk) : 'Unlimited'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/servers/${server.uuid}`}>
                      <Button variant="ghost" size="sm">
                        Console <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
