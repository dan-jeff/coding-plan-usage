import React from 'react';
import { ProviderData } from '../types';
import { styles, theme } from '../theme';

interface SettingsViewProps {
  autoLaunch: boolean;
  handleAutoLaunchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  refreshInterval: number;
  handleRefreshIntervalChange: (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => void;
  providers: { [key: string]: ProviderData };
  onConnect: (key: string) => void;
  onReconnect: (key: string) => void;
}

export const SettingsView = ({
  autoLaunch,
  handleAutoLaunchChange,
  refreshInterval,
  handleRefreshIntervalChange,
  providers,
  onConnect,
  onReconnect,
}: SettingsViewProps) => {
  return (
    <div>
      <div style={styles.settingsSection}>
        <div style={styles.sectionTitle}>General</div>
        <div style={styles.settingRow}>
          <span style={styles.settingLabel}>Start on Startup</span>
          <input
            type="checkbox"
            checked={autoLaunch}
            onChange={handleAutoLaunchChange}
            style={styles.checkbox}
          />
        </div>
      </div>

      <div style={styles.settingsSection}>
        <div style={styles.sectionTitle}>Polling</div>
        <div style={styles.settingRow}>
          <span style={styles.settingLabel}>Refresh Interval</span>
          <select
            value={refreshInterval}
            onChange={handleRefreshIntervalChange}
            style={{
              backgroundColor: theme.card, // Match card bg
              color: theme.textMain,
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              padding: '4px 8px',
              outline: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              minWidth: '80px',
            }}
          >
            <option value={1}>1 min</option>
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
      </div>

      <div style={styles.settingsSection}>
        <div style={styles.sectionTitle}>Providers</div>
        {Object.entries(providers).map(([key, data]) => (
          <div key={key} style={styles.settingRow}>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
              <span style={styles.settingLabel}>{data.label}</span>
              <span
                style={{
                  fontSize: '11px',
                  color: data.connected ? theme.accentGreen : theme.textSec,
                }}
              >
                {data.connected ? 'Active' : 'Offline'}
              </span>
            </div>
            {data.connected ? (
              <button
                onClick={() => onReconnect(key)}
                style={styles.reconnectBtn}
              >
                Reconnect
              </button>
            ) : (
              <button onClick={() => onConnect(key)} style={styles.connectBtn}>
                Connect
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
