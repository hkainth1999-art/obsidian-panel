'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import {
  Activity,
  Shield,
  Terminal,
  Power,
  Server,
  Key,
  User,
  Archive,
  RefreshCw,
  Search,
  Clock,
  Globe,
  Database,
  Cpu,
} from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { formatDate } from '../../../lib/utils';

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const perPage = 25;

  const { data, isLoading, isFetching, refetch } = useQuery<{
    data: any[];
    meta: {
      total: number;
      page: number;
      perPage: number;
      totalPages: number;
    };
  }>({
    queryKey: ['account-activity', page, search],
    queryFn: () =>
      fetchApi(
        `/api/account/activity?page=${page}&perPage=${perPage}${
          search ? `&search=${encodeURIComponent(search)}` : ''
        }`,
      ),
  });

  const logs = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, perPage: 25, totalPages: 1 };

  const getEventIcon = (event: string) => {
    if (event.startsWith('auth:')) return Shield;
    if (event.startsWith('server:power.')) return Power;
    if (event.startsWith('server:console.')) return Terminal;
    if (event.startsWith('server:backup.') || event.startsWith('backup:')) return Archive;
    if (event.startsWith('server:version.')) return Cpu;
    if (event.startsWith('account:apikey.')) return Key;
    if (event.startsWith('account:')) return User;
    return Activity;
  };

  const getEventBadgeColor = (event: string) => {
    if (event.includes('fail') || event.includes('error') || event.includes('kill'))
      return 'border-rose-500/30 text-rose-400 bg-rose-500/10';
    if (event.includes('success') || event.includes('start') || event.includes('completed'))
      return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    if (event.includes('stop') || event.includes('restart') || event.includes('delete') || event.includes('revoked'))
      return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
    return 'border-primary/30 text-primary bg-primary/10';
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Account &amp; Audit Activity
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Chronological record of authentication, server operations, console actions, and security events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search / Filter Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Filter activity by keyword, action (e.g. login, power, backup), or IP..."
          className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary font-mono"
        />
      </div>

      {/* Activity Logs Stream */}
      {isLoading ? (
        <Card className="p-12 text-center text-text-muted text-xs border border-border">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary opacity-60" />
          Loading activity events...
        </Card>
      ) : logs.length === 0 ? (
        <div className="border border-border/80 border-dashed rounded-card p-12 text-center bg-surface/30">
          <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted mx-auto mb-3">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">
            {search ? 'No matching activity records found' : 'No activity recorded yet'}
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
            {search
              ? 'Try modifying your filter query to search for other events.'
              : 'Recent authentication events, console commands, power signals, and backups will be logged here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {logs.map((log) => {
            const IconComponent = getEventIcon(log.event);
            const badgeClasses = getEventBadgeColor(log.event);

            return (
              <div
                key={log.id}
                className="p-3.5 bg-surface border border-border rounded-control hover:border-border/80 hover:bg-surface-elevated/40 transition-colors flex items-start justify-between gap-4 text-xs"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <IconComponent className="w-4 h-4 text-primary" />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text-primary text-xs">
                        {log.description}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${badgeClasses}`}
                      >
                        {log.event}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-text-muted flex-wrap">
                      {log.server && (
                        <span className="flex items-center gap-1 font-mono text-text-secondary">
                          <Server className="w-3 h-3 text-text-muted" />
                          {log.server.name}
                        </span>
                      )}

                      {log.user && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-text-muted" />
                          {log.user.username}
                        </span>
                      )}

                      {log.ip && (
                        <span className="flex items-center gap-1 font-mono">
                          <Globe className="w-3 h-3 text-text-muted" />
                          {log.ip}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono text-[11px] text-text-muted whitespace-nowrap">
                  <div className="flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3 text-text-muted" />
                    <span>{formatDate(log.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border text-xs">
              <span className="text-text-muted">
                Showing page <strong className="text-text-primary">{meta.page}</strong> of{' '}
                <strong className="text-text-primary">{meta.totalPages}</strong> ({meta.total} total events)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
