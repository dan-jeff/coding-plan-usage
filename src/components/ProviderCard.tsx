import React, { useState } from 'react';
import { Play, Check } from 'lucide-react';
import { ProviderData, IconSettings, ProviderAccentColors } from '../types';
import { getStyles, getTheme } from '../theme';
import { GenericUsageDisplay } from './GenericUsageDisplay';
import {
  PeriodCustomizationPopup,
  PopupOverlay,
} from './PeriodCustomizationPopup';

export const ProviderCard = ({
  data,
  providerKey,
  providerColors,
  onToggleMetricExclusion,
  iconSettings,
  getCustomDuration,
  onPeriodCustomizationChange,
}: {
  data: ProviderData;
  providerKey: string;
  providerColors: ProviderAccentColors;
  onStartSession?: () => void;
  onToggleMetricExclusion?: (providerKey: string, label: string) => void;
  iconSettings: IconSettings;
  getCustomDuration: (
    provider: string,
    metricLabel: string
  ) => number | undefined;
  onPeriodCustomizationChange: (
    provider: string,
    metricLabel: string,
    durationMinutes: number | null
  ) => void;
}) => {
  const styles = getStyles(iconSettings.glassMode);
  const theme = getTheme(iconSettings.glassMode);
  const [isStarted, setIsStarted] = useState(false);
  const [editingMetric, setEditingMetric] = useState<{
    provider: string;
    metricLabel: string;
    apiDefault: number | undefined;
  } | null>(null);
  const hasCommand = data.command && data.command.trim() !== '';
  const isAntigravity = data.label === 'Antigravity';
  const primaryUsagePercent = data.details?.[0]?.percentage ?? 0;
  const hasDetailData = (data.details?.length ?? 0) > 0;
  const isActive = data.connected && (hasDetailData || primaryUsagePercent > 0);
  const providerBorderColor =
    providerColors[providerKey as keyof ProviderAccentColors] ||
    theme.glassBorder;

  const handleEditPeriod = (
    metricLabel: string,
    apiDefault: number | undefined
  ) => {
    setEditingMetric({
      provider: providerKey,
      metricLabel,
      apiDefault,
    });
  };

  const handleSavePeriod = (durationMinutes: number | null) => {
    if (editingMetric) {
      onPeriodCustomizationChange(
        editingMetric.provider,
        editingMetric.metricLabel,
        durationMinutes
      );
    }
    setEditingMetric(null);
  };

  const handleClosePopup = () => {
    setEditingMetric(null);
  };

  return (
    <div
      style={{
        ...styles.card,
        border: `1px solid ${providerBorderColor}`,
      }}
    >
      <div style={styles.cardHeader}>
        <span style={styles.providerName}>{data.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isActive
                  ? theme.accentGreen
                  : data.connected && !isActive
                    ? theme.accentRed
                    : theme.textSec,
              }}
            />
            <span style={{ fontSize: '12px', color: theme.textSec }}>
              {isActive
                ? 'Active'
                : data.connected && !isActive
                  ? 'Inactive'
                  : 'Offline'}
            </span>
          </div>
          {hasCommand && !isAntigravity && data.connected && !isActive && (
            <button
              onClick={() => {
                if (window.electronAPI.startSession) {
                  setIsStarted(true);
                  const providerKey =
                    data.label === 'Z.ai'
                      ? 'z_ai'
                      : data.label === 'ChatGPT Codex'
                        ? 'codex'
                        : 'claude';
                  window.electronAPI.startSession(providerKey);
                  // Schedule updates
                  setTimeout(() => window.electronAPI.refreshUsage(), 1000);
                  setTimeout(() => window.electronAPI.refreshUsage(), 10000);
                  setTimeout(() => window.electronAPI.refreshUsage(), 15000);

                  // Reset button state
                  setTimeout(() => setIsStarted(false), 2000);
                }
              }}
              disabled={isStarted}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                cursor: isStarted ? 'default' : 'pointer',
                fontWeight: 600,
                fontSize: '11px',
                backgroundColor: isStarted
                  ? theme.accentGreen
                  : theme.accentYellow,
                color: '#000',
                transition: 'all 0.2s',
                opacity: isStarted ? 1 : undefined,
              }}
              title={`Run: ${data.command}`}
              onMouseEnter={(e) => {
                if (!isStarted)
                  (e.target as HTMLButtonElement).style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                if (!isStarted)
                  (e.target as HTMLButtonElement).style.opacity = '1';
              }}
            >
              {isStarted ? <Check size={12} /> : <Play size={12} />}
              {isStarted ? 'Sent!' : 'Start Session'}
            </button>
          )}
        </div>
      </div>

      {data.connected && data.details && data.details.length > 0 ? (
        <div style={{ marginTop: '8px' }}>
          {data.details.map((detail, index) => (
            <div key={index} style={{ marginBottom: '16px' }}>
              <GenericUsageDisplay
                detail={detail}
                providerKey={providerKey}
                onToggleMetricExclusion={onToggleMetricExclusion}
                iconSettings={iconSettings}
                getCustomDuration={getCustomDuration}
                onEditPeriod={handleEditPeriod}
              />
            </div>
          ))}
        </div>
      ) : data.connected ? (
        <div
          style={{ padding: '10px 0', fontSize: '13px', color: theme.textSec }}
        >
          No usage data available.
        </div>
      ) : isAntigravity ? (
        <div
          style={{ padding: '10px 0', fontSize: '13px', color: theme.textSec }}
        >
          Antigravity not running. Open it to sync.
        </div>
      ) : (
        <div
          style={{ padding: '10px 0', fontSize: '13px', color: theme.textSec }}
        >
          Provider not connected.
        </div>
      )}

      {editingMetric && (
        <>
          <PopupOverlay onClick={handleClosePopup} />
          <PeriodCustomizationPopup
            provider={editingMetric.provider}
            metricLabel={editingMetric.metricLabel}
            apiDefaultMinutes={editingMetric.apiDefault}
            currentCustomMinutes={
              editingMetric.apiDefault
                ? getCustomDuration(
                    editingMetric.provider,
                    editingMetric.metricLabel
                  )
                : undefined
            }
            onClose={handleClosePopup}
            onSave={handleSavePeriod}
          />
        </>
      )}
    </div>
  );
};
