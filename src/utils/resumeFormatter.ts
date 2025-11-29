// Resume formatting and parsing utilities

export interface ParsedResume {
  header: {
    name: string;
    phone?: string;
    email?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  sections: {
    type: 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'other';
    title: string;
    content: string;
    items?: ResumeItem[];
  }[];
}

export interface ResumeItem {
  title: string;
  subtitle?: string;
  location?: string;
  dateRange?: string;
  description?: string[];
}

export interface ATSCheck {
  type: 'pass' | 'warning' | 'error';
  category: 'formatting' | 'content' | 'ats' | 'spelling';
  message: string;
  suggestion?: string;
}

// Common section patterns
const SECTION_PATTERNS = [
  { pattern: /^(experience|work\s+experience|professional\s+experience|employment)/i, type: 'experience' },
  { pattern: /^(education|academic\s+background)/i, type: 'education' },
  { pattern: /^(skills|technical\s+skills|core\s+competencies|expertise)/i, type: 'skills' },
  { pattern: /^(projects|relevant\s+projects|key\s+projects)/i, type: 'projects' },
  { pattern: /^(summary|professional\s+summary|profile|objective)/i, type: 'summary' },
  { pattern: /^(certifications|licenses|credentials)/i, type: 'certifications' },
];

// Email and phone patterns
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
const PHONE_PATTERN = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
const LINKEDIN_PATTERN = /(linkedin\.com\/in\/[a-zA-Z0-9-]+|linkedin\.com\/pub\/[a-zA-Z0-9-\/]+)/i;
const WEBSITE_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+\.[a-zA-Z]{2,})/i;

export function parseResumeText(rawText: string): ParsedResume {
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return {
      header: { name: '' },
      sections: []
    };
  }

  // Parse header information (usually first few lines)
  const header = parseHeader(lines.slice(0, 10));
  
  // Find section boundaries
  const sections = parseSections(lines);

  return {
    header,
    sections
  };
}

function parseHeader(headerLines: string[]): ParsedResume['header'] {
  const header: ParsedResume['header'] = {
    name: headerLines[0] || ''
  };

  // Look for contact information in first few lines
  for (const line of headerLines) {
    const emailMatch = line.match(EMAIL_PATTERN);
    if (emailMatch) {
      header.email = emailMatch[0];
    }

    const phoneMatch = line.match(PHONE_PATTERN);
    if (phoneMatch) {
      header.phone = phoneMatch[0];
    }

    const linkedinMatch = line.match(LINKEDIN_PATTERN);
    if (linkedinMatch) {
      header.linkedin = linkedinMatch[0];
    }

    const websiteMatch = line.match(WEBSITE_PATTERN);
    if (websiteMatch && !linkedinMatch) {
      header.website = websiteMatch[0];
    }

    // Simple location detection (city, state or city, country patterns)
    if (!header.location && /^[A-Za-z\s]+,\s*[A-Za-z\s]+$/.test(line) && 
        !emailMatch && !phoneMatch && !linkedinMatch && !websiteMatch) {
      header.location = line;
    }
  }

  return header;
}

function parseSections(lines: string[]): ParsedResume['sections'] {
  const sections: ParsedResume['sections'] = [];
  let currentSection: ParsedResume['sections'][0] | null = null;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip header lines (first few lines that look like contact info)
    if (i < 5 && (EMAIL_PATTERN.test(line) || PHONE_PATTERN.test(line) || line === lines[0])) {
      continue;
    }

    // Check if this line is a section header
    const sectionMatch = SECTION_PATTERNS.find(pattern => pattern.pattern.test(line));
    
    if (sectionMatch || isLikelySectionHeader(line)) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        currentSection.items = parseItemsFromContent(currentSection.content, currentSection.type);
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        type: sectionMatch?.type as any || 'other',
        title: line,
        content: '',
        items: []
      };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection) {
    currentSection.content = currentContent.join('\n');
    currentSection.items = parseItemsFromContent(currentSection.content, currentSection.type);
    sections.push(currentSection);
  }

  return sections;
}

function isLikelySectionHeader(line: string): boolean {
  // Section headers are usually:
  // - Short (< 50 characters)
  // - ALL CAPS or Title Case
  // - Don't contain common sentence patterns
  if (line.length > 50) return false;
  if (line.includes('.') && !line.endsWith('.')) return false; // URLs or decimals
  if (/\d{4}[-–]\d{4}|\d{4}[-–]present/i.test(line)) return false; // Date ranges
  
  // Check if it's likely a title
  const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
  const isTitleCase = line.split(' ').every(word => 
    word.length === 0 || word[0] === word[0].toUpperCase()
  );
  
  return isAllCaps || isTitleCase;
}

function parseItemsFromContent(content: string, sectionType: string): ResumeItem[] {
  const lines = content.split('\n').filter(line => line.trim());
  
  if (sectionType === 'skills') {
    return parseSkillsItems(lines);
  } else if (sectionType === 'experience' || sectionType === 'education' || sectionType === 'projects') {
    return parseStructuredItems(lines);
  }
  
  return [];
}

function parseSkillsItems(lines: string[]): ResumeItem[] {
  // Skills can be comma-separated, bullet points, or categorized
  const skills: string[] = [];
  
  for (const line of lines) {
    if (line.includes(',')) {
      skills.push(...line.split(',').map(s => s.trim()));
    } else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      skills.push(line.replace(/^[•\-*]\s*/, '').trim());
    } else {
      skills.push(line.trim());
    }
  }
  
  return skills.map(skill => ({ title: skill }));
}

function parseStructuredItems(lines: string[]): ResumeItem[] {
  const items: ResumeItem[] = [];
  let currentItem: Partial<ResumeItem> | null = null;
  
  for (const line of lines) {
    // Look for date patterns to identify new items
    const dateMatch = line.match(/(\d{4}[-–]\d{4}|\d{4}[-–]present|\w+\s+\d{4}[-–]\w+\s+\d{4})/i);
    
    if (dateMatch || isLikelyItemHeader(line)) {
      // Save previous item
      if (currentItem && currentItem.title) {
        items.push(currentItem as ResumeItem);
      }
      
      // Start new item
      const itemTitle = line.replace(dateMatch?.[0] || '', '').trim();
      currentItem = {
        title: itemTitle,
        dateRange: dateMatch?.[0],
        description: []
      };
      
      // Try to extract subtitle (company/school) from the title line
      const parts = itemTitle.split(/\s+at\s+|\s+[-–]\s+|\s+\|\s+/i);
      if (parts.length > 1) {
        currentItem.title = parts[0].trim();
        currentItem.subtitle = parts[1].trim();
      }
    } else if (currentItem) {
      // Add to description
      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        if (!currentItem.description) currentItem.description = [];
        currentItem.description.push(line.replace(/^[•\-*]\s*/, '').trim());
      } else if (line.length > 10) { // Avoid adding short fragments
        if (!currentItem.description) currentItem.description = [];
        currentItem.description.push(line);
      }
    }
  }
  
  // Don't forget the last item
  if (currentItem && currentItem.title) {
    items.push(currentItem as ResumeItem);
  }
  
  return items;
}

function isLikelyItemHeader(line: string): boolean {
  // Item headers often contain job titles, company names, or degree titles
  // They're usually longer than section headers but not too long
  if (line.length < 10 || line.length > 100) return false;
  
  // Common patterns
  if (/\b(manager|engineer|developer|analyst|specialist|coordinator|director|senior|junior|lead)\b/i.test(line)) {
    return true;
  }
  
  if (/\b(bachelor|master|phd|associate|certificate|diploma)\b/i.test(line)) {
    return true;
  }
  
  return false;
}

export function formatAsHTML(parsedResume: ParsedResume): string {
  let html = '<div class="formatted-resume">\n';
  
  // Header
  html += '  <div class="resume-header">\n';
  html += `    <div class="resume-name">${escapeHtml(parsedResume.header.name)}</div>\n`;
  
  if (parsedResume.header.phone || parsedResume.header.email || parsedResume.header.location) {
    html += '    <div class="resume-contact">\n';
    const contactItems = [
      parsedResume.header.phone,
      parsedResume.header.email,
      parsedResume.header.location,
      parsedResume.header.linkedin,
      parsedResume.header.website
    ].filter(Boolean);
    html += `      ${contactItems.join(' • ')}\n`;
    html += '    </div>\n';
  }
  html += '  </div>\n\n';
  
  // Sections
  for (const section of parsedResume.sections) {
    html += `  <div class="resume-section">\n`;
    html += `    <div class="section-title">${escapeHtml(section.title)}</div>\n`;
    
    if (section.type === 'skills' && section.items) {
      html += '    <div class="skills-list">\n';
      for (const skill of section.items) {
        html += `      <span class="skill-item">${escapeHtml(skill.title)}</span>\n`;
      }
      html += '    </div>\n';
    } else if (section.items && section.items.length > 0) {
      for (const item of section.items) {
        const className = section.type === 'education' ? 'education-item' : 'experience-item';
        html += `    <div class="${className}">\n`;
        html += '      <div class="item-header">\n';
        html += '        <div>\n';
        html += `          <div class="job-title">${escapeHtml(item.title)}</div>\n`;
        if (item.subtitle) {
          html += `          <div class="company-name">${escapeHtml(item.subtitle)}</div>\n`;
        }
        html += '        </div>\n';
        if (item.dateRange) {
          html += `        <div class="date-range">${escapeHtml(item.dateRange)}</div>\n`;
        }
        html += '      </div>\n';
        
        if (item.description && item.description.length > 0) {
          html += '      <div class="description">\n';
          for (const desc of item.description) {
            html += `        <div>• ${escapeHtml(desc)}</div>\n`;
          }
          html += '      </div>\n';
        }
        html += '    </div>\n';
      }
    } else {
      // Plain text content
      html += `    <div class="section-content">${escapeHtml(section.content).replace(/\n/g, '<br>')}</div>\n`;
    }
    
    html += '  </div>\n\n';
  }
  
  html += '</div>';
  return html;
}

export function performATSChecks(parsedResume: ParsedResume, rawText: string): ATSCheck[] {
  const checks: ATSCheck[] = [];
  
  // Check for contact information
  if (!parsedResume.header.email) {
    checks.push({
      type: 'error',
      category: 'content',
      message: 'Missing email address',
      suggestion: 'Add a professional email address to your resume header'
    });
  }
  
  if (!parsedResume.header.phone) {
    checks.push({
      type: 'warning',
      category: 'content',
      message: 'Missing phone number',
      suggestion: 'Consider adding a phone number for easy contact'
    });
  }
  
  // Check for essential sections
  const hasExperience = parsedResume.sections.some(s => s.type === 'experience');
  const hasEducation = parsedResume.sections.some(s => s.type === 'education');
  const hasSkills = parsedResume.sections.some(s => s.type === 'skills');
  
  if (!hasExperience) {
    checks.push({
      type: 'warning',
      category: 'content',
      message: 'No experience section detected',
      suggestion: 'Add a work experience or professional experience section'
    });
  }
  
  if (!hasEducation) {
    checks.push({
      type: 'warning',
      category: 'content',
      message: 'No education section detected',
      suggestion: 'Add an education section with your degrees/certifications'
    });
  }
  
  if (!hasSkills) {
    checks.push({
      type: 'warning',
      category: 'content',
      message: 'No skills section detected',
      suggestion: 'Add a skills section to highlight your technical abilities'
    });
  }
  
  // ATS-friendly formatting checks
  if (rawText.includes('\t')) {
    checks.push({
      type: 'warning',
      category: 'ats',
      message: 'Contains tab characters',
      suggestion: 'Use spaces instead of tabs for better ATS compatibility'
    });
  }
  
  // Check for unusual characters
  if (/[^\x00-\x7F]/.test(rawText)) {
    checks.push({
      type: 'warning',
      category: 'ats',
      message: 'Contains non-ASCII characters',
      suggestion: 'Consider using standard ASCII characters for better ATS parsing'
    });
  }
  
  // Length check
  if (rawText.length < 500) {
    checks.push({
      type: 'warning',
      category: 'content',
      message: 'Resume appears very short',
      suggestion: 'Consider expanding your resume with more details about your experience'
    });
  }
  
  // Basic spell check using simple patterns
  const commonMisspellings = {
    'managment': 'management',
    'recieve': 'receive',
    'seperate': 'separate',
    'definately': 'definitely',
    'experiance': 'experience',
    'responsability': 'responsibility'
  };
  
  for (const [wrong, correct] of Object.entries(commonMisspellings)) {
    if (rawText.toLowerCase().includes(wrong)) {
      checks.push({
        type: 'error',
        category: 'spelling',
        message: `Possible misspelling: "${wrong}"`,
        suggestion: `Did you mean "${correct}"?`
      });
    }
  }
  
  // Success messages
  if (parsedResume.header.email && parsedResume.header.phone) {
    checks.push({
      type: 'pass',
      category: 'content',
      message: 'Complete contact information provided'
    });
  }
  
  if (hasExperience && hasEducation && hasSkills) {
    checks.push({
      type: 'pass',
      category: 'content',
      message: 'All essential resume sections present'
    });
  }
  
  return checks;
}

export function formatAsRTF(parsedResume: ParsedResume): string {
  let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';
  
  // Header
  rtf += `\\f0\\fs28\\b ${escapeRtf(parsedResume.header.name)}\\b0\\par`;
  rtf += '\\fs20\\par'; // Add space
  
  if (parsedResume.header.phone || parsedResume.header.email || parsedResume.header.location) {
    const contactItems = [
      parsedResume.header.phone,
      parsedResume.header.email,
      parsedResume.header.location,
      parsedResume.header.linkedin,
      parsedResume.header.website
    ].filter(Boolean);
    rtf += `\\fs18 ${escapeRtf(contactItems.join(' • '))}\\par`;
  }
  rtf += '\\par'; // Add space after header
  
  // Sections
  for (const section of parsedResume.sections) {
    rtf += `\\fs20\\b ${escapeRtf(section.title)}\\b0\\par`;
    rtf += '\\par';
    
    if (section.type === 'skills' && section.items) {
      const skills = section.items.map(skill => skill.title).join(', ');
      rtf += `\\fs18 ${escapeRtf(skills)}\\par`;
    } else if (section.items) {
      for (const item of section.items) {
        rtf += `\\fs18\\b ${escapeRtf(item.title)}\\b0`;
        if (item.subtitle || item.location || item.dateRange) {
          const details = [item.subtitle, item.location, item.dateRange].filter(Boolean);
          rtf += ` - ${escapeRtf(details.join(' | '))}`;
        }
        rtf += '\\par';
        
        if (item.description && item.description.length > 0) {
          for (const desc of item.description) {
            rtf += `\\fs18 • ${escapeRtf(desc)}\\par`;
          }
        }
        rtf += '\\par';
      }
    } else if (section.content) {
      const paragraphs = section.content.split('\n').filter(p => p.trim());
      for (const paragraph of paragraphs) {
        rtf += `\\fs18 ${escapeRtf(paragraph)}\\par`;
      }
    }
    rtf += '\\par';
  }
  
  rtf += '}';
  return rtf;
}

function escapeRtf(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\par ')
    .replace(/\r/g, '');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}