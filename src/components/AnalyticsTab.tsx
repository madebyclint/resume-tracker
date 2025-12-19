import React from 'react';
import AnalyticsDashboard from './AnalyticsDashboard';

interface AnalyticsTabProps {
  statsData: any;
  chartType: 'bar' | 'line';
  setChartType: (type: 'bar' | 'line') => void;
  showExpandedStats: boolean;
  setShowExpandedStats: (show: boolean) => void;
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  statsData,
  chartType,
  setChartType,
  showExpandedStats,
  setShowExpandedStats
}) => {
  return (
    <AnalyticsDashboard
      data={statsData}
      chartType={chartType}
      onChartTypeChange={setChartType}
      showExpanded={showExpandedStats}
      onToggleExpanded={setShowExpandedStats}
    />
  );
};

export default AnalyticsTab;