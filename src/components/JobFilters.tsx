import React from 'react';
import StatusDropdown from './StatusDropdown';
import './JobFilters.css';

interface JobFiltersProps {
  statusFilter: string;
  showArchivedJobs: boolean;
  hideRejectedJobs: boolean;
  showOnlyWaitingJobs: boolean;
  showUnparsedFirst: boolean;
  onStatusFilterChange: (status: string) => void;
  onShowArchivedChange: (show: boolean) => void;
  onHideRejectedChange: (hide: boolean) => void;
  onShowOnlyWaitingChange: (show: boolean) => void;
  onShowUnparsedFirstChange: (show: boolean) => void;
}

const JobFilters: React.FC<JobFiltersProps> = ({
  statusFilter,
  showArchivedJobs,
  hideRejectedJobs,
  showOnlyWaitingJobs,
  showUnparsedFirst,
  onStatusFilterChange,
  onShowArchivedChange,
  onHideRejectedChange,
  onShowOnlyWaitingChange,
  onShowUnparsedFirstChange
}) => {
  return (
    <div className="job-filters">
      <div className="filter-row">
        <div className="status-filter">
          <label>Filter by Status:</label>
          <StatusDropdown
            value={statusFilter}
            onChange={onStatusFilterChange}
            includeEmpty={true}
            emptyLabel="All Statuses"
          />
        </div>
      </div>

      <div className="filter-checkboxes">
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={showArchivedJobs}
            onChange={(e) => onShowArchivedChange(e.target.checked)}
          />
          Show archived jobs
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={hideRejectedJobs}
            onChange={(e) => onHideRejectedChange(e.target.checked)}
          />
          Hide rejected jobs
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={showOnlyWaitingJobs}
            onChange={(e) => onShowOnlyWaitingChange(e.target.checked)}
          />
          Show only waiting for response
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={showUnparsedFirst}
            onChange={(e) => onShowUnparsedFirstChange(e.target.checked)}
          />
          Show unparsed jobs first
        </label>
      </div>
    </div>
  );
};

export default JobFilters;