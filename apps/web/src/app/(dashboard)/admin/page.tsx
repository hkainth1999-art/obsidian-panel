'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import {
  Server,
  HardDrive,
  MapPin,
  Layers,
  Users,
  CheckCircle2,
  Circle,
  ArrowRight,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

export default function AdminOverviewPage() {
  const { data: nodes } = useQuery<any[]>({
    queryKey: ['admin-nodes'],
    queryFn: () => fetchApi('/api/admin/nodes'),
  });

  const { data: locations } = useQuery<any[]>({
    queryKey: ['admin-locations'],
    queryFn: () => fetchApi('/api/admin/locations'),
  });

  const { data: nests } = useQuery<any[]>({
    queryKey: ['admin-nests'],
    queryFn: () => fetchApi('/api/admin/nests'),
  });

  const { data: eggs } = useQuery<any[]>({
    queryKey: ['admin-eggs'],
    queryFn: () => fetchApi('/api/admin/eggs'),
  });

  const { data: users } = useQuery<any>({
    queryKey: ['admin-users'],
    queryFn: () => fetchApi('/api/admin/users?perPage=1'),
  });

  const hasLocations = (locations?.length || 0) > 0;
  const hasNodes = (nodes?.length || 0) > 0;
  const hasEggs = (eggs?.length || 0) > 0;

  const checklistItems = [
    {
      title: '1. Create a Location',
      description: 'Group your game nodes by datacenter or geographic region.',
      completed: hasLocations,
      href: '/admin/locations',
    },
    {
      title: '2. Register a Node',
      description: 'Connect a hosting machine running official unmodified Pterodactyl Wings.',
      completed: hasNodes,
      href: '/admin/nodes',
    },
    {
      title: '3. Configure Wings Daemon',
      description: 'Copy the generated config.yml to /etc/pterodactyl on your node and start Wings.',
      completed: hasNodes,
      href: '/admin/nodes',
    },
    {
      title: '4. Assign Network Allocations',
      description: 'Add IP addresses and port ranges (e.g., 25565-25575) to your registered node.',
      completed: (nodes?.[0]?.stats?.totalAllocations || 0) > 0,
      href: '/admin/allocations',
    },
    {
      title: '5. Import a Game Egg',
      description: 'Import an official Pterodactyl egg JSON (e.g. Minecraft Paper, Rust, Terraria).',
      completed: hasEggs,
      href: '/admin/nests',
    },
    {
      title: '6. Provision Your First Server',
      description: 'Deploy and boot an active game container onto your verified Wings node.',
      completed: (nodes?.reduce((acc, n) => acc + (n.stats?.totalServers || 0), 0) || 0) > 0,
      href: '/admin/servers',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Infrastructure Overview
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          Health and operational telemetry for Obsidian Control Plane
        </p>
      </div>

      {/* Quick Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-control text-primary">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono tracking-wider">
                Wings Nodes
              </span>
              <p className="text-xl font-bold text-text-primary mt-0.5">
                {nodes?.length ?? 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-status-running/10 rounded-control text-status-running">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono tracking-wider">
                Locations
              </span>
              <p className="text-xl font-bold text-text-primary mt-0.5">
                {locations?.length ?? 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-status-starting/10 rounded-control text-status-starting">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono tracking-wider">
                Game Eggs
              </span>
              <p className="text-xl font-bold text-text-primary mt-0.5">
                {eggs?.length ?? 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-status-installing/10 rounded-control text-status-installing">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono tracking-wider">
                Total Users
              </span>
              <p className="text-xl font-bold text-text-primary mt-0.5">
                {users?.meta?.total ?? 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Onboarding Setup Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>Onboarding & Deployment Checklist</CardTitle>
              <CardDescription>
                Follow these verified steps to activate Wings nodes and deploy game servers.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="divide-y divide-border/60">
          {checklistItems.map((item, idx) => (
            <div
              key={idx}
              className="py-3.5 flex items-center justify-between gap-4 group"
            >
              <div className="flex items-start gap-3">
                {item.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-status-running shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
                )}
                <div>
                  <h4
                    className={`text-xs font-semibold ${
                      item.completed ? 'text-text-primary line-through opacity-70' : 'text-text-primary'
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>

              <Link href={item.href}>
                <Button variant="ghost" size="sm" className="group-hover:text-primary">
                  Manage <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
