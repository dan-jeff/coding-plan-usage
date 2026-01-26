import React from 'react';
import { UsageDetail, IconSettings } from '../types';
import { styles, theme } from '../theme';

const getBarColor = (percentage: number): string => {
  if (percentage >= 80) return theme.accentRed;
  if (percentage >= 50) return theme.accentYellow;
  return theme.accentGreen;
};

export const GenericUsageDisplay = ({
  detail,
  providerKey,
  onToggleMetricExclusion,
  iconSettings,
}: {
  detail: UsageDetail;
  providerKey: string;
  onToggleMetricExclusion?: (providerKey: string, label: string) => void;
  iconSettings?: IconSettings;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const isUnavailable = detail.displayReset === 'Unavailable';
  const compositeKey = `${providerKey}|${detail.label}`;
  const isExcluded =
    iconSettings?.excludedMetrics.includes(compositeKey) || false;

  const safeMinutes = detail.timeRemainingMinutes || 0;
  const isTimeLimited = detail.timeRemainingMinutes !== undefined;

  const totalDuration = detail.totalDurationMinutes || 300;
  const timeElapsedPct = Math.max(
    0,
    Math.min(100, ((totalDuration - safeMinutes) / totalDuration) * 100)
  );

  let usageColor = getBarColor(detail.percentage);
  let timeColor = theme.accentGreen;

  if (iconSettings?.coloringMode === 'rate' && isTimeLimited) {
    // Noise floor: only color if usage or time has actually started to move
    if (detail.percentage > 1 || timeElapsedPct > 1) {
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
        backgroundColor: isHovered ? theme.hover : 'transparent',
        opacity: isExcluded ? 0.5 : 1,
        filter: isExcluded ? 'grayscale(100%)' : 'none',
        border: `1px solid ${isHovered ? theme.border : 'transparent'}`,
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
            {detail.percentage}%
          </span>
        </div>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressBar,
              width: isUnavailable
                ? '0%'
                : `${Math.min(detail.percentage, 100)}%`,
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

      {/* Row 2: Time Remaining (only for time-limited metrics) */}
      {isTimeLimited && (
        <div>
          <div style={styles.usageHeader}>
            <span>Time Remaining</span>
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
