import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { UsageHistoryEntry, ProviderAccentColors } from '../types';
import { styles, theme } from '../theme';

interface UsageDetailsProps {
  data: UsageHistoryEntry[];
  onBack?: () => void;
  activeProviders: string[];
  providerColors: ProviderAccentColors;
}

interface GraphData {
  date: string;
  z_ai: number;
  claude: number;
  codex: number;
  gemini: number;
  external_models: number;
  stacked: number;
}

type ProviderKey = keyof ProviderAccentColors;

const PROVIDER_CONFIG: Record<
  ProviderKey,
  { label: string; statsTitle: string; usageTitle: string }
> = {
  z_ai: {
    label: 'Z.ai',
    statsTitle: 'Z.ai Statistics',
    usageTitle: 'Z.ai Usage',
  },
  claude: {
    label: 'Claude',
    statsTitle: 'Claude Statistics',
    usageTitle: 'Claude Usage',
  },
  codex: {
    label: 'ChatGPT Codex',
    statsTitle: 'ChatGPT Codex Statistics',
    usageTitle: 'ChatGPT Codex Usage',
  },
  gemini: {
    label: 'Gemini (AG)',
    statsTitle: 'Gemini (AG) Statistics',
    usageTitle: 'Gemini (AG) Usage',
  },
  external_models: {
    label: 'Gemini External (AG)',
    statsTitle: 'Gemini External (AG) Statistics',
    usageTitle: 'Gemini External (AG) Usage',
  },
};

export const UsageDetails: React.FC<UsageDetailsProps> = ({
  data,
  onBack,
  activeProviders,
  providerColors,
}) => {
  const [historyPeriod, setHistoryPeriod] = useState<'week' | 'month' | 'all'>(
    'week'
  );

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const orderedProviders = activeProviders.filter(
    (provider): provider is ProviderKey => provider in PROVIDER_CONFIG
  );

  const processGraphData = (): GraphData[] => {
    const now = new Date();
    let cutoffDate: Date;

    switch (historyPeriod) {
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        cutoffDate = new Date(0);
        break;
    }

    const grouped: {
      [date: string]: {
        z_ai: number[];
        claude: number[];
        codex: number[];
        gemini: number[];
        external_models: number[];
      };
    } = {};

    data.forEach((entry) => {
      const entryDate = new Date(entry.timestamp);
      if (entryDate < cutoffDate) return;

      const dateKey = entryDate.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          z_ai: [],
          claude: [],
          codex: [],
          gemini: [],
          external_models: [],
        };
      }

      if (entry.provider === 'z_ai') {
        grouped[dateKey].z_ai.push(entry.percentage);
      } else if (entry.provider === 'claude') {
        grouped[dateKey].claude.push(entry.percentage);
      } else if (entry.provider === 'codex') {
        grouped[dateKey].codex.push(entry.percentage);
      } else if (entry.provider === 'gemini') {
        grouped[dateKey].gemini.push(entry.percentage);
      } else if (entry.provider === 'external_models') {
        grouped[dateKey].external_models.push(entry.percentage);
      }
    });

    const result: GraphData[] = Object.entries(grouped)
      .map(([date, values]) => {
        const zaiMax = values.z_ai.length > 0 ? Math.max(...values.z_ai) : 0;
        const claudeMax =
          values.claude.length > 0 ? Math.max(...values.claude) : 0;
        const codexMax =
          values.codex.length > 0 ? Math.max(...values.codex) : 0;
        const geminiMax =
          values.gemini.length > 0 ? Math.max(...values.gemini) : 0;
        const externalModelsMax =
          values.external_models.length > 0
            ? Math.max(...values.external_models)
            : 0;
        return {
          date,
          z_ai: zaiMax,
          claude: claudeMax,
          codex: codexMax,
          gemini: geminiMax,
          external_models: externalModelsMax,
          stacked: zaiMax + claudeMax,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return result;
  };

  const graphData = processGraphData();

  const getHistoryPeriodLabel = (): string => {
    switch (historyPeriod) {
      case 'week':
        return 'Last 7 Days';
      case 'month':
        return 'Last 30 Days';
      case 'all':
        return 'All Time';
      default:
        return 'Last 7 Days';
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateStats = () => {
    const zaiData = data.filter((d) => d.provider === 'z_ai');
    const claudeData = data.filter((d) => d.provider === 'claude');
    const codexData = data.filter((d) => d.provider === 'codex');
    const geminiData = data.filter((d) => d.provider === 'gemini');
    const externalModelsData = data.filter(
      (d) => d.provider === 'external_models'
    );

    const zaiValues = zaiData.map((d) => d.percentage);
    const claudeValues = claudeData.map((d) => d.percentage);
    const codexValues = codexData.map((d) => d.percentage);
    const geminiValues = geminiData.map((d) => d.percentage);
    const externalModelsValues = externalModelsData.map((d) => d.percentage);

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const max = (arr: number[]) => (arr.length > 0 ? Math.max(...arr) : 0);
    const min = (arr: number[]) => (arr.length > 0 ? Math.min(...arr) : 0);

    return {
      z_ai: {
        avg: avg(zaiValues).toFixed(1),
        max: max(zaiValues),
        min: min(zaiValues),
        count: zaiValues.length,
      },
      claude: {
        avg: avg(claudeValues).toFixed(1),
        max: max(claudeValues),
        min: min(claudeValues),
        count: claudeValues.length,
      },
      codex: {
        avg: avg(codexValues).toFixed(1),
        max: max(codexValues),
        min: min(codexValues),
        count: codexValues.length,
      },
      gemini: {
        avg: avg(geminiValues).toFixed(1),
        max: max(geminiValues),
        min: min(geminiValues),
        count: geminiValues.length,
      },
      external_models: {
        avg: avg(externalModelsValues).toFixed(1),
        max: max(externalModelsValues),
        min: min(externalModelsValues),
        count: externalModelsValues.length,
      },
    };
  };

  const stats = calculateStats();
  const statsByProvider = stats as Record<
    ProviderKey,
    { avg: string; max: number; min: number; count: number }
  >;
  const detailGradientId = (provider: ProviderKey) =>
    `${provider}-detail-gradient`;
  const onlyGradientId = (provider: ProviderKey) => `${provider}-only-gradient`;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            padding: '12px',
            fontSize: '12px',
            color: theme.textMain,
            minWidth: '150px',
          }}
        >
          <div
            style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}
          >
            {formatFullDate(payload[0].payload.date)}
          </div>
          {payload.map((entry: any, index: number) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: index < payload.length - 1 ? '6px' : '0',
                paddingBottom: index < payload.length - 1 ? '6px' : '0',
                borderBottom:
                  index < payload.length - 1
                    ? `1px solid ${theme.border}`
                    : 'none',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: entry.color,
                  }}
                />
                <span>
                  {PROVIDER_CONFIG[entry.name as ProviderKey]?.label ||
                    entry.name}
                </span>
              </div>
              <span style={{ fontWeight: 600 }}>{entry.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (graphData.length === 0) {
    return (
      <div style={styles.scrollArea}>
        <div style={styles.contentContainer}>
          <div
            style={{
              backgroundColor: theme.card,
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              color: theme.textSec,
              fontSize: '14px',
            }}
          >
            No usage history data available yet.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.scrollArea}>
      <div style={styles.contentContainer}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          {orderedProviders.map((provider) => {
            const statsEntry = statsByProvider[provider];
            const config = PROVIDER_CONFIG[provider];
            const color = providerColors[provider];

            return (
              <div
                key={provider}
                style={{
                  backgroundColor: hexToRgba(color, 0.1),
                  padding: '16px',
                  borderRadius: '8px',
                  border: `1px solid ${color}30`,
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.textSec,
                    marginBottom: '8px',
                  }}
                >
                  {config.statsTitle}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    Average: <strong>{statsEntry.avg}%</strong>
                  </div>
                  <div>
                    Max: <strong>{statsEntry.max}%</strong>
                  </div>
                  <div>
                    Min: <strong>{statsEntry.min}%</strong>
                  </div>
                  <div>
                    Entries: <strong>{statsEntry.count}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.providerName}>
              Usage History ({getHistoryPeriodLabel()})
            </span>
            <select
              value={historyPeriod}
              onChange={(e) =>
                setHistoryPeriod(e.target.value as 'week' | 'month' | 'all')
              }
              style={{
                backgroundColor: theme.card,
                color: theme.textMain,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                padding: '4px 8px',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                minWidth: '80px',
              }}
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div style={{ height: '300px', marginBottom: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graphData}>
                <defs>
                  {orderedProviders.map((provider) => (
                    <linearGradient
                      key={provider}
                      id={detailGradientId(provider)}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={providerColors[provider]}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={providerColors[provider]}
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.border}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke={theme.textSec}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke={theme.textSec}
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                {orderedProviders.map((provider) => (
                  <Area
                    key={provider}
                    type="monotone"
                    dataKey={provider}
                    stroke={providerColors[provider]}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#${detailGradientId(provider)})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {orderedProviders.map((provider, index) => {
            const isLast = index === orderedProviders.length - 1;
            const config = PROVIDER_CONFIG[provider];

            return (
              <div key={provider}>
                <div style={styles.cardHeader}>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>
                    {config.usageTitle} ({getHistoryPeriodLabel()})
                  </span>
                  <select
                    value={historyPeriod}
                    onChange={(e) =>
                      setHistoryPeriod(
                        e.target.value as 'week' | 'month' | 'all'
                      )
                    }
                    style={{
                      backgroundColor: theme.card,
                      color: theme.textMain,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      padding: '4px 8px',
                      outline: 'none',
                      cursor: 'pointer',
                      fontSize: '11px',
                      minWidth: '80px',
                    }}
                  >
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
                <div
                  style={{
                    height: '200px',
                    marginBottom: isLast ? '0' : '24px',
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={graphData}>
                      <defs>
                        <linearGradient
                          id={onlyGradientId(provider)}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={providerColors[provider]}
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor={providerColors[provider]}
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.border}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke={theme.textSec}
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke={theme.textSec}
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey={provider}
                        stroke={providerColors[provider]}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill={`url(#${onlyGradientId(provider)})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
