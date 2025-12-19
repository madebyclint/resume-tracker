import React from 'react';
import JobDescriptionsTab from './JobDescriptionsTab';
import AnalyticsTab from './AnalyticsTab';

interface MainTabContentProps {
  activeTab: 'job-descriptions' | 'analytics';

  // Props for JobDescriptionsTab
  state: any;
  showArchivedJobs: boolean;
  setShowArchivedJobs: (show: boolean) => void;
  hideRejectedJobs: boolean;
  setHideRejectedJobs: (hide: boolean) => void;
  showOnlyWaitingJobs: boolean;
  setShowOnlyWaitingJobs: (show: boolean) => void;
  showUnparsedFirst: boolean;
  setShowUnparsedFirst: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: any) => void;
  editingNotesId: string | null;
  tempNotes: string;
  setTempNotes: (notes: string) => void;
  selectedJob: any;
  onJobSelect: (job: any) => void;
  onDeleteJob: (id: string) => void;
  onArchiveJob: (id: string) => void;
  onUnarchiveJob: (id: string) => void;
  onToggleWaiting: (id: string) => void;
  onStatusChange: (jobId: string, status: any, interviewStage?: any, offerStage?: any) => void;
  onQuickNote: (jobId: string, note: string) => void;
  onEditNotes: (jobId: string) => void;
  onSaveNotes: (jobId: string) => void;
  onCancelNotes: () => void;
  onGenerateResume: (job: any) => void;
  onGenerateCoverLetter: (job: any) => void;
  onEditJob: (jobId: string) => void;
  onPreviewJob: (job: any) => void;
  onProcessJob: (jobId: string) => void;
  totalJobs: number;
  activeJobs: number;
  waitingJobs: number;
  unparsedJobsCount: number;

  // Props for AnalyticsTab
  statsData: any;
  chartType: 'bar' | 'line';
  setChartType: (type: 'bar' | 'line') => void;
  showExpandedStats: boolean;
  setShowExpandedStats: (show: boolean) => void;
}

const MainTabContent: React.FC<MainTabContentProps> = (props) => {
  if (props.activeTab === 'analytics') {
    return (
      <AnalyticsTab
        statsData={props.statsData}
        chartType={props.chartType}
        setChartType={props.setChartType}
        showExpandedStats={props.showExpandedStats}
        setShowExpandedStats={props.setShowExpandedStats}
      />
    );
  }

  return (
    <JobDescriptionsTab
      state={props.state}
      showArchivedJobs={props.showArchivedJobs}
      setShowArchivedJobs={props.setShowArchivedJobs}
      hideRejectedJobs={props.hideRejectedJobs}
      setHideRejectedJobs={props.setHideRejectedJobs}
      showOnlyWaitingJobs={props.showOnlyWaitingJobs}
      setShowOnlyWaitingJobs={props.setShowOnlyWaitingJobs}
      showUnparsedFirst={props.showUnparsedFirst}
      setShowUnparsedFirst={props.setShowUnparsedFirst}
      searchQuery={props.searchQuery}
      setSearchQuery={props.setSearchQuery}
      statusFilter={props.statusFilter}
      setStatusFilter={props.setStatusFilter}
      editingNotesId={props.editingNotesId}
      tempNotes={props.tempNotes}
      setTempNotes={props.setTempNotes}
      selectedJob={props.selectedJob}
      onJobSelect={props.onJobSelect}
      onDeleteJob={props.onDeleteJob}
      onArchiveJob={props.onArchiveJob}
      onUnarchiveJob={props.onUnarchiveJob}
      onToggleWaiting={props.onToggleWaiting}
      onStatusChange={props.onStatusChange}
      onQuickNote={props.onQuickNote}
      onEditNotes={props.onEditNotes}
      onSaveNotes={props.onSaveNotes}
      onCancelNotes={props.onCancelNotes}
      onGenerateResume={props.onGenerateResume}
      onGenerateCoverLetter={props.onGenerateCoverLetter}
      onEditJob={props.onEditJob}
      onPreviewJob={props.onPreviewJob}
      onProcessJob={props.onProcessJob}
      totalJobs={props.totalJobs}
      activeJobs={props.activeJobs}
      waitingJobs={props.waitingJobs}
      unparsedJobsCount={props.unparsedJobsCount}
    />
  );
};

export default MainTabContent;