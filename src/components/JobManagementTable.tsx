import React, { useState } from 'react';
import { JobDescription } from '../types';
import './JobManagementTable.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbsUp, faMinus, faFire, faEdit, faCopy, faTable, faFileAlt, faComment, faTrash, faChartPie } from '@fortawesome/free-solid-svg-icons';
import StatusDropdown from './StatusDropdown';

interface JobManagementTableProps {
  jobs: JobDescription[];
  onEdit: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onStatusChange: (jobId: string, status: JobDescription['applicationStatus'], interviewStage?: JobDescription['interviewStage']) => void;
  onSelect: (jobId: string) => void;
  selectedJobId: string | null;
}

type SortField = 'id' | 'sequentialId' | 'company' | 'title' | 'applicationDate' | 'lastActivityDate' | 'applicationStatus' | 'daysSinceApplication';
type SortDirection = 'asc' | 'desc';

// Helper function to get impact level icon
const getImpactIcon = (impact: any) => {
  if (typeof impact === 'boolean') {
    return impact ? faFire : null;
  }
  switch (impact) {
    case 'high': return faFire;
    case 'medium': return faThumbsUp;
    case 'low': return null;
    default: return null;
  }
};

// Helper function to get impact level color
const getImpactColor = (impact: any) => {
  if (typeof impact === 'boolean') {
    return impact ? '#ff6b35' : '#6c757d';
  }
  switch (impact) {
    case 'high': return '#ff6b35'; // Orange/red for high impact
    case 'medium': return '#28a745'; // Green for medium
    case 'low': return '#6c757d'; // Gray for low (no icon)
    default: return '#6c757d'; // Gray for unspecified
  }
};

const JobManagementTable: React.FC<JobManagementTableProps> = ({
  jobs,
  onEdit,
  onDelete,
  onStatusChange,
  onSelect,
  selectedJobId
}) => {
  // Copy job description text to clipboard
  const handleCopyJobText = async (job: any) => {
    try {
      await navigator.clipboard.writeText(job.rawText);
      // Show brief success feedback
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '✅';
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = job.rawText;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  // Copy job description with chat instructions for resume generation
  const handleCopyForChat = async (job: any) => {
    const resumeTemplate = `# CLINT BUSH

Senior Front-End Engineer
Brooklyn, NY (Hybrid OK)  •  206-290-2726  •  [clint@madebyclint.com](mailto:clint@madebyclint.com)  •  linkedin.com/in/clintbush

---

## SUMMARY

Front-end engineer with 14+ years of experience building fast, intuitive, user-centered applications across fintech, startups, and mobile. Strong foundation in React, TypeScript, Next.js, and UI architecture, with a background in design that supports clean and reliable product execution. Experienced working with internal users, stakeholders, and cross-functional teams to shape workflows, reduce friction, and solve real operational problems. Motivated by helping small businesses thrive through thoughtful, practical tools. Comfortable in fast-paced, ambiguous environments with high ownership and iterative delivery.

## SKILLS

* **Frontend:** React, TypeScript, JavaScript (ES6+), Next.js, Hooks, Context, Redux
* **UI and UX:** Figma collaboration, layout, interaction patterns, accessibility (WCAG), responsive design
* **Architecture:** Component systems, modular UI, performance tuning, maintainability
* **Backend and APIs:** Node.js, REST APIs, SQL (PostgreSQL, MySQL), workflow integration
* **Mobile:** React Native, Expo
* **Quality:** Jest, Cypress, debugging, BrowserStack, release readiness
* **Process:** Agile, rapid prototyping, iterative development, CI/CD, stakeholder collaboration
* **Additional:** AI-assisted development, type generation, automated refactoring

## EXPERIENCE

### Lead Front-End Engineer / Technical Program Lead

WaFd Bank / Pike Street Labs  •  Seattle WA and Brooklyn NY  •  2021 to 2025
React, TypeScript, Next.js, React Native, Node.js, REST, SQL

* Built and maintained customer-facing interfaces used by hundreds of thousands of users across web and mobile banking.
* Led front-end architecture for an online banking redesign, including components, state patterns, and API integration.
* One of three engineers rebuilding the mobile app in React Native using AI-assisted workflows for faster iteration.
* Worked daily in Figma with designers to translate ambiguous workflows into clear, scalable UI patterns.
* Collaborated directly with internal users and product partners to understand workflow needs and refine internal tools.
* Created reusable component systems and design tokens to improve consistency and delivery speed.
* Improved perceived performance through render isolation, workflow splitting, and progressive loading.
* Managed and mentored a team of five developers while remaining hands-on for complex UI and integration work.
* Owned release processes, branch strategy, QA coordination, and production support across multiple teams.
* Used metrics, user feedback, and iterative cycles to refine features and improve usability.

### Senior Full-Stack Engineer

Homesite Insurance  •  Seattle WA  •  2014 to 2021
React, TypeScript, Redux, Node.js, REST

* Built and modernized customer-facing insurance applications across multiple product lines.
* Translated complex workflows into intuitive UI in close collaboration with product and design.
* Improved frontend performance, accessibility, and stability through iterative refactoring.
* Implemented Jest and Cypress testing patterns to reduce regressions and increase reliability.

### Frontend Developer

DoubleKnot Creative  •  Seattle WA  •  2010 to 2014

* Designed and built responsive, accessible websites for small businesses and nonprofits.
* Delivered pixel-accurate UI implementations and reusable components for maintainability.
* Improved site structure, semantic HTML, and performance across multiple client projects.

## SELECTED PROJECTS

### AI Travel Micro-App: WhereToGo (2025)

* Designed and shipped an AI-powered travel-planning tool using React and TypeScript.
* Focused on simple interactions, clean layout, and rapid iteration.
* Demonstrated strong 0 to 1 delivery and product-minded engineering.

### Resume Tracker: AI-Assisted Job Application Manager (2025)

* Built an AI-enhanced application tracking system with automated job description parsing and data extraction.
* Designed clean UI patterns and streamlined workflows using AI-accelerated development cycles.
* Delivered end-to-end product execution with prompt-assisted coding and rapid iteration.

## EDUCATION AND CERTIFICATIONS

* Mendix Intermediate Developer Certification
* Mendix Rapid Developer Certification
* Art Institute of Seattle: Dynamic Web Development
* University of Northern Colorado: BA in Graphic Design and Photography

## STRENGTHS

* Strong bridge between engineering, design, and real-world users.
* High ownership and comfort in startup environments.
* Clear communicator with strong collaboration instincts.
* Passionate about reducing operational friction for small businesses.`;

    // Generate dynamic label components
    const companyName = job.company || 'Unknown Company';
    const roleTitle = job.title || job.extractedInfo?.role || 'Unknown Role';
    const roleInitials = roleTitle
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 4); // Limit to 4 characters for readability
    const jobId = job.sequentialId || job.id || 'Unknown ID';

    const dynamicLabel = `Submitted: ${companyName} ${roleInitials} Job ${jobId}`;

    const chatPrompt = `From the following JD, generate a full Markdown resume that is fully ASCII-safe with:
- Label this thread as: ${dynamicLabel}
- Please use most recent resumes in project as base unless gaps exist - then use other resumes for examples of experience to fill gaps.
- Tailor experience and skills to best match the job description provided.
- Please include all examples from Selected Projects that are relevant to the job description.
- Only ONE divider line, placed immediately after the header and nowhere else in the document.
- Header compressed with bullet separators.
- Skills section using bullet points with bold category labels.
- No em dashes, no Unicode, and no fancy characters.
- Do NOT insert any additional dividers or horizontal rules anywhere else in the resume.
- Use your best judgment - I'll request changes if needed

Follow this exact format and structure:

${resumeTemplate}

Tailor the content to match the job requirements while keeping the same formatting, structure, and professional tone. Focus on relevant skills and experience that align with the role.

Job Description:
${job.rawText}`;

    try {
      await navigator.clipboard.writeText(chatPrompt);
      // Show brief success feedback
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '✅';
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = chatPrompt;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  // Copy Excel-formatted row for spreadsheet
  const handleCopyExcelRow = async (job: JobDescription) => {
    try {
      // Format the data similar to the spreadsheet structure shown in the attachment
      const today = new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
      }).replace(/\//g, '/');

      const formattedDate = job.applicationDate
        ? new Date(job.applicationDate).toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        }).replace(/\//g, '/')
        : today;

      // Create tab-separated values that can be pasted into Excel
      const excelRow = [
        formattedDate, // Date
        job.sequentialId || job.id, // ID
        job.source || job.extractedInfo?.jobUrl || 'Manual Entry', // Source
        job.company, // Company
        job.priority || 'No', // Impact (using priority as a proxy)
        job.title || job.extractedInfo?.role || 'Unknown Position', // Discipline/Role
        job.applicationStatus ?
          job.applicationStatus.charAt(0).toUpperCase() + job.applicationStatus.slice(1).replace('_', ' ')
          : 'Not Applied', // Status
        job.extractedInfo?.jobUrl || job.url || 'N/A', // Contact/Link
        job.secondaryContact || job.contactPerson || '' // Second Contact/Link
      ].join('\t');

      await navigator.clipboard.writeText(excelRow);

      // Show brief success feedback
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '✅';
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to copy Excel row:', error);
      alert('Failed to copy to clipboard');
    }
  };

  // Copy filename suggestion following the format: fname-lname-month-year-companynospace-initialsofrole-[resume|coverletter]
  const handleCopyFilename = async (job: JobDescription, type: 'resume' | 'coverletter' = 'resume') => {
    try {
      const now = new Date();
      const month = now.toLocaleString('default', { month: 'long' });
      const year = now.getFullYear();

      // Extract role initials from job title
      const roleWords = (job.title || job.extractedInfo?.role || 'General')
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.replace(/[^A-Za-z]/g, '')) // Remove non-alphabetic characters
        .filter(word => word.length > 0);

      const roleInitials = roleWords.map(word => word.charAt(0).toUpperCase()).join('');

      // Clean company name (remove spaces and special characters)
      const companyClean = job.company
        .replace(/\s+/g, '') // Remove spaces
        .replace(/[^A-Za-z0-9]/g, '') // Remove special characters
        .replace(/^[^A-Za-z]+/, '') // Remove leading non-alphabetic characters
        .substring(0, 20); // Limit length

      // Format: fname-lname-month-year-companynospace-initialsofrole-[resume|coverletter]
      const filename = `clint-bush-${month}-${year}-${companyClean}-${roleInitials}-${type}`;

      await navigator.clipboard.writeText(filename);

      // Show brief success feedback
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '✅';
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to copy filename:', error);
      alert('Failed to copy to clipboard');
    }
  };

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

  const formatSalary = (job: any) => {
    // First check if we have min/max values
    if (job.salaryMin && job.salaryMax) {
      const formatAmount = (amount: number) => {
        if (amount >= 1000) {
          return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
        }
        return `$${amount}`;
      };
      return `${formatAmount(job.salaryMin)}-${formatAmount(job.salaryMax)}`;
    }

    // Fallback to salaryRange field if available
    if (job.salaryRange) {
      return job.salaryRange;
    }

    // Check extractedInfo for salary range
    if (job.extractedInfo?.salaryRange) {
      return job.extractedInfo.salaryRange;
    }

    return null;
  };

  return (
    <div className="job-management-container">
      <div className="job-management-header">
        <h2 className="job-management-title">
          <FontAwesomeIcon icon={faChartPie} /> Job Applications
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
                  Company / Position
                  <span className={`sort-indicator ${sortField === 'company' ? 'active' : ''}`}>
                    {getSortIcon('company')}
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
            </tr>
          </thead>
          <tbody>
            {sortedJobs.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FontAwesomeIcon icon={faCopy} size="2x" /></div>
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
                  <td className="company-position-cell">
                    <div className="company-name">
                      {getImpactIcon(job.impact) && (
                        <FontAwesomeIcon
                          icon={getImpactIcon(job.impact)!}
                          style={{ color: getImpactColor(job.impact), marginRight: '6px', fontSize: '12px' }}
                          title={`Impact: ${typeof job.impact === 'string' ? job.impact : job.impact ? 'High' : 'None'}`}
                        />
                      )}
                      {job.company}
                    </div>
                    <div className="position-row">
                      <span className="position-title">
                        {job.title}
                        {formatSalary(job) && (
                          <span className="salary-info"> ({formatSalary(job)})</span>
                        )}
                      </span>
                      <span className="inline-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(job.id);
                          }}
                          className="action-btn edit-btn"
                          title="Edit job"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyJobText(job);
                          }}
                          className="action-btn copy-btn"
                          title="Copy job description text"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyExcelRow(job as JobDescription);
                          }}
                          className="action-btn copy-excel-btn"
                          title="Copy row for Excel (tab-separated)"
                        >
                          <FontAwesomeIcon icon={faTable} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyFilename(job as JobDescription, 'resume');
                          }}
                          className="action-btn copy-filename-btn"
                          title="Copy filename suggestion for resume"
                        >
                          <FontAwesomeIcon icon={faFileAlt} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyForChat(job);
                          }}
                          className="action-btn copy-chat-btn"
                          title="Copy for chat (with resume instructions)"
                        >
                          <FontAwesomeIcon icon={faComment} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(job.id);
                          }}
                          className="action-btn delete-btn"
                          title="Delete job"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </span>
                    </div>
                  </td>
                  <td className="status-cell">
                    <StatusDropdown
                      job={job as JobDescription}
                      onStatusChange={(jobId, status, interviewStage) => {
                        onStatusChange(jobId, status, interviewStage);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className={`days-cell ${getDaysClass(job.daysSinceApplication)}`}>
                    {formatDate(job.applicationDate)} ({job.daysSinceApplication !== null ? `${job.daysSinceApplication}d` : '-'})
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