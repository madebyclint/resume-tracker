import React from 'react';
import { JobDescription } from '../types';
import { getAnalytics, getFunnelAnalytics } from '../utils/activityLogger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faUsers, faArrowRight, faPercent } from '@fortawesome/free-solid-svg-icons';
import './AnalyticsDashboard.css';

interface AnalyticsDashboardProps {
  jobs: JobDescription[];
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ jobs }) => {
  const analytics = getAnalytics(jobs);
  const funnel = getFunnelAnalytics(jobs);

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="analytics-dashboard">
      <h3><FontAwesomeIcon icon={faChartBar} /> Job Application Analytics</h3>

      <div className="analytics-grid">
        {/* Funnel View */}
        <div className="analytics-card funnel-card">
          <h4><FontAwesomeIcon icon={faUsers} /> Application Funnel</h4>
          <div className="funnel-stage">
            <div className="funnel-item">
              <span className="funnel-label">Not Applied</span>
              <span className="funnel-count">{funnel.notApplied}</span>
            </div>
            <FontAwesomeIcon icon={faArrowRight} className="funnel-arrow" />
            <div className="funnel-item">
              <span className="funnel-label">Applied</span>
              <span className="funnel-count">{funnel.applied}</span>
            </div>
            <FontAwesomeIcon icon={faArrowRight} className="funnel-arrow" />
            <div className="funnel-item interview-stages">
              <span className="funnel-label">Interview Stages</span>
              <div className="interview-breakdown">
                <div><span className="stage-label">📞 Screening:</span> <span>{funnel.screening}</span></div>
                <div><span className="stage-label">👥 1st Interview:</span> <span>{funnel.firstInterview}</span></div>
                <div><span className="stage-label">🔄 Follow-up:</span> <span>{funnel.followupInterview}</span></div>
                <div><span className="stage-label">🎯 Final:</span> <span>{funnel.finalRound}</span></div>
                <div><span className="stage-label">📝 Assessment:</span> <span>{funnel.assessment}</span></div>
              </div>
            </div>
            <FontAwesomeIcon icon={faArrowRight} className="funnel-arrow" />
            <div className="funnel-outcomes">
              <div className="funnel-item success">
                <span className="funnel-label">Offered</span>
                <span className="funnel-count">{funnel.offered}</span>
              </div>
              <div className="funnel-item rejected">
                <span className="funnel-label">Rejected</span>
                <span className="funnel-count">{funnel.rejected}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion Rates */}
        <div className="analytics-card conversions-card">
          <h4><FontAwesomeIcon icon={faPercent} /> Conversion Rates</h4>
          <div className="conversion-list">
            <div className="conversion-item">
              <span>Applied → Interview:</span>
              <span className="conversion-rate">{formatPercent(analytics.conversionRates.appliedToInterview)}</span>
            </div>
            <div className="conversion-item">
              <span>Applied → Hired:</span>
              <span className="conversion-rate success">{formatPercent(analytics.conversionRates.appliedToHired)}</span>
            </div>
            <div className="conversion-item">
              <span>Applied → Rejected:</span>
              <span className="conversion-rate rejected">{formatPercent(analytics.conversionRates.appliedToRejected)}</span>
            </div>
            <div className="conversion-item">
              <span>Interview → Hired:</span>
              <span className="conversion-rate success">{formatPercent(analytics.conversionRates.interviewToHired)}</span>
            </div>
            <div className="conversion-item">
              <span>Interview → Rejected:</span>
              <span className="conversion-rate rejected">{formatPercent(analytics.conversionRates.interviewToRejected)}</span>
            </div>
          </div>
        </div>

        {/* Activity Summary */}
        <div className="analytics-card activity-card">
          <h4>Activity Summary</h4>
          <div className="activity-stats">
            <div className="stat-item">
              <span>Total Jobs:</span>
              <span className="stat-value">{analytics.totalJobs}</span>
            </div>
            <div className="stat-item">
              <span>Total Activities:</span>
              <span className="stat-value">{analytics.activitySummary.totalActivities}</span>
            </div>
            <div className="stat-item">
              <span>Status Changes:</span>
              <span className="stat-value">{analytics.activitySummary.statusChanges}</span>
            </div>
            <div className="stat-item">
              <span>Interview Changes:</span>
              <span className="stat-value">{analytics.activitySummary.interviewStageChanges}</span>
            </div>
            <div className="stat-item">
              <span>Notes Added:</span>
              <span className="stat-value">{analytics.activitySummary.notesAdded}</span>
            </div>
            {analytics.activitySummary.rapidStatusChanges > 0 && (
              <div className="stat-item warning">
                <span>Status Corrections:</span>
                <span className="stat-value">{analytics.activitySummary.rapidStatusChanges}</span>
              </div>
            )}
          </div>
        </div>

        {/* Journey Analysis */}
        <div className="analytics-card journey-card">
          <h4>Application Journey Analysis</h4>
          <div className="journey-stats">
            <div className="stat-item">
              <span>Jobs w/ Multiple Changes:</span>
              <span className="stat-value">{analytics.journeyAnalysis.jobsWithMultipleStatusChanges}</span>
            </div>
            <div className="stat-item">
              <span>Avg Changes per Job:</span>
              <span className="stat-value">{analytics.journeyAnalysis.averageStatusChangesPerJob.toFixed(1)}</span>
            </div>
            <div className="stat-item">
              <span>Ever Interviewed:</span>
              <span className="stat-value success">{analytics.journeyAnalysis.jobsThatReachedInterview}</span>
            </div>
            <div className="stat-item">
              <span>Ever Rejected:</span>
              <span className="stat-value rejected">{analytics.journeyAnalysis.jobsThatWereRejected}</span>
            </div>
            <div className="stat-item">
              <span>Ever Offered:</span>
              <span className="stat-value success">{analytics.journeyAnalysis.jobsThatWereOffered}</span>
            </div>
            {analytics.journeyAnalysis.correctionsDetected > 0 && (
              <div className="stat-item warning">
                <span>Corrections Detected:</span>
                <span className="stat-value">{analytics.journeyAnalysis.correctionsDetected}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;