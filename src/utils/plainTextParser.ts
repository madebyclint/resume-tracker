// Plain text parsing utilities for extracting text content from documents
// This version focuses on text extraction without chunking functionality

export interface PlainTextParseResult {
  text: string;
  success: boolean;
  error?: string;
  metadata?: {
    detectedCompany?: string;
    detectedRole?: string;
    wordCount?: number;
    lineCount?: number;
  };
}

/**
 * Parse resume text and extract basic information
 */
export function parseResumeWithRules(text: string): PlainTextParseResult {
  if (!text || text.trim().length === 0) {
    return {
      text: '',
      success: false,
      error: 'No text content provided'
    };
  }

  try {
    // Clean up the text
    const cleanedText = cleanText(text);
    
    // Extract basic metadata
    const metadata = {
      wordCount: cleanedText.split(/\s+/).filter(word => word.length > 0).length,
      lineCount: cleanedText.split('\n').length
    };

    return {
      text: cleanedText,
      success: true,
      metadata
    };
  } catch (error) {
    console.error('Error parsing resume text:', error);
    return {
      text: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Parse cover letter text and extract basic information
 */
export function parseCoverLetterWithRules(text: string): PlainTextParseResult {
  if (!text || text.trim().length === 0) {
    return {
      text: '',
      success: false,
      error: 'No text content provided'
    };
  }

  try {
    // Clean up the text
    const cleanedText = cleanText(text);
    
    // Try to detect company and role from cover letter content
    const detectedCompany = extractCompanyFromCoverLetter(cleanedText);
    const detectedRole = extractRoleFromCoverLetter(cleanedText);
    
    // Extract basic metadata
    const metadata = {
      detectedCompany,
      detectedRole,
      wordCount: cleanedText.split(/\s+/).filter(word => word.length > 0).length,
      lineCount: cleanedText.split('\n').length
    };

    return {
      text: cleanedText,
      success: true,
      metadata
    };
  } catch (error) {
    console.error('Error parsing cover letter text:', error);
    return {
      text: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove multiple consecutive newlines
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove leading/trailing whitespace
    .trim();
}

/**
 * Extract company name from cover letter text using simple pattern matching
 */
function extractCompanyFromCoverLetter(text: string): string | undefined {
  const patterns = [
    // "Dear [Company] Team" or "Dear [Company] Hiring Manager"
    /dear\s+([A-Z][a-zA-Z\s&.,'-]+?)\s+(team|hiring\s+manager|recruiter)/i,
    // "I am writing to express my interest in joining [Company]"
    /joining\s+([A-Z][a-zA-Z\s&.,'-]+?)[\s.,]/i,
    // "I am excited about the opportunity at [Company]"
    /opportunity\s+at\s+([A-Z][a-zA-Z\s&.,'-]+?)[\s.,]/i,
    // "[Company]'s mission" or "[Company]'s values"
    /([A-Z][a-zA-Z\s&.,'-]+?)['']s\s+(mission|values|culture|team)/i,
    // "working at [Company]"
    /working\s+at\s+([A-Z][a-zA-Z\s&.,'-]+?)[\s.,]/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const company = match[1].trim();
      // Filter out common false positives
      if (company.length > 2 && company.length < 50 && 
          !['Dear', 'The', 'Your', 'This', 'That'].includes(company)) {
        return company;
      }
    }
  }

  return undefined;
}

/**
 * Extract job role from cover letter text using simple pattern matching
 */
function extractRoleFromCoverLetter(text: string): string | undefined {
  const patterns = [
    // "applying for the [Role] position"
    /applying\s+for\s+the\s+([a-zA-Z\s-]+?)\s+position/i,
    // "interest in the [Role] role"
    /interest\s+in\s+the\s+([a-zA-Z\s-]+?)\s+role/i,
    // "[Role] position at"
    /([a-zA-Z\s-]+?)\s+position\s+at/i,
    // "for the [Role] opening"
    /for\s+the\s+([a-zA-Z\s-]+?)\s+opening/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const role = match[1].trim();
      // Filter out common false positives and ensure reasonable length
      if (role.length > 5 && role.length < 80 && 
          !['position', 'opportunity', 'opening', 'role'].includes(role.toLowerCase())) {
        return role;
      }
    }
  }

  return undefined;
}

/**
 * Get a summary of the parse result
 */
export function getParseResultSummary(result: PlainTextParseResult): string {
  if (!result.success) {
    return `Parsing failed: ${result.error}`;
  }

  const { metadata } = result;
  if (!metadata) {
    return 'Text parsed successfully';
  }

  let summary = `Parsed ${metadata.wordCount || 0} words`;
  
  if (metadata.detectedCompany) {
    summary += `, Company: ${metadata.detectedCompany}`;
  }
  
  if (metadata.detectedRole) {
    summary += `, Role: ${metadata.detectedRole}`;
  }

  return summary;
}