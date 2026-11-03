'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '../../components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard view error caught by boundary:', error);
  }, [error]);

  return (
    <div className="p-8 flex items-center justify-center min-h-[50vh]">
      <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-status-error/10 border border-status-error/30 text-status-error flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-text-primary">Unable to load this section</h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            {error?.message || 'An unexpected error occurred while fetching or rendering data.'}
          </p>
          {error?.digest && (
            <p className="text-[10px] font-mono text-text-muted/60 mt-1">
              Error Digest: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="secondary" size="sm" onClick={() => reset()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
          </Button>
          <Link href="/servers">
            <Button variant="primary" size="sm">
              <Home className="w-3.5 h-3.5 mr-1.5" /> Back to Servers
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

