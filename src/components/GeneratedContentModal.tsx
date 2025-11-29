import React, { useState } from 'react';
import './GeneratedContentModal.css';

interface GeneratedContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, content: string) => Promise<void>;
  title: string;
  content: string;
  isLoading: boolean;
  error?: string;
  defaultName: string;
}

const GeneratedContentModal: React.FC<GeneratedContentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  content,
  isLoading,
  error,
  defaultName
}) => {
  const [fileName, setFileName] = useState(defaultName);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');

  // Update content when prop changes
  React.useEffect(() => {
    setEditedContent(content);
  }, [content]);

  React.useEffect(() => {
    setFileName(defaultName);
  }, [defaultName]);

  const handleSave = async () => {
    if (!fileName.trim() || !editedContent.trim()) {
      alert('Please provide a name and content');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(fileName.trim(), editedContent.trim());
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };



  const isHtmlContent = editedContent.trim().startsWith('<!DOCTYPE html') || editedContent.trim().startsWith('<html');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content generated-content-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            className="close-button"
            onClick={handleClose}
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {isLoading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Generating content using AI...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p className="error-message">{error}</p>
              <button onClick={onClose} className="error-close-button">
                Close
              </button>
            </div>
          )}

          {!isLoading && !error && content && (
            <>
              <div className="form-group">
                <label htmlFor="file-name">Document Name:</label>
                <input
                  id="file-name"
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter a name for this document"
                  disabled={isSaving}
                />
              </div>

              {isHtmlContent && (
                <div className="view-mode-controls">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`mode-button ${viewMode === 'preview' ? 'active' : ''}`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setViewMode('edit')}
                    className={`mode-button ${viewMode === 'edit' ? 'active' : ''}`}
                  >
                    Edit HTML
                  </button>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="content-editor">
                  {isHtmlContent && viewMode === 'preview' ? 'Resume Preview:' : 'Content:'}
                </label>

                {isHtmlContent && viewMode === 'preview' ? (
                  <div className="html-preview">
                    <iframe
                      srcDoc={editedContent}
                      className="resume-iframe"
                      title="Resume Preview"
                    />
                  </div>
                ) : (
                  <textarea
                    id="content-editor"
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={20}
                    className="content-editor"
                    placeholder="Generated content will appear here..."
                    disabled={isSaving}
                  />
                )}
              </div>

              <div className="modal-actions">
                <button
                  onClick={handleClose}
                  className="cancel-button"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="save-button"
                  disabled={isSaving || !fileName.trim() || !editedContent.trim()}
                >
                  {isSaving ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneratedContentModal;