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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sectionType = detectSectionHeader(line);

    if (sectionType) {
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
      // Content before any section header - treat as summary
      if (!sections.find(s => s.type === 'summary')) {
        sections.push({
          type: 'summary',
          content: [line],
          startLine: 0,
          endLine: i
        });
      } else {
        // Add to existing summary
        const summarySection = sections.find(s => s.type === 'summary');
        if (summarySection) {
          summarySection.content.push(line);
          summarySection.endLine = i;
        }
      }
    }
  }

  // Close final section
  if (currentSection && currentSection.content && currentSection.content.length > 0) {
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection as ParsedSection);
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
    if (lowerLine.includes('skill')) return 'skills';
    if (lowerLine.includes('experience') || lowerLine.includes('work')) return 'experience_section';
    if (lowerLine.includes('education')) return 'experience_section'; // Treat education as experience for now
    if (lowerLine.includes('project')) return 'experience_section';
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
    if (section.type === 'summary') {
      // Summary is usually one chunk
      const summaryText = section.content.join(' ').trim();
      if (summaryText.length > 0) {
        chunks.push({
          type: 'summary',
          text: summaryText,
          tags: extractTags(summaryText, 'summary'),
          order: chunkOrder++
        });
      }
    } else if (section.type === 'skills') {
      // Skills can be broken down into individual items or groups
      const skillsText = section.content.join(' ');
      const skillChunks = parseSkillsSection(skillsText, chunkOrder);
      chunks.push(...skillChunks);
      chunkOrder += skillChunks.length;
    } else if (section.type === 'experience_section' || section.content.some(line => PATTERNS.dateRange.test(line))) {
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
          order: chunkOrder++
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
        type: 'skills',
        text: skill,
        tags: [skill.toLowerCase().replace(/\s+/g, '-')],
        order: startOrder + index
      });
    });
  } else {
    // Single skills chunk
    chunks.push({
      type: 'skills',
      text: text.trim(),
      tags: extractTags(text, 'skills'),
      order: startOrder
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
        type: 'experience_section',
        text: line,
        tags: extractTags(line, 'experience_section'),
        order: currentOrder++
      });
    } 
    // Check if this is a bullet point
    else if (line.match(/^[\s]*[•·*\-+]/)) {
      const bulletText = line.replace(/^[\s]*[•·*\-+]\s*/, '').trim();
      chunks.push({
        type: 'experience_bullet',
        text: bulletText,
        tags: extractTags(bulletText, 'experience_bullet'),
        order: currentOrder++
      });
    }
    // Other experience content
    else if (line.trim().length > 0) {
      chunks.push({
        type: 'experience_bullet',
        text: line.trim(),
        tags: extractTags(line, 'experience_bullet'),
        order: currentOrder++
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
  if (type === 'summary' || type === 'skills') {
    skillKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        tags.push(keyword);
      }
    });
  }

  // Add type-specific tags
  if (type === 'experience_bullet' && lowerText.includes('led')) {
    tags.push('leadership');
  }
  if (type === 'experience_bullet' && lowerText.includes('developed')) {
    tags.push('development');
  }
  if (type === 'experience_bullet' && lowerText.includes('managed')) {
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