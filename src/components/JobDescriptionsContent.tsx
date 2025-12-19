import React from 'react';
import JobManagementTable from './JobManagementTable';
import { JobDetailsPanel } from './JobDetailsPanel';
import { JobDescription } from '../types';

interface JobDescriptionsContentProps {
  state: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showArchivedJobs: boolean;
  setShowArchivedJobs: (show: boolean) => void;
  hideRejectedJobs: boolean;
  setHideRejectedJobs: (hide: boolean) => void;
  showOnlyWaitingJobs: boolean;
  setShowOnlyWaitingJobs: (show: boolean) => void;
  showUnparsedFirst: boolean;
  setShowUnparsedFirst: (show: boolean) => void;
  statusFilter: string;
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  onEditJob: (id: string) => void;
  onDeleteJob: (id: string) => void;
  onArchiveJob: (id: string) => void;
  onUnarchiveJob: (id: string) => void;
  onMarkDuplicate: (id: string) => void;
  onStatusChange: (jobId: string, status: any, interviewStage?: any, offerStage?: any) => void;
  onToggleWaitingForResponse: (id: string) => void;
  onProcessJob: (id: string) => void;
  onQuickNote: (jobId: string, noteText: string) => void;
}

const JobDescriptionsContent: React.FC<JobDescriptionsContentProps> = ({
  state,
  searchQuery,
  setSearchQuery,
  showArchivedJobs,
  setShowArchivedJobs,
  hideRejectedJobs,
  setHideRejectedJobs,
  showOnlyWaitingJobs,
  setShowOnlyWaitingJobs,
  showUnparsedFirst,
  setShowUnparsedFirst,
  statusFilter,
  selectedJobId,
  setSelectedJobId,
  onEditJob,
  onDeleteJob,
  onArchiveJob,
  onUnarchiveJob,
  onMarkDuplicate,
  onStatusChange,
  onToggleWaitingForResponse,
  onProcessJob,
  onQuickNote
}) => {
  const selectedJob = selectedJobId ? state.jobDescriptions.find((jd: JobDescription) => jd.id === selectedJobId) : null;

  const isJobUnparsed = (job: JobDescription) => {
    return !job.extractedInfo ||
      (!job.extractedInfo.requiredSkills?.length && !job.extractedInfo.preferredSkills?.length);
  };

  // Filter and sort jobs
  const getFilteredJobs = () => {
    let filteredJobs = [...state.jobDescriptions];

    // Hide archived jobs unless explicitly shown
    if (!showArchivedJobs) {
      filteredJobs = filteredJobs.filter(job => !job.isArchived);
    }

    // Hide rejected jobs if enabled
    if (hideRejectedJobs) {
      filteredJobs = filteredJobs.filter(job =>
        job.applicationStatus !== 'rejected'
      );
    }

    // Show only waiting jobs if filter is enabled
    if (showOnlyWaitingJobs) {
      filteredJobs = filteredJobs.filter(job =>
        job.waitingForResponse === true
      );
    }

    // Apply status filter
    if (statusFilter) {
      filteredJobs = filteredJobs.filter(job => {
        const jobStatus = job.applicationStatus || 'not_applied';
        return jobStatus === statusFilter;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredJobs = filteredJobs.filter(job =>
        job.company.toLowerCase().includes(query) ||
        job.title.toLowerCase().includes(query) ||
        (job.role && job.role.toLowerCase().includes(query)) ||
        (job.extractedInfo.role && job.extractedInfo.role.toLowerCase().includes(query)) ||
        (job.location && job.location.toLowerCase().includes(query)) ||
        (job.extractedInfo.location && job.extractedInfo.location.toLowerCase().includes(query)) ||
        (job.source && job.source.toLowerCase().includes(query))
      );
    }

    // Sort to prioritize unparsed jobs if enabled
    if (showUnparsedFirst) {
      filteredJobs = filteredJobs.sort((a, b) => {
        const aUnparsed = isJobUnparsed(a);
        const bUnparsed = isJobUnparsed(b);

        // Unparsed jobs first
        if (aUnparsed && !bUnparsed) return -1;
        if (!aUnparsed && bUnparsed) return 1;

        // Within same category (both parsed or both unparsed), sort by upload date (newest first)
        const aDate = new Date(a.uploadDate).getTime();
        const bDate = new Date(b.uploadDate).getTime();
        return bDate - aDate;
      });
    }

    return filteredJobs;
  };

  if (state.jobDescriptions.length === 0) {
    return (
      <div className="job-descriptions-content">
        <div className="empty-state">
          <p>No job descriptions yet. Add one to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="job-descriptions-content">
      <div className="job-filters">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search jobs (company, title, role...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={showArchivedJobs}
            onChange={(e) => setShowArchivedJobs(e.target.checked)}
          />
          Show archived jobs
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={hideRejectedJobs}
            onChange={(e) => setHideRejectedJobs(e.target.checked)}
          />
          Hide rejected applications
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={showOnlyWaitingJobs}
            onChange={(e) => setShowOnlyWaitingJobs(e.target.checked)}
          />
          Show only waiting for response
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={showUnparsedFirst}
            onChange={(e) => setShowUnparsedFirst(e.target.checked)}
          />
          Show unparsed first
        </label>
      </div>

      <div className="jobs-list-container">
        <JobManagementTable
          jobs={getFilteredJobs()}
          onEdit={onEditJob}
          onDelete={onDeleteJob}
          onArchive={onArchiveJob}
          onUnarchive={onUnarchiveJob}
          onMarkDuplicate={onMarkDuplicate}
          onStatusChange={onStatusChange}
          onToggleWaitingForResponse={onToggleWaitingForResponse}
          onProcessJob={onProcessJob}
          onSelect={setSelectedJobId}
          selectedJobId={selectedJobId}
          preserveOrder={showUnparsedFirst}
        />

        {selectedJob && (
          <JobDetailsPanel
            selectedJob={selectedJob}
            onClose={() => setSelectedJobId(null)}
            onEdit={onEditJob}
            onDelete={onDeleteJob}
            onQuickNote={onQuickNote}
          />
        )}
      </div>
    </div>
  );
};

export default JobDescriptionsContent;