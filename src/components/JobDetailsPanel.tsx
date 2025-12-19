import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileAlt,
  faEdit,
  faTrash,
  faCalendarAlt,
  faBriefcase,
  faMapMarkerAlt,
  faDollarSign,
  faUser,
  faPhone,
  faEnvelope,
  faLink,
  faStickyNote,
  faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons';
import { JobDescription } from '../types';

interface JobDetailsPanelProps {
  selectedJob: JobDescription;
  onClose: () => void;
  onEdit: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onQuickNote: (jobId: string, note: string) => void;
}

export const JobDetailsPanel: React.FC<JobDetailsPanelProps> = ({
  selectedJob,
  onClose,
  onEdit,
  onDelete,
  onQuickNote
}) => {
  return (
    <div className="job-details">
      <div className="job-details-header">
        <div className="job-title-section">
          <h2>{selectedJob.title}</h2>
        </div>
        <div className="job-actions">
          <button
            className="close-split-button"
            onClick={onClose}
            title="Close details panel"
          >
            ✕
          </button>
          <button
            className="edit-button"
            onClick={() => onEdit(selectedJob.id)}
          >
            Edit
          </button>
          <button
            className="delete-button"
            onClick={() => onDelete(selectedJob.id)}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="job-details-content">
        <div className="status-section">
          <div className="status-info">
            <span className={`status-badge status-${selectedJob.applicationStatus || 'not_applied'}`}>
              {selectedJob.applicationStatus === 'not_applied' && '📝 Not Applied'}
              {selectedJob.applicationStatus === 'applied' && '📤 Applied'}
              {selectedJob.applicationStatus === 'interviewing' && '💬 Interviewing'}
              {selectedJob.applicationStatus === 'rejected' && '❌ Rejected'}
              {selectedJob.applicationStatus === 'offered' && '🎉 Offered'}
              {selectedJob.applicationStatus === 'withdrawn' && '🚪 Withdrawn'}
              {selectedJob.applicationStatus === 'wont_apply' && '🚫 Won\'t Apply'}
              {selectedJob.applicationStatus === 'duplicate' && '👥 Duplicate'}
              {selectedJob.applicationStatus === 'archived' && '📦 Archived'}
            </span>
            {selectedJob.sequentialId && (
              <span className="sequential-id">Job #{selectedJob.sequentialId}</span>
            )}
          </div>
        </div>

        <div className="company-section">
          <div className="company-info">
            <h3>
              <FontAwesomeIcon icon={faBriefcase} className="company-icon" />
              {selectedJob.company}
            </h3>
            {selectedJob.location && (
              <p className="location">
                <FontAwesomeIcon icon={faMapMarkerAlt} />
                {selectedJob.location}
              </p>
            )}
            {selectedJob.workArrangement && (
              <p className="work-arrangement">
                Work: {selectedJob.workArrangement}
              </p>
            )}
          </div>
        </div>

        {(selectedJob.salaryRange || (selectedJob.salaryMin && selectedJob.salaryMax)) && (
          <div className="salary-section">
            <h4><FontAwesomeIcon icon={faDollarSign} /> Salary</h4>
            <p>
              {selectedJob.salaryRange ||
                `$${selectedJob.salaryMin?.toLocaleString()} - $${selectedJob.salaryMax?.toLocaleString()}`}
            </p>
          </div>
        )}

        {selectedJob.contact && (selectedJob.contact.name || selectedJob.contact.email || selectedJob.contact.phone) && (
          <div className="contact-section">
            <h4><FontAwesomeIcon icon={faUser} /> Contact</h4>
            {selectedJob.contact.name && <p><FontAwesomeIcon icon={faUser} /> {selectedJob.contact.name}</p>}
            {selectedJob.contact.email && <p><FontAwesomeIcon icon={faEnvelope} /> {selectedJob.contact.email}</p>}
            {selectedJob.contact.phone && <p><FontAwesomeIcon icon={faPhone} /> {selectedJob.contact.phone}</p>}
          </div>
        )}

        {selectedJob.url && (
          <div className="url-section">
            <h4><FontAwesomeIcon icon={faLink} /> Job Listing</h4>
            <a href={selectedJob.url} target="_blank" rel="noopener noreferrer">
              <FontAwesomeIcon icon={faExternalLinkAlt} /> View Original Posting
            </a>
          </div>
        )}

        {selectedJob.additionalContext && (
          <div className="additional-context-section">
            <h3>Additional Context</h3>
            <div className="context-content">
              <p>{selectedJob.additionalContext}</p>
            </div>
          </div>
        )}

        {/* Enhanced Notes Section */}
        <div className="notes-section">
          <div className="notes-header">
            <h3>Notes</h3>
            <div className="notes-actions">
              <div className="quick-notes">
                <button
                  className="quick-note-btn"
                  onClick={() => onQuickNote(selectedJob.id, 'Applied')}
                  title="Mark as applied"
                >
                  <FontAwesomeIcon icon={faFileAlt} /> Applied
                </button>
                <button
                  className="quick-note-btn"
                  onClick={() => onQuickNote(selectedJob.id, 'Interview scheduled')}
                  title="Note interview scheduled"
                >
                  📅 Interview
                </button>
                <button
                  className="quick-note-btn"
                  onClick={() => onQuickNote(selectedJob.id, 'Follow up needed')}
                  title="Mark for follow up"
                >
                  📞 Follow Up
                </button>
              </div>
            </div>
          </div>
          <div className="notes-content">
            {selectedJob.notes ? (
              <p>{selectedJob.notes}</p>
            ) : (
              <p className="no-notes">No notes yet. Click "Edit" to add notes.</p>
            )}
          </div>
        </div>

        {selectedJob.applicationDate && (
          <div className="application-info">
            <p>
              <FontAwesomeIcon icon={faCalendarAlt} />
              Applied: {new Date(selectedJob.applicationDate).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="keywords-section">
          <h3>Keywords ({selectedJob.keywords.length})</h3>
          <div className="keywords-list">
            {selectedJob.keywords.map((keyword, idx) => (
              <span key={idx} className="keyword-tag">{keyword}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};