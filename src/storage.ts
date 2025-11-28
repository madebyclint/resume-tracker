import { AppState, Resume, CoverLetter, Chunk } from "./types";

const DB_NAME = "ResumeTrackerDB";
const DB_VERSION = 3;
const RESUME_STORE = "resumes";
const COVER_LETTER_STORE = "coverLetters";
const PDF_STORE = "pdfs";
const CHUNKS_STORE = "chunks";

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

        // Create PDF data store
        if (!db.objectStoreNames.contains(PDF_STORE)) {
          db.createObjectStore(PDF_STORE, { keyPath: "id" });
        }

        // Create chunks store
        if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
          const chunkStore = db.createObjectStore(CHUNKS_STORE, { keyPath: "id" });
          chunkStore.createIndex("sourceDocId", "sourceDocId", { unique: false });
          chunkStore.createIndex("type", "type", { unique: false });
          chunkStore.createIndex("createdAt", "createdAt", { unique: false });
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

    const transaction = this.db.transaction([COVER_LETTER_STORE, PDF_STORE, CHUNKS_STORE], "readwrite");
    const coverLetterStore = transaction.objectStore(COVER_LETTER_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);
    const chunkStore = transaction.objectStore(CHUNKS_STORE);

    // Delete all chunks associated with this cover letter
    const chunksIndex = chunkStore.index("sourceDocId");
    const chunkKeysRequest = chunksIndex.getAllKeys(id);
    const chunkKeys = await this.promisifyRequest<string[]>(chunkKeysRequest);
    
    const deleteChunkPromises = chunkKeys.map(chunkId => 
      this.promisifyRequest(chunkStore.delete(chunkId))
    );

    await Promise.all([
      this.promisifyRequest(coverLetterStore.delete(id)),
      this.promisifyRequest(pdfStore.delete(id)),
      ...deleteChunkPromises
    ]);
  }

  async deleteResume(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([RESUME_STORE, PDF_STORE, CHUNKS_STORE], "readwrite");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);
    const chunkStore = transaction.objectStore(CHUNKS_STORE);

    // Delete all chunks associated with this resume
    const chunksIndex = chunkStore.index("sourceDocId");
    const chunkKeysRequest = chunksIndex.getAllKeys(id);
    const chunkKeys = await this.promisifyRequest<string[]>(chunkKeysRequest);
    
    const deleteChunkPromises = chunkKeys.map(chunkId => 
      this.promisifyRequest(chunkStore.delete(chunkId))
    );

    await Promise.all([
      this.promisifyRequest(resumeStore.delete(id)),
      this.promisifyRequest(pdfStore.delete(id)),
      ...deleteChunkPromises
    ]);
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    const transaction = this.db.transaction([RESUME_STORE, COVER_LETTER_STORE, PDF_STORE, CHUNKS_STORE], "readwrite");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const coverLetterStore = transaction.objectStore(COVER_LETTER_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);
    const chunkStore = transaction.objectStore(CHUNKS_STORE);

    await Promise.all([
      this.promisifyRequest(resumeStore.clear()),
      this.promisifyRequest(coverLetterStore.clear()),
      this.promisifyRequest(pdfStore.clear()),
      this.promisifyRequest(chunkStore.clear()),
    ]);
  }

  // Chunk management methods
  async saveChunk(chunk: Chunk): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([CHUNKS_STORE], "readwrite");
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    
    return this.promisifyRequest(chunkStore.put(chunk));
  }

  async saveChunks(chunks: Chunk[]): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([CHUNKS_STORE], "readwrite");
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    
    const promises = chunks.map(chunk => this.promisifyRequest(chunkStore.put(chunk)));
    await Promise.all(promises);
  }

  async getChunksBySourceDoc(sourceDocId: string): Promise<Chunk[]> {
    await this.init();
    if (!this.db) return [];

    const transaction = this.db.transaction([CHUNKS_STORE], "readonly");
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    const index = chunkStore.index("sourceDocId");
    
    const chunks = await this.promisifyRequest<Chunk[]>(index.getAll(sourceDocId));
    return chunks.sort((a, b) => a.order - b.order);
  }

  async getAllChunks(): Promise<Chunk[]> {
    await this.init();
    if (!this.db) return [];

    const transaction = this.db.transaction([CHUNKS_STORE], "readonly");
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    
    return this.promisifyRequest<Chunk[]>(chunkStore.getAll());
  }

  async updateChunk(chunk: Chunk): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([CHUNKS_STORE], "readwrite");
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    
    return this.promisifyRequest(chunkStore.put(chunk));
  }

  async deleteChunk(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([CHUNKS_STORE], "readwrite");
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    
    return this.promisifyRequest(chunkStore.delete(id));
  }

  async deleteChunksBySourceDoc(sourceDocId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([CHUNKS_STORE], "readwrite");
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    const index = chunkStore.index("sourceDocId");
    
    const chunks = await this.promisifyRequest<Chunk[]>(index.getAll(sourceDocId));
    const deletePromises = chunks.map(chunk => this.promisifyRequest(chunkStore.delete(chunk.id)));
    
    await Promise.all(deletePromises);
  }

  async deleteAllChunks(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([CHUNKS_STORE], "readwrite");
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    
    return this.promisifyRequest(chunkStore.clear());
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
    return { resumes, coverLetters };
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
    const [currentResumes, currentCoverLetters] = await Promise.all([
      storage.loadResumes(),
      storage.loadCoverLetters()
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
export async function clearAllData(): Promise<void> {
  try {
    await storage.clear();
    console.log('All data cleared from IndexedDB');
  } catch (error) {
    console.error('Error clearing IndexedDB:', error);
  }
}

// Chunk management functions
export async function saveChunk(chunk: Chunk): Promise<void> {
  try {
    await storage.saveChunk(chunk);
  } catch (error) {
    console.error("Failed to save chunk to IndexedDB", error);
    throw error;
  }
}

export async function saveChunks(chunks: Chunk[]): Promise<void> {
  try {
    await storage.saveChunks(chunks);
  } catch (error) {
    console.error("Failed to save chunks to IndexedDB", error);
    throw error;
  }
}

export async function getChunksBySourceDoc(sourceDocId: string): Promise<Chunk[]> {
  try {
    return await storage.getChunksBySourceDoc(sourceDocId);
  } catch (error) {
    console.error("Failed to get chunks from IndexedDB", error);
    return [];
  }
}

export async function getAllChunks(): Promise<Chunk[]> {
  try {
    return await storage.getAllChunks();
  } catch (error) {
    console.error("Failed to get all chunks from IndexedDB", error);
    return [];
  }
}

export async function updateChunk(chunk: Chunk): Promise<void> {
  try {
    await storage.updateChunk(chunk);
  } catch (error) {
    console.error("Failed to update chunk in IndexedDB", error);
    throw error;
  }
}

export async function deleteChunk(id: string): Promise<void> {
  try {
    await storage.deleteChunk(id);
  } catch (error) {
    console.error("Failed to delete chunk from IndexedDB", error);
    throw error;
  }
}

export async function deleteChunksBySourceDoc(sourceDocId: string): Promise<void> {
  try {
    await storage.deleteChunksBySourceDoc(sourceDocId);
  } catch (error) {
    console.error("Failed to delete chunks by source doc from IndexedDB", error);
    throw error;
  }
}

export async function deleteAllChunks(): Promise<void> {
  try {
    await storage.deleteAllChunks();
  } catch (error) {
    console.error("Failed to delete all chunks from IndexedDB", error);
    throw error;
  }
}

// Export all data as JSON for backup purposes
export async function exportAllDataAsJSON(): Promise<string> {
  try {
    const [resumes, chunks] = await Promise.all([
      storage.loadResumes(),
      storage.getAllChunks()
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      resumes: resumes.map(resume => ({
        ...resume,
        // Don't include the actual file data in backup to keep size manageable
        fileData: '[FILE_DATA_EXCLUDED]',
      })),
      chunks,
      totalResumes: resumes.length,
      totalChunks: chunks.length
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error("Failed to export data from IndexedDB", error);
    throw error;
  }
}

// Export chunks only as JSON for backup purposes
export async function exportChunksAsJSON(): Promise<string> {
  try {
    const chunks = await storage.getAllChunks();

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      chunks,
      totalChunks: chunks.length,
      chunkTypes: chunks.reduce((types, chunk) => {
        types[chunk.type] = (types[chunk.type] || 0) + 1;
        return types;
      }, {} as Record<string, number>)
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error("Failed to export chunks from IndexedDB", error);
    throw error;
  }
}

// Migration function to update legacy chunk types and tags
export async function migrateChunkTypesAndTags(): Promise<{ updated: number; total: number }> {
  try {
    const chunks = await storage.getAllChunks();
    let updatedCount = 0;

    const chunkTypeMap: Record<string, string> = {
      // Legacy resume types -> new resume types
      'header': 'cv_header',
      'summary': 'cv_summary',
      'skills': 'cv_skills',
      'experience_section': 'cv_experience_section',
      'experience_bullet': 'cv_experience_bullet',
      'mission_fit': 'cv_mission_fit',
      // Legacy cover letter types -> new cover letter types
      'cover_letter_intro': 'cl_intro',
      'cover_letter_body': 'cl_body',
      'cover_letter_closing': 'cl_closing',
      'company_research': 'cl_company_research',
      'skill_demonstration': 'cl_skill_demonstration',
      'achievement_claim': 'cl_achievement_claim',
      'motivation_statement': 'cl_motivation_statement',
      'experience_mapping': 'cl_experience_mapping'
    };

    for (const chunk of chunks) {
      const newType = chunkTypeMap[chunk.type];
      if (newType) {
        // Update chunk type
        const updatedChunk = { ...chunk, type: newType as any };
        
        // Update tags to include proper prefixes
        const isResumeType = newType.startsWith('cv_');
        const prefix = isResumeType ? 'Resume:' : 'Cover Letter:';
        
        updatedChunk.tags = chunk.tags.map(tag => {
          // Skip if already has proper prefix
          if (tag.startsWith('Resume:') || tag.startsWith('Cover Letter:')) {
            return tag;
          }
          return `${prefix} ${tag}`;
        });

        // Save the updated chunk
        await storage.updateChunk(updatedChunk);
        updatedCount++;
      }
    }

    return { updated: updatedCount, total: chunks.length };
  } catch (error) {
    console.error("Failed to migrate chunk types and tags:", error);
    throw error;
  }
}
