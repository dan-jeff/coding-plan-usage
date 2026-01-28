import {
  Tray,
  net,
  app,
  Notification,
  BrowserWindow,
  nativeImage,
  type NativeImage,
} from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  getSession,
  hasSession,
  getSetting,
  addUsageHistory,
  type ProviderConfig,
} from './secure-store.js';
import { debug, info, warn, error } from './logger.js';
import { AntigravityClient } from './antigravity-client.js';

const _dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

let pollingIntervalId: NodeJS.Timeout | null = null;
let currentIntervalMinutes: number = 15;
let lastIconColor: 'red' | 'yellow' | 'green' | null = null;

const trayIconCache: Record<'red' | 'yellow' | 'green', NativeImage | null> = {
  red: null,
  yellow: null,
  green: null,
};

const ICON_GREEN =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABiklEQVR4AZRSPUvDQBh+79qkB3ayqOhipSJtJh2sa9F+gOhSSKj+ASchOHURQgc79xcIaj/QUfweHAQREUGEiruKm+Km0jvvTtO0MYg58pB7n/d5nrtcDoPH0HUWGGvMTMZrmYV4Pb2o1bNTqdRp0EMKXQHatq7GG+nibT77iBm+BAQ1AFSlwC6el9aeEvXManQ9RaBjtANiG9l+1no9A4bKvD/A4X76GECJEOU8sZkbtJsyQKysKmyXC5J244/3BFXofvRnJzKA0pcVL/PV3CHc5I9+ZSEG44SoRdHA4sCAIVMU/sCWxc7x9XwuwhCUOUw3+CGaiIcL/iC5Z94Vjjs1Jfb+FsFBAj33hZOKF8LhQEUlSPZGYmoFoe+5raUhRjD9bCF/W3fUwosVpffBofzNhBc3jZ0PfzZHLbzyNzqUr5n8dDtAFn7slgXSIwMsSxaS+E+IZQHWNOkBGSBMnETiYiSq08MArM2LngtdC0khN1OBpqG3WACFRrdmh0SYy2iXTGgNA6ggvgAAAP//fSk0rQAAAAZJREFUAwCyk5VkuKUwyAAAAABJRU5ErkJggg==';
const ICON_YELLOW =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABa0lEQVR4AZyTv0oDQRDGv9noZY2xMagogohd0qjgn0pT+gIJ6DMoHFZphDONdR5Ci7SCnVxMUMTe3kKtYiVqDMmNu0NOknBIvGGHvdmZ77e7t7sKEVYocIJr4xtcc/b5xjngxsRWPu+PRZRiAMCPcIygVD3ULyD1AKILgM4RBPf+6d4r150T9qHRZ78Avk3PoqkbAJ0BmDM+3GbAVIZK3nE9NR8mBWBnRqdzCfBmmPijXwN3r8KVCABN5zhK/LH+ifb2VxRrFUqXbELZHwaQi//bkV25qrpTGaO1+7aQQSe4xAJ3nxbfXey0+vJcxlsqo8zeJ2n3uxLl6XSi4miS3PKKUyEi+Q5rwYFW5iAJcU2BFKZbz3H1Vqsoh3ZcgNWquGKjk62HAAnM4MjN8yAaAXieBDIwCsHzoLJZ0Zgz6CnMINmLwdd6ydxKAfdSw93ARFJoxIF1ylW75j0m2U8tWNiwshezrS0WEdj4BwAA//8PB22gAAAABklEQVQDAGD0gHvD3XeeAAAAAElFTkSuQmCC';
const ICON_RED =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABhUlEQVR4AZySz0sCQRTH3xtrM/SU9BMiwpteElOhk5Q/oPsK9T8ESycvweKhPXvvWgQdo+gH1KGIsLMeyk0P2bUIjEjX18yUorZE7jBvmfed9/3M29llYDNUlVxmZCViLibXzGhi/T6cisXjl0M2pdADKAZUxYwkskY1VSNgBULYI8Jdxuh2p779XI4ktyrxuLsb1AGUl1ITiuf1igANXjDJo3+OcyFn1YdvquH0NF/LKQFFfjI16BABolL9+xGyWOu48tOJBLg9L5t25qmLE5i9Pv2FI4CF5ruSFRtMXBgBaiIZKIg2ROfMqKV9CGDw0PoDEDQklLpr/0jzF87kGgE03nrOM/rmY80mePx353m78HpdecWNcm/er+QRv9ft2g8XufkXshAcDkYWskZ97MmhH4SXBUsHn04Bwsvvwqkd5Ku3ATIZBKXrXQBdl8m/IboOLBCQHmh3AFxE8WM8hpbnAKij23TVc5As5OaWiGBJtWgYRx5iqzMCZmMWEonaTAZaIvkCAAD//001QCYAAAAGSURBVAMA/d+QHCH7AUwAAAAASUVORK5CYII=';

const DEFAULT_ICON_SETTINGS = {
  thresholdWarning: 50,
  thresholdCritical: 80,
  historyPeriod: 'week' as const,
  showCodeReview: true,
  coloringMode: 'standard' as const,
  rateMinPercent: 5,
  excludedMetrics: [],
};

interface IconSettings {
  thresholdWarning: number;
  thresholdCritical: number;
  historyPeriod: 'week' | 'month' | 'all';
  showCodeReview: boolean;
  coloringMode: 'standard' | 'rate';
  rateMinPercent: number;
  excludedMetrics: string[];
}

export interface UsageDetail {
  label: string; // e.g., "5-Hour", "7-Day"
  percentage: number; // 0-100
  limit: string | number; // Raw value if available
  used: string | number; // Raw value if available
  resetTime?: string; // ISO date
  displayReset?: string; // "4h 30m"
  timeRemainingMinutes?: number; // Raw minutes remaining
  totalDurationMinutes?: number; // Total duration of the window in minutes
}

export interface PollResult {
  provider: 'z_ai' | 'claude' | 'codex' | 'gemini' | 'external_models';
  usage: string | null; // Keep for backward compatibility (Max %)
  details: UsageDetail[]; // New field
  error?: string;
}

interface UsageMatch {
  value: number;
  resetTime?: string | number;
  keySource?: string;
  label?: string;
  used?: string | number;
  limit?: string | number;
  keyContext?: string[];
}

// Track notification state to avoid spamming
const notifiedState: Record<string, boolean> = {
  z_ai: false,
  claude: false,
  codex: false,
  gemini: false,
  external_models: false,
};

// Add property to app to track quitting state
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Electron {
    interface App {
      isQuitting: boolean;
    }
  }
}

export function startPolling(tray: Tray) {
  currentIntervalMinutes = getSetting('refreshInterval', 15);
  refreshAll(tray);
  schedulePolling(tray);
}

function schedulePolling(tray: Tray) {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
  pollingIntervalId = setInterval(
    () => refreshAll(tray),
    currentIntervalMinutes * 60 * 1000
  );
  info(`Polling scheduled every ${currentIntervalMinutes} minutes`);
}

export function updatePollingInterval(tray: Tray, minutes: number) {
  currentIntervalMinutes = minutes;
  schedulePolling(tray);
  info(`Polling interval updated to ${minutes} minutes`);
}

function getPrimaryMetric(details: UsageDetail[]): UsageDetail | undefined {
  const shortTermLimit = details.find((d) => d.label === '5-Hour Window');
  const fallbackLimit = details.find(
    (d) => d.label !== '5-Hour Window' && d.displayReset !== 'Unavailable'
  );
  return shortTermLimit || fallbackLimit || details[0];
}

export async function refreshAll(tray: Tray) {
  info('Starting poll cycle...');
  const results: PollResult[] = [];

  // Z.ai
  const zConfig = getSession('z_ai');
  if (zConfig) {
    debug('Z.ai is configured, fetching usage');
    try {
      const result = await fetchUsage(zConfig);
      results.push({ provider: 'z_ai', ...result });

      const primaryMetric = getPrimaryMetric(result.details);
      if (primaryMetric) {
        addUsageHistory('z_ai', primaryMetric.percentage);
      }

      notifyUsageUpdate('z_ai', result.usage, result.details);
    } catch (err) {
      const errorStr = String(err);
      error(`Error fetching Z.ai usage: ${errorStr}`);
      results.push({
        provider: 'z_ai',
        usage: 'Error',
        details: [],
        error: errorStr,
      });
      notifyUsageUpdate('z_ai', 'Error', []);
    }
  } else {
    debug('Z.ai is not configured');
  }

  // Claude
  const claudeConfig = getSession('claude');
  if (claudeConfig) {
    debug('Claude is configured, fetching usage');
    try {
      const result = await fetchUsage(claudeConfig);
      results.push({ provider: 'claude', ...result });

      const primaryMetric = getPrimaryMetric(result.details);
      if (primaryMetric) {
        addUsageHistory('claude', primaryMetric.percentage);
      }

      notifyUsageUpdate('claude', result.usage, result.details);
    } catch (err) {
      const errorStr = String(err);
      error(`Error fetching Claude usage: ${errorStr}`);
      results.push({
        provider: 'claude',
        usage: 'Error',
        details: [],
        error: errorStr,
      });
      notifyUsageUpdate('claude', 'Error', []);
    }
  } else {
    debug('Claude is not configured');
  }

  const codexConfig = getSession('codex');
  if (codexConfig) {
    debug('Codex is configured, fetching usage');
    try {
      const result = await fetchUsage(codexConfig, 'codex');
      results.push({ provider: 'codex', ...result });

      const primaryMetric = getPrimaryMetric(result.details);
      if (primaryMetric) {
        addUsageHistory('codex', primaryMetric.percentage);
      }

      notifyUsageUpdate('codex', result.usage, result.details);
    } catch (err) {
      const errorStr = String(err);
      error(`Error fetching Codex usage: ${errorStr}`);
      results.push({
        provider: 'codex',
        usage: 'Error',
        details: [],
        error: errorStr,
      });
      notifyUsageUpdate('codex', 'Error', []);
    }
  } else {
    debug('Codex is not configured');
  }

  const agClient = new AntigravityClient();
  debug('Checking Antigravity status');
  try {
    const splitStatus = await agClient.getStatus();
    debug(
      `[POLLER DEBUG] Gemini status: connected=${splitStatus.gemini.connected}, details.length=${splitStatus.gemini.details.length}, usagePercent=${splitStatus.gemini.usagePercent}`
    );
    debug(
      `[POLLER DEBUG] External status: connected=${splitStatus.external.connected}, details.length=${splitStatus.external.details.length}, usagePercent=${splitStatus.external.usagePercent}`
    );

    // Handle Gemini provider
    if (splitStatus.gemini.connected && splitStatus.gemini.details.length > 0) {
      const usageStr = `${splitStatus.gemini.usagePercent}%`;
      debug(
        `[POLLER DEBUG] Pushing Gemini to results: provider=gemini, usage=${usageStr}, details.length=${splitStatus.gemini.details.length}`
      );
      results.push({
        provider: 'gemini',
        usage: usageStr,
        details: splitStatus.gemini.details,
      });

      addUsageHistory('gemini', splitStatus.gemini.usagePercent);
      debug(
        `[POLLER DEBUG] Calling notifyUsageUpdate with: provider=gemini, usage=${usageStr}, details.length=${splitStatus.gemini.details.length}`
      );
      notifyUsageUpdate('gemini', usageStr, splitStatus.gemini.details);
      debug('[POLLER DEBUG] notifyUsageUpdate completed for Gemini');
    } else {
      debug('Gemini is not connected or has no usage data');
      results.push({
        provider: 'gemini',
        usage: null,
        details: [],
      });
    }

    // Handle External Models provider
    if (
      splitStatus.external.connected &&
      splitStatus.external.details.length > 0
    ) {
      const usageStr = `${splitStatus.external.usagePercent}%`;
      debug(
        `[POLLER DEBUG] Pushing External Models to results: provider=external_models, usage=${usageStr}, details.length=${splitStatus.external.details.length}`
      );
      results.push({
        provider: 'external_models',
        usage: usageStr,
        details: splitStatus.external.details,
      });

      addUsageHistory('external_models', splitStatus.external.usagePercent);
      debug(
        `[POLLER DEBUG] Calling notifyUsageUpdate with: provider=external_models, usage=${usageStr}, details.length=${splitStatus.external.details.length}`
      );
      notifyUsageUpdate(
        'external_models',
        usageStr,
        splitStatus.external.details
      );
      debug('[POLLER DEBUG] notifyUsageUpdate completed for External Models');
    } else {
      debug('External Models is not connected or has no usage data');
      results.push({
        provider: 'external_models',
        usage: null,
        details: [],
      });
    }
  } catch (err) {
    const errorStr = String(err);
    error(`Error fetching Antigravity status: ${errorStr}`);
    results.push({
      provider: 'gemini',
      usage: null,
      details: [],
    });
    results.push({
      provider: 'external_models',
      usage: null,
      details: [],
    });
  }

  updateTray(tray, results);
}

function notifyUsageUpdate(
  provider: string,
  usage: string | null,
  details: UsageDetail[] = []
) {
  debug(
    `[NOTIFY DEBUG] notifyUsageUpdate called: provider=${provider}, usage=${usage}, details.length=${details.length}`
  );
  const wins = BrowserWindow.getAllWindows();
  debug(`[NOTIFY DEBUG] Found ${wins.length} browser windows`);
  wins.forEach((win, index) => {
    debug(
      `[NOTIFY DEBUG] Sending usage-update to window ${index}: ${JSON.stringify({ provider, usage, details })}`
    );
    win.webContents.send('usage-update', { provider, usage, details });
  });
  debug('[NOTIFY DEBUG] notifyUsageUpdate completed');
}

function fetchUsage(
  config: ProviderConfig,
  provider: string = ''
): Promise<{ usage: string | null; details: UsageDetail[] }> {
  return new Promise((resolve, reject) => {
    let requestUrl = config.url;
    if (
      provider === 'codex' &&
      (requestUrl.includes('/codex/settings/usage') ||
        requestUrl.includes('/codex/settings/usage.data') ||
        requestUrl.includes('daily-token-usage-breakdown'))
    ) {
      requestUrl = 'https://chatgpt.com/backend-api/wham/usage';
    }
    debug(`Fetching usage from URL: ${requestUrl} (provider: ${provider})`);
    const request = net.request({
      url: requestUrl,
      useSessionCookies: true, // In case cookies are needed
    });

    // Apply headers
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        // Electron's net.request might fail if we set unsafe headers like 'Host' or 'Content-Length' manually
        // but usually copying captured headers works. We'll try to set them all.
        try {
          if (
            key.toLowerCase() !== 'content-length' &&
            key.toLowerCase() !== 'host' &&
            key.toLowerCase() !== 'cookie'
          ) {
            request.setHeader(key, value);
          }
        } catch (e) {
          warn(`Could not set header ${key}: ${e}`);
        }
      }
    }

    let responseBody = '';

    request.on('response', (response) => {
      const contentType = response.headers['content-type'] || 'unknown';
      debug(
        `Response received: status ${response.statusCode}, content-type: ${contentType}`
      );

      response.on('data', (chunk) => {
        responseBody += chunk.toString();
      });

      response.on('end', () => {
        debug(`Response complete: total length ${responseBody.length} bytes`);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            let parsed;
            if (provider === 'codex') {
              const trimmedBody = responseBody.trim();
              parsed = trimmedBody.startsWith('{')
                ? parseCodexUsage(trimmedBody)
                : parseCodexHtml(responseBody);
            } else {
              parsed = parseUsage(responseBody);
            }
            resolve(parsed);
          } catch (err) {
            const errorStr = String(err);
            error(
              `Failed to parse response body. First 500 chars: ${responseBody.slice(0, 500)}`
            );
            reject(new Error(`Parse error: ${errorStr}`));
          }
        } else {
          error(
            `HTTP error: status ${response.statusCode}. First 500 chars: ${responseBody.slice(0, 500)}`
          );
          reject(new Error(`Status code: ${response.statusCode}`));
        }
      });

      response.on('error', (error) => {
        reject(error);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });
}

function parseUsage(body: string): {
  usage: string | null;
  details: UsageDetail[];
} {
  try {
    debug('Parsing response as JSON...');
    const json = JSON.parse(body);
    debug('JSON parse succeeded');

    const matches = findAllUsages(json);
    debug(`Found ${matches.length} usage matches in JSON`);

    if (matches.length === 0) {
      warn('No usage matches found in JSON');
      return { usage: null, details: [] };
    }

    const aggregatedDetails: Record<string, UsageDetail> = {};
    let maxUsage = 0;
    let primaryResetTime: string | undefined;

    for (const match of matches) {
      let p = match.value;

      if (match.keySource === 'percent_used' && p <= 1.0) {
        p = p * 100;
      }

      if (p > maxUsage) {
        maxUsage = p;
      }

      let label = match.label;
      let totalDurationMinutes: number | undefined;

      if (match.resetTime) {
        const resetDate = new Date(match.resetTime);
        if (!isNaN(resetDate.getTime())) {
          const diff = resetDate.getTime() - Date.now();
          // 5-Hour Window (<= 6 hours)
          if (diff <= 21600000) {
            label = '5-Hour Window';
            totalDurationMinutes = 300;
          }
          // Weekly Limit (> 24h AND <= 8 days)
          else if (diff > 86400000 && diff <= 691200000) {
            label = 'Weekly Limit';
            totalDurationMinutes = 10080; // 7 days * 24h * 60m
          }
          // Monthly Limit (> 8 days AND <= 32 days)
          else if (diff > 691200000 && diff <= 2764800000) {
            label = 'Monthly Limit';
            totalDurationMinutes = 43200; // 30 days
          } else if (!label) {
            label = 'Token Usage';
          }
        }
      }

      if (!label) {
        continue;
      }

      let displayReset: string | undefined;
      let timeRemainingMinutes: number | undefined;

      if (match.resetTime) {
        const resetDate = new Date(match.resetTime);
        if (!isNaN(resetDate.getTime()) && resetDate.getTime() > Date.now()) {
          const diff = resetDate.getTime() - Date.now();
          const totalMinutes = Math.round(diff / (1000 * 60));
          timeRemainingMinutes = totalMinutes;
          displayReset = formatTime(totalMinutes);
        }
      }

      const newEntry: UsageDetail = {
        label,
        percentage: Math.round(p),
        limit: match.limit || '',
        used: match.used || '',
        resetTime: match.resetTime ? String(match.resetTime) : undefined,
        displayReset: displayReset || 'Unavailable',
        timeRemainingMinutes,
        totalDurationMinutes,
      };

      const currentEntry = aggregatedDetails[label];
      let isBetter = true;

      if (currentEntry) {
        const currentHasReset =
          currentEntry.displayReset !== 'Unavailable' && currentEntry.resetTime;
        const newHasReset =
          newEntry.displayReset !== 'Unavailable' && newEntry.resetTime;

        if (newHasReset && !currentHasReset) {
          isBetter = true;
        } else if (!newHasReset && currentHasReset) {
          isBetter = false;
        } else if (newHasReset === currentHasReset) {
          if (newEntry.percentage > currentEntry.percentage) {
            isBetter = true;
          } else if (newEntry.percentage < currentEntry.percentage) {
            isBetter = false;
          } else if (
            newEntry.limit &&
            currentEntry.limit &&
            newEntry.used !== '' &&
            currentEntry.used !== ''
          ) {
            isBetter = false;
          }
        }
      }

      if (isBetter) {
        aggregatedDetails[label] = newEntry;
      }
    }

    let details = Object.values(aggregatedDetails);

    details.sort((a, b) => {
      const getPriority = (d: UsageDetail): number => {
        if (d.label === '5-Hour Window') return 0;
        if (/week|weekly|7.day/i.test(d.label)) return 1;
        if (/search|web|zread|mcp/i.test(d.label)) return 2;
        return 3;
      };
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return b.percentage - a.percentage;
    });

    const shortTermLimit = details.find((d) => d.label === '5-Hour Window');
    const fallbackLimit = details.find(
      (d) => d.label !== '5-Hour Window' && d.displayReset !== 'Unavailable'
    );
    const primaryMetric = shortTermLimit || fallbackLimit || details[0];

    if (primaryMetric) {
      const percentage = primaryMetric.percentage;
      let extraText = '';

      if (
        primaryMetric.displayReset &&
        primaryMetric.displayReset !== 'Unavailable'
      ) {
        extraText = ` (Resets in ${primaryMetric.displayReset})`;
      }

      primaryResetTime = primaryMetric.resetTime;

      debug(
        `Parsed usage: ${percentage}%${extraText}, Details: ${details.map((d) => `${d.label}: ${d.percentage}%`).join(', ')}`
      );
      return {
        usage: `${percentage}%${extraText}`,
        details,
      };
    }

    debug('No valid usage data found in JSON');
    return { usage: null, details };
  } catch {
    warn('JSON parse failed or not a JSON object, checking regex fallback');
    warn(`First 500 chars of body: ${body.slice(0, 500)}`);
  }

  const regex = /"(\d+(?:\.\d+)?)%"/;
  const match = body.match(regex);
  if (match) {
    const p = Math.round(Number(match[1]));
    debug(`Regex fallback found value: ${p}%`);
    const details = [
      {
        label: 'Token Usage',
        percentage: p,
        limit: '',
        used: '',
        displayReset: 'Unavailable',
      },
      {
        label: '5-Hour Window',
        percentage: 0,
        limit: '',
        used: '',
        displayReset: 'Unavailable',
      },
    ];
    return {
      usage: `${p}%`,
      details,
    };
  }

  debug('Regex fallback found no matches');
  return { usage: null, details: [] };
}

function parseCodexUsage(body: string): {
  usage: string | null;
  details: UsageDetail[];
} {
  debug('Parsing Codex usage JSON response...');

  let json: {
    rate_limit?: {
      primary_window?: {
        used_percent?: number;
        limit_window_seconds?: number;
        reset_after_seconds?: number;
        reset_at?: number;
      };
      secondary_window?: {
        used_percent?: number;
        limit_window_seconds?: number;
        reset_after_seconds?: number;
        reset_at?: number;
      } | null;
    };
    code_review_rate_limit?: {
      primary_window?: {
        used_percent?: number;
        limit_window_seconds?: number;
        reset_after_seconds?: number;
        reset_at?: number;
      };
    };
  };

  try {
    json = JSON.parse(body) as typeof json;
  } catch (err) {
    warn(`Codex usage JSON parse failed: ${err}`);
    return { usage: null, details: [] };
  }

  const details: UsageDetail[] = [];

  const pushWindow = (
    label: string,
    window?: {
      used_percent?: number;
      limit_window_seconds?: number;
      reset_after_seconds?: number;
      reset_at?: number;
    } | null
  ) => {
    if (!window) return;

    const usedPercent = window.used_percent;
    const limitSeconds = window.limit_window_seconds;
    const resetAfterSeconds = window.reset_after_seconds;

    if (
      typeof usedPercent !== 'number' ||
      typeof limitSeconds !== 'number' ||
      typeof resetAfterSeconds !== 'number'
    ) {
      return;
    }

    const timeRemainingMinutes = Math.round(resetAfterSeconds / 60);
    const totalDurationMinutes = Math.round(limitSeconds / 60);
    const resetTime =
      typeof window.reset_at === 'number'
        ? new Date(window.reset_at * 1000).toISOString()
        : undefined;

    details.push({
      label,
      percentage: usedPercent,
      limit: '',
      used: '',
      displayReset: formatTime(timeRemainingMinutes),
      timeRemainingMinutes,
      totalDurationMinutes,
      resetTime,
    });
  };

  pushWindow('5-Hour Window', json.rate_limit?.primary_window);
  pushWindow('Weekly Limit', json.rate_limit?.secondary_window);
  pushWindow('Code Review', json.code_review_rate_limit?.primary_window);

  if (details.length === 0) {
    warn('No valid metrics found in Codex usage JSON');
    return { usage: null, details: [] };
  }

  details.sort((a, b) => {
    const getPriority = (d: UsageDetail): number => {
      if (d.label === '5-Hour Window') return 0;
      if (d.label === 'Weekly Limit') return 1;
      if (d.label === 'Code Review') return 2;
      return 3;
    };
    const priorityA = getPriority(a);
    const priorityB = getPriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;
    return b.percentage - a.percentage;
  });

  const primaryMetric = getPrimaryMetric(details);

  if (primaryMetric) {
    const percentage = primaryMetric.percentage;
    debug(
      `Codex parsed usage JSON: ${percentage}%, Details: ${details.map((d) => `${d.label}: ${d.percentage}%`).join(', ')}`
    );
    return {
      usage: `${percentage}%`,
      details,
    };
  }

  return { usage: null, details };
}

function parseCodexHtml(body: string): {
  usage: string | null;
  details: UsageDetail[];
} {
  debug('Parsing Codex HTML response...');

  const details: UsageDetail[] = [];

  const articleRegex = /<article[^>]*>[\s\S]*?<\/article>/g;
  const articles = body.match(articleRegex);

  if (!articles) {
    warn('No article elements found in Codex HTML');
    return { usage: null, details: [] };
  }

  for (const article of articles) {
    const paragraphMatch = article.match(/<p[^>]*>(.*?)<\/p>/);
    // Relaxed regex to match percentage followed by "remaining" text anywhere nearby
    const percentageMatch = article.match(
      /<span[^>]*>\s*(\d+)%\s*<\/span>[\s\S]*?remaining/i
    );

    if (!percentageMatch) {
      continue;
    }

    const remainingPercentage = parseInt(percentageMatch[1], 10);
    const usedPercentage = 100 - remainingPercentage;

    let label: string | undefined;
    if (paragraphMatch) {
      const text = paragraphMatch[1].trim();
      if (text === '5 hour usage limit') {
        label = '5-Hour Window';
      } else if (text === 'Weekly usage limit') {
        label = 'Weekly Limit';
      } else if (text === 'Code review') {
        label = 'Code Review';
      }
    }

    if (label) {
      details.push({
        label,
        percentage: usedPercentage,
        limit: '',
        used: '',
        displayReset: 'Unavailable',
      });
      debug(
        `Codex metric: ${label} - ${usedPercentage}% used (${remainingPercentage}% remaining)`
      );
    }
  }

  if (details.length === 0) {
    warn('No valid metrics found in Codex HTML');
    return { usage: null, details: [] };
  }

  details.sort((a, b) => {
    const getPriority = (d: UsageDetail): number => {
      if (d.label === '5-Hour Window') return 0;
      if (d.label === 'Weekly Limit') return 1;
      if (d.label === 'Code Review') return 2;
      return 3;
    };
    const priorityA = getPriority(a);
    const priorityB = getPriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;
    return b.percentage - a.percentage;
  });

  const primaryMetric = getPrimaryMetric(details);

  if (primaryMetric) {
    const percentage = primaryMetric.percentage;
    debug(
      `Codex parsed usage: ${percentage}%, Details: ${details.map((d) => `${d.label}: ${d.percentage}%`).join(', ')}`
    );
    return {
      usage: `${percentage}%`,
      details,
    };
  }

  return { usage: null, details };
}

function formatTime(totalMinutes: number): string {
  const roundedMinutes = Math.round(totalMinutes);
  if (roundedMinutes <= 0) return 'Resetting soon';

  if (roundedMinutes >= 1440) {
    const d = Math.floor(roundedMinutes / 1440);
    const h = Math.floor((roundedMinutes % 1440) / 60);
    return `${d}d ${h}h`;
  }

  const h = Math.floor(roundedMinutes / 60);
  const m = roundedMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function deriveLabelFromKey(key: string): string {
  const normalized = key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim();

  const words = normalized.split(/\s+/);
  const labelWords = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return labelWords;
}

function classifyLabelFromKey(key: string, parentKeys: string[]): string {
  const keyLower = key.toLowerCase();
  const fullContext = parentKeys.join('_').toLowerCase();
  const lastParent =
    parentKeys.length > 0
      ? parentKeys[parentKeys.length - 1].toLowerCase()
      : '';

  if (
    /session|five_hour|quota|time_limit/i.test(fullContext) ||
    /session|five_hour|quota|time_limit/i.test(lastParent)
  ) {
    return '5-Hour Window';
  }

  if (
    /week|weekly|7.day|seven.day/i.test(keyLower) ||
    /week|weekly|7.day|seven.day/i.test(fullContext) ||
    /week|weekly|7.day|seven.day/i.test(lastParent)
  ) {
    return 'Weekly Limit';
  }

  if (
    /search|web|zread|mcp/i.test(keyLower) ||
    /search|web|zread|mcp/i.test(fullContext) ||
    /search|web|zread|mcp/i.test(lastParent)
  ) {
    if (/mcp/i.test(keyLower)) return 'MCP Usage';
    if (/search|web/i.test(keyLower)) return 'Search Usage';
    return deriveLabelFromKey(key);
  }

  if (
    /token|billing|monthly|tokens_limit/i.test(fullContext) ||
    /token|billing|monthly|tokens_limit/i.test(lastParent)
  ) {
    return 'Token Usage';
  }

  if (/limit|quota/i.test(keyLower) || /limit|quota/i.test(lastParent)) {
    return deriveLabelFromKey(key);
  }

  return deriveLabelFromKey(key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findAllUsages(
  obj: any,
  depth: number = 0,
  parentKeys: string[] = []
): UsageMatch[] {
  if (depth > 5) return [];
  if (typeof obj !== 'object' || obj === null) return [];

  const matches: UsageMatch[] = [];
  const keys = Object.keys(obj);

  if (Array.isArray(obj)) {
    if (parentKeys.includes('limits')) {
      for (const item of obj) {
        if (
          item.type &&
          (item.type === 'TOKENS_LIMIT' || item.type === 'TIME_LIMIT')
        ) {
          const label =
            item.type === 'TIME_LIMIT' ? '5-Hour Window' : 'Token Usage';
          const pct =
            item.percentage !== undefined ? Number(item.percentage) : 0;
          const resetTime = item.nextResetTime || item.resetTime;

          matches.push({
            value: pct,
            label: label,
            resetTime: resetTime,
            limit: item.usage,
            used: item.currentValue,
            keySource: 'z_ai_limit_explicit',
          });
        }
      }
    }

    for (const item of obj) {
      matches.push(...findAllUsages(item, depth + 1, parentKeys));
    }
    return matches;
  }

  if (obj['type'] === 'TIME_LIMIT' || obj['type'] === 'TOKENS_LIMIT') {
    const label =
      obj['type'] === 'TIME_LIMIT' ? '5-Hour Window' : 'Token Usage';
    const pct = obj['percentage'] !== undefined ? Number(obj['percentage']) : 0;
    const resetTime = obj['nextResetTime'] || obj['resetTime'];

    matches.push({
      value: pct,
      label: label,
      resetTime: resetTime,
      limit: obj['usage'],
      used: obj['currentValue'],
      keySource: 'z_ai_limit',
    });
    return matches;
  }

  const lastParent =
    parentKeys.length > 0 ? parentKeys[parentKeys.length - 1] : '';
  const fullContext = parentKeys.join('_').toLowerCase();

  let label: string | undefined;
  if (
    /session|five_hour|quota|time_limit/i.test(fullContext) ||
    /session|five_hour|quota|time_limit/i.test(lastParent)
  ) {
    label = '5-Hour Window';
  } else if (
    /token|billing|monthly|seven_day|tokens_limit/i.test(fullContext) ||
    /token|billing|monthly|seven_day|tokens_limit/i.test(lastParent)
  ) {
    label = 'Token Usage';
  } else if (lastParent === 'limits') {
    if (obj['type'] === 'TIME_LIMIT') {
      label = '5-Hour Window';
    } else if (obj['type'] === 'TOKENS_LIMIT') {
      label = 'Token Usage';
    }
  }

  const percentKey = keys.find((k) =>
    /percent|percentage|usage_percent|utilization/i.test(k)
  );
  if (percentKey) {
    const val = obj[percentKey];
    let numVal: number | undefined;

    if (typeof val === 'number') numVal = val;
    else if (typeof val === 'string') {
      const parsed = parseFloat(val.replace('%', ''));
      if (!isNaN(parsed)) numVal = parsed;
    }

    if (numVal !== undefined) {
      const resetKey = keys.find((k) => /reset/i.test(k));
      let resetTime: string | undefined;
      if (resetKey) {
        resetTime = obj[resetKey];
      }

      const usedKey = keys.find(
        (k) => /used|usage/i.test(k) && k !== percentKey
      );
      const limitKey = keys.find((k) => /limit|quota|total/i.test(k));
      const used = usedKey ? obj[usedKey] : undefined;
      const limit = limitKey ? obj[limitKey] : undefined;

      const finalLabel = label || classifyLabelFromKey(percentKey, parentKeys);

      matches.push({
        value: numVal,
        resetTime,
        keySource: percentKey,
        label: finalLabel,
        used,
        limit,
        keyContext: parentKeys,
      });
    }
  }

  if (!percentKey) {
    const usedKey = keys.find((k) => /used|usage/i.test(k));
    const limitKey = keys.find((k) => /limit|quota|total/i.test(k));

    if (usedKey && limitKey) {
      const used = Number(obj[usedKey]);
      const limit = Number(obj[limitKey]);

      const resetKey = keys.find((k) => /reset/i.test(k));
      const resetTime = resetKey ? obj[resetKey] : undefined;

      if (!isNaN(used) && !isNaN(limit) && limit > 0) {
        const finalLabel = label || classifyLabelFromKey(usedKey, parentKeys);

        matches.push({
          value: (used / limit) * 100,
          keySource: 'calculated',
          label: finalLabel,
          used: obj[usedKey],
          limit: obj[limitKey],
          resetTime,
          keyContext: parentKeys,
        });
      }
    }
  }

  for (const key of keys) {
    matches.push(...findAllUsages(obj[key], depth + 1, [...parentKeys, key]));
  }

  return matches;
}

function updateTray(tray: Tray, results: PollResult[]) {
  const zResult = results.find((r) => r.provider === 'z_ai');
  const claudeResult = results.find((r) => r.provider === 'claude');
  const codexResult = results.find((r) => r.provider === 'codex');
  const geminiResult = results.find((r) => r.provider === 'gemini');
  const externalResult = results.find((r) => r.provider === 'external_models');

  const providerOrder = getSetting('providerOrder', [
    'codex',
    'claude',
    'gemini',
    'external_models',
    'z_ai',
  ]);
  const providerMeta: Record<
    string,
    { label: string; shortLabel: string; result?: PollResult }
  > = {
    z_ai: { label: 'Z.ai', shortLabel: 'Z', result: zResult },
    claude: { label: 'Claude', shortLabel: 'C', result: claudeResult },
    codex: { label: 'Codex', shortLabel: 'X', result: codexResult },
    gemini: { label: 'Gemini (AG)', shortLabel: 'G', result: geminiResult },
    external_models: {
      label: 'Gemini External (AG)',
      shortLabel: 'E',
      result: externalResult,
    },
  };

  // Build Tooltip text
  const tooltipParts: string[] = [];
  providerOrder.forEach((provider) => {
    const meta = providerMeta[provider];
    if (!meta?.result) return;

    if (
      (provider === 'gemini' || provider === 'external_models') &&
      !meta.result.usage
    ) {
      return;
    }

    tooltipParts.push(`${meta.label}: ${meta.result.usage}`);
  });
  tray.setToolTip(tooltipParts.join('\n') || 'Usage Tray');

  // Update Tray Title
  const formatPercent = (usage: string | null) => {
    if (!usage || usage === 'Error') return '?';
    const match = usage.match(/^(\d+(?:\.\d+)?)%/);
    return match ? match[1] + '%' : '?';
  };

  const titleParts: string[] = [];
  providerOrder.forEach((provider) => {
    const meta = providerMeta[provider];
    if (!meta?.result) return;
    if (
      (provider === 'gemini' || provider === 'external_models') &&
      !meta.result.usage
    ) {
      return;
    }

    titleParts.push(`${meta.shortLabel}:${formatPercent(meta.result.usage)}`);
  });

  const shortString = titleParts.join(' ');
  tray.setTitle(shortString);

  // Update Tray Icon
  const iconSettings = getSetting<IconSettings>(
    'iconSettings',
    DEFAULT_ICON_SETTINGS
  );

  let iconColor: 'red' | 'yellow' | 'green' = 'green';

  for (const result of results) {
    const nonExcludedDetails = result.details.filter((d) => {
      const compositeKey = `${result.provider}|${d.label}`;
      return !iconSettings.excludedMetrics.includes(compositeKey);
    });

    // If the provider has details, and all of them are excluded, skip this provider
    // from contributing to the icon color calculation.
    if (result.details.length > 0 && nonExcludedDetails.length === 0) {
      continue;
    }

    let providerColor: 'red' | 'yellow' | 'green' = 'green';

    if (iconSettings.coloringMode === 'rate') {
      let hasRateData = false;
      for (const detail of nonExcludedDetails) {
        const totalDuration = detail.totalDurationMinutes || 300;

        if (totalDuration > 0 && detail.timeRemainingMinutes !== undefined) {
          hasRateData = true;
          const timeElapsedPct = Math.max(
            0,
            Math.min(
              100,
              ((totalDuration - detail.timeRemainingMinutes) / totalDuration) *
                100
            )
          );
          const usagePct = detail.percentage;

          if (
            usagePct >= iconSettings.rateMinPercent &&
            timeElapsedPct >= iconSettings.rateMinPercent
          ) {
            if (usagePct > timeElapsedPct) {
              providerColor = 'red';
              break;
            } else if (usagePct > timeElapsedPct - 10) {
              if (providerColor === 'green') {
                providerColor = 'yellow';
              }
            }
          }
        }
      }

      if (!hasRateData) {
        const p =
          nonExcludedDetails.length > 0
            ? Math.max(...nonExcludedDetails.map((d) => d.percentage))
            : getPercent(result.usage);
        if (p >= iconSettings.thresholdCritical) providerColor = 'red';
        else if (p >= iconSettings.thresholdWarning) providerColor = 'yellow';
      }
    } else {
      const p =
        nonExcludedDetails.length > 0
          ? Math.max(...nonExcludedDetails.map((d) => d.percentage))
          : getPercent(result.usage);
      if (p >= iconSettings.thresholdCritical) providerColor = 'red';
      else if (p >= iconSettings.thresholdWarning) providerColor = 'yellow';
    }

    if (providerColor === 'red') {
      iconColor = 'red';
      break;
    }
    if (providerColor === 'yellow' && iconColor === 'green') {
      iconColor = 'yellow';
    }
  }

  updateTrayIcon(tray, iconColor);

  // Check for high usage
  checkHighUsage(zResult);
  checkHighUsage(claudeResult);
  checkHighUsage(codexResult);
  checkHighUsage(geminiResult);
  checkHighUsage(externalResult);
}

function updateTrayIcon(tray: Tray, color: 'red' | 'yellow' | 'green') {
  try {
    if (color === lastIconColor) return;

    if (!trayIconCache[color]) {
      // Load icon from file for better rendering on Linux
      const iconFileName = `tray-${color}.png`;
      const iconPath = path.join(_dirname, 'assets', iconFileName);
      debug(`Loading tray icon from: ${iconPath}`);
      const img = nativeImage.createFromPath(iconPath);

      if (img.isEmpty()) {
        warn(
          `Tray icon file not found or empty: ${iconPath}, falling back to base64`
        );
        // Fallback to base64
        let base64String = ICON_GREEN;
        if (color === 'yellow') base64String = ICON_YELLOW;
        if (color === 'red') base64String = ICON_RED;
        trayIconCache[color] = nativeImage.createFromDataURL(base64String);
      } else {
        debug(`Successfully loaded tray icon: ${iconPath}`);
        trayIconCache[color] = img;
      }
    }

    if (trayIconCache[color]) {
      tray.setImage(trayIconCache[color]);
      lastIconColor = color;
    }
  } catch (e) {
    error(`Failed to update tray icon: ${e}`);
  }
}

function getPercent(usage: string | null): number {
  if (!usage) return 0;
  const match = usage.match(/^(\d+(?:\.\d+)?)%/);
  return match ? parseFloat(match[1]) : 0;
}

function checkHighUsage(result: PollResult | undefined) {
  if (!result || !result.usage || !result.usage.includes('%')) return;

  // Parse percentage
  const num = parseInt(result.usage.replace('%', ''), 10);

  if (!isNaN(num) && num >= 90) {
    const providerKey = result.provider;

    // Check if we already notified for this provider
    if (!notifiedState[providerKey]) {
      const providerName =
        result.provider === 'z_ai'
          ? 'Z.ai'
          : result.provider === 'claude'
            ? 'Claude'
            : result.provider === 'codex'
              ? 'Codex'
              : result.provider === 'gemini'
                ? 'Gemini (AG)'
                : 'Gemini External (AG)';
      new Notification({
        title: 'Usage Warning',
        body: `${providerName} is at ${result.usage} usage.`,
      }).show();

      info(`High Usage Alert: ${result.provider} is at ${result.usage}`);

      // Mark as notified so we don't spam
      notifiedState[providerKey] = true;
    }
  } else {
    // Reset if it drops below 90 (unlikely for usage, but good practice)
    // Or if we want to re-notify on next session, we just leave it.
    // If usage resets (e.g. monthly reset), we should allow notification again.
    if (!isNaN(num) && num < 90) {
      notifiedState[result.provider] = false;
    }
  }
}
