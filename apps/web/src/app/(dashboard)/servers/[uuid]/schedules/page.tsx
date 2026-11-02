'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { Calendar, Plus, Trash2, Clock, CheckCircle2, Play, AlertCircle } from 'lucide-react';
import { Badge } from '../../../../../components/ui/badge';

interface ScheduleTask {
  id: number;
  sequenceId: number;
  action: string;
  payload: string;
  timeOffset: number;
}

interface ServerSchedule {
  id: number;
  name: string;
  cronMinute: string;
  cronHour: string;
  cronDayOfMonth: string;
  cronMonth: string;
  cronDayOfWeek: string;
  isActive: boolean;
  isProcessing: boolean;
  onlyWhenOnline: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  tasks: ScheduleTask[];
}

export default function ServerSchedulesPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [cronMinute, setCronMinute] = useState('0');
  const [cronHour, setCronHour] = useState('0');
  const [cronDayOfMonth, setCronDayOfMonth] = useState('*');
  const [cronMonth, setCronMonth] = useState('*');
  const [cronDayOfWeek, setCronDayOfWeek] = useState('*');
  const [onlyWhenOnline, setOnlyWhenOnline] = useState(true);

  const { data: schedules, isLoading } = useQuery<ServerSchedule[]>({
    queryKey: ['server-schedules', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}/schedules`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/client/servers/${uuid}/schedules`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          cronMinute,
          cronHour,
          cronDayOfMonth,
          cronMonth,
          cronDayOfWeek,
          onlyWhenOnline,
        }),
      }),
    onSuccess: () => {
      setIsCreating(false);
      setName('');
      queryClient.invalidateQueries({ queryKey: ['server-schedules', uuid] });
    },
    onError: (err: any) => {
      alert(`Failed to create schedule: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (scheduleId: number) =>
      fetchApi(`/api/client/servers/${uuid}/schedules/${scheduleId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-schedules', uuid] });
    },
    onError: (err: any) => {
      alert(`Failed to delete schedule: ${err.message}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Schedules & Cron Tasks
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Automate recurring server tasks such as restart schedules, backup creation, or custom console commands.
          </p>
        </div>

        <Button size="sm" onClick={() => setIsCreating(!isCreating)}>
          <Plus className="w-4 h-4 mr-1.5" /> Create Schedule
        </Button>
      </div>

      {/* Create Schedule Form */}
      {isCreating && (
        <Card className="border-primary/40 bg-surface">
          <CardHeader>
            <CardTitle>Create New Schedule</CardTitle>
            <CardDescription>
              Define the schedule name and standard 5-part cron timing (Minute, Hour, Day of Month, Month, Day of Week).
            </CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 space-y-4">
            <div>
              <label className="text-xs font-medium text-text-primary mb-1.5 block">
                Schedule Name
              </label>
              <Input
                placeholder="e.g. Daily Restart at Midnight"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-mono text-text-muted mb-1 block">Minute</label>
                <Input value={cronMinute} onChange={(e) => setCronMinute(e.target.value)} placeholder="*" />
              </div>
              <div>
                <label className="text-[11px] font-mono text-text-muted mb-1 block">Hour</label>
                <Input value={cronHour} onChange={(e) => setCronHour(e.target.value)} placeholder="*" />
              </div>
              <div>
                <label className="text-[11px] font-mono text-text-muted mb-1 block">Day of Month</label>
                <Input value={cronDayOfMonth} onChange={(e) => setCronDayOfMonth(e.target.value)} placeholder="*" />
              </div>
              <div>
                <label className="text-[11px] font-mono text-text-muted mb-1 block">Month</label>
                <Input value={cronMonth} onChange={(e) => setCronMonth(e.target.value)} placeholder="*" />
              </div>
              <div>
                <label className="text-[11px] font-mono text-text-muted mb-1 block">Day of Week</label>
                <Input value={cronDayOfWeek} onChange={(e) => setCronDayOfWeek(e.target.value)} placeholder="*" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="onlyOnline"
                checked={onlyWhenOnline}
                onChange={(e) => setOnlyWhenOnline(e.target.checked)}
                className="rounded border-border bg-surface-elevated text-primary focus:ring-primary"
              />
              <label htmlFor="onlyOnline" className="text-xs text-text-primary select-none cursor-pointer">
                Only execute tasks when the server is actively running
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Saving...' : 'Create Schedule'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Schedule Listing */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-text-muted">Loading schedules...</div>
      ) : !schedules || schedules.length === 0 ? (
        <Card className="p-12 text-center bg-surface border-border">
          <Calendar className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary">No schedules configured</p>
          <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
            You do not have any scheduled tasks setup for this server. Click &quot;Create Schedule&quot; to set up cron jobs.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="p-4 bg-surface border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-primary/10 text-primary">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-text-primary">
                        {schedule.name}
                      </h4>
                      <Badge variant={schedule.isActive ? 'success' : 'default'}>
                        {schedule.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-text-muted mt-0.5">
                      Cron: {schedule.cronMinute} {schedule.cronHour} {schedule.cronDayOfMonth} {schedule.cronMonth} {schedule.cronDayOfWeek}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (confirm(`Delete schedule "${schedule.name}"?`)) {
                        deleteMutation.mutate(schedule.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
