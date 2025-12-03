import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronUp,
  faCog,
  faCheck,
  faClock,
  faFire,
  faExclamationTriangle,
  faSync
} from '@fortawesome/free-solid-svg-icons';
import { JobDescription } from '../types';
import {
  calculateAgingStats,
  generateActionItems,
  loadReminderSettings,
  saveReminderSettings,
  markActionCompleted,
  snoozeAction,
  ActionItem,
  ReminderSettings,
  SnarkLevel
} from '../utils/actionReminder';
import './ActionReminderPanel.css';

interface ActionReminderPanelProps {
  jobs: JobDescription[];
  onJobUpdate: (job: JobDescription) => void;
  showSettingsOnly?: boolean;
}

const ActionReminderPanel: React.FC<ActionReminderPanelProps> = ({ jobs, onJobUpdate, showSettingsOnly = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(showSettingsOnly);
  const [showAllActions, setShowAllActions] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>(loadReminderSettings());
  const [suggestionIndices, setSuggestionIndices] = useState<Record<string, number>>({});

  const agingStats = useMemo(() => calculateAgingStats(jobs), [jobs]);
  const actionItems = useMemo(() => generateActionItems(jobs, settings), [jobs, settings]);

  const handleSettingChange = (key: keyof ReminderSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveReminderSettings(newSettings);
  };

  const handleActionComplete = (actionItem: ActionItem, actionType: string) => {
    const job = jobs.find(j => j.id === actionItem.jobId);
    if (job) {
      const updatedJob = markActionCompleted(job, actionType as any);
      onJobUpdate(updatedJob);
    }
  };

  const handleSnoozeAction = (actionItem: ActionItem, days: number) => {
    const job = jobs.find(j => j.id === actionItem.jobId);
    if (job) {
      const updatedJob = snoozeAction(job, actionItem.actionType, days);
      onJobUpdate(updatedJob);
    }
  };

  const cycleSuggestion = (actionItem: ActionItem) => {
    const currentIndex = suggestionIndices[actionItem.id] || 0;
    const nextIndex = (currentIndex + 1) % actionItem.suggestions.length;
    setSuggestionIndices(prev => ({ ...prev, [actionItem.id]: nextIndex }));
  };

  const getCurrentSuggestion = (actionItem: ActionItem): string => {
    const index = suggestionIndices[actionItem.id] || 0;
    return actionItem.suggestions[index] || actionItem.suggestions[0];
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'high': return <FontAwesomeIcon icon={faFire} className="urgency-high" />;
      case 'medium': return <FontAwesomeIcon icon={faExclamationTriangle} className="urgency-medium" />;
      default: return <FontAwesomeIcon icon={faClock} className="urgency-low" />;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'followup': return 'Follow Up';
      case 'thankyou': return 'Thank You';
      case 'status_check': return 'Status Check';
      case 'decision_check': return 'Decision Check';
      default: return actionType;
    }
  };

  if (showSettingsOnly) {
    return (
      <div className="action-reminder-panel settings-only">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Reminder Settings</h3>
          </div>
        </div>
        <div className="panel-content">
          {/* Settings Panel */}
          <div className="settings-panel">
            <div className="settings-content">
              <h4>Reminder Settings</h4>

              <div className="setting-group">
                <label>Snark Level</label>
                <div className="snark-level-selector">
                  {(['gentle', 'medium', 'savage'] as SnarkLevel[]).map((level) => (
                    <button
                      key={level}
                      className={`snark-btn ${settings.snarkLevel === level ? 'active' : ''}`}
                      onClick={() => handleSettingChange('snarkLevel', level)}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <label>Notification Time</label>
                <input
                  type="time"
                  value={settings.notificationTime}
                  onChange={(e) => handleSettingChange('notificationTime', e.target.value)}
                />
              </div>

              <div className="setting-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.dailyNotifications}
                    onChange={(e) => handleSettingChange('dailyNotifications', e.target.checked)}
                  />
                  Daily Notifications
                </label>
              </div>

              <div className="setting-group">
                <label>Follow-up Reminder (days after application)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.followupReminderDays}
                  onChange={(e) => handleSettingChange('followupReminderDays', parseInt(e.target.value))}
                />
              </div>

              <div className="setting-group">
                <label>Thank You Reminder (days after interview)</label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={settings.thankYouReminderDays}
                  onChange={(e) => handleSettingChange('thankYouReminderDays', parseInt(e.target.value))}
                />
              </div>

              <div className="setting-group">
                <label>Decision Check (days after final interview)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.decisionCheckDays}
                  onChange={(e) => handleSettingChange('decisionCheckDays', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="action-reminder-panel">
      <div className="panel-header">
        <div className="panel-title">
          <button
            className="toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
          </button>
          <h3>Action Center</h3>
          <span className="action-count">
            {actionItems.length > 0 && `${actionItems.length} action${actionItems.length !== 1 ? 's' : ''} needed`}
          </span>
        </div>
        <button
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
      </div>      {isExpanded && (
        <div className="panel-content">
          {/* Aging Heatmap */}
          <div className="aging-heatmap">
            <div className={`aging-category fresh ${agingStats.fresh > 0 ? 'has-jobs' : ''}`}>
              <span className="category-label">🟢 Fresh (0-3d)</span>
              <span className="category-count">{agingStats.fresh}</span>
            </div>
            <div className={`aging-category followup ${agingStats.followup > 0 ? 'has-jobs' : ''}`}>
              <span className="category-label">🟡 Follow-up (4-14d)</span>
              <span className="category-count">{agingStats.followup}</span>
            </div>
            <div className={`aging-category stale ${agingStats.stale > 0 ? 'has-jobs' : ''}`}>
              <span className="category-label">🟠 Stale (15-30d)</span>
              <span className="category-count">{agingStats.stale}</span>
            </div>
            <div className={`aging-category cold ${agingStats.cold > 0 ? 'has-jobs' : ''}`}>
              <span className="category-label">🔴 Cold (30+d)</span>
              <span className="category-count">{agingStats.cold}</span>
            </div>
          </div>

          {/* Action Items */}
          {actionItems.length > 0 && (
            <div className="action-items">
              {(showAllActions ? actionItems : actionItems.slice(0, 5)).map((item) => (
                <div key={item.id} className={`action-item urgency-${item.urgency}`}>
                  <div className="action-content">
                    <div className="action-header">
                      {getUrgencyIcon(item.urgency)}
                      <span className="company-name">{item.company}</span>
                      <span className="action-type">{getActionLabel(item.actionType)}</span>
                    </div>
                    <div className="action-message">{item.message}</div>
                    <div className="action-suggestion">
                      <div className="suggestion-content">
                        <strong>💡 Suggestion:</strong> {getCurrentSuggestion(item)}
                      </div>
                      {item.suggestions.length > 1 && (
                        <button
                          className="cycle-suggestion-btn"
                          onClick={() => cycleSuggestion(item)}
                          title={`Show next suggestion (${(suggestionIndices[item.id] || 0) + 1} of ${item.suggestions.length})`}
                        >
                          <FontAwesomeIcon icon={faSync} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="action-buttons">
                    <button
                      className="action-btn complete-btn"
                      onClick={() => handleActionComplete(item, item.actionType)}
                      title={`Mark ${getActionLabel(item.actionType)} as completed`}
                    >
                      <FontAwesomeIcon icon={faCheck} /> Done
                    </button>
                    {item.canSnooze && (
                      <div className="snooze-dropdown">
                        <button className="action-btn snooze-btn" title="Snooze">
                          <FontAwesomeIcon icon={faClock} /> Snooze
                        </button>
                        <div className="snooze-options">
                          <button onClick={() => handleSnoozeAction(item, 3)}>3 days</button>
                          <button onClick={() => handleSnoozeAction(item, 7)}>1 week</button>
                          <button onClick={() => handleSnoozeAction(item, 14)}>2 weeks</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {actionItems.length > 5 && !showAllActions && (
                <button
                  className="more-actions clickable"
                  onClick={() => setShowAllActions(true)}
                >
                  +{actionItems.length - 5} more action{actionItems.length - 5 !== 1 ? 's' : ''} (click to show)
                </button>
              )}
              {showAllActions && actionItems.length > 5 && (
                <button
                  className="more-actions clickable"
                  onClick={() => setShowAllActions(false)}
                >
                  Show fewer actions
                </button>
              )}
            </div>
          )}

          {actionItems.length === 0 && (
            <div className="no-actions">
              <span>🎉 All caught up! No actions needed right now.</span>
            </div>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-content">
            <h4>Reminder Settings</h4>

            <div className="setting-group">
              <label>Snark Level</label>
              <div className="snark-level-selector">
                {(['gentle', 'medium', 'savage'] as SnarkLevel[]).map((level) => (
                  <button
                    key={level}
                    className={`snark-btn ${settings.snarkLevel === level ? 'active' : ''}`}
                    onClick={() => handleSettingChange('snarkLevel', level)}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <label>Notification Time</label>
              <input
                type="time"
                value={settings.notificationTime}
                onChange={(e) => handleSettingChange('notificationTime', e.target.value)}
              />
            </div>

            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.dailyNotifications}
                  onChange={(e) => handleSettingChange('dailyNotifications', e.target.checked)}
                />
                Daily Notifications
              </label>
            </div>

            <div className="setting-group">
              <label>Follow-up Reminder (days after application)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.followupReminderDays}
                onChange={(e) => handleSettingChange('followupReminderDays', parseInt(e.target.value))}
              />
            </div>

            <div className="setting-group">
              <label>Thank You Reminder (days after interview)</label>
              <input
                type="number"
                min="1"
                max="14"
                value={settings.thankYouReminderDays}
                onChange={(e) => handleSettingChange('thankYouReminderDays', parseInt(e.target.value))}
              />
            </div>

            <div className="setting-group">
              <label>Decision Check (days after final interview)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.decisionCheckDays}
                onChange={(e) => handleSettingChange('decisionCheckDays', parseInt(e.target.value))}
              />
            </div>

            <button
              className="close-settings-btn"
              onClick={() => setShowSettings(false)}
            >
              Close Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionReminderPanel;