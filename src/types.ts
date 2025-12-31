export interface UsageDetail {
  label: string;
  percentage: number;
  displayReset?: string;
  timeRemainingMinutes?: number;
}

export interface ProviderData {
  label: string;
  connected: boolean;
  usage: string | null;
  details?: UsageDetail[];
}

declare global {
  interface Window {
    electronAPI: {
      connectProvider: (provider: string) => void;
      disconnectProvider: (provider: string) => void;
      refreshUsage: () => void;
      getProviderStatus: () => Promise<{ z_ai: boolean; claude: boolean }>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onProviderConnected: (
        callback: (event: any, provider: string) => void
      ) => () => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onProviderDisconnected: (
        callback: (event: any, provider: string) => void
      ) => () => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onUsageUpdate: (
        callback: (
          event: any,
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
    };
  }
}
