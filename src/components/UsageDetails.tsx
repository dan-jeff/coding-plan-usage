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
import { UsageHistoryEntry } from '../types';
import { styles, theme } from '../theme';

interface UsageDetailsProps {
  data: UsageHistoryEntry[];
  onBack?: () => void;
}

interface GraphData {
  date: string;
  z_ai: number;
  claude: number;
  stacked: number;
}

export const UsageDetails: React.FC<UsageDetailsProps> = ({ data, onBack }) => {
  const [historyPeriod, setHistoryPeriod] = useState<'week' | 'month' | 'all'>(
    'week'
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

    const grouped: { [date: string]: { z_ai: number[]; claude: number[] } } =
      {};

    data.forEach((entry) => {
      const entryDate = new Date(entry.timestamp);
      if (entryDate < cutoffDate) return;

      const dateKey = entryDate.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = { z_ai: [], claude: [] };
      }

      if (entry.provider === 'z_ai') {
        grouped[dateKey].z_ai.push(entry.percentage);
      } else if (entry.provider === 'claude') {
        grouped[dateKey].claude.push(entry.percentage);
      }
    });

    const result: GraphData[] = Object.entries(grouped)
      .map(([date, values]) => {
        const zaiMax = values.z_ai.length > 0 ? Math.max(...values.z_ai) : 0;
        const claudeMax =
          values.claude.length > 0 ? Math.max(...values.claude) : 0;
        return {
          date,
          z_ai: zaiMax,
          claude: claudeMax,
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

    const zaiValues = zaiData.map((d) => d.percentage);
    const claudeValues = claudeData.map((d) => d.percentage);

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
    };
  };

  const stats = calculateStats();

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
                <span>{entry.name === 'z_ai' ? 'Z.ai' : 'Claude'}</span>
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
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              padding: '16px',
              borderRadius: '8px',
              border: `1px solid ${theme.accentGreen}30`,
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: theme.textSec,
                marginBottom: '8px',
              }}
            >
              Z.ai Statistics
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
                Average: <strong>{stats.z_ai.avg}%</strong>
              </div>
              <div>
                Max: <strong>{stats.z_ai.max}%</strong>
              </div>
              <div>
                Min: <strong>{stats.z_ai.min}%</strong>
              </div>
              <div>
                Entries: <strong>{stats.z_ai.count}</strong>
              </div>
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              padding: '16px',
              borderRadius: '8px',
              border: `1px solid ${theme.accentYellow}30`,
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: theme.textSec,
                marginBottom: '8px',
              }}
            >
              Claude Statistics
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
                Average: <strong>{stats.claude.avg}%</strong>
              </div>
              <div>
                Max: <strong>{stats.claude.max}%</strong>
              </div>
              <div>
                Min: <strong>{stats.claude.min}%</strong>
              </div>
              <div>
                Entries: <strong>{stats.claude.count}</strong>
              </div>
            </div>
          </div>
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
                  <linearGradient
                    id="zaiGradientDetail"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={theme.accentGreen}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={theme.accentGreen}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id="claudeGradientDetail"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={theme.accentYellow}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={theme.accentYellow}
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
                  dataKey="z_ai"
                  stroke={theme.accentGreen}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#zaiGradientDetail)"
                />
                <Area
                  type="monotone"
                  dataKey="claude"
                  stroke={theme.accentYellow}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#claudeGradientDetail)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.cardHeader}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              Z.ai Usage ({getHistoryPeriodLabel()})
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
          <div style={{ height: '200px', marginBottom: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graphData}>
                <defs>
                  <linearGradient
                    id="zaiOnlyGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={theme.accentGreen}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={theme.accentGreen}
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
                  dataKey="z_ai"
                  stroke={theme.accentGreen}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#zaiOnlyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.cardHeader}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              Claude Usage ({getHistoryPeriodLabel()})
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
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graphData}>
                <defs>
                  <linearGradient
                    id="claudeOnlyGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={theme.accentYellow}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={theme.accentYellow}
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
                  dataKey="claude"
                  stroke={theme.accentYellow}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#claudeOnlyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
