import React from 'react';
import { UsageDetail } from '../types';
import { styles, theme } from '../theme';

const getBarColor = (percentage: number): string => {
  if (percentage >= 80) return theme.accentRed;
  if (percentage >= 50) return theme.accentYellow;
  return theme.accentGreen;
};

export const GenericUsageDisplay = ({ detail }: { detail: UsageDetail }) => {
  const isUnavailable = detail.displayReset === 'Unavailable';

  const safeMinutes = detail.timeRemainingMinutes || 0;
  const isTimeLimited = detail.timeRemainingMinutes !== undefined;

  const totalDuration = detail.totalDurationMinutes || 300;
  const timePercentage = Math.max(
    0,
    Math.min(100, ((totalDuration - safeMinutes) / totalDuration) * 100)
  );

  const usageColor = getBarColor(detail.percentage);

  const hasValues =
    detail.used !== undefined &&
    detail.limit !== undefined &&
    detail.used !== '' &&
    detail.limit !== '';
  const secondaryText = hasValues
    ? `${detail.used} / ${detail.limit}${detail.unit ? ' ' + detail.unit : ''}`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Row 1: Usage */}
      <div>
        <div style={styles.usageHeader}>
          <span>{detail.label}</span>
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
                width: isUnavailable ? '0%' : `${timePercentage}%`,
                backgroundColor: theme.accentGreen,
                opacity: isUnavailable ? 0.1 : 1,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
