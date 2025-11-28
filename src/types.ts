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

export interface CoverLetter {
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
  targetCompany?: string; // company this cover letter was written for
  targetPosition?: string; // position this cover letter was written for
}

// Union type for documents
export type Document = Resume | CoverLetter;

// Type guard functions
export function isResume(doc: Document): doc is Resume {
  return !('targetCompany' in doc) && !('targetPosition' in doc);
}

export function isCoverLetter(doc: Document): doc is CoverLetter {
  return 'targetCompany' in doc || 'targetPosition' in doc;
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
  | 'cover_letter_closing'
  | 'company_research'
  | 'skill_demonstration'
  | 'achievement_claim'
  | 'motivation_statement'
  | 'experience_mapping';

// Semantic relationships for cover letters
export interface SemanticRelationship {
  type: 'mentions_company' | 'demonstrates_skill' | 'claims_achievement' | 'supports_requirement' | 'references_experience' | 'shows_motivation';
  entity: string; // What is being referenced (company name, skill, etc.)
  context?: string; // Additional context about the relationship
  confidence?: number; // AI confidence in this relationship (0-1)
}

export interface Chunk {
  id: string; // uuid
  sourceDocId: string; // Document ID this chunk came from
  type: ChunkType;
  text: string;
  tags: string[]; // AI-suggested or manual tags
  order: number; // Order within the document
  createdAt: string;
  updatedAt?: string; // When chunk was last modified
  approved?: boolean; // Whether the user has approved this chunk
  parsedBy: 'ai' | 'rules' | 'manual'; // How this chunk was created
  confidence?: number; // AI confidence score (0-1, if available)
  // Semantic relationships (primarily for cover letters)
  semanticRelationships?: SemanticRelationship[];
  // Document type this chunk came from
  sourceDocType?: 'resume' | 'cover_letter';
}

export interface ChunkParseResult {
  chunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[];
  success: boolean;
  error?: string;
}

export interface AppState {
  resumes: Resume[];
  coverLetters: CoverLetter[];
}
