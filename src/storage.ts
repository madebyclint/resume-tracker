import { AppState, Resume, Chunk } from "./types";

const DB_NAME = "ResumeTrackerDB";
const DB_VERSION = 2;
const RESUME_STORE = "resumes";
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

interface FileData {
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

    const transaction = this.db.transaction([RESUME_STORE, PDF_STORE, CHUNKS_STORE], "readwrite");
    const resumeStore = transaction.objectStore(RESUME_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);
    const chunkStore = transaction.objectStore(CHUNKS_STORE);

    await Promise.all([
      this.promisifyRequest(resumeStore.clear()),
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
    // Get current resumes from IndexedDB to compare
    const currentResumes = await storage.loadResumes();
    const currentIds = new Set(currentResumes.map(r => r.id));
    const newIds = new Set(state.resumes.map(r => r.id));
    
    // Delete resumes that are no longer in the state
    for (const currentResume of currentResumes) {
      if (!newIds.has(currentResume.id)) {
        await storage.deleteResume(currentResume.id);
      }
    }
    
    // Save new or updated resumes
    for (const resume of state.resumes) {
      if (!currentIds.has(resume.id)) {
        await storage.saveResume(resume);
      }
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
