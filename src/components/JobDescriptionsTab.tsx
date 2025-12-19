import React from 'react';
import JobManagementTable from './JobManagementTable';
import ActionReminderPanel from './ActionReminderPanel';
import ScraperStatusIndicator from './ScraperStatusIndicator';

interface JobDescriptionsTabProps {
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
}

const JobDescriptionsTab: React.FC<JobDescriptionsTabProps> = ({
  state,
  showArchivedJobs, setShowArchivedJobs,
  hideRejectedJobs, setHideRejectedJobs,
  showOnlyWaitingJobs, setShowOnlyWaitingJobs,
  showUnparsedFirst, setShowUnparsedFirst,
  searchQuery, setSearchQuery,
  statusFilter, setStatusFilter,
  editingNotesId, tempNotes, setTempNotes,
  selectedJob, onJobSelect,
  onDeleteJob, onArchiveJob, onUnarchiveJob, onToggleWaiting,
  onStatusChange, onQuickNote, onEditNotes, onSaveNotes, onCancelNotes,
  onGenerateResume, onGenerateCoverLetter,
  onEditJob, onPreviewJob, onProcessJob,
  totalJobs, activeJobs, waitingJobs, unparsedJobsCount
}) => {
  return (
    <>
      {/* Action reminder panel */}
      <ActionReminderPanel
        jobs={state.jobDescriptions}
        onJobSelect={onJobSelect}
        showArchivedJobs={showArchivedJobs}
        hideRejectedJobs={hideRejectedJobs}
      />

      {/* Filters and search */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search job descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-toggles">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showArchivedJobs}
                onChange={(e) => setShowArchivedJobs(e.target.checked)}
              />
              Show archived jobs
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={hideRejectedJobs}
                onChange={(e) => setHideRejectedJobs(e.target.checked)}
              />
              Hide rejected jobs
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showOnlyWaitingJobs}
                onChange={(e) => setShowOnlyWaitingJobs(e.target.checked)}
              />
              Show only waiting for response
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showUnparsedFirst}
                onChange={(e) => setShowUnparsedFirst(e.target.checked)}
              />
              Show unparsed first
            </label>
          </div>

          <div className="status-filter">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All statuses</option>
              <option value="not_applied">Not Applied</option>
              <option value="applied">Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="rejected">Rejected</option>
              <option value="offered">Offered</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>

        {/* Stats row */}
        <div className="stats-row">
          <span className="stat-item">
            Total: <strong>{totalJobs}</strong>
          </span>
          <span className="stat-item">
            Active: <strong>{activeJobs}</strong>
          </span>
          <span className="stat-item">
            Waiting: <strong>{waitingJobs}</strong>
          </span>
          <span className="stat-item">
            Unparsed: <strong>{unparsedJobsCount}</strong>
          </span>
        </div>
      </div>

      {/* Job table */}
      <JobManagementTable
        jobDescriptions={state.jobDescriptions}
        resumes={state.resumes}
        coverLetters={state.coverLetters}
        onDeleteJob={onDeleteJob}
        onArchiveJob={onArchiveJob}
        onUnarchiveJob={onUnarchiveJob}
        onToggleWaitingForResponse={onToggleWaiting}
        onStatusChange={onStatusChange}
        onQuickNote={onQuickNote}
        onEditNotes={onEditNotes}
        onSaveNotes={onSaveNotes}
        onCancelNotesEdit={onCancelNotes}
        onGenerateResume={onGenerateResume}
        onGenerateCoverLetter={onGenerateCoverLetter}
        onEditJobDescription={onEditJob}
        onPreviewJob={onPreviewJob}
        onProcessJob={onProcessJob}
        showArchivedJobs={showArchivedJobs}
        hideRejectedJobs={hideRejectedJobs}
        showOnlyWaitingJobs={showOnlyWaitingJobs}
        showUnparsedFirst={showUnparsedFirst}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        editingNotesId={editingNotesId}
        tempNotes={tempNotes}
        onTempNotesChange={setTempNotes}
        selectedJob={selectedJob}
        onJobSelect={onJobSelect}
      />

      {/* Scraper status indicator */}
      <ScraperStatusIndicator />
    </>
  );
};

export default JobDescriptionsTab;