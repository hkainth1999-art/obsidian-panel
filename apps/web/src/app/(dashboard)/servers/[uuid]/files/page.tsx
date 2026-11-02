'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import {
  Folder,
  File,
  ChevronRight,
  Upload,
  Plus,
  Trash2,
  FolderPlus,
  Download,
  FileArchive,
  Save,
  X,
  RefreshCw,
  Pencil,
  Copy,
  Check,
  CheckSquare,
  Square,
  FileCode,
  Archive,
  FolderInput,
} from 'lucide-react';
import { Button } from '../../../../../components/ui/button';
import { formatBytes } from '../../../../../lib/utils';

interface WingsFile {
  name: string;
  size: number;
  directory: boolean;
  file: boolean;
  symlink: boolean;
  mime: string;
  modified: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  file: WingsFile;
}

export default function ServerFilesPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();
  const [currentDirectory, setCurrentDirectory] = useState('/');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-selection state
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Modals state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [renamingFile, setRenamingFile] = useState<WingsFile | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [copiedPath, setCopiedPath] = useState(false);
  const [isMovingFiles, setIsMovingFiles] = useState(false);
  const [movingFileNames, setMovingFileNames] = useState<string[]>([]);
  const [moveDestination, setMoveDestination] = useState('');

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Clear selections when directory changes
  useEffect(() => {
    setSelectedNames(new Set());
  }, [currentDirectory]);

  // List files query
  const { data: files, isLoading, refetch } = useQuery<WingsFile[]>({
    queryKey: ['server-files', uuid, currentDirectory],
    queryFn: () =>
      fetchApi(`/api/client/servers/${uuid}/files/list?directory=${encodeURIComponent(currentDirectory)}`),
  });

  // Save file mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/client/servers/${uuid}/files/write?file=${encodeURIComponent(selectedFile!)}`, {
        method: 'POST',
        body: JSON.stringify({ content: fileContent }),
      }),
    onSuccess: () => {
      setIsEditing(false);
      setSelectedFile(null);
      refetch();
    },
    onError: (err: any) => alert(`Save failed: ${err.message}`),
  });

  // Delete file(s) mutation
  const deleteMutation = useMutation({
    mutationFn: (fileNames: string[]) =>
      fetchApi(`/api/client/servers/${uuid}/files/delete`, {
        method: 'POST',
        body: JSON.stringify({
          root: currentDirectory,
          files: fileNames,
        }),
      }),
    onSuccess: () => {
      setSelectedNames(new Set());
      refetch();
    },
    onError: (err: any) => alert(`Delete failed: ${err.message}`),
  });

  // Rename file/folder mutation
  const renameMutation = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      fetchApi(`/api/client/servers/${uuid}/files/rename`, {
        method: 'POST',
        body: JSON.stringify({
          root: currentDirectory,
          files: [{ from, to }],
        }),
      }),
    onSuccess: () => {
      setRenamingFile(null);
      setRenameInput('');
      refetch();
    },
    onError: (err: any) => alert(`Rename failed: ${err.message}`),
  });

  // Move files mutation (supporting single or batch moves to any folder)
  const moveFilesMutation = useMutation({
    mutationFn: ({ fileNames, destination }: { fileNames: string[]; destination: string }) => {
      let target = destination.trim();
      if (!target) target = '/';

      const filesPayload = fileNames.map((name) => {
        const fromPath = currentDirectory === '/' ? `/${name}` : `${currentDirectory}/${name}`;
        let toPath: string;

        if (target === '..') {
          const parentDir = currentDirectory.substring(0, currentDirectory.lastIndexOf('/')) || '/';
          toPath = parentDir === '/' ? `/${name}` : `${parentDir}/${name}`;
        } else if (target.startsWith('/')) {
          toPath = target === '/' ? `/${name}` : `${target}/${name}`;
        } else {
          toPath = currentDirectory === '/' ? `/${target}/${name}` : `${currentDirectory}/${target}/${name}`;
        }

        toPath = toPath.replace(/\/+/g, '/');
        const cleanFrom = fromPath.replace(/\/+/g, '/');

        return {
          from: cleanFrom,
          to: toPath,
        };
      });

      return fetchApi(`/api/client/servers/${uuid}/files/rename`, {
        method: 'POST',
        body: JSON.stringify({
          root: '/',
          files: filesPayload,
        }),
      });
    },
    onSuccess: () => {
      setIsMovingFiles(false);
      setMovingFileNames([]);
      setSelectedNames(new Set());
      setMoveDestination('');
      refetch();
    },
    onError: (err: any) => alert(`Move failed: ${err.message}`),
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      fetchApi(`/api/client/servers/${uuid}/files/folder`, {
        method: 'POST',
        body: JSON.stringify({
          root: currentDirectory,
          name: name.trim(),
        }),
      }),
    onSuccess: () => {
      setIsCreatingFolder(false);
      setFolderNameInput('');
      refetch();
    },
    onError: (err: any) => alert(`Create folder failed: ${err.message}`),
  });

  // Decompress (unzip) archive mutation
  const decompressMutation = useMutation({
    mutationFn: (fileName: string) =>
      fetchApi(`/api/client/servers/${uuid}/files/decompress`, {
        method: 'POST',
        body: JSON.stringify({
          root: currentDirectory,
          file: fileName,
        }),
      }),
    onSuccess: () => {
      alert('Archive decompressed successfully.');
      refetch();
    },
    onError: (err: any) => alert(`Decompress failed: ${err.message}`),
  });

  // Compress (zip) files mutation
  const compressMutation = useMutation({
    mutationFn: (fileNames: string[]) =>
      fetchApi(`/api/client/servers/${uuid}/files/compress`, {
        method: 'POST',
        body: JSON.stringify({
          root: currentDirectory,
          files: fileNames,
        }),
      }),
    onSuccess: () => {
      setSelectedNames(new Set());
      refetch();
    },
    onError: (err: any) => alert(`Compress failed: ${err.message}`),
  });

  // Download file helper
  const handleDownloadFile = async (fileName: string) => {
    const filePath = currentDirectory === '/' ? `/${fileName}` : `${currentDirectory}/${fileName}`;
    try {
      const res = await fetch(`/api/client/servers/${uuid}/files/contents?file=${encodeURIComponent(filePath)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;
    const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f && f.size > MAX_UPLOAD_BYTES) {
        alert(`File "${f.name}" (${formatBytes(f.size)}) exceeds the 100MB maximum upload limit.`);
        return;
      }
    }

    setUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (!f) continue;
        const targetPath = currentDirectory === '/' ? `/${f.name}` : `${currentDirectory}/${f.name}`;
        const res = await fetch(`/api/client/servers/${uuid}/files/write?file=${encodeURIComponent(targetPath)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: f,
          credentials: 'include',
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Upload failed with HTTP ${res.status}`);
        }
      }
      refetch();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files);
    }
  };

  const handleOpenFile = async (file: WingsFile) => {
    if (file.directory) {
      const nextDir = currentDirectory === '/' ? `/${file.name}` : `${currentDirectory}/${file.name}`;
      setCurrentDirectory(nextDir);
    } else {
      const filePath = currentDirectory === '/' ? `/${file.name}` : `${currentDirectory}/${file.name}`;
      try {
        const text = await fetchApi<string>(
          `/api/client/servers/${uuid}/files/contents?file=${encodeURIComponent(filePath)}`,
        );
        setSelectedFile(filePath);
        setFileContent(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
        setIsEditing(true);
      } catch (err: any) {
        alert(`Failed to read file: ${err.message}`);
      }
    }
  };

  // Selection toggle
  const toggleSelect = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!files || files.length === 0) return;
    if (selectedNames.size === files.length) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(files.map((f) => f.name)));
    }
  };

  // Right-click context menu opener
  const handleContextMenu = (e: React.MouseEvent, file: WingsFile) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setContextMenu({ x, y, file });
  };

  const breadcrumbs = currentDirectory.split('/').filter(Boolean);

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentDirectory('/');
      return;
    }
    const path = '/' + breadcrumbs.slice(0, index + 1).join('/');
    setCurrentDirectory(path);
  };

  const isArchive = (name: string) => Boolean(name.match(/\.(zip|tar|tar\.gz|tgz|gz|rar)$/i));

  return (
    <div
      className="space-y-4 relative min-h-[500px]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files);
        }}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-card backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none animate-in fade-in">
          <Upload className="w-10 h-10 text-primary animate-bounce mb-2" />
          <p className="text-sm font-bold text-text-primary">Drop files here to upload</p>
          <p className="text-xs text-text-muted mt-0.5">Uploading directly to {currentDirectory}</p>
        </div>
      )}

      {/* Uploading Banner */}
      {uploading && (
        <div className="p-3 rounded-control bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Uploading file(s) to server directory...
        </div>
      )}

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-52 bg-[#0e121b] border border-border/90 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 select-none animate-in fade-in zoom-in-95 text-xs text-text-primary"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-border/50 text-[11px] font-mono text-text-muted truncate">
            {contextMenu.file.name}
          </div>

          {/* Select Toggle */}
          <button
            onClick={() => {
              toggleSelect(contextMenu.file.name);
              setContextMenu(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-elevated hover:text-primary transition-colors text-left"
          >
            {selectedNames.has(contextMenu.file.name) ? (
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Square className="w-3.5 h-3.5 text-text-muted" />
            )}
            <span>{selectedNames.has(contextMenu.file.name) ? 'Deselect' : 'Select'}</span>
          </button>

          {/* Rename */}
          <button
            onClick={() => {
              setRenamingFile(contextMenu.file);
              setRenameInput(contextMenu.file.name);
              setContextMenu(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-elevated hover:text-primary transition-colors text-left"
          >
            <Pencil className="w-3.5 h-3.5 text-text-muted" />
            <span>Rename</span>
          </button>

          {/* Move */}
          <button
            onClick={() => {
              setMovingFileNames([contextMenu.file.name]);
              setMoveDestination('');
              setIsMovingFiles(true);
              setContextMenu(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-elevated hover:text-primary transition-colors text-left"
          >
            <FolderInput className="w-3.5 h-3.5 text-text-muted" />
            <span>Move to Folder</span>
          </button>

          {/* Download (if file) */}
          {!contextMenu.file.directory && (
            <button
              onClick={() => {
                handleDownloadFile(contextMenu.file.name);
                setContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-elevated hover:text-primary transition-colors text-left"
            >
              <Download className="w-3.5 h-3.5 text-text-muted" />
              <span>Download File</span>
            </button>
          )}

          {/* Unzip / Decompress (if archive) */}
          {!contextMenu.file.directory && isArchive(contextMenu.file.name) && (
            <button
              onClick={() => {
                if (confirm(`Unzip "${contextMenu.file.name}" in ${currentDirectory}?`)) {
                  decompressMutation.mutate(contextMenu.file.name);
                }
                setContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-elevated hover:text-primary transition-colors text-left"
            >
              <FileArchive className="w-3.5 h-3.5 text-primary" />
              <span>Unzip / Decompress</span>
            </button>
          )}

          {/* Compress into Zip */}
          <button
            onClick={() => {
              compressMutation.mutate([contextMenu.file.name]);
              setContextMenu(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-elevated hover:text-primary transition-colors text-left"
          >
            <Archive className="w-3.5 h-3.5 text-text-muted" />
            <span>Compress to .zip</span>
          </button>

          {/* Copy Full Path */}
          <button
            onClick={() => {
              const fullPath = currentDirectory === '/' ? `/${contextMenu.file.name}` : `${currentDirectory}/${contextMenu.file.name}`;
              navigator.clipboard.writeText(fullPath);
              setCopiedPath(true);
              setTimeout(() => setCopiedPath(false), 2000);
              setContextMenu(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-elevated hover:text-primary transition-colors text-left"
          >
            <Copy className="w-3.5 h-3.5 text-text-muted" />
            <span>Copy Path</span>
          </button>

          <div className="border-t border-border/50 my-0.5" />

          {/* Delete */}
          <button
            onClick={() => {
              if (confirm(`Delete "${contextMenu.file.name}"?`)) {
                deleteMutation.mutate([contextMenu.file.name]);
              }
              setContextMenu(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors text-left font-medium"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Create Folder Modal */}
      {isCreatingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-surface border border-border rounded-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <FolderPlus className="w-4 h-4 text-primary" />
                <span>Create New Folder</span>
              </div>
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (folderNameInput.trim()) {
                  createFolderMutation.mutate(folderNameInput.trim());
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs text-text-secondary font-medium block mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  placeholder="e.g. plugins, config, worlds"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Creating directory inside: <code className="text-primary font-mono">{currentDirectory}</code>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreatingFolder(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createFolderMutation.isPending || !folderNameInput.trim()}
                >
                  {createFolderMutation.isPending ? 'Creating...' : 'Create Folder'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renamingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-surface border border-border rounded-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <Pencil className="w-4 h-4 text-primary" />
                <span>Rename {renamingFile.directory ? 'Folder' : 'File'}</span>
              </div>
              <button
                onClick={() => setRenamingFile(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (renameInput.trim() && renameInput.trim() !== renamingFile.name) {
                  renameMutation.mutate({ from: renamingFile.name, to: renameInput.trim() });
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs text-text-secondary font-medium block mb-1">
                  New Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRenamingFile(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={renameMutation.isPending || !renameInput.trim() || renameInput.trim() === renamingFile.name}
                >
                  {renameMutation.isPending ? 'Renaming...' : 'Save Name'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Files Modal */}
      {isMovingFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <FolderInput className="w-4 h-4 text-primary" />
                <span>Move {movingFileNames.length} {movingFileNames.length === 1 ? 'Item' : 'Items'}</span>
              </div>
              <button
                onClick={() => setIsMovingFiles(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (movingFileNames.length > 0 && moveDestination.trim()) {
                  moveFilesMutation.mutate({
                    fileNames: movingFileNames,
                    destination: moveDestination,
                  });
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs text-text-secondary font-medium block mb-1">
                  Target Destination Directory
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={moveDestination}
                  onChange={(e) => setMoveDestination(e.target.value)}
                  placeholder="e.g. /plugins, /config, or .. (parent folder)"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-text-muted mt-1.5">
                  Current directory: <code className="text-primary font-mono">{currentDirectory}</code>
                </p>
              </div>

              {/* Quick Destination Suggestions */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-text-muted block">
                  Quick Folder Targets
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {currentDirectory !== '/' && (
                    <button
                      type="button"
                      onClick={() => setMoveDestination('..')}
                      className="px-2 py-1 rounded bg-surface-elevated hover:bg-primary/20 hover:text-primary text-[11px] font-mono text-text-secondary border border-border transition-colors flex items-center gap-1"
                    >
                      <Folder className="w-3 h-3 text-amber-400" /> .. (Up one level)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMoveDestination('/')}
                    className="px-2 py-1 rounded bg-surface-elevated hover:bg-primary/20 hover:text-primary text-[11px] font-mono text-text-secondary border border-border transition-colors flex items-center gap-1"
                  >
                    <Folder className="w-3 h-3 text-primary" /> / (Root)
                  </button>
                  {files?.filter((f) => f.directory && !movingFileNames.includes(f.name)).map((folder) => {
                    const targetFolder = currentDirectory === '/' ? `/${folder.name}` : `${currentDirectory}/${folder.name}`;
                    return (
                      <button
                        key={folder.name}
                        type="button"
                        onClick={() => setMoveDestination(targetFolder)}
                        className="px-2 py-1 rounded bg-surface-elevated hover:bg-primary/20 hover:text-primary text-[11px] font-mono text-text-secondary border border-border transition-colors flex items-center gap-1"
                      >
                        <Folder className="w-3 h-3 text-cyan-400" /> {folder.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Items Preview */}
              <div className="p-2.5 rounded-control bg-surface-elevated/60 border border-border/70 max-h-24 overflow-y-auto">
                <span className="text-[10px] text-text-muted uppercase font-semibold block mb-1">
                  Files to be moved:
                </span>
                <div className="flex flex-wrap gap-1">
                  {movingFileNames.map((name) => (
                    <span
                      key={name}
                      className="px-1.5 py-0.5 rounded bg-surface text-[10px] font-mono text-text-primary border border-border truncate max-w-[200px]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMovingFiles(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={moveFilesMutation.isPending || !moveDestination.trim()}
                  className="gap-1.5"
                >
                  <FolderInput className="w-3.5 h-3.5" />
                  {moveFilesMutation.isPending ? 'Moving...' : 'Move Items'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-card shadow-2xl flex flex-col h-[80vh] overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-surface-elevated">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary" />
                <span className="font-mono text-xs font-semibold text-text-primary">
                  {selectedFile}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveMutation.isPending ? 'Saving...' : 'Save File'}
                </Button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-surface"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="flex-1 p-4 bg-[#090909] text-text-primary font-mono text-xs resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* Action Bar & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface border border-border rounded-card p-3.5">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs font-mono overflow-x-auto">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className="text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 shrink-0"
          >
            <Folder className="w-3.5 h-3.5 text-primary" /> /root
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <button
                onClick={() => navigateToBreadcrumb(idx)}
                className={`hover:text-text-primary transition-colors shrink-0 ${
                  idx === breadcrumbs.length - 1 ? 'text-text-primary font-semibold' : 'text-text-muted'
                }`}
              >
                {crumb}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCreatingFolder(true)}
            title="Create New Folder"
            className="gap-1.5"
          >
            <FolderPlus className="w-3.5 h-3.5 text-primary" /> Create Folder
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const name = prompt('Enter new file name:');
              if (name && name.trim()) {
                const path = currentDirectory === '/' ? `/${name.trim()}` : `${currentDirectory}/${name.trim()}`;
                setSelectedFile(path);
                setFileContent('');
                setIsEditing(true);
              }
            }}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New File
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Files (Up to 100MB)"
            className="gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            title="Refresh Directory"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Multi-Selection Batch Actions Floating Bar */}
      {selectedNames.size > 0 && (
        <div className="p-3 bg-surface border border-primary/40 rounded-card flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <CheckSquare className="w-4 h-4 text-primary" />
            <span>
              {selectedNames.size} {selectedNames.size === 1 ? 'item' : 'items'} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMovingFileNames(Array.from(selectedNames));
                setMoveDestination('');
                setIsMovingFiles(true);
              }}
              className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
            >
              <FolderInput className="w-3.5 h-3.5" /> Move Selected ({selectedNames.size})
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => compressMutation.mutate(Array.from(selectedNames))}
              disabled={compressMutation.isPending}
              className="gap-1.5 text-xs"
            >
              <Archive className="w-3.5 h-3.5" /> Compress (.zip)
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (confirm(`Delete ${selectedNames.size} selected item(s)?`)) {
                  deleteMutation.mutate(Array.from(selectedNames));
                }
              }}
              disabled={deleteMutation.isPending}
              className="gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/30"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Selected
            </Button>

            <button
              onClick={() => setSelectedNames(new Set())}
              className="p-1.5 text-text-muted hover:text-text-primary text-xs ml-1"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* File Browser Table with Right Click Support */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading directory contents...</div>
        ) : (files || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            This directory is empty. Drop files here, create a folder, or use Upload to add files.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted select-none">
              <tr>
                <th className="w-10 px-4 py-3 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-text-muted hover:text-primary transition-colors"
                    title={selectedNames.size === files?.length ? 'Deselect All' : 'Select All'}
                  >
                    {selectedNames.size > 0 && selectedNames.size === files?.length ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-3">Name</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3">Modified</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {files?.map((file) => {
                const isSelected = selectedNames.has(file.name);
                return (
                  <tr
                    key={file.name}
                    className={`transition-colors group cursor-pointer ${
                      isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-elevated/30'
                    }`}
                    onClick={() => handleOpenFile(file)}
                    onContextMenu={(e) => handleContextMenu(e, file)}
                  >
                    <td
                      className="w-10 px-4 py-3 text-center"
                      onClick={(e) => toggleSelect(file.name, e)}
                    >
                      <button className="text-text-muted hover:text-primary transition-colors">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 group-hover:text-text-secondary" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-3 flex items-center gap-2.5 font-medium text-text-primary">
                      {file.directory ? (
                        <Folder className="w-4 h-4 text-primary fill-primary/10 shrink-0" />
                      ) : isArchive(file.name) ? (
                        <FileArchive className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-text-muted shrink-0" />
                      )}
                      <span className="group-hover:text-primary transition-colors truncate">
                        {file.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-text-secondary text-[11px] whitespace-nowrap">
                      {file.directory ? '-' : formatBytes(file.size)}
                    </td>
                    <td className="px-5 py-3 font-mono text-text-muted text-[11px] whitespace-nowrap">
                      {new Date(file.modified).toLocaleDateString()}
                    </td>
                    <td
                      className="px-5 py-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {/* Download button for files */}
                        {!file.directory && (
                          <button
                            onClick={() => handleDownloadFile(file.name)}
                            className="p-1.5 text-text-muted hover:text-primary transition-colors rounded hover:bg-surface-elevated"
                            title="Download File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Unzip Archive Action */}
                        {!file.directory && isArchive(file.name) && (
                          <button
                            onClick={() => {
                              if (confirm(`Unzip / Decompress "${file.name}" in current directory?`)) {
                                decompressMutation.mutate(file.name);
                              }
                            }}
                            className="p-1.5 text-text-muted hover:text-primary transition-colors rounded hover:bg-surface-elevated"
                            title="Unzip / Decompress Archive"
                          >
                            <FileArchive className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Rename Action */}
                        <button
                          onClick={() => {
                            setRenamingFile(file);
                            setRenameInput(file.name);
                          }}
                          className="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded hover:bg-surface-elevated"
                          title="Rename"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Action */}
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${file.name}?`)) {
                              deleteMutation.mutate([file.name]);
                            }
                          }}
                          className="p-1.5 text-text-muted hover:text-status-error transition-colors rounded hover:bg-surface-elevated"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
