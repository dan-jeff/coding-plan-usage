import { safeStorage } from 'electron';
import Store from 'electron-store';
import { debug, info, warn, error } from './logger.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Store<any>();

export interface ProviderConfig {
  url: string;
  headers: Record<string, string>;
}

// Internal type for storage where headers is an encrypted string
interface StoredProviderConfig {
  url: string;
  headers: string | Record<string, string>; // Support both for migration/fallback
}

export function saveSession(provider: 'z_ai' | 'claude', data: ProviderConfig) {
  if (!safeStorage.isEncryptionAvailable()) {
    warn('Encryption not available, saving in plain text', { provider });
    store.set(`${provider}_config`, data);
    return;
  }

  try {
    const headersString = JSON.stringify(data.headers);
    const encryptedBuffer = safeStorage.encryptString(headersString);
    const encryptedHex = encryptedBuffer.toString('hex');

    const storedData: StoredProviderConfig = {
      url: data.url,
      headers: encryptedHex,
    };

    store.set(`${provider}_config`, storedData);
    info('Saved encrypted session', { provider, success: true });
  } catch (err) {
    error('Failed to encrypt session', {
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function getSession(provider: 'z_ai' | 'claude'): ProviderConfig | null {
  const stored = store.get(`${provider}_config`) as
    | StoredProviderConfig
    | undefined;

  if (!stored) return null;

  // Handle legacy plain text (object)
  if (typeof stored.headers !== 'string') {
    info('Loaded plain text (legacy) session', { provider });
    return stored as ProviderConfig;
  }

  // It is a string, so it's encrypted
  if (!safeStorage.isEncryptionAvailable()) {
    error('Encryption not available, cannot decrypt session', { provider });
    return null;
  }

  try {
    const encryptedBuffer = Buffer.from(stored.headers, 'hex');
    const decryptedString = safeStorage.decryptString(encryptedBuffer);
    const headers = JSON.parse(decryptedString);

    debug('Decrypted session successfully', { provider });
    return {
      url: stored.url,
      headers,
    };
  } catch (err) {
    error('Failed to decrypt session', {
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
    return null; // Treat as not configured
  }
}

export function hasSession(provider: 'z_ai' | 'claude'): boolean {
  return !!store.get(`${provider}_config`);
}

export function deleteSession(provider: 'z_ai' | 'claude'): void {
  store.delete(`${provider}_config`);
  info('Deleted session', { provider });
}

export function getSetting<T>(key: string, defaultValue: T): T {
  return store.get(key, defaultValue) as T;
}

export function setSetting(key: string, value: unknown): void {
  store.set(key, value);
}

export interface UsageHistoryEntry {
  provider: 'z_ai' | 'claude';
  timestamp: string;
  percentage: number;
}

export function addUsageHistory(
  provider: 'z_ai' | 'claude',
  percentage: number
): void {
  const history: UsageHistoryEntry[] = store.get(
    'usageHistory',
    []
  ) as UsageHistoryEntry[];
  const now = new Date().toISOString();

  const newEntry: UsageHistoryEntry = {
    provider,
    timestamp: now,
    percentage,
  };

  history.push(newEntry);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const prunedHistory = history.filter((entry) => {
    const entryDate = new Date(entry.timestamp);
    return entryDate >= thirtyDaysAgo;
  });

  store.set('usageHistory', prunedHistory);
  info('Added usage history entry', {
    provider,
    percentage,
    historyLength: prunedHistory.length,
  });
}

export function getUsageHistory(): UsageHistoryEntry[] {
  const history: UsageHistoryEntry[] = store.get(
    'usageHistory',
    []
  ) as UsageHistoryEntry[];
  return history;
}
