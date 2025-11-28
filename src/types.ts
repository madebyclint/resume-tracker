export interface Resume {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  fileData: string; // base64 encoded Word document
  fileType: 'docx'; // only Word documents supported
  textContent?: string; // extracted text for search
  lastChunkUpdate?: string; // when chunks were last generated
  chunkCount?: number; // cached count of chunks for this document
}

export type ChunkType = 
  | 'header'
  | 'summary'
  | 'skills' 
  | 'experience_section'
  | 'experience_bullet'
  | 'mission_fit'
  | 'cover_letter_intro'
  | 'cover_letter_body'
  | 'cover_letter_closing';

export interface Chunk {
  id: string; // uuid
  sourceDocId: string; // Resume ID this chunk came from
  type: ChunkType;
  text: string;
  tags: string[]; // AI-suggested or manual tags
  order: number; // Order within the document
  createdAt: string;
  updatedAt?: string; // When chunk was last modified
  approved?: boolean; // Whether the user has approved this chunk
  parsedBy: 'ai' | 'rules' | 'manual'; // How this chunk was created
  confidence?: number; // AI confidence score (0-1, if available)
}

export interface ChunkParseResult {
  chunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[];
  success: boolean;
  error?: string;
}

export interface AppState {
  resumes: Resume[];
}
