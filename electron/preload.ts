import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

console.log('--- PRELOAD LOADED ---');

contextBridge.exposeInMainWorld('electronAPI', {
  connectProvider: (provider: string) =>
    ipcRenderer.send('connect-provider', provider),
  disconnectProvider: (provider: string) =>
    ipcRenderer.send('disconnect-provider', provider),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled: boolean) =>
    ipcRenderer.send('set-auto-launch', enabled),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAutoUpdate: () => ipcRenderer.invoke('get-auto-update'),
  setAutoUpdate: (enabled: boolean) =>
    ipcRenderer.send('set-auto-update', enabled),
  getRefreshInterval: () => ipcRenderer.invoke('get-refresh-interval'),
  setRefreshInterval: (minutes: number) =>
    ipcRenderer.send('set-refresh-interval', minutes),
  checkForUpdate: () => ipcRenderer.send('check-for-update'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  refreshUsage: () => ipcRenderer.send('refresh-usage'),
  quitApp: () => ipcRenderer.send('quit-app'),
  getProviderStatus: () => ipcRenderer.invoke('get-provider-status'),
  getUsageHistory: () => ipcRenderer.invoke('get-usage-history'),
  onProviderConnected: (
    callback: (event: IpcRendererEvent, provider: string) => void
  ) => {
    ipcRenderer.on('provider-connected', callback);
    return () => {
      ipcRenderer.removeListener('provider-connected', callback);
    };
  },
  onProviderDisconnected: (
    callback: (event: IpcRendererEvent, provider: string) => void
  ) => {
    ipcRenderer.on('provider-disconnected', callback);
    return () => {
      ipcRenderer.removeListener('provider-disconnected', callback);
    };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUsageUpdate: (
    callback: (
      event: IpcRendererEvent,
      data: { provider: string; usage: string; details?: any[] }
    ) => void
  ) => {
    ipcRenderer.on('usage-update', callback);
    return () => {
      ipcRenderer.removeListener('usage-update', callback);
    };
  },
  onUpdateStatus: (callback: (event: IpcRendererEvent, data: any) => void) => {
    ipcRenderer.on('update-status', callback);
    return () => {
      ipcRenderer.removeListener('update-status', callback);
    };
  },
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  onLogEntry: (callback: (event: IpcRendererEvent, entry: any) => void) => {
    ipcRenderer.on('log-entry', callback);
    return () => {
      ipcRenderer.removeListener('log-entry', callback);
    };
  },
  resizeWindow: (height: number) => ipcRenderer.send('resize-window', height),
  getProviderOrder: () => ipcRenderer.invoke('get-provider-order'),
  setProviderOrder: (order: string[]) =>
    ipcRenderer.send('set-provider-order', order),
  openDebugWindow: () => ipcRenderer.send('open-debug-window'),
  openUsageDetails: () => ipcRenderer.send('open-usage-details'),
  getIconSettings: () => ipcRenderer.invoke('get-icon-settings'),
  setIconSettings: (settings: {
    thresholdWarning: number;
    thresholdCritical: number;
  }) => ipcRenderer.send('set-icon-settings', settings),
  getProviderAccentColors: () =>
    ipcRenderer.invoke('get-provider-accent-colors'),
  setProviderAccentColor: (provider: string, color: string) =>
    ipcRenderer.invoke('set-provider-accent-color', { provider, color }),
  getProviderCommands: () => ipcRenderer.invoke('get-provider-commands'),
  setProviderCommand: (provider: string, command: string) =>
    ipcRenderer.send('set-provider-command', { provider, command }),
  startSession: (provider: string) =>
    ipcRenderer.send('start-session', provider),
});
