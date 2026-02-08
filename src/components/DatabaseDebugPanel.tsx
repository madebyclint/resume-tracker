import React, { useState } from 'react';
import { debugIndexedDB, fixDatabaseVersionMismatch, clearAllData } from '../storage';

interface DatabaseDebugPanelProps {
  onClose: () => void;
}

export default function DatabaseDebugPanel({ onClose }: DatabaseDebugPanelProps) {
  const [isDebugging, setIsDebugging] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [debugOutput, setDebugOutput] = useState<string>('');

  const handleDebug = async () => {
    setIsDebugging(true);
    setDebugOutput('Running debug...\n');
    
    try {
      // Capture console output
      const originalLog = console.log;
      const originalError = console.error;
      let output = '';
      
      console.log = (...args) => {
        output += args.join(' ') + '\n';
        originalLog(...args);
      };
      console.error = (...args) => {
        output += 'ERROR: ' + args.join(' ') + '\n';
        originalError(...args);
      };
      
      await debugIndexedDB();
      
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      
      setDebugOutput(output);
    } catch (error) {
      setDebugOutput(`Debug failed: ${error}`);
    } finally {
      setIsDebugging(false);
    }
  };

  const handleFixDatabase = async () => {
    if (!confirm('This will delete the current database and recreate it. Make sure you have exported your data first!')) {
      return;
    }
    
    setIsFixing(true);
    try {
      await fixDatabaseVersionMismatch();
      alert('Database fixed successfully! Please refresh the page.');
      onClose();
    } catch (error) {
      alert(`Failed to fix database: ${error}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleClearData = async () => {
    try {
      await clearAllData();
      alert('Data cleared successfully! Please refresh the page.');
      onClose();
    } catch (error) {
      alert(`Failed to clear data: ${error}`);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2>Database Debug Panel</h2>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Use these tools to diagnose and fix database issues.
        </p>

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleDebug}
            disabled={isDebugging}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isDebugging ? 'Debugging...' : 'Debug Database'}
          </button>

          <button
            onClick={handleFixDatabase}
            disabled={isFixing}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffc107',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isFixing ? 'Fixing...' : 'Fix Database Version'}
          </button>

          <button
            onClick={handleClearData}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear All Data
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>

        {debugOutput && (
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            {debugOutput}
          </div>
        )}

        <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
          <h4>What each button does:</h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            <li><strong>Debug Database:</strong> Shows information about the current database state</li>
            <li><strong>Fix Database Version:</strong> Deletes and recreates the database (fixes version mismatches)</li>
            <li><strong>Clear All Data:</strong> Removes all data from the database</li>
          </ul>
        </div>
      </div>
    </div>
  );
}