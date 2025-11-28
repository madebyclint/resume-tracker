import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext';
import { JobDescription } from '../types';
import { parseJobDescription } from '../utils/aiService';
import { saveJobDescription, deleteJobDescription } from '../storage';
import { calculateDocumentMatches, DocumentMatch } from '../utils/documentMatcher';
import './JobDescriptionsPage.css';

// Remove the local interface since we're using the one from documentMatcher

const JobDescriptionsPage: React.FC = () => {
  const { state, setState } = useAppState();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    rawText: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const handleAddJobDescription = async () => {
    if (!formData.title.trim() || !formData.company.trim() || !formData.rawText.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);

    try {
      // Parse job description with AI
      const parseResult = await parseJobDescription(formData.rawText);

      // Use AI-extracted info to fill in missing fields if available
      const finalTitle = formData.title.trim() || parseResult.extractedInfo.role || 'Untitled Position';
      const finalCompany = formData.company.trim() || parseResult.extractedInfo.company || 'Unknown Company';

      // Create job description object
      const newJobDescription: JobDescription = {
        id: crypto.randomUUID(),
        title: finalTitle,
        company: finalCompany,
        rawText: formData.rawText.trim(),
        extractedInfo: parseResult.extractedInfo,
        keywords: parseResult.keywords,
        uploadDate: new Date().toISOString(),
        linkedResumeIds: [],
        linkedCoverLetterIds: [],
        applicationStatus: 'not_applied'
      };

      // Save to storage
      await saveJobDescription(newJobDescription);

      // Update app state
      setState(prev => ({
        ...prev,
        jobDescriptions: [...prev.jobDescriptions, newJobDescription]
      }));

      // Reset form
      setFormData({ title: '', company: '', rawText: '' });
      setShowAddForm(false);

      if (!parseResult.success && parseResult.error) {
        alert(`Job description saved, but AI parsing failed: ${parseResult.error}`);
      }

    } catch (error) {
      console.error('Error adding job description:', error);
      alert('Failed to save job description. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteJobDescription = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job description?')) {
      return;
    }

    try {
      await deleteJobDescription(id);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.filter(jd => jd.id !== id)
      }));
    } catch (error) {
      console.error('Error deleting job description:', error);
      alert('Failed to delete job description. Please try again.');
    }
  };

  const handleLinkResume = async (jobId: string, resumeId: string) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    const updatedJobDescription: JobDescription = {
      ...jobDescription,
      linkedResumeIds: jobDescription.linkedResumeIds.includes(resumeId)
        ? jobDescription.linkedResumeIds.filter(id => id !== resumeId)
        : [...jobDescription.linkedResumeIds, resumeId]
    };

    try {
      await saveJobDescription(updatedJobDescription);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(jd =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
    } catch (error) {
      console.error('Error linking resume:', error);
      alert('Failed to link resume. Please try again.');
    }
  };

  const handleLinkCoverLetter = async (jobId: string, coverLetterId: string) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    const updatedJobDescription: JobDescription = {
      ...jobDescription,
      linkedCoverLetterIds: jobDescription.linkedCoverLetterIds.includes(coverLetterId)
        ? jobDescription.linkedCoverLetterIds.filter(id => id !== coverLetterId)
        : [...jobDescription.linkedCoverLetterIds, coverLetterId]
    };

    try {
      await saveJobDescription(updatedJobDescription);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(jd =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
    } catch (error) {
      console.error('Error linking cover letter:', error);
      alert('Failed to link cover letter. Please try again.');
    }
  };

  const handleStatusChange = async (jobId: string, status: JobDescription['applicationStatus']) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    const updatedJobDescription: JobDescription = {
      ...jobDescription,
      applicationStatus: status,
      applicationDate: status === 'applied' ? new Date().toISOString() : jobDescription.applicationDate
    };

    try {
      await saveJobDescription(updatedJobDescription);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(jd =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  // Calculate potential document matches using sophisticated matching
  const getDocumentMatches = (jobDescription: JobDescription): DocumentMatch[] => {
    return calculateDocumentMatches(jobDescription, state.resumes, state.coverLetters);
  };

  const selectedJob = selectedJobId ? state.jobDescriptions.find(jd => jd.id === selectedJobId) : null;
  const documentMatches = selectedJob ? getDocumentMatches(selectedJob) : [];

  return (
    <div className="job-descriptions-page">
      <div className="page-header">
        <h1>Job Descriptions</h1>
        <button
          className="add-job-button"
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm}
        >
          + Add Job Description
        </button>
      </div>

      {showAddForm && (
        <div className="add-job-form">
          <h2>Add New Job Description</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="job-title">Job Title *</label>
              <input
                id="job-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Senior Software Engineer"
                disabled={isProcessing}
              />
            </div>
            <div className="form-group">
              <label htmlFor="company-name">Company *</label>
              <input
                id="company-name"
                type="text"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                placeholder="e.g., TechCorp Inc."
                disabled={isProcessing}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="job-description">Job Description Text *</label>
            <textarea
              id="job-description"
              value={formData.rawText}
              onChange={(e) => setFormData(prev => ({ ...prev, rawText: e.target.value }))}
              placeholder="Paste the full job description here..."
              rows={10}
              disabled={isProcessing}
            />
          </div>
          <div className="form-actions">
            <button
              onClick={() => setShowAddForm(false)}
              disabled={isProcessing}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={handleAddJobDescription}
              disabled={isProcessing}
              className="save-button"
            >
              {isProcessing ? 'Processing...' : 'Save & Parse with AI'}
            </button>
          </div>
        </div>
      )}

      <div className="job-descriptions-content">
        {state.jobDescriptions.length === 0 ? (
          <div className="empty-state">
            <p>No job descriptions yet. Add one to get started!</p>
          </div>
        ) : (
          <div className="jobs-layout">
            <div className="jobs-list">
              <h2>Your Job Descriptions ({state.jobDescriptions.length})</h2>
              {state.jobDescriptions.map(job => (
                <div
                  key={job.id}
                  className={`job-card ${selectedJobId === job.id ? 'selected' : ''}`}
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <div className="job-header">
                    <h3>{job.title}</h3>
                    <span className={`status-badge status-${job.applicationStatus}`}>
                      {job.applicationStatus?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="job-company">{job.company}</p>
                  <p className="job-date">Added {new Date(job.uploadDate).toLocaleDateString()}</p>
                  <div className="job-stats">
                    <span>{job.keywords.length} keywords</span>
                    <span>{job.linkedResumeIds.length} resumes</span>
                    <span>{job.linkedCoverLetterIds.length} cover letters</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedJob && (
              <div className="job-details">
                <div className="job-details-header">
                  <h2>{selectedJob.title}</h2>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteJobDescription(selectedJob.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="status-selector">
                  <label>Application Status:</label>
                  <select
                    value={selectedJob.applicationStatus || 'not_applied'}
                    onChange={(e) => handleStatusChange(selectedJob.id, e.target.value as JobDescription['applicationStatus'])}
                  >
                    <option value="not_applied">Not Applied</option>
                    <option value="applied">Applied</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="rejected">Rejected</option>
                    <option value="offered">Offered</option>
                  </select>
                </div>

                <div className="job-info-section">
                  <h3>Extracted Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>Role:</strong> {selectedJob.extractedInfo.role || 'Not extracted'}
                    </div>
                    <div className="info-item">
                      <strong>Department:</strong> {selectedJob.extractedInfo.department || 'Not specified'}
                    </div>
                    <div className="info-item">
                      <strong>Location:</strong> {selectedJob.extractedInfo.location || 'Not specified'}
                    </div>
                    <div className="info-item">
                      <strong>Experience Level:</strong> {selectedJob.extractedInfo.experienceLevel || 'Not specified'}
                    </div>
                  </div>

                  {selectedJob.extractedInfo.requiredSkills.length > 0 && (
                    <div className="skills-section">
                      <strong>Required Skills:</strong>
                      <div className="skills-list">
                        {selectedJob.extractedInfo.requiredSkills.map((skill, idx) => (
                          <span key={idx} className="skill-tag required">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedJob.extractedInfo.preferredSkills.length > 0 && (
                    <div className="skills-section">
                      <strong>Preferred Skills:</strong>
                      <div className="skills-list">
                        {selectedJob.extractedInfo.preferredSkills.map((skill, idx) => (
                          <span key={idx} className="skill-tag preferred">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="resume-matching-section">
                  <h3>Document Matching</h3>
                  {documentMatches.length > 0 ? (
                    <div className="resume-matches">
                      {documentMatches.map((match: DocumentMatch) => (
                        <div key={match.documentId} className="resume-match">
                          <div className="match-header">
                            <span className="resume-name">
                              {match.documentName}
                              <span className="document-type-badge">
                                {match.documentType === 'resume' ? '📄' : '📝'}
                              </span>
                            </span>
                            <span className="match-score">
                              {Math.round(match.matchScore * 100)}% match
                            </span>
                            <button
                              className={`link-button ${(match.documentType === 'resume' && selectedJob.linkedResumeIds.includes(match.documentId)) ||
                                  (match.documentType === 'cover_letter' && selectedJob.linkedCoverLetterIds.includes(match.documentId))
                                  ? 'linked' : ''
                                }`}
                              onClick={() => {
                                if (match.documentType === 'resume') {
                                  handleLinkResume(selectedJob.id, match.documentId);
                                } else {
                                  handleLinkCoverLetter(selectedJob.id, match.documentId);
                                }
                              }}
                            >
                              {((match.documentType === 'resume' && selectedJob.linkedResumeIds.includes(match.documentId)) ||
                                (match.documentType === 'cover_letter' && selectedJob.linkedCoverLetterIds.includes(match.documentId)))
                                ? 'Unlink' : 'Link'}
                            </button>
                          </div>
                          <div className="matched-keywords">
                            <strong>Matched keywords:</strong> {match.matchedKeywords.join(', ')}
                          </div>
                          {match.skillMatches.length > 0 && (
                            <div className="skill-matches">
                              <strong>Skill matches:</strong> {match.skillMatches.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-matches">No matching documents found based on keywords and skills.</p>
                  )}
                </div>

                <div className="keywords-section">
                  <h3>Keywords ({selectedJob.keywords.length})</h3>
                  <div className="keywords-list">
                    {selectedJob.keywords.map((keyword, idx) => (
                      <span key={idx} className="keyword-tag">{keyword}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDescriptionsPage;