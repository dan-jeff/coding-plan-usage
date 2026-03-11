export interface ProviderPeriodCustomization {
  provider: 'z_ai' | 'claude' | 'codex' | 'gemini' | 'external_models';
  metricLabel: string;
  totalDurationMinutes: number;
}

export interface ProviderAccentColors {
  z_ai: string;
  claude: string;
  codex: string;
  gemini: string;
  external_models: string;
}

export const DEFAULT_PROVIDER_COLORS: ProviderAccentColors = {
  z_ai: '#10b981',
  claude: '#f59e0b',
  codex: '#10b981',
  gemini: '#4285f4',
  external_models: '#8b5cf6',
};

export interface IconSettings {
  thresholdWarning: number;
  thresholdCritical: number;
  historyPeriod: 'week' | 'month' | 'all';
  showCodeReview: boolean;
  coloringMode: 'standard' | 'rate';
  rateMinPercent: number;
  providerColors?: ProviderAccentColors;
  excludedMetrics: string[];
  glassMode: boolean;
  periodCustomizations?: ProviderPeriodCustomization[];
}

export interface UsageHistoryEntry {
  provider: 'z_ai' | 'claude' | 'codex' | 'gemini' | 'external_models';
  timestamp: string;
  percentage: number;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: unknown;
}

export interface UpdateStatusData {
  type:
    | 'checking'
    | 'available'
    | 'not-available'
    | 'error'
    | 'downloading'
    | 'downloaded';
  version?: string;
  error?: string;
  progress?: {
    percent: number;
    transferred: number;
    total: number;
  };
}

export interface UsageDetail {
  label: string;
  percentage: number;
  hasUsageData?: boolean;
  displayReset?: string;
  timeRemainingMinutes?: number;
  totalDurationMinutes?: number;
  used?: number | string;
  limit?: number | string;
  unit?: string;
}

export interface ProviderData {
  label: string;
  connected: boolean;
  usage: string | null;
  details?: UsageDetail[];
  command?: string;
}

declare global {
  interface Window {
    electronAPI: {
      connectProvider: (provider: string) => void;
      disconnectProvider: (provider: string) => void;
      refreshUsage: () => void;
      getProviderStatus: () => Promise<{
        z_ai: boolean;
        claude: boolean;
        codex: boolean;
        gemini: boolean;
        external_models: boolean;
      }>;
      onProviderConnected: (
        callback: (event: unknown, provider: string) => void
      ) => () => void;
      onProviderDisconnected: (
        callback: (event: unknown, provider: string) => void
      ) => () => void;
      onUsageUpdate: (
        callback: (
          event: unknown,
          data: { provider: string; usage: string; details?: UsageDetail[] }
        ) => void
      ) => () => void;
      getAutoLaunch: () => Promise<boolean>;
      setAutoLaunch: (enabled: boolean) => Promise<void>;
      getAppVersion: () => Promise<string>;
      getAutoUpdate: () => Promise<boolean>;
      setAutoUpdate: (enabled: boolean) => Promise<void>;
      getRefreshInterval: () => Promise<number>;
      setRefreshInterval: (minutes: number) => void;
      quitApp: () => void;
      checkForUpdate: () => void;
      quitAndInstall: () => void;
      onUpdateStatus: (
        callback: (event: unknown, data: UpdateStatusData) => void
      ) => () => void;
      getLogs: () => Promise<LogEntry[]>;
      clearLogs: () => Promise<void>;
      onLogEntry: (
        callback: (event: unknown, entry: LogEntry) => void
      ) => () => void;
      resizeWindow: (height: number) => void;
      getProviderOrder: () => Promise<string[]>;
      setProviderOrder: (order: string[]) => void;
      openDebugWindow: () => void;
      getIconSettings: () => Promise<IconSettings>;
      setIconSettings: (settings: IconSettings) => void;
      getProviderAccentColors: () => Promise<ProviderAccentColors>;
      setProviderAccentColor: (
        provider: string,
        color: string
      ) => Promise<{ success: boolean; error?: string }>;
      startSession: (provider: string) => void;
      setProviderCommand: (provider: string, command: string) => void;
      getProviderCommands: () => Promise<Record<string, string> | null>;
      getUsageHistory: () => Promise<UsageHistoryEntry[]>;
      openUsageDetails: () => void;
      getPeriodCustomizations: () => Promise<ProviderPeriodCustomization[]>;
      setPeriodCustomization: (
        provider: string,
        metricLabel: string,
        durationMinutes: number | null
      ) => void;
      setPeriodCustomizations: (
        customizations: ProviderPeriodCustomization[]
      ) => void;
    };
  }
}
