'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import {
  Server,
  Plus,
  Cpu,
  HardDrive,
  Activity,
  ExternalLink,
  Trash2,
  Terminal,
  Container,
  Sliders,
  Layers,
  Database,
  Archive,
  Network,
  Search,
  Filter,
  PauseCircle,
  PlayCircle,
  ArrowRightLeft,
  Users,
  Check,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { formatMemory } from '../../../../lib/utils';
import Link from 'next/link';

export default function AdminServersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'startup' | 'resources'>('general');

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [nodeId, setNodeId] = useState<number | null>(null);
  const [allocationId, setAllocationId] = useState<number | null>(null);
  const [additionalAllocationIds, setAdditionalAllocationIds] = useState<number[]>([]);
  const [nestId, setNestId] = useState<number | null>(null);
  const [eggId, setEggId] = useState<number | null>(null);

  // Manage Allocations for an existing server
  const [manageAllocationsServer, setManageAllocationsServer] = useState<any | null>(null);
  const [newAllocationId, setNewAllocationId] = useState<number | null>(null);

  // Full Server Configuration & Resource Manager Modal
  const [configServer, setConfigServer] = useState<any | null>(null);
  const [configTab, setConfigTab] = useState<'resources' | 'features' | 'owner' | 'ports' | 'subusers'>('resources');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMemory, setEditMemory] = useState(2048);
  const [editCpu, setEditCpu] = useState(100);
  const [editDisk, setEditDisk] = useState(10240);
  const [editSwap, setEditSwap] = useState(0);
  const [editIo, setEditIo] = useState(500);
  const [editDatabases, setEditDatabases] = useState(0);
  const [editAllocationsLimit, setEditAllocationsLimit] = useState(0);
  const [editBackups, setEditBackups] = useState(0);
  const [editOwnerId, setEditOwnerId] = useState<number | null>(null);
  const [editNodeId, setEditNodeId] = useState<number | null>(null);
  const [editSubuserEmail, setEditSubuserEmail] = useState('');
  const [newPortAllocationId, setNewPortAllocationId] = useState<number | null>(null);

  const openServerConfigModal = (srv: any) => {
    setConfigServer(srv);
    setConfigTab('resources');
    setEditName(srv.name || '');
    setEditDescription(srv.description || '');
    setEditMemory(srv.limits?.memory ?? srv.memory ?? 2048);
    setEditCpu(srv.limits?.cpu ?? srv.cpu ?? 100);
    setEditDisk(srv.limits?.disk ?? srv.disk ?? 10240);
    setEditSwap(srv.limits?.swap ?? srv.swap ?? 0);
    setEditIo(srv.limits?.io ?? srv.io ?? 500);
    setEditDatabases(srv.databaseLimit ?? 0);
    setEditAllocationsLimit(srv.allocationLimit ?? 0);
    setEditBackups(srv.backupLimit ?? 0);
    setEditOwnerId(srv.owner?.id ?? srv.userId ?? null);
    setEditNodeId(srv.nodeId ?? null);
    setEditSubuserEmail('');
  };

  // Startup & Docker state (Java 25 default)
  const [startup, setStartup] = useState('');
  const [dockerImage, setDockerImage] = useState('ghcr.io/pterodactyl/yolks:java_25');
  const [environment, setEnvironment] = useState<Record<string, string>>({});
  const [autoSuspendDate, setAutoSuspendDate] = useState('');

  // Hardware Limits
  const [memory, setMemory] = useState(2048);
  const [swap, setSwap] = useState(0);
  const [cpu, setCpu] = useState(100);
  const [threads, setThreads] = useState('');
  const [disk, setDisk] = useState(10240);
  const [io, setIo] = useState(500);

  // Feature Limits
  const [databases, setDatabases] = useState(0);
  const [allocationsLimit, setAllocationsLimit] = useState(0);
  const [backups, setBackups] = useState(0);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedNodeFilter, setSelectedNodeFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Queries
  const { data: servers, isLoading: isServersLoading } = useQuery<any[]>({
    queryKey: ['admin-servers'],
    queryFn: () => fetchApi('/api/admin/servers'),
  });

  const { data: users } = useQuery<any>({
    queryKey: ['admin-users-all'],
    queryFn: () => fetchApi('/api/admin/users?perPage=100'),
  });

  const { data: nodes } = useQuery<any[]>({
    queryKey: ['admin-nodes'],
    queryFn: () => fetchApi('/api/admin/nodes'),
  });

  const { data: allocations } = useQuery<any[]>({
    queryKey: ['admin-allocations', nodeId],
    queryFn: () => fetchApi(`/api/admin/nodes/${nodeId}/allocations?assigned=false`),
    enabled: nodeId !== null,
  });

  const { data: nests } = useQuery<any[]>({
    queryKey: ['admin-nests'],
    queryFn: () => fetchApi('/api/admin/nests'),
  });

  const { data: eggs } = useQuery<any[]>({
    queryKey: ['admin-eggs', nestId],
    queryFn: () => fetchApi(`/api/admin/eggs?nestId=${nestId}`),
    enabled: nestId !== null,
  });

  const { data: eggDetails } = useQuery<any>({
    queryKey: ['admin-egg-details', eggId],
    queryFn: () => fetchApi(`/api/admin/eggs/${eggId}`),
    enabled: eggId !== null,
  });

  // Provisioning mutation
  const provisionMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/admin/servers', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          ownerId: Number(ownerId),
          nodeId: Number(nodeId),
          allocationId: Number(allocationId),
          additionalAllocationIds,
          nestId: Number(nestId),
          eggId: Number(eggId),
          startup: startup.trim() || undefined,
          dockerImage: dockerImage.trim() || undefined,
          environment,
          memory: Number(memory),
          swap: Number(swap),
          cpu: Number(cpu),
          threads: threads.trim() || undefined,
          disk: Number(disk),
          io: Number(io),
          databases: Number(databases),
          allocationsLimit: Number(allocationsLimit),
          backups: Number(backups),
          suspendAt: autoSuspendDate ? new Date(autoSuspendDate).toISOString() : undefined,
        }),
      }),
    onSuccess: (data: any) => {
      setShowModal(false);
      setAutoSuspendDate('');
      alert('Server provisioned successfully to Wings node!');
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      queryClient.invalidateQueries({ queryKey: ['client-servers'] });
      router.push(`/servers/${data.uuid}`);
    },
    onError: (err: any) => {
      alert(`Provisioning failed: ${err.message}`);
    },
  });

  // Admin suspend/unsuspend mutation
  const suspendMutation = useMutation({
    mutationFn: ({ uuid, action }: { uuid: string; action: 'suspend' | 'unsuspend' }) =>
      fetchApi(`/api/admin/servers/${uuid}/${action}`, { method: 'POST' }),
    onSuccess: (_, { action }) => {
      alert(`Server ${action === 'suspend' ? 'suspended' : 'unsuspended'} successfully.`);
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      queryClient.invalidateQueries({ queryKey: ['client-servers'] });
    },
    onError: (err: any) => {
      alert(`Suspension action failed: ${err.message}`);
    },
  });

  // Admin delete mutation
  const deleteMutation = useMutation({
    mutationFn: (uuid: string) =>
      fetchApi(`/api/admin/servers/${uuid}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      alert('Server deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      queryClient.invalidateQueries({ queryKey: ['client-servers'] });
    },
    onError: (err: any) => {
      alert(`Deletion failed: ${err.message}`);
    },
  });

  // Query server allocations for management modal
  const {
    data: serverAllocationsData,
    isLoading: isServerAllocationsLoading,
    refetch: refetchServerAllocations,
  } = useQuery<any>({
    queryKey: ['admin-server-allocations', manageAllocationsServer?.uuid],
    queryFn: () => fetchApi(`/api/admin/servers/${manageAllocationsServer.uuid}/allocations`),
    enabled: !!manageAllocationsServer?.uuid,
  });

  // Assign additional allocation mutation
  const assignAllocationMutation = useMutation({
    mutationFn: (targetAllocId: number) =>
      fetchApi(`/api/admin/servers/${manageAllocationsServer.uuid}/allocations`, {
        method: 'POST',
        body: JSON.stringify({ allocationId: targetAllocId }),
      }),
    onSuccess: () => {
      setNewAllocationId(null);
      refetchServerAllocations();
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      alert('Additional port/allocation assigned and synced to Wings daemon!');
    },
    onError: (err: any) => {
      alert(`Failed to assign allocation: ${err.message}`);
    },
  });

  // Unassign secondary allocation mutation
  const unassignAllocationMutation = useMutation({
    mutationFn: (targetAllocId: number) =>
      fetchApi(`/api/admin/servers/${manageAllocationsServer.uuid}/allocations/${targetAllocId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      refetchServerAllocations();
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      alert('Allocation unassigned and removed from Wings daemon.');
    },
    onError: (err: any) => {
      alert(`Failed to unassign allocation: ${err.message}`);
    },
  });

  // Set Primary allocation mutation
  const setPrimaryAllocationMutation = useMutation({
    mutationFn: (targetAllocId: number) =>
      fetchApi(`/api/admin/servers/${manageAllocationsServer.uuid}/allocations/${targetAllocId}/primary`, {
        method: 'POST',
      }),
    onSuccess: () => {
      refetchServerAllocations();
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      alert('Primary allocation changed and synced to Wings daemon.');
    },
    onError: (err: any) => {
      alert(`Failed to set primary allocation: ${err.message}`);
    },
  });

  // Full Server Details Query
  const {
    data: configServerDetails,
    isLoading: isConfigDetailsLoading,
    refetch: refetchConfigServerDetails,
  } = useQuery<any>({
    queryKey: ['admin-server-details', configServer?.uuid],
    queryFn: () => fetchApi(`/api/admin/servers/${configServer.uuid}`),
    enabled: !!configServer?.uuid,
  });

  // Server Allocations Query for Config Modal
  const {
    data: configAllocationsData,
    isLoading: isConfigAllocationsLoading,
    refetch: refetchConfigAllocations,
  } = useQuery<any>({
    queryKey: ['admin-config-allocations', configServer?.uuid],
    queryFn: () => fetchApi(`/api/admin/servers/${configServer.uuid}/allocations`),
    enabled: !!configServer?.uuid,
  });

  const saveServerConfigMutation = useMutation({
    mutationFn: (data: any) =>
      fetchApi(`/api/admin/servers/${configServer.uuid}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      queryClient.invalidateQueries({ queryKey: ['client-servers'] });
      refetchConfigServerDetails();
      alert('Server configuration and build limits saved & synced to Wings daemon!');
    },
    onError: (err: any) => {
      alert(`Failed to save server configuration: ${err.message}`);
    },
  });

  const addConfigSubuserMutation = useMutation({
    mutationFn: (email: string) =>
      fetchApi(`/api/admin/servers/${configServer.uuid}/subusers`, {
        method: 'POST',
        body: JSON.stringify({ email, permissions: ['*'] }),
      }),
    onSuccess: () => {
      setEditSubuserEmail('');
      refetchConfigServerDetails();
      alert('User successfully added as subuser!');
    },
    onError: (err: any) => alert(`Failed to add user: ${err.message}`),
  });

  const removeConfigSubuserMutation = useMutation({
    mutationFn: (subuserId: number) =>
      fetchApi(`/api/admin/servers/${configServer.uuid}/subusers/${subuserId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      refetchConfigServerDetails();
      alert('Subuser removed from server.');
    },
    onError: (err: any) => alert(`Failed to remove subuser: ${err.message}`),
  });

  const assignConfigPortMutation = useMutation({
    mutationFn: (allocationId: number) =>
      fetchApi(`/api/admin/servers/${configServer.uuid}/allocations`, {
        method: 'POST',
        body: JSON.stringify({ allocationId }),
      }),
    onSuccess: () => {
      setNewPortAllocationId(null);
      refetchConfigAllocations();
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      alert('Port allocated and synced to Wings daemon!');
    },
    onError: (err: any) => alert(`Failed to assign port: ${err.message}`),
  });

  const unassignConfigPortMutation = useMutation({
    mutationFn: (allocationId: number) =>
      fetchApi(`/api/admin/servers/${configServer.uuid}/allocations/${allocationId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      refetchConfigAllocations();
      queryClient.invalidateQueries({ queryKey: ['admin-servers'] });
      alert('Port removed.');
    },
    onError: (err: any) => alert(`Failed to remove port: ${err.message}`),
  });

  const handleOpenModal = () => {
    if (users?.data?.length) setOwnerId(users.data[0].id);
    if (nodes?.length) setNodeId(nodes[0].id);
    if (nests?.length) setNestId(nests[0].id);
    setShowModal(true);
  };

  React.useEffect(() => {
    if (allocations?.length) {
      setAllocationId(allocations[0].id);
    }
  }, [allocations]);

  React.useEffect(() => {
    if (eggs?.length) {
      setEggId(eggs[0].id);
    }
  }, [eggs]);

  // When egg details change, auto-populate Pterodactyl startup & variables
  React.useEffect(() => {
    if (eggDetails) {
      if (eggDetails.startup) {
        setStartup(eggDetails.startup);
      }
      const images =
        eggDetails.dockerImages && typeof eggDetails.dockerImages === 'object'
          ? Object.values(eggDetails.dockerImages)
          : [];
      const isJavaEgg =
        images.some((img: any) => typeof img === 'string' && img.includes('java')) ||
        (eggDetails?.startup && String(eggDetails.startup).includes('java'));
      // Prioritize Java 25 as the primary default runtime for Java/Minecraft eggs
      const java25 = images.find(
        (img: any) => typeof img === 'string' && (img.includes('java_25') || img.includes('java:25'))
      );
      if (java25) {
        setDockerImage(java25 as string);
      } else if (isJavaEgg) {
        setDockerImage('ghcr.io/pterodactyl/yolks:java_25');
      } else if (images.length > 0) {
        setDockerImage(images[0] as string);
      } else {
        setDockerImage('ghcr.io/pterodactyl/yolks:java_25');
      }

      const initialEnv: Record<string, string> = {};
      if (Array.isArray(eggDetails.variables)) {
        eggDetails.variables.forEach((v: any) => {
          initialEnv[v.envVariable] = v.defaultValue ?? '';
        });
      }
      setEnvironment(initialEnv);
    }
  }, [eggDetails]);

  const filteredServers = (servers || []).filter((server: any) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      server.name?.toLowerCase().includes(q) ||
      server.uuidShort?.toLowerCase().includes(q) ||
      server.uuid?.toLowerCase().includes(q) ||
      server.owner?.username?.toLowerCase().includes(q) ||
      server.owner?.email?.toLowerCase().includes(q) ||
      server.node?.toLowerCase().includes(q) ||
      server.allocation?.toLowerCase().includes(q);

    const matchesNode =
      selectedNodeFilter === 'all' ||
      String(server.nodeId) === selectedNodeFilter ||
      server.node === selectedNodeFilter;

    const matchesStatus =
      selectedStatusFilter === 'all' ||
      (selectedStatusFilter === 'online' && (server.status === 'running' || server.status === 'online')) ||
      (selectedStatusFilter === 'offline' && (!server.status || server.status === 'offline')) ||
      (selectedStatusFilter === 'installing' && server.status === 'installing') ||
      (selectedStatusFilter === 'failed' && server.status === 'install_failed');

    return matchesSearch && matchesNode && matchesStatus;
  });

  const totalMemoryAllocated = (servers || []).reduce(
    (acc: number, s: any) => acc + (s.limits?.memory || 0),
    0,
  );
  const totalDiskAllocated = (servers || []).reduce(
    (acc: number, s: any) => acc + (s.limits?.disk || 0),
    0,
  );
  const onlineCount = (servers || []).filter(
    (s: any) => s.status === 'running' || s.status === 'online',
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Server Provisioning & Infrastructure
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Deploy game instances across Wings hosting nodes with Pterodactyl-style startup and resource limits
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenModal}>
          <Plus className="w-4 h-4" /> Provision New Server
        </Button>
      </div>

      {/* Provisioning Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-card p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Deploy Game Server</h3>
                <p className="text-[11px] text-text-muted">
                  Configure hardware limits, egg variables, and Wings container startup
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-control border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-control transition-all ${
                  activeTab === 'general'
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                General & Allocations
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('startup')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-control transition-all ${
                  activeTab === 'startup'
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Startup & Egg Variables
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('resources')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-control transition-all ${
                  activeTab === 'resources'
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Resource & Feature Limits
              </button>
            </div>

            {/* Tab 1: General & Allocations */}
            {activeTab === 'general' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-text-secondary font-medium block mb-1">Server Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vanilla Minecraft SMP"
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-text-secondary font-medium block mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short summary for this instance"
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Server Owner *</label>
                    <select
                      value={ownerId || ''}
                      onChange={(e) => setOwnerId(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    >
                      {users?.data?.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.username} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Target Node *</label>
                    <select
                      value={nodeId || ''}
                      onChange={(e) => setNodeId(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    >
                      {nodes?.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} ({n.fqdn})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-text-secondary font-medium block mb-1">
                    Primary Allocation (Default Port) *
                  </label>
                  <select
                    value={allocationId || ''}
                    onChange={(e) => {
                      const newId = Number(e.target.value);
                      setAllocationId(newId);
                      setAdditionalAllocationIds((prev) => prev.filter((id) => id !== newId));
                    }}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                  >
                    {(allocations || []).length === 0 ? (
                      <option value="">No unassigned allocations on this node</option>
                    ) : (
                      allocations?.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.ip}:{a.port} {a.alias ? `(${a.alias})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Additional Allocations (Voice Chat UDP, Geyser Bedrock, etc.) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-text-secondary font-medium block">
                      Additional Allocations (Optional — UDP Voice Chat, Geyser, etc.)
                    </label>
                    {additionalAllocationIds.length > 0 && (
                      <span className="text-[10px] text-primary font-mono font-medium">
                        {additionalAllocationIds.length} port(s) selected
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-text-muted mb-2">
                    Wings daemon binds all allocated ports for both TCP and UDP. Select extra ports here for Minecraft Voice Chat (SimpleVoiceChat UDP 24454), Geyser Bedrock (UDP 19132), or Dynmap/Bluemap.
                  </p>
                  <div className="max-h-36 overflow-y-auto border border-border rounded-control bg-surface-elevated/40 p-2 space-y-1">
                    {(allocations || []).filter((a: any) => a.id !== allocationId).length === 0 ? (
                      <div className="text-[11px] text-text-muted p-2 text-center">
                        No additional unassigned allocations available on this node.
                      </div>
                    ) : (
                      (allocations || [])
                        .filter((a: any) => a.id !== allocationId)
                        .map((a: any) => {
                          const isSelected = additionalAllocationIds.includes(a.id);
                          return (
                            <label
                              key={a.id}
                              className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs font-mono ${
                                isSelected
                                  ? 'bg-primary/10 border border-primary/30 text-text-primary'
                                  : 'hover:bg-surface-elevated text-text-secondary'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAdditionalAllocationIds([...additionalAllocationIds, a.id]);
                                    } else {
                                      setAdditionalAllocationIds(
                                        additionalAllocationIds.filter((id) => id !== a.id)
                                      );
                                    }
                                  }}
                                  className="rounded border-border text-primary focus:ring-0"
                                />
                                <span>
                                  {a.ip}:{a.port}
                                </span>
                                {a.alias && (
                                  <span className="text-[10px] text-text-muted font-sans">
                                    ({a.alias})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted font-sans">
                                TCP &amp; UDP
                              </span>
                            </label>
                          );
                        })
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Nest *</label>
                    <select
                      value={nestId || ''}
                      onChange={(e) => setNestId(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    >
                      {nests?.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Egg *</label>
                    <select
                      value={eggId || ''}
                      onChange={(e) => setEggId(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    >
                      {(eggs || []).length === 0 ? (
                        <option value="">No eggs in this nest</option>
                      ) : (
                        eggs?.map((e: any) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Minecraft Version Quick Selection */}
                {eggDetails?.variables?.some((v: any) =>
                  ['MINECRAFT_VERSION', 'MC_VERSION', 'VANILLA_VERSION'].includes(v.envVariable)
                ) && (
                  <div className="pt-2 border-t border-border">
                    <label className="text-text-secondary font-medium block mb-1">
                      Minecraft Version *
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={
                          ['latest', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2'].includes(
                            environment['MINECRAFT_VERSION'] || environment['MC_VERSION'] || environment['VANILLA_VERSION'] || ''
                          )
                            ? (environment['MINECRAFT_VERSION'] || environment['MC_VERSION'] || environment['VANILLA_VERSION'] || 'latest')
                            : 'custom'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== 'custom') {
                            setEnvironment({
                              ...environment,
                              MINECRAFT_VERSION: val,
                              MC_VERSION: val,
                              VANILLA_VERSION: val,
                            });
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono text-xs"
                      >
                        <option value="latest">Latest Release (latest)</option>
                        <option value="1.21.1">1.21.1 (Java 21)</option>
                        <option value="1.21">1.21 (Java 21)</option>
                        <option value="1.20.6">1.20.6 (Java 21)</option>
                        <option value="1.20.4">1.20.4 (Java 17)</option>
                        <option value="1.20.2">1.20.2 (Java 17)</option>
                        <option value="1.20.1">1.20.1 (Java 17)</option>
                        <option value="1.19.4">1.19.4 (Java 17)</option>
                        <option value="1.18.2">1.18.2 (Java 17)</option>
                        <option value="1.16.5">1.16.5 (Java 11 / 8)</option>
                        <option value="1.12.2">1.12.2 (Java 8)</option>
                        <option value="custom">Custom Version...</option>
                      </select>
                      <input
                        type="text"
                        value={environment['MINECRAFT_VERSION'] || environment['MC_VERSION'] || environment['VANILLA_VERSION'] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEnvironment({
                            ...environment,
                            MINECRAFT_VERSION: val,
                            MC_VERSION: val,
                            VANILLA_VERSION: val,
                          });
                        }}
                        placeholder="e.g. 1.20.4"
                        className="w-32 px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Startup & Egg Variables */}
            {activeTab === 'startup' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-text-secondary font-medium flex items-center justify-between mb-1">
                    <span>Startup Command</span>
                    <span className="text-[10px] text-text-muted">Variables like {'{{SERVER_JARFILE}}'} are supported</span>
                  </label>
                  <textarea
                    rows={3}
                    value={startup}
                    onChange={(e) => setStartup(e.target.value)}
                    placeholder="e.g. java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}"
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono text-[11px] focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-text-secondary font-medium block mb-1">Docker Image</label>
                  {eggDetails?.dockerImages && typeof eggDetails.dockerImages === 'object' && Object.keys(eggDetails.dockerImages).length > 0 ? (
                    <div className="space-y-1.5">
                      {(() => {
                        const rawMap: Record<string, string> = { ...eggDetails.dockerImages };
                        const has25 = Object.values(rawMap).some((img) => String(img).includes('java_25'));
                        const isJava = Object.values(rawMap).some((img) => String(img).includes('java')) ||
                          (eggDetails?.startup && String(eggDetails.startup).includes('java'));
                        const displayMap = {
                          ...(isJava && !has25 ? { 'Java 25 (Recommended)': 'ghcr.io/pterodactyl/yolks:java_25' } : {}),
                          ...rawMap,
                        };

                        return (
                          <select
                            value={dockerImage}
                            onChange={(e) => setDockerImage(e.target.value)}
                            className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono text-[11px]"
                          >
                            {Object.entries(displayMap)
                              .sort(([labelA, imgA], [labelB, imgB]) => {
                                const aIs25 = String(imgA).includes('java_25') || String(labelA).includes('25');
                                const bIs25 = String(imgB).includes('java_25') || String(labelB).includes('25');
                                if (aIs25 && !bIs25) return -1;
                                if (!aIs25 && bIs25) return 1;
                                const aIs21 = String(imgA).includes('java_21') || String(labelA).includes('21');
                                const bIs21 = String(imgB).includes('java_21') || String(labelB).includes('21');
                                if (aIs21 && !bIs21) return -1;
                                if (!aIs21 && bIs21) return 1;
                                return 0;
                              })
                              .map(([label, img]) => (
                                <option key={label} value={img as string}>
                                  {label} ({img as string})
                                </option>
                              ))}
                          </select>
                        );
                      })()}
                      <input
                        type="text"
                        value={dockerImage}
                        onChange={(e) => setDockerImage(e.target.value)}
                        placeholder="Custom Docker image tag"
                        className="w-full px-3 py-1.5 bg-surface-elevated border border-border rounded-control text-text-primary font-mono text-[11px] focus:outline-none focus:border-primary"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={dockerImage}
                      onChange={(e) => setDockerImage(e.target.value)}
                      placeholder="e.g. ghcr.io/pterodactyl/yolks:java_21"
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono text-[11px] focus:outline-none focus:border-primary"
                    />
                  )}
                </div>

                {/* Dynamic Egg Variables */}
                {eggDetails?.variables && eggDetails.variables.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-primary" /> Egg Environment Variables
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                      {eggDetails.variables.map((v: any) => (
                        <div key={v.id} className="p-2.5 bg-surface-elevated border border-border rounded-control space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-text-primary">{v.name}</span>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-primary">
                              {v.envVariable}
                            </span>
                          </div>
                          {v.description && (
                            <p className="text-[10px] text-text-muted line-clamp-1">{v.description}</p>
                          )}
                          <input
                            type="text"
                            value={environment[v.envVariable] ?? ''}
                            onChange={(e) =>
                              setEnvironment({ ...environment, [v.envVariable]: e.target.value })
                            }
                            placeholder={v.defaultValue || 'No default'}
                            className="w-full px-2 py-1 bg-surface border border-border rounded text-text-primary font-mono text-[11px] focus:outline-none focus:border-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Resource & Feature Limits */}
            {activeTab === 'resources' && (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-primary" /> Hardware Limits
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Memory (MiB) *</label>
                      <input
                        type="number"
                        min={1}
                        max={2147483647}
                        value={memory}
                        onChange={(e) => setMemory(Math.min(2147483647, Math.max(0, Number(e.target.value))))}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Swap (MiB)</label>
                      <input
                        type="number"
                        min={0}
                        max={2147483647}
                        value={swap}
                        onChange={(e) => setSwap(Math.min(2147483647, Math.max(0, Number(e.target.value))))}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Disk Space (MiB) *</label>
                      <input
                        type="number"
                        min={1}
                        max={2147483647}
                        value={disk}
                        onChange={(e) => setDisk(Math.min(2147483647, Math.max(0, Number(e.target.value))))}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">CPU Limit (%) *</label>
                      <input
                        type="number"
                        min={0}
                        max={2147483647}
                        value={cpu}
                        onChange={(e) => setCpu(Math.min(2147483647, Math.max(0, Number(e.target.value))))}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">CPU Pinning</label>
                      <input
                        type="text"
                        value={threads}
                        onChange={(e) => setThreads(e.target.value)}
                        placeholder="e.g. 0,1 or leave empty"
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Block IO Weight</label>
                      <input
                        type="number"
                        value={io}
                        onChange={(e) => setIo(Number(e.target.value))}
                        placeholder="500"
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <h4 className="font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-primary" /> Feature Limits
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Database Limit</label>
                      <input
                        type="number"
                        value={databases}
                        onChange={(e) => setDatabases(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Allocation Limit</label>
                      <input
                        type="number"
                        value={allocationsLimit}
                        onChange={(e) => setAllocationsLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Backup Limit</label>
                      <input
                        type="number"
                        value={backups}
                        onChange={(e) => setBackups(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Auto-Suspension Timer & Date Configuration */}
                  <div className="pt-3 border-t border-border">
                    <label className="text-text-secondary font-medium block mb-1">
                      Auto-Suspension Date &amp; Expiration (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={autoSuspendDate}
                      onChange={(e) => setAutoSuspendDate(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono text-xs focus:outline-none focus:border-primary"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      The panel will automatically suspend this server and stop its container when the target expiration date and time is reached.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-[11px] text-text-muted">
                {activeTab === 'general'
                  ? 'Step 1 of 3: Core Settings'
                  : activeTab === 'startup'
                  ? 'Step 2 of 3: Wings Startup'
                  : 'Step 3 of 3: Hardware Limits'}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                {activeTab !== 'resources' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setActiveTab(activeTab === 'general' ? 'startup' : 'resources')
                    }
                  >
                    Next &rarr;
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={
                    provisionMutation.isPending || !name || !nodeId || !allocationId || !eggId
                  }
                  onClick={() => provisionMutation.mutate()}
                >
                  {provisionMutation.isPending ? 'Provisioning...' : 'Provision Server'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Server Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface border border-border rounded-card">
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider block mb-1">
            Total Servers
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-text-primary">
              {(servers || []).length}
            </span>
            <Server className="w-4 h-4 text-primary" />
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-card">
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider block mb-1">
            Online Instances
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-status-running">
              {onlineCount}
            </span>
            <Activity className="w-4 h-4 text-status-running" />
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-card">
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider block mb-1">
            Total RAM Allocated
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-text-primary">
              {formatMemory(totalMemoryAllocated)}
            </span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-card">
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider block mb-1">
            Total Disk Allocated
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-text-primary">
              {formatMemory(totalDiskAllocated)}
            </span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-surface border border-border rounded-card">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all servers by name, UUID, owner, node, or address..."
            className="w-full pl-9 pr-3 py-1.5 bg-surface-elevated border border-border rounded-control text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={selectedNodeFilter}
              onChange={(e) => setSelectedNodeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="all">All Nodes ({nodes?.length || 0})</option>
              {nodes?.map((n: any) => (
                <option key={n.id} value={String(n.id)}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="all">All Statuses</option>
            <option value="online">Online / Running</option>
            <option value="offline">Offline</option>
            <option value="installing">Installing</option>
            <option value="failed">Install Failed</option>
          </select>

          <span className="text-[11px] font-mono text-text-muted shrink-0 pl-1">
            {filteredServers.length} / {(servers || []).length}
          </span>
        </div>
      </div>

      {/* Servers Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isServersLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading all servers across infrastructure...</div>
        ) : (servers || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No servers provisioned yet. Click &quot;Provision New Server&quot; to deploy your first container.
          </div>
        ) : filteredServers.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No servers match your current search or filter criteria.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">Server Name</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Node</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Memory</th>
                <th className="px-5 py-3">CPU</th>
                <th className="px-5 py-3">Disk</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredServers?.map((server: any) => (
                <tr
                  key={server.uuid}
                  onClick={() => openServerConfigModal(server)}
                  className="hover:bg-surface-elevated/30 transition-colors cursor-pointer group"
                  title="Click to view & configure server hardware, owner, node, limits, and subusers"
                >
                  <td className="px-5 py-3.5 font-medium text-text-primary">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                      <div>
                        <span className="hover:text-primary transition-colors font-medium block">
                          {server.name}
                        </span>
                        <span className="block text-[10px] font-mono text-text-muted">
                          {server.uuidShort} &bull; Click to configure
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {server.owner ? (
                      <div>
                        <span className="font-medium text-text-primary block">{server.owner.username}</span>
                        <span className="text-[10px] text-text-muted font-mono">{server.owner.email}</span>
                      </div>
                    ) : (
                      <span className="text-text-muted">System / Unknown</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">{server.node}</td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setManageAllocationsServer(server);
                      }}
                      className="font-mono text-[11px] text-left text-text-secondary hover:text-primary transition-colors flex items-center gap-1.5 group"
                      title="Click to manage allocations for this server"
                    >
                      <span className="group-hover:underline">{server.allocation}</span>
                      {server.allocationsCount && server.allocationsCount > 1 ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-sans font-medium">
                          +{server.allocationsCount - 1} more
                        </span>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        server.status === 'suspended'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : server.status === 'installing'
                          ? 'bg-status-stopping/15 text-status-stopping border border-status-stopping/30'
                          : server.status === 'install_failed'
                          ? 'bg-status-error/15 text-status-error border border-status-error/30'
                          : 'bg-status-running/15 text-status-running border border-status-running/30'
                      }`}
                    >
                      {server.status === 'suspended' ? 'Suspended' : server.status || 'Active'}
                    </span>
                    {server.autoSuspendAt && (
                      <span className="block text-[9.5px] font-mono text-zinc-400 mt-0.5">
                        Exp: {new Date(server.autoSuspendAt).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-text-secondary">
                    {formatMemory(server.limits.memory)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-text-secondary">
                    {server.limits.cpu}%
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-text-secondary">
                    {formatMemory(server.limits.disk)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openServerConfigModal(server);
                        }}
                        title="Configure Hardware Limits & Owner"
                      >
                        <Sliders className="w-3.5 h-3.5 mr-1" /> Config
                      </Button>
                      <Link href={`/servers/${server.uuid}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="secondary" size="sm">
                          Console <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setManageAllocationsServer(server);
                        }}
                        className="text-cyan-400 hover:text-cyan-300 border-cyan-500/30"
                        title="Manage Port Allocations (Voice Chat UDP, Geyser, etc.)"
                      >
                        <Network className="w-3.5 h-3.5" />
                      </Button>
                      {server.status === 'suspended' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={suspendMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            suspendMutation.mutate({ uuid: server.uuid, action: 'unsuspend' });
                          }}
                          className="text-emerald-400 hover:text-emerald-300 border-emerald-500/30"
                          title="Unsuspend server"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={suspendMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Suspend server "${server.name}"? The container will be shut down.`)) {
                              suspendMutation.mutate({ uuid: server.uuid, action: 'suspend' });
                            }
                          }}
                          className="text-amber-400 hover:text-amber-300 border-amber-500/30"
                          title="Suspend server"
                        >
                          <PauseCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            confirm(
                              `Are you sure you want to permanently delete "${server.name}" (${server.uuidShort})?\n\nThis will remove the container, files, and allocations from Wings.`,
                            )
                          ) {
                            deleteMutation.mutate(server.uuid);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manage Server Allocations Modal */}
      {manageAllocationsServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-card p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Network className="w-4 h-4 text-primary" />
                  Port Allocations &amp; Network — {manageAllocationsServer.name}
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Manage primary connection and secondary ports (UDP Voice Chat, Bedrock Geyser, Dynmap)
                </p>
              </div>
              <button
                onClick={() => setManageAllocationsServer(null)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            {/* Protocol & Voice Chat notice */}
            <div className="p-3 bg-surface-elevated/60 border border-cyan-500/20 rounded-control text-xs text-text-secondary">
              <span className="text-cyan-400 font-semibold block mb-0.5">⚡ Dual TCP &amp; UDP Binding</span>
              Wings daemon automatically maps all allocated ports for both TCP and UDP. Any port added below is immediately available for plugins such as <span className="text-text-primary font-mono font-medium">SimpleVoiceChat (UDP)</span> or <span className="text-text-primary font-mono font-medium">PlasmoVoice</span> without modifying server firewall rules.
            </div>

            {/* Current Allocations List */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-text-primary block">
                Currently Assigned Ports ({serverAllocationsData?.assigned?.length || 0})
              </span>

              {isServerAllocationsLoading ? (
                <div className="p-6 text-center text-xs text-text-muted">Loading allocations...</div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {serverAllocationsData?.assigned?.map((alloc: any) => {
                    const isPrimary = alloc.id === (serverAllocationsData?.primary?.id || manageAllocationsServer?.allocationId);
                    return (
                      <div
                        key={alloc.id}
                        className={`flex items-center justify-between p-3 rounded-control border transition-colors ${
                          isPrimary
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-surface-elevated/40 border-border hover:border-border-hover'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Network className={`w-4 h-4 ${isPrimary ? 'text-primary' : 'text-text-muted'}`} />
                          <div>
                            <span className="font-mono text-xs font-bold text-text-primary">
                              {alloc.ip}:{alloc.port}
                            </span>
                            {alloc.alias && (
                              <span className="text-[11px] text-text-muted ml-2 font-mono">
                                ({alloc.alias})
                              </span>
                            )}
                            {alloc.notes && (
                              <p className="text-[10px] text-text-muted mt-0.5">{alloc.notes}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isPrimary ? (
                            <Badge variant="info">PRIMARY (DEFAULT)</Badge>
                          ) : (
                            <>
                              <Badge variant="default">SECONDARY (UDP/TCP)</Badge>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={setPrimaryAllocationMutation.isPending}
                                onClick={() => setPrimaryAllocationMutation.mutate(alloc.id)}
                                className="text-[11px] py-1 px-2 text-text-secondary hover:text-text-primary"
                                title="Set as primary connection port"
                              >
                                Make Primary
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={unassignAllocationMutation.isPending}
                                onClick={() => {
                                  if (confirm(`Remove allocation ${alloc.ip}:${alloc.port} from this server?`)) {
                                    unassignAllocationMutation.mutate(alloc.id);
                                  }
                                }}
                                className="text-[11px] py-1 px-2"
                                title="Remove / Unassign allocation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assign Additional Allocation Section */}
            <div className="pt-3 border-t border-border space-y-2">
              <span className="text-xs font-semibold text-text-primary block">
                Assign Additional Allocation (from Node: {serverAllocationsData?.server?.nodeName || manageAllocationsServer.node})
              </span>

              <div className="flex items-center gap-2">
                <select
                  value={newAllocationId || ''}
                  onChange={(e) => setNewAllocationId(e.target.value ? Number(e.target.value) : null)}
                  className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                >
                  <option value="">-- Select an unassigned port on this node --</option>
                  {(serverAllocationsData?.unassigned || []).map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.ip}:{a.port} {a.alias ? `(${a.alias})` : ''}
                    </option>
                  ))}
                </select>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={!newAllocationId || assignAllocationMutation.isPending}
                  onClick={() => {
                    if (newAllocationId) {
                      assignAllocationMutation.mutate(newAllocationId);
                    }
                  }}
                >
                  {assignAllocationMutation.isPending ? 'Assigning...' : '+ Assign Port'}
                </Button>
              </div>

              {(serverAllocationsData?.unassigned || []).length === 0 && !isServerAllocationsLoading && (
                <p className="text-[11px] text-amber-400/90">
                  No unassigned allocations left on this node. Go to &quot;Allocations&quot; in the sidebar to create new ports for this node first.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setManageAllocationsServer(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Server Configuration & Hardware Limits Modal */}
      {configServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl bg-surface border border-border rounded-card p-6 space-y-5 my-8 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  Server Configuration &amp; Limits Manager &mdash; {configServer.name}
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5 font-mono">
                  UUID: {configServer.uuid} &bull; Short: {configServer.uuidShort} &bull; Node: {configServer.node}
                </p>
              </div>
              <button
                onClick={() => setConfigServer(null)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
              <button
                onClick={() => setConfigTab('resources')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
                  configTab === 'resources'
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Hardware &amp; Limits</span>
              </button>

              <button
                onClick={() => setConfigTab('features')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
                  configTab === 'features'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Feature Limits &amp; Node</span>
              </button>

              <button
                onClick={() => setConfigTab('owner')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
                  configTab === 'owner'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Owner &amp; Transfer</span>
              </button>

              <button
                onClick={() => setConfigTab('ports')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
                  configTab === 'ports'
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Port Allocations</span>
              </button>

              <button
                onClick={() => setConfigTab('subusers')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
                  configTab === 'subusers'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Subusers ({configServerDetails?.subusers?.length || 0})</span>
              </button>
            </div>

            {/* Tab 1: Hardware & Build Limits */}
            {configTab === 'resources' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">
                      Server Memory / RAM Limit (MiB) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="128"
                        step="128"
                        value={editMemory}
                        onChange={(e) => setEditMemory(Number(e.target.value))}
                        className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                      <span className="px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-muted font-mono">
                        {formatMemory(editMemory)}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      RAM limit assigned to Docker container on Wings (0 for unlimited).
                    </p>
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">
                      CPU Limit (%) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={editCpu}
                        onChange={(e) => setEditCpu(Number(e.target.value))}
                        className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                      <span className="px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-muted font-mono">
                        {editCpu}%
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      100% = 1 full thread core, 200% = 2 cores, 500% = 5 cores.
                    </p>
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">
                      Disk Storage Limit (MiB) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="512"
                        step="1024"
                        value={editDisk}
                        onChange={(e) => setEditDisk(Number(e.target.value))}
                        className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                      <span className="px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-muted font-mono">
                        {formatMemory(editDisk)}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      Maximum container filesystem storage allocated on host NVMe/SSD.
                    </p>
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">
                      Swap Memory (MiB)
                    </label>
                    <input
                      type="number"
                      min="-1"
                      step="128"
                      value={editSwap}
                      onChange={(e) => setEditSwap(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      0 to disable swap, -1 for unlimited, or set specific swap in MiB.
                    </p>
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">
                      Disk IO Weight (10 &ndash; 1000)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={editIo}
                      onChange={(e) => setEditIo(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Relative disk IO priority compared to other containers (Default: 500).
                    </p>
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">
                      Server Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Feature Limits & Node */}
            {configTab === 'features' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">
                      Database Limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editDatabases}
                      onChange={(e) => setEditDatabases(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Allowed external MySQL / Postgres databases.
                    </p>
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">
                      Allocations Limit (Ports)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editAllocationsLimit}
                      onChange={(e) => setEditAllocationsLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Total number of ports this server may claim (0 for unlimited).
                    </p>
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">
                      Backup Limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editBackups}
                      onChange={(e) => setEditBackups(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Total server backups the user can create and store.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="text-text-secondary font-medium block mb-1">
                    Assigned Node
                  </label>
                  <select
                    value={editNodeId || ''}
                    onChange={(e) => setEditNodeId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                  >
                    {nodes?.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} &bull; {n.fqdn} ({n.location?.name || 'Default'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-muted mt-1">
                    Node hosting this server instance. Changing node updates panel assignment.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 3: Owner & Transfer */}
            {configTab === 'owner' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-surface-elevated/50 border border-border rounded-control space-y-2">
                  <span className="font-semibold text-text-primary block">
                    Current Server Owner
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center font-mono font-bold text-primary">
                      {configServer.owner?.username?.slice(0, 2).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <span className="font-bold text-text-primary block">
                        {configServer.owner?.username || 'System'}
                      </span>
                      <span className="text-[11px] font-mono text-text-muted">
                        {configServer.owner?.email || 'N/A'} (ID: #{configServer.owner?.id || configServer.userId})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-surface-elevated/50 border border-border rounded-control space-y-3">
                  <span className="font-semibold text-text-primary block flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                    Transfer Ownership to Another Account
                  </span>
                  <p className="text-[11px] text-text-muted">
                    Select a registered user account to become the new owner of this server.
                  </p>

                  <select
                    value={editOwnerId || ''}
                    onChange={(e) => setEditOwnerId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Choose Account --</option>
                    {users?.data?.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.email}) &bull; #{u.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Tab 4: Port Allocations */}
            {configTab === 'ports' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">
                    Assigned Ports &amp; UDP Bindings ({configAllocationsData?.assigned?.length || 0})
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">Dual TCP &amp; UDP mapped</span>
                </div>

                {isConfigAllocationsLoading ? (
                  <div className="p-6 text-center text-xs text-text-muted">Loading allocations...</div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {configAllocationsData?.assigned?.map((alloc: any) => {
                      const isPrimary = alloc.id === configAllocationsData?.primary?.id;
                      return (
                        <div
                          key={alloc.id}
                          className={`flex items-center justify-between p-2.5 rounded-control border ${
                            isPrimary ? 'bg-primary/5 border-primary/30' : 'bg-surface-elevated/40 border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Network className={`w-3.5 h-3.5 ${isPrimary ? 'text-primary' : 'text-text-muted'}`} />
                            <span className="font-mono text-xs font-bold text-text-primary">
                              {alloc.ip}:{alloc.port} {alloc.alias ? `(${alloc.alias})` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isPrimary ? (
                              <Badge variant="info" className="text-[9px]">PRIMARY</Badge>
                            ) : (
                              <>
                                <Badge variant="default" className="text-[9px]">SECONDARY</Badge>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={unassignConfigPortMutation.isPending}
                                  onClick={() => {
                                    if (confirm(`Remove allocation ${alloc.ip}:${alloc.port}?`)) {
                                      unassignConfigPortMutation.mutate(alloc.id);
                                    }
                                  }}
                                  className="text-[10px] py-0.5 px-1.5"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Allocation to Server */}
                <div className="pt-2 border-t border-border flex items-center gap-2">
                  <select
                    value={newPortAllocationId || ''}
                    onChange={(e) => setNewPortAllocationId(e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 px-3 py-1.5 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Assign new port from node --</option>
                    {(configAllocationsData?.unassigned || []).map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.ip}:{a.port} {a.alias ? `(${a.alias})` : ''}
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!newPortAllocationId || assignConfigPortMutation.isPending}
                    onClick={() => {
                      if (newPortAllocationId) {
                        assignConfigPortMutation.mutate(newPortAllocationId);
                      }
                    }}
                  >
                    + Assign Port
                  </Button>
                </div>
              </div>
            )}

            {/* Tab 5: Subusers */}
            {configTab === 'subusers' && (
              <div className="space-y-4 text-xs">
                {/* Add Subuser input */}
                <div className="p-3 bg-surface-elevated/50 border border-border rounded-control space-y-2">
                  <span className="font-semibold text-text-primary block">
                    Add User to this Server
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Enter registered user email address..."
                      value={editSubuserEmail}
                      onChange={(e) => setEditSubuserEmail(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!editSubuserEmail.trim() || addConfigSubuserMutation.isPending}
                      onClick={() => addConfigSubuserMutation.mutate(editSubuserEmail.trim())}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      {addConfigSubuserMutation.isPending ? 'Adding...' : 'Add User'}
                    </Button>
                  </div>
                </div>

                {/* Subusers list */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {(configServerDetails?.subusers || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-muted">
                      No additional subusers assigned to this server yet.
                    </div>
                  ) : (
                    configServerDetails.subusers.map((sub: any) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-2.5 rounded-control bg-surface-elevated/40 border border-border"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center font-mono text-xs font-bold text-primary">
                            {sub.user?.username?.slice(0, 2).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-text-primary block">{sub.user?.username}</span>
                            <span className="text-[10px] text-text-muted font-mono">{sub.user?.email}</span>
                          </div>
                        </div>

                        <Button
                          variant="danger"
                          size="sm"
                          disabled={removeConfigSubuserMutation.isPending}
                          onClick={() => {
                            if (confirm(`Remove subuser ${sub.user?.username} from this server?`)) {
                              removeConfigSubuserMutation.mutate(sub.id);
                            }
                          }}
                          className="text-[10px] py-1 px-2"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setConfigServer(null)}>
                Cancel
              </Button>

              <Button
                variant="primary"
                size="md"
                disabled={saveServerConfigMutation.isPending}
                onClick={() => {
                  saveServerConfigMutation.mutate({
                    name: editName,
                    memory: editMemory,
                    cpu: editCpu,
                    disk: editDisk,
                    swap: editSwap,
                    io: editIo,
                    databases: editDatabases,
                    allocationsLimit: editAllocationsLimit,
                    backups: editBackups,
                    ownerId: editOwnerId || undefined,
                    nodeId: editNodeId || undefined,
                  });
                }}
              >
                <Check className="w-4 h-4 mr-1.5" />
                {saveServerConfigMutation.isPending ? 'Syncing to Wings...' : 'Save & Sync to Wings'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
