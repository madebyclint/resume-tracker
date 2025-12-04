import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faEnvelope, faPhone, faComment, faUser, faEllipsisH, faUsers } from '@fortawesome/free-solid-svg-icons';
import { ActionItem } from '../utils/actionReminder';
import { ActionCompletionType, ActionCompletion } from '../types';
import './ActionCompletionModal.css';

interface ActionCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (completion: ActionCompletion) => void;
  actionItem: ActionItem | null;
}

const ActionCompletionModal: React.FC<ActionCompletionModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  actionItem
}) => {
  const [completionType, setCompletionType] = useState<ActionCompletionType>('email');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  if (!isOpen || !actionItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const completion: ActionCompletion = {
      actionType: actionItem.actionType,
      completionType,
      notes: notes.trim() || undefined,
      date
    };

    onComplete(completion);

    // Reset form
    setNotes('');
    setCompletionType('email');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const getCompletionTypeIcon = (type: ActionCompletionType) => {
    switch (type) {
      case 'email': return faEnvelope;
      case 'phone': return faPhone;
      case 'linkedin': return faUsers;
      case 'text': return faComment;
      case 'in_person': return faUser;
      case 'other': return faEllipsisH;
    }
  };

  const getCompletionTypeLabel = (type: ActionCompletionType) => {
    switch (type) {
      case 'email': return 'Email';
      case 'phone': return 'Phone Call';
      case 'linkedin': return 'LinkedIn Message';
      case 'text': return 'Text Message';
      case 'in_person': return 'In Person';
      case 'other': return 'Other';
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'followup': return 'Follow-up';
      case 'thankyou': return 'Thank You Note';
      case 'status_check': return 'Status Check';
      case 'decision_check': return 'Decision Timeline Check';
      default: return actionType;
    }
  };

  const completionTypes: ActionCompletionType[] = ['email', 'phone', 'linkedin', 'text', 'in_person', 'other'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content action-completion-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Complete Action: {getActionLabel(actionItem.actionType)}</h3>
          <button className="modal-close" onClick={onClose} title="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-body">
          <div className="action-context">
            <p><strong>Company:</strong> {actionItem.company}</p>
            <p><strong>Action:</strong> {actionItem.message}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="completion-type">How did you complete this action?</label>
              <div className="completion-type-grid">
                {completionTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`completion-type-btn ${completionType === type ? 'active' : ''}`}
                    onClick={() => setCompletionType(type)}
                  >
                    <FontAwesomeIcon icon={getCompletionTypeIcon(type)} />
                    <span>{getCompletionTypeLabel(type)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="completion-date">Date</label>
              <input
                id="completion-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="completion-notes">Notes (Optional)</label>
              <textarea
                id="completion-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add details about what you did, their response, next steps, etc."
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="complete-button">
                Complete Action
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ActionCompletionModal;