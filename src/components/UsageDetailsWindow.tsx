import React, { useEffect, useState } from 'react';
import {
  UsageHistoryEntry,
  ProviderAccentColors,
  DEFAULT_PROVIDER_COLORS,
} from '../types';
import { styles, theme } from '../theme';
import { UsageDetails } from './UsageDetails';

export const UsageDetailsWindow = () => {
  const [usageHistory, setUsageHistory] = useState<UsageHistoryEntry[]>([]);
  const [activeProviders, setActiveProviders] = useState<string[]>([]);
  const [providerColors, setProviderColors] = useState<ProviderAccentColors>(
    DEFAULT_PROVIDER_COLORS
  );

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

  return (
    <div style={styles.container}>
      <UsageDetails
        data={usageHistory}
        activeProviders={activeProviders}
        providerColors={providerColors}
        onBack={() => {
          window.close();
        }}
      />
    </div>
  );
};
