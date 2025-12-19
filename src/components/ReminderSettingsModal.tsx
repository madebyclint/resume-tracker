import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { JobDescription } from '../types';
import ActionReminderPanel from './ActionReminderPanel';
import './ReminderSettingsModal.css';

interface ReminderSettingsModalProps {
  isOpen: boolean;
  jobs: JobDescription[];
  onClose: () => void;
  onJobUpdate: (job: JobDescription) => void;
}

const ReminderSettingsModal: React.FC<ReminderSettingsModalProps> = ({
  isOpen,
  jobs,
  onClose,
  onJobUpdate
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content reminder-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Action Reminder Settings</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="modal-body">
          <ActionReminderPanel
            jobs={jobs}
            onJobUpdate={onJobUpdate}
            showSettingsOnly={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ReminderSettingsModal;