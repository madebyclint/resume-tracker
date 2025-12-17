import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faEdit,
  faSave,
  faPlus,
  faTrash
} from '@fortawesome/free-solid-svg-icons';
import { JobDescription } from '../types';
import './JobEditModal.css';

interface JobEditModalProps {
  job: JobDescription;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedJob: JobDescription) => void;
}

export function JobEditModal({ job, isOpen, onClose, onSave }: JobEditModalProps) {
  const [editedJob, setEditedJob] = useState<JobDescription>({ ...job });
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedJob);
      onClose();
    } catch (error) {
      console.error('Failed to save job:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof JobDescription, value: any) => {
    setEditedJob(prev => ({ ...prev, [field]: value }));
  };

  const updateExtractedField = (field: string, value: any) => {
    setEditedJob(prev => ({
      ...prev,
      extractedInfo: {
        ...prev.extractedInfo,
        [field]: value
      }
    }));
  };

  const updateArrayField = (field: string, items: string[]) => {
    setEditedJob(prev => ({
      ...prev,
      extractedInfo: {
        ...prev.extractedInfo,
        [field]: items
      }
    }));
  };

  const addArrayItem = (field: string) => {
    const currentItems = (editedJob.extractedInfo as any)?.[field] || [];
    updateArrayField(field, [...currentItems, '']);
  };

  const removeArrayItem = (field: string, index: number) => {
    const currentItems = (editedJob.extractedInfo as any)?.[field] || [];
    const newItems = [...currentItems];
    newItems.splice(index, 1);
    updateArrayField(field, newItems);
  };

  const updateArrayItem = (field: string, index: number, value: string) => {
    const currentItems = (editedJob.extractedInfo as any)?.[field] || [];
    const newItems = [...currentItems];
    newItems[index] = value;
    updateArrayField(field, newItems);
  };

  return (
    <div className="modal-overlay">
      <div className="job-edit-modal">
        <div className="modal-header">
          <h2>
            <FontAwesomeIcon icon={faEdit} />
            Edit Job Details
          </h2>
          <button className="close-button" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-content">
          <div className="edit-sections">

            {/* Basic Information */}
            <div className="edit-section">
              <h3>Basic Information</h3>
              <div className="field-grid">
                <div className="field-group">
                  <label>Job Title</label>
                  <input
                    type="text"
                    value={editedJob.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="e.g., Senior Software Engineer"
                  />
                </div>
                <div className="field-group">
                  <label>Company</label>
                  <input
                    type="text"
                    value={editedJob.company}
                    onChange={(e) => updateField('company', e.target.value)}
                    placeholder="e.g., Acme Corp"
                  />
                </div>
                <div className="field-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={editedJob.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    placeholder="e.g., San Francisco, CA"
                  />
                </div>
                <div className="field-group">
                  <label>Work Arrangement</label>
                  <select
                    value={editedJob.workArrangement}
                    onChange={(e) => updateField('workArrangement', e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="office">Office</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Salary Information */}
            <div className="edit-section">
              <h3>Salary & Compensation</h3>
              <div className="field-grid">
                <div className="field-group">
                  <label>Minimum Salary</label>
                  <input
                    type="number"
                    value={editedJob.salaryMin || ''}
                    onChange={(e) => updateField('salaryMin', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="80000"
                  />
                </div>
                <div className="field-group">
                  <label>Maximum Salary</label>
                  <input
                    type="number"
                    value={editedJob.salaryMax || ''}
                    onChange={(e) => updateField('salaryMax', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="120000"
                  />
                </div>
                <div className="field-group">
                  <label>Salary Range (Text)</label>
                  <input
                    type="text"
                    value={editedJob.extractedInfo?.salaryRange || ''}
                    onChange={(e) => updateExtractedField('salaryRange', e.target.value)}
                    placeholder="e.g., $80K - $120K"
                  />
                </div>
                <div className="field-group">
                  <label>Job URL</label>
                  <input
                    type="url"
                    value={editedJob.extractedInfo?.jobUrl || ''}
                    onChange={(e) => updateExtractedField('jobUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="edit-section">
              <h3>Skills</h3>
              <div className="array-section">
                <h4>Required Skills</h4>
                <div className="array-items">
                  {(editedJob.extractedInfo?.requiredSkills || []).map((skill, index) => (
                    <div key={index} className="array-item">
                      <input
                        type="text"
                        value={skill}
                        onChange={(e) => updateArrayItem('requiredSkills', index, e.target.value)}
                        placeholder="e.g., React"
                      />
                      <button
                        type="button"
                        onClick={() => removeArrayItem('requiredSkills', index)}
                        className="remove-button"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addArrayItem('requiredSkills')}
                    className="add-button"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Required Skill
                  </button>
                </div>
              </div>

              <div className="array-section">
                <h4>Preferred Skills</h4>
                <div className="array-items">
                  {(editedJob.extractedInfo?.preferredSkills || []).map((skill, index) => (
                    <div key={index} className="array-item">
                      <input
                        type="text"
                        value={skill}
                        onChange={(e) => updateArrayItem('preferredSkills', index, e.target.value)}
                        placeholder="e.g., TypeScript"
                      />
                      <button
                        type="button"
                        onClick={() => removeArrayItem('preferredSkills', index)}
                        className="remove-button"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addArrayItem('preferredSkills')}
                    className="add-button"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Preferred Skill
                  </button>
                </div>
              </div>
            </div>

            {/* Requirements & Responsibilities */}
            <div className="edit-section">
              <h3>Requirements & Responsibilities</h3>
              <div className="array-section">
                <h4>Requirements</h4>
                <div className="array-items">
                  {(editedJob.extractedInfo?.requirements || []).map((req, index) => (
                    <div key={index} className="array-item">
                      <input
                        type="text"
                        value={req}
                        onChange={(e) => updateArrayItem('requirements', index, e.target.value)}
                        placeholder="e.g., Bachelor's degree in Computer Science"
                      />
                      <button
                        type="button"
                        onClick={() => removeArrayItem('requirements', index)}
                        className="remove-button"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addArrayItem('requirements')}
                    className="add-button"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Requirement
                  </button>
                </div>
              </div>

              <div className="array-section">
                <h4>Responsibilities</h4>
                <div className="array-items">
                  {(editedJob.extractedInfo?.responsibilities || []).map((resp, index) => (
                    <div key={index} className="array-item">
                      <input
                        type="text"
                        value={resp}
                        onChange={(e) => updateArrayItem('responsibilities', index, e.target.value)}
                        placeholder="e.g., Develop user-facing features"
                      />
                      <button
                        type="button"
                        onClick={() => removeArrayItem('responsibilities', index)}
                        className="remove-button"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addArrayItem('responsibilities')}
                    className="add-button"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Responsibility
                  </button>
                </div>
              </div>
            </div>

            {/* Notes - Keep this important! */}
            <div className="edit-section">
              <h3>Personal Notes</h3>
              <div className="field-group">
                <label>Notes</label>
                <textarea
                  value={editedJob.notes || ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Add your personal notes, application status updates, interview feedback, etc."
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="save-button" onClick={handleSave} disabled={isSaving}>
            <FontAwesomeIcon icon={faSave} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}