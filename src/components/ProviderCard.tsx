import React from 'react';
import { ProviderData } from '../types';
import { styles, theme } from '../theme';
import { GenericUsageDisplay } from './GenericUsageDisplay';

export const ProviderCard = ({ data }: { data: ProviderData }) => {
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
