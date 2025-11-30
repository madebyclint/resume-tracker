import React, { useState } from 'react';
import { JobDescription } from '../types';
import './JobManagementTable.css';

interface JobManagementTableProps {
  jobs: JobDescription[];
  onEdit: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onStatusChange: (jobId: string, status: JobDescription['applicationStatus']) => void;
  onSelect: (jobId: string) => void;
  selectedJobId: string | null;
}

type SortField = 'id' | 'sequentialId' | 'company' | 'title' | 'applicationDate' | 'lastActivityDate' | 'applicationStatus' | 'daysSinceApplication';
type SortDirection = 'asc' | 'desc';

const JobManagementTable: React.FC<JobManagementTableProps> = ({
  jobs,
  onEdit,
  onDelete,
  onStatusChange,
  onSelect,
  selectedJobId
}) => {
  const [sortField, setSortField] = useState<SortField>('sequentialId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Calculate computed fields for each job
  const jobsWithComputedFields = jobs.map(job => ({
    ...job,
    daysSinceApplication: job.applicationDate ?
      Math.ceil((new Date().getTime() - new Date(job.applicationDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
    daysInCurrentStatus: job.lastActivityDate ?
      Math.ceil((new Date().getTime() - new Date(job.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)) : null
  }));

  // Filter jobs
  const filteredJobs = jobsWithComputedFields.filter(job => {
    const matchesSearch = searchTerm === '' ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.sequentialId && job.sequentialId.toString().includes(searchTerm)) ||
      (job.id && job.id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || job.applicationStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Sort jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'id':
        // Extract numeric part from ID for proper sorting
        aValue = parseInt(a.id.replace(/\D/g, '')) || 0;
        bValue = parseInt(b.id.replace(/\D/g, '')) || 0;
        break;
      case 'sequentialId':
        aValue = a.sequentialId || 0;
        bValue = b.sequentialId || 0;
        break;
      case 'company':
        aValue = a.company.toLowerCase();
        bValue = b.company.toLowerCase();
        break;
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'applicationStatus':
        aValue = a.applicationStatus || 'not_applied';
        bValue = b.applicationStatus || 'not_applied';
        break;
      case 'applicationDate':
        aValue = a.applicationDate ? new Date(a.applicationDate).getTime() : 0;
        bValue = b.applicationDate ? new Date(b.applicationDate).getTime() : 0;
        break;
      case 'lastActivityDate':
        aValue = a.lastActivityDate ? new Date(a.lastActivityDate).getTime() : 0;
        bValue = b.lastActivityDate ? new Date(b.lastActivityDate).getTime() : 0;
        break;
      case 'daysSinceApplication':
        aValue = a.daysSinceApplication || 0;
        bValue = b.daysSinceApplication || 0;
        break;
      default:
        aValue = '';
        bValue = '';
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '⇅';
    return sortDirection === 'asc' ? '↗️' : '↘️';
  };

  const getDaysClass = (days: number | null) => {
    if (!days) return '';
    if (days <= 7) return 'days-recent';
    if (days <= 30) return 'days-moderate';
    return 'days-old';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="job-management-container">
      <div className="job-management-header">
        <h2 className="job-management-title">
          📊 Job Applications
          <span className="job-count-badge">{filteredJobs.length} of {jobs.length}</span>
        </h2>

        <button
          className="filters-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          🎛️ {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {showFilters && (
        <div className="filters-section">
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              placeholder="Search companies or positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="not_applied">Not Applied</option>
              <option value="applied">Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="rejected">Rejected</option>
              <option value="offered">Offered</option>
            </select>
          </div>



          <button
            className="clear-filters-btn"
            onClick={() => {
              setFilterStatus('all');
              setSearchTerm('');
            }}
          >
            Clear All
          </button>
        </div>
      )}

      <div className="job-table-container">
        <table className="job-table">
          <thead>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>
                <div
                  className={`sortable-header ${sortField === 'sequentialId' ? 'active' : ''}`}
                  onClick={() => handleSort('sequentialId')}
                >
                  Job #
                  <span className={`sort-indicator ${sortField === 'sequentialId' ? 'active' : ''}`}>
                    {getSortIcon('sequentialId')}
                  </span>
                </div>
              </th>
              <th>
                <div
                  className={`sortable-header ${sortField === 'company' ? 'active' : ''}`}
                  onClick={() => handleSort('company')}
                >
                  Company
                  <span className={`sort-indicator ${sortField === 'company' ? 'active' : ''}`}>
                    {getSortIcon('company')}
                  </span>
                </div>
              </th>
              <th>
                <div
                  className={`sortable-header ${sortField === 'title' ? 'active' : ''}`}
                  onClick={() => handleSort('title')}
                >
                  Position
                  <span className={`sort-indicator ${sortField === 'title' ? 'active' : ''}`}>
                    {getSortIcon('title')}
                  </span>
                </div>
              </th>
              <th>
                <div
                  className={`sortable-header ${sortField === 'applicationStatus' ? 'active' : ''}`}
                  onClick={() => handleSort('applicationStatus')}
                >
                  Status
                  <span className={`sort-indicator ${sortField === 'applicationStatus' ? 'active' : ''}`}>
                    {getSortIcon('applicationStatus')}
                  </span>
                </div>
              </th>
              <th>
                <div
                  className={`sortable-header ${sortField === 'applicationDate' ? 'active' : ''}`}
                  onClick={() => handleSort('applicationDate')}
                >
                  Applied
                  <span className={`sort-indicator ${sortField === 'applicationDate' ? 'active' : ''}`}>
                    {getSortIcon('applicationDate')}
                  </span>
                </div>
              </th>
              <th>
                <div
                  className={`sortable-header ${sortField === 'daysSinceApplication' ? 'active' : ''}`}
                  onClick={() => handleSort('daysSinceApplication')}
                >
                  Days Ago
                  <span className={`sort-indicator ${sortField === 'daysSinceApplication' ? 'active' : ''}`}>
                    {getSortIcon('daysSinceApplication')}
                  </span>
                </div>
              </th>
              <th>
                <div
                  className={`sortable-header ${sortField === 'lastActivityDate' ? 'active' : ''}`}
                  onClick={() => handleSort('lastActivityDate')}
                >
                  Last Activity
                  <span className={`sort-indicator ${sortField === 'lastActivityDate' ? 'active' : ''}`}>
                    {getSortIcon('lastActivityDate')}
                  </span>
                </div>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">
                      {jobs.length === 0 ? 'No job applications yet' : 'No jobs match your filters'}
                    </div>
                    <div className="empty-state-description">
                      {jobs.length === 0
                        ? 'Start by adding a job description or importing from CSV'
                        : 'Try adjusting your search or filter criteria'
                      }
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedJobs.map(job => (
                <tr
                  key={job.id}
                  className={selectedJobId === job.id ? 'selected' : ''}
                  onClick={() => onSelect(job.id)}
                >
                  <td className="id-cell" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    <span className="job-id" title={`UUID: ${job.id}`}>
                      {job.sequentialId || 'N/A'}
                    </span>
                  </td>
                  <td className="company-cell">{job.company}</td>
                  <td className="title-cell">{job.title}</td>
                  <td className="status-cell">
                    <select
                      value={job.applicationStatus || 'not_applied'}
                      onChange={(e) => {
                        e.stopPropagation();
                        onStatusChange(job.id, e.target.value as JobDescription['applicationStatus']);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={`status-select status-${job.applicationStatus || 'not_applied'}`}
                    >
                      <option value="not_applied">Not Applied</option>
                      <option value="applied">Applied</option>
                      <option value="interviewing">Interviewing</option>
                      <option value="rejected">Rejected</option>
                      <option value="offered">Offered</option>
                    </select>
                  </td>
                  <td className="date-cell">
                    {formatDate(job.applicationDate)}
                  </td>
                  <td className={`days-cell ${getDaysClass(job.daysSinceApplication)}`}>
                    {job.daysSinceApplication !== null ? `${job.daysSinceApplication}d` : '-'}
                  </td>
                  <td className="date-cell">
                    {formatDate(job.lastActivityDate)}
                  </td>
                  <td className="actions-cell">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(job.id);
                      }}
                      className="action-btn edit-btn"
                      title="Edit job"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(job.id);
                      }}
                      className="action-btn delete-btn"
                      title="Delete job"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JobManagementTable;