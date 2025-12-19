import React from 'react';
import { JobDescription } from '../types';
import './DuplicateJobModal.css';

interface DuplicateJobModalProps {
  isOpen: boolean;
  duplicateJobId: string | null;
  searchQuery: string;
  jobs: JobDescription[];
  onClose: () => void;
  onSearchChange: (query: string) => void;
  onConfirmDuplicate: (originalJobId: string) => void;
}

const DuplicateJobModal: React.FC<DuplicateJobModalProps> = ({
  isOpen,
  duplicateJobId,
  searchQuery,
  jobs,
  onClose,
  onSearchChange,
  onConfirmDuplicate
}) => {
  if (!isOpen || !duplicateJobId) return null;

  const availableJobs = (() => {
    let filteredJobs = jobs.filter(job =>
      job.id !== duplicateJobId &&
      job.applicationStatus !== 'duplicate'
    );

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredJobs = filteredJobs.filter(job =>
        job.company.toLowerCase().includes(query) ||
        job.title.toLowerCase().includes(query) ||
        (job.role && job.role.toLowerCase().includes(query)) ||
        (job.extractedInfo.role && job.extractedInfo.role.toLowerCase().includes(query)) ||
        (job.location && job.location.toLowerCase().includes(query)) ||
        (job.extractedInfo.location && job.extractedInfo.location.toLowerCase().includes(query))
      );
    }

    return filteredJobs;
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Mark as Duplicate</h3>
          <button
            className="modal-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>Select the original job that this is a duplicate of:</p>
          <div className="duplicate-search-container">
            <input
              type="text"
              placeholder="Search original jobs (company, title, role...)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="duplicate-search-input"
            />
          </div>
          <div className="duplicate-job-list">
            {availableJobs.map(job => (
              <div
                key={job.id}
                className="duplicate-job-option"
                onClick={() => onConfirmDuplicate(job.id)}
              >
                <div className="job-info">
                  <strong>{job.title}</strong>
                  <span className="company-name">{job.company}</span>
                  {job.sequentialId && <span className="job-number">#{job.sequentialId}</span>}
                </div>
                <div className="job-status">
                  {job.applicationStatus || 'not_applied'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateJobModal;