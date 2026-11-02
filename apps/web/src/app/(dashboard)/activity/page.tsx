'use client';

import React from 'react';
import { Activity, Shield, Terminal, HardDrive, Key } from 'lucide-react';
import { Card } from '../../../components/ui/card';

export default function ActivityPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Account & Audit Activity
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          Chronological record of security events, server power states, and API mutations
        </p>
      </div>

      <div className="border border-border/80 border-dashed rounded-card p-12 text-center bg-surface/30">
        <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted mx-auto mb-3">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary">No activity recorded yet</h3>
        <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
          Recent authentication events, console commands, and file operations will be logged here.
        </p>
      </div>
    </div>
  );
}
