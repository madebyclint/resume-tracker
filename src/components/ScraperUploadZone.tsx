import React, { useState, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileUpload,
  faFilePdf,
  faImage,
  faFileText,
  faLink,
  faTrash,
  faExclamationTriangle,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { ScraperInput } from '../types/scraperTypes';
import { ScraperValidation } from '../utils/scraperValidation';
import './ScraperUploadZone.css';

interface ScraperUploadZoneProps {
  onInputCreated: (input: ScraperInput) => void;
  initialData?: Partial<ScraperInput>;
}

type InputMode = 'file' | 'text' | 'url';

export function ScraperUploadZone({ onInputCreated, initialData }: ScraperUploadZoneProps) {
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [textContent, setTextContent] = useState('');
  const [urlContent, setUrlContent] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with extension capture data
  React.useEffect(() => {
    if (initialData) {
      if (initialData.type === 'text' && initialData.content) {
        setInputMode('text');
        setTextContent(initialData.content);
      } else if (initialData.type === 'url' && initialData.content) {
        setInputMode('url');
        setUrlContent(initialData.content);
      }
      // For PDF/image files, they're handled automatically when the modal processes them
    }
  }, [initialData]);

  const validateAndCreateInput = useCallback(async (
    type: 'pdf' | 'image' | 'text' | 'url',
    content: string,
    fileName?: string,
    fileSize?: number
  ) => {
    setIsValidating(true);
    setValidationError(null);

    try {
      const input: ScraperInput = {
        id: crypto.randomUUID(),
        type,
        content,
        fileName,
        fileSize,
        uploadDate: new Date().toISOString()
      };

      const validation = ScraperValidation.validateInput(input);

      if (!validation.isValid) {
        setValidationError(validation.errors[0]);
        setIsValidating(false);
        return;
      }

      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('Input warnings:', validation.warnings);
      }

      onInputCreated(input);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  }, [onInputCreated]);

  const handleFileUpload = useCallback(async (file: File) => {
    setValidationError(null);
    setUploadedFile(file);

    try {
      const fileType = getFileType(file);
      const base64Content = await fileToBase64(file);

      await validateAndCreateInput(
        fileType,
        base64Content,
        file.name,
        file.size
      );
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'File processing failed');
      setUploadedFile(null);
    }
  }, [validateAndCreateInput]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  }, [handleFileUpload]);

  const handleTextSubmit = useCallback(async () => {
    if (!textContent.trim()) {
      setValidationError('Please enter some text');
      return;
    }

    await validateAndCreateInput('text', textContent.trim());
  }, [textContent, validateAndCreateInput]);

  const handleUrlSubmit = useCallback(async () => {
    if (!urlContent.trim()) {
      setValidationError('Please enter a URL');
      return;
    }

    await validateAndCreateInput('url', urlContent.trim());
  }, [urlContent, validateAndCreateInput]);

  // Handle paste events for files
  const handlePaste = useCallback((e: ClipboardEvent) => {
    e.preventDefault();

    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    // Look for files in clipboard
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];

      // Check if it's a file
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          // Switch to file mode if not already
          if (inputMode !== 'file') {
            setInputMode('file');
          }
          handleFileUpload(file);
          return;
        }
      }
    }

    // If no files found but we're in text mode, allow normal paste behavior
    if (inputMode === 'text' && e.clipboardData?.getData('text')) {
      const pastedText = e.clipboardData.getData('text');
      setTextContent(prev => prev + pastedText);
    }
  }, [inputMode, handleFileUpload]);

  // Add global paste event listener
  React.useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Only handle paste if the upload zone is focused or no other input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
      );

      if (!isInputFocused || activeElement === textAreaRef.current) {
        handlePaste(e);
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste]);

  const clearFile = useCallback(() => {
    setUploadedFile(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const getFileType = (file: File): 'pdf' | 'image' => {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('image/')) return 'image';

    // Fallback based on extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return 'pdf';
    return 'image';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') return faFilePdf;
    if (file.type.startsWith('image/')) return faImage;
    return faFileText;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderInputModeSelector = () => (
    <div className="input-mode-selector">
      <button
        type="button"
        className={`mode-button ${inputMode === 'file' ? 'active' : ''}`}
        onClick={() => setInputMode('file')}
        title="Upload files by clicking, drag & drop, or paste (Ctrl+V)"
      >
        <FontAwesomeIcon icon={faFileUpload} />
        Upload File
      </button>
      <button
        type="button"
        className={`mode-button ${inputMode === 'text' ? 'active' : ''}`}
        onClick={() => setInputMode('text')}
      >
        <FontAwesomeIcon icon={faFileText} />
        Paste Text
      </button>
      <button
        type="button"
        className={`mode-button ${inputMode === 'url' ? 'active' : ''}`}
        onClick={() => setInputMode('url')}
      >
        <FontAwesomeIcon icon={faLink} />
        From URL
      </button>
    </div>
  );

  const renderFileUpload = () => (
    <div className="file-upload-section">
      <div
        className={`drop-zone ${dragActive ? 'drag-active' : ''} ${uploadedFile ? 'has-file' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploadedFile && fileInputRef.current?.click()}
      >
        {uploadedFile ? (
          <div className="uploaded-file">
            <div className="file-info">
              <FontAwesomeIcon icon={getFileIcon(uploadedFile)} className="file-icon" />
              <div className="file-details">
                <span className="file-name">{uploadedFile.name}</span>
                <span className="file-size">{formatFileSize(uploadedFile.size)}</span>
              </div>
            </div>
            <button
              type="button"
              className="remove-file"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              title="Remove file"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        ) : (
          <div className="drop-zone-content">
            <FontAwesomeIcon icon={faFileUpload} className="upload-icon" />
            <h3>Drop files here, paste (Ctrl+V), or click to upload</h3>
            <p>Supports PDF files and images (PNG, JPEG, GIF, WebP)</p>
            <p className="paste-instruction">📋 <strong>Copy any file and paste it here with Ctrl+V (Cmd+V on Mac)</strong></p>
            <p className="size-limit">Maximum file size: 10MB for PDFs, 5MB for images</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
    </div>
  );

  const renderTextInput = () => (
    <div className="text-input-section">
      <textarea
        ref={textAreaRef}
        className="job-text-input"
        placeholder="Paste the job description text here...

Example:
Senior Frontend Developer
Company ABC - Remote
$80,000 - $120,000

We are looking for an experienced React developer...

Requirements:
• 5+ years JavaScript experience
• React, TypeScript, Node.js
• Experience with REST APIs"
        value={textContent}
        onChange={(e) => setTextContent(e.target.value)}
        rows={12}
      />

      <div className="text-input-footer">
        <div className="character-count">
          {textContent.length} characters
          {textContent.length > 0 && textContent.length < 50 && (
            <span className="warning"> (minimum 50 characters)</span>
          )}
        </div>

        <button
          type="button"
          className="process-text-button"
          onClick={handleTextSubmit}
          disabled={textContent.length < 50 || isValidating}
        >
          {isValidating ? 'Processing...' : 'Process Text'}
        </button>
      </div>
    </div>
  );

  const renderUrlInput = () => (
    <div className="url-input-section">
      <div className="url-input-info">
        <FontAwesomeIcon icon={faExclamationTriangle} />
        <div>
          <h4>URL Extraction (Experimental)</h4>
          <p>
            Due to CORS restrictions, URL extraction may not work for all job sites.
            We recommend using the browser extension or copy/paste method for better results.
          </p>
        </div>
      </div>

      <div className="url-input-field">
        <input
          type="url"
          className="job-url-input"
          placeholder="https://example.com/job-posting"
          value={urlContent}
          onChange={(e) => setUrlContent(e.target.value)}
        />

        <button
          type="button"
          className="process-url-button"
          onClick={handleUrlSubmit}
          disabled={!urlContent.trim() || isValidating}
        >
          {isValidating ? 'Processing...' : 'Extract from URL'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="scraper-upload-zone">
      {renderInputModeSelector()}

      <div className="upload-content">
        {inputMode === 'file' && renderFileUpload()}
        {inputMode === 'text' && renderTextInput()}
        {inputMode === 'url' && renderUrlInput()}
      </div>

      {validationError && (
        <div className="validation-error">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{validationError}</span>
        </div>
      )}

      {isValidating && (
        <div className="validation-loading">
          <FontAwesomeIcon icon={faCheckCircle} />
          <span>Validating input...</span>
        </div>
      )}
    </div>
  );
}