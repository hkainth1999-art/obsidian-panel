'use client';

import React from 'react';
import { Search, Command, Bell } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  children,
}: HeaderProps) {
  return (
    <header className="h-16 px-8 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      <div>
        {title && (
          <h2 className="text-base font-semibold text-text-primary tracking-tight">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">


        {children}
      </div>
    </header>
  );
}
