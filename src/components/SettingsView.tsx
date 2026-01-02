import React from 'react';
import { ProviderData, UpdateStatusData, IconSettings } from '../types';
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
  iconSettings: IconSettings;
  onIconSettingsChange: (settings: IconSettings) => void;
  onCommandChange: (key: string, command: string) => void;
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
  iconSettings,
  onIconSettingsChange,
  onCommandChange,
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
          <div
            key={key}
            style={{
              ...styles.settingRow,
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: '8px',
            }}
          >
            <div style={styles.settingRow}>
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
                <button
                  onClick={() => onConnect(key)}
                  style={styles.connectBtn}
                >
                  Connect
                </button>
              )}
            </div>
            <div
              style={{
                paddingTop: '4px',
              }}
            >
              <input
                type="text"
                value={data.command || ''}
                placeholder="CLI command (e.g., claude x)"
                onChange={(e) => onCommandChange(key, e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: theme.card,
                  color: theme.textMain,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={styles.settingsSection}>
        <div style={styles.sectionTitle}>Icon Appearance</div>
        <div
          style={styles.settingRow}
          title="Icon turns yellow when usage reaches this %"
        >
          <span style={styles.settingLabel}>Warning Threshold (%) ⓘ</span>
          <input
            type="number"
            min="0"
            max="100"
            value={iconSettings.thresholdWarning}
            onChange={(e) =>
              onIconSettingsChange({
                ...iconSettings,
                thresholdWarning: parseInt(e.target.value) || 0,
              })
            }
            style={{
              backgroundColor: theme.card,
              color: theme.textMain,
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              padding: '4px 8px',
              width: '60px',
              fontSize: '13px',
            }}
          />
        </div>
        <div
          style={styles.settingRow}
          title="Icon turns red when usage reaches this %"
        >
          <span style={styles.settingLabel}>Critical Threshold (%) ⓘ</span>
          <input
            type="number"
            min="0"
            max="100"
            value={iconSettings.thresholdCritical}
            onChange={(e) =>
              onIconSettingsChange({
                ...iconSettings,
                thresholdCritical: parseInt(e.target.value) || 0,
              })
            }
            style={{
              backgroundColor: theme.card,
              color: theme.textMain,
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              padding: '4px 8px',
              width: '60px',
              fontSize: '13px',
            }}
          />
        </div>
      </div>

      <div style={styles.settingsSection}>
        <div style={styles.sectionTitle}>Debug Logs</div>
        <button
          onClick={() => {
            if (window.electronAPI.openDebugWindow) {
              window.electronAPI.openDebugWindow();
            }
          }}
          style={styles.connectBtn}
        >
          Show Debug Logs
        </button>
      </div>
    </div>
  );
};
