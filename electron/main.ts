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
import { existsSync, promises as fsPromises } from 'fs';
import { exec, spawn } from 'child_process';
import AutoLaunch from 'auto-launch';
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import { startPolling, refreshAll, updatePollingInterval } from './poller.js';
import {
  saveSession,
  hasSession,
  deleteSession,
  getSetting,
  setSetting,
  getUsageHistory,
} from './secure-store.js';
import {
  debug,
  info,
  warn,
  error,
  getAllLogs,
  clearLogs,
  setTargetWindow,
} from './logger.js';

const _dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

function getExecutablePath(): string {
  if (process.platform === 'linux') {
    const path = process.env.APPIMAGE || app.getPath('exe');
    debug('Resolved executable path', {
      source: process.env.APPIMAGE ? 'APPIMAGE' : 'exe',
      path,
    });
    return path;
  }
  const path = app.getPath('exe');
  debug('Resolved executable path', { source: 'exe', path });
  return path;
}

const DEFAULT_ICON_SETTINGS = {
  thresholdWarning: 50,
  thresholdCritical: 80,
  historyPeriod: 'week' as const,
  showCodeReview: true,
  coloringMode: 'standard' as const,
  rateMinPercent: 5,
  excludedMetrics: [],
  glassMode: true,
  providerColors: {
    z_ai: '#10b981',
    claude: '#f59e0b',
    codex: '#10b981',
    gemini: '#4285f4',
    external_models: '#8b5cf6',
  },
};

info('--- MAIN PROCESS STARTING ---');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let debugWindow: BrowserWindow | null = null;
let usageDetailsWindow: BrowserWindow | null = null;

function createWindow() {
  const preloadPath =
    process.env.NODE_ENV === 'development'
      ? path.join(_dirname, '../dist-electron/preload.cjs')
      : path.join(_dirname, 'preload.cjs');

  debug('Preload path', { preloadPath });

  if (!existsSync(preloadPath)) {
    error('Preload file not found at path', { path: preloadPath });
  } else {
    debug('Preload file verified', { path: preloadPath });
  }

  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    show: false, // Start hidden
    frame: false,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    icon: path.join(_dirname, 'assets/icon.png'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  setTargetWindow(mainWindow);

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
    { label: 'Codex: --%', enabled: false },
    { label: 'Antigravity: --%', enabled: false },
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

      // Get current window size to ensure correct positioning
      // (height might have changed due to content resizing)
      const bounds = mainWindow?.getBounds();
      const width = bounds?.width || 400;
      const height = bounds?.height || 600;

      const x = workArea.x + workArea.width - width;
      const y = workArea.y + workArea.height - height;

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

interface CaptureState {
  requestHeadersMap: Map<string, Record<string, string>>;
  interestingRequests: Map<string, string>;
  bestCandidate: {
    url: string;
    headers: Record<string, string>;
    body: string;
    score: number;
  } | null;
  hasNavigatedToUsagePage: boolean;
  fallbackTimeout: NodeJS.Timeout | null;
}

function setupCaptureFor(
  webContents: Electron.WebContents,
  provider: 'z_ai' | 'claude' | 'codex' | 'gemini' | 'external_models',
  onComplete: (data: { url: string; headers: Record<string, string> }) => void
): CaptureState {
  const state: CaptureState = {
    requestHeadersMap: new Map(),
    interestingRequests: new Map(),
    bestCandidate: null,
    hasNavigatedToUsagePage: false,
    fallbackTimeout: null,
  };

  try {
    webContents.debugger.attach('1.3');
    info('Debugger attached', { windowId: webContents.id, provider });
  } catch (err) {
    error('Debugger attach failed', {
      windowId: webContents.id,
      error: err instanceof Error ? err.message : String(err),
      provider,
      detail:
        'This is critical - if this fails in production, network interception will not work',
    });
  }

  webContents.debugger.on('detach', (event, reason) => {
    info('Debugger detached', { windowId: webContents.id, reason, provider });
  });

  webContents.on('did-navigate', (event, url) => {
    info('Window navigation', {
      windowId: webContents.id,
      url,
      isMainFrame: true,
      provider,
    });

    if (
      provider === 'codex' &&
      url.includes('chatgpt.com/codex/settings/usage')
    ) {
      state.hasNavigatedToUsagePage = true;
    }
  });

  webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
    info('Page navigation', {
      windowId: webContents.id,
      url,
      isMainFrame,
      provider,
    });

    if (
      provider === 'codex' &&
      isMainFrame &&
      url.includes('chatgpt.com/codex/settings/usage')
    ) {
      state.hasNavigatedToUsagePage = true;
    }
  });

  const handleCaptureComplete = (candidate: {
    url: string;
    headers: Record<string, string>;
  }) => {
    if (state.fallbackTimeout) {
      clearTimeout(state.fallbackTimeout);
      state.fallbackTimeout = null;
    }

    const cleanHeaders = { ...candidate.headers };
    Object.keys(cleanHeaders).forEach((k) => {
      if (k.toLowerCase() === 'cookie') {
        delete cleanHeaders[k];
      }
    });

    info('Capture complete', {
      windowId: webContents.id,
      url: candidate.url,
      provider,
    });
    info('Successfully captured session', { provider, url: candidate.url });
    onComplete({ url: candidate.url, headers: cleanHeaders });
  };

  webContents.debugger.on('message', async (event, method, params) => {
    if (method === 'Network.requestWillBeSent') {
      if (provider === 'z_ai') {
        debug('Z.ai Navigation', { url: params.request.url });
      }

      state.requestHeadersMap.set(params.requestId, params.request.headers);

      const pageUrl = params.request.url;
      const isZaiUsagePage = pageUrl.includes(
        'z.ai/manage-apikey/subscription'
      );
      const isClaudeUsagePage = pageUrl.includes('claude.ai/settings/usage');
      const isCodexUsagePage = pageUrl.includes(
        'chatgpt.com/codex/settings/usage'
      );

      if (provider === 'z_ai' && isZaiUsagePage) {
        debug('Checking if Z.ai usage page', {
          url: pageUrl,
          isMatch: isZaiUsagePage,
        });
        state.hasNavigatedToUsagePage = true;
        info('User navigated to usage page', {
          provider: 'z_ai',
          url: pageUrl,
        });
      } else if (provider === 'claude' && isClaudeUsagePage) {
        state.hasNavigatedToUsagePage = true;
        info('User navigated to usage page', { provider: 'claude' });
      } else if (provider === 'codex' && isCodexUsagePage) {
        state.hasNavigatedToUsagePage = true;
        info('User navigated to usage page', {
          provider: 'codex',
          url: pageUrl,
        });
      }
    }

    if (method === 'Network.responseReceived') {
      const url = params.response.url;
      const requestId = params.requestId;

      if (!state.hasNavigatedToUsagePage && provider !== 'codex') {
        return;
      }

      if (provider === 'z_ai') {
        const isZaiApi = url.includes('/api/monitor/usage/quota/limit');

        if (isZaiApi) {
          debug('Z.ai candidate URL', { url });
          state.interestingRequests.set(requestId, url);
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
          debug('Claude candidate URL', { url });
          state.interestingRequests.set(requestId, url);
        }
      } else if (provider === 'codex') {
        const isCodexUsageApi = url.includes('/backend-api/wham/usage');
        const isStatic =
          url.match(/\.(js|css|png|svg|jpg|woff2?|ico|json)$/) ||
          url.includes('_next/static');

        if (isCodexUsageApi && !isStatic) {
          debug('Codex candidate URL', { url });
          state.interestingRequests.set(requestId, url);
        }
      }
    }

    if (method === 'Network.loadingFinished') {
      const requestId = params.requestId;
      if (state.interestingRequests.has(requestId)) {
        const url = state.interestingRequests.get(requestId)!;
        try {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const { body } = await webContents.debugger.sendCommand(
            'Network.getResponseBody',
            { requestId }
          );

          if (!body) {
            debug('Empty body, skipping', { url });
            return;
          }

          let score = 0;
          const headers = state.requestHeadersMap.get(requestId);

          if (provider === 'z_ai') {
            if (url.includes('/api/monitor/usage/quota/limit')) score += 50;

            if (
              body.includes('percent') ||
              body.includes('quota') ||
              body.includes('limit')
            )
              score += 5;
          } else if (provider === 'claude') {
            if (body.includes('percent_used')) score += 10;
            if (body.includes('resets_at')) score += 10;
            if (body.includes('utilization')) score += 5;
            if (body.includes('limits')) score += 5;

            if (url.includes('/api/organizations/') && url.includes('/usage'))
              score += 25;
            if (url.includes('/account/usage')) score += 15;
          } else if (provider === 'codex') {
            if (url.includes('/backend-api/wham/usage')) score += 50;
            if (body.includes('rate_limit')) score += 10;
            if (body.includes('code_review_rate_limit')) score += 10;
            if (body.includes('used_percent')) score += 5;
          }

          if (score > 0) {
            const meetsThreshold = score >= 35;
            info('Response scored', { url, score, meetsThreshold, provider });
            debug('Candidate scored', { url, score });
            if (!state.bestCandidate || score > state.bestCandidate.score) {
              state.bestCandidate = {
                url,
                headers: headers || {},
                body,
                score,
              };
              debug('New best candidate found', { url, score });
            }

            if (meetsThreshold) {
              info('High-score match found, finishing capture', {
                url,
                score,
              });
              handleCaptureComplete({ url, headers: headers || {} });
            } else if (!state.fallbackTimeout) {
              info(
                'Medium-score candidate found, starting 5s fallback timeout',
                {
                  url,
                  score,
                }
              );
              state.fallbackTimeout = setTimeout(() => {
                if (state.bestCandidate) {
                  info('Fallback timeout reached, using best candidate', {
                    url: state.bestCandidate.url,
                  });
                  handleCaptureComplete({
                    url: state.bestCandidate.url,
                    headers: state.bestCandidate.headers,
                  });
                }
              }, 5000);
            }
          }
        } catch (e) {
          error('Error retrieving body', {
            url,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        state.interestingRequests.delete(requestId);
      }
      state.requestHeadersMap.delete(requestId);
    }

    if (method === 'Network.loadingFailed') {
      const requestId = params.requestId;
      state.interestingRequests.delete(requestId);
      state.requestHeadersMap.delete(requestId);
    }
  });

  webContents.debugger.sendCommand('Network.enable');

  return state;
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  if (tray) {
    startPolling(tray);
  }

  const autoUpdate = getSetting('autoUpdate', true);
  if (autoUpdate) {
    autoUpdater.checkForUpdatesAndNotify();
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

app.on('before-quit', () => {
  app.isQuitting = true;
});

function authenticateProvider(
  provider: 'z_ai' | 'claude' | 'codex' | 'gemini' | 'external_models'
) {
  let activeWindows: Set<Electron.BrowserWindow> = new Set();
  const authWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(_dirname, 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url =
    provider === 'z_ai'
      ? 'https://z.ai/login'
      : provider === 'claude'
        ? 'https://claude.ai/login'
        : 'https://chatgpt.com/codex/settings/usage';

  setupCaptureFor(authWindow.webContents, provider, (data) => {
    handleCaptureComplete(provider, data, authWindow, activeWindows);
  });

  authWindow.loadURL(url);

  authWindow.webContents.on('did-create-window', (childWindow, details) => {
    info('Child window created', {
      url: details.url,
      disposition: details.disposition,
      parentWindowId: authWindow.webContents.id,
      childWindowId: childWindow.webContents.id,
      isParentDestroyed: authWindow.isDestroyed(),
      isChildDestroyed: childWindow.isDestroyed(),
      provider,
    });

    if (provider === 'codex') {
      activeWindows.add(childWindow);
      setupCaptureFor(childWindow.webContents, provider, (data) => {
        handleCaptureComplete(provider, data, childWindow, activeWindows);
      });

      childWindow.on('closed', () => {
        info('Child window closed', {
          windowId: childWindow.webContents.id,
          provider,
        });
        activeWindows.delete(childWindow);
      });
    }
  });

  // Show instructions to user
  // const instructionUrl = provider === 'z_ai'
  //   ? 'https://z.ai/manage-apikey/subscription'
  //   : 'https://claude.ai/settings/usage';

  authWindow.webContents.on('did-finish-load', () => {
    const instructionText =
      provider === 'codex'
        ? 'Please ensure you are on the Codex usage page to complete setup'
        : 'Please navigate to Subscription -> Click "Usage" Tab to complete setup';
    authWindow.webContents
      .executeJavaScript(
        `
      if (!document.querySelector('#usage-tracker-instruction')) {
        const banner = document.createElement('div');
        banner.id = 'usage-tracker-instruction';
        banner.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #10b981; color: white; padding: 12px 20px; text-align: center; z-index: 999999; font-family: system-ui; font-size: 14px; font-weight: 500; box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
        banner.innerHTML = '${instructionText}';
        document.body.prepend(banner);
      }
    `
      )
      .catch(() => {});
  });

  const handleCaptureComplete = (
    p: 'z_ai' | 'claude' | 'codex' | 'gemini' | 'external_models',
    candidate: { url: string; headers: Record<string, string> },
    window: BrowserWindow = authWindow,
    windows?: Set<Electron.BrowserWindow>
  ) => {
    const cleanHeaders = { ...candidate.headers };
    Object.keys(cleanHeaders).forEach((k) => {
      if (k.toLowerCase() === 'cookie') {
        delete cleanHeaders[k];
      }
    });

    info('Successfully captured session', { provider: p, url: candidate.url });
    saveSession(p, { url: candidate.url, headers: cleanHeaders });

    if (!window.isDestroyed()) {
      window.close();
    }

    if (windows) {
      windows.forEach((w) => {
        if (!w.isDestroyed() && w !== window) {
          w.close();
        }
      });
    }

    mainWindow?.webContents.send('provider-connected', p);
  };
}

// Get all provider CLI commands
ipcMain.handle('get-provider-commands', () => {
  return getSetting('providerCommands', {
    z_ai: '',
    claude: '',
    codex: '',
    gemini: '',
    external_models: '',
  });
});

ipcMain.handle('get-usage-history', () => {
  return getUsageHistory();
});

// Set CLI command for a specific provider
ipcMain.on('set-provider-command', (event, { provider, command }) => {
  const commands = getSetting('providerCommands', {
    z_ai: '',
    claude: '',
    codex: '',
    gemini: '',
    external_models: '',
  }) as Record<string, string>;
  commands[provider] = command;
  setSetting('providerCommands', commands);
  info('Provider command updated', { provider, command });
});

// Start a session by executing the CLI command
ipcMain.on('start-session', async (event, provider) => {
  info('Start session requested', { provider });

  // Validate provider
  if (!provider || typeof provider !== 'string') {
    error('Invalid provider received', { providerType: typeof provider });
    return;
  }

  let commands: Record<string, string>;
  try {
    commands = getSetting('providerCommands', {
      z_ai: '',
      claude: '',
      codex: '',
      gemini: '',
      external_models: '',
    }) as Record<string, string>;
  } catch (err) {
    error('Failed to load commands', {
      error: String(err),
    });
    return;
  }

  const command = commands[provider];

  if (!command || typeof command !== 'string' || command.trim() === '') {
    warn('No command configured', { provider });
    return;
  }

  const trimmedCommand = command.trim();
  info('Preparing to spawn command', { provider, command: trimmedCommand });

  try {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';
    const shellArgs = isWindows
      ? ['/c', trimmedCommand]
      : ['-c', trimmedCommand];

    // Spawn command in background, detached
    const child = spawn(shell, shellArgs, {
      detached: true,
      stdio: 'ignore',
      shell: false,
    });

    // Handle potential immediate spawn errors
    child.on('error', (spawnError) => {
      error('Spawn error occurred', {
        provider,
        error: spawnError.message,
        name: spawnError.name,
      });
    });

    if (child.pid) {
      child.unref(); // Allow parent to exit without waiting for child
      info('Session started', { provider, pid: child.pid });
    } else {
      warn('Session started but no PID returned', { provider });
    }
  } catch (err) {
    error('Failed to execute spawn', {
      provider,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
});

function getLinuxAutostartFile(): string {
  return path.join(
    app.getPath('home'),
    '.config',
    'autostart',
    'coding-plan-usage.desktop'
  );
}

// IPC handlers
ipcMain.handle('get-auto-launch', async () => {
  if (process.platform === 'linux') {
    return existsSync(getLinuxAutostartFile());
  }
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('set-auto-launch', async (event, enable) => {
  if (!app.isPackaged) {
    warn('Auto-launch is disabled in development mode');
    return;
  }

  const execPath = getExecutablePath();
  info('Setting auto-launch', { enable, platform: process.platform, execPath });

  if (process.platform === 'linux') {
    const desktopFile = getLinuxAutostartFile();
    try {
      if (enable) {
        const dir = path.dirname(desktopFile);
        if (!existsSync(dir)) {
          await fsPromises.mkdir(dir, { recursive: true });
        }

        // IMPORTANT: Exec path must be quoted to handle spaces
        const desktopContent = `[Desktop Entry]
Type=Application
Version=1.0
Name=coding-plan-usage
Comment=Start coding-plan-usage on startup
Exec="${execPath}"
StartupNotify=false
Terminal=false
`;
        await fsPromises.writeFile(desktopFile, desktopContent, 'utf-8');

        info('Auto-launch enabled successfully (manual)', {
          platform: 'linux',
          file: desktopFile,
        });
      } else {
        if (existsSync(desktopFile)) {
          await fsPromises.unlink(desktopFile);
        }
        info('Auto-launch disabled successfully (manual)', {
          platform: 'linux',
        });
      }
    } catch (err) {
      error('Failed to set auto-launch on Linux', {
        enable,
        execPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: execPath,
    });
    info('Auto-launch set successfully', {
      platform: process.platform,
      enable,
      execPath,
    });
  }
});

ipcMain.on('connect-provider', (event, provider) => {
  info('Connect request for provider', { provider });
  if (provider === 'z_ai' || provider === 'claude' || provider === 'codex') {
    authenticateProvider(provider);
  }
});

ipcMain.handle('get-provider-status', () => {
  return {
    z_ai: hasSession('z_ai'),
    claude: hasSession('claude'),
    codex: hasSession('codex'),
    gemini: hasSession('gemini'),
    external_models: hasSession('external_models'),
  };
});

ipcMain.on('refresh-usage', () => {
  if (tray) {
    refreshAll(tray);
  }
});

ipcMain.on('disconnect-provider', (event, provider) => {
  info('Disconnect request for provider', { provider });
  if (
    provider === 'z_ai' ||
    provider === 'claude' ||
    provider === 'codex' ||
    provider === 'gemini' ||
    provider === 'external_models'
  ) {
    deleteSession(provider);
    mainWindow?.webContents.send('provider-disconnected', provider);
  }
});

ipcMain.on('quit-app', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.handle('get-provider-order', () => {
  return getSetting('providerOrder', [
    'codex',
    'claude',
    'gemini',
    'external_models',
    'z_ai',
  ]);
});

ipcMain.on('set-provider-order', (event, order) => {
  setSetting('providerOrder', order);
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

ipcMain.handle('get-icon-settings', () => {
  return getSetting('iconSettings', DEFAULT_ICON_SETTINGS);
});

ipcMain.on('set-icon-settings', (event, settings) => {
  setSetting('iconSettings', settings);
  if (tray) {
    refreshAll(tray);
  }
});

ipcMain.handle('get-provider-accent-colors', () => {
  const iconSettings = getSetting('iconSettings', DEFAULT_ICON_SETTINGS);
  return (
    iconSettings.providerColors || {
      z_ai: '#10b981',
      claude: '#f59e0b',
      codex: '#10b981',
      gemini: '#4285f4',
      external_models: '#8b5cf6',
    }
  );
});

ipcMain.handle(
  'set-provider-accent-color',
  async (event, { provider, color }) => {
    try {
      if (
        provider !== 'z_ai' &&
        provider !== 'claude' &&
        provider !== 'codex' &&
        provider !== 'gemini' &&
        provider !== 'external_models'
      ) {
        return { success: false, error: 'Invalid provider' };
      }
      const iconSettings = getSetting('iconSettings', DEFAULT_ICON_SETTINGS);
      if (!iconSettings.providerColors) {
        iconSettings.providerColors = {
          z_ai: '#10b981',
          claude: '#f59e0b',
          codex: '#10b981',
          gemini: '#4285f4',
          external_models: '#8b5cf6',
        };
      }
      iconSettings.providerColors[
        provider as 'z_ai' | 'claude' | 'codex' | 'gemini' | 'external_models'
      ] = color;
      setSetting('iconSettings', iconSettings);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
);

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-auto-update', () => {
  return getSetting('autoUpdate', true);
});

ipcMain.on('set-auto-update', (event, enable) => {
  setSetting('autoUpdate', enable);
});

ipcMain.handle('get-logs', () => {
  return getAllLogs();
});

ipcMain.on('clear-logs', () => {
  clearLogs();
});

autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('update-status', { type: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-status', {
    type: 'available',
    version: info.version,
  });
});

autoUpdater.on('update-not-available', (info) => {
  mainWindow?.webContents.send('update-status', {
    type: 'not-available',
    version: info.version,
  });
});

autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('update-status', {
    type: 'error',
    error: err.message,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-status', {
    type: 'downloaded',
    version: info.version,
  });
});

autoUpdater.on('download-progress', (info) => {
  mainWindow?.webContents.send('update-status', {
    type: 'downloading',
    progress: {
      percent: info.percent,
      transferred: info.transferred,
      total: info.total,
    },
  });
});

ipcMain.on('check-for-update', async () => {
  try {
    if (process.env.NODE_ENV === 'development') {
      // In development, we might not have a valid update configuration
      // Simulate a check with a delay to verify UI behavior
      info('Development mode: Simulating update check');
      mainWindow?.webContents.send('update-status', { type: 'checking' });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate no update available for now (or error if preferred)
      // To test "update available", you could swap this logic
      mainWindow?.webContents.send('update-status', {
        type: 'not-available',
        version: app.getVersion(),
      });
      return;
    }

    info('Checking for updates');
    const result = await autoUpdater.checkForUpdates();
    debug('Update check result', { result });
    // Note: checkForUpdates() returns a Promise that resolves to UpdateCheckResult | null
    // If null, it means check was cancelled or no update info found.
    // Events like 'update-available' or 'update-not-available' should fire independently.

    if (!result) {
      // Sometimes result is null if check is skipped or fails silently?
      // Usually it throws if it fails.
    }
  } catch (err) {
    error('Error checking for updates', {
      error: err instanceof Error ? err.message : String(err),
    });
    mainWindow?.webContents.send('update-status', {
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

ipcMain.on('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('resize-window', (event, height) => {
  if (!mainWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const maxHeight = Math.floor(workArea.height * 0.9);
  const newHeight = Math.min(height, maxHeight);

  // We enforce a minimum height to ensure basic usability
  const finalHeight = Math.max(newHeight, 100);

  const currentBounds = mainWindow.getBounds();

  // Calculate new Y position to keep bottom anchored
  // Bottom Y = currentBounds.y + currentBounds.height
  // New Y = Bottom Y - finalHeight
  const bottomY = currentBounds.y + currentBounds.height;
  const newY = bottomY - finalHeight;

  mainWindow.setBounds({
    x: currentBounds.x,
    y: newY,
    width: currentBounds.width,
    height: finalHeight,
  });
});

ipcMain.on('open-debug-window', () => {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.focus();
    return;
  }

  const preloadPath =
    process.env.NODE_ENV === 'development'
      ? path.join(_dirname, '../dist-electron/preload.cjs')
      : path.join(_dirname, 'preload.cjs');

  debugWindow = new BrowserWindow({
    width: 800,
    height: 600,
    center: true,
    autoHideMenuBar: true,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    icon: path.join(_dirname, 'assets/icon.png'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const baseUrl =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173'
      : `file://${path.join(_dirname, '../dist/index.html')}`;

  debugWindow.loadURL(baseUrl + '#debug-logs');

  debugWindow.on('closed', () => {
    debugWindow = null;
  });
});

ipcMain.on('open-usage-details', () => {
  if (usageDetailsWindow && !usageDetailsWindow.isDestroyed()) {
    usageDetailsWindow.focus();
    return;
  }

  const preloadPath =
    process.env.NODE_ENV === 'development'
      ? path.join(_dirname, '../dist-electron/preload.cjs')
      : path.join(_dirname, 'preload.cjs');

  usageDetailsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: true,
    center: true,
    autoHideMenuBar: true,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    icon: path.join(_dirname, 'assets/icon.png'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    usageDetailsWindow.loadURL('http://localhost:5173#usage-details');
  } else {
    usageDetailsWindow.loadURL(
      `file://${path.join(_dirname, '../dist/index.html')}#usage-details`
    );
  }

  usageDetailsWindow.on('closed', () => {
    usageDetailsWindow = null;
  });
});
