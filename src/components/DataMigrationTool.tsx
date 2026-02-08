import React, { useState } from 'react';
import { exportAllData } from '../utils/dataExporter';
import { storage } from '../storageApi';

export const DataMigrationTool: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [migrationResults, setMigrationResults] = useState<any>(null);

  const handleExportFromIndexedDB = async () => {
    setIsLoading(true);
    setStatus('Exporting data from IndexedDB...');
    
    try {
      const data = await exportAllData();
      setStatus(`Exported ${data.resumes.length} resumes, ${data.coverLetters.length} cover letters, ${data.jobDescriptions.length} job descriptions`);
      
      // Store the exported data for import
      localStorage.setItem('indexeddb-export', JSON.stringify(data));
      
      return data;
    } catch (error) {
      setStatus(`Error exporting from IndexedDB: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportFromBackup = async () => {
    setIsLoading(true);
    setStatus('Importing data from backup file...');
    
    try {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          setStatus('No file selected');
          setIsLoading(false);
          return;
        }
        
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          
          setStatus('Importing backup data to Railway database...');
          const results = await storage.importFromIndexedDB(data);
          
          setMigrationResults(results);
          setStatus('Backup data imported successfully!');
        } catch (error) {
          setStatus(`Error importing backup: ${error.message}`);
        } finally {
          setIsLoading(false);
        }
      };
      
      input.click();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleFullMigration = async () => {
    try {
      const data = await handleExportFromIndexedDB();
      await handleImportToRailway(data);
    } catch (error) {
      console.error('Migration failed:', error);
    }
  };

  const handleDeleteIndexedDB = async () => {
    if (!window.confirm('Are you sure you want to delete the IndexedDB database? This cannot be undone! Make sure you\'ve successfully migrated to Railway first.')) {
      return;
    }

    setIsLoading(true);
    setStatus('Deleting IndexedDB database...');
    
    try {
      const { deleteDatabase } = await import('../utils/dataExporter');
      await deleteDatabase();
      setStatus('IndexedDB deleted successfully! You can now refresh the page to use Railway storage.');
    } catch (error) {
      setStatus(`Error deleting IndexedDB: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRailwayConnection = async () => {
    setIsLoading(true);
    setStatus('Testing Railway database connection...');
    
    try {
      await storage.getStats();
      setStatus('✅ Railway database connection successful!');
    } catch (error) {
      setStatus(`❌ Railway database connection failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      left: '10px', 
      background: '#fff', 
      border: '2px solid #2196F3', 
      padding: '20px', 
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      minWidth: '400px',
      maxWidth: '500px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#2196F3' }}>🚀 Railway Migration Tool</h3>
      
      <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button 
          onClick={handleTestRailwayConnection}
          disabled={isLoading}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: '#2196F3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          Test Railway Connection
        </button>
        
        <button 
          onClick={handleExportFromIndexedDB}
          disabled={isLoading}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: '#FF9800', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          1. Export from IndexedDB
        </button>
        
        <button 
          onClick={handleImportFromBackup}
          disabled={isLoading}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: '#4CAF50', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          📁 Import Backup File to Railway
        </button>
        
        <button 
          onClick={handleFullMigration}
          disabled={isLoading}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: '#9C27B0', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔄 Full Migration (Export + Import)
        </button>
        
        <button 
          onClick={handleDeleteIndexedDB}
          disabled={isLoading || !migrationResults}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: '#f44336', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: isLoading || !migrationResults ? 'not-allowed' : 'pointer'
          }}
        >
          3. Delete IndexedDB (After Migration)
        </button>
      </div>

      {migrationResults && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '10px', 
          backgroundColor: '#e8f5e8', 
          borderRadius: '4px',
          border: '1px solid #4CAF50'
        }}>
          <strong>Migration Results:</strong><br />
          📄 Resumes: {migrationResults.results?.resumes?.imported || 0} imported, {migrationResults.results?.resumes?.errors || 0} errors<br />
          📝 Cover Letters: {migrationResults.results?.coverLetters?.imported || 0} imported, {migrationResults.results?.coverLetters?.errors || 0} errors<br />
          💼 Job Descriptions: {migrationResults.results?.jobDescriptions?.imported || 0} imported, {migrationResults.results?.jobDescriptions?.errors || 0} errors<br />
          🗄️ Cache: {migrationResults.results?.scraperCache?.imported || 0} imported, {migrationResults.results?.scraperCache?.errors || 0} errors
        </div>
      )}

      <div style={{ 
        padding: '10px', 
        backgroundColor: status.includes('Error') || status.includes('❌') ? '#ffebee' : 
                         status.includes('successfully') || status.includes('✅') ? '#e8f5e8' : '#f5f5f5',
        borderRadius: '4px',
        fontSize: '14px',
        wordBreak: 'break-word',
        border: status.includes('Error') || status.includes('❌') ? '1px solid #f44336' :
               status.includes('successfully') || status.includes('✅') ? '1px solid #4CAF50' : '1px solid #ddd'
      }}>
        <strong>Status:</strong> {status || 'Ready to migrate your data to Railway!'}
      </div>

      {isLoading && (
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <div style={{ 
            display: 'inline-block', 
            width: '20px', 
            height: '20px', 
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #2196F3',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      )}

      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        backgroundColor: '#fff3e0', 
        borderRadius: '4px',
        fontSize: '12px',
        border: '1px solid #FF9800'
      }}>
        <strong>💡 Instructions:</strong><br />
        1. Test Railway connection first<br />
        2. Use "Full Migration" for one-click migration<br />
        3. Or do steps manually: Export → Import → Delete IndexedDB<br />
        4. Refresh the page after deleting IndexedDB
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};