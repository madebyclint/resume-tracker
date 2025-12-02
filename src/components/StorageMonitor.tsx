import React, { useState, useEffect } from 'react';
import { formatFileSize } from '../utils/documentUtils';

interface StorageEstimate {
  usage: number;
  quota: number;
  usagePercent: number;
  usageMB: number;
  quotaMB: number;
}

interface StorageMonitorProps {
  onStorageWarning?: (isNearLimit: boolean) => void;
}

const StorageMonitor: React.FC<StorageMonitorProps> = ({ onStorageWarning }) => {
  const [storageInfo, setStorageInfo] = useState<StorageEstimate | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const checkStorageQuota = async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();

        if (estimate.usage !== undefined && estimate.quota !== undefined) {
          const usagePercent = (estimate.usage / estimate.quota) * 100;
          const storageData: StorageEstimate = {
            usage: estimate.usage,
            quota: estimate.quota,
            usagePercent,
            usageMB: estimate.usage / (1024 * 1024),
            quotaMB: estimate.quota / (1024 * 1024)
          };

          setStorageInfo(storageData);
          setLastUpdated(new Date());

          // Trigger warning callback if approaching limits
          const isNearLimit = usagePercent > 80;
          if (onStorageWarning) {
            onStorageWarning(isNearLimit);
          }

          return storageData;
        }
      }

      setIsSupported(false);
      return null;
    } catch (error) {
      console.warn('Storage estimation not available:', error);
      setIsSupported(false);
      return null;
    }
  };

  useEffect(() => {
    checkStorageQuota();

    // Update storage info periodically
    const interval = setInterval(checkStorageQuota, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStorageStatusColor = (percent: number) => {
    if (percent < 50) return '#10b981'; // green
    if (percent < 80) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getStorageStatusText = (percent: number) => {
    if (percent < 50) return 'Good';
    if (percent < 80) return 'Warning';
    return 'Critical';
  };

  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edg')) return 'Edge';
    return 'Unknown';
  };

  const getBrowserLimits = (browser: string) => {
    switch (browser) {
      case 'Chrome':
      case 'Edge':
        return '~10% of available disk space';
      case 'Firefox':
        return '~10% of available disk space';
      case 'Safari':
        return '~1GB initially, expandable';
      default:
        return 'Varies by browser';
    }
  };

  if (!isSupported) {
    return (
      <div className="metric-card" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <h4>Browser Storage</h4>
        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
          Storage monitoring not supported in this browser
        </div>
      </div>
    );
  }

  if (!storageInfo) {
    return (
      <div className="metric-card" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <h4>Browser Storage</h4>
        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
          Loading storage information...
        </div>
      </div>
    );
  }

  const browser = getBrowserInfo();
  const statusColor = getStorageStatusColor(storageInfo.usagePercent);
  const statusText = getStorageStatusText(storageInfo.usagePercent);

  return (
    <div className="metric-card" style={{
      backgroundColor: '#f9fafb',
      border: `1px solid ${statusColor}`,
      position: 'relative'
    }}>
      <h4>Browser Storage</h4>

      {/* Storage Usage Bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px'
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
            {formatFileSize(storageInfo.usage)} / {formatFileSize(storageInfo.quota)}
          </span>
          <span style={{
            fontSize: '0.8rem',
            color: statusColor,
            fontWeight: '600'
          }}>
            {storageInfo.usagePercent.toFixed(1)}%
          </span>
        </div>

        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(storageInfo.usagePercent, 100)}%`,
            height: '100%',
            backgroundColor: statusColor,
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Status and Browser Info */}
      <div style={{ fontSize: '0.8rem', color: '#374151' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px'
        }}>
          <span>Status:</span>
          <span style={{ color: statusColor, fontWeight: '600' }}>
            {statusText}
          </span>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px'
        }}>
          <span>Browser:</span>
          <span>{browser}</span>
        </div>

        <div style={{
          fontSize: '0.7rem',
          color: '#6b7280',
          marginTop: '8px',
          lineHeight: '1.3'
        }}>
          <div>Limit: {getBrowserLimits(browser)}</div>
          {lastUpdated && (
            <div>Updated: {lastUpdated.toLocaleTimeString()}</div>
          )}
        </div>
      </div>

      {/* Warning Messages */}
      {storageInfo.usagePercent > 90 && (
        <div style={{
          marginTop: '8px',
          padding: '6px 8px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          fontSize: '0.7rem',
          color: '#991b1b'
        }}>
          ⚠️ Storage nearly full! Consider cleaning up old documents.
        </div>
      )}

      {storageInfo.usagePercent > 80 && storageInfo.usagePercent <= 90 && (
        <div style={{
          marginTop: '8px',
          padding: '6px 8px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fed7aa',
          borderRadius: '4px',
          fontSize: '0.7rem',
          color: '#92400e'
        }}>
          ⚠️ Storage usage is high. Monitor file uploads.
        </div>
      )}

      {/* Refresh Button */}
      <button
        type="button"
        onClick={checkStorageQuota}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'none',
          border: 'none',
          fontSize: '0.7rem',
          color: '#6b7280',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '2px'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Refresh storage info"
      >
        🔄
      </button>
    </div>
  );
};

export default StorageMonitor;