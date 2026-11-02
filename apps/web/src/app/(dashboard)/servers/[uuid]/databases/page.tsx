'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { Database, Plus, Trash2, Key, Copy, Check, Server, Eye, EyeOff } from 'lucide-react';

interface ServerDatabase {
  id: number;
  database: string;
  username: string;
  password?: string;
  remoteHost: string;
  maxConnections?: number;
  host: {
    name: string;
    address: string;
    port: number;
  };
  relationships?: {
    password?: {
      attributes?: {
        password?: string;
      };
    };
  };
}

export default function ServerDatabasesPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [dbName, setDbName] = useState('');
  const [remoteHost, setRemoteHost] = useState('%');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{
    data: ServerDatabase[];
    meta: { current: number; limit: number };
  }>({
    queryKey: ['server-databases', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}/databases`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/client/servers/${uuid}/databases`, {
        method: 'POST',
        body: JSON.stringify({ database: dbName, remote: remoteHost }),
      }),
    onSuccess: () => {
      setIsCreating(false);
      setDbName('');
      queryClient.invalidateQueries({ queryKey: ['server-databases', uuid] });
    },
    onError: (err: any) => {
      alert(`Failed to create database: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (databaseId: number) =>
      fetchApi(`/api/client/servers/${uuid}/databases/${databaseId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-databases', uuid] });
    },
    onError: (err: any) => {
      alert(`Failed to delete database: ${err.message}`);
    },
  });

  const rotatePasswordMutation = useMutation({
    mutationFn: (databaseId: number) =>
      fetchApi(`/api/client/servers/${uuid}/databases/${databaseId}/rotate-password`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-databases', uuid] });
    },
    onError: (err: any) => {
      alert(`Failed to rotate password: ${err.message}`);
    },
  });

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const databases = data?.data || [];
  const limit = data?.meta?.limit ?? 0;
  const current = data?.meta?.current ?? databases.length;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" /> Databases
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Manage MySQL/MariaDB database instances for your server plugins and software.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {limit > 0 && (
            <span className="text-xs font-mono text-text-muted">
              {current} of {limit} used
            </span>
          )}
          <Button
            size="sm"
            onClick={() => setIsCreating(!isCreating)}
            disabled={limit > 0 && current >= limit}
          >
            <Plus className="w-4 h-4 mr-1.5" /> New Database
          </Button>
        </div>
      </div>

      {/* Create Database Form */}
      {isCreating && (
        <Card className="border-primary/40 bg-surface">
          <CardHeader>
            <CardTitle>Create New Database</CardTitle>
            <CardDescription>
              Assign a new database to this server container. A unique user and password will be automatically generated.
            </CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-text-primary mb-1.5 block">
                  Database Name
                </label>
                <Input
                  placeholder="e.g. luckperms"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-primary mb-1.5 block">
                  Allowed Connections (Remote Host)
                </label>
                <Input
                  placeholder="%"
                  value={remoteHost}
                  onChange={(e) => setRemoteHost(e.target.value)}
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Use % to allow connections from any host/container.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!dbName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Database'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Database Listing */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-text-muted">Loading databases...</div>
      ) : databases.length === 0 ? (
        <Card className="p-12 text-center bg-surface border-border">
          <Database className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary">No databases created</p>
          <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
            Your server does not currently have any associated databases. Click &quot;New Database&quot; to provision one.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {databases.map((db) => {
            const password =
              db.password || db.relationships?.password?.attributes?.password || '';
            const isPasswordVisible = Boolean(visiblePasswords[db.id]);

            return (
              <Card key={db.id} className="p-4 bg-surface border-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-primary/10 text-primary">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary font-mono">
                        {db.database}
                      </h4>
                      <p className="text-xs text-text-muted font-mono flex items-center gap-1.5 mt-0.5">
                        <Server className="w-3 h-3" /> {db.host.address}:{db.host.port}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      title="Rotate Password"
                      disabled={rotatePasswordMutation.isPending}
                      onClick={() => {
                        if (confirm('Rotate password for this database?')) {
                          rotatePasswordMutation.mutate(db.id);
                        }
                      }}
                    >
                      <Key className="w-3.5 h-3.5 mr-1.5" /> Rotate Password
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`Delete database "${db.database}"? All data will be lost!`)) {
                          deleteMutation.mutate(db.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Connection Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/50 text-xs font-mono">
                  <div className="p-2.5 rounded bg-surface-elevated border border-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">Username</span>
                      <span className="text-text-primary">{db.username}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(db.username, `user-${db.id}`)}
                      className="text-text-muted hover:text-text-primary p-1"
                      title="Copy Username"
                    >
                      {copiedField === `user-${db.id}` ? (
                        <Check className="w-3.5 h-3.5 text-status-running" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="p-2.5 rounded bg-surface-elevated border border-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">Password</span>
                      <span className="text-text-primary">
                        {isPasswordVisible ? password : '••••••••••••••••'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setVisiblePasswords((prev) => ({
                            ...prev,
                            [db.id]: !prev[db.id],
                          }))
                        }
                        className="text-text-muted hover:text-text-primary p-1"
                        title={isPasswordVisible ? 'Hide Password' : 'Show Password'}
                      >
                        {isPasswordVisible ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(password, `pass-${db.id}`)}
                        className="text-text-muted hover:text-text-primary p-1"
                        title="Copy Password"
                      >
                        {copiedField === `pass-${db.id}` ? (
                          <Check className="w-3.5 h-3.5 text-status-running" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-surface-elevated border border-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">Endpoint</span>
                      <span className="text-text-primary">
                        {db.host.address}:{db.host.port}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        copyToClipboard(`${db.host.address}:${db.host.port}`, `host-${db.id}`)
                      }
                      className="text-text-muted hover:text-text-primary p-1"
                      title="Copy Endpoint"
                    >
                      {copiedField === `host-${db.id}` ? (
                        <Check className="w-3.5 h-3.5 text-status-running" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
