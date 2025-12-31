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
  refreshUsage: () => ipcRenderer.send('refresh-usage'),
  quitApp: () => ipcRenderer.send('quit-app'),
  getProviderStatus: () => ipcRenderer.invoke('get-provider-status'),
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
});
