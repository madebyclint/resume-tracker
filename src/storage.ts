import { AppState, JobDescription } from "./types";
import { ScraperCache, ScraperResult } from "./types/scraperTypes";

const DB_NAME = "ResumeTrackerDB";
const DB_VERSION = 5; // Increment version for schema change
const JOB_DESCRIPTION_STORE = "jobDescriptions";
const SCRAPER_CACHE_STORE = "scraperCache";

const emptyState: AppState = {
  jobDescriptions: [],
  resumes: [],
  coverLetters: [],
};

class IndexedDBStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Remove old resume/cover letter stores if they exist
        if (db.objectStoreNames.contains("resumes")) {
          db.deleteObjectStore("resumes");
        }
        if (db.objectStoreNames.contains("coverLetters")) {
          db.deleteObjectStore("coverLetters");
        }
        if (db.objectStoreNames.contains("pdfs")) {
          db.deleteObjectStore("pdfs");
        }

        // Create job descriptions store
        if (!db.objectStoreNames.contains(JOB_DESCRIPTION_STORE)) {
          const jobDescStore = db.createObjectStore(JOB_DESCRIPTION_STORE, { keyPath: "id" });
          jobDescStore.createIndex("uploadDate", "uploadDate", { unique: false });
          jobDescStore.createIndex("company", "company", { unique: false });
          jobDescStore.createIndex("applicationStatus", "applicationStatus", { unique: false });
        }

        // Create scraper cache store
        if (!db.objectStoreNames.contains(SCRAPER_CACHE_STORE)) {
          const scraperCacheStore = db.createObjectStore(SCRAPER_CACHE_STORE, { keyPath: "id" });
          scraperCacheStore.createIndex("inputHash", "inputHash", { unique: true });
          scraperCacheStore.createIndex("expiresAt", "expiresAt", { unique: false });
        }
      };
    });
  }

  async saveJobDescription(jobDescription: JobDescription): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOB_DESCRIPTION_STORE], "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      const store = transaction.objectStore(JOB_DESCRIPTION_STORE);
      store.put(jobDescription);
    });
  }

  async loadJobDescriptions(): Promise<JobDescription[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOB_DESCRIPTION_STORE], "readonly");
      const store = transaction.objectStore(JOB_DESCRIPTION_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteJobDescription(id: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOB_DESCRIPTION_STORE], "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      const store = transaction.objectStore(JOB_DESCRIPTION_STORE);
      store.delete(id);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOB_DESCRIPTION_STORE, SCRAPER_CACHE_STORE], "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      transaction.objectStore(JOB_DESCRIPTION_STORE).clear();
      transaction.objectStore(SCRAPER_CACHE_STORE).clear();
    });
  }

  async saveScraperCache(cache: ScraperCache): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SCRAPER_CACHE_STORE], "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      const store = transaction.objectStore(SCRAPER_CACHE_STORE);
      store.put(cache);
    });
  }

  async getScraperCacheByHash(inputHash: string): Promise<ScraperCache | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SCRAPER_CACHE_STORE], "readonly");
      const store = transaction.objectStore(SCRAPER_CACHE_STORE);
      const index = store.index("inputHash");
      const request = index.get(inputHash);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllScraperCache(): Promise<ScraperCache[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SCRAPER_CACHE_STORE], "readonly");
      const store = transaction.objectStore(SCRAPER_CACHE_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteScraperCache(id: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SCRAPER_CACHE_STORE], "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      const store = transaction.objectStore(SCRAPER_CACHE_STORE);
      store.delete(id);
    });
  }
}

const storage = new IndexedDBStorage();

export async function loadState(): Promise<AppState> {
  if (typeof window === "undefined") {
    return emptyState;
  }

  try {
    const jobDescriptions = await storage.loadJobDescriptions();
    return { jobDescriptions };
  } catch (error) {
    console.error("Failed to load state from IndexedDB", error);
    return emptyState;
  }
}

export async function saveState(state: AppState): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // Get current job descriptions from IndexedDB to compare
    const currentJobDescriptions = await storage.loadJobDescriptions();
    
    // Handle job descriptions
    const currentJobDescriptionIds = new Set(currentJobDescriptions.map(jd => jd.id));
    const newJobDescriptionIds = new Set(state.jobDescriptions.map(jd => jd.id));
    
    // Delete job descriptions that are no longer in the state
    for (const currentJobDescription of currentJobDescriptions) {
      if (!newJobDescriptionIds.has(currentJobDescription.id)) {
        await storage.deleteJobDescription(currentJobDescription.id);
      }
    }
    
    // Save new or updated job descriptions
    for (const jobDescription of state.jobDescriptions) {
      if (!currentJobDescriptionIds.has(jobDescription.id)) {
        await storage.saveJobDescription(jobDescription);
      }
    }
  } catch (error) {
    console.error("Failed to save state to IndexedDB", error);
  }
}

export function getEmptyState(): AppState {
  return JSON.parse(JSON.stringify(emptyState));
}

// Utility function for clearing all data (for debugging)
export async function clearAllData(): Promise<void> {
  if (typeof window !== 'undefined') {
    const confirmed = confirm(
      '⚠️ WARNING: This will permanently delete ALL job data!\n\n' +
      'Have you exported your data first using "📦 Export All Data"?\n\n' +
      'This action cannot be undone. Continue?'
    );
    if (!confirmed) {
      console.log('Data clearing cancelled by user');
      return;
    }
  }
  
  try {
    await storage.clear();
    console.log('All data cleared from IndexedDB');
  } catch (error) {
    console.error('Error clearing IndexedDB:', error);
  }
}

// Job Description exports
export async function saveJobDescription(jobDescription: JobDescription): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await storage.saveJobDescription(jobDescription);
  } catch (error) {
    console.error("Failed to save job description to IndexedDB", error);
    throw error;
  }
}

export async function deleteJobDescription(id: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await storage.deleteJobDescription(id);
  } catch (error) {
    console.error("Failed to delete job description from IndexedDB", error);
    throw error;
  }
}

// Export all data as JSON for backup purposes
export async function exportAllDataAsJSON(): Promise<string> {
  try {
    const jobDescriptions = await storage.loadJobDescriptions();

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '2.0', // New version for jobs-only export
      jobDescriptions,
      totalJobDescriptions: jobDescriptions.length
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error("Failed to export data from IndexedDB", error);
    throw error;
  }
}

// Import interface for backup restoration
export interface ImportResult {
  success: boolean;
  importedCounts: {
    jobDescriptions: number;
  };
  errors: string[];
  warnings: string[];
}

// Import all data from JSON backup
export async function importAllDataFromJSON(jsonString: string, options: {
  replaceExisting?: boolean;
  skipDuplicates?: boolean;
} = {}): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    importedCounts: { jobDescriptions: 0 },
    errors: [],
    warnings: []
  };

  try {
    const importData = JSON.parse(jsonString);
    
    // Validate import data structure
    if (!importData.version) {
      result.errors.push("Invalid backup file: missing version information");
      return result;
    }

    const { replaceExisting = false, skipDuplicates = true } = options;

    // If replacing existing data, clear all data first
    if (replaceExisting) {
      if (!confirm('This will replace ALL existing data. Are you sure you want to continue?')) {
        result.errors.push("Import cancelled by user");
        return result;
      }
      await clearAllData();
    }

    // Get existing data for duplicate checking
    let existingJobIds: Set<string> = new Set();

    if (skipDuplicates && !replaceExisting) {
      const jobDescriptions = await storage.loadJobDescriptions();
      existingJobIds = new Set(jobDescriptions.map((j: JobDescription) => j.id));
    }

    // Import job descriptions
    if (importData.jobDescriptions && Array.isArray(importData.jobDescriptions)) {
      for (const jobDescription of importData.jobDescriptions) {
        if (skipDuplicates && existingJobIds.has(jobDescription.id)) {
          result.warnings.push(`Skipped duplicate job: ${jobDescription.title} at ${jobDescription.company}`);
          continue;
        }

        try {
          await storage.saveJobDescription(jobDescription);
          result.importedCounts.jobDescriptions++;
        } catch (error) {
          result.errors.push(`Failed to import job description ${jobDescription.title}: ${error}`);
        }
      }
    }

    result.success = result.errors.length === 0;
    return result;

  } catch (error) {
    let errorMessage = 'Failed to parse or import data: ';
    if (error instanceof SyntaxError) {
      errorMessage += `JSON parsing error: ${error.message}. Check if the file is valid JSON.`;
    } else if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Unknown error';
    }
    
    result.errors.push(errorMessage);
    return result;
  }
}

// Job Description Scraper - Cache Functions
export async function cacheScraperResult(inputHash: string, result: ScraperResult): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const cache: ScraperCache = {
      id: crypto.randomUUID(),
      inputHash,
      result,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    await storage.saveScraperCache(cache);
    console.log('Scraper result cached successfully');
  } catch (error) {
    console.warn('Failed to cache scraper result:', error);
  }
}

export async function getCachedScraperResult(inputHash: string): Promise<ScraperResult | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cache = await storage.getScraperCacheByHash(inputHash);
    
    if (!cache) {
      return null;
    }
    
    // Check if cache has expired
    if (new Date(cache.expiresAt) <= new Date()) {
      // Clean up expired cache entry
      await storage.deleteScraperCache(cache.id);
      return null;
    }
    
    console.log('Using cached scraper result');
    return cache.result;
  } catch (error) {
    console.warn('Failed to retrieve cached scraper result:', error);
    return null;
  }
}

// Clean up expired cache entries
export async function cleanupScraperCache(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const caches = await storage.getAllScraperCache();
    const now = new Date();
    
    let cleanedCount = 0;
    for (const cache of caches) {
      if (new Date(cache.expiresAt) <= now) {
        await storage.deleteScraperCache(cache.id);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired scraper cache entries`);
    }
  } catch (error) {
    console.warn('Failed to cleanup scraper cache:', error);
  }
}

// Get scraper cache statistics
export async function getScraperCacheStats(): Promise<{
  totalEntries: number;
  expiredEntries: number;
  validEntries: number;
}> {
  if (typeof window === "undefined") {
    return { totalEntries: 0, expiredEntries: 0, validEntries: 0 };
  }

  try {
    const caches = await storage.getAllScraperCache();
    const now = new Date();
    
    const expiredEntries = caches.filter(cache => new Date(cache.expiresAt) <= now).length;
    const validEntries = caches.length - expiredEntries;
    
    return {
      totalEntries: caches.length,
      expiredEntries,
      validEntries
    };
  } catch (error) {
    console.warn('Failed to get scraper cache stats:', error);
    return { totalEntries: 0, expiredEntries: 0, validEntries: 0 };
  }
}