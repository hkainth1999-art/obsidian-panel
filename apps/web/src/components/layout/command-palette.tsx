'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Server,
  HardDrive,
  MapPin,
  Layers,
  Settings,
  Users,
  X,
  User as UserIcon,
  Shield,
  Key,
  Activity,
  LayoutDashboard,
  Network,
} from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const userLinks = [
    { title: 'Servers List', path: '/servers', icon: Server, category: 'Servers' },
    { title: 'Account Settings', path: '/account', icon: UserIcon, category: 'Account' },
    { title: 'Security & 2FA', path: '/security', icon: Shield, category: 'Account' },
    { title: 'API Keys', path: '/api-keys', icon: Key, category: 'Account' },
    { title: 'Activity Logs', path: '/activity', icon: Activity, category: 'Account' },
  ];

  const adminLinks = [
    { title: 'Admin Overview', path: '/admin', icon: LayoutDashboard, category: 'Admin' },
    { title: 'All Servers (Admin)', path: '/admin/servers', icon: Server, category: 'Admin' },
    { title: 'Nodes Management', path: '/admin/nodes', icon: HardDrive, category: 'Admin' },
    { title: 'Locations', path: '/admin/locations', icon: MapPin, category: 'Admin' },
    { title: 'Allocations', path: '/admin/allocations', icon: Network, category: 'Admin' },
    { title: 'Nests & Eggs', path: '/admin/nests', icon: Layers, category: 'Admin' },
    { title: 'User Accounts', path: '/admin/users', icon: Users, category: 'Admin' },
    { title: 'System Settings', path: '/admin/settings', icon: Settings, category: 'Admin' },
  ];

  const quickLinks = user?.isAdmin
    ? [...userLinks, ...adminLinks]
    : userLinks;

  const filtered = quickLinks.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/75 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="p-3 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Type a command or jump to page..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">
              No matching pages or commands found
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleSelect(item.path)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-control text-xs text-left text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-text-muted" />
                      <span>{item.title}</span>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono uppercase">
                      {item.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
