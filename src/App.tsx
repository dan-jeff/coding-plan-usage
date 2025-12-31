import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Power,
  Settings,
  ArrowLeft,
  LayoutDashboard,
} from 'lucide-react';
import { ProviderData } from './types';
import { styles, theme } from './theme';
import { ProviderCard } from './components/ProviderCard';
import { SettingsView } from './components/SettingsView';

function App() {
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [appVersion, setAppVersion] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [providers, setProviders] = useState<{ [key: string]: ProviderData }>({
    z_ai: { label: 'Z.ai', connected: false, usage: null },
    claude: { label: 'Claude', connected: false, usage: null },
  });

  useEffect(() => {
    // Initial Status Check
    const checkStatus = async () => {
      try {
        if (window.electronAPI.getProviderStatus) {
          const status = await window.electronAPI.getProviderStatus();
          setProviders((prev) => ({
            ...prev,
            z_ai: { ...prev['z_ai'], connected: status.z_ai },
            claude: { ...prev['claude'], connected: status.claude },
          }));
        }
      } catch (err) {
        console.error('Failed to get provider status', err);
      }
    };
    checkStatus();

    // Load Auto Launch Preference
    const loadAutoLaunch = async () => {
      try {
        if (window.electronAPI.getAutoLaunch) {
          const isEnabled = await window.electronAPI.getAutoLaunch();
          setAutoLaunch(isEnabled);
        }
      } catch (err) {
        console.error('Failed to get auto launch status', err);
      }
    };
    loadAutoLaunch();

    // Load App Version and Auto Update Status
    const loadAppInfo = async () => {
      try {
        if (window.electronAPI.getAppVersion) {
          const version = await window.electronAPI.getAppVersion();
          setAppVersion(version);
        }
        if (window.electronAPI.getAutoUpdate) {
          const isEnabled = await window.electronAPI.getAutoUpdate();
          setAutoUpdate(isEnabled);
        }
      } catch (err) {
        console.error('Failed to get app info', err);
      }
    };
    loadAppInfo();

    // Load Refresh Interval
    const loadRefreshInterval = async () => {
      try {
        if (window.electronAPI.getRefreshInterval) {
          const interval = await window.electronAPI.getRefreshInterval();
          setRefreshInterval(interval);
        }
      } catch (err) {
        console.error('Failed to get refresh interval', err);
      }
    };
    loadRefreshInterval();

    // Listeners
    const removeConnectListener = window.electronAPI.onProviderConnected(
      (_event, provider) => {
        setProviders((prev) => {
          if (!prev[provider]) return prev;
          return {
            ...prev,
            [provider]: { ...prev[provider], connected: true },
          };
        });
      }
    );

    const removeDisconnectListener = window.electronAPI.onProviderDisconnected(
      (_event, provider) => {
        setProviders((prev) => {
          if (!prev[provider]) return prev;
          return {
            ...prev,
            [provider]: { ...prev[provider], connected: false },
          };
        });
      }
    );

    const removeUsageListener = window.electronAPI.onUsageUpdate(
      (_event, { provider, usage, details }) => {
        setIsRefreshing(false);
        setProviders((prev) => {
          if (!prev[provider]) return prev;
          return {
            ...prev,
            [provider]: {
              ...prev[provider],
              usage,
              details: details || prev[provider].details,
            },
          };
        });
      }
    );

    return () => {
      removeConnectListener();
      removeDisconnectListener();
      removeUsageListener();
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.electronAPI.refreshUsage();
    setTimeout(() => setIsRefreshing(false), 3000); // Timeout
  };

  const handleQuit = () => {
    if (window.electronAPI.quitApp) {
      window.electronAPI.quitApp();
    } else {
      console.log('Quit button clicked (Not implemented in preload)');
    }
  };

  const handleAutoLaunchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAutoLaunch(checked);
    if (window.electronAPI.setAutoLaunch) {
      window.electronAPI.setAutoLaunch(checked);
    }
  };

  const handleAutoUpdateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAutoUpdate(checked);
    if (window.electronAPI.setAutoUpdate) {
      window.electronAPI.setAutoUpdate(checked);
    }
  };

  const handleRefreshIntervalChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const val = parseInt(e.target.value);
    setRefreshInterval(val);
    window.electronAPI.setRefreshInterval(val);
  };

  const connectProvider = (key: string) => {
    window.electronAPI.connectProvider(key);
  };

  const handleReconnect = (key: string) => {
    window.electronAPI.disconnectProvider(key);
    window.electronAPI.connectProvider(key);
  };

  const renderDashboard = () => {
    const connectedProviders = Object.entries(providers).filter(
      ([, data]) => data.connected
    );

    if (connectedProviders.length === 0) {
      return (
        <div style={styles.setupCard}>
          <LayoutDashboard
            size={40}
            color={theme.textSec}
            style={{ opacity: 0.5 }}
          />
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
              Setup Required
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: theme.textSec }}>
              Connect a provider to start tracking usage.
            </p>
          </div>
          <button style={styles.setupBtn} onClick={() => setView('settings')}>
            Go to Settings
          </button>
        </div>
      );
    }

    return (
      <>
        {connectedProviders.map(([key, data]) => (
          <ProviderCard key={key} data={data} />
        ))}
      </>
    );
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header as React.CSSProperties}>
        {view === 'settings' ? (
          <button
            style={styles.backButton as React.CSSProperties}
            onClick={() => setView('dashboard')}
          >
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div style={styles.statusDot} />
        )}
        <h1 style={styles.headerTitle}>
          {view === 'settings' ? 'Settings' : 'Coding Plan Usage'}
        </h1>
        {view === 'dashboard' && (
          <button
            onClick={handleRefresh}
            style={
              {
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: theme.textSec,
                cursor: 'pointer',
                padding: '8px',
                WebkitAppRegion: 'no-drag' as const,
                display: 'flex',
                alignItems: 'center',
              } as React.CSSProperties
            }
          >
            <RefreshCw
              size={16}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={styles.scrollArea}>
        {view === 'dashboard' ? (
          renderDashboard()
        ) : (
          <SettingsView
            autoLaunch={autoLaunch}
            handleAutoLaunchChange={handleAutoLaunchChange}
            autoUpdate={autoUpdate}
            handleAutoUpdateChange={handleAutoUpdateChange}
            appVersion={appVersion}
            refreshInterval={refreshInterval}
            handleRefreshIntervalChange={handleRefreshIntervalChange}
            providers={providers}
            onConnect={connectProvider}
            onReconnect={handleReconnect}
          />
        )}
      </div>

      {/* Bottom Bar */}
      <div style={styles.bottomBar}>
        <button
          onClick={handleRefresh}
          style={{
            ...styles.button,
            backgroundColor: 'transparent',
            border: `1px solid ${theme.accentGreen}`,
            color: theme.accentGreen,
            opacity: isRefreshing ? 0.7 : 1,
          }}
        >
          <RefreshCw
            size={16}
            className={isRefreshing ? 'spin-animation' : ''}
            style={{
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          {isRefreshing ? 'Refreshing' : 'Refresh'}
        </button>

        <button
          onClick={() => setView('settings')}
          style={{
            ...styles.button,
            backgroundColor:
              view === 'settings'
                ? theme.accentGreen
                : 'rgba(255,255,255,0.05)',
            color: view === 'settings' ? '#000' : theme.textMain,
            fontWeight: view === 'settings' ? 700 : 500,
          }}
        >
          <Settings size={16} />
          Settings
        </button>

        <button
          onClick={handleQuit}
          style={{
            ...styles.button,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: theme.accentRed,
          }}
        >
          <Power size={16} />
          Quit
        </button>
      </div>

      {/* Inline styles for keyframes */}
      <style>{`
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        select option {
            background-color: #2a2a3c;
            color: #ffffff;
        }
      `}</style>
    </div>
  );
}

export default App;
