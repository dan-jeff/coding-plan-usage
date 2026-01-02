import React, { useEffect, useState } from 'react';
import { LogEntry } from '../types';
import { theme } from '../theme';

export const DebugLogView = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const loadInitialLogs = async () => {
      const initialLogs = await window.electronAPI.getLogs();
      setLogs(initialLogs);
    };
    loadInitialLogs();

    const unsubscribe = window.electronAPI.onLogEntry((event, entry) => {
      setLogs((prev) => [...prev, entry]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRefreshLogs = async () => {
    const refreshedLogs = await window.electronAPI.getLogs();
    setLogs(refreshedLogs);
  };

  const handleClearLogs = async () => {
    await window.electronAPI.clearLogs();
    setLogs([]);
  };

  const handleCopyLogs = () => {
    const logText = logs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(logText);
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return '#ef4444';
      case 'warn':
        return '#f59e0b';
      case 'info':
        return '#22c55e';
      case 'debug':
        return '#6b7280';
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.bg,
        color: theme.textMain,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 700 }}>Debug Logs</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleRefreshLogs}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              backgroundColor: theme.accentGreen,
              color: '#000',
            }}
          >
            Refresh
          </button>
          <button
            onClick={handleCopyLogs}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: `1px solid ${theme.border}`,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              backgroundColor: theme.card,
              color: theme.textMain,
            }}
          >
            Copy to Clipboard
          </button>
          <button
            onClick={handleClearLogs}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              backgroundColor: theme.accentRed,
              color: '#fff',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#2a2a3c',
          padding: '16px',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: theme.textSec, fontStyle: 'italic' }}>
            No logs available
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {logs.map((log, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: theme.textSec, minWidth: '160px' }}>
                  {log.timestamp}
                </span>
                <span
                  style={{
                    color: getLogColor(log.level),
                    minWidth: '60px',
                    fontWeight: 'bold',
                  }}
                >
                  [{log.level.toUpperCase()}]
                </span>
                <span style={{ wordBreak: 'break-word' }}>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '12px 20px',
          borderTop: `1px solid ${theme.border}`,
          backgroundColor: theme.card,
          fontSize: '13px',
          color: theme.textSec,
        }}
      >
        {logs.length} {logs.length === 1 ? 'log' : 'logs'}
      </div>
    </div>
  );
};
