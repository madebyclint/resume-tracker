import React from 'react';
import { JobDescription } from '../types';
import JobManagementTable from './JobManagementTable';
import { JobDetailsPanel } from './JobDetailsPanel';

interface JobListDisplayProps {
  jobs: JobDescription[];
  selectedJobId: string | null;
  showArchivedJobs: boolean;
  hideRejectedJobs: boolean;
  showOnlyWaitingJobs: boolean;
  statusFilter: string;
  showUnparsedFirst: boolean;
  onJobSelect: (jobId: string | null) => void;
  onJobEdit: (job: JobDescription) => void;
  onJobDelete: (jobId: string) => void;
  onQuickNote: (jobId: string, note: string) => void;
  onMarkDuplicate: (jobId: string) => void;
  onToggleArchive: (jobId: string, archived: boolean) => void;
  onWaitingToggle: (jobId: string, waiting: boolean) => void;
  onBulkStatusChange: (jobIds: string[], status: string) => void;
  onBulkArchive: (jobIds: string[]) => void;
  onBulkDelete: (jobIds: string[]) => void;
}

const JobListDisplay: React.FC<JobListDisplayProps> = ({
  jobs,
  selectedJobId,
  showArchivedJobs,
  hideRejectedJobs,
  showOnlyWaitingJobs,
  statusFilter,
  showUnparsedFirst,
  onJobSelect,
  onJobEdit,
  onJobDelete,
  onQuickNote,
  onMarkDuplicate,
  onToggleArchive,
  onWaitingToggle,
  onBulkStatusChange,
  onBulkArchive,
  onBulkDelete
}) => {
  const selectedJob = selectedJobId ? jobs.find(job => job.id === selectedJobId) : null;

  const filteredJobs = (() => {
    let filtered = jobs;

    // Filter out archived/duplicates if not showing archived
    if (!showArchivedJobs) {
      filtered = filtered.filter(job =>
        !job.isArchived &&
        job.applicationStatus !== 'archived' &&
        job.applicationStatus !== 'duplicate'
      );
    }

    // Filter out rejected if hiding rejected
    if (hideRejectedJobs) {
      filtered = filtered.filter(job =>
        job.applicationStatus !== 'rejected'
      );
    }

    // Show only waiting jobs if filter is enabled
    if (showOnlyWaitingJobs) {
      filtered = filtered.filter(job =>
        job.waitingForResponse === true
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(job => {
        const jobStatus = job.applicationStatus || 'not_applied';
        return jobStatus === statusFilter;
      });
    }

    // Sort: Show unparsed jobs first if enabled
    if (showUnparsedFirst) {
      filtered = filtered.sort((a, b) => {
        const aHasExtractedInfo = a.extractedInfo.companyDescription || a.extractedInfo.role;
        const bHasExtractedInfo = b.extractedInfo.companyDescription || b.extractedInfo.role;

        if (!aHasExtractedInfo && bHasExtractedInfo) return -1;
        if (aHasExtractedInfo && !bHasExtractedInfo) return 1;

        // Secondary sort by creation date (newer first)
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });
    } else {
      // Default sort by creation date (newer first)
      filtered = filtered.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });
    }

    return filtered;
  })();

  return (
    <div className={`jobs-layout ${selectedJob ? 'split-view' : 'full-width'}`}>
      <JobManagementTable
        jobs={filteredJobs}
        selectedJobId={selectedJobId}
        onJobSelect={onJobSelect}
        onJobEdit={onJobEdit}
        onJobDelete={onJobDelete}
        onMarkDuplicate={onMarkDuplicate}
        onToggleArchive={onToggleArchive}
        onWaitingToggle={onWaitingToggle}
        onBulkStatusChange={onBulkStatusChange}
        onBulkArchive={onBulkArchive}
        onBulkDelete={onBulkDelete}
      />

      {selectedJob && (
        <JobDetailsPanel
          selectedJob={selectedJob}
          onClose={() => onJobSelect(null)}
          onEdit={onJobEdit}
          onDelete={onJobDelete}
          onQuickNote={onQuickNote}
        />
      )}
    </div>
  );
};

export default JobListDisplay;