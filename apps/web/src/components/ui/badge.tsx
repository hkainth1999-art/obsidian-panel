import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-surface-elevated text-text-secondary border-border',
    success: 'bg-status-running/15 text-status-running border-status-running/30',
    warning: 'bg-status-stopping/15 text-status-stopping border-status-stopping/30',
    error: 'bg-status-error/15 text-status-error border-status-error/30',
    info: 'bg-primary/15 text-primary border-primary/30',
    outline: 'border-border text-text-muted',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border font-mono tracking-tight',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
