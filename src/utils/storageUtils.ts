// Storage validation utilities for preventing storage quota issues

export interface StorageCheckResult {
  canUpload: boolean;
  warning?: string;
  error?: string;
  usagePercent?: number;
  availableSpace?: number;
}

/**
 * Check if a file can be uploaded without exceeding storage limits
 */
export async function checkStorageCapacity(fileSize: number): Promise<StorageCheckResult> {
  try {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
      // If storage API not available, allow upload with warning
      return {
        canUpload: true,
        warning: 'Storage monitoring not supported in this browser'
      };
    }

    const estimate = await navigator.storage.estimate();
    
    if (!estimate.usage || !estimate.quota) {
      return {
        canUpload: true,
        warning: 'Unable to determine storage usage'
      };
    }

    const currentUsagePercent = (estimate.usage / estimate.quota) * 100;
    const availableSpace = estimate.quota - estimate.usage;
    
    // Estimate file size increase due to base64 encoding and metadata
    const estimatedStorageSize = fileSize * 1.4; // 33% base64 overhead + metadata
    
    const projectedUsage = estimate.usage + estimatedStorageSize;
    const projectedUsagePercent = (projectedUsage / estimate.quota) * 100;

    // Critical threshold - prevent upload
    if (projectedUsagePercent > 95) {
      return {
        canUpload: false,
        error: `Upload would exceed storage limit. File needs ${formatBytes(estimatedStorageSize)} but only ${formatBytes(availableSpace)} available.`,
        usagePercent: currentUsagePercent,
        availableSpace
      };
    }

    // Warning threshold - allow but warn
    if (projectedUsagePercent > 85) {
      return {
        canUpload: true,
        warning: `Upload will use significant storage (${projectedUsagePercent.toFixed(1)}% total). Consider cleaning up old files.`,
        usagePercent: currentUsagePercent,
        availableSpace
      };
    }

    // High usage warning
    if (currentUsagePercent > 75) {
      return {
        canUpload: true,
        warning: `Storage usage is high (${currentUsagePercent.toFixed(1)}%). Monitor future uploads.`,
        usagePercent: currentUsagePercent,
        availableSpace
      };
    }

    // All good
    return {
      canUpload: true,
      usagePercent: currentUsagePercent,
      availableSpace
    };

  } catch (error) {
    console.warn('Storage check failed:', error);
    return {
      canUpload: true,
      warning: 'Unable to check storage capacity'
    };
  }
}

/**
 * Get current storage statistics
 */
export async function getStorageStats() {
  try {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
      return null;
    }

    const estimate = await navigator.storage.estimate();
    
    if (!estimate.usage || !estimate.quota) {
      return null;
    }

    return {
      usage: estimate.usage,
      quota: estimate.quota,
      usagePercent: (estimate.usage / estimate.quota) * 100,
      available: estimate.quota - estimate.usage,
      usageMB: estimate.usage / (1024 * 1024),
      quotaMB: estimate.quota / (1024 * 1024),
      availableMB: (estimate.quota - estimate.usage) / (1024 * 1024)
    };
  } catch (error) {
    console.warn('Unable to get storage stats:', error);
    return null;
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if storage is persistent (won't be cleared by browser)
 */
export async function checkStoragePersistence(): Promise<{
  isPersistent: boolean;
  canRequestPersistence: boolean;
}> {
  try {
    if (!('storage' in navigator)) {
      return { isPersistent: false, canRequestPersistence: false };
    }

    const isPersistent = await navigator.storage.persisted();
    
    return {
      isPersistent,
      canRequestPersistence: 'persist' in navigator.storage
    };
  } catch (error) {
    return { isPersistent: false, canRequestPersistence: false };
  }
}

/**
 * Request persistent storage to prevent data loss
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      return await navigator.storage.persist();
    }
    return false;
  } catch (error) {
    console.warn('Failed to request persistent storage:', error);
    return false;
  }
}

/**
 * Estimate total app storage usage by counting document sizes
 */
export function estimateAppStorageUsage(resumes: Array<{fileSize: number}>, coverLetters: Array<{fileSize: number}>): {
  totalFileSize: number;
  estimatedStorageSize: number;
  documentCount: number;
} {
  const totalFileSize = [...resumes, ...coverLetters].reduce((sum, doc) => sum + doc.fileSize, 0);
  
  // Account for base64 encoding overhead (33%) + metadata and indexes
  const estimatedStorageSize = totalFileSize * 1.4;
  
  return {
    totalFileSize,
    estimatedStorageSize,
    documentCount: resumes.length + coverLetters.length
  };
}