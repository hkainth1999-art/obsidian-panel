'use client';

import React from 'react';
import { useAuth } from '../../../contexts/auth-context';
import { User, Mail, Shield, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';

export default function AccountPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Account Profile
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          View your personal details, language preferences, and roles
        </p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>
              Basic identity information tied to your Obsidian session.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-4 pt-2 text-xs">
          <div className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-control">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-text-muted" />
              <span className="text-text-secondary">Username</span>
            </div>
            <span className="font-semibold text-text-primary font-mono">
              {user?.username}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-control">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-text-muted" />
              <span className="text-text-secondary">Email Address</span>
            </div>
            <span className="font-mono text-text-primary">
              {user?.email}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-control">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-text-muted" />
              <span className="text-text-secondary">Role</span>
            </div>
            <Badge variant={user?.isAdmin ? 'info' : 'default'}>
              {user?.isAdmin ? 'ADMINISTRATOR' : 'CUSTOMER'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-control">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-text-muted" />
              <span className="text-text-secondary">Language</span>
            </div>
            <span className="font-mono text-text-primary uppercase">
              {user?.language || 'en'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
