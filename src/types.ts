export interface Resume {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  fileData: string; // base64 encoded Word document
  fileType: 'docx'; // only Word documents supported
  textContent?: string; // extracted text for search
  markdownContent?: string; // extracted markdown for export/display
  detectedCompany?: string; // AI-detected current company
  detectedRole?: string; // AI-detected current role
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
  markdownContent?: string; // extracted markdown for export/display
  detectedCompany?: string; // AI-detected target company
  detectedRole?: string; // AI-detected target role
  targetCompany?: string; // company this cover letter was written for
  targetPosition?: string; // position this cover letter was written for
}

export interface JobDescription {
  id: string;
  sequentialId?: number; // Sequential tracking number (e.g., Job #1, Job #2)
  title: string;
  company: string;
  
  // New direct fields for editing
  role?: string; // Job role/title (separate from title for flexibility)
  location?: string; // Job location
  workArrangement?: 'hybrid' | 'remote' | 'office' | ''; // Work arrangement
  source1?: {
    type: 'url' | 'text';
    content: string;
  };
  source2?: {
    type: 'url' | 'text';
    content: string;
  };
  salaryMin?: number; // Minimum salary
  salaryMax?: number; // Maximum salary
  salaryRange?: string; // Combined salary range for display/AI extraction
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  
  url?: string; // URL of the original job listing
  rawText: string; // original pasted job description
  additionalContext?: string; // optional additional context for resume/cover letter generation
  extractedInfo: {
    role?: string;
    company?: string;
    companyDescription?: string;
    location?: string;
    workArrangement?: string;
    salaryRange?: string;
    jobUrl?: string;
    applicationId?: string;
    applicantCount?: string;
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
  applicationStatus?: 'not_applied' | 'applied' | 'interviewing' | 'rejected' | 'offered' | 'withdrawn' | 'duplicate' | 'archived';
  interviewStage?: 'screening' | 'first_interview' | 'followup_interview' | 'final_round' | 'assessment'; // sub-status for interviewing
  
  // Archive and duplicate handling
  isArchived?: boolean; // Explicitly archived by user (different from status)
  duplicateOfId?: string; // ID of the original JD this is a duplicate of
  linkedDuplicateIds?: string[]; // IDs of JDs that are duplicates of this one
  applicationDate?: string; // when application was submitted
  submissionDate?: string; // alias for applicationDate for clarity
  lastActivityDate?: string; // last time status changed or any activity occurred
  source?: string; // where the job was found (LinkedIn, Indeed, referral, etc.)
  contactPerson?: string; // recruiter or contact person
  secondaryContact?: string; // additional contact
  priority?: 'low' | 'medium' | 'high'; // how interested you are
  impact?: 'low' | 'medium' | 'high'; // potential career impact level
  waitingForResponse?: boolean; // flag to indicate waiting for company response
  followUpDate?: string; // when to follow up next
  interviewDates?: string[]; // array of interview dates
  salaryDiscussed?: string; // salary range discussed
  notes?: string;
  
  // Timeline tracking
  statusHistory?: Array<{
    status: JobDescription['applicationStatus'];
    interviewStage?: JobDescription['interviewStage'];
    date: string;
    notes?: string;
  }>;
  
  // Activity logging for analytics
  activityLog?: Array<{
    id: string;
    timestamp: string;
    type: 'status_change' | 'interview_stage_change' | 'note_added' | 'document_linked' | 'field_updated' | 'action_completed';
    fromValue?: any;
    toValue?: any;
    field?: string; // for field_updated type
    details?: string;
    actionType?: string; // for action_completed type
    actionDetails?: string; // what the user actually did
  }>;
  
  // Quick stats
  daysSinceApplication?: number; // computed field
  daysInCurrentStatus?: number; // computed field
  
  // Action reminders and tracking
  completedActions?: Record<string, string>; // actionType -> timestamp when completed
  snoozedUntil?: Record<string, string>; // actionId -> timestamp when snooze expires
  
  // AI Usage tracking
  aiUsage?: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number; // in USD
    parseCount: number; // number of times AI parsed this job
    lastParseDate?: string;
    rawTextHash?: string; // hash of the rawText when last parsed to detect changes
  };
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



// Action completion types
export type ActionCompletionType = 'email' | 'phone' | 'linkedin' | 'text' | 'in_person' | 'other';

export interface ActionCompletion {
  actionType: string; // 'followup', 'thankyou', 'status_check', etc.
  completionType: ActionCompletionType;
  notes?: string;
  date: string;
}

export interface AppState {
  resumes: Resume[];
  coverLetters: CoverLetter[];
  jobDescriptions: JobDescription[];
}
