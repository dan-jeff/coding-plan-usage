import {
  Tray,
  Menu,
  net,
  app,
  Notification,
  BrowserWindow,
  nativeImage,
} from 'electron';
import {
  getSession,
  hasSession,
  getSetting,
  type ProviderConfig,
} from './secure-store.js';
import { debug, info, warn, error } from './logger.js';

let pollingIntervalId: NodeJS.Timeout | null = null;
let currentIntervalMinutes: number = 15;

const ICON_GREEN =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAiklEQVR4nO3UzQ2AMAgG0NZtXMQZHNEZXMRx8IShLT9fjWnSRI4WHniAlGaLHCUQEamFObu15qMFog3UjxJdj00Fr/108eUNWr9pf1fAKIrgzcQoGuU+MHfsQWtcTq1O/EX88ECYt0duFBpcIzdQnbgHt3ILWHZEcO9eNBOjeHSExp5NpEF06OeLGyKvRyBxHffNAAAAAElFTkSuQmCC';
const ICON_YELLOW =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAhUlEQVR4nO3UMQ6AMAgF0OLkqTy8p3LDxRBoofwa06SJjBYeOEApqwVlCczMbiFRtzZ8jEC0gfvRoOfui8fVxbdXaPXm/Z2BYRTAm4lhNMkVWDqOoBWup/Yn/iB+eCIs26M2Co6nRm+gP/EIHuQa2Ow8gnfuRTMxjCdHaO7ZRBpkh369uAHNPj4gMFgRZQAAAABJRU5ErkJggg==';
const ICON_RED =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAiklEQVR4nO3UzQ2AMAgG0NZV3MERHNoR3MFZ8IShLT9fjWnSRI4WHniAlGaLHCUQEamFObu15qMFog3UjxK9tl0F1/Nw8eUNWr9pf1fAKIrgzcQoGuU+MHfsQWtcTq1O/EX88ECYt0duFBpcIzdQnbgHt3ILWHZEcO9eNBOjeHSExp5NpEF06OeLGyKvRyBxHffNAAAAAElFTkSuQmCC';

export interface UsageDetail {
  label: string; // e.g., "5-Hour", "7-Day"
  percentage: number; // 0-100
  limit: string | number; // Raw value if available
  used: string | number; // Raw value if available
  resetTime?: string; // ISO date
  displayReset?: string; // "4h 30m"
  timeRemainingMinutes?: number; // Raw minutes remaining
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
    }

    // Heuristic: Override labels based on reset time
    for (const match of matches) {
      if (match.keySource === 'z_ai_limit_explicit') continue;
      if (match.resetTime) {
        const resetDate = new Date(match.resetTime);
        if (!isNaN(resetDate.getTime())) {
          const diff = resetDate.getTime() - Date.now();
          // 6 hours = 21600000 ms
          if (diff <= 21600000) {
            match.label = '5-Hour Window';
          } else {
            match.label = 'Token Usage';
          }
        }
      }
    }

    const detailsMap: Record<string, UsageDetail> = {
      'Token Usage': {
        label: 'Token Usage',
        percentage: 0,
        limit: '',
        used: '',
        displayReset: 'Unavailable',
      },
      '5-Hour Window': {
        label: '5-Hour Window',
        percentage: 0,
        limit: '',
        used: '',
        displayReset: 'Unavailable',
      },
    };

    let maxUsage = 0;
    // let relevantResetTime: string | number | null = null;
    let foundAny = false;

    for (const match of matches) {
      let p = match.value;
      foundAny = true;

      // Heuristics
      // Claude `percent_used` is typically 0.0-1.0
      // `utilization` is typically 0-100
      if (match.keySource === 'percent_used') {
        if (p <= 1.0) p = p * 100;
      }

      if (p > maxUsage) {
        maxUsage = p;
        // relevantResetTime = match.resetTime || null;
      }

      // Determine label - use match label or derive from context
      let label = match.label;
      if (!label) {
        // Default: first match is token usage, second is 5-hour window
        label =
          detailsMap['Token Usage'].percentage === 0 &&
          detailsMap['Token Usage'].used === ''
            ? 'Token Usage'
            : '5-Hour Window';
      }

      if (detailsMap[label]) {
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
        };

        // Conflict resolution: pick the "better" match
        const currentEntry = detailsMap[label];
        const currentIsInitial =
          currentEntry.percentage === 0 &&
          currentEntry.displayReset === 'Unavailable' &&
          currentEntry.used === '';

        let isBetter = false;
        if (currentIsInitial) {
          isBetter = true;
        } else {
          const currentHasReset = currentEntry.displayReset !== 'Unavailable';
          const newHasReset = newEntry.displayReset !== 'Unavailable';

          if (newHasReset && !currentHasReset) {
            isBetter = true;
          } else if (newHasReset === currentHasReset) {
            // Both have reset or both don't. Prefer higher percentage.
            if (newEntry.percentage > currentEntry.percentage) {
              isBetter = true;
            }
          }
        }

        if (isBetter) {
          detailsMap[label] = newEntry;
        }
      }
    }

    const details = [detailsMap['Token Usage'], detailsMap['5-Hour Window']];

    if (foundAny) {
      const windowMetric = detailsMap['5-Hour Window'];
      const percentage = windowMetric.percentage;
      let extraText = '';

      if (
        windowMetric.displayReset &&
        windowMetric.displayReset !== 'Unavailable'
      ) {
        extraText = ` (Resets in ${windowMetric.displayReset})`;
      }

      debug(
        `Parsed usage: ${percentage}%${extraText}, Token Usage: ${detailsMap['Token Usage'].percentage}%, 5-Hour Window: ${detailsMap['5-Hour Window'].percentage}%`
      );
      return {
        usage: `${percentage}%${extraText}`,
        details,
      };
    }

    debug('No usage data found in JSON');
    return { usage: null, details };
  } catch {
    // Not JSON, continue to regex
    warn('JSON parse failed or not a JSON object, checking regex fallback');
    warn(`First 500 chars of body: ${body.slice(0, 500)}`);
  }

  // Fallback: Regex search on the raw string
  // Look for "12%" or "12.5%"
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
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

  // Array: iterate
  if (Array.isArray(obj)) {
    // Z.ai Limits Array Handler
    if (parentKeys.includes('limits')) {
      for (const item of obj) {
        // Check for Z.ai limit objects
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
            limit: item.usage, // 'usage' field in this JSON seems to be the limit/total
            used: item.currentValue,
            keySource: 'z_ai_limit_explicit',
          });
        }
      }
      // Continue standard recursion for other items just in case
    }

    for (const item of obj) {
      matches.push(...findAllUsages(item, depth + 1, parentKeys));
    }
    return matches;
  }

  const keys = Object.keys(obj);

  // Z.ai explicit handler
  if (obj['type'] === 'TIME_LIMIT' || obj['type'] === 'TOKENS_LIMIT') {
    // Some accounts might report 5-hour window under TOKENS_LIMIT if it's the primary constraint
    // or if they have different internal naming. We'll stick to types for now but map carefully.
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

  // Labeling Logic based on object properties and parent keys
  let label: string | undefined;
  const lastParent =
    parentKeys.length > 0 ? parentKeys[parentKeys.length - 1] : '';
  const fullContext = parentKeys.join('_').toLowerCase();

  // Determine label based on parent key context and keywords
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

  // 1. Look for explicit percent fields
  // Matches "percent", "percentage", "usage_percent", "utilization"
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
      // Look for reset time in siblings
      const resetKey = keys.find((k) => /reset/i.test(k)); // resets_at, nextResetTime
      let resetTime: string | undefined;
      if (resetKey) {
        resetTime = obj[resetKey];
      }

      // Try to find used/limit in siblings for completeness
      const usedKey = keys.find(
        (k) => /used|usage/i.test(k) && k !== percentKey
      );
      const limitKey = keys.find((k) => /limit|quota|total/i.test(k));
      const used = usedKey ? obj[usedKey] : undefined;
      const limit = limitKey ? obj[limitKey] : undefined;

      matches.push({
        value: numVal,
        resetTime,
        keySource: percentKey,
        label: label,
        used,
        limit,
        keyContext: parentKeys,
      });
    }
  }

  // 2. Look for used/limit or used/quota pair (if not already handled by percentKey check implicitly,
  // but here we calculate percent if missing)
  if (!percentKey) {
    const usedKey = keys.find((k) => /used|usage/i.test(k));
    const limitKey = keys.find((k) => /limit|quota|total/i.test(k));

    if (usedKey && limitKey) {
      const used = Number(obj[usedKey]);
      const limit = Number(obj[limitKey]);

      // Look for reset time
      const resetKey = keys.find((k) => /reset/i.test(k));
      const resetTime = resetKey ? obj[resetKey] : undefined;

      if (!isNaN(used) && !isNaN(limit) && limit > 0) {
        matches.push({
          value: (used / limit) * 100,
          keySource: 'calculated',
          label: label,
          used: obj[usedKey],
          limit: obj[limitKey],
          resetTime,
          keyContext: parentKeys,
        });
      }
    }
  }

  // 3. Recurse into object values
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

  let iconColor = 'green';
  if (maxUsage >= 80) {
    iconColor = 'red';
  } else if (maxUsage >= 50) {
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
  let base64String = ICON_GREEN;
  if (color === 'yellow') base64String = ICON_YELLOW;
  if (color === 'red') base64String = ICON_RED;

  try {
    const img = nativeImage.createFromDataURL(base64String);
    tray.setImage(img);
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
