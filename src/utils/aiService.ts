import { JobDescription } from '../types';
import { extractKeywordsFromText } from './documentMatcher';

// AI Configuration
interface AIConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}

// Interface for AI-detected document metadata
interface DocumentMetadata {
  detectedCompany?: string;
  detectedRole?: string;
  confidence?: number;
  success: boolean;
  error?: string;
}

// Get AI configuration from environment variables
function getAIConfig(): AIConfig {
  return {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    apiUrl: import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo'
  };
}

// Check if AI is properly configured
export function isAIConfigured(): boolean {
  const config = getAIConfig();
  return !!(config.apiKey && config.apiUrl && config.apiKey !== 'your_openai_api_key_here');
}

// Fetch and extract text content from a URL
export async function fetchJobDescriptionFromURL(url: string): Promise<{
  success: boolean;
  title?: string;
  company?: string;
  text?: string;
  error?: string;
  corsBlocked?: boolean;
}> {
  try {
    // Basic URL validation
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        success: false,
        error: 'Only HTTP and HTTPS URLs are supported'
      };
    }

    // Check if this is a known problematic domain
    const hostname = urlObj.hostname.toLowerCase();
    const corsBlockedDomains = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com'];
    
    if (corsBlockedDomains.some(domain => hostname.includes(domain))) {
      return {
        success: false,
        corsBlocked: true,
        error: `CORS blocked: ${hostname} doesn't allow direct browser access. Please copy and paste the job description text manually.`
      };
    }

    // Try to fetch with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResumeTracker/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch URL: ${response.status} ${response.statusText}`
        };
      }

      const html = await response.text();
      
      // Extract text content from HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Remove script and style elements
      const scripts = doc.querySelectorAll('script, style, nav, header, footer');
      scripts.forEach(el => el.remove());
      
      // Try to extract title and company from common patterns
      let title = '';
      let company = '';
      
      // Try to get title from page title or h1 elements
      const pageTitle = doc.title;
      const h1Elements = doc.querySelectorAll('h1');
      
      if (h1Elements.length > 0) {
        title = h1Elements[0].textContent?.trim() || '';
      } else if (pageTitle) {
        // Extract job title from page title (common patterns)
        const titleMatch = pageTitle.match(/^([^|]*?)(?:\s*[-|]\s*([^|]*?))?(?:\s*[-|]\s*.*)?$/);
        if (titleMatch) {
          title = titleMatch[1]?.trim() || '';
          company = titleMatch[2]?.trim() || '';
        }
      }
      
      // Get main content text
      const bodyText = doc.body?.textContent || '';
      
      // Clean up the text
      const cleanText = bodyText
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/\n\s*\n/g, '\n\n')  // Normalize line breaks
        .trim();

      return {
        success: true,
        title: title || undefined,
        company: company || undefined,
        text: cleanText
      };
    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    // Check if it's a CORS error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        corsBlocked: true,
        error: 'CORS blocked: This website doesn\'t allow direct browser access. Please copy and paste the job description text manually.'
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch URL'
    };
  }
}

// Get configuration status for user feedback
export function getConfigurationStatus(): { configured: boolean; message: string } {
  const config = getAIConfig();
  
  if (!config.apiKey) {
    return {
      configured: false,
      message: 'OpenAI API key not found. Please add VITE_OPENAI_API_KEY to your .env file.'
    };
  }
  
  if (config.apiKey === 'your_openai_api_key_here') {
    return {
      configured: false,
      message: 'Please replace the placeholder API key in your .env file with your actual OpenAI API key.'
    };
  }
  
  return {
    configured: true,
    message: 'AI service is properly configured.'
  };
}



// Prompt for AI to parse job descriptions and extract key information
const JOB_DESCRIPTION_PARSING_PROMPT = `You are a precise job posting analyzer. Your task is to extract ONLY information that is explicitly stated in the job description text. DO NOT hallucinate or infer information that is not clearly present.

CRITICAL RULES:
1. Extract ONLY what is explicitly mentioned in the text
2. Use empty arrays for missing information - DO NOT make up skills or requirements
3. If salary/location/department is not mentioned, leave those fields empty
4. Be conservative - better to miss information than to hallucinate it
5. ALWAYS convert hourly rates to annual salaries (multiply by 2080 hours)
6. Clean up location formatting (remove extra spaces, standardize format)

Extract the following information:
- role: Exact job title as stated (or empty string if unclear)
- company: Exact company name if mentioned (or empty string)
- companyDescription: Generate a brief 1-2 sentence AI summary of the company based on any information mentioned in the job description (company mission, industry, size, culture, products, recent news, etc.). If no company information is provided, leave empty string
- location: Clean location format - remove work arrangement suffixes like "-Hybrid", "-Remote". For "manhattan, NY -Hybrid" return "Manhattan, NY" and set workArrangement to "hybrid"
- workArrangement: Work type if mentioned - look for keywords like "remote", "hybrid", "office", "on-site", "work from home", "WFH", "workplace type", or location suffixes like "-Hybrid", "-Remote" - return exactly "remote", "hybrid", or "office"
- salaryRange: Process salary information intelligently:
  * For hourly rates (e.g. "$75/hr", "$50/hour"), convert to annual by multiplying by 2080 (40 hours × 52 weeks)
  * For "$75/hr as W2" format this as "$156,000/year" (75 × 2080 = 156,000)
  * Keep original format for annual salaries
  * Include employment type context if mentioned (W2, 1099, contractor, etc.)
- jobUrl: Any URLs found in the text (LinkedIn, company careers page, etc.)
- applicationId: Look for "Application ID:" followed by numbers or text, extract the ID value
- applicantCount: Look for applicant/application count information (e.g., "100+ applicants", "50 applications", "Be among the first 10 applicants")
- requiredSkills: Array of skills/technologies explicitly listed as "required" or "must have"
- preferredSkills: Array of skills/technologies listed as "preferred", "nice to have", or "bonus"
- responsibilities: Key responsibilities as explicitly stated (limit to 5-8 main points)
- requirements: Education, experience, and other requirements as explicitly stated

KEYWORD EXTRACTION: Generate comprehensive keywords from ALL relevant terms mentioned in the text, including:
- Technologies (JavaScript, React, AWS, Mendix, Salesforce, etc.)
- Programming languages (Python, Java, C#, etc.) 
- Frameworks and platforms (Angular, Vue, Spring, .NET, etc.)
- Development platforms (Mendix, OutSystems, ServiceNow, etc.)
- Job-related domains (frontend, backend, full-stack, DevOps, etc.)
- Industry terms (fintech, healthcare, e-commerce, etc.)
- Certifications and tools mentioned
- Key business concepts and methodologies (Agile, Scrum, CI/CD, etc.)
- Company-specific terms and products
Be inclusive - capture all technical terms, platform names, and relevant business keywords that appear in the job description, even if they're not explicitly categorized as "required" or "preferred" skills.

Return ONLY a valid JSON object with this structure:
{
  "extractedInfo": {
    "role": "UI Frontend Architect",
    "company": "TechCorp",
    "companyDescription": "TechCorp is a Series B funded AI startup focused on democratizing artificial intelligence with a mission to make AI accessible to everyone.",
    "location": "Manhattan, NY",
    "workArrangement": "hybrid",
    "salaryRange": "$156,000/year (W2)",
    "jobUrl": "https://www.linkedin.com/jobs/view/4296167250",
    "applicationId": "APP-2024-001",
    "applicantCount": "100+ applicants",
    "requiredSkills": ["JavaScript", "React", "Node.js", "SQL"],
    "preferredSkills": ["TypeScript", "AWS", "Docker"],
    "responsibilities": ["Build scalable web applications", "Mentor junior developers"],
    "requirements": ["Bachelor's degree in CS", "5+ years experience"]
  },
  "keywords": ["JavaScript", "React", "Node.js", "TypeScript", "AWS", "Docker", "SQL", "Senior", "Engineering", "Mentoring", "UI", "Frontend", "Architect", "TechCorp", "AI", "startup", "web applications"]
}`;





// Parse job description text and extract structured information
export async function parseJobDescription(
  text: string, 
  additionalContext?: {
    applicationDate?: string;
    applicationId?: number;
    impactFocus?: string;
    impactLevel?: string;
  }
): Promise<{
  extractedInfo: JobDescription['extractedInfo'];
  keywords: string[];
  success: boolean;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> {
  const config = getAIConfig();
  
  if (!config.apiKey) {
    return {
      extractedInfo: {
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        requirements: []
      },
      keywords: [],
      success: false,
      error: 'AI service not configured. Please add your OpenAI API key.'
    };
  }

  if (!config.apiUrl) {
    return {
      extractedInfo: {
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        requirements: []
      },
      keywords: [],
      success: false,
      error: 'AI API URL not configured.'
    };
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: JOB_DESCRIPTION_PARSING_PROMPT
          },
          {
            role: 'user',
            content: `Please extract structured information from this job description:

${additionalContext ? `ADDITIONAL CONTEXT:
Application Date: ${additionalContext.applicationDate || 'Not specified'}
Application ID: ${additionalContext.applicationId ? `#${additionalContext.applicationId}` : 'Not assigned'}
Impact Focus: ${additionalContext.impactFocus || 'Not specified'}
Impact Level: ${additionalContext.impactLevel || 'Not specified'}

` : ''}JOB DESCRIPTION TEXT:
${text}`
          }
        ],
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('AI API error response:', errorData);
      
      if (response.status === 401) {
        return {
          extractedInfo: {
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            requirements: []
          },
          keywords: [],
          success: false,
          error: 'Invalid API key. Please check your OpenAI API key in the settings.'
        };
      }
      
      if (response.status === 429) {
        return {
          extractedInfo: {
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            requirements: []
          },
          keywords: [],
          success: false,
          error: 'API rate limit exceeded. Please try again in a few minutes.'
        };
      }

      return {
        extractedInfo: {
          requiredSkills: [],
          preferredSkills: [],
          responsibilities: [],
          requirements: []
        },
        keywords: [],
        success: false,
        error: `AI API error: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return {
        extractedInfo: {
          requiredSkills: [],
          preferredSkills: [],
          responsibilities: [],
          requirements: []
        },
        keywords: [],
        success: false,
        error: 'No response content from AI service.'
      };
    }

    try {
      const parsed = JSON.parse(content);
      
      if (!parsed.extractedInfo || !parsed.keywords) {
        console.error('Invalid AI response structure:', parsed);
        return {
          extractedInfo: {
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            requirements: []
          },
          keywords: [],
          success: false,
          error: 'Invalid response structure from AI service.'
        };
      }

      console.log('AI parsed response:', parsed);
      console.log('Extracted applicationId:', parsed.extractedInfo?.applicationId);
      
      // Supplement AI keywords with local extraction to catch missed terms
      const localKeywords = extractKeywordsFromText(text, 10);
      const allSkills = [
        ...(parsed.extractedInfo.requiredSkills || []),
        ...(parsed.extractedInfo.preferredSkills || [])
      ].map(skill => skill.toLowerCase());
      
      // Combine AI keywords with local extraction, ensuring important technical terms are included
      const combinedKeywords = new Set([
        ...(parsed.keywords || []),
        ...localKeywords,
        ...allSkills
      ]);
      
      // Convert back to array and remove duplicates
      const finalKeywords = Array.from(combinedKeywords)
        .filter(keyword => keyword && keyword.length > 1)
        .map(keyword => keyword.toLowerCase());
      
      return {
        extractedInfo: parsed.extractedInfo,
        keywords: finalKeywords,
        success: true,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI response content (first 500 chars):', content?.substring(0, 500));
      console.error('Full AI response length:', content?.length);
      
      return {
        extractedInfo: {
          requiredSkills: [],
          preferredSkills: [],
          responsibilities: [],
          requirements: []
        },
        keywords: [],
        success: false,
        error: 'Failed to parse AI response. The AI may have returned malformed JSON.'
      };
    }

  } catch (error) {
    console.error('Error calling AI API for job description parsing:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        extractedInfo: {
          requiredSkills: [],
          preferredSkills: [],
          responsibilities: [],
          requirements: []
        },
        keywords: [],
        success: false,
        error: 'Network error: Unable to reach AI API. Check your internet connection.'
      };
    }

    return {
      extractedInfo: {
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        requirements: []
      },
      keywords: [],
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Interface for AI-detected document metadata
interface DocumentMetadata {
  detectedCompany?: string;
  detectedRole?: string;
  confidence?: number;
  success: boolean;
  error?: string;
}

// Extract company and role information from document text using AI
export async function extractDocumentMetadata(
  text: string,
  documentType: 'resume' | 'cover_letter'
): Promise<DocumentMetadata> {
  const config = getAIConfig();
  
  if (!config.apiKey) {
    return {
      success: false,
      error: 'AI API key not configured. Please set up your OpenAI API key in the settings.'
    };
  }

  if (!config.apiUrl) {
    return {
      success: false,
      error: 'AI API URL not configured.'
    };
  }

  const prompt = documentType === 'resume' 
    ? `Analyze this resume text and extract the most recent/current company and job title. Return ONLY a JSON object with this exact structure:

{
  "detectedCompany": "Company Name" or null,
  "detectedRole": "Job Title" or null,
  "confidence": 0.0-1.0
}

Rules:
- For company: Extract the most recent employer name
- For role: Extract the most recent job title
- If information is unclear or missing, use null
- Confidence should reflect how certain you are about the extraction

Resume text:
${text}`
    : `Analyze this cover letter text and extract the target company and position being applied for. Return ONLY a JSON object with this exact structure:

{
  "detectedCompany": "Company Name" or null,
  "detectedRole": "Job Title" or null,
  "confidence": 0.0-1.0
}

Rules:
- For company: Extract the company name mentioned in the cover letter
- For role: Extract the position title being applied for
- If information is unclear or missing, use null
- Confidence should reflect how certain you are about the extraction

Cover letter text:
${text}`;

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('AI API error response:', errorData);
      
      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid API key. Please check your OpenAI API key in the settings.'
        };
      }
      
      if (response.status === 429) {
        return {
          success: false,
          error: 'API rate limit exceeded. Please try again in a few minutes.'
        };
      }

      return {
        success: false,
        error: `AI API error (${response.status}): ${errorData}`
      };
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return {
        success: false,
        error: 'Invalid response format from AI API'
      };
    }

    const content = data.choices[0].message.content;
    
    try {
      const parsed = JSON.parse(content);
      
      return {
        detectedCompany: parsed.detectedCompany || undefined,
        detectedRole: parsed.detectedRole || undefined,
        confidence: parsed.confidence || 0,
        success: true
      };

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI response content:', content);
      
      return {
        success: false,
        error: 'Failed to parse AI response. The AI may have returned malformed JSON.'
      };
    }

  } catch (error) {
    console.error('Error calling AI API for metadata extraction:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: 'Network error: Unable to reach AI API. Check your internet connection.'
      };
    }

    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Generate a new resume using full resume text
export async function generateTailoredResumeFromFullText(
  jobDescription: JobDescription, 
  fullResumeText: string, 
  additionalContext?: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  if (!isAIConfigured()) {
    return { success: false, error: 'AI service is not configured. Please set up your OpenAI API key.' };
  }

  const config = getAIConfig();
  
  const prompt = `You are an expert resume writer specializing in ATS optimization. Generate a complete, professional resume in clean HTML format that EXACTLY follows the template structure and ATS best practices below. Use the provided full resume text to create personalized content tailored to the job description.

JOB DESCRIPTION:
Company: ${jobDescription.company}
Position: ${jobDescription.title}
Location: ${jobDescription.extractedInfo.location || 'Not specified'}

Required Skills: ${jobDescription.extractedInfo.requiredSkills.join(', ')}
Preferred Skills: ${jobDescription.extractedInfo.preferredSkills.join(', ')}

Key Requirements:
${jobDescription.extractedInfo.requirements.map(req => `- ${req}`).join('\n')}

Key Responsibilities:
${jobDescription.extractedInfo.responsibilities.map(resp => `- ${resp}`).join('\n')}

${jobDescription.additionalContext ? `Additional Context: ${jobDescription.additionalContext}` : ''}

FULL RESUME TEXT TO USE AS SOURCE:
${fullResumeText}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}` : ''}

CRITICAL ATS OPTIMIZATION REQUIREMENTS:
1. EXACT JOB TITLE MATCH: Use the EXACT job title from the job description in your header
2. KEYWORD DENSITY: Repeat critical keywords 2-3 times across Summary, Skills, and Experience
3. EXACT JD PHRASING: Mirror job description language verbatim in skills section
4. ACTION VERBS: Use ATS-friendly verbs like Built, Designed, Implemented, Optimized, Delivered, Architected
5. TECH STACK PLACEMENT: Add tech stack at end of each role in parentheses format
6. METRICS FOCUS: Include measurable outcomes in experience bullets
7. KEYWORD CLUSTER: Add a dense keyword block matching job requirements
8. PLAIN TEXT FORMAT: No tables, columns, or special formatting that breaks ATS parsing

RESUME HTML TEMPLATE STRUCTURE - ATS-OPTIMIZED:

Generate a complete HTML document with this exact structure:
- DOCTYPE html declaration with meta charset UTF-8
- Embedded CSS styles for professional print layout (ATS-safe)
- Body with resume content in structured divs
- Use CSS classes: resume, header, name, title, contact, section, section-title, job-title, company-info
- Font family: Calibri, Arial, sans-serif (ATS-friendly)
- Professional font sizes: name 18px, section titles 11px, body text 10px
- Include @media print styles for clean printing

SECTION STRUCTURE (ATS-OPTIMIZED):
1. HEADER: ALL CAPS name + EXACT job title from JD
2. SUMMARY: Include 2-3 critical keywords from job requirements
3. CORE SKILLS: Mirror JD phrasing exactly, repeat key terms
4. TECHNICAL SKILLS: Separate section with exact JD technologies
5. EXPERIENCE: Each role with (Tech: React, TypeScript, etc.) at end
6. ATS KEYWORD CLUSTER: Dense keyword section for algorithm matching

ATS FORMATTING REQUIREMENTS:
- Single column layout only (no CSS columns for skills)
- Plain text formatting, no special characters
- Proper HTML semantic structure
- Linear reading flow for ATS parsers

CRITICAL ATS-OPTIMIZED INSTRUCTIONS:
1. Generate COMPLETE HTML document with ATS-safe structure
2. HEADER: Use ALL CAPS name + EXACT job title: "${jobDescription.title}"
3. KEYWORD STRATEGY: Repeat these exact terms 2-3 times: ${jobDescription.extractedInfo.requiredSkills.slice(0, 5).join(', ')}
4. SKILLS SECTION: Mirror job description phrasing exactly - use verbatim terms
5. ACTION VERBS: Use Built, Designed, Implemented, Optimized, Delivered, Architected
6. TECH STACK: End each experience role with (Tech: [technologies]) format
7. METRICS: Include measurable outcomes in every experience bullet
8. ATS KEYWORD CLUSTER: Add final section with dense keyword matching
9. SINGLE COLUMN: No CSS columns or complex layouts that break ATS parsing
10. SEMANTIC HTML: Proper heading hierarchy and list structures
11. PLAIN TEXT: No special characters, icons, or formatting that breaks parsers
12. JD ALIGNMENT: Match company culture and soft skill language from job posting
13. FILENAME READY: Structure content for "clint-bush-[month]-[year]-[company]-[role]-resume" pattern
14. Generate complete ATS-optimized HTML resume now:

Generate a complete HTML resume document now:`;

  try {
    console.log('Making AI API request for full-text resume generation...');
    
    const response = await fetch(config.apiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      })
    });

    console.log('AI API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error response:', errorText);
      throw new Error(`AI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('AI API response data:', data);
    
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated by AI');
    }

    console.log('Full-text resume generation successful, content length:', content.length);
    return { success: true, content };

  } catch (error) {
    console.error('Error generating resume from full text:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}



// Generate a new cover letter using full resume text
export async function generateTailoredCoverLetterFromFullText(
  jobDescription: JobDescription, 
  fullResumeText: string, 
  additionalContext?: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  if (!isAIConfigured()) {
    return { success: false, error: 'AI service is not configured. Please set up your OpenAI API key.' };
  }

  const config = getAIConfig();
  
  const prompt = `You are an expert cover letter writer. Generate a compelling, personalized cover letter using the following professional template structure. Tailor all content to the specific job description and use the provided full resume text as your source material.

JOB DESCRIPTION:
Company: ${jobDescription.company}
Position: ${jobDescription.title}
Location: ${jobDescription.extractedInfo.location || 'Not specified'}

Required Skills: ${jobDescription.extractedInfo.requiredSkills.join(', ')}
Preferred Skills: ${jobDescription.extractedInfo.preferredSkills.join(', ')}

Key Requirements:
${jobDescription.extractedInfo.requirements.map(req => `- ${req}`).join('\n')}

Key Responsibilities:
${jobDescription.extractedInfo.responsibilities.map(resp => `- ${resp}`).join('\n')}

${jobDescription.additionalContext ? `Additional Context: ${jobDescription.additionalContext}` : ''}

FULL RESUME TEXT TO USE AS SOURCE:
${fullResumeText}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}` : ''}

COVER LETTER STRUCTURE:

**HEADER:**
- Use current date
- Address to ${jobDescription.company} hiring team
- Professional business letter format

**OPENING PARAGRAPH:**
- Express interest in ${jobDescription.title} position at ${jobDescription.company}
- Mention years of relevant experience from resume
- Include compelling hook about the company/role
- Show enthusiasm and initial value proposition

**BODY PARAGRAPH 1 - RELEVANT EXPERIENCE:**
- Highlight most relevant previous role from resume
- Include specific achievement with quantifiable results
- Connect experience directly to job requirements
- Use concrete examples from your background

**BODY PARAGRAPH 2 - VALUE PROPOSITION:**
- Reference specific aspects of ${jobDescription.title} role
- Demonstrate knowledge of ${jobDescription.company}
- Show how skills match job requirements
- Include another achievement or skill demonstration

**CLOSING PARAGRAPH:**
- Reiterate interest and value you'd bring
- Professional call to action
- Thank them for consideration

CRITICAL INSTRUCTIONS:
1. Generate ACTUAL CONTENT, not placeholders or template text
2. Use real information from the provided resume text
3. Write a compelling, personalized letter for ${jobDescription.title} at ${jobDescription.company}
4. Include specific achievements with quantifiable results from resume
5. Match keywords from the job description naturally throughout
6. Show genuine enthusiasm and knowledge of the company/role
7. Ensure the letter flows naturally and tells a compelling story
8. Keep paragraphs concise but impactful (3-4 sentences each)
9. Maintain professional, engaging tone throughout
10. Connect candidate's experience directly to job requirements
11. Include specific examples that demonstrate relevant skills
12. Create a strong call to action in closing
13. Format as clean business letter suitable for document generation

Generate a complete, personalized cover letter with actual content now:`;

  try {
    const response = await fetch(config.apiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated by AI');
    }

    return { success: true, content };

  } catch (error) {
    console.error('Error generating cover letter from full text:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}



// Get combined text content from all resumes for full-text generation
export async function getCombinedResumeText(): Promise<string> {
  try {
    const { loadResumes } = await import('../storage');
    const resumes = await loadResumes();
    
    if (resumes.length === 0) {
      throw new Error('No resumes found. Please upload some resumes first.');
    }

    // Combine text content from all resumes
    const combinedText = resumes
      .filter(resume => resume.textContent && resume.textContent.trim().length > 0)
      .map(resume => {
        return `=== RESUME: ${resume.name} ===\n\n${resume.textContent}\n\n`;
      })
      .join('\n');

    if (combinedText.trim().length === 0) {
      throw new Error('No text content found in resumes. Please process your resumes to extract text content.');
    }

    return combinedText;
  } catch (error) {
    console.error('Error getting combined resume text:', error);
    throw error;
  }
}

// Show configuration instructions
export function showConfigInstructions(): void {
  const status = getConfigurationStatus();
  alert(
    'OpenAI API Configuration Required\n\n' +
    'To use the AI features, you need to configure your OpenAI API key:\n\n' +
    '1. Get an API key from https://platform.openai.com/api-keys\n' +
    '2. Copy your API key\n' +
    '3. Open the .env file in your project root\n' +
    '4. Replace "your_openai_api_key_here" with your actual API key\n' +
    '5. Restart the development server (npm run dev)\n\n' +
    `Current status: ${status.message}`
  );
}