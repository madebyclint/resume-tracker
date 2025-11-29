/**
 * CSV Parser utility for job applications
 * Handles parsing CSV files and converting them to JobDescription objects
 */

import { JobDescription } from '../types';

export interface CSVJobApplication {
  date: string;
  id: string;
  source: string;
  company: string;
  impact: string;
  discipline: string;
  status: string;
  contactLink: string;
  secondContactLink?: string;
}

export interface CSVParseResult {
  success: boolean;
  data: CSVJobApplication[];
  errors: string[];
  preview?: string;
}

/**
 * Parse CSV text into job application data
 */
export function parseCSV(csvText: string): CSVParseResult {
  const errors: string[] = [];
  const data: CSVJobApplication[] = [];
  
  try {
    const lines = csvText.trim().split('\n');
    
    if (lines.length < 2) {
      return {
        success: false,
        data: [],
        errors: ['CSV file must have at least a header row and one data row']
      };
    }

    // Parse header
    const headers = parseCSVLine(lines[0]);
    const expectedHeaders = ['Date', 'ID', 'Source', 'Company', 'Impact', 'Discipline', 'Status', 'Contact/Link', 'Second Contact/Link'];
    
    // Validate headers (case insensitive)
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
    const normalizedExpected = expectedHeaders.map(h => h.toLowerCase());
    
    for (const expected of normalizedExpected.slice(0, 8)) { // First 8 are required
      if (!normalizedHeaders.includes(expected)) {
        errors.push(`Missing required column: ${expected}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        data: [],
        errors
      };
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line || line.split(',').every(cell => !cell.trim())) {
        continue;
      }

      const cells = parseCSVLine(line);
      
      // Skip if not enough cells for required columns
      if (cells.length < 8) {
        errors.push(`Row ${i + 1}: Not enough columns (expected at least 8, got ${cells.length})`);
        continue;
      }

      // Skip if both company and discipline are empty (need at least one identifier)
      if (!cells[3]?.trim() && !cells[5]?.trim()) {
        continue; // Skip entries with no company or role
      }

      const jobApp: CSVJobApplication = {
        date: cells[0]?.trim() || '',
        id: cells[1]?.trim() || '',
        source: cells[2]?.trim() || '',
        company: cells[3]?.trim() || '',
        impact: cells[4]?.trim() || '',
        discipline: cells[5]?.trim() || '',
        status: cells[6]?.trim() || '',
        contactLink: cells[7]?.trim() || '',
        secondContactLink: cells[8]?.trim() || undefined
      };

      data.push(jobApp);
    }

    return {
      success: true,
      data,
      errors,
      preview: generatePreview(data)
    };

  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Handle escaped quotes
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current); // Add the last field
  return result;
}

/**
 * Generate a preview string of the parsed data
 */
function generatePreview(data: CSVJobApplication[]): string {
  if (data.length === 0) return 'No valid job applications found.';
  
  const preview = data.slice(0, 3).map(job => 
    `• ${job.company} - ${job.discipline} (${job.status})`
  ).join('\n');
  
  const remaining = data.length - 3;
  return preview + (remaining > 0 ? `\n... and ${remaining} more` : '');
}

/**
 * Convert CSV job applications to JobDescription objects
 */
export function convertToJobDescriptions(csvData: CSVJobApplication[]): JobDescription[] {
  return csvData.map(job => {
    // Create a job description from the CSV data
    const rawText = createJobDescriptionText(job);
    
    const applicationDate = parseApplicationDate(job.date);
    const status = mapStatus(job.status);
    
    const jobDescription: JobDescription = {
      id: crypto.randomUUID(),
      title: job.discipline || 'Unknown Position',
      company: job.company || 'Unknown Company',
      url: job.contactLink || undefined,
      rawText,
      additionalContext: createAdditionalContext(job),
      extractedInfo: {
        role: job.discipline || undefined,
        company: job.company || undefined,
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        requirements: []
      },
      keywords: extractKeywords(job),
      uploadDate: new Date().toISOString(),
      linkedResumeIds: [],
      linkedCoverLetterIds: [],
      
      // CRM fields
      applicationStatus: status,
      applicationDate,
      submissionDate: applicationDate,
      lastActivityDate: applicationDate || new Date().toISOString(),
      source: job.source || undefined,
      contactPerson: extractContactPerson(job.contactLink),
      secondaryContact: job.secondContactLink || undefined,
      priority: job.impact === 'Yes' ? 'high' : job.impact === 'Yes??' ? 'medium' : 'low',
      notes: createNotes(job),
      
      // Status history
      statusHistory: applicationDate ? [{
        status,
        date: applicationDate,
        notes: `Imported from CSV - ${job.source || 'Unknown source'}`
      }] : undefined,
      
      // Computed fields
      daysSinceApplication: applicationDate ? calculateDaysSince(applicationDate) : undefined,
      daysInCurrentStatus: applicationDate ? calculateDaysSince(applicationDate) : undefined
    };

    return jobDescription;
  });
}

/**
 * Create job description text from CSV data
 */
function createJobDescriptionText(job: CSVJobApplication): string {
  return `Position: ${job.discipline}
Company: ${job.company}
Source: ${job.source}
Application Date: ${job.date}
Impact Level: ${job.impact}

Contact Information:
${job.contactLink}
${job.secondContactLink ? `Additional Contact: ${job.secondContactLink}` : ''}

Status: ${job.status}`;
}

/**
 * Create additional context from CSV data
 */
function createAdditionalContext(job: CSVJobApplication): string {
  const context: string[] = [];
  
  if (job.source) {
    context.push(`Found via: ${job.source}`);
  }
  
  if (job.impact && job.impact !== 'No') {
    context.push(`Impact focus: ${job.impact === 'Yes' ? 'High impact role' : job.impact}`);
  }
  
  if (job.id) {
    context.push(`Application ID: ${job.id}`);
  }

  return context.join('\n');
}

/**
 * Extract keywords from job data
 */
function extractKeywords(job: CSVJobApplication): string[] {
  const keywords: string[] = [];
  
  // Add company name
  if (job.company) {
    keywords.push(job.company.toLowerCase());
  }
  
  // Add discipline/role
  if (job.discipline) {
    keywords.push(job.discipline.toLowerCase());
    
    // Add common variations
    const role = job.discipline.toLowerCase();
    if (role.includes('frontend') || role.includes('fe dev')) {
      keywords.push('frontend', 'react', 'javascript', 'typescript');
    }
    if (role.includes('ux engineer') || role.includes('ux')) {
      keywords.push('ux', 'ui', 'design', 'user experience');
    }
    if (role.includes('software engineer')) {
      keywords.push('software', 'engineer', 'development', 'programming');
    }
    if (role.includes('mendix')) {
      keywords.push('mendix', 'low-code', 'platform');
    }
    if (role.includes('tpm') || role.includes('technical program manager')) {
      keywords.push('tpm', 'program management', 'technical management');
    }
  }
  
  // Add source
  if (job.source) {
    keywords.push(job.source.toLowerCase());
  }

  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Map CSV status to JobDescription status
 */
function mapStatus(csvStatus: string): JobDescription['applicationStatus'] {
  const status = csvStatus.toLowerCase().trim();
  
  switch (status) {
    case 'submitted':
      return 'applied';
    case 'interviewed':
    case 'interviewing':
      return 'interviewing';
    case 'rejected':
      return 'rejected';
    case 'offered':
      return 'offered';
    default:
      return 'applied'; // Default for most cases
  }
}

/**
 * Parse application date from CSV format
 */
function parseApplicationDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  
  try {
    // Handle format like "11/21/25 (Fri)"
    const cleanDate = dateStr.replace(/\s*\([^)]*\)/, '').trim();
    
    // Try to parse MM/DD/YY format
    const parts = cleanDate.split('/');
    if (parts.length === 3) {
      let [month, day, year] = parts;
      
      // Convert 2-digit year to 4-digit
      if (year.length === 2) {
        const yearNum = parseInt(year);
        year = yearNum > 50 ? `19${year}` : `20${year}`;
      }
      
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toISOString();
    }
  } catch (error) {
    console.warn('Could not parse date:', dateStr);
  }
  
  return undefined;
}

/**
 * Create notes from CSV data
 */
function createNotes(job: CSVJobApplication): string {
  const notes: string[] = [];
  
  if (job.source && job.source !== 'LinkedIn' && job.source !== 'Indeed') {
    notes.push(`Source: ${job.source}`);
  }
  
  if (job.impact === 'Yes') {
    notes.push('High impact opportunity');
  } else if (job.impact && job.impact !== 'No') {
    notes.push(`Impact: ${job.impact}`);
  }
  
  if (job.secondContactLink) {
    notes.push(`Additional contact: ${job.secondContactLink}`);
  }

  return notes.join('\n');
}

/**
 * Extract contact person from contact link
 */
function extractContactPerson(contactLink: string): string | undefined {
  if (!contactLink) return undefined;
  
  // Try to extract names from LinkedIn URLs or contact info
  if (contactLink.includes('linkedin.com')) {
    // Extract name from LinkedIn URL or text
    const nameMatch = contactLink.match(/\/in\/([^\/\?]+)/);
    if (nameMatch) {
      return nameMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  
  // Look for names in the contact string (simple heuristic)
  const namePattern = /([A-Z][a-z]+ [A-Z][a-z]+)/;
  const match = contactLink.match(namePattern);
  if (match) {
    return match[1];
  }
  
  return undefined;
}

/**
 * Calculate days since a date
 */
function calculateDaysSince(dateStr: string): number {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}