import React from 'react';
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
import { theme } from '../theme';

interface UsageGraphProps {
  data: UsageHistoryEntry[];
  onClick: () => void;
  historyPeriod: 'week' | 'month' | 'all';
  activeProviders: string[];
}

interface GraphData {
  date: string;
  z_ai: number;
  claude: number;
}

export const UsageGraph: React.FC<UsageGraphProps> = ({
  data,
  onClick,
  historyPeriod,
  activeProviders,
}) => {
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
      .map(([date, values]) => ({
        date,
        z_ai: values.z_ai.length > 0 ? Math.max(...values.z_ai) : 0,
        claude: values.claude.length > 0 ? Math.max(...values.claude) : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30);

    return result;
  };

  const graphData = processGraphData();

  const getHistoryPeriodLabel = (): string => {
    switch (historyPeriod) {
      case 'week':
        return 'Week Activity';
      case 'month':
        return 'Month Activity';
      case 'all':
        return 'All Time Activity';
      default:
        return 'Week Activity';
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>
            {formatDate(payload[0].payload.date)}
          </div>
          {payload.map((entry: any, index: number) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: index < payload.length - 1 ? '4px' : '0',
              }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                }}
              />
              <span>
                {entry.name === 'z_ai' ? 'Z.ai' : 'Claude'}: {entry.value}%
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (graphData.length === 0) {
    return (
      <div
        style={{
          backgroundColor: theme.card,
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          color: theme.textSec,
          fontSize: '13px',
        }}
      >
        No data yet
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: theme.card,
        borderRadius: '12px',
        padding: '16px 0',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '12px',
          color: theme.textMain,
          padding: '0 16px',
        }}
      >
        {getHistoryPeriodLabel()}
      </div>
      <div style={{ height: '120px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={graphData}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="zaiGradient" x1="0" y1="0" x2="0" y2="1">
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
              <linearGradient id="claudeGradient" x1="0" y1="0" x2="0" y2="1">
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
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke={theme.textSec}
              fontSize={10}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            {activeProviders.includes('z_ai') && (
              <Area
                type="monotone"
                dataKey="z_ai"
                stroke={theme.accentGreen}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#zaiGradient)"
              />
            )}
            {activeProviders.includes('claude') && (
              <Area
                type="monotone"
                dataKey="claude"
                stroke={theme.accentYellow}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#claudeGradient)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
