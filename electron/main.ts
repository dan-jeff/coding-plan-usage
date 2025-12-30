import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
} from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AutoLaunch from 'auto-launch';
import { startPolling, refreshAll, updatePollingInterval } from './poller.js';
import {
  saveSession,
  hasSession,
  deleteSession,
  getSetting,
  setSetting,
} from './secure-store.js';

const _dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const autoLauncher = new AutoLaunch({
  name: 'Coding Usage',
  path: app.getPath('exe'),
});

console.log('--- MAIN PROCESS STARTING ---');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  const preloadPath =
    process.env.NODE_ENV === 'development'
      ? path.join(_dirname, '../dist-electron/preload.cjs')
      : path.join(_dirname, 'preload.cjs');

  console.log('Preload path:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    show: false, // Start hidden
    frame: false,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Initial position calculation
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const x = workArea.x + workArea.width - 400;
  const y = workArea.y + workArea.height - 600;
  mainWindow.setPosition(x, y);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(_dirname, '../dist/index.html'));
  }

  // Prevent closing, just hide
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
    return false;
  });

  // Auto-hide when window loses focus
  mainWindow.on('blur', () => {
    if (!mainWindow?.isDestroyed()) {
      mainWindow?.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(_dirname, 'assets/icon.svg');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);
  tray.setToolTip('Usage Tray');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Z.ai: --%', enabled: false },
    { label: 'Claude: --%', enabled: false },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      // Recalculate position in case screen resolution changed or moved
      const primaryDisplay = screen.getPrimaryDisplay();
      const { workArea } = primaryDisplay;
      // We know our fixed size
      const x = workArea.x + workArea.width - 400;
      const y = workArea.y + workArea.height - 600;

      mainWindow?.setPosition(x, y);
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// Add property to app to track quitting state
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Electron {
    interface App {
      isQuitting: boolean;
    }
  }
}
app.isQuitting = false;

app.whenReady().then(() => {
  createWindow();
  createTray();

  if (tray) {
    startPolling(tray);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Do not quit, keep tray active
  }
});

function authenticateProvider(provider: 'z_ai' | 'claude') {
  const authWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url =
    provider === 'z_ai' ? 'https://z.ai/login' : 'https://claude.ai/login';
  authWindow.loadURL(url);

  // Show instructions to user
  // const instructionUrl = provider === 'z_ai'
  //   ? 'https://z.ai/manage-apikey/subscription'
  //   : 'https://claude.ai/settings/usage';

  authWindow.webContents.on('did-finish-load', () => {
    authWindow.webContents
      .executeJavaScript(
        `
      if (!document.querySelector('#usage-tracker-instruction')) {
        const banner = document.createElement('div');
        banner.id = 'usage-tracker-instruction';
        banner.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #10b981; color: white; padding: 12px 20px; text-align: center; z-index: 999999; font-family: system-ui; font-size: 14px; font-weight: 500; box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
        banner.innerHTML = 'Please navigate to your usage/subscription page to complete setup';
        document.body.prepend(banner);
      }
    `
      )
      .catch(() => {});
  });

  try {
    authWindow.webContents.debugger.attach('1.3');
  } catch (err) {
    console.log('Debugger attach failed: ', err);
  }

  authWindow.webContents.debugger.on('detach', (event, reason) => {
    console.log('Debugger detached due to: ', reason);
  });

  const requestHeadersMap = new Map<string, Record<string, string>>();
  const interestingRequests = new Map<string, string>();
  let bestCandidate: {
    url: string;
    headers: Record<string, string>;
    body: string;
    score: number;
  } | null = null;
  let hasNavigatedToUsagePage = false;
  let fallbackTimeout: NodeJS.Timeout | null = null;

  const handleCaptureComplete = (
    p: 'z_ai' | 'claude',
    candidate: { url: string; headers: Record<string, string> }
  ) => {
    if (fallbackTimeout) {
      clearTimeout(fallbackTimeout);
      fallbackTimeout = null;
    }
    console.log(`Successfully captured ${p} session from ${candidate.url}`);
    saveSession(p, candidate);
    if (!authWindow.isDestroyed()) {
      authWindow.close();
    }
    mainWindow?.webContents.send('provider-connected', p);
  };

  authWindow.webContents.debugger.on(
    'message',
    async (event, method, params) => {
      if (method === 'Network.requestWillBeSent') {
        requestHeadersMap.set(params.requestId, params.request.headers);

        // Track when user navigates to the usage page
        const pageUrl = params.request.url;
        // Use more robust matching for navigation
        const isZaiUsagePage = pageUrl.includes(
          'z.ai/manage-apikey/subscription'
        );
        const isClaudeUsagePage = pageUrl.includes('claude.ai/settings/usage');

        if (provider === 'z_ai' && isZaiUsagePage) {
          hasNavigatedToUsagePage = true;
          console.log('User navigated to Z.ai subscription page');
        } else if (provider === 'claude' && isClaudeUsagePage) {
          hasNavigatedToUsagePage = true;
          console.log('User navigated to Claude usage page');
        }
      }

      if (method === 'Network.responseReceived') {
        const url = params.response.url;
        const requestId = params.requestId;

        // Only capture requests made AFTER user navigates to usage page
        if (!hasNavigatedToUsagePage) {
          return;
        }

        if (provider === 'z_ai') {
          const isZaiApi =
            url.includes('/api/biz/subscription/list') ||
            url.includes('/usage');
          if (isZaiApi) {
            console.log('Z.ai candidate URL:', url);
            interestingRequests.set(requestId, url);
          }
        } else if (provider === 'claude') {
          const isClaudeApi =
            (url.includes('/usage') ||
              url.includes('/stats') ||
              url.includes('/api/organizations/')) &&
            !url.includes('statsig') &&
            !url.includes('bootstrap');

          const isStatic =
            url.match(/\.(js|css|png|svg|jpg|woff2?|ico|json)$/) ||
            url.includes('_next/static');

          if (isClaudeApi && !isStatic) {
            console.log('Claude candidate URL:', url);
            interestingRequests.set(requestId, url);
          }
        }
      }

      if (method === 'Network.loadingFinished') {
        const requestId = params.requestId;
        if (interestingRequests.has(requestId)) {
          const url = interestingRequests.get(requestId)!;
          try {
            // Wait a bit for the response body to be fully available
            await new Promise((resolve) => setTimeout(resolve, 100));
            const { body } = await authWindow.webContents.debugger.sendCommand(
              'Network.getResponseBody',
              { requestId }
            );

            if (!body) {
              console.log(`Empty body for ${url}, skipping`);
              return;
            }

            let score = 0;
            const headers = requestHeadersMap.get(requestId);

            if (provider === 'z_ai') {
              if (
                body.includes('percent') ||
                body.includes('quota') ||
                body.includes('limit')
              )
                score += 10;
              if (url.includes('/api/biz/subscription/list')) score += 25;
              if (url.includes('/usage')) score += 10;
            } else if (provider === 'claude') {
              if (body.includes('percent_used')) score += 10;
              if (body.includes('resets_at')) score += 10;
              if (body.includes('utilization')) score += 5;
              if (body.includes('limits')) score += 5;

              // Prioritize organization usage endpoints
              if (url.includes('/api/organizations/') && url.includes('/usage'))
                score += 25;
              if (url.includes('/account/usage')) score += 15;
            }

            if (score > 0) {
              console.log(`Candidate ${url} scored ${score}`);
              if (!bestCandidate || score > bestCandidate.score) {
                bestCandidate = { url, headers: headers || {}, body, score };
                console.log('New best candidate found!');
              }

              // High score threshold for immediate capture
              if (score >= 35) {
                console.log('High-score match found, finishing capture.');
                handleCaptureComplete(provider, {
                  url,
                  headers: headers || {},
                });
              } else if (!fallbackTimeout) {
                console.log(
                  'Medium-score candidate found, starting 5s fallback timeout'
                );
                fallbackTimeout = setTimeout(() => {
                  if (bestCandidate && !authWindow.isDestroyed()) {
                    console.log(
                      'Fallback timeout reached, using best candidate:',
                      bestCandidate.url
                    );
                    handleCaptureComplete(provider, {
                      url: bestCandidate.url,
                      headers: bestCandidate.headers,
                    });
                  }
                }, 5000);
              }
            }
          } catch (e) {
            console.error(`Error retrieving body for ${url}:`, e);
          }
          interestingRequests.delete(requestId);
        }
        requestHeadersMap.delete(requestId);
      }

      if (method === 'Network.loadingFailed') {
        const requestId = params.requestId;
        interestingRequests.delete(requestId);
        requestHeadersMap.delete(requestId);
      }
    }
  );

  authWindow.webContents.debugger.sendCommand('Network.enable');
}

// IPC handlers
ipcMain.handle('get-auto-launch', async () => {
  if (process.platform === 'linux') {
    return await autoLauncher.isEnabled();
  }
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('set-auto-launch', async (event, enable) => {
  if (process.platform === 'linux') {
    if (enable) {
      await autoLauncher.enable();
    } else {
      await autoLauncher.disable();
    }
  } else {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath('exe'),
    });
  }
});

ipcMain.on('connect-provider', (event, provider) => {
  console.log(`Connect request for provider: ${provider}`);
  if (provider === 'z_ai' || provider === 'claude') {
    authenticateProvider(provider);
  }
});

ipcMain.handle('get-provider-status', () => {
  return {
    z_ai: hasSession('z_ai'),
    claude: hasSession('claude'),
  };
});

ipcMain.on('refresh-usage', () => {
  if (tray) {
    refreshAll(tray);
  }
});

ipcMain.on('disconnect-provider', (event, provider) => {
  console.log(`Disconnect request for provider: ${provider}`);
  if (provider === 'z_ai' || provider === 'claude') {
    deleteSession(provider);
    mainWindow?.webContents.send('provider-disconnected', provider);
  }
});

ipcMain.on('quit-app', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.handle('get-refresh-interval', () => {
  return getSetting('refreshInterval', 15);
});

ipcMain.on('set-refresh-interval', (event, minutes) => {
  setSetting('refreshInterval', minutes);
  if (tray) {
    updatePollingInterval(tray, minutes);
  }
});
