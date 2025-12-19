import React from 'react';
import { JobDescriptionFormData } from '../hooks/useJobFormData';

interface AddJobFormProps {
  editingJobId: string | null;
  formData: JobDescriptionFormData;
  setFormData: (data: any) => void;
  isProcessing: boolean;
  onSave: () => void;
  onCancel: () => void;
  getNextSequentialId: () => number;
  onFetchURL: () => void;
  isFetchingURL: boolean;
  fetchError: string | null;
  onReparse: () => void;
  isReparsing: boolean;
  lastParseUsage: any;
}

const AddJobForm: React.FC<AddJobFormProps> = ({
  editingJobId,
  formData,
  setFormData,
  isProcessing,
  onSave,
  onCancel,
  getNextSequentialId,
  onFetchURL,
  isFetchingURL,
  fetchError,
  onReparse,
  isReparsing,
  lastParseUsage
}) => {
  return (
    <div
      className="add-job-form"
      ref={(el) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      <div className="form-header">
        <h2>{editingJobId ? 'Edit Job Description' : 'Add New Job Description'}</h2>
        <div className="form-header-actions">
          <button
            onClick={onSave}
            disabled={isProcessing}
            className="save-button-top"
          >
            {isProcessing ? 'Saving...' : editingJobId ? 'Update Job' : 'Save Job'}
          </button>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="cancel-button-top"
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="form-grid">
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
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
        <div className="form-group" style={{ width: '120px' }}>
          <label htmlFor="sequential-id">Job # (Optional)</label>
          <input
            id="sequential-id"
            type="number"
            min="1"
            value={formData.sequentialId}
            onChange={(e) => setFormData(prev => ({ ...prev, sequentialId: e.target.value }))}
            placeholder={editingJobId ? "Current" : getNextSequentialId().toString()}
            disabled={isProcessing}
          />
        </div>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <div className="url-input-container">
            <label htmlFor="job-url">Job URL (Optional)</label>
            <div className="url-input-group">
              <input
                id="job-url"
                type="url"
                value={formData.url || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://linkedin.com/jobs/view/..."
                disabled={isProcessing || isFetchingURL}
              />
              <button
                onClick={onFetchURL}
                disabled={!formData.url || isProcessing || isFetchingURL}
                className="fetch-button"
                type="button"
              >
                {isFetchingURL ? 'Fetching...' : 'Auto-Fill'}
              </button>
            </div>
            {fetchError && (
              <div className="error-message">
                {fetchError}
              </div>
            )}
          </div>
        </div>

        <div className="form-group full-width" style={{ gridColumn: 'span 2' }}>
          <div className="textarea-header">
            <label htmlFor="raw-text">Job Description Text *</label>
            <div className="textarea-controls">
              {formData.rawText && (
                <button
                  onClick={onReparse}
                  disabled={isProcessing || isReparsing}
                  className="reparse-button"
                  type="button"
                  title="Re-analyze job description with AI"
                >
                  {isReparsing ? 'Re-parsing...' : '🔄 Re-parse with AI'}
                </button>
              )}
              {lastParseUsage && (
                <div className="usage-info" title={`Prompt: ${lastParseUsage.promptTokens}, Completion: ${lastParseUsage.completionTokens}, Total: ${lastParseUsage.totalTokens} tokens`}>
                  💰 ${((lastParseUsage.promptTokens * 0.00015 + lastParseUsage.completionTokens * 0.0006) / 100).toFixed(4)}¢
                </div>
              )}
            </div>
          </div>
          <textarea
            id="raw-text"
            value={formData.rawText}
            onChange={(e) => setFormData(prev => ({ ...prev, rawText: e.target.value }))}
            placeholder="Paste the job description here..."
            disabled={isProcessing}
            rows={12}
          />
        </div>

        {/* Additional form fields can be added here */}
        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            value={formData.location}
            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
            placeholder="e.g., San Francisco, CA"
            disabled={isProcessing}
          />
        </div>

        <div className="form-group">
          <label htmlFor="work-arrangement">Work Arrangement</label>
          <select
            id="work-arrangement"
            value={formData.workArrangement}
            onChange={(e) => setFormData(prev => ({ ...prev, workArrangement: e.target.value }))}
            disabled={isProcessing}
          >
            <option value="">Select arrangement</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="office">On-site</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="salary-min">Min Salary</label>
          <input
            id="salary-min"
            type="number"
            value={formData.salaryMin}
            onChange={(e) => setFormData(prev => ({ ...prev, salaryMin: e.target.value }))}
            placeholder="e.g., 80000"
            disabled={isProcessing}
          />
        </div>

        <div className="form-group">
          <label htmlFor="salary-max">Max Salary</label>
          <input
            id="salary-max"
            type="number"
            value={formData.salaryMax}
            onChange={(e) => setFormData(prev => ({ ...prev, salaryMax: e.target.value }))}
            placeholder="e.g., 120000"
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="form-footer">
        <button
          onClick={onSave}
          disabled={isProcessing}
          className="save-button"
        >
          {isProcessing ? 'Saving...' : editingJobId ? 'Update Job Description' : 'Save Job Description'}
        </button>
      </div>
    </div>
  );
};

export default AddJobForm;