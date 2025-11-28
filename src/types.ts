export interface Resume {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  fileData: string; // base64 encoded Word document
  fileType: 'docx'; // only Word documents supported
  textContent?: string; // extracted text for search
}

export type ChunkType = 
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
  tags: string[]; // AI-suggested tags
  order: number; // Order within the document
  createdAt: string;
  approved?: boolean; // Whether the user has approved this chunk
}

export interface ChunkParseResult {
  chunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[];
  success: boolean;
  error?: string;
}

export interface AppState {
  resumes: Resume[];
}
