import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCheckCircle,
  faEdit,
  faExclamationTriangle,
  faInfoCircle,
  faClock,
  faDollarSign,
  faMapMarkerAlt,
  faBuilding,
  faUsers,
  faPlus
} from '@fortawesome/free-solid-svg-icons';
import { ParsedJobData, ScraperInput, AIUsageMetrics } from '../types/scraperTypes';
import { JobDescription } from '../types';
import { saveJobDescription } from '../storage';
import './JobPreviewModal.css';

interface JobPreviewModalProps {
  parsedData: ParsedJobData;
  extractedText?: string;
  confidence: number;
  processingTime: number;
  aiUsage: AIUsageMetrics;
  onJobCreated: (job: JobDescription) => void;
  onBack: () => void;
  scraperInput: ScraperInput;
}

export function JobPreviewModal({
  parsedData,
  extractedText,
  confidence,
  processingTime,
  aiUsage,
  onJobCreated,
  onBack,
  scraperInput
}: JobPreviewModalProps) {
  const [editedData, setEditedData] = useState<ParsedJobData>(parsedData);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  const handleFieldUpdate = (path: string, value: any) => {
    setEditedData(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const handleArrayUpdate = (path: string, index: number, value: string) => {
    setEditedData(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      const array = [...(current[keys[keys.length - 1]] || [])];
      array[index] = value;
      current[keys[keys.length - 1]] = array;

      return updated;
    });
  };

  const handleArrayAdd = (path: string) => {
    setEditedData(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      const array = [...(current[keys[keys.length - 1]] || [])];
      array.push('');
      current[keys[keys.length - 1]] = array;

      return updated;
    });
  };

  const handleArrayRemove = (path: string, index: number) => {
    setEditedData(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      const array = [...(current[keys[keys.length - 1]] || [])];
      array.splice(index, 1);
      current[keys[keys.length - 1]] = array;

      return updated;
    });
  };

  const handleCreateJob = async () => {
    setIsSaving(true);

    try {
      const jobDescription: JobDescription = {
        id: crypto.randomUUID(),
        title: editedData.role || 'Unknown Role',
        company: editedData.company || 'Unknown Company',
        location: editedData.location || '',
        workArrangement: editedData.workType || '',
        salaryMin: editedData.salary?.min || undefined,
        salaryMax: editedData.salary?.max || undefined,
        uploadDate: new Date().toISOString(),
        applicationStatus: 'not_applied',
        interviewStage: undefined,
        offerStage: undefined,
        linkedResumeIds: [],
        keywords: [...(editedData.skills.required || []), ...(editedData.skills.preferred || [])],
        linkedCoverLetterIds: [],

        // Enhanced extracted info
        extractedInfo: {
          role: editedData.role,
          company: editedData.company,
          location: editedData.location,
          workArrangement: editedData.workType,
          salaryRange: editedData.salary?.range,
          jobUrl: editedData.url,
          requiredSkills: editedData.skills.required,
          preferredSkills: editedData.skills.preferred,
          responsibilities: editedData.responsibilities || [],
          requirements: editedData.requirements || [],
          companyDescription: editedData.companyInfo?.description
        },

        // Raw text for reference
        rawText: extractedText || '',

        // Scraper metadata
        scraperData: {
          inputType: scraperInput.type,
          extractedText,
          confidence,
          processingTime,
          originalFileName: scraperInput.fileName,
          captureMetadata: scraperInput.type === 'url' ? {
            url: scraperInput.content
          } : undefined
        },

        // AI usage tracking
        aiUsage: {
          totalTokens: aiUsage.totalTokens,
          promptTokens: aiUsage.promptTokens,
          completionTokens: aiUsage.completionTokens,
          estimatedCost: aiUsage.estimatedCost,
          parseCount: 1,
          lastParseDate: new Date().toISOString(),
          scraperParseCount: 1,
          scraperCost: aiUsage.estimatedCost
        }
      };

      await saveJobDescription(jobDescription);
      onJobCreated(jobDescription);
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to save job description. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#22c55e';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  const renderEditableField = (
    label: string,
    value: string | undefined,
    path: string,
    type: 'text' | 'textarea' = 'text',
    placeholder?: string
  ) => (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {isEditing ? (
        type === 'textarea' ? (
          <textarea
            className="field-textarea"
            value={value || ''}
            onChange={(e) => handleFieldUpdate(path, e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        ) : (
          <input
            type="text"
            className="field-input"
            value={value || ''}
            onChange={(e) => handleFieldUpdate(path, e.target.value)}
            placeholder={placeholder}
          />
        )
      ) : (
        <div className="field-value">
          {value || <span className="empty-value">Not specified</span>}
        </div>
      )}
    </div>
  );

  const renderEditableArray = (
    label: string,
    items: string[] | undefined,
    path: string,
    placeholder?: string
  ) => (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className="array-field">
        {(items || []).map((item, index) => (
          <div key={index} className="array-item">
            {isEditing ? (
              <div className="array-item-edit">
                <input
                  type="text"
                  className="array-input"
                  value={item}
                  onChange={(e) => handleArrayUpdate(path, index, e.target.value)}
                  placeholder={placeholder}
                />
                <button
                  type="button"
                  className="array-remove"
                  onClick={() => handleArrayRemove(path, index)}
                >
                  ×
                </button>
              </div>
            ) : (
              <span className="array-item-view">{item}</span>
            )}
          </div>
        ))}
        {isEditing && (
          <button
            type="button"
            className="array-add"
            onClick={() => handleArrayAdd(path)}
          >
            <FontAwesomeIcon icon={faPlus} />
            Add {label.toLowerCase().slice(0, -1)}
          </button>
        )}
        {(!items || items.length === 0) && !isEditing && (
          <span className="empty-value">None specified</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="job-preview-modal">
      <div className="preview-header">
        <div className="header-title">
          <h2>Review Job Description</h2>
          <p>Review and edit the extracted information before creating the job</p>
        </div>

        <div className="confidence-badge" style={{ color: getConfidenceColor(confidence) }}>
          <FontAwesomeIcon icon={faCheckCircle} />
          <span>{getConfidenceLabel(confidence)} ({(confidence * 100).toFixed(0)}%)</span>
        </div>
      </div>

      <div className="preview-content">
        <div className="preview-sections">
          {/* Basic Information */}
          <div className="preview-section">
            <h3>
              <FontAwesomeIcon icon={faInfoCircle} />
              Basic Information
            </h3>

            <div className="section-grid">
              {renderEditableField('Job Title', editedData.role, 'role', 'text', 'e.g., Senior Frontend Developer')}
              {renderEditableField('Company', editedData.company, 'company', 'text', 'e.g., Acme Corp')}
              {renderEditableField('Location', editedData.location, 'location', 'text', 'e.g., San Francisco, CA')}

              <div className="field-group">
                <label className="field-label">Work Type</label>
                {isEditing ? (
                  <select
                    className="field-select"
                    value={editedData.workType || ''}
                    onChange={(e) => handleFieldUpdate('workType', e.target.value)}
                  >
                    <option value="">Not specified</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="office">Office</option>
                  </select>
                ) : (
                  <div className="field-value">
                    {editedData.workType || <span className="empty-value">Not specified</span>}
                  </div>
                )}
              </div>
            </div>

            {renderEditableField('Job URL', editedData.url, 'url', 'text', 'https://...')}
            {renderEditableField('Summary', editedData.summary, 'summary', 'textarea', 'Brief job description...')}
          </div>

          {/* Compensation */}
          <div className="preview-section">
            <h3>
              <FontAwesomeIcon icon={faDollarSign} />
              Compensation
            </h3>

            <div className="section-grid">
              {renderEditableField('Salary Range', editedData.salary?.range, 'salary.range', 'text', 'e.g., $80,000 - $120,000')}

              <div className="field-row">
                {renderEditableField('Min Salary', editedData.salary?.min?.toString(), 'salary.min', 'text', '80000')}
                {renderEditableField('Max Salary', editedData.salary?.max?.toString(), 'salary.max', 'text', '120000')}
              </div>

              {renderEditableField('Currency', editedData.salary?.currency, 'salary.currency', 'text', 'USD')}
            </div>
          </div>

          {/* Skills & Requirements */}
          <div className="preview-section">
            <h3>
              <FontAwesomeIcon icon={faUsers} />
              Skills & Requirements
            </h3>

            {renderEditableArray('Required Skills', editedData.skills.required, 'skills.required', 'e.g., React')}
            {renderEditableArray('Preferred Skills', editedData.skills.preferred, 'skills.preferred', 'e.g., TypeScript')}
            {renderEditableArray('Requirements', editedData.requirements, 'requirements', 'e.g., Bachelor\'s degree')}
            {renderEditableArray('Responsibilities', editedData.responsibilities, 'responsibilities', 'e.g., Develop user interfaces')}
          </div>

          {/* Company Information */}
          <div className="preview-section">
            <h3>
              <FontAwesomeIcon icon={faBuilding} />
              Company Information
            </h3>

            <div className="section-grid">
              {renderEditableField('Company Description', editedData.companyInfo?.description, 'companyInfo.description', 'textarea', 'Brief company description...')}
              {renderEditableField('Industry', editedData.companyInfo?.industry, 'companyInfo.industry', 'text', 'e.g., Technology')}
              {renderEditableField('Company Size', editedData.companyInfo?.size, 'companyInfo.size', 'text', 'e.g., 100-500 employees')}
            </div>

            {renderEditableArray('Benefits', editedData.benefits, 'benefits', 'e.g., Health insurance')}
          </div>

          {/* Deadlines */}
          {(editedData.deadlines?.application || editedData.deadlines?.startDate) && (
            <div className="preview-section">
              <h3>
                <FontAwesomeIcon icon={faClock} />
                Important Dates
              </h3>

              <div className="section-grid">
                {renderEditableField('Application Deadline', editedData.deadlines?.application, 'deadlines.application', 'text', 'YYYY-MM-DD')}
                {renderEditableField('Start Date', editedData.deadlines?.startDate, 'deadlines.startDate', 'text', 'YYYY-MM-DD')}
              </div>
            </div>
          )}
        </div>

        {/* Processing Info */}
        <div className="processing-info">
          <h4>Processing Information</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Processing Time:</span>
              <span className="info-value">{(processingTime / 1000).toFixed(1)}s</span>
            </div>
            <div className="info-item">
              <span className="info-label">AI Tokens Used:</span>
              <span className="info-value">{aiUsage.totalTokens.toLocaleString()}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Estimated Cost:</span>
              <span className="info-value">${aiUsage.estimatedCost.toFixed(4)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Input Type:</span>
              <span className="info-value">{scraperInput.type.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Raw Text Toggle */}
        {extractedText && (
          <div className="raw-text-section">
            <button
              type="button"
              className="raw-text-toggle"
              onClick={() => setShowRawText(!showRawText)}
            >
              <FontAwesomeIcon icon={showRawText ? faEdit : faInfoCircle} />
              {showRawText ? 'Hide' : 'Show'} Extracted Text
            </button>

            {showRawText && (
              <div className="raw-text-content">
                <pre>{extractedText}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="preview-footer">
        <div className="footer-actions">
          <button
            type="button"
            className="back-button"
            onClick={onBack}
            disabled={isSaving}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back
          </button>

          <div className="edit-actions">
            <button
              type="button"
              className={`edit-toggle ${isEditing ? 'active' : ''}`}
              onClick={() => setIsEditing(!isEditing)}
              disabled={isSaving}
            >
              <FontAwesomeIcon icon={faEdit} />
              {isEditing ? 'Done Editing' : 'Edit Details'}
            </button>

            <button
              type="button"
              className="create-job-button"
              onClick={handleCreateJob}
              disabled={isSaving}
            >
              {isSaving ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}