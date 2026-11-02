'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Unlock,
  Activity,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Globe,
  Radio,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';

export default function AdminSecurityPage() {
  const queryClient = useQueryClient();

  const [banIpInput, setBanIpInput] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [highlightBanned, setHighlightBanned] = useState(false);

  const scrollToBanned = () => {
    const el = document.getElementById('banned-ips-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightBanned(true);
      setTimeout(() => setHighlightBanned(false), 3000);
    }
  };

  // Queries
  const { data: stats } = useQuery<any>({
    queryKey: ['admin-security-stats'],
    queryFn: () => fetchApi('/api/admin/security/stats'),
    refetchInterval: 5000,
  });

  const { data: bannedIps, isLoading: isBannedLoading } = useQuery<any[]>({
    queryKey: ['admin-banned-ips'],
    queryFn: () => fetchApi('/api/admin/security/banned-ips'),
  });

  const { data: requestLogs, isLoading: isLogsLoading } = useQuery<any[]>({
    queryKey: ['admin-security-requests'],
    queryFn: () => fetchApi('/api/admin/security/requests'),
    refetchInterval: 4000,
  });

  // Ban Mutation
  const banMutation = useMutation({
    mutationFn: (data: { ip: string; reason?: string }) =>
      fetchApi('/api/admin/security/ban-ip', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data: any) => {
      setBanIpInput('');
      setBanReasonInput('');
      queryClient.invalidateQueries({ queryKey: ['admin-banned-ips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-security-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-security-stats'] });
      alert(`IP address ${data.ip} has been permanently banned.`);
    },
    onError: (err: any) => {
      alert(`Failed to ban IP: ${err.message}`);
    },
  });

  // Unban Mutation
  const unbanMutation = useMutation({
    mutationFn: (ip: string) =>
      fetchApi(`/api/admin/security/ban-ip/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-banned-ips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-security-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-security-stats'] });
      alert(`IP address ${data.ip} has been unbanned.`);
    },
    onError: (err: any) => {
      alert(`Failed to unban IP: ${err.message}`);
    },
  });

  const handleManualBan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!banIpInput.trim()) return;
    banMutation.mutate({
      ip: banIpInput.trim(),
      reason: banReasonInput.trim() || 'Manual ban by administrator',
    });
  };

  const handleQuickBan = (ip: string) => {
    if (confirm(`Are you sure you want to ban ${ip} from accessing this panel? All further requests will be blocked with 403 Forbidden.`)) {
      banMutation.mutate({
        ip,
        reason: 'Flagged & banned from live traffic monitor (DDoS/Brute Force)',
      });
    }
  };

  // Filter requests
  const filteredLogs = (requestLogs || []).filter((r: any) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.ip?.toLowerCase().includes(q) ||
      r.path?.toLowerCase().includes(q) ||
      r.userAgent?.toLowerCase().includes(q);

    const matchesMethod = methodFilter === 'all' || r.method?.toUpperCase() === methodFilter;

    return matchesSearch && matchesMethod;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Firewall, DDoS &amp; IP Access Control
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Monitor real-time incoming traffic, enforce brute-force mitigation (5 attempts/min), and manage banned IPs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-control bg-surface border border-border text-xs font-mono font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            DDoS Mitigation Active
          </span>
        </div>
      </div>

      {/* Security Telemetry Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div
          onClick={scrollToBanned}
          role="button"
          tabIndex={0}
          title="Click to view all banned IP addresses"
          className="p-3.5 bg-surface border border-border hover:border-rose-500/60 hover:bg-rose-950/20 rounded-card space-y-1 cursor-pointer transition-all duration-200 group"
        >
          <span className="text-[10px] uppercase font-bold text-text-muted group-hover:text-rose-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-rose-400" /> Banned IP Addresses
            </span>
            <span className="text-[10px] font-sans text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">View &darr;</span>
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-rose-400">
              {stats?.bannedIpsCount ?? (bannedIps || []).length}
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-400 group-hover:bg-rose-500/20">
              Blocked &bull; Click to View
            </Badge>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-card space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" /> Traffic (Past Minute)
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-text-primary">
              {stats?.requestsInLastMinute ?? 0} reqs
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {stats?.activeIpsInLastMinute ?? 0} active IPs
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-card space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Brute Force Shield
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-amber-400">
              5 req/min
            </span>
            <span className="text-[10px] text-text-muted">Strict Auth Limit</span>
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-card space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> DDoS Rate Cap
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-emerald-400">
              120 req/min
            </span>
            <span className="text-[10px] text-text-muted">Global Threshold</span>
          </div>
        </div>
      </div>

      {/* Manual Ban IP Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <div>
              <CardTitle>Ban Malicious IP Address</CardTitle>
              <CardDescription>
                Blacklist any IP address or range. The firewall terminates requests immediately with 403 Forbidden.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleManualBan} className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">
                Target IP Address *
              </label>
              <input
                type="text"
                required
                value={banIpInput}
                onChange={(e) => setBanIpInput(e.target.value)}
                placeholder="e.g. 192.168.1.100 or 45.33.32.1"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control font-mono text-xs text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">
                Ban Reason / Audit Note
              </label>
              <input
                type="text"
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                placeholder="e.g. Persistent DDoS request flood, credential stuffing"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="danger"
                size="md"
                type="submit"
                disabled={banMutation.isPending || !banIpInput.trim()}
                className="w-full sm:w-auto"
              >
                <Ban className="w-4 h-4 mr-1.5" />
                {banMutation.isPending ? 'Banning...' : 'Ban IP Address'}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Banned IPs List */}
      <div
        id="banned-ips-section"
        className={`bg-surface border rounded-card overflow-hidden transition-all duration-500 ${
          highlightBanned
            ? 'border-rose-500 ring-2 ring-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.35)]'
            : 'border-border'
        }`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-text-primary">
              Currently Banned IP Addresses ({(bannedIps || []).length})
            </h3>
          </div>
          <span className="text-[11px] text-text-muted">
            All listed IPs are dropped by firewall hooks before hitting application logic
          </span>
        </div>

        {isBannedLoading ? (
          <div className="p-6 text-center text-xs text-text-muted">Loading blacklist...</div>
        ) : (bannedIps || []).length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">
            No IP addresses are currently banned. Use the form above or the quick ban buttons in the traffic log below.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">IP Address</th>
                <th className="px-5 py-3">Ban Reason</th>
                <th className="px-5 py-3">Date Banned</th>
                <th className="px-5 py-3">Banned By</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {bannedIps?.map((entry: any) => (
                <tr key={entry.ip} className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="px-5 py-3 font-mono font-bold text-rose-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    {entry.ip}
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{entry.reason}</td>
                  <td className="px-5 py-3 font-mono text-[11px] text-text-muted">
                    {new Date(entry.bannedAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-text-muted">{entry.bannedBy || 'admin'}</td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={unbanMutation.isPending}
                      onClick={() => unbanMutation.mutate(entry.ip)}
                    >
                      <Unlock className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Unban
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Live Request Activity Stream (Live Traffic Monitor) */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-text-primary">
                Live Traffic &amp; Request Activity Monitor
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/30">
                Auto-Refreshing (4s)
              </Badge>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">
              Real-time inspection of incoming panel requests. Click &quot;Ban IP&quot; next to any suspicious request to instantly neutralize it.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by IP, Path..."
                className="pl-8 pr-2.5 py-1 bg-surface-elevated border border-border rounded-control text-xs font-mono text-text-primary focus:outline-none focus:border-primary w-44"
              />
            </div>

            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-2 py-1 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
            >
              <option value="all">ALL</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>

        {isLogsLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading live traffic monitor...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">
            No request activity captured yet. Requests are ingested as users, Wings nodes, and visitors connect.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Client IP</th>
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5">Path</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">User Agent</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {filteredLogs.map((req: any) => (
                  <tr
                    key={req.id}
                    className={`hover:bg-surface-elevated/30 transition-colors ${
                      req.isBanned ? 'bg-rose-500/5' : req.status === 429 ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap text-[10px]">
                      {new Date(req.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 font-bold text-text-primary whitespace-nowrap">
                      {req.ip}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          req.method === 'GET'
                            ? 'bg-blue-500/10 text-blue-400'
                            : req.method === 'POST'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : req.method === 'DELETE'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {req.method}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-text-secondary max-w-xs truncate" title={req.path}>
                      {req.path}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status >= 200 && req.status < 300
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : req.status === 403 || req.status === 401
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : req.status === 429
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-text-muted text-[10px] max-w-xs truncate" title={req.userAgent}>
                      {req.userAgent || 'Unknown'}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {req.isBanned ? (
                        <span className="text-[10px] text-rose-400 font-bold px-2 py-0.5 bg-rose-500/10 rounded border border-rose-500/20">
                          Banned
                        </span>
                      ) : (
                        <button
                          onClick={() => handleQuickBan(req.ip)}
                          className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-medium transition-colors"
                        >
                          Ban IP
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

