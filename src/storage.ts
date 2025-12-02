import { AppState, Resume, CoverLetter, JobDescription } from "./types";

const DB_NAME = "ResumeTrackerDB";
const DB_VERSION = 4;
const RESUME_STORE = "resumes";
const COVER_LETTER_STORE = "coverLetters";
const JOB_DESCRIPTION_STORE = "jobDescriptions";
const PDF_STORE = "pdfs";

interface ResumeMetadata {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  fileType: 'docx';
  textContent?: string;
}

interface CoverLetterMetadata {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  fileType: 'docx';
  textContent?: string;
  targetCompany?: string;
  targetPosition?: string;
}

interface FileData {
  id: string;
  data: ArrayBuffer;
}

const emptyState: AppState = {
  resumes: [],
  coverLetters: [],
  jobDescriptions: [],
};

// Utility function to create a hash of file content for duplicate detection
function createContentHash(base64Data: string): string {
  // Simple hash function - in production you might want to use crypto.subtle.digest
  let hash = 0;
  const str = base64Data;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Check for duplicate files
export async function checkForDuplicates(fileName: string, fileSize: number, base64Data: string, documentType: 'resume' | 'cover_letter'): Promise<{ isDuplicate: boolean; duplicateInfo?: { type: string; existingFile: Resume | CoverLetter } }> {
  const contentHash = createContentHash(base64Data);
  
  if (documentType === 'resume') {
    const resumes = await loadResumes();
    
    // Check for exact filename match
    const filenameMatch = resumes.find(r => r.fileName === fileName);
    if (filenameMatch) {
      return { isDuplicate: true, duplicateInfo: { type: 'filename', existingFile: filenameMatch } };
    }
    
    // Check for content hash match (most reliable)
    const contentMatch = resumes.find(r => createContentHash(r.fileData) === contentHash);
    if (contentMatch) {
      return { isDuplicate: true, duplicateInfo: { type: 'content', existingFile: contentMatch } };
    }
    
    // Check for size + similar filename (without extension)
    const baseName = fileName.replace(/\.docx$/i, '');
    const sizeAndNameMatch = resumes.find(r => 
      r.fileSize === fileSize && 
      r.fileName.replace(/\.docx$/i, '').toLowerCase() === baseName.toLowerCase()
    );
    if (sizeAndNameMatch) {
      return { isDuplicate: true, duplicateInfo: { type: 'size_and_name', existingFile: sizeAndNameMatch } };
    }
    
  } else {
    const coverLetters = await loadCoverLetters();
    
    // Check for exact filename match
    const filenameMatch = coverLetters.find(cl => cl.fileName === fileName);
    if (filenameMatch) {
      return { isDuplicate: true, duplicateInfo: { type: 'filename', existingFile: filenameMatch } };
    }
    
    // Check for content hash match (most reliable)
    const contentMatch = coverLetters.find(cl => createContentHash(cl.fileData) === contentHash);
    if (contentMatch) {
      return { isDuplicate: true, duplicateInfo: { type: 'content', existingFile: contentMatch } };
    }
    
    // Check for size + similar filename (without extension)
    const baseName = fileName.replace(/\.docx$/i, '');
    const sizeAndNameMatch = coverLetters.find(cl => 
      cl.fileSize === fileSize && 
      cl.fileName.replace(/\.docx$/i, '').toLowerCase() === baseName.toLowerCase()
    );
    if (sizeAndNameMatch) {
      return { isDuplicate: true, duplicateInfo: { type: 'size_and_name', existingFile: sizeAndNameMatch } };
    }
  }
  
  return { isDuplicate: false };
}

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

        // Create cover letter metadata store
        if (!db.objectStoreNames.contains(COVER_LETTER_STORE)) {
          const coverLetterStore = db.createObjectStore(COVER_LETTER_STORE, { keyPath: "id" });
          coverLetterStore.createIndex("uploadDate", "uploadDate", { unique: false });
          coverLetterStore.createIndex("targetCompany", "targetCompany", { unique: false });
        }

        // Create job descriptions store
        if (!db.objectStoreNames.contains(JOB_DESCRIPTION_STORE)) {
          const jobDescStore = db.createObjectStore(JOB_DESCRIPTION_STORE, { keyPath: "id" });
          jobDescStore.createIndex("uploadDate", "uploadDate", { unique: false });
          jobDescStore.createIndex("company", "company", { unique: false });
          jobDescStore.createIndex("applicationStatus", "applicationStatus", { unique: false });
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

    console.log('Saving resume:', resume.name, 'File data length:', resume.fileData.length, 'Type:', resume.fileType);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([RESUME_STORE, PDF_STORE], "readwrite");
      
      transaction.oncomplete = () => {
        console.log('Resume saved successfully:', resume.name);
        resolve();
      };
      
      transaction.onerror = () => {
        console.error('Transaction failed for resume:', resume.name, transaction.error);
        reject(transaction.error);
      };
      
      try {
        // Convert base64 to ArrayBuffer for efficient storage
        const fileBuffer = this.base64ToArrayBuffer(resume.fileData);
        console.log('Converted to ArrayBuffer, size:', fileBuffer.byteLength);
        
        // Save metadata without file data
        const metadata: ResumeMetadata = {
          id: resume.id,
          name: resume.name,
          fileName: resume.fileName,
          fileSize: resume.fileSize,
          uploadDate: resume.uploadDate,
          fileType: resume.fileType,
          textContent: resume.textContent,
        };

        // Save file data separately
        const fileData: FileData = {
          id: resume.id,
          data: fileBuffer,
        };

        const resumeStore = transaction.objectStore(RESUME_STORE);
        const fileStore = transaction.objectStore(PDF_STORE); // Keep same store name for compatibility

        resumeStore.put(metadata);
        fileStore.put(fileData);
        
      } catch (error) {
        console.error('Error preparing data for resume:', resume.name, error);
        reject(error);
      }
    });
  }

  async loadResumes(): Promise<Resume[]> {
    await this.init();
    if (!this.db) return [];

    const transaction = this.db.transaction([RESUME_STORE, PDF_STORE], "readonly");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const fileStore = transaction.objectStore(PDF_STORE); // Keep same store name for compatibility

    const metadataRequest = resumeStore.getAll();
    const metadata = await this.promisifyRequest<ResumeMetadata[]>(metadataRequest);

    console.log('Loading resumes, found metadata for:', metadata.length, 'resumes');

    const resumes: Resume[] = [];
    
    for (const meta of metadata) {
      try {
        const fileRequest = fileStore.get(meta.id);
        const storedFileData = await this.promisifyRequest<FileData>(fileRequest);
        
        if (storedFileData && storedFileData.data && storedFileData.data.byteLength > 0) {
          console.log('Found file data for:', meta.name, 'size:', storedFileData.data.byteLength, 'type:', meta.fileType || 'docx');
          const base64Data = this.arrayBufferToBase64(storedFileData.data);
          console.log('Converted to base64, length:', base64Data.length);
          
          // Validate the resume has required fields
          if (meta.id && meta.name && meta.fileName && meta.uploadDate) {
            resumes.push({
              ...meta,
              fileType: meta.fileType || 'docx', // Default to docx for backwards compatibility
              fileData: base64Data,
            });
          } else {
            console.warn('Resume metadata is incomplete for:', meta.name || meta.id, 'skipping...');
          }
        } else {
          console.warn('No file data found for resume:', meta.name, 'ID:', meta.id, 'removing metadata...');
          // Clean up orphaned metadata
          const cleanupTransaction = this.db!.transaction([RESUME_STORE], "readwrite");
          const cleanupStore = cleanupTransaction.objectStore(RESUME_STORE);
          cleanupStore.delete(meta.id);
        }
      } catch (error) {
        console.error('Error loading resume:', meta.name || meta.id, error);
        // Continue with other resumes
      }
    }

    console.log('Loaded', resumes.length, 'complete resumes');
    return resumes.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  }

  async saveCoverLetter(coverLetter: CoverLetter): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    console.log('Saving cover letter:', coverLetter.name, 'File data length:', coverLetter.fileData.length, 'Type:', coverLetter.fileType);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([COVER_LETTER_STORE, PDF_STORE], "readwrite");
      
      transaction.oncomplete = () => {
        console.log('Cover letter saved successfully:', coverLetter.name);
        resolve();
      };
      
      transaction.onerror = () => {
        console.error('Transaction failed for cover letter:', coverLetter.name, transaction.error);
        reject(transaction.error);
      };
      
      try {
        // Convert base64 to ArrayBuffer for efficient storage
        const fileBuffer = this.base64ToArrayBuffer(coverLetter.fileData);
        console.log('Converted to ArrayBuffer, size:', fileBuffer.byteLength);
        
        // Save metadata without file data
        const metadata: CoverLetterMetadata = {
          id: coverLetter.id,
          name: coverLetter.name,
          fileName: coverLetter.fileName,
          fileSize: coverLetter.fileSize,
          uploadDate: coverLetter.uploadDate,
          fileType: coverLetter.fileType,
          textContent: coverLetter.textContent,
          targetCompany: coverLetter.targetCompany,
          targetPosition: coverLetter.targetPosition,
        };

        // Save file data separately (using same PDF store for now)
        const fileData: FileData = {
          id: coverLetter.id,
          data: fileBuffer,
        };

        const coverLetterStore = transaction.objectStore(COVER_LETTER_STORE);
        const fileStore = transaction.objectStore(PDF_STORE);

        coverLetterStore.put(metadata);
        fileStore.put(fileData);
        
      } catch (error) {
        console.error('Error preparing data for cover letter:', coverLetter.name, error);
        reject(error);
      }
    });
  }

  async loadCoverLetters(): Promise<CoverLetter[]> {
    await this.init();
    if (!this.db) return [];

    const transaction = this.db.transaction([COVER_LETTER_STORE, PDF_STORE], "readonly");
    const coverLetterStore = transaction.objectStore(COVER_LETTER_STORE);
    const fileStore = transaction.objectStore(PDF_STORE);

    const metadataRequest = coverLetterStore.getAll();
    const metadata = await this.promisifyRequest<CoverLetterMetadata[]>(metadataRequest);

    console.log('Loading cover letters, found metadata for:', metadata.length, 'cover letters');

    const coverLetters: CoverLetter[] = [];
    
    for (const meta of metadata) {
      try {
        const fileRequest = fileStore.get(meta.id);
        const storedFileData = await this.promisifyRequest<FileData>(fileRequest);
        
        if (storedFileData && storedFileData.data && storedFileData.data.byteLength > 0) {
          console.log('Found file data for:', meta.name, 'size:', storedFileData.data.byteLength, 'type:', meta.fileType || 'docx');
          const base64Data = this.arrayBufferToBase64(storedFileData.data);
          console.log('Converted to base64, length:', base64Data.length);
          
          // Validate the cover letter has required fields
          if (meta.id && meta.name && meta.fileName && meta.uploadDate) {
            coverLetters.push({
              ...meta,
              fileType: meta.fileType || 'docx',
              fileData: base64Data,
            });
          } else {
            console.warn('Cover letter metadata is incomplete for:', meta.name || meta.id, 'skipping...');
          }
        } else {
          console.warn('No file data found for cover letter:', meta.name, 'ID:', meta.id, 'removing metadata...');
          // Clean up orphaned metadata
          const cleanupTransaction = this.db!.transaction([COVER_LETTER_STORE], "readwrite");
          const cleanupStore = cleanupTransaction.objectStore(COVER_LETTER_STORE);
          cleanupStore.delete(meta.id);
        }
      } catch (error) {
        console.error('Error loading cover letter:', meta.name || meta.id, error);
        // Continue with other cover letters
      }
    }

    console.log('Loaded', coverLetters.length, 'complete cover letters');
    return coverLetters.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  }

  async deleteCoverLetter(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([COVER_LETTER_STORE, PDF_STORE], "readwrite");
    const coverLetterStore = transaction.objectStore(COVER_LETTER_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);

    await Promise.all([
      this.promisifyRequest(coverLetterStore.delete(id)),
      this.promisifyRequest(pdfStore.delete(id))
    ]);
  }

  async deleteResume(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([RESUME_STORE, PDF_STORE], "readwrite");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);

    await Promise.all([
      this.promisifyRequest(resumeStore.delete(id)),
      this.promisifyRequest(pdfStore.delete(id))
    ]);
  }

  async saveJobDescription(jobDescription: JobDescription): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    console.log('Saving job description:', jobDescription.title, 'Company:', jobDescription.company);

    const transaction = this.db.transaction([JOB_DESCRIPTION_STORE], "readwrite");
    const jobDescStore = transaction.objectStore(JOB_DESCRIPTION_STORE);

    await this.promisifyRequest(jobDescStore.put(jobDescription));
    console.log('Job description saved successfully');
  }

  async loadJobDescriptions(): Promise<JobDescription[]> {
    await this.init();
    if (!this.db) return [];

    const transaction = this.db.transaction([JOB_DESCRIPTION_STORE], "readonly");
    const jobDescStore = transaction.objectStore(JOB_DESCRIPTION_STORE);

    const request = jobDescStore.getAll();
    const jobDescriptions = await this.promisifyRequest<JobDescription[]>(request);

    console.log('Loaded', jobDescriptions.length, 'job descriptions');
    return jobDescriptions.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  }

  async deleteJobDescription(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([JOB_DESCRIPTION_STORE], "readwrite");
    const jobDescStore = transaction.objectStore(JOB_DESCRIPTION_STORE);

    await this.promisifyRequest(jobDescStore.delete(id));
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    const transaction = this.db.transaction([RESUME_STORE, COVER_LETTER_STORE, JOB_DESCRIPTION_STORE, PDF_STORE], "readwrite");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const coverLetterStore = transaction.objectStore(COVER_LETTER_STORE);
    const jobDescStore = transaction.objectStore(JOB_DESCRIPTION_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);

    await Promise.all([
      this.promisifyRequest(resumeStore.clear()),
      this.promisifyRequest(coverLetterStore.clear()),
      this.promisifyRequest(jobDescStore.clear()),
      this.promisifyRequest(pdfStore.clear())
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
    const pdfDataRequest = pdfStore.getAll();
    
    const metadata = await this.promisifyRequest<ResumeMetadata[]>(metadataRequest);
    const pdfKeys = await this.promisifyRequest<string[]>(pdfKeysRequest);
    const pdfData = await this.promisifyRequest<FileData[]>(pdfDataRequest);
    
    console.log('Database name:', this.db.name);
    console.log('Database version:', this.db.version);
    console.log('Object stores:', Array.from(this.db.objectStoreNames));
    console.log('Resume metadata count:', metadata.length);
    console.log('PDF data count:', pdfKeys.length);
    console.log('Resume metadata:', metadata.map(m => ({ 
      id: m.id, 
      name: m.name, 
      fileName: m.fileName,
      fileSize: m.fileSize,
      uploadDate: m.uploadDate,
      hasTextContent: !!m.textContent 
    })));
    console.log('PDF keys:', pdfKeys);
    console.log('PDF data sizes:', pdfData.map(p => ({ 
      id: p.id, 
      dataSize: p.data?.byteLength || 0 
    })));
    
    // Check for orphaned data
    const metadataIds = new Set(metadata.map(m => m.id));
    const pdfIds = new Set(pdfKeys);
    const orphanedMetadata = [...metadataIds].filter(id => !pdfIds.has(id));
    const orphanedPdfs = [...pdfIds].filter(id => !metadataIds.has(id));
    
    if (orphanedMetadata.length > 0) {
      console.warn('Orphaned metadata (no corresponding file data):', orphanedMetadata);
    }
    if (orphanedPdfs.length > 0) {
      console.warn('Orphaned file data (no corresponding metadata):', orphanedPdfs);
    }
    
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
    const coverLetters = await storage.loadCoverLetters();
    const jobDescriptions = await storage.loadJobDescriptions();
    return { resumes, coverLetters, jobDescriptions };
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
    // Get current documents from IndexedDB to compare
    const [currentResumes, currentCoverLetters, currentJobDescriptions] = await Promise.all([
      storage.loadResumes(),
      storage.loadCoverLetters(),
      storage.loadJobDescriptions()
    ]);
    
    // Handle resumes
    const currentResumeIds = new Set(currentResumes.map(r => r.id));
    const newResumeIds = new Set(state.resumes.map(r => r.id));
    
    // Delete resumes that are no longer in the state
    for (const currentResume of currentResumes) {
      if (!newResumeIds.has(currentResume.id)) {
        await storage.deleteResume(currentResume.id);
      }
    }
    
    // Save new or updated resumes
    for (const resume of state.resumes) {
      if (!currentResumeIds.has(resume.id)) {
        await storage.saveResume(resume);
      }
    }

    // Handle cover letters
    const currentCoverLetterIds = new Set(currentCoverLetters.map(c => c.id));
    const newCoverLetterIds = new Set(state.coverLetters.map(c => c.id));
    
    // Delete cover letters that are no longer in the state
    for (const currentCoverLetter of currentCoverLetters) {
      if (!newCoverLetterIds.has(currentCoverLetter.id)) {
        await storage.deleteCoverLetter(currentCoverLetter.id);
      }
    }
    
    // Save new or updated cover letters
    for (const coverLetter of state.coverLetters) {
      if (!currentCoverLetterIds.has(coverLetter.id)) {
        await storage.saveCoverLetter(coverLetter);
      }
    }

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

export async function loadResumes(): Promise<Resume[]> {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    return await storage.loadResumes();
  } catch (error) {
    console.error("Failed to load resumes from IndexedDB", error);
    return [];
  }
}

export async function loadCoverLetters(): Promise<CoverLetter[]> {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    return await storage.loadCoverLetters();
  } catch (error) {
    console.error("Failed to load cover letters from IndexedDB", error);
    return [];
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

// Cover Letter storage functions
export async function saveCoverLetter(coverLetter: CoverLetter): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await storage.saveCoverLetter(coverLetter);
  } catch (error) {
    console.error("Failed to save cover letter to IndexedDB", error);
  }
}

export async function deleteCoverLetter(id: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await storage.deleteCoverLetter(id);
  } catch (error) {
    console.error("Failed to delete cover letter from IndexedDB", error);
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

// Utility function for clearing all data (for debugging)
// WARNING: Always export data first using exportAllDataAsJSON() before clearing!
export async function clearAllData(): Promise<void> {
  if (typeof window !== 'undefined') {
    const confirmed = confirm(
      '⚠️ WARNING: This will permanently delete ALL data!\n\n' +
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
    console.warn('💡 Remember: You can restore data using the Import feature if you exported it first!');
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
    const [resumes, coverLetters, jobDescriptions] = await Promise.all([
      storage.loadResumes(),
      storage.loadCoverLetters(),
      storage.loadJobDescriptions()
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.1', // Bumped version to indicate new data structure
      resumes: resumes.map((resume: Resume) => ({
        ...resume,
        // Don't include the actual file data in backup to keep size manageable
        fileData: '[FILE_DATA_EXCLUDED]',
      })),
      coverLetters: coverLetters.map((coverLetter: CoverLetter) => ({
        ...coverLetter,
        // Don't include the actual file data in backup to keep size manageable
        fileData: '[FILE_DATA_EXCLUDED]',
      })),
      jobDescriptions,
      totalResumes: resumes.length,
      totalCoverLetters: coverLetters.length,
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
    resumes: number;
    coverLetters: number;
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
    importedCounts: { resumes: 0, coverLetters: 0, jobDescriptions: 0 },
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
    let existingResumeIds: Set<string> = new Set();
    let existingCoverLetterIds: Set<string> = new Set();
    let existingJobIds: Set<string> = new Set();

    if (skipDuplicates && !replaceExisting) {
      const [resumes, coverLetters, jobDescriptions] = await Promise.all([
        storage.loadResumes(),
        storage.loadCoverLetters(), 
        storage.loadJobDescriptions()
      ]);
      
      existingResumeIds = new Set(resumes.map((r: Resume) => r.id));
      existingCoverLetterIds = new Set(coverLetters.map((cl: CoverLetter) => cl.id));
      existingJobIds = new Set(jobDescriptions.map((j: JobDescription) => j.id));
    }

    // Import resumes
    if (importData.resumes && Array.isArray(importData.resumes)) {
      for (const resume of importData.resumes) {
        if (skipDuplicates && existingResumeIds.has(resume.id)) {
          result.warnings.push(`Skipped duplicate resume: ${resume.name}`);
          continue;
        }
        
        if (resume.fileData === '[FILE_DATA_EXCLUDED]') {
          result.warnings.push(`Resume ${resume.name} skipped - no file data in backup`);
          continue;
        }

        try {
          await storage.saveResume(resume);
          result.importedCounts.resumes++;
        } catch (error) {
          result.errors.push(`Failed to import resume ${resume.name}: ${error}`);
        }
      }
    }

    // Import cover letters  
    if (importData.coverLetters && Array.isArray(importData.coverLetters)) {
      for (const coverLetter of importData.coverLetters) {
        if (skipDuplicates && existingCoverLetterIds.has(coverLetter.id)) {
          result.warnings.push(`Skipped duplicate cover letter: ${coverLetter.name}`);
          continue;
        }
        
        if (coverLetter.fileData === '[FILE_DATA_EXCLUDED]') {
          result.warnings.push(`Cover letter ${coverLetter.name} skipped - no file data in backup`);
          continue;
        }

        try {
          await storage.saveCoverLetter(coverLetter);
          result.importedCounts.coverLetters++;
        } catch (error) {
          result.errors.push(`Failed to import cover letter ${coverLetter.name}: ${error}`);
        }
      }
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
    result.errors.push(`Failed to parse or import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}



/**
 * Save a generated resume as a new document
 */
export async function saveGeneratedResume(
  name: string,
  content: string,
  jobDescription: JobDescription
): Promise<Resume> {
  // Create a simple docx-like structure with the content
  // For now, we'll save as text content with a .docx extension suggestion
  const resumeId = crypto.randomUUID();
  const fileName = `${name.replace(/[^a-zA-Z0-9 -]/g, '')}.docx`;
  
  // Convert content to base64 (simple text encoding for now)
  const base64Content = btoa(unescape(encodeURIComponent(content)));
  
  const newResume: Resume = {
    id: resumeId,
    name: name,
    fileName: fileName,
    fileSize: content.length,
    uploadDate: new Date().toISOString(),
    fileData: base64Content,
    fileType: 'docx',
    textContent: content
  };

  await saveResume(newResume);
  
  // Link to the job description
  const updatedJobDescription: JobDescription = {
    ...jobDescription,
    linkedResumeIds: [...jobDescription.linkedResumeIds, resumeId]
  };
  
  await saveJobDescription(updatedJobDescription);
  
  return newResume;
}

/**
 * Save a generated cover letter as a new document
 */
export async function saveGeneratedCoverLetter(
  name: string,
  content: string,
  jobDescription: JobDescription
): Promise<CoverLetter> {
  // Create a simple docx-like structure with the content
  const coverLetterId = crypto.randomUUID();
  const fileName = `${name.replace(/[^a-zA-Z0-9 -]/g, '')}.docx`;
  
  // Convert content to base64 (simple text encoding for now)
  const base64Content = btoa(unescape(encodeURIComponent(content)));
  
  const newCoverLetter: CoverLetter = {
    id: coverLetterId,
    name: name,
    fileName: fileName,
    fileSize: content.length,
    uploadDate: new Date().toISOString(),
    fileData: base64Content,
    fileType: 'docx',
    textContent: content,
    targetCompany: jobDescription.company,
    targetPosition: jobDescription.title
  };

  await saveCoverLetter(newCoverLetter);
  
  // Link to the job description
  const updatedJobDescription: JobDescription = {
    ...jobDescription,
    linkedCoverLetterIds: [...jobDescription.linkedCoverLetterIds, coverLetterId]
  };
  
  await saveJobDescription(updatedJobDescription);
  
  return newCoverLetter;
}
