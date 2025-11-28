import { AppState, Resume } from "./types";

const DB_NAME = "ResumeTrackerDB";
const DB_VERSION = 1;
const RESUME_STORE = "resumes";
const PDF_STORE = "pdfs";

interface ResumeMetadata {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  textContent?: string;
}

interface PdfData {
  id: string;
  data: ArrayBuffer;
}

const emptyState: AppState = {
  resumes: [],
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

        // Create resume metadata store
        if (!db.objectStoreNames.contains(RESUME_STORE)) {
          const resumeStore = db.createObjectStore(RESUME_STORE, { keyPath: "id" });
          resumeStore.createIndex("uploadDate", "uploadDate", { unique: false });
        }

        // Create PDF data store
        if (!db.objectStoreNames.contains(PDF_STORE)) {
          db.createObjectStore(PDF_STORE, { keyPath: "id" });
        }
      };
    });
  }

  async saveResume(resume: Resume): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    console.log('Saving resume:', resume.name, 'PDF data length:', resume.pdfData.length);

    const transaction = this.db.transaction([RESUME_STORE, PDF_STORE], "readwrite");
    
    // Convert base64 to ArrayBuffer for efficient storage
    const pdfBuffer = this.base64ToArrayBuffer(resume.pdfData);
    console.log('Converted to ArrayBuffer, size:', pdfBuffer.byteLength);
    
    // Save metadata without PDF data
    const metadata: ResumeMetadata = {
      id: resume.id,
      name: resume.name,
      fileName: resume.fileName,
      fileSize: resume.fileSize,
      uploadDate: resume.uploadDate,
      textContent: resume.textContent,
    };

    // Save PDF data separately
    const pdfData: PdfData = {
      id: resume.id,
      data: pdfBuffer,
    };

    const resumeStore = transaction.objectStore(RESUME_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);

    await Promise.all([
      this.promisifyRequest(resumeStore.put(metadata)),
      this.promisifyRequest(pdfStore.put(pdfData)),
    ]);
    
    console.log('Resume saved successfully:', resume.name);
  }

  async loadResumes(): Promise<Resume[]> {
    await this.init();
    if (!this.db) return [];

    const transaction = this.db.transaction([RESUME_STORE, PDF_STORE], "readonly");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);

    const metadataRequest = resumeStore.getAll();
    const metadata = await this.promisifyRequest<ResumeMetadata[]>(metadataRequest);

    console.log('Loading resumes, found metadata for:', metadata.length, 'resumes');

    const resumes: Resume[] = [];
    
    for (const meta of metadata) {
      const pdfRequest = pdfStore.get(meta.id);
      const pdfData = await this.promisifyRequest<PdfData>(pdfRequest);
      
      if (pdfData) {
        console.log('Found PDF data for:', meta.name, 'size:', pdfData.data.byteLength);
        const base64Data = this.arrayBufferToBase64(pdfData.data);
        console.log('Converted to base64, length:', base64Data.length);
        resumes.push({
          ...meta,
          pdfData: base64Data,
        });
      } else {
        console.warn('No PDF data found for resume:', meta.name, 'ID:', meta.id);
      }
    }

    console.log('Loaded', resumes.length, 'complete resumes');
    return resumes.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  }

  async deleteResume(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([RESUME_STORE, PDF_STORE], "readwrite");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);

    await Promise.all([
      this.promisifyRequest(resumeStore.delete(id)),
      this.promisifyRequest(pdfStore.delete(id)),
    ]);
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    const transaction = this.db.transaction([RESUME_STORE, PDF_STORE], "readwrite");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);

    await Promise.all([
      this.promisifyRequest(resumeStore.clear()),
      this.promisifyRequest(pdfStore.clear()),
    ]);
  }

  private promisifyRequest<T = any>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Remove data URL prefix if present
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);
    return `data:application/pdf;base64,${base64}`;
  }

  async debug(): Promise<void> {
    await this.init();
    console.log('=== IndexedDB Debug Info ===');
    
    if (!this.db) {
      console.log('Database not initialized');
      return;
    }

    const transaction = this.db.transaction([RESUME_STORE, PDF_STORE], "readonly");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);

    const metadataRequest = resumeStore.getAll();
    const pdfKeysRequest = pdfStore.getAllKeys();
    
    const metadata = await this.promisifyRequest(metadataRequest);
    const pdfKeys = await this.promisifyRequest(pdfKeysRequest);
    
    console.log('Resume metadata count:', metadata.length);
    console.log('PDF data count:', pdfKeys.length);
    console.log('Resume metadata:', metadata);
    console.log('PDF keys:', pdfKeys);
    
    console.log('=== End Debug Info ===');
  }
}

const storage = new IndexedDBStorage();

async function migrateFromLocalStorage(): Promise<void> {
  const STORAGE_KEY = "cb-resume-builder-v1";
  const MIGRATION_KEY = "cb-resume-migrated";
  
  // Check if migration already completed
  if (localStorage.getItem(MIGRATION_KEY)) {
    return;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.resumes && parsed.resumes.length > 0) {
        console.log(`Migrating ${parsed.resumes.length} resumes from localStorage to IndexedDB...`);
        
        // Save each resume to IndexedDB
        for (const resume of parsed.resumes) {
          await storage.saveResume(resume);
        }
        
        console.log('Migration completed successfully');
      }
    }
    
    // Mark migration as completed
    localStorage.setItem(MIGRATION_KEY, "true");
  } catch (error) {
    console.error("Failed to migrate data from localStorage:", error);
  }
}

export async function loadState(): Promise<AppState> {
  if (typeof window === "undefined") {
    return emptyState;
  }

  try {
    // Attempt migration from localStorage first
    await migrateFromLocalStorage();
    
    const resumes = await storage.loadResumes();
    return { resumes };
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
    // Clear existing data and save all resumes
    await storage.clear();
    for (const resume of state.resumes) {
      await storage.saveResume(resume);
    }
  } catch (error) {
    console.error("Failed to save state to IndexedDB", error);
  }
}

export async function saveResume(resume: Resume): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await storage.saveResume(resume);
  } catch (error) {
    console.error("Failed to save resume to IndexedDB", error);
  }
}

export async function deleteResume(id: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await storage.deleteResume(id);
  } catch (error) {
    console.error("Failed to delete resume from IndexedDB", error);
  }
}

export function getEmptyState(): AppState {
  return JSON.parse(JSON.stringify(emptyState));
}

// Utility function for debugging IndexedDB contents
export async function debugIndexedDB(): Promise<void> {
  try {
    await storage.debug();
  } catch (error) {
    console.error('Error debugging IndexedDB:', error);
  }
}
