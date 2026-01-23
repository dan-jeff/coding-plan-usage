const now = new Date('2026-01-23T12:00:00Z'); // Simulate today based on env info
const historyPeriod = 'week';

interface Entry {
  provider: string;
  timestamp: string;
  percentage: number;
}

const generateData = (): Entry[] => {
  const data: Entry[] = [];
  // Add some data for today
  data.push({
    provider: 'z_ai',
    timestamp: '2026-01-23T10:00:00Z',
    percentage: 50,
  });
  // Add data for 5 days ago
  data.push({
    provider: 'z_ai',
    timestamp: '2026-01-18T10:00:00Z',
    percentage: 40,
  });
  // Add data for 8 days ago (should be excluded)
  data.push({
    provider: 'z_ai',
    timestamp: '2026-01-14T10:00:00Z',
    percentage: 30,
  });
  return data;
};

const data = generateData();

const processGraphData = () => {
  let cutoffDate: Date;

  switch (historyPeriod) {
    case 'week':
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      cutoffDate = new Date(0);
      break;
  }

  console.log('Now:', now.toISOString());
  console.log('Cutoff:', cutoffDate.toISOString());

  const grouped: any = {};

  data.forEach((entry) => {
    const entryDate = new Date(entry.timestamp);
    if (entryDate < cutoffDate) {
      console.log(`Excluded: ${entry.timestamp}`);
      return;
    }
    console.log(`Included: ${entry.timestamp}`);

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
    }
  });

  const result = Object.entries(grouped)
    .map(([date, values]: [string, any]) => ({
      date,
      z_ai: values.z_ai.length > 0 ? Math.max(...values.z_ai) : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30);

  return result;
};

const result = processGraphData();
console.log('Result:', JSON.stringify(result, null, 2));
