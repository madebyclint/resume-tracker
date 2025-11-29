import React from 'react';
import { Resume, CoverLetter } from '../types';
import './GeneratedContentModal.css'; // Reuse existing modal styles

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Resume | CoverLetter | null;
  onLink?: () => void;
  isLinked?: boolean;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
  onLink,
  isLinked
}) => {
  if (!isOpen || !document) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isResume = !('targetCompany' in document) && !('targetPosition' in document);
  const documentType = isResume ? 'Resume' : 'Cover Letter';
  const icon = isResume ? '📄' : '📝';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2>{icon} {document.name || document.fileName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Document Metadata */}
          <div className="document-metadata" style={{
            backgroundColor: '#f8fafc',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            fontSize: '14px'
          }}>
            <div>
              <strong>Type:</strong> {documentType}
            </div>
            <div>
              <strong>File Size:</strong> {formatFileSize(document.fileSize)}
            </div>
            <div>
              <strong>Uploaded:</strong> {formatDate(document.uploadDate)}
            </div>
            {document.lastChunkUpdate && (
              <div>
                <strong>Last Processed:</strong> {formatDate(document.lastChunkUpdate)}
              </div>
            )}
            {document.chunkCount !== undefined && (
              <div>
                <strong>Chunks:</strong> {document.chunkCount}
              </div>
            )}
            {!isResume && (document as CoverLetter).targetCompany && (
              <div>
                <strong>Target Company:</strong> {(document as CoverLetter).targetCompany}
              </div>
            )}
            {!isResume && (document as CoverLetter).targetPosition && (
              <div>
                <strong>Target Position:</strong> {(document as CoverLetter).targetPosition}
              </div>
            )}
          </div>

          {/* Document Content */}
          <div className="document-content-section">
            <h4>Document Content:</h4>
            <div className="document-content-preview" style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              maxHeight: '400px',
              overflowY: 'auto',
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {document.textContent ? (
                document.textContent
              ) : (
                <div style={{
                  color: '#64748b',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  padding: '40px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                  <p>No text content available for preview.</p>
                  <p style={{ fontSize: '12px' }}>
                    This document may need to be reprocessed to extract text content.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Link Status */}
          {onLink && (
            <div className="link-status" style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: isLinked ? '#d1fae5' : '#fef3c7',
              border: `1px solid ${isLinked ? '#10b981' : '#f59e0b'}`,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{isLinked ? '✅' : '🔗'}</span>
                <span style={{ fontWeight: '500' }}>
                  {isLinked ? 'This document is linked to the job' : 'Link this document to the job?'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {onLink && (
            <button
              className={`btn ${isLinked ? 'btn-warning' : 'btn-primary'}`}
              onClick={() => {
                onLink();
                onClose();
              }}
            >
              {isLinked ? 'Unlink from Job' : 'Link to Job'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;