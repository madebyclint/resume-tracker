import { useState } from "react";
import { useAppState } from "../state/AppStateContext";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
import { exportAllDataAsJSON, importAllDataFromJSON } from "../storage";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faUpload, faChartLine } from '@fortawesome/free-solid-svg-icons';
import './DashboardPage.css';

export default function DashboardPage() {
  const { state, isLoading } = useAppState();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const jsonData = await exportAllDataAsJSON();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `job-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement)?.files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const jsonString = await file.text();

        // Validate JSON before importing
        let parsedData;
        try {
          parsedData = JSON.parse(jsonString);
        } catch (parseError) {
          throw new Error(`Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
        }

        // Check for basic structure
        if (!parsedData || typeof parsedData !== 'object') {
          throw new Error('Invalid backup file structure');
        }

        const result = await importAllDataFromJSON(jsonString, {
          replaceExisting: false,
          skipDuplicates: true
        });

        if (result.success || result.importedCounts.jobDescriptions > 0) {
          const imported = result.importedCounts;
          let message = `Successfully imported: ${imported.jobDescriptions} job descriptions.`;
          if (result.warnings.length > 0) {
            message += `\n\nWarnings:\n${result.warnings.join('\n')}`;
          }
          alert(message);
          window.location.reload(); // Refresh to load imported data
        } else {
          alert(`Import failed:\n${result.errors.join('\n')}`);
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import data. Please check the file format and try again.');
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading pipeline data...</p>
      </div>
    );
  }

  return (
    <div className="pipeline-dashboard">
      <div className="dashboard-header">
        <h2>
          <FontAwesomeIcon icon={faChartLine} style={{ marginRight: '0.5rem' }} />
          Pipeline Dashboard
        </h2>
        <div className="dashboard-actions">
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="dashboard-button export-button"
            title="Export all job data as backup file"
          >
            <FontAwesomeIcon icon={faDownload} />
            {isExporting ? 'Exporting...' : 'Export Data'}
          </button>
          <button
            onClick={handleImportData}
            disabled={isImporting}
            className="dashboard-button import-button"
            title="Import job data from backup file"
          >
            <FontAwesomeIcon icon={faUpload} />
            {isImporting ? 'Importing...' : 'Import Data'}
          </button>
        </div>
      </div>

      <AnalyticsDashboard jobs={state.jobDescriptions} />
    </div>
  );
}
