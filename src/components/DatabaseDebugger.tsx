import React, { useState } from 'react';
import { downloadExportedData, getDatabaseInfo, deleteDatabase } from '../utils/dataExporter';

export const DatabaseDebugger: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const [dbInfo, setDbInfo] = useState<{ version: number; stores: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetInfo = async () => {
    setIsLoading(true);
    setStatus('Getting database info...');
    try {
      const info = await getDatabaseInfo();
      setDbInfo(info);
      setStatus(`Database version: ${info.version}, Stores: ${info.stores.join(', ')}`);
    } catch (error) {
      setStatus(`Error getting DB info: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    setIsLoading(true);
    setStatus('Exporting data...');
    try {
      await downloadExportedData();
      setStatus('Data exported successfully! Check your downloads folder.');
    } catch (error) {
      setStatus(`Error exporting data: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDatabase = async () => {
    if (!window.confirm('Are you sure you want to delete the database? Make sure you\'ve exported your data first!')) {
      return;
    }
    
    setIsLoading(true);
    setStatus('Deleting database...');
    try {
      await deleteDatabase();
      setStatus('Database deleted successfully! You can now refresh the page.');
      setDbInfo(null);
    } catch (error) {
      setStatus(`Error deleting database: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: '#fff', 
      border: '2px solid #ccc', 
      padding: '20px', 
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      minWidth: '300px',
      maxWidth: '400px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Database Debug Tool</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={handleGetInfo}
          disabled={isLoading}
          style={{ marginRight: '10px', padding: '8px 12px' }}
        >
          Get DB Info
        </button>
        
        <button 
          onClick={handleExportData}
          disabled={isLoading}
          style={{ marginRight: '10px', padding: '8px 12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Export Data
        </button>
        
        <button 
          onClick={handleDeleteDatabase}
          disabled={isLoading || !dbInfo}
          style={{ padding: '8px 12px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Delete DB
        </button>
      </div>

      {dbInfo && (
        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <strong>Database Info:</strong><br />
          Version: {dbInfo.version}<br />
          Stores: {dbInfo.stores.join(', ')}
        </div>
      )}

      <div style={{ 
        padding: '10px', 
        backgroundColor: status.includes('Error') ? '#ffebee' : status.includes('successfully') ? '#e8f5e8' : '#f5f5f5',
        borderRadius: '4px',
        fontSize: '14px',
        wordBreak: 'break-word'
      }}>
        <strong>Status:</strong> {status || 'Ready'}
      </div>

      {isLoading && (
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <div style={{ 
            display: 'inline-block', 
            width: '20px', 
            height: '20px', 
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      )}

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