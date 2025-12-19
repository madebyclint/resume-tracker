import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faPlus, faUpload, faDownload, faCog } from '@fortawesome/free-solid-svg-icons';
import './TabNavigation.css';

interface TabNavigationProps {
  activeTab: 'job-descriptions' | 'analytics';
  onTabChange: (tab: 'job-descriptions' | 'analytics') => void;
  onAddJob: () => void;
  onImportCSV: () => void;
  onExport: () => void;
  onImport: () => void;
  onReminderSettings: () => void;
  isExporting: boolean;
  isImporting: boolean;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  onAddJob,
  onImportCSV,
  onExport,
  onImport,
  onReminderSettings,
  isExporting,
  isImporting
}) => {
  return (
    <div className="page-header">
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'job-descriptions' ? 'active' : ''}`}
          onClick={() => onTabChange('job-descriptions')}
        >
          Job Descriptions
        </button>
        <button
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onTabChange('analytics')}
        >
          <FontAwesomeIcon icon={faChartBar} /> Analytics
        </button>
      </div>
      {activeTab === 'job-descriptions' && (
        <div className="job-actions">
          <button
            className="add-job-button primary"
            onClick={onAddJob}
          >
            <FontAwesomeIcon icon={faPlus} /> Add Job
          </button>
          <button
            className="import-csv-button"
            onClick={onImportCSV}
          >
            <FontAwesomeIcon icon={faUpload} /> Import CSV
          </button>
          <button
            className="export-button"
            onClick={onExport}
            disabled={isExporting}
          >
            <FontAwesomeIcon icon={faDownload} />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
          <button
            className="import-button"
            onClick={onImport}
            disabled={isImporting}
          >
            <FontAwesomeIcon icon={faUpload} />
            {isImporting ? 'Importing...' : 'Import'}
          </button>
          <button
            className="reminder-settings-button"
            onClick={onReminderSettings}
            title="Configure action reminders"
          >
            <FontAwesomeIcon icon={faCog} /> Reminders
          </button>
        </div>
      )}
    </div>
  );
};

export default TabNavigation;