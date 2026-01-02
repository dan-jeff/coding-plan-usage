import React, { useState } from 'react';
import { Play, Check } from 'lucide-react';
import { ProviderData } from '../types';
import { styles, theme } from '../theme';
import { GenericUsageDisplay } from './GenericUsageDisplay';

export const ProviderCard = ({
  data,
}: {
  data: ProviderData;
  onStartSession?: () => void;
}) => {
  const [isStarted, setIsStarted] = useState(false);
  const hasCommand = data.command && data.command.trim() !== '';

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.providerName}>{data.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: data.connected
                  ? theme.accentGreen
                  : theme.textSec,
              }}
            />
            <span style={{ fontSize: '12px', color: theme.textSec }}>
              {data.connected ? 'Active' : 'Offline'}
            </span>
          </div>
          {hasCommand && data.connected && (
            <button
              onClick={() => {
                if (window.electronAPI.startSession) {
                  setIsStarted(true);
                  window.electronAPI.startSession(
                    data.label === 'Z.ai' ? 'z_ai' : 'claude'
                  );
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
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}
              >
                {detail.label}
              </div>
              <GenericUsageDisplay detail={detail} />
            </div>
          ))}
        </div>
      ) : data.connected ? (
        <div
          style={{ padding: '10px 0', fontSize: '13px', color: theme.textSec }}
        >
          No usage data available.
        </div>
      ) : (
        <div
          style={{ padding: '10px 0', fontSize: '13px', color: theme.textSec }}
        >
          Provider not connected.
        </div>
      )}
    </div>
  );
};
