import React from 'react';
import {
  ProviderData,
  UpdateStatusData,
  IconSettings,
  ProviderAccentColors,
  ProviderPeriodCustomization,
} from '../types';
import { getStyles, getTheme } from '../theme';

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
  orderedProviders: [string, ProviderData][];
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
  providerColors: ProviderAccentColors;
  onProviderColorChange: (provider: string, color: string) => Promise<void>;
  onProviderColorReset: (provider: string) => Promise<void>;
  periodCustomizations: ProviderPeriodCustomization[];
  onPeriodCustomizationChange: (
    provider: string,
    metricLabel: string,
    durationMinutes: number | null
  ) => void;
  onResetAllPeriodCustomizations: () => void;
}

export const SettingsView = ({
  autoLaunch,
  handleAutoLaunchChange,
  autoUpdate,
  handleAutoUpdateChange,
  appVersion,
  refreshInterval,
  handleRefreshIntervalChange,
  orderedProviders,
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
  providerColors,
  onProviderColorChange,
  onProviderColorReset,
  periodCustomizations,
  onPeriodCustomizationChange,
  onResetAllPeriodCustomizations,
}: SettingsViewProps) => {
  const styles = getStyles(iconSettings.glassMode);
  const theme = getTheme(iconSettings.glassMode);

  const getCustomDuration = (
    provider: string,
    metricLabel: string
  ): number | undefined => {
    const custom = periodCustomizations.find(
      (c) => c.provider === provider && c.metricLabel === metricLabel
    );
    return custom?.totalDurationMinutes;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 120) {
      return `${minutes} min`;
    } else if (minutes < 10080) {
      const hours = Math.round(minutes / 60);
      return `${hours}h`;
    } else {
      const days = Math.round(minutes / 1440);
      return `${days}d`;
    }
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
        <div style={styles.settingRow}>
          <span style={styles.settingLabel}>Graph History Period</span>
          <select
            value={iconSettings.historyPeriod}
            onChange={(e) =>
              onIconSettingsChange({
                ...iconSettings,
                historyPeriod: e.target.value as 'week' | 'month' | 'all',
              })
            }
            style={{
              backgroundColor: theme.glassBg,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: theme.textMain,
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: '6px',
              padding: '4px 8px',
              outline: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              minWidth: '80px',
            }}
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <div style={styles.settingRow}>
          <span style={styles.settingLabel}>Glassy UI (Translucent)</span>
          <input
            type="checkbox"
            checked={iconSettings.glassMode}
            onChange={(e) =>
              onIconSettingsChange({
                ...iconSettings,
                glassMode: e.target.checked,
              })
            }
            style={styles.checkbox}
          />
        </div>
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
        {orderedProviders.map(([key, data]) => (
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
              {key === 'gemini' || key === 'external_models' ? (
                <span
                  style={{
                    fontSize: '11px',
                    color: theme.textSec,
                    fontStyle: 'italic',
                  }}
                >
                  Requires Antigravity running
                </span>
              ) : data.connected ? (
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
                disabled={key === 'gemini' || key === 'external_models'}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor:
                    key === 'gemini' || key === 'external_models'
                      ? 'transparent'
                      : theme.glassBg,
                  backdropFilter:
                    key === 'gemini' || key === 'external_models'
                      ? 'none'
                      : 'blur(10px)',
                  WebkitBackdropFilter:
                    key === 'gemini' || key === 'external_models'
                      ? 'none'
                      : 'blur(10px)',
                  color:
                    key === 'gemini' || key === 'external_models'
                      ? theme.textSec
                      : theme.textMain,
                  border:
                    key === 'gemini' || key === 'external_models'
                      ? 'none'
                      : `1px solid ${theme.glassBorder}`,
                  borderRadius: '6px',
                  padding:
                    key === 'gemini' || key === 'external_models'
                      ? '0'
                      : '8px 10px',
                  fontSize: '12px',
                  outline: 'none',
                  cursor:
                    key === 'gemini' || key === 'external_models'
                      ? 'default'
                      : 'text',
                }}
              />
              {(key === 'gemini' || key === 'external_models') && (
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.textSec,
                    marginTop: '4px',
                  }}
                >
                  Requires Antigravity running to sync usage
                </div>
              )}
            </div>
            <div
              style={{ ...styles.settingRow, gap: '8px', paddingTop: '4px' }}
            >
              <span style={styles.settingLabel}>Accent color</span>
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <input
                  type="color"
                  value={
                    providerColors?.[key as keyof typeof providerColors] ||
                    '#000000'
                  }
                  onChange={(e) => onProviderColorChange?.(key, e.target.value)}
                  style={{
                    width: '32px',
                    height: '32px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                  }}
                />
                <button
                  onClick={() => onProviderColorReset?.(key)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: 'transparent',
                    color: theme.textSec,
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
            {key === 'codex' && (
              <div
                style={{ ...styles.settingRow, gap: '8px', paddingTop: '4px' }}
              >
                <span style={styles.settingLabel}>Show Code Review (PRs)</span>
                <input
                  type="checkbox"
                  checked={iconSettings.showCodeReview}
                  onChange={(e) =>
                    onIconSettingsChange({
                      ...iconSettings,
                      showCodeReview: e.target.checked,
                    })
                  }
                  style={styles.checkbox}
                />
              </div>
            )}
            {data.details &&
              data.details.length > 0 &&
              data.details.some(
                (d) => d.timeRemainingMinutes || d.totalDurationMinutes
              ) && (
                <div
                  style={{
                    ...styles.settingRow,
                    gap: '8px',
                    paddingTop: '4px',
                  }}
                >
                  <span
                    style={{
                      ...styles.settingLabel,
                      fontSize: '11px',
                      textTransform: 'none',
                    }}
                  >
                    Period Customizations
                  </span>
                </div>
              )}
            {data.details &&
              data.details.length > 0 &&
              data.details.map((detail, idx) => {
                if (
                  !detail.timeRemainingMinutes &&
                  !detail.totalDurationMinutes
                )
                  return null;

                const customDuration = getCustomDuration(key, detail.label);
                const apiDefault = detail.totalDurationMinutes;
                const hasCustom = customDuration !== undefined;

                return (
                  <div
                    key={idx}
                    style={{
                      ...styles.settingRow,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: '6px',
                      padding: '10px 12px',
                      backgroundColor: hasCustom
                        ? 'rgba(245, 158, 11, 0.1)'
                        : undefined,
                      border: hasCustom
                        ? `1px solid ${theme.accentYellow}`
                        : `1px solid ${theme.glassBorder}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: theme.textMain,
                        }}
                      >
                        {detail.label}
                      </span>
                      {hasCustom && (
                        <span
                          style={{
                            fontSize: '10px',
                            color: theme.accentYellow,
                            fontWeight: 600,
                          }}
                        >
                          CUSTOM: {formatDuration(customDuration)}
                        </span>
                      )}
                    </div>

                    {apiDefault && (
                      <div style={{ fontSize: '10px', color: theme.textSec }}>
                        API default: {formatDuration(apiDefault)}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: '4px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {[60, 360, 720, 1440, 2880, 4320, 10080].map((mins) => (
                          <button
                            key={mins}
                            onClick={() =>
                              onPeriodCustomizationChange(
                                key,
                                detail.label,
                                mins
                              )
                            }
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border:
                                customDuration === mins
                                  ? `1px solid ${theme.accentGreen}`
                                  : `1px solid ${theme.border}`,
                              backgroundColor:
                                customDuration === mins
                                  ? theme.accentGreen
                                  : 'transparent',
                              color:
                                customDuration === mins
                                  ? '#000'
                                  : theme.textSec,
                              cursor: 'pointer',
                              fontSize: '10px',
                              fontWeight: customDuration === mins ? 600 : 400,
                              transition: 'all 0.2s',
                            }}
                          >
                            {formatDuration(mins)}
                          </button>
                        ))}
                      </div>

                      <div style={{ flexGrow: 1 }} />

                      <button
                        onClick={() =>
                          onPeriodCustomizationChange(
                            key,
                            detail.label,
                            apiDefault || 300
                          )
                        }
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: 'transparent',
                          color: theme.textSec,
                          cursor: 'pointer',
                          fontSize: '10px',
                        }}
                      >
                        Use API
                      </button>

                      <button
                        onClick={() =>
                          onPeriodCustomizationChange(key, detail.label, null)
                        }
                        disabled={!hasCustom}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: 'transparent',
                          color: hasCustom ? theme.accentRed : theme.textSec,
                          cursor: hasCustom ? 'pointer' : 'not-allowed',
                          fontSize: '10px',
                          opacity: hasCustom ? 1 : 0.5,
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      <div style={styles.settingsSection}>
        <div style={styles.sectionTitle}>Period Customization Management</div>
        {periodCustomizations.length > 0 && (
          <button
            onClick={onResetAllPeriodCustomizations}
            style={{
              ...styles.reconnectBtn,
              color: theme.accentRed,
              borderColor: theme.accentRed,
              width: '100%',
              padding: '10px 16px',
              fontSize: '13px',
            }}
          >
            Reset All Period Customizations ({periodCustomizations.length})
          </button>
        )}
        {periodCustomizations.length === 0 && (
          <div
            style={{
              padding: '12px',
              fontSize: '12px',
              color: theme.textSec,
              textAlign: 'center',
            }}
          >
            No custom periods set. All metrics use API defaults.
          </div>
        )}
      </div>

      <div style={styles.settingsSection}>
        <div style={styles.sectionTitle}>Icon Appearance</div>
        <div
          style={styles.settingRow}
          title="Standard: Color based on total usage. Rate: Color based on consumption rate."
        >
          <span style={styles.settingLabel}>Coloring Mode ⓘ</span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <input
                type="radio"
                name="coloringMode"
                value="standard"
                checked={iconSettings.coloringMode === 'standard'}
                onChange={() =>
                  onIconSettingsChange({
                    ...iconSettings,
                    coloringMode: 'standard',
                  })
                }
                style={styles.checkbox}
              />
              Standard (Absolute %)
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <input
                type="radio"
                name="coloringMode"
                value="rate"
                checked={iconSettings.coloringMode === 'rate'}
                onChange={() =>
                  onIconSettingsChange({
                    ...iconSettings,
                    coloringMode: 'rate',
                  })
                }
                style={styles.checkbox}
              />
              Consumption Rate
            </label>
          </div>
        </div>
        {iconSettings.coloringMode === 'standard' ? (
          <>
            <div
              style={{
                ...styles.settingRow,
                transition: 'opacity 0.2s ease',
              }}
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
                  backgroundColor: theme.glassBg,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: theme.textMain,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: '6px',
                  padding: '4px 8px',
                  width: '60px',
                  fontSize: '13px',
                }}
              />
            </div>
            <div
              style={{
                ...styles.settingRow,
                transition: 'opacity 0.2s ease',
              }}
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
                  backgroundColor: theme.glassBg,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: theme.textMain,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: '6px',
                  padding: '4px 8px',
                  width: '60px',
                  fontSize: '13px',
                }}
              />
            </div>
          </>
        ) : (
          <div
            style={styles.settingRow}
            title="Noise floor: Only apply rate-based coloring when both usage and time elapsed reach this %"
          >
            <span style={styles.settingLabel}>Rate Minimum (%) ⓘ</span>
            <input
              type="number"
              min="0"
              max="100"
              value={iconSettings.rateMinPercent ?? 5}
              onChange={(e) =>
                onIconSettingsChange({
                  ...iconSettings,
                  rateMinPercent: parseInt(e.target.value) || 0,
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
        )}
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
