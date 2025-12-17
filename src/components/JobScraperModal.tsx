import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faFileUpload,
  faSpinner,
  faCheckCircle,
  faExclamationTriangle,
  faArrowLeft,
  faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import { ScraperInput, ScraperResult, ParsedJobData, ExtensionCaptureData } from '../types/scraperTypes';
import { JobDescription } from '../types';
import { ScraperService } from '../utils/scraperService';
import { ScraperUploadZone } from './ScraperUploadZone';
import { JobPreviewModal } from './JobPreviewModal';
import { ScraperStatusIndicator } from './ScraperStatusIndicator';
import './JobScraperModal.css';

interface JobScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated: (job: JobDescription) => void;
  initialData?: Partial<ScraperInput>;
}

type ModalStep = 'input' | 'processing' | 'preview' | 'error';

export function JobScraperModal({
  isOpen,
  onClose,
  onJobCreated,
  initialData
}: JobScraperModalProps) {
  const [step, setStep] = useState<ModalStep>('input');
  const [input, setInput] = useState<ScraperInput | null>(null);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<'input' | 'extraction' | 'ai-processing' | 'preview'>('input');
  const [scraperService] = useState(() => new ScraperService());

  // Initialize with extension capture data if provided
  useEffect(() => {
    if (initialData && isOpen) {
      const scraperInput: ScraperInput = {
        id: initialData.id || crypto.randomUUID(),
        type: initialData.type || 'text',
        content: initialData.content || '',
        fileName: initialData.fileName,
        fileSize: initialData.fileSize,
        uploadDate: initialData.uploadDate || new Date().toISOString()
      };

      setInput(scraperInput);

      // If we have extension capture data, start processing immediately
      if (initialData.content && initialData.type !== 'text') {
        handleProcessInput(scraperInput);
      }
    }
  }, [initialData, isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setInput(null);
      setResult(null);
      setError(null);
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [isOpen]);

  const handleInputCreated = (scraperInput: ScraperInput) => {
    setInput(scraperInput);
    handleProcessInput(scraperInput);
  };

  const handleProcessInput = async (scraperInput: ScraperInput) => {
    setIsProcessing(true);
    setStep('processing');
    setError(null);
    setProcessingProgress(10);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev < 90) return prev + 10;
          return prev;
        });
      }, 500);

      setProcessingProgress(30);
      const processingResult = await scraperService.processInput(scraperInput);

      clearInterval(progressInterval);
      setProcessingProgress(100);

      if (processingResult.success && processingResult.parsedData) {
        setResult(processingResult);
        setStep('preview');
      } else {
        setError(processingResult.errors.join(', ') || 'Processing failed');
        setStep('error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setStep('error');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(100);
    }
  };

  const handleJobCreated = (jobDescription: JobDescription) => {
    onJobCreated(jobDescription);
    onClose();
  };

  const handleRetry = () => {
    if (input) {
      handleProcessInput(input);
    } else {
      setStep('input');
      setError(null);
    }
  };

  const handleBackToInput = () => {
    setStep('input');
    setResult(null);
    setError(null);
  };

  const renderStepContent = () => {
    switch (step) {
      case 'input':
        return (
          <div className="scraper-input-step">
            <div className="step-header">
              <h2>Upload Job Description</h2>
              <p>Upload a PDF, image, or paste text from a job posting</p>
            </div>

            <ScraperUploadZone
              onInputCreated={handleInputCreated}
              initialData={initialData}
            />

            <div className="input-methods">
              <div className="method-info">
                <h4>Supported Methods:</h4>
                <ul>
                  <li><strong>PDF Upload:</strong> Job descriptions saved as PDF files</li>
                  <li><strong>Image Upload:</strong> Screenshots of job postings (PNG, JPEG, etc.)</li>
                  <li><strong>Copy & Paste:</strong> Raw text from job descriptions</li>
                  <li><strong>Browser Extension:</strong> Capture from any job site</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="scraper-processing-step">
            <div className="step-header">
              <h2>Processing Job Description</h2>
              <p>Extracting and parsing job information...</p>
            </div>

            <ScraperStatusIndicator
              currentStep={currentStep}
              progress={processingProgress}
              status={isProcessing ? 'processing' : error ? 'error' : 'success'}
              message={error || getProcessingStepText()}
            />

            <div className="processing-info">
              <div className="processing-stages">
                <div className={`stage ${processingProgress >= 20 ? 'completed' : 'pending'}`}>
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>Input Validation</span>
                </div>
                <div className={`stage ${processingProgress >= 40 ? 'completed' : 'pending'}`}>
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>Text Extraction</span>
                </div>
                <div className={`stage ${processingProgress >= 70 ? 'completed' : 'pending'}`}>
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>AI Processing</span>
                </div>
                <div className={`stage ${processingProgress >= 100 ? 'completed' : 'pending'}`}>
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>Data Validation</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'preview':
        return result && result.parsedData ? (
          <JobPreviewModal
            parsedData={result.parsedData}
            extractedText={result.extractedText}
            confidence={result.confidence}
            processingTime={result.processingTime}
            aiUsage={result.aiUsage}
            onJobCreated={handleJobCreated}
            onBack={handleBackToInput}
            scraperInput={input!}
          />
        ) : (
          <div className="error-content">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <h3>No Data to Preview</h3>
            <p>The processing completed but no job data was extracted.</p>
            <button onClick={handleRetry} className="retry-button">
              Try Again
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="scraper-error-step">
            <div className="error-content">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <h3>Processing Failed</h3>
              <p>{error}</p>

              <div className="error-actions">
                <button onClick={handleRetry} className="retry-button">
                  <FontAwesomeIcon icon={faSpinner} />
                  Try Again
                </button>
                <button onClick={handleBackToInput} className="back-button">
                  <FontAwesomeIcon icon={faArrowLeft} />
                  Change Input
                </button>
              </div>

              <div className="error-suggestions">
                <h4>Troubleshooting Tips:</h4>
                <ul>
                  <li>Ensure the file contains readable text</li>
                  <li>Try a different input method (PDF vs image vs text)</li>
                  <li>Check that your AI API key is configured</li>
                  <li>Verify the job description is in English</li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getProcessingStepText = (): string => {
    if (processingProgress < 20) return 'Validating input...';
    if (processingProgress < 40) return 'Extracting text content...';
    if (processingProgress < 70) return 'Processing with AI...';
    if (processingProgress < 100) return 'Validating extracted data...';
    return 'Processing complete!';
  };

  const getStepNumber = (): string => {
    switch (step) {
      case 'input': return '1';
      case 'processing': return '2';
      case 'preview': return '3';
      case 'error': return '!';
      default: return '1';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="scraper-modal">
        <div className="modal-header">
          <div className="step-indicator">
            <span className={`step-number ${step === 'error' ? 'error' : ''}`}>
              {getStepNumber()}
            </span>
            <span className="step-title">
              {step === 'input' && 'Upload'}
              {step === 'processing' && 'Processing'}
              {step === 'preview' && 'Preview'}
              {step === 'error' && 'Error'}
            </span>
          </div>

          <button className="close-button" onClick={onClose} title="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-content">
          {renderStepContent()}
        </div>

        <div className="modal-footer">
          <div className="footer-info">
            {input && (
              <span className="input-info">
                {input.type === 'pdf' && `PDF: ${input.fileName || 'Uploaded file'}`}
                {input.type === 'image' && `Image: ${input.fileName || 'Uploaded image'}`}
                {input.type === 'text' && `Text: ${input.content.length} characters`}
                {input.type === 'url' && `URL: ${input.content}`}
              </span>
            )}
          </div>

          <div className="footer-actions">
            {step !== 'input' && step !== 'processing' && (
              <button
                onClick={handleBackToInput}
                className="secondary"
                disabled={isProcessing}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Start Over
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}