import {
  Tray,
  Menu,
  net,
  app,
  Notification,
  BrowserWindow,
  nativeImage,
} from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  getSession,
  hasSession,
  getSetting,
  type ProviderConfig,
} from './secure-store.js';
import { debug, info, warn, error } from './logger.js';

const _dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

let pollingIntervalId: NodeJS.Timeout | null = null;
let currentIntervalMinutes: number = 15;

const ICON_GREEN =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABiklEQVR4AZRSPUvDQBh+79qkB3ayqOhipSJtJh2sa9F+gOhSSKj+ASchOHURQgc79xcIaj/QUfweHAQREUGEiruKm+Km0jvvTtO0MYg58pB7n/d5nrtcDoPH0HUWGGvMTMZrmYV4Pb2o1bNTqdRp0EMKXQHatq7GG+nibT77iBm+BAQ1AFSlwC6el9aeEvXManQ9RaBjtANiG9l+1no9A4bKvD/A4X76GECJEOU8sZkbtJsyQKysKmyXC5J244/3BFXofvRnJzKA0pcVL/PV3CHc5I9+ZSEG44SoRdHA4sCAIVMU/sCWxc7x9XwuwhCUOUw3+CGaiIcL/iC5Z94Vjjs1Jfb+FsFBAj33hZOKF8LhQEUlSPZGYmoFoe+5raUhRjD9bCF/W3fUwosVpffBofzNhBc3jZ0PfzZHLbzyNzqUr5n8dDtAFn7slgXSIwMsSxaS+E+IZQHWNOkBGSBMnETiYiSq08MArM2LngtdC0khN1OBpqG3WACFRrdmh0SYy2iXTGgNA6ggvgAAAP//fSk0rQAAAAZJREFUAwCyk5VkuKUwyAAAAABJRU5ErkJggg==';
const ICON_YELLOW =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABa0lEQVR4AZyTv0oDQRDGv9noZY2xMagogohd0qjgn0pT+gIJ6DMoHFZphDONdR5Ci7SCnVxMUMTe3kKtYiVqDMmNu0NOknBIvGGHvdmZ77e7t7sKEVYocIJr4xtcc/b5xjngxsRWPu+PRZRiAMCPcIygVD3ULyD1AKILgM4RBPf+6d4r150T9qHRZ78Avk3PoqkbAJ0BmDM+3GbAVIZK3nE9NR8mBWBnRqdzCfBmmPijXwN3r8KVCABN5zhK/LH+ifb2VxRrFUqXbELZHwaQi//bkV25qrpTGaO1+7aQQSe4xAJ3nxbfXey0+vJcxlsqo8zeJ2n3uxLl6XSi4miS3PKKUyEi+Q5rwYFW5iAJcU2BFKZbz3H1Vqsoh3ZcgNWquGKjk62HAAnM4MjN8yAaAXieBDIwCsHzoLJZ0Zgz6CnMINmLwdd6ydxKAfdSw93ARFJoxIF1ylW75j0m2U8tWNiwshezrS0WEdj4BwAA//8PB22gAAAABklEQVQDAGD0gHvD3XeeAAAAAElFTkSuQmCC';
const ICON_RED =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABhUlEQVR4AZySz0sCQRTH3xtrM/SU9BMiwpteElOhk5Q/oPsK9T8ESycvweKhPXvvWgQdo+gH1KGIsLMeyk0P2bUIjEjX18yUorZE7jBvmfed9/3M29llYDNUlVxmZCViLibXzGhi/T6cisXjl0M2pdADKAZUxYwkskY1VSNgBULYI8Jdxuh2p779XI4ktyrxuLsb1AGUl1ITiuf1igANXjDJo3+OcyFn1YdvquH0NF/LKQFFfjI16BABolL9+xGyWOu48tOJBLg9L5t25qmLE5i9Pv2FI4CF5ruSFRtMXBgBaiIZKIg2ROfMqKV9CGDw0PoDEDQklLpr/0jzF87kGgE03nrOM/rmY80mePx353m78HpdecWNcm/er+QRv9ft2g8XufkXshAcDkYWskZ97MmhH4SXBUsHn04Bwsvvwqkd5Ku3ATIZBKXrXQBdl8m/IboOLBCQHmh3AFxE8WM8hpbnAKij23TVc5As5OaWiGBJtWgYRx5iqzMCZmMWEonaTAZaIvkCAAD//001QCYAAAAGSURBVAMA/d+QHCH7AUwAAAAASUVORK5CYII=';

const DEFAULT_ICON_SETTINGS = {
  thresholdWarning: 50,
  thresholdCritical: 80,
};

interface IconSettings {
  thresholdWarning: number;
  thresholdCritical: number;
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
  provider: 'z_ai' | 'claude';
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

  updateTray(tray, results);
}

function notifyUsageUpdate(
  provider: string,
  usage: string | null,
  details: UsageDetail[] = []
) {
  const wins = BrowserWindow.getAllWindows();
  wins.forEach((win) => {
    win.webContents.send('usage-update', { provider, usage, details });
  });
}

function fetchUsage(
  config: ProviderConfig
): Promise<{ usage: string | null; details: UsageDetail[] }> {
  return new Promise((resolve, reject) => {
    debug(`Fetching usage from URL: ${config.url}`);
    const request = net.request({
      url: config.url,
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
            const parsed = parseUsage(responseBody);
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

function formatTime(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'Resetting soon';

  // New logic here
  if (totalMinutes >= 1440) {
    const d = Math.floor(totalMinutes / 1440);
    const h = Math.floor((totalMinutes % 1440) / 60);
    return `${d}d ${h}h`;
  }

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
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

  // Build Tooltip text
  const tooltipParts = [];
  if (zResult) tooltipParts.push(`Z.ai: ${zResult.usage}`);
  if (claudeResult) tooltipParts.push(`Claude: ${claudeResult.usage}`);
  tray.setToolTip(tooltipParts.join('\n') || 'Usage Tray');

  // Update Tray Title
  const formatPercent = (usage: string | null) => {
    if (!usage || usage === 'Error') return '?';
    const match = usage.match(/^(\d+(?:\.\d+)?)%/);
    return match ? match[1] + '%' : '?';
  };

  const titleParts: string[] = [];
  if (zResult) titleParts.push(`Z:${formatPercent(zResult.usage)}`);
  if (claudeResult) titleParts.push(`C:${formatPercent(claudeResult.usage)}`);

  const shortString = titleParts.join(' ');
  tray.setTitle(shortString);

  // Update Tray Icon for Linux (and others)
  const zPercent = getPercent(zResult?.usage || null);
  const cPercent = getPercent(claudeResult?.usage || null);
  const maxUsage = Math.max(zPercent, cPercent);

  const iconSettings = getSetting<IconSettings>(
    'iconSettings',
    DEFAULT_ICON_SETTINGS
  );

  let iconColor = 'green';
  if (maxUsage >= iconSettings.thresholdCritical) {
    iconColor = 'red';
  } else if (maxUsage >= iconSettings.thresholdWarning) {
    iconColor = 'yellow';
  }

  updateTrayIcon(tray, iconColor);

  // Check for high usage
  checkHighUsage(zResult);
  checkHighUsage(claudeResult);

  // Build Context Menu
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [];

  // Z.ai Menu Item
  if (hasSession('z_ai')) {
    menuTemplate.push({
      label: `Z.ai: ${zResult?.usage || '...'}`,
      enabled: false,
    });
  }

  // Claude Menu Item
  if (hasSession('claude')) {
    menuTemplate.push({
      label: `Claude: ${claudeResult?.usage || '...'}`,
      enabled: false,
    });
  }

  // Separator (only if we have items above)
  if (menuTemplate.length > 0) {
    menuTemplate.push({ type: 'separator' });
  }

  // Standard Items
  menuTemplate.push(
    {
      label: 'Settings',
      click: () => {
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
          const win = wins[0];
          if (win.isVisible()) {
            win.hide();
          } else {
            win.show();
            win.focus();
          }
        }
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    }
  );

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
}

function updateTrayIcon(tray: Tray, color: string) {
  try {
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
      const fallbackImg = nativeImage.createFromDataURL(base64String);
      tray.setImage(fallbackImg);
    } else {
      debug(`Successfully loaded tray icon: ${iconPath}`);
      tray.setImage(img);
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
      new Notification({
        title: 'Usage Warning',
        body: `${result.provider === 'z_ai' ? 'Z.ai' : 'Claude'} is at ${result.usage} usage.`,
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
