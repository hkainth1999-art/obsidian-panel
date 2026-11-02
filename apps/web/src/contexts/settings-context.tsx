'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';

interface SettingsContextType {
  panelName: string;
  accentColor: string;
  allowRegistration: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  panelName: 'Obsidian Panel',
  accentColor: '#06B6D4',
  allowRegistration: false,
  refreshSettings: async () => {},
});

// Helper to compute a darker hover shade from a hex color
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) return hex;
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [panelName, setPanelName] = useState('Obsidian Panel');
  const [accentColor, setAccentColor] = useState('#06B6D4');
  const [allowRegistration, setAllowRegistration] = useState(false);

  const applyTheme = (color: string) => {
    if (typeof document !== 'undefined' && color) {
      const hoverColor = adjustColor(color, -18);
      document.documentElement.style.setProperty('--color-primary', color);
      document.documentElement.style.setProperty('--color-primary-hover', hoverColor);
    }
  };

  const refreshSettings = async () => {
    try {
      const res = await fetchApi<any>('/api/settings/public');
      if (res) {
        if (res.panelName) {
          setPanelName(res.panelName);
          if (typeof document !== 'undefined') {
            document.title = res.panelName;
          }
        }
        if (res.accentColor) {
          setAccentColor(res.accentColor);
          applyTheme(res.accentColor);
        }
        if (res.allowRegistration !== undefined) {
          setAllowRegistration(Boolean(res.allowRegistration));
        }
      }
    } catch {
      // Keep defaults
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        panelName,
        accentColor,
        allowRegistration,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

