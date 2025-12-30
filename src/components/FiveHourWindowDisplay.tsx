import React from 'react';
import { UsageDetail } from '../types';
import { styles, theme } from '../theme';

export const FiveHourWindowDisplay = ({ detail }: { detail: UsageDetail }) => {
  const isUnavailable = detail.displayReset === 'Unavailable';

  // Robustly determine minutes remaining
  let minutes = detail.timeRemainingMinutes;

  // Fallback: Parse from display string if raw number is missing
  if (minutes === undefined && !isUnavailable && detail.displayReset) {
    const hMatch = detail.displayReset.match(/(\d+)h/);
    // Just to be safe with our format "Xh Ym" or "X min"
    const h = hMatch ? parseInt(hMatch[1], 10) : 0;
    // Handle "m" or "min"
    const mMatch2 = detail.displayReset.match(/(\d+)\s*m/);
    const m = mMatch2 ? parseInt(mMatch2[1], 10) : 0;
    minutes = h * 60 + m;
  }

  const safeMinutes = minutes || 0;

  // Elapsed/Urgency Logic: 300 mins (full time left) = 0% used. 0 mins (no time left) = 100% used.
  const timePercentage = Math.max(
    0,
    Math.min(100, ((300 - safeMinutes) / 300) * 100)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Row 1: Usage */}
      <div>
        <div style={styles.usageHeader}>
          <span>Usage</span>
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
              backgroundColor: theme.accentGreen,
              opacity: isUnavailable ? 0.1 : 1,
            }}
          />
        </div>
      </div>

      {/* Row 2: Time Remaining */}
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
              backgroundColor: theme.accentGreen, // Uniform Green
              opacity: isUnavailable ? 0.1 : 1,
            }}
          />
        </div>
      </div>
    </div>
  );
};
