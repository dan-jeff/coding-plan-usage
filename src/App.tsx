import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  RefreshCw,
  Power,
  Settings,
  ArrowLeft,
  LayoutDashboard,
  X,
} from 'lucide-react';
import { ProviderData, UpdateStatusData } from './types';
import { styles, theme } from './theme';
import { ProviderCard } from './components/ProviderCard';
import { SettingsView } from './components/SettingsView';
import { DebugLogView } from './components/DebugLogView';
import type { IconSettings } from './types';

function App() {
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [appVersion, setAppVersion] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [providerOrder, setProviderOrder] = useState<string[]>([]);
  const [iconSettings, setIconSettings] = useState<IconSettings>({
    thresholdWarning: 50,
    thresholdCritical: 80,
  });
  const [providers, setProviders] = useState<{ [key: string]: ProviderData }>({
    z_ai: { label: 'Z.ai', connected: false, usage: null },
    claude: { label: 'Claude', connected: false, usage: null },
  });
  const [updateStatus, setUpdateStatus] = useState<
    UpdateStatusData['type'] | 'idle'
  >('idle');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [showSetupHint, setShowSetupHint] = useState(true);

  const appRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isDebugView = window.location.hash === '#debug-logs';

  if (isDebugView) {
    return <DebugLogView />;
  }

  useLayoutEffect(() => {
    if (!appRef.current || !scrollAreaRef.current || !contentRef.current)
      return;

    const updateHeight = () => {
      const scrollArea = scrollAreaRef.current;
      const app = appRef.current;

      if (!scrollArea || !app) return;

      // Calculate the non-scrollable height (Header + Footer)
      const frameHeight = app.offsetHeight - scrollArea.offsetHeight;

      // Calculate total desired height
      const totalHeight = frameHeight + scrollArea.scrollHeight;

      if (window.electronAPI.resizeWindow) {
        window.electronAPI.resizeWindow(totalHeight);
      }
    };

    const observer = new ResizeObserver(updateHeight);

    // Observe content div to detect size changes
    observer.observe(contentRef.current);

    // Initial call
    updateHeight();

    return () => observer.disconnect();
  }, [view, providers, updateStatus, showSetupHint]);

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

    // Load Provider Order
    const loadProviderOrder = async () => {
      try {
        if (window.electronAPI.getProviderOrder) {
          const order = await window.electronAPI.getProviderOrder();
          if (order && Array.isArray(order)) {
            setProviderOrder(order);
          }
        }
      } catch (err) {
        console.error('Failed to get provider order', err);
      }
    };
    loadProviderOrder();

    const loadIconSettings = async () => {
      try {
        if (window.electronAPI.getIconSettings) {
          const settings = await window.electronAPI.getIconSettings();
          setIconSettings(settings);
        }
      } catch (err) {
        console.error('Failed to load icon settings', err);
      }
    };
    loadIconSettings();

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

    const removeUpdateStatusListener = window.electronAPI.onUpdateStatus
      ? window.electronAPI.onUpdateStatus((_event, data) => {
          switch (data.type) {
            case 'checking':
              setUpdateStatus('checking');
              setUpdateMessage('Checking for updates...');
              break;
            case 'available':
              setUpdateStatus('available');
              setUpdateMessage(`Version ${data.version} available!`);
              break;
            case 'not-available':
              setUpdateStatus('idle');
              setUpdateMessage('Up to date');
              break;
            case 'error':
              setUpdateStatus('error');
              setUpdateMessage(data.error || 'Update check failed');
              break;
            case 'downloading':
              setUpdateStatus('downloading');
              setUpdateMessage(
                `Downloading... ${data.progress?.percent || 0}%`
              );
              setUpdateProgress(data.progress?.percent || 0);
              break;
            case 'downloaded':
              setUpdateStatus('downloaded');
              setUpdateMessage(`Version ${data.version} ready to install!`);
              break;
          }
        })
      : () => {};

    return () => {
      removeConnectListener();
      removeDisconnectListener();
      removeUsageListener();
      removeUpdateStatusListener();
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

  const handleIconSettingsChange = (newSettings: IconSettings) => {
    setIconSettings(newSettings);
    if (window.electronAPI.setIconSettings) {
      window.electronAPI.setIconSettings(newSettings);
    }
  };

  const handleCheckForUpdate = () => {
    setUpdateStatus('checking');
    setUpdateMessage('Checking for updates...');
    window.electronAPI.checkForUpdate();
  };

  const handleQuitAndInstall = () => {
    window.electronAPI.quitAndInstall();
  };

  const connectProvider = (key: string) => {
    window.electronAPI.connectProvider(key);
  };

  const handleReconnect = (key: string) => {
    window.electronAPI.disconnectProvider(key);
    window.electronAPI.connectProvider(key);
  };

  const handleDisconnect = (key: string) => {
    window.electronAPI.disconnectProvider(key);
  };

  const handleDragStart = (e: React.DragEvent, providerKey: string) => {
    e.dataTransfer.setData('text/plain', providerKey);
    // Optional: set drag effect
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetProviderKey: string) => {
    e.preventDefault();
    const draggedProviderKey = e.dataTransfer.getData('text/plain');

    if (!draggedProviderKey || draggedProviderKey === targetProviderKey) return;

    const currentOrder =
      providerOrder.length > 0 ? [...providerOrder] : Object.keys(providers);
    const oldIndex = currentOrder.indexOf(draggedProviderKey);
    const newIndex = currentOrder.indexOf(targetProviderKey);

    // If items not in order list yet (e.g. first run), ensure they are added
    if (oldIndex === -1) currentOrder.push(draggedProviderKey);
    if (newIndex === -1) currentOrder.push(targetProviderKey);

    // Re-calculate indices after potential pushes
    const finalOldIndex = currentOrder.indexOf(draggedProviderKey);
    let finalNewIndex = currentOrder.indexOf(targetProviderKey);

    if (finalOldIndex > -1 && finalNewIndex > -1) {
      const newOrder = [...currentOrder];
      newOrder.splice(finalOldIndex, 1);
      newOrder.splice(finalNewIndex, 0, draggedProviderKey);

      setProviderOrder(newOrder);
      if (window.electronAPI.setProviderOrder) {
        window.electronAPI.setProviderOrder(newOrder);
      }
    }
  };

  const renderDashboard = () => {
    const connectedProviders = Object.entries(providers).filter(
      ([, data]) => data.connected
    );

    // Sort based on providerOrder
    if (providerOrder.length > 0) {
      connectedProviders.sort((a, b) => {
        const indexA = providerOrder.indexOf(a[0]);
        const indexB = providerOrder.indexOf(b[0]);

        // Items not in the order list go to the end
        const safeIndexA = indexA === -1 ? 999 : indexA;
        const safeIndexB = indexB === -1 ? 999 : indexB;

        return safeIndexA - safeIndexB;
      });
    }

    if (connectedProviders.length === 0) {
      if (!showSetupHint) return null;

      return (
        <div
          style={
            {
              ...styles.setupCard,
              position: 'relative',
            } as React.CSSProperties
          }
        >
          <button
            onClick={() => setShowSetupHint(false)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'none',
              border: 'none',
              color: theme.textSec,
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={16} />
          </button>
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
          <div
            key={key}
            draggable
            onDragStart={(e) => handleDragStart(e, key)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, key)}
            style={{ cursor: 'grab' }}
          >
            <ProviderCard data={data} />
          </div>
        ))}
      </>
    );
  };

  return (
    <div style={styles.container} ref={appRef}>
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
      <div style={styles.scrollArea} ref={scrollAreaRef}>
        <div style={styles.contentContainer} ref={contentRef}>
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
              onDisconnect={handleDisconnect}
              updateStatus={updateStatus}
              updateMessage={updateMessage}
              updateProgress={updateProgress}
              onCheckUpdate={handleCheckForUpdate}
              onQuitAndInstall={handleQuitAndInstall}
              iconSettings={iconSettings}
              onIconSettingsChange={handleIconSettingsChange}
            />
          )}
        </div>
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
