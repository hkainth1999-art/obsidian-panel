'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import { Box, Save, CheckCircle2, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';

export default function ServerStartupPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();

  const { data: server, isLoading } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  const [selectedImage, setSelectedImage] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (server?.dockerImage) {
      setSelectedImage(server.dockerImage);
    }
  }, [server?.dockerImage]);

  const updateMutation = useMutation({
    mutationFn: (dockerImage: string) =>
      fetchApi(`/api/client/servers/${uuid}/startup`, {
        method: 'PATCH',
        body: JSON.stringify({ dockerImage }),
      }),
    onSuccess: () => {
      setFeedback({
        type: 'success',
        message: 'Docker container image updated and synchronized with Wings daemon successfully! Restart server to apply.',
      });
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: `Failed to update Docker image: ${err.message || 'Unknown error'}`,
      });
      setTimeout(() => setFeedback(null), 6000);
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-text-muted">Loading startup parameters...</div>;
  }

  // Pre-configured Java runtime images
  const eggImages = (server?.egg?.dockerImages && typeof server.egg.dockerImages === 'object'
    ? Object.entries(server.egg.dockerImages)
    : [
        ['Java 21 (Recommended for 1.20.5+ / 1.21+)', 'ghcr.io/pterodactyl/yolks:java_21'],
        ['Java 17 (Legacy 1.18 - 1.20.4)', 'ghcr.io/pterodactyl/yolks:java_17'],
        ['Java 11 (Legacy 1.16 - 1.17)', 'ghcr.io/pterodactyl/yolks:java_11'],
        ['Java 8 (Legacy 1.12.2 and older)', 'ghcr.io/pterodactyl/yolks:java_8'],
      ]) as [string, string][];

  const isCurrentJava17 = selectedImage.includes('java_17');

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-control text-xs flex items-center gap-2.5 border ${
            feedback.type === 'success'
              ? 'bg-status-running/10 border-status-running/30 text-status-running'
              : 'bg-status-stopping/10 border-status-stopping/30 text-status-stopping'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Java 21 Recommendation Warning Banner if on Java 17 */}
      {isCurrentJava17 && (
        <div className="p-4 rounded-card bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-amber-300">
                Java Version Mismatch Notice
              </h4>
              <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                Modern Minecraft servers (Paper, Purpur, Fabric 1.20.5+ and 1.21+) require <strong>Java 21</strong>.
                Running with Java 17 causes an <code className="text-amber-200 bg-amber-950/50 px-1 py-0.5 rounded">UnsupportedClassVersionError (class file 65.0)</code> crash on startup.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={updateMutation.isPending}
            onClick={() => {
              setSelectedImage('ghcr.io/pterodactyl/yolks:java_21');
              updateMutation.mutate('ghcr.io/pterodactyl/yolks:java_21');
            }}
            className="shrink-0 text-xs gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Switch to Java 21
          </Button>
        </div>
      )}

      {/* Startup Command Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Startup Command</CardTitle>
            <CardDescription>
              The entrypoint command invoked inside the container when the game starts.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="p-3 bg-surface-elevated border border-border rounded-control font-mono text-xs text-primary">
          {server?.startup}
        </div>
      </Card>

      {/* Docker Image Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle>Docker Container Image</CardTitle>
              <CardDescription>
                Select the runtime container environment executed on the Wings node.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={updateMutation.isPending || selectedImage === server?.dockerImage}
              onClick={() => updateMutation.mutate(selectedImage)}
              className="gap-1.5 text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              {updateMutation.isPending ? 'Saving...' : 'Save Image'}
            </Button>
          </div>
        </CardHeader>

        <div className="space-y-4">
          {/* Quick preset selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {eggImages.map(([label, img]) => (
              <button
                key={img}
                type="button"
                onClick={() => setSelectedImage(img)}
                className={`p-3 rounded-control text-left border transition-all text-xs flex flex-col justify-between ${
                  selectedImage === img
                    ? 'border-primary bg-primary/10 text-text-primary shadow-sm'
                    : 'border-border bg-surface-elevated/40 text-text-secondary hover:border-border-focus hover:bg-surface-elevated'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-primary" /> {label}
                  </span>
                  {selectedImage === img && (
                    <Badge variant="success" className="text-[10px] py-0 px-1.5">Selected</Badge>
                  )}
                </div>
                <code className="text-[10px] font-mono text-text-muted mt-2 truncate">
                  {img}
                </code>
              </button>
            ))}
          </div>

          {/* Custom image tag input */}
          <div className="pt-2 border-t border-border/60">
            <label className="text-[11px] text-text-muted font-medium block mb-1.5">
              Custom Docker Image
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedImage}
                onChange={(e) => setSelectedImage(e.target.value.trim())}
                placeholder="ghcr.io/pterodactyl/yolks:java_21"
                className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-control font-mono text-xs text-text-primary focus:outline-none focus:border-primary"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={updateMutation.isPending || selectedImage === server?.dockerImage}
                onClick={() => updateMutation.mutate(selectedImage)}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Egg Environment Variables */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>
              Configuration parameters provided by the game egg.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {server?.variables?.map((v: any) => {
            const isVersionVar = ['MINECRAFT_VERSION', 'MC_VERSION', 'VANILLA_VERSION'].includes(v.variable.envVariable);
            return (
              <div
                key={v.id}
                className={`p-3 rounded-control space-y-1.5 border ${
                  isVersionVar
                    ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20'
                    : 'bg-surface-elevated border border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    {v.variable.name}
                    {isVersionVar && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-status-running/20 text-status-running border border-status-running/30">
                        Installed
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {v.variable.envVariable}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
                  {isVersionVar
                    ? 'Active installed version on server container (managed in Versions tab).'
                    : v.variable.description || 'No description provided.'}
                </p>
                <input
                  type="text"
                  readOnly
                  value={v.variableValue}
                  className={`w-full px-2.5 py-1.5 rounded text-xs font-mono focus:outline-none ${
                    isVersionVar
                      ? 'bg-surface border border-primary/40 text-primary font-bold'
                      : 'bg-surface border border-border text-text-primary'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
