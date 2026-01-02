import React from 'react';
import { ProviderData, UpdateStatusData, LogEntry } from '../types';
import { styles, theme } from '../theme';

interface SettingsViewProps {
  autoLaunch: boolean;
  handleAutoLaunchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoUpdate: boolean;
  handleAutoUpdateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  appVersion: string;
  refreshInterval: number;
  handleRefreshIntervalChange: (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => void;
  providers: { [key: string]: ProviderData };
  onConnect: (key: string) => void;
  onReconnect: (key: string) => void;
  onDisconnect: (key: string) => void;
  updateStatus: UpdateStatusData['type'] | 'idle';
  updateMessage: string;
  updateProgress: number;
  onCheckUpdate: () => void;
  onQuitAndInstall: () => void;
  logs: LogEntry[];
  onRefreshLogs: () => void;
  onClearLogs: () => void;
}

export const SettingsView = ({
  autoLaunch,
  handleAutoLaunchChange,
  autoUpdate,
  handleAutoUpdateChange,
  appVersion,
  refreshInterval,
  handleRefreshIntervalChange,
  providers,
  onConnect,
  onReconnect,
  onDisconnect,
  updateStatus,
  updateMessage,
  updateProgress,
  onCheckUpdate,
  onQuitAndInstall,
  logs,
  onRefreshLogs,
  onClearLogs,
}: SettingsViewProps) => {
  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return '#ef4444';
      case 'warn':
        return '#f59e0b';
      case 'info':
        return '#22c55e';
      case 'debug':
        return '#6b7280';
    }
  };

  const handleCopyLogs = () => {
    const logText = logs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(logText);
  };

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
        <div style={styles.settingRow}>
          <span style={styles.settingLabel}>Auto Update</span>
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={handleAutoUpdateChange}
            style={styles.checkbox}
          />
        </div>
        {appVersion && (
          <div style={styles.settingRow}>
            <span style={styles.settingLabel}>Version</span>
            <span style={{ color: theme.textSec, fontSize: '13px' }}>
              {appVersion}
            </span>
          </div>
        )}
        <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={styles.settingLabel}>Check for Updates</span>
            {updateMessage && (
              <span
                style={{
                  fontSize: '11px',
                  color:
                    updateStatus === 'error'
                      ? theme.accentRed
                      : updateStatus === 'available' ||
                          updateStatus === 'downloaded'
                        ? theme.accentGreen
                        : theme.textSec,
                }}
              >
                {updateMessage}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (
                updateStatus === 'idle' ||
                updateStatus === 'error' ||
                updateStatus === 'not-available'
              ) {
                onCheckUpdate();
              } else if (updateStatus === 'downloaded') {
                onQuitAndInstall();
              }
            }}
            disabled={
              updateStatus === 'checking' || updateStatus === 'downloading'
            }
            style={{
              ...styles.connectBtn,
              opacity:
                updateStatus === 'checking' || updateStatus === 'downloading'
                  ? 0.6
                  : 1,
              backgroundColor:
                updateStatus === 'downloaded'
                  ? theme.accentGreen
                  : styles.connectBtn.backgroundColor,
              cursor:
                updateStatus === 'checking' || updateStatus === 'downloading'
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {updateStatus === 'checking'
              ? 'Checking...'
              : updateStatus === 'downloading'
                ? `Downloading... ${Math.round(updateProgress)}%`
                : updateStatus === 'downloaded'
                  ? 'Restart & Install'
                  : 'Check for Updates'}
          </button>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onReconnect(key)}
                  style={styles.reconnectBtn}
                >
                  Reconnect
                </button>
                <button
                  onClick={() => onDisconnect(key)}
                  style={{
                    ...styles.reconnectBtn,
                    color: theme.accentRed,
                    borderColor: theme.accentRed,
                  }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={() => onConnect(key)} style={styles.connectBtn}>
                Connect
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={styles.settingsSection}>
        <div style={styles.sectionTitle}>Debug Logs</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            onClick={onRefreshLogs}
            style={{
              ...styles.connectBtn,
              padding: '6px 12px',
              fontSize: '12px',
            }}
          >
            Refresh
          </button>
          <button
            onClick={handleCopyLogs}
            style={{
              ...styles.connectBtn,
              padding: '6px 12px',
              fontSize: '12px',
            }}
          >
            Copy to Clipboard
          </button>
          <button
            onClick={onClearLogs}
            style={{
              ...styles.connectBtn,
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: theme.accentRed,
            }}
          >
            Clear
          </button>
        </div>
        <div
          style={{
            backgroundColor: '#2a2a3c',
            color: '#e0e0e0',
            fontFamily: 'monospace',
            fontSize: '12px',
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '8px',
            borderRadius: '6px',
            border: `1px solid ${theme.border}`,
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: theme.textSec, fontStyle: 'italic' }}>
              No logs available
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              {logs.map((log, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: theme.textSec, minWidth: '160px' }}>
                    {log.timestamp}
                  </span>
                  <span
                    style={{
                      color: getLogColor(log.level),
                      minWidth: '60px',
                      fontWeight: 'bold',
                    }}
                  >
                    [{log.level.toUpperCase()}]
                  </span>
                  <span style={{ wordBreak: 'break-word' }}>{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          style={{ marginTop: '6px', fontSize: '12px', color: theme.textSec }}
        >
          Showing {logs.length} {logs.length === 1 ? 'log' : 'logs'}
        </div>
      </div>
    </div>
  );
};
