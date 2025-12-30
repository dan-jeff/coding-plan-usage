import { safeStorage } from 'electron';
import Store from 'electron-store';

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
    console.warn('Encryption not available, saving in plain text');
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
    console.log(`Saved encrypted session for ${provider}`);
  } catch (error) {
    console.error(`Failed to encrypt session for ${provider}:`, error);
  }
}

export function getSession(provider: 'z_ai' | 'claude'): ProviderConfig | null {
  const stored = store.get(`${provider}_config`) as
    | StoredProviderConfig
    | undefined;

  if (!stored) return null;

  // Handle legacy plain text (object)
  if (typeof stored.headers !== 'string') {
    console.log(`Loaded plain text (legacy) session for ${provider}`);
    return stored as ProviderConfig;
  }

  // It is a string, so it's encrypted
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('Encryption not available, cannot decrypt session');
    return null;
  }

  try {
    const encryptedBuffer = Buffer.from(stored.headers, 'hex');
    const decryptedString = safeStorage.decryptString(encryptedBuffer);
    const headers = JSON.parse(decryptedString);

    return {
      url: stored.url,
      headers,
    };
  } catch (error) {
    console.error(`Failed to decrypt session for ${provider}:`, error);
    return null; // Treat as not configured
  }
}

export function hasSession(provider: 'z_ai' | 'claude'): boolean {
  return !!store.get(`${provider}_config`);
}

export function deleteSession(provider: 'z_ai' | 'claude'): void {
  store.delete(`${provider}_config`);
  console.log(`Deleted session for ${provider}`);
}

export function getSetting<T>(key: string, defaultValue: T): T {
  return store.get(key, defaultValue) as T;
}

export function setSetting(key: string, value: unknown): void {
  store.set(key, value);
}
