import { useState } from "react";
import { useAppState } from "../state/AppStateContext";
import FileUploadSection from "../components/FileUploadSection";
import StatsSection from "../components/StatsSection";
import ResumeTable from "../components/ResumeTable";
import CoverLetterTable from "../components/CoverLetterTable";
import TextPreviewModal from "../components/TextPreviewModal";
import DatabaseDebugPanel from "../components/DatabaseDebugPanel";
import { exportAllDataAsJSON, importAllDataFromJSON } from "../storage";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faUpload, faCog } from '@fortawesome/free-solid-svg-icons';

export default function DashboardPage() {
  const { state, setState, isLoading, syncWithStorage } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [coverLetterSearchTerm, setCoverLetterSearchTerm] = useState('');
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const handleShowPreview = (text: string) => {
    setPreviewText(text);
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewText(null);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const jsonData = await exportAllDataAsJSON();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `resume-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
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

        if (result.success || result.importedCounts.resumes > 0 || result.importedCounts.coverLetters > 0 || result.importedCounts.jobDescriptions > 0) {
          await syncWithStorage();
          const imported = result.importedCounts;
          let message = `Successfully imported: ${imported.resumes} resumes, ${imported.coverLetters} cover letters, ${imported.jobDescriptions} job descriptions.`;
          if (result.warnings.length > 0) {
            message += `\n\nWarnings:\n${result.warnings.join('\n')}`;
          }
          alert(message);
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
        <p>Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <FileUploadSection
        state={state}
        setState={setState}
        syncWithStorage={syncWithStorage}
      />

      <div style={{
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '1rem',
          gap: '0.5rem'
        }}>
          <button
            onClick={handleExportData}
            disabled={isExporting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            title="Export all data as backup file"
          >
            <FontAwesomeIcon icon={faDownload} />
            {isExporting ? 'Exporting...' : 'Export Data'}
          </button>
          <button
            onClick={handleImportData}
            disabled={isImporting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            title="Import data from backup file"
          >
            <FontAwesomeIcon icon={faUpload} />
            {isImporting ? 'Importing...' : 'Import Data'}
          </button>
          <button
            onClick={() => setShowDebugPanel(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            title="Database debug tools"
          >
            <FontAwesomeIcon icon={faCog} />
            Debug DB
          </button>
        </div>
        <StatsSection
          resumes={state.resumes}
          coverLetters={state.coverLetters}
        />
      </div>

      <ResumeTable
        resumes={state.resumes}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        setState={setState}
        onShowPreview={handleShowPreview}
      />

      <CoverLetterTable
        coverLetters={state.coverLetters}
        searchTerm={coverLetterSearchTerm}
        setSearchTerm={setCoverLetterSearchTerm}
        setState={setState}
        onShowPreview={handleShowPreview}
      />

      <TextPreviewModal
        showPreview={showPreview}
        previewText={previewText}
        onClose={handleClosePreview}
      />

      {showDebugPanel && (
        <DatabaseDebugPanel onClose={() => setShowDebugPanel(false)} />
      )}
    </div>
  );
}
