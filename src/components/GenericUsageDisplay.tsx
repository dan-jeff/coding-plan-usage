import React from 'react';
import { UsageDetail, IconSettings } from '../types';
import { getStyles, getTheme } from '../theme';
import { Settings } from 'lucide-react';

const getBarColor = (
  percentage: number,
  theme: { accentRed: string; accentYellow: string; accentGreen: string }
): string => {
  if (percentage >= 80) return theme.accentRed;
  if (percentage >= 50) return theme.accentYellow;
  return theme.accentGreen;
};

export const GenericUsageDisplay = ({
  detail,
  providerKey,
  onToggleMetricExclusion,
  iconSettings,
  getCustomDuration,
  onEditPeriod,
}: {
  detail: UsageDetail;
  providerKey: string;
  onToggleMetricExclusion?: (providerKey: string, label: string) => void;
  iconSettings: IconSettings;
  getCustomDuration?: (
    provider: string,
    metricLabel: string
  ) => number | undefined;
  onEditPeriod?: (metricLabel: string, apiDefault: number | undefined) => void;
}) => {
  const styles = getStyles(iconSettings.glassMode);
  const theme = getTheme(iconSettings.glassMode);
  const [isHovered, setIsHovered] = React.useState(false);
  const isUnavailable = detail.displayReset === 'Unavailable';
  const hasUsageData = detail.hasUsageData !== false;
  const compositeKey = `${providerKey}|${detail.label}`;
  const isExcluded =
    iconSettings?.excludedMetrics.includes(compositeKey) || false;

  const safeMinutes = detail.timeRemainingMinutes || 0;
  const isTimeLimited = detail.timeRemainingMinutes !== undefined;

  const totalDuration = detail.totalDurationMinutes || 300;

  // Get custom duration if available
  const customDuration = getCustomDuration?.(providerKey, detail.label);
  const effectiveTotalDuration = customDuration ?? totalDuration;
  const hasCustomDuration = customDuration !== undefined;
  const canEditPeriod =
    onEditPeriod !== undefined && effectiveTotalDuration > 0;

  const timeElapsedPct = Math.max(
    0,
    Math.min(
      100,
      ((effectiveTotalDuration - safeMinutes) / effectiveTotalDuration) * 100
    )
  );

  let usageColor = getBarColor(detail.percentage, theme);
  let timeColor = theme.accentGreen;

  const rateMinPercent = iconSettings?.rateMinPercent ?? 5;

  if (iconSettings?.coloringMode === 'rate' && isTimeLimited) {
    // Noise floor: only color if usage AND time have reached the minimum threshold
    if (
      detail.percentage >= rateMinPercent &&
      timeElapsedPct >= rateMinPercent
    ) {
      if (detail.percentage > timeElapsedPct) {
        usageColor = theme.accentRed;
        timeColor = theme.accentRed;
      } else if (detail.percentage > timeElapsedPct - 10) {
        usageColor = theme.accentYellow;
        timeColor = theme.accentYellow;
      } else {
        usageColor = theme.accentGreen;
        timeColor = theme.accentGreen;
      }
    } else {
      usageColor = theme.accentGreen;
      timeColor = theme.accentGreen;
    }
  }

  const hasValues =
    detail.used !== undefined &&
    detail.limit !== undefined &&
    detail.used !== '' &&
    detail.limit !== '';
  const secondaryText = hasValues
    ? `${detail.used} / ${detail.limit}${detail.unit ? ' ' + detail.unit : ''}`
    : null;

  return (
    <div
      onClick={() => onToggleMetricExclusion?.(providerKey, detail.label)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '8px',
        transition: 'all 0.2s ease',
        backgroundColor: isHovered ? theme.glassBg : 'transparent',
        opacity: isExcluded ? 0.5 : 1,
        filter: isExcluded ? 'grayscale(100%)' : 'none',
        border: `1px solid ${isHovered ? theme.glassBorder : 'transparent'}`,
      }}
    >
      {/* Row 1: Usage */}
      <div>
        <div style={styles.usageHeader}>
          <span
            style={{
              textDecoration: isExcluded ? 'line-through' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {detail.label}
            {isExcluded && (
              <span
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                (Excluded)
              </span>
            )}
          </span>
          <span style={{ fontWeight: 600, color: theme.textMain }}>
            {hasUsageData ? `${detail.percentage}%` : '--'}
          </span>
        </div>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressBar,
              width: isUnavailable
                ? '0%'
                : hasUsageData
                  ? `${Math.min(detail.percentage, 100)}%`
                  : '0%',
              backgroundColor: usageColor,
              opacity: isUnavailable ? 0.1 : 1,
            }}
          />
        </div>
        {secondaryText && (
          <div
            style={{
              textAlign: 'right',
              fontSize: '11px',
              color: theme.textSec,
              marginTop: '4px',
            }}
          >
            {secondaryText}
          </div>
        )}
      </div>

      {/* Row 2: Time Remaining (only for time-limited metrics with duration data) */}
      {(isTimeLimited || effectiveTotalDuration > 0) && (
        <div>
          <div style={styles.usageHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Time Remaining
              {canEditPeriod && (
                <button
                  onClick={() =>
                    onEditPeriod?.(detail.label, detail.totalDurationMinutes)
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    color: hasCustomDuration
                      ? theme.accentYellow
                      : theme.textSec,
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.7,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.opacity = '0.7';
                  }}
                  title={
                    hasCustomDuration
                      ? 'Edit custom period'
                      : 'Set custom period'
                  }
                >
                  <Settings size={12} />
                </button>
              )}
            </span>
            <span style={{ fontWeight: 600, color: theme.textMain }}>
              {detail.displayReset}
            </span>
          </div>
          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressBar,
                width: isUnavailable ? '0%' : `${timeElapsedPct}%`,
                backgroundColor: timeColor,
                opacity: isUnavailable ? 0.1 : 1,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
