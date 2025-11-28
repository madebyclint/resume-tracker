import { ChunkType, Chunk } from '../types';

export interface ParsedSection {
  type: ChunkType;
  content: string[];
  startLine: number;
  endLine: number;
}

export interface PlainTextParseResult {
  sections: ParsedSection[];
  chunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[];
  success: boolean;
  error?: string;
}

// Common section headers that indicate different chunk types
const SECTION_PATTERNS = {
  summary: /^(summary|profile|objective|overview|about)\s*:?\s*$/i,
  skills: /^(skills|technical\s+skills|core\s+competencies|technologies|tools)\s*:?\s*$/i,
  experience: /^(experience|work\s+experience|professional\s+experience|employment|career)\s*:?\s*$/i,
  education: /^(education|academic|qualifications|degrees?)\s*:?\s*$/i,
  projects: /^(projects|key\s+projects|notable\s+projects)\s*:?\s*$/i,
  certifications: /^(certifications?|licenses?|credentials?)\s*:?\s*$/i,
  achievements: /^(achievements?|awards?|honors?|accomplishments?)\s*:?\s*$/i
};

// Helper function to detect header information (name, title, contact details)
function isHeaderContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check for email patterns
  if (PATTERNS.email.test(text)) return true;
  
  // Check for phone patterns
  if (PATTERNS.phone.test(text)) return true;
  
  // Check for common address indicators
  if (/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard)\b/i.test(text)) return true;
  
  // Check for social media patterns
  if (/(linkedin|github|twitter|instagram)\.com|@\w+/i.test(text)) return true;
  
  // Check for city, state patterns
  if (/\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(text)) return true;
  
  // Check for zip code patterns
  if (/\b\d{5}(-\d{4})?\b/.test(text)) return true;
  
  // Check for job titles (likely in header when at the top)
  if (/\b(engineer|developer|manager|director|analyst|specialist|coordinator|assistant|lead|senior|junior|architect|consultant|designer|administrator)\b/i.test(text) && 
      text.length < 80) return true;
  
  // Check for name patterns (likely first line of resume - proper case, 2-4 words, no numbers)
  if (/^[A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?(\s+[A-Z][a-z]+)?$/.test(text.trim()) && 
      !/\d/.test(text) && 
      text.length < 50) return true;
  
  return false;
}

// Patterns for extracting specific information
const PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  dateRange: /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/|\d{4})[^\w]*(?:to|[-–—]|present|\d{4})/gi,
  bulletPoint: /^[\s]*[•·*\-+]\s+(.+)$/gm,
  jobTitle: /^([A-Z][a-zA-Z\s&]+(?:Engineer|Developer|Manager|Director|Analyst|Specialist|Coordinator|Assistant|Lead|Senior|Junior))\s*$/gm
};

/**
 * Parse resume text using rule-based approach
 * This provides a fast, reliable baseline that doesn't require AI
 */
export function parseResumeWithRules(text: string): PlainTextParseResult {
  try {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      return {
        sections: [],
        chunks: [],
        success: false,
        error: 'No content to parse'
      };
    }

    const sections = identifySections(lines);
    const chunks = sectionsToChunks(sections, lines);

    return {
      sections,
      chunks,
      success: true
    };

  } catch (error) {
    console.error('Error in rule-based parsing:', error);
    return {
      sections: [],
      chunks: [],
      success: false,
      error: `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Identify sections in the resume based on common patterns
 */
function identifySections(lines: string[]): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let currentSection: Partial<ParsedSection> | null = null;
  let preHeaderContent: string[] = [];
  let preHeaderStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sectionType = detectSectionHeader(line);

    if (sectionType) {
      // Process any accumulated pre-header content
      if (preHeaderContent.length > 0 && !currentSection) {
        const headerAndSummary = separateHeaderFromSummary(preHeaderContent, preHeaderStartLine);
        sections.push(...headerAndSummary);
        preHeaderContent = [];
      }

      // Close previous section
      if (currentSection) {
        currentSection.endLine = i - 1;
        if (currentSection.content && currentSection.content.length > 0) {
          sections.push(currentSection as ParsedSection);
        }
      }

      // Start new section
      currentSection = {
        type: sectionType,
        content: [],
        startLine: i,
        endLine: i
      };
    } else if (currentSection) {
      // Add content to current section
      currentSection.content!.push(line);
    } else {
      // Accumulate content before any section header
      if (preHeaderContent.length === 0) {
        preHeaderStartLine = i;
      }
      preHeaderContent.push(line);
    }
  }

  // Process any remaining pre-header content
  if (preHeaderContent.length > 0 && !currentSection) {
    const headerAndSummary = separateHeaderFromSummary(preHeaderContent, preHeaderStartLine);
    sections.push(...headerAndSummary);
  }

  // Close final section
  if (currentSection && currentSection.content && currentSection.content.length > 0) {
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection as ParsedSection);
  }

  return sections;
}

/**
 * Separate header information from summary content in the opening section
 */
function separateHeaderFromSummary(content: string[], startLine: number): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const headerLines: string[] = [];
  const summaryLines: string[] = [];
  
  let headerEndLine = startLine - 1;
  let summaryStartLine = startLine;

  for (let i = 0; i < content.length; i++) {
    const line = content[i];
    const isHeader = isHeaderContent(line);
    
    // First few lines are more likely to be header, especially if they look like contact info
    const isEarlyLine = i < 4;
    const shouldBeHeader = isHeader || (isEarlyLine && (
      /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line.trim()) || // Name pattern
      line.length < 60 && !/^(summary|profile|objective|about)/i.test(line) // Short non-summary line
    ));

    if (shouldBeHeader) {
      headerLines.push(line);
      headerEndLine = startLine + i;
      if (summaryLines.length === 0) {
        summaryStartLine = startLine + i + 1;
      }
    } else {
      summaryLines.push(line);
    }
  }

  // Create header section if we have header content
  if (headerLines.length > 0) {
    sections.push({
      type: 'cv_header',
      content: headerLines,
      startLine: startLine,
      endLine: headerEndLine
    });
  }

  // Create summary section if we have summary content
  if (summaryLines.length > 0) {
    sections.push({
      type: 'cv_summary',
      content: summaryLines,
      startLine: summaryStartLine,
      endLine: startLine + content.length - 1
    });
  }

  return sections;
}

/**
 * Detect if a line is a section header
 */
function detectSectionHeader(line: string): ChunkType | null {
  // Check against known section patterns
  for (const [type, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(line)) {
      return type as ChunkType;
    }
  }

  // Check if line looks like a section header (short, title case, possibly with colon)
  if (line.length < 50 && 
      (line.endsWith(':') || /^[A-Z][a-z\s]+$/.test(line)) &&
      !line.includes('.') && 
      !line.includes(',')) {
    
    // Map common words to chunk types
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('skill')) return 'cv_skills';
    if (lowerLine.includes('experience') || lowerLine.includes('work')) return 'cv_experience_section';
    if (lowerLine.includes('education')) return 'cv_experience_section'; // Treat education as experience for now
    if (lowerLine.includes('project')) return 'cv_experience_section';
  }

  return null;
}

/**
 * Convert parsed sections into chunk objects
 */
function sectionsToChunks(sections: ParsedSection[], allLines: string[]): Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[] {
  const chunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[] = [];
  let chunkOrder = 1;

  for (const section of sections) {
    if (section.type === 'cv_header') {
      // Header is usually one chunk with contact info
      const headerText = section.content.join(' ').trim();
      if (headerText.length > 0) {
        chunks.push({
          type: 'cv_header',
          text: headerText,
          tags: extractTags(headerText, 'cv_header'),
          order: chunkOrder++,
          parsedBy: 'rules'
        });
      }
    } else if (section.type === 'cv_summary') {
      // Summary is usually one chunk
      const summaryText = section.content.join(' ').trim();
      if (summaryText.length > 0) {
        chunks.push({
          type: 'cv_summary',
          text: summaryText,
          tags: extractTags(summaryText, 'cv_summary'),
          order: chunkOrder++,
          parsedBy: 'rules'
        });
      }
    } else if (section.type === 'cv_skills') {
      // Skills can be broken down into individual items or groups
      const skillsText = section.content.join(' ');
      const skillChunks = parseSkillsSection(skillsText, chunkOrder);
      chunks.push(...skillChunks);
      chunkOrder += skillChunks.length;
    } else if (section.type === 'cv_experience_section' || section.content.some(line => PATTERNS.dateRange.test(line))) {
      // Experience sections - break into job headers and bullets
      const experienceChunks = parseExperienceSection(section.content, chunkOrder);
      chunks.push(...experienceChunks);
      chunkOrder += experienceChunks.length;
    } else {
      // Default: create one chunk for the section
      const sectionText = section.content.join('\n').trim();
      if (sectionText.length > 0) {
        chunks.push({
          type: section.type,
          text: sectionText,
          tags: extractTags(sectionText, section.type),
          order: chunkOrder++,
          parsedBy: 'rules'
        });
      }
    }
  }

  return chunks;
}

/**
 * Parse skills section into individual skill chunks
 */
function parseSkillsSection(text: string, startOrder: number): Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[] {
  const chunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[] = [];
  
  // Try to split by common delimiters
  const skillGroups = text.split(/[,;•·\n]/)
    .map(skill => skill.trim())
    .filter(skill => skill.length > 0 && skill.length < 100); // Reasonable length for skills

  if (skillGroups.length > 1) {
    // Multiple skill items
    skillGroups.forEach((skill, index) => {
      chunks.push({
        type: 'cv_skills',
        text: skill,
        tags: [skill.toLowerCase().replace(/\s+/g, '-')],
        order: startOrder + index,
        parsedBy: 'rules'
      });
    });
  } else {
    // Single skills chunk
    chunks.push({
      type: 'cv_skills',
      text: text.trim(),
      tags: extractTags(text, 'cv_skills'),
      order: startOrder,
      parsedBy: 'rules'
    });
  }

  return chunks;
}

/**
 * Parse experience section into job headers and bullet points
 */
function parseExperienceSection(content: string[], startOrder: number): Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[] {
  const chunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[] = [];
  let currentOrder = startOrder;
  let currentJob: string | null = null;

  for (const line of content) {
    // Check if this looks like a job title/company line
    if (PATTERNS.dateRange.test(line) || PATTERNS.jobTitle.test(line) || isJobHeader(line)) {
      currentJob = line;
      chunks.push({
        type: 'cv_experience_section',
        text: line,
        tags: extractTags(line, 'cv_experience_section'),
        order: currentOrder++,
        parsedBy: 'rules'
      });
    } 
    // Check if this is a bullet point
    else if (line.match(/^[\s]*[•·*\-+]/)) {
      const bulletText = line.replace(/^[\s]*[•·*\-+]\s*/, '').trim();
      chunks.push({
        type: 'cv_experience_bullet',
        text: bulletText,
        tags: extractTags(bulletText, 'cv_experience_bullet'),
        order: currentOrder++,
        parsedBy: 'rules'
      });
    }
    // Other experience content
    else if (line.trim().length > 0) {
      chunks.push({
        type: 'cv_experience_bullet',
        text: line.trim(),
        tags: extractTags(line, 'cv_experience_bullet'),
        order: currentOrder++,
        parsedBy: 'rules'
      });
    }
  }

  return chunks;
}

/**
 * Check if a line looks like a job header (title + company + dates)
 */
function isJobHeader(line: string): boolean {
  // Contains both job-like words and date patterns
  const hasJobWords = /\b(engineer|developer|manager|director|analyst|specialist|coordinator|assistant|lead|senior|junior|intern|contractor)\b/i.test(line);
  const hasCompanyIndicators = /\b(inc|llc|corp|company|technologies|systems|solutions|group|team)\b/i.test(line);
  const hasDates = PATTERNS.dateRange.test(line);
  
  return (hasJobWords || hasCompanyIndicators) && hasDates;
}

/**
 * Extract relevant tags from text based on chunk type
 */
function extractTags(text: string, type: ChunkType): string[] {
  const tags: string[] = [];
  const lowerText = text.toLowerCase();

  // Technology-related keywords
  const techKeywords = [
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
    'aws', 'azure', 'docker', 'kubernetes', 'sql', 'mongodb', 'postgresql', 'redis',
    'git', 'jenkins', 'terraform', 'linux', 'windows', 'macos', 'agile', 'scrum'
  ];

  // Skill-related keywords
  const skillKeywords = [
    'leadership', 'management', 'communication', 'teamwork', 'problem-solving',
    'analytical', 'creative', 'strategic', 'planning', 'organization', 'presentation'
  ];

  // Extract technology tags
  techKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      tags.push(keyword);
    }
  });

  // Extract skill tags
  if (type === 'cv_summary' || type === 'cv_skills') {
    skillKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        tags.push(keyword);
      }
    });
  }

  // Add contact-related tags for header
  if (type === 'cv_header') {
    if (PATTERNS.email.test(text)) tags.push('email');
    if (PATTERNS.phone.test(text)) tags.push('phone');
    if (/(linkedin|github|twitter)/i.test(text)) tags.push('social-media');
    if (/\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(text)) tags.push('location');
  }

  // Add type-specific tags
  if (type === 'cv_experience_bullet' && lowerText.includes('led')) {
    tags.push('leadership');
  }
  if (type === 'cv_experience_bullet' && lowerText.includes('developed')) {
    tags.push('development');
  }
  if (type === 'cv_experience_bullet' && lowerText.includes('managed')) {
    tags.push('management');
  }

  return Array.from(new Set(tags)); // Remove duplicates
}

/**
 * Get a human-readable summary of parsing results
 */
export function getParseResultSummary(result: PlainTextParseResult): string {
  if (!result.success) {
    return `Parsing failed: ${result.error}`;
  }

  const chunkCounts = result.chunks.reduce((counts, chunk) => {
    counts[chunk.type] = (counts[chunk.type] || 0) + 1;
    return counts;
  }, {} as Record<ChunkType, number>);

  const summary = Object.entries(chunkCounts)
    .map(([type, count]) => `${count} ${type.replace('_', ' ')}`)
    .join(', ');

  return `Found ${result.chunks.length} chunks: ${summary}`;
}