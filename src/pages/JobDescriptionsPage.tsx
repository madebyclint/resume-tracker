import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext';
import { JobDescription } from '../types';
import { parseJobDescription, generateTailoredResume, generateTailoredCoverLetter, isAIConfigured } from '../utils/aiService';
import { saveJobDescription, deleteJobDescription, saveGeneratedResume, saveGeneratedCoverLetter } from '../storage';
import { calculateDocumentMatches, DocumentMatch } from '../utils/documentMatcher';
import { findRelevantResumeChunks, findRelevantCoverLetterChunks } from '../utils/chunkMatcher';
import GeneratedContentModal from '../components/GeneratedContentModal';
import './JobDescriptionsPage.css';

// Remove the local interface since we're using the one from documentMatcher

const JobDescriptionsPage: React.FC = () => {
  const { state, setState } = useAppState();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    url: '',
    rawText: '',
    additionalContext: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  // Generation modal states
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedDefaultName, setGeneratedDefaultName] = useState('');
  const [generationType, setGenerationType] = useState<'resume' | 'cover_letter'>('resume');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);

  const handleEditJobDescription = (jobId: string) => {
    const job = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!job) return;

    setFormData({
      title: job.title,
      company: job.company,
      url: job.url || '',
      rawText: job.rawText,
      additionalContext: job.additionalContext || ''
    });
    setEditingJobId(jobId);
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingJobId(null);
    setFormData({ title: '', company: '', url: '', rawText: '', additionalContext: '' });
    setShowAddForm(false);
  };

  const handleSaveJobDescription = async () => {
    if (!formData.title.trim() || !formData.company.trim() || !formData.rawText.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);

    try {
      // Parse job description with AI (only if text has changed or it's a new job)
      const isEditing = editingJobId !== null;
      const existingJob = isEditing ? state.jobDescriptions.find(jd => jd.id === editingJobId) : null;

      let parseResult = null;
      if (!isEditing || (existingJob && existingJob.rawText !== formData.rawText.trim())) {
        parseResult = await parseJobDescription(formData.rawText);
      }

      // Use AI-extracted info to fill in missing fields if available
      const finalTitle = formData.title.trim();
      const finalCompany = formData.company.trim();

      if (isEditing && existingJob) {
        // Update existing job description
        const updatedJobDescription: JobDescription = {
          ...existingJob,
          title: finalTitle,
          company: finalCompany,
          url: formData.url.trim() || undefined,
          rawText: formData.rawText.trim(),
          additionalContext: formData.additionalContext.trim() || undefined,
          // Only update AI-extracted info if we re-parsed
          ...(parseResult && {
            extractedInfo: parseResult.extractedInfo,
            keywords: parseResult.keywords
          })
        };

        await saveJobDescription(updatedJobDescription);

        setState(prev => ({
          ...prev,
          jobDescriptions: prev.jobDescriptions.map(jd =>
            jd.id === editingJobId ? updatedJobDescription : jd
          )
        }));

        setEditingJobId(null);
      } else {
        // Create new job description
        const newJobDescription: JobDescription = {
          id: crypto.randomUUID(),
          title: finalTitle,
          company: finalCompany,
          url: formData.url.trim() || undefined,
          rawText: formData.rawText.trim(),
          additionalContext: formData.additionalContext.trim() || undefined,
          extractedInfo: parseResult?.extractedInfo || {
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            requirements: []
          },
          keywords: parseResult?.keywords || [],
          uploadDate: new Date().toISOString(),
          linkedResumeIds: [],
          linkedCoverLetterIds: [],
          applicationStatus: 'not_applied'
        };

        await saveJobDescription(newJobDescription);

        setState(prev => ({
          ...prev,
          jobDescriptions: [...prev.jobDescriptions, newJobDescription]
        }));
      }

      // Reset form
      setFormData({ title: '', company: '', url: '', rawText: '', additionalContext: '' });
      setShowAddForm(false);

      if (parseResult && !parseResult.success && parseResult.error) {
        alert(`Job description saved, but AI parsing failed: ${parseResult.error}`);
      }

    } catch (error) {
      console.error('Error saving job description:', error);
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

  // Generate tailored resume
  const handleGenerateResume = async (jobDescription: JobDescription) => {
    if (!isAIConfigured()) {
      alert('AI service is not configured. Please set up your OpenAI API key in the .env file.');
      return;
    }

    setIsGeneratingResume(true);
    setGenerationType('resume');
    setGeneratedTitle('Generated Resume');
    setGeneratedDefaultName(`Resume - ${jobDescription.company} - ${jobDescription.title}`);
    setGeneratedContent('');
    setGenerationError(null);
    setIsGenerating(true);
    setShowGeneratedModal(true);

    try {
      // Find relevant chunks
      const relevantChunks = await findRelevantResumeChunks(jobDescription, 0.1, 15);

      if (relevantChunks.length === 0) {
        throw new Error('No relevant resume chunks found. Please ensure you have uploaded and processed some resumes.');
      }

      // Generate resume using AI
      const result = await generateTailoredResume(
        jobDescription,
        relevantChunks,
        jobDescription.additionalContext
      );

      if (!result.success || !result.content) {
        throw new Error(result.error || 'Failed to generate resume');
      }

      setGeneratedContent(result.content);
    } catch (error) {
      console.error('Error generating resume:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
      setIsGeneratingResume(false);
    }
  };

  // Generate tailored cover letter
  const handleGenerateCoverLetter = async (jobDescription: JobDescription) => {
    if (!isAIConfigured()) {
      alert('AI service is not configured. Please set up your OpenAI API key in the .env file.');
      return;
    }

    setIsGeneratingCoverLetter(true);
    setGenerationType('cover_letter');
    setGeneratedTitle('Generated Cover Letter');
    setGeneratedDefaultName(`Cover Letter - ${jobDescription.company} - ${jobDescription.title}`);
    setGeneratedContent('');
    setGenerationError(null);
    setIsGenerating(true);
    setShowGeneratedModal(true);

    try {
      // Find relevant chunks
      const relevantChunks = await findRelevantCoverLetterChunks(jobDescription, 0.1, 15);

      if (relevantChunks.length === 0) {
        throw new Error('No relevant chunks found. Please ensure you have uploaded and processed some documents.');
      }

      // Generate cover letter using AI
      const result = await generateTailoredCoverLetter(
        jobDescription,
        relevantChunks,
        jobDescription.additionalContext
      );

      if (!result.success || !result.content) {
        throw new Error(result.error || 'Failed to generate cover letter');
      }

      setGeneratedContent(result.content);
    } catch (error) {
      console.error('Error generating cover letter:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
      setIsGeneratingCoverLetter(false);
    }
  };

  // Save generated content
  const handleSaveGenerated = async (name: string, content: string) => {
    if (!selectedJob) return;

    try {
      if (generationType === 'resume') {
        const newResume = await saveGeneratedResume(name, content, selectedJob);
        setState(prev => ({
          ...prev,
          resumes: [...prev.resumes, newResume],
          jobDescriptions: prev.jobDescriptions.map(jd =>
            jd.id === selectedJob.id
              ? { ...jd, linkedResumeIds: [...jd.linkedResumeIds, newResume.id] }
              : jd
          )
        }));
      } else {
        const newCoverLetter = await saveGeneratedCoverLetter(name, content, selectedJob);
        setState(prev => ({
          ...prev,
          coverLetters: [...prev.coverLetters, newCoverLetter],
          jobDescriptions: prev.jobDescriptions.map(jd =>
            jd.id === selectedJob.id
              ? { ...jd, linkedCoverLetterIds: [...jd.linkedCoverLetterIds, newCoverLetter.id] }
              : jd
          )
        }));
      }

      alert(`${generationType === 'resume' ? 'Resume' : 'Cover letter'} saved successfully!`);
    } catch (error) {
      console.error('Error saving generated content:', error);
      throw error;
    }
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
          <h2>{editingJobId ? 'Edit Job Description' : 'Add New Job Description'}</h2>
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
            <label htmlFor="job-url">Job Listing URL (Optional)</label>
            <input
              id="job-url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://company.com/careers/job-id"
              disabled={isProcessing}
            />
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
          <div className="form-group">
            <label htmlFor="additional-context">Additional Context (Optional)</label>
            <textarea
              id="additional-context"
              value={formData.additionalContext}
              onChange={(e) => setFormData(prev => ({ ...prev, additionalContext: e.target.value }))}
              placeholder="Add any additional context that will help generate resumes and cover letters (e.g., bio info, recommendations, ChatGPT summaries, company insights, etc.)"
              rows={6}
              disabled={isProcessing}
            />
            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
              This context will be used when generating tailored resumes and cover letters for this position.
            </small>
          </div>
          <div className="form-actions">
            <button
              onClick={handleCancelEdit}
              disabled={isProcessing}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveJobDescription}
              disabled={isProcessing}
              className="save-button"
            >
              {isProcessing ? 'Processing...' : editingJobId ? 'Update Job Description' : 'Save & Parse with AI'}
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
                  <div className="job-actions">
                    <button
                      className="edit-button"
                      onClick={() => handleEditJobDescription(selectedJob.id)}
                      disabled={showAddForm}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteJobDescription(selectedJob.id)}
                    >
                      Delete
                    </button>
                  </div>
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

                  {selectedJob.url && (
                    <div className="job-url-section">
                      <strong>Job Listing:</strong>
                      <a
                        href={selectedJob.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="job-url-link"
                      >
                        View Original Posting ↗
                      </a>
                    </div>
                  )}

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

                {selectedJob.additionalContext && (
                  <div className="additional-context-section">
                    <h3>Additional Context</h3>
                    <div className="context-content">
                      <p>{selectedJob.additionalContext}</p>
                    </div>
                  </div>
                )}

                <div className="generation-section">
                  <h3>AI Document Generation</h3>
                  <div className="generation-buttons">
                    <button
                      className="generate-button generate-resume"
                      onClick={() => handleGenerateResume(selectedJob)}
                      disabled={isGeneratingResume || isGeneratingCoverLetter}
                    >
                      {isGeneratingResume ? (
                        <>
                          <div className="button-spinner"></div>
                          Generating Resume...
                        </>
                      ) : (
                        <>🤖 Generate Resume</>
                      )}
                    </button>
                    <button
                      className="generate-button generate-cover-letter"
                      onClick={() => handleGenerateCoverLetter(selectedJob)}
                      disabled={isGeneratingResume || isGeneratingCoverLetter}
                    >
                      {isGeneratingCoverLetter ? (
                        <>
                          <div className="button-spinner"></div>
                          Generating Cover Letter...
                        </>
                      ) : (
                        <>🤖 Generate Cover Letter</>
                      )}
                    </button>
                  </div>
                  <p className="generation-description">
                    Generate tailored documents using AI based on this job description and your existing content chunks.
                    <br />
                    <strong>💾 Generated documents will be saved to your Resume/Cover Letter library and automatically linked to this job.</strong>
                  </p>
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

      <GeneratedContentModal
        isOpen={showGeneratedModal}
        onClose={() => setShowGeneratedModal(false)}
        onSave={handleSaveGenerated}
        title={generatedTitle}
        content={generatedContent}
        isLoading={isGenerating}
        error={generationError || undefined}
        defaultName={generatedDefaultName}
      />
    </div>
  );
};

export default JobDescriptionsPage;