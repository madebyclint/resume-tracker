import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar } from '@fortawesome/free-solid-svg-icons';

interface JobStatsSectionProps {
  statsData: any;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  showExpandedStats: boolean;
  setShowExpandedStats: (show: boolean) => void;
  chartType: 'bar' | 'line';
  setChartType: (type: 'bar' | 'line') => void;
}

const JobStatsSection: React.FC<JobStatsSectionProps> = ({
  statsData,
  statusFilter,
  setStatusFilter,
  showExpandedStats,
  setShowExpandedStats,
  chartType,
  setChartType
}) => {
  const {
    stats,
    total,
    totalApplications,
    daysSinceFirst,
    avgPerDay,
    impactStats,
    impactRatio,
    aiStats,
    dailyData,
    weeklyData
  } = statsData;

  return (
    <div className="job-stats-section">
      <div className="stats-container">
        <div className="stats-header">
          <h3>Application Status Overview</h3>
          <div className="stats-header-controls">
            <span className="total-count">Total Jobs: {total}</span>
            <span className="total-count" style={{ marginLeft: "1rem", color: "#007bff", fontWeight: "600" }}>
              Applied: {totalApplications}
            </span>
            {statusFilter && (
              <button
                className="clear-filter-btn"
                onClick={() => setStatusFilter('')}
                title={`Clear ${statusFilter} status filter`}
              >
                ✕ Clear Filter ({statusFilter.replace('_', ' ')})
              </button>
            )}
            <button
              className="expand-stats-btn"
              onClick={() => setShowExpandedStats(!showExpandedStats)}
              title={showExpandedStats ? "Hide detailed analytics" : "Show detailed analytics"}
            >
              {showExpandedStats ? '▼ Less Stats' : '▲ More Stats'}
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div
            className={`stat-item not-applied clickable ${statusFilter === 'not_applied' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'not_applied' ? '' : 'not_applied')}
            title="Click to filter by Not Applied status"
          >
            <span className="stat-label">Not Applied</span>
            <span className="stat-value">{stats.not_applied}</span>
          </div>
          <div
            className={`stat-item applied clickable ${statusFilter === 'applied' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'applied' ? '' : 'applied')}
            title="Click to filter by Applied status"
          >
            <span className="stat-label">Applied</span>
            <span className="stat-value">{stats.applied}</span>
          </div>
          <div
            className={`stat-item interviewing clickable ${statusFilter === 'interviewing' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'interviewing' ? '' : 'interviewing')}
            title="Click to filter by Interviewing status"
          >
            <span className="stat-label">Interviewing</span>
            <span className="stat-value">{stats.interviewing}</span>
          </div>
          <div
            className={`stat-item offered clickable ${statusFilter === 'offered' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'offered' ? '' : 'offered')}
            title="Click to filter by Offered status"
          >
            <span className="stat-label">Offered</span>
            <span className="stat-value">{stats.offered}</span>
          </div>
          <div
            className={`stat-item rejected clickable ${statusFilter === 'rejected' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'rejected' ? '' : 'rejected')}
            title="Click to filter by Rejected status"
          >
            <span className="stat-label">Rejected</span>
            <span className="stat-value">{stats.rejected}</span>
          </div>
          <div
            className={`stat-item withdrawn clickable ${statusFilter === 'withdrawn' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'withdrawn' ? '' : 'withdrawn')}
            title="Click to filter by Withdrawn status"
          >
            <span className="stat-label">Withdrawn</span>
            <span className="stat-value">{stats.withdrawn}</span>
          </div>
        </div>

        {showExpandedStats && (
          <div className="expanded-stats">
            <div className="analytics-section">
              <h4><FontAwesomeIcon icon={faChartBar} /> Advanced Analytics</h4>
              <div className="analytics-grid">
                <div className="analytics-item">
                  <span className="analytics-label">Days Since First</span>
                  <span className="analytics-value">{daysSinceFirst}</span>
                </div>
                <div className="analytics-item">
                  <span className="analytics-label">Total Applications</span>
                  <span className="analytics-value">{totalApplications}</span>
                </div>
                <div className="analytics-item">
                  <span className="analytics-label">Pending (Applied Status)</span>
                  <span className="analytics-value">{stats.applied}</span>
                </div>
                <div className="analytics-item">
                  <span className="analytics-label">High Impact Ratio</span>
                  <span className="analytics-value">{impactRatio}%</span>
                </div>
                <div className="analytics-item">
                  <span className="analytics-label">Success Rate</span>
                  <span className="analytics-value">
                    {totalApplications > 0 ? ((stats.offered / totalApplications) * 100).toFixed(0) : '0'}%
                  </span>
                </div>
              </div>

              <div className="ai-cost-section">
                <h4>🤖 AI Usage & Costs</h4>
                <div className="ai-stats-grid">
                  <div className="ai-stat-item">
                    <span className="ai-stat-label">Jobs Parsed</span>
                    <span className="ai-stat-value">{aiStats.jobsParsed}</span>
                  </div>
                  <div className="ai-stat-item">
                    <span className="ai-stat-label">Total Tokens</span>
                    <span className="ai-stat-value">{aiStats.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="ai-stat-item">
                    <span className="ai-stat-label">Estimated Cost</span>
                    <span className="ai-stat-value">${aiStats.estimatedCost.toFixed(2)}</span>
                  </div>
                  <div className="ai-stat-item">
                    <span className="ai-stat-label">Avg Cost/Job</span>
                    <span className="ai-stat-value">
                      ${aiStats.jobsParsed > 0 ? (aiStats.estimatedCost / aiStats.jobsParsed).toFixed(3) : '0.000'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="chart-controls">
                <button
                  className={`chart-type-btn ${chartType === 'bar' ? 'active' : ''}`}
                  onClick={() => setChartType('bar')}
                >
                  📊 Bar Chart
                </button>
                <button
                  className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
                  onClick={() => setChartType('line')}
                >
                  📈 Line Chart
                </button>
              </div>

              <div className="chart-container">
                <h4>Daily Resume Applications (Last 30 Days)</h4>
                {chartType === 'bar' ? (
                  <div className="mini-chart daily-chart bar-chart">
                    {dailyData.map((day, idx) => (
                      <div key={idx} className="chart-bar-container">
                        <div
                          className="chart-bar"
                          style={{
                            height: `${Math.max(day.count * 8, 4)}px`,
                            backgroundColor: day.count > 0 ? '#007bff' : '#e9ecef'
                          }}
                          title={`${day.displayDate}: ${day.count} applications`}
                        />
                        <div className="chart-bar-label">
                          {idx % 3 === 0 ? day.displayDate.split('/')[1] : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mini-chart daily-chart line-chart">
                    <svg width="400" height="80" viewBox="0 0 400 80">
                      <defs>
                        <linearGradient id="dailyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#007bff" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#007bff" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {dailyData.length > 1 && (
                        <>
                          <polyline
                            fill="none"
                            stroke="#007bff"
                            strokeWidth="2"
                            points={dailyData.map((day, idx) =>
                              `${(idx / (dailyData.length - 1)) * 400},${80 - Math.min(day.count * 20, 76)}`
                            ).join(' ')}
                          />
                          <polygon
                            fill="url(#dailyGradient)"
                            points={`0,80 ${dailyData.map((day, idx) =>
                              `${(idx / (dailyData.length - 1)) * 400},${80 - Math.min(day.count * 20, 76)}`
                            ).join(' ')} 400,80`}
                          />
                          {dailyData.map((day, idx) => (
                            <circle
                              key={idx}
                              cx={(idx / (dailyData.length - 1)) * 400}
                              cy={80 - Math.min(day.count * 20, 76)}
                              r="3"
                              fill="#007bff"
                              stroke="#ffffff"
                              strokeWidth="2"
                            >
                              <title>{`${day.displayDate}: ${day.count} applications`}</title>
                            </circle>
                          ))}
                        </>
                      )}
                    </svg>
                  </div>
                )}
              </div>

              <div className="chart-container">
                <h4>Weekly Applications (Last 8 Weeks)</h4>
                {chartType === 'bar' ? (
                  <div className="mini-chart weekly-chart bar-chart">
                    {weeklyData.map((week, idx) => (
                      <div key={idx} className="chart-bar-container">
                        <div
                          className="chart-bar"
                          style={{
                            height: `${Math.max(week.count * 8, 4)}px`,
                            backgroundColor: week.count > 0 ? '#28a745' : '#e9ecef'
                          }}
                          title={`Week ${week.week}: ${week.count} applications`}
                        />
                        <div className="chart-bar-label">W{week.week}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mini-chart weekly-chart line-chart">
                    <svg width="400" height="80" viewBox="0 0 400 80">
                      <defs>
                        <linearGradient id="weeklyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#28a745" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#28a745" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {weeklyData.length > 1 && (
                        <>
                          <polyline
                            fill="none"
                            stroke="#28a745"
                            strokeWidth="2"
                            points={weeklyData.map((week, idx) =>
                              `${(idx / (weeklyData.length - 1)) * 400},${80 - Math.min(week.count * 15, 76)}`
                            ).join(' ')}
                          />
                          <polygon
                            fill="url(#weeklyGradient)"
                            points={`0,80 ${weeklyData.map((week, idx) =>
                              `${(idx / (weeklyData.length - 1)) * 400},${80 - Math.min(week.count * 15, 76)}`
                            ).join(' ')} 400,80`}
                          />
                          {weeklyData.map((week, idx) => (
                            <circle
                              key={idx}
                              cx={(idx / (weeklyData.length - 1)) * 400}
                              cy={80 - Math.min(week.count * 15, 76)}
                              r="3"
                              fill="#28a745"
                              stroke="#ffffff"
                              strokeWidth="2"
                            >
                              <title>{`Week ${week.week}: ${week.count} applications`}</title>
                            </circle>
                          ))}
                        </>
                      )}
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobStatsSection;