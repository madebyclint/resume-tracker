import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner,
  faCheckCircle,
  faExclamationTriangle,
  faFileText,
  faImage,
  faGlobe,
  faRobot,
  faCloudUpload,
  faClock,
  faEye
} from '@fortawesome/free-solid-svg-icons';
import { ScraperStep } from '../types/scraperTypes';
import './ScraperStatusIndicator.css';

interface ScraperStatusIndicatorProps {
  currentStep: ScraperStep;
  progress: number;
  status: 'processing' | 'success' | 'error';
  message?: string;
  processingTime?: number;
  confidence?: number;
  showDetailed?: boolean;
}

export function ScraperStatusIndicator({
  currentStep,
  progress,
  status,
  message,
  processingTime,
  confidence,
  showDetailed = false
}: ScraperStatusIndicatorProps) {

  const steps: Array<{
    key: ScraperStep;
    label: string;
    description: string;
    icon: any;
  }> = [
      {
        key: 'input',
        label: 'Input Validation',
        description: 'Validating uploaded content',
        icon: faCloudUpload
      },
      {
        key: 'extraction',
        label: 'Text Extraction',
        description: 'Extracting text from document',
        icon: faFileText
      },
      {
        key: 'ai-processing',
        label: 'AI Processing',
        description: 'Parsing job information with AI',
        icon: faRobot
      },
      {
        key: 'preview',
        label: 'Preview',
        description: 'Ready for review',
        icon: faEye
      }
    ];

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.key === currentStep);
  };

  const getStepStatus = (stepIndex: number) => {
    const currentIndex = getCurrentStepIndex();

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) {
      if (status === 'error') return 'error';
      if (status === 'success' && currentStep === 'preview') return 'completed';
      return 'active';
    }
    return 'pending';
  };

  const getStatusIcon = (stepStatus: string) => {
    switch (stepStatus) {
      case 'completed':
        return faCheckCircle;
      case 'active':
        return faSpinner;
      case 'error':
        return faExclamationTriangle;
      default:
        return null;
    }
  };

  const getStatusColor = (stepStatus: string) => {
    switch (stepStatus) {
      case 'completed':
        return '#22c55e';
      case 'active':
        return '#3b82f6';
      case 'error':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const formatTime = (time: number) => {
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const getInputTypeIcon = () => {
    if (currentStep === 'input' || currentStep === 'extraction') {
      // Try to determine input type from message or other context
      if (message?.toLowerCase().includes('pdf')) return faFileText;
      if (message?.toLowerCase().includes('image')) return faImage;
      if (message?.toLowerCase().includes('url')) return faGlobe;
    }
    return null;
  };

  if (!showDetailed) {
    // Compact version for small spaces
    return (
      <div className="scraper-status-compact">
        <div className="status-indicator">
          <FontAwesomeIcon
            icon={status === 'processing' ? faSpinner : status === 'success' ? faCheckCircle : faExclamationTriangle}
            className={`status-icon ${status}`}
            spin={status === 'processing'}
          />
          <div className="status-text">
            <span className="status-label">
              {status === 'processing' ? 'Processing...' :
                status === 'success' ? 'Complete' : 'Error'}
            </span>
            {message && <span className="status-message">{message}</span>}
          </div>
        </div>

        {status === 'processing' && (
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // Detailed version for modal/full display
  return (
    <div className="scraper-status-detailed">
      <div className="status-header">
        <h3>Processing Status</h3>
        {processingTime && (
          <div className="processing-time">
            <FontAwesomeIcon icon={faClock} />
            <span>{formatTime(processingTime)}</span>
          </div>
        )}
      </div>

      <div className="steps-container">
        {steps.map((step, index) => {
          const stepStatus = getStepStatus(index);
          const statusIcon = getStatusIcon(stepStatus);
          const inputIcon = getInputTypeIcon();

          return (
            <div
              key={step.key}
              className={`step-item ${stepStatus}`}
            >
              <div className="step-indicator">
                <div
                  className="step-circle"
                  style={{
                    backgroundColor: getStatusColor(stepStatus),
                    borderColor: getStatusColor(stepStatus)
                  }}
                >
                  {statusIcon ? (
                    <FontAwesomeIcon
                      icon={statusIcon}
                      className={stepStatus === 'active' ? 'spin' : ''}
                    />
                  ) : (
                    <FontAwesomeIcon
                      icon={step.key === 'extraction' && inputIcon ? inputIcon : step.icon}
                    />
                  )}
                </div>

                {index < steps.length - 1 && (
                  <div
                    className="step-connector"
                    style={{
                      backgroundColor: stepStatus === 'completed' ? '#22c55e' : '#e2e8f0'
                    }}
                  />
                )}
              </div>

              <div className="step-content">
                <div className="step-label">{step.label}</div>
                <div className="step-description">
                  {step.key === currentStep && message ? message : step.description}
                </div>

                {step.key === currentStep && status === 'processing' && (
                  <div className="step-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="progress-text">{progress}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {confidence !== undefined && (
        <div className="confidence-indicator">
          <div className="confidence-label">Extraction Confidence</div>
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{
                width: `${confidence * 100}%`,
                backgroundColor: confidence >= 0.8 ? '#22c55e' :
                  confidence >= 0.6 ? '#f59e0b' : '#ef4444'
              }}
            />
          </div>
          <span className="confidence-text">
            {(confidence * 100).toFixed(0)}%
            <span className="confidence-quality">
              ({confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low'})
            </span>
          </span>
        </div>
      )}

      {status === 'error' && message && (
        <div className="error-details">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <div className="error-message">
            <strong>Processing Error:</strong>
            <span>{message}</span>
          </div>
        </div>
      )}
    </div>
  );
}