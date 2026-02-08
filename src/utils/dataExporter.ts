/**
 * Utility to export data from IndexedDB when there are version conflicts
 * This opens the database without specifying a version to read existing data
 */

const DB_NAME = "ResumeTrackerDB";
const RESUME_STORE = "resumes";
const COVER_LETTER_STORE = "coverLetters";
const JOB_DESCRIPTION_STORE = "jobDescriptions";
const PDF_STORE = "pdfs";
const SCRAPER_CACHE_STORE = "scraperCache";

interface ExportedData {
  version: number;
  timestamp: string;
  resumes: any[];
  coverLetters: any[];
  jobDescriptions: any[];
  pdfData: any[];
  scraperCache: any[];
}

/**
 * Opens the existing IndexedDB database without specifying a version
 * This allows us to read data from higher version databases
 */
async function openExistingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Open without specifying version - this will open the existing database
    const request = indexedDB.open(DB_NAME);

    request.onerror = () => {
      console.error('Failed to open existing database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      console.log(`Opened existing database, version: ${db.version}`);
      console.log('Available stores:', Array.from(db.objectStoreNames));
      resolve(db);
    };

    // We don't want to upgrade, just read existing data
    request.onupgradeneeded = () => {
      request.transaction!.abort();
      reject(new Error('Unexpected upgrade needed - database may be corrupted'));
    };
  });
}

/**
 * Reads all data from a specific object store
 */
async function getAllFromStore(db: IDBDatabase, storeName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      console.log(`Store ${storeName} doesn't exist, returning empty array`);
      resolve([]);
      return;
    }

    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      console.log(`Retrieved ${request.result.length} items from ${storeName}`);
      resolve(request.result);
    };

    request.onerror = () => {
      console.error(`Failed to read from store ${storeName}:`, request.error);
      reject(request.error);
    };
  });
}

/**
 * Exports all data from the existing database
 */
export async function exportAllData(): Promise<ExportedData> {
  try {
    const db = await openExistingDatabase();
    
    console.log('Exporting data from database...');
    
    const [resumes, coverLetters, jobDescriptions, pdfData, scraperCache] = await Promise.all([
      getAllFromStore(db, RESUME_STORE),
      getAllFromStore(db, COVER_LETTER_STORE),
      getAllFromStore(db, JOB_DESCRIPTION_STORE),
      getAllFromStore(db, PDF_STORE),
      getAllFromStore(db, SCRAPER_CACHE_STORE)
    ]);

    const exportData: ExportedData = {
      version: db.version,
      timestamp: new Date().toISOString(),
      resumes,
      coverLetters,
      jobDescriptions,
      pdfData,
      scraperCache
    };

    db.close();
    
    console.log('Data export completed:', {
      version: exportData.version,
      resumes: exportData.resumes.length,
      coverLetters: exportData.coverLetters.length,
      jobDescriptions: exportData.jobDescriptions.length,
      pdfData: exportData.pdfData.length,
      scraperCache: exportData.scraperCache.length
    });

    return exportData;
  } catch (error) {
    console.error('Failed to export data:', error);
    throw error;
  }
}

/**
 * Downloads the exported data as a JSON file
 */
export async function downloadExportedData(): Promise<void> {
  try {
    const data = await exportAllData();
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Data export file downloaded successfully');
  } catch (error) {
    console.error('Failed to download exported data:', error);
    throw error;
  }
}

/**
 * Deletes the existing database to resolve version conflicts
 * Use this AFTER you've exported your data
 */
export async function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('Deleting existing database...');
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    
    deleteRequest.onsuccess = () => {
      console.log('Database deleted successfully');
      resolve();
    };
    
    deleteRequest.onerror = () => {
      console.error('Failed to delete database:', deleteRequest.error);
      reject(deleteRequest.error);
    };
    
    deleteRequest.onblocked = () => {
      console.warn('Database deletion blocked - please close other tabs and try again');
      reject(new Error('Database deletion blocked'));
    };
  });
}

/**
 * Gets info about the existing database without modifying it
 */
export async function getDatabaseInfo(): Promise<{ version: number; stores: string[] }> {
  const db = await openExistingDatabase();
  const info = {
    version: db.version,
    stores: Array.from(db.objectStoreNames)
  };
  db.close();
  return info;
}