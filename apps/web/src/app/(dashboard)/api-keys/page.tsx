'use client';

import React, { useState } from 'react';
import { Key, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

export default function ApiKeysPage() {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState('');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Account API Keys
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage personal API tokens for automating tasks with the Obsidian Client API
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Create API Key
        </Button>
      </div>

      <div className="border border-border/80 border-dashed rounded-card p-12 text-center bg-surface/30">
        <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted mx-auto mb-3">
          <Key className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary">No API keys yet</h3>
        <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-4">
          API keys allow programmatic access to your game servers and operations without exposing your web session.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
          <Plus className="w-3.5 h-3.5" /> Generate First Key
        </Button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Create API Key</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-secondary font-medium block mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Discord Bot or Backup Script"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  alert('API Key creation.');
                  setShowModal(false);
                }}
              >
                Create Key
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
