'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const electron_1 = require('electron');
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
  connectProvider: (provider) =>
    electron_1.ipcRenderer.send('connect-provider', provider),
  refreshUsage: () => electron_1.ipcRenderer.send('refresh-usage'),
  getProviderStatus: () => electron_1.ipcRenderer.invoke('get-provider-status'),
  onProviderConnected: (callback) => {
    electron_1.ipcRenderer.on('provider-connected', callback);
    return () => {
      electron_1.ipcRenderer.removeListener('provider-connected', callback);
    };
  },
  onUsageUpdate: (callback) => {
    electron_1.ipcRenderer.on('usage-update', callback);
    return () => {
      electron_1.ipcRenderer.removeListener('usage-update', callback);
    };
  },
});
