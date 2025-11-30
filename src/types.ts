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

export interface JobDescription {
  id: string;
  sequentialId?: number; // Sequential tracking number (e.g., Job #1, Job #2)
  title: string;
  company: string;
  url?: string; // URL of the original job listing
  rawText: string; // original pasted job description
  additionalContext?: string; // optional additional context for resume/cover letter generation
  extractedInfo: {
    role?: string;
    company?: string;
    department?: string;
    location?: string;
    salaryRange?: string;
    experienceLevel?: string;
    requiredSkills: string[];
    preferredSkills: string[];
    responsibilities: string[];
    requirements: string[];
  };
  keywords: string[]; // for matching
  uploadDate: string;
  linkedResumeIds: string[]; // manually connected resumes
  linkedCoverLetterIds: string[]; // manually connected cover letters
  
  // CRM-like tracking fields
  applicationStatus?: 'not_applied' | 'applied' | 'interviewing' | 'rejected' | 'offered' | 'withdrawn';
  applicationDate?: string; // when application was submitted
  submissionDate?: string; // alias for applicationDate for clarity
  lastActivityDate?: string; // last time status changed or any activity occurred
  source?: string; // where the job was found (LinkedIn, Indeed, referral, etc.)
  contactPerson?: string; // recruiter or contact person
  secondaryContact?: string; // additional contact
  priority?: 'low' | 'medium' | 'high'; // how interested you are
  followUpDate?: string; // when to follow up next
  interviewDates?: string[]; // array of interview dates
  salaryDiscussed?: string; // salary range discussed
  notes?: string;
  
  // Timeline tracking
  statusHistory?: Array<{
    status: JobDescription['applicationStatus'];
    date: string;
    notes?: string;
  }>;
  
  // Quick stats
  daysSinceApplication?: number; // computed field
  daysInCurrentStatus?: number; // computed field
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
  // Resume chunk types
  | 'cv_header'
  | 'cv_summary'
  | 'cv_skills' 
  | 'cv_experience_section'
  | 'cv_experience_bullet'
  | 'cv_mission_fit'
  // Cover letter chunk types
  | 'cl_intro'
  | 'cl_body'
  | 'cl_closing'
  | 'cl_company_research'
  | 'cl_skill_demonstration'
  | 'cl_achievement_claim'
  | 'cl_motivation_statement'
  | 'cl_experience_mapping';

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
  jobDescriptions: JobDescription[];
}
