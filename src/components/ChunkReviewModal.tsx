import { useState, useEffect } from 'react';
import { Chunk, ChunkType } from '../types';
import { getChunkTypeLabel, isValidChunkType } from '../utils/aiService';

interface ChunkReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  chunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[];
  onSave: (approvedChunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[]) => void;
  documentName: string;
}

interface EditableChunk extends Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'> {
  tempId: string;
  approved: boolean;
  isEditing: boolean;
}

export default function ChunkReviewModal({
  isOpen,
  onClose,
  chunks,
  onSave,
  documentName
}: ChunkReviewModalProps) {
  const [editableChunks, setEditableChunks] = useState<EditableChunk[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize editable chunks when modal opens or chunks change
  useEffect(() => {
    if (isOpen && chunks.length > 0) {
      const initialized = chunks.map((chunk, index) => ({
        ...chunk,
        tempId: `temp-${index}`,
        approved: true, // Default to approved
        isEditing: false
      }));
      setEditableChunks(initialized);
      setHasChanges(false);
    }
  }, [isOpen, chunks]);

  if (!isOpen) return null;

  const handleChunkToggle = (tempId: string) => {
    setEditableChunks(prev =>
      prev.map(chunk =>
        chunk.tempId === tempId
          ? { ...chunk, approved: !chunk.approved }
          : chunk
      )
    );
    setHasChanges(true);
  };

  const handleEditToggle = (tempId: string) => {
    setEditableChunks(prev =>
      prev.map(chunk =>
        chunk.tempId === tempId
          ? { ...chunk, isEditing: !chunk.isEditing }
          : chunk
      )
    );
  };

  const handleFieldChange = (tempId: string, field: keyof EditableChunk, value: any) => {
    setEditableChunks(prev =>
      prev.map(chunk =>
        chunk.tempId === tempId
          ? { ...chunk, [field]: value }
          : chunk
      )
    );
    setHasChanges(true);
  };

  const handleTagsChange = (tempId: string, tagsString: string) => {
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    handleFieldChange(tempId, 'tags', tags);
  };

  const handleTypeChange = (tempId: string, type: string) => {
    if (isValidChunkType(type)) {
      handleFieldChange(tempId, 'type', type);
    }
  };

  const handleSave = () => {
    const approvedChunks = editableChunks
      .filter(chunk => chunk.approved)
      .map(({ tempId, approved, isEditing, ...chunk }) => chunk);

    if (approvedChunks.length === 0) {
      alert('Please approve at least one chunk before saving.');
      return;
    }

    onSave(approvedChunks);
    onClose();
  };

  const handleClose = () => {
    if (hasChanges) {
      const shouldClose = confirm('You have unsaved changes. Are you sure you want to close without saving?');
      if (!shouldClose) return;
    }
    onClose();
  };

  const approvedCount = editableChunks.filter(chunk => chunk.approved).length;
  const totalCount = editableChunks.length;

  const resumeTypes = [
    'cv_header',
    'cv_summary',
    'cv_skills',
    'cv_experience_section',
    'cv_experience_bullet',
    'cv_mission_fit',
    'cl_intro',
    'cl_body',
    'cl_closing'
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
                Review AI-Generated Chunks
              </h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                Document: <strong>{documentName}</strong>
              </p>
              <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                {approvedCount} of {totalCount} chunks selected for saving
              </p>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '0.25rem'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '1rem'
        }}>
          {editableChunks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No chunks to review.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {editableChunks.map((chunk) => (
                <div
                  key={chunk.tempId}
                  style={{
                    border: chunk.approved ? '2px solid #10b981' : '2px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: chunk.approved ? '#f0fdf4' : '#f9fafb',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Chunk Header */}
                  <div style={{
                    padding: '1rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={chunk.approved}
                        onChange={() => handleChunkToggle(chunk.tempId)}
                        style={{ transform: 'scale(1.2)' }}
                      />
                      <div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          color: '#374151',
                          backgroundColor: '#e5e7eb',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px'
                        }}>
                          {getChunkTypeLabel(chunk.type)}
                        </span>
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          Order: {chunk.order}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleEditToggle(chunk.tempId)}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: chunk.isEditing ? '#ef4444' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {chunk.isEditing ? 'Done' : 'Edit'}
                    </button>
                  </div>

                  {/* Chunk Content */}
                  <div style={{ padding: '1rem' }}>
                    {chunk.isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* Type selector */}
                        <div>
                          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                            Type:
                          </label>
                          <select
                            value={chunk.type}
                            onChange={(e) => handleTypeChange(chunk.tempId, e.target.value)}
                            style={{
                              marginLeft: '0.5rem',
                              padding: '0.25rem 0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px'
                            }}
                          >
                            {resumeTypes.map(type => (
                              <option key={type} value={type}>
                                {getChunkTypeLabel(type)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Text editor */}
                        <div>
                          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                            Text:
                          </label>
                          <textarea
                            value={chunk.text}
                            onChange={(e) => handleFieldChange(chunk.tempId, 'text', e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '0.875rem',
                              marginTop: '0.25rem',
                              resize: 'vertical'
                            }}
                          />
                        </div>

                        {/* Tags editor */}
                        <div>
                          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                            Tags (comma-separated):
                          </label>
                          <input
                            type="text"
                            value={chunk.tags.join(', ')}
                            onChange={(e) => handleTagsChange(chunk.tempId, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '0.875rem',
                              marginTop: '0.25rem'
                            }}
                          />
                        </div>

                        {/* Order editor */}
                        <div>
                          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                            Order:
                          </label>
                          <input
                            type="number"
                            value={chunk.order}
                            onChange={(e) => handleFieldChange(chunk.tempId, 'order', parseInt(e.target.value) || 1)}
                            style={{
                              marginLeft: '0.5rem',
                              padding: '0.25rem 0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              width: '80px'
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Read-only view */}
                        <div style={{
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                          color: '#374151',
                          marginBottom: '0.75rem',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {chunk.text}
                        </div>

                        {chunk.tags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {chunk.tags.map((tag, index) => (
                              <span
                                key={index}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.125rem 0.375rem',
                                  backgroundColor: '#dbeafe',
                                  color: '#1e40af',
                                  borderRadius: '12px'
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {approvedCount === 0
              ? 'Select at least one chunk to save'
              : `${approvedCount} chunk${approvedCount !== 1 ? 's' : ''} will be saved`
            }
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleClose}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#374151',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={approvedCount === 0}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: approvedCount > 0 ? '#10b981' : '#9ca3af',
                color: 'white',
                cursor: approvedCount > 0 ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}
            >
              Save Selected Chunks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}