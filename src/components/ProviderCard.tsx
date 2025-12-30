import React from 'react';
import { ProviderData } from '../types';
import { styles, theme } from '../theme';
import { FiveHourWindowDisplay } from './FiveHourWindowDisplay';

export const ProviderCard = ({ data }: { data: ProviderData }) => {
  const fiveHourWindow = data.details?.find(
    (d) => d.label === '5-Hour Window'
  ) || {
    label: '5-Hour Window',
    percentage: 0,
    displayReset: 'Unavailable',
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.providerName}>{data.label}</span>
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
      </div>

      {data.connected ? (
        <div style={{ marginTop: '8px' }}>
          <FiveHourWindowDisplay detail={fiveHourWindow} />
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
