import React, { useState, useRef } from 'react';
import { parseCSV, convertToJobDescriptions, CSVJobApplication } from '../utils/csvParser';
import { JobDescription } from '../types';
import './GeneratedContentModal.css'; // Reuse existing modal styles

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jobDescriptions: JobDescription[]) => void;
  existingJobs?: JobDescription[];
}

const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose, onImport, existingJobs = [] }) => {
  const [dragActive, setDragActive] = useState(false);
  const [csvData, setCsvData] = useState<CSVJobApplication[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setParseError(null);
    setCsvData(null);
    setPreview('');

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please select a CSV file (.csv)');
      setIsProcessing(false);
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File size too large. Please select a file smaller than 5MB.');
      setIsProcessing(false);
      return;
    }

    try {
      const text = await file.text();
      const result = parseCSV(text);

      if (!result.success) {
        setParseError(`Failed to parse CSV: ${result.errors.join(', ')}`);
        setIsProcessing(false);
        return;
      }

      setCsvData(result.data);
      setPreview(result.preview || '');

    } catch (error) {
      setParseError(`Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setIsProcessing(false);
  };

  const handleImport = () => {
    if (!csvData) return;

    try {
      const jobDescriptions = convertToJobDescriptions(csvData, existingJobs);
      onImport(jobDescriptions);
      onClose();
      resetState();
    } catch (error) {
      setParseError(`Failed to convert data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const resetState = () => {
    setCsvData(null);
    setParseError(null);
    setPreview('');
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Import Job Applications from CSV</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          {!csvData && (
            <>
              <div className="csv-format-info" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                <h4>Expected CSV Format:</h4>
                <p>Your CSV should have these columns:</p>
                <code style={{ display: 'block', marginTop: '8px', fontSize: '12px' }}>
                  Date, ID, Source, Company, Impact, Discipline, Status, Contact/Link, Second Contact/Link
                </code>
                <p style={{ fontSize: '14px', marginTop: '8px', color: '#666' }}>
                  The first 8 columns are required. Make sure your CSV has headers that match these names.
                </p>
              </div>

              <div
                className={`file-upload-zone ${dragActive ? 'drag-active' : ''}`}
                style={{
                  border: '2px dashed #ccc',
                  borderRadius: '8px',
                  padding: '40px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: dragActive ? '#f0f8ff' : '#fafafa',
                  borderColor: dragActive ? '#007acc' : '#ccc'
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />

                {isProcessing ? (
                  <div>
                    <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                    <p>Processing CSV file...</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>📄</div>
                    <p><strong>Drop your CSV file here</strong></p>
                    <p>or <span style={{ color: '#007acc', textDecoration: 'underline' }}>click to browse</span></p>
                    <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                      Supports .csv files up to 5MB
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {parseError && (
            <div style={{ color: '#d32f2f', backgroundColor: '#ffebee', padding: '15px', borderRadius: '4px', marginTop: '15px' }}>
              <strong>Error:</strong> {parseError}
            </div>
          )}

          {csvData && (
            <div style={{ marginTop: '20px' }}>
              <h3>Import Preview</h3>
              <div style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '4px', marginBottom: '15px' }}>
                <p><strong>Found {csvData.length} job applications:</strong></p>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', margin: '10px 0' }}>{preview}</pre>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <h4>What will be imported:</h4>
                <ul style={{ fontSize: '14px', color: '#666' }}>
                  <li>Each row will create a new Job Description</li>
                  <li>Company and position information will be populated</li>
                  <li>Application status and dates will be preserved</li>
                  <li>Contact links will be stored as job URLs</li>
                  <li>Additional context will include source and impact information</li>
                </ul>
              </div>

              <div className="import-warning" style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', padding: '10px', borderRadius: '4px', fontSize: '14px' }}>
                <strong>Note:</strong> This will add new job descriptions to your existing data. Make sure you don't have duplicates before importing.
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
          {csvData && (
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={isProcessing}
            >
              Import {csvData.length} Job{csvData.length === 1 ? '' : 's'}
            </button>
          )}
          {!csvData && !parseError && !isProcessing && (
            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVImportModal;