import React, { useEffect, useState } from 'react';
import { UsageHistoryEntry } from '../types';
import { styles, theme } from '../theme';
import { UsageDetails } from './UsageDetails';

export const UsageDetailsWindow = () => {
  const [usageHistory, setUsageHistory] = useState<UsageHistoryEntry[]>([]);

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

  return (
    <div style={styles.container}>
      <UsageDetails
        data={usageHistory}
        onBack={() => {
          window.close();
        }}
      />
    </div>
  );
};
