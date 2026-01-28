import React, { useEffect, useState } from 'react';
import {
  UsageHistoryEntry,
  ProviderAccentColors,
  DEFAULT_PROVIDER_COLORS,
  IconSettings,
} from '../types';
import { getStyles } from '../theme';
import { UsageDetails } from './UsageDetails';

const DEFAULT_PROVIDER_ORDER = [
  'codex',
  'claude',
  'gemini',
  'external_models',
  'z_ai',
];

const PROVIDER_LABELS: Record<string, string> = {
  z_ai: 'Z.ai',
  claude: 'Claude',
  codex: 'ChatGPT Codex',
  gemini: 'Gemini (AG)',
  external_models: 'Gemini External (AG)',
};

export const UsageDetailsWindow = () => {
  const [usageHistory, setUsageHistory] = useState<UsageHistoryEntry[]>([]);
  const [activeProviders, setActiveProviders] = useState<string[]>([]);
  const [providerOrder, setProviderOrder] = useState<string[]>(
    DEFAULT_PROVIDER_ORDER
  );
  const [providerColors, setProviderColors] = useState<ProviderAccentColors>(
    DEFAULT_PROVIDER_COLORS
  );
  const [iconSettings, setIconSettings] = useState<IconSettings | null>(null);

  useEffect(() => {
    const loadUsageHistory = async () => {
      const history = await window.electronAPI.getUsageHistory();
      setUsageHistory(history);
    };
    loadUsageHistory();

    const unsubscribe = window.electronAPI.onUsageUpdate((_event, data) => {
      window.electronAPI
        .getUsageHistory()
        .then(setUsageHistory)
        .catch(console.error);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadIconSettings = async () => {
      const settings = await window.electronAPI.getIconSettings();
      setIconSettings(settings);
    };
    loadIconSettings();
  }, []);

  useEffect(() => {
    const loadProviderOrder = async () => {
      const order = await window.electronAPI.getProviderOrder();
      if (order && Array.isArray(order) && order.length > 0) {
        setProviderOrder(order);
      }
    };
    loadProviderOrder();
  }, []);

  useEffect(() => {
    const fetchActiveProviders = async () => {
      const status = await window.electronAPI.getProviderStatus();
      const active = Object.entries(status)
        .filter(([, connected]) => connected)
        .map(([provider]) => provider);
      setActiveProviders(active);
    };
    fetchActiveProviders();

    const unsubscribeConnect = window.electronAPI.onProviderConnected(() =>
      fetchActiveProviders()
    );
    const unsubscribeDisconnect = window.electronAPI.onProviderDisconnected(
      () => fetchActiveProviders()
    );

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
    };
  }, []);

  useEffect(() => {
    const loadProviderColors = async () => {
      const colors = await window.electronAPI.getProviderAccentColors();
      setProviderColors(colors);
    };
    loadProviderColors();
  }, []);

  const getOrderedProviders = (providers: string[]) => {
    const order =
      providerOrder.length > 0 ? providerOrder : DEFAULT_PROVIDER_ORDER;
    const orderIndex = new Map(order.map((key, index) => [key, index]));

    return [...providers].sort((a, b) => {
      const indexA = orderIndex.get(a);
      const indexB = orderIndex.get(b);

      if (indexA === undefined && indexB === undefined) {
        return (PROVIDER_LABELS[a] || a).localeCompare(PROVIDER_LABELS[b] || b);
      }
      if (indexA === undefined) return 1;
      if (indexB === undefined) return -1;
      return indexA - indexB;
    });
  };

  const providersInHistory = Array.from(
    new Set(usageHistory.map((h) => h.provider))
  );

  const displayProviders = getOrderedProviders(
    Array.from(new Set([...activeProviders, ...providersInHistory]))
  );

  const glassMode = iconSettings?.glassMode ?? true;
  const styles = getStyles(glassMode);

  return (
    <div style={styles.container}>
      <UsageDetails
        data={usageHistory}
        activeProviders={displayProviders}
        providerColors={providerColors}
        glassMode={glassMode}
        onBack={() => {
          window.close();
        }}
      />
    </div>
  );
};
