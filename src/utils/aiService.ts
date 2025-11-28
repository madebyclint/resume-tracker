import { ChunkParseResult, ChunkType, JobDescription } from '../types';

// AI Configuration
interface AIConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
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

// Prompt for AI to parse resume text into semantic chunks
const RESUME_CHUNKING_PROMPT = `You are an expert resume parser. Your task is to analyze the provided resume text and break it down into semantic chunks for use in resume building.

Parse the text into the following chunk types:
- "cv_summary": Professional summary or objective statements
- "cv_skills": Technical skills, soft skills, or competencies 
- "cv_experience_section": Job titles, company names, date ranges (headers of work experience)
- "cv_experience_bullet": Individual bullet points describing accomplishments or responsibilities
- "cv_mission_fit": Content about company culture fit, values alignment, or mission statements

For each chunk, provide:
- type: One of the chunk types above
- text: The exact text content
- tags: 3-7 relevant skill/domain tags (e.g. ["JavaScript", "React", "Frontend"])
- order: Sequential number starting from 1

Rules:
1. Break experience bullets into individual chunks (one accomplishment per chunk)
2. Keep skills grouped logically but separate technical from soft skills
3. Preserve exact text - don't rewrite or improve it
4. Skip irrelevant content like page headers, footers, or formatting artifacts
5. Order chunks as they appear in the document

Return ONLY a valid JSON object with this exact structure:
{
  "chunks": [
    {
      "type": "cv_summary",
      "text": "Results-driven software engineer...",
      "tags": ["Resume: Software Engineering", "Resume: Leadership", "Resume: Problem Solving"],
      "order": 1
    }
  ]
}`;

// Prompt for AI to parse cover letters with semantic relationships
const COVER_LETTER_CHUNKING_PROMPT = `You are an expert cover letter analyzer specializing in semantic relationship extraction. Your task is to analyze cover letter text and extract semantically meaningful chunks with their relationships.

Parse the text into semantic chunk types:
- "cl_company_research": Specific mentions or research about the target company
- "cl_skill_demonstration": Examples demonstrating specific skills or competencies
- "cl_achievement_claim": Quantified accomplishments or results
- "cl_motivation_statement": Expressions of interest, passion, or career goals
- "cl_experience_mapping": Connections between past experience and job requirements
- "cl_intro": Opening paragraphs and introductions
- "cl_body": Main narrative content
- "cl_closing": Closing statements and calls to action

For each chunk, provide:
- type: One of the chunk types above
- text: The exact text content
- tags: 3-7 relevant skill/domain tags (e.g. ["JavaScript", "React", "Frontend"])
- order: Sequential number starting from 1

For each chunk, extract semantic relationships:
- "mentions_company": References to specific companies, their products, values, or culture
- "demonstrates_skill": Examples of using specific technical or soft skills
- "claims_achievement": Quantified results, improvements, or accomplishments
- "supports_requirement": Content that addresses specific job requirements
- "references_experience": Mentions of past roles, projects, or experiences
- "shows_motivation": Expressions of interest, passion, or career alignment

Rules:
1. Include ALL required fields: type, text, tags, order, semanticRelationships
2. Order chunks as they appear in the document
3. Preserve exact text - don't rewrite or improve it
4. Skip irrelevant content like page headers, footers, or formatting artifacts

Return ONLY a valid JSON object with this structure:
{
  "chunks": [
    {
      "type": "cl_company_research",
      "text": "I'm particularly drawn to TechCorp's mission to democratize AI and your recent Series B funding...",
      "tags": ["Cover Letter: Company Research", "Cover Letter: AI", "Cover Letter: Funding"],
      "order": 1,
      "semanticRelationships": [
        {
          "type": "mentions_company",
          "entity": "TechCorp",
          "context": "mission and funding",
          "confidence": 0.95
        }
      ]
    }
  ]
}`;

// Prompt for AI to parse job descriptions and extract key information
const JOB_DESCRIPTION_PARSING_PROMPT = `You are an expert job posting analyzer. Your task is to extract structured information from job description text.

Extract the following information:
- role: Job title/position name
- company: Company name (if mentioned)
- department: Department/team name (if mentioned)
- location: Location/remote information
- salaryRange: Salary range (if mentioned)
- experienceLevel: Required experience level (entry, mid, senior, etc.)
- requiredSkills: Array of required/must-have skills and technologies
- preferredSkills: Array of preferred/nice-to-have skills
- responsibilities: Array of key job responsibilities
- requirements: Array of job requirements (education, experience, etc.)

Also generate:
- keywords: Array of 10-15 relevant keywords for matching (skills, technologies, domains)

Return ONLY a valid JSON object with this structure:
{
  "extractedInfo": {
    "role": "Senior Software Engineer",
    "company": "TechCorp",
    "department": "Engineering",
    "location": "San Francisco, CA / Remote",
    "salaryRange": "$120k - $180k",
    "experienceLevel": "Senior (5+ years)",
    "requiredSkills": ["JavaScript", "React", "Node.js", "SQL"],
    "preferredSkills": ["TypeScript", "AWS", "Docker"],
    "responsibilities": ["Build scalable web applications", "Mentor junior developers"],
    "requirements": ["Bachelor's degree in CS", "5+ years experience"]
  },
  "keywords": ["JavaScript", "React", "Node.js", "TypeScript", "AWS", "Docker", "SQL", "Senior", "Engineering", "Mentoring", "Scalable", "Web Applications", "Full Stack", "Backend", "Frontend"]
}`;

export async function parseTextIntoChunks(text: string): Promise<ChunkParseResult> {
  const config = getAIConfig();
  
  if (!config.apiKey) {
    return {
      chunks: [],
      success: false,
      error: 'AI API key not configured. Please set up your OpenAI API key in the settings.'
    };
  }

  if (!config.apiUrl) {
    return {
      chunks: [],
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
            content: RESUME_CHUNKING_PROMPT
          },
          {
            role: 'user',
            content: `Please parse this resume text into semantic chunks:\n\n${text}`
          }
        ],
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('AI API error response:', errorData);
      
      if (response.status === 401) {
        return {
          chunks: [],
          success: false,
          error: 'Invalid API key. Please check your OpenAI API key in the settings.'
        };
      }
      
      if (response.status === 429) {
        return {
          chunks: [],
          success: false,
          error: 'API rate limit exceeded. Please try again in a few minutes.'
        };
      }

      return {
        chunks: [],
        success: false,
        error: `AI API error (${response.status}): ${errorData}`
      };
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return {
        chunks: [],
        success: false,
        error: 'Invalid response format from AI API'
      };
    }

    const content = data.choices[0].message.content;
    
    try {
      const parsed = JSON.parse(content);
      
      if (!parsed.chunks || !Array.isArray(parsed.chunks)) {
        return {
          chunks: [],
          success: false,
          error: 'AI response missing chunks array'
        };
      }

      // Process and fix chunks instead of discarding them
      const processedChunks = parsed.chunks.map((chunk: any, index: number) => {
        const fixedChunk = { ...chunk };
        
        // Fix missing or invalid fields with defaults
        if (!fixedChunk.tags || !Array.isArray(fixedChunk.tags)) {
          console.warn(`Chunk ${index + 1}: Missing tags, adding default tags based on type`);
          fixedChunk.tags = [getChunkTypeLabel(fixedChunk.type)];
        }
        
        if (typeof fixedChunk.order !== 'number') {
          console.warn(`Chunk ${index + 1}: Missing order, using index-based order`);
          fixedChunk.order = index + 1;
        }
        
        return fixedChunk;
      });

      // Filter out chunks with invalid types or missing essential content
      const validChunks = processedChunks.filter((chunk: any, index: number) => {
        const hasEssentials = chunk.type && chunk.text;
        const hasValidChunkType = isValidChunkType(chunk.type);
        
        if (!hasEssentials) {
          console.error(`Chunk ${index + 1}: Missing essential fields (type or text):`, chunk);
          return false;
        }
        
        if (!hasValidChunkType) {
          console.error(`Chunk ${index + 1}: Invalid chunk type "${chunk.type}". Valid types:`, 
            ['header', 'summary', 'skills', 'experience_section', 'experience_bullet', 'mission_fit', 
             'cover_letter_intro', 'cover_letter_body', 'cover_letter_closing', 'company_research', 
             'skill_demonstration', 'achievement_claim', 'motivation_statement', 'experience_mapping']);
          return false;
        }
        
        return true;
      });

      if (validChunks.length === 0) {
        console.error('No chunks could be processed. Total chunks from AI:', parsed.chunks.length);
        console.error('All chunks:', parsed.chunks);
        return {
          chunks: [],
          success: false,
          error: `No valid chunks found in AI response. Received ${parsed.chunks.length} chunks but all had invalid types or missing essential content. Check console for details.`
        };
      }

      // Log if we had to fix any chunks
      const fixedCount = parsed.chunks.length - validChunks.length;
      if (fixedCount > 0) {
        console.log(`Successfully processed ${validChunks.length}/${parsed.chunks.length} chunks from AI response`);
      }

      return {
        chunks: validChunks,
        success: true
      };

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI response content (first 500 chars):', content?.substring(0, 500));
      console.error('Full AI response length:', content?.length);
      
      return {
        chunks: [],
        success: false,
        error: 'Failed to parse AI response. The AI may have returned malformed JSON. Check console for details.'
      };
    }

  } catch (error) {
    console.error('Error calling AI API:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        chunks: [],
        success: false,
        error: 'Network error: Unable to reach AI API. Check your internet connection.'
      };
    }

    return {
      chunks: [],
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Helper function to validate chunk types
export function isValidChunkType(type: string): type is ChunkType {
  const validTypes: ChunkType[] = [
    // Resume chunk types
    'cv_header',
    'cv_summary',
    'cv_skills', 
    'cv_experience_section',
    'cv_experience_bullet',
    'cv_mission_fit',
    // Cover letter chunk types
    'cl_intro',
    'cl_body',
    'cl_closing',
    'cl_company_research',
    'cl_skill_demonstration',
    'cl_achievement_claim',
    'cl_motivation_statement',
    'cl_experience_mapping'
  ];
  return validTypes.includes(type as ChunkType);
}

// Parse cover letter text into semantic chunks with relationships
export async function parseCoverLetterIntoChunks(text: string): Promise<ChunkParseResult> {
  const config = getAIConfig();
  
  if (!config.apiKey) {
    return {
      chunks: [],
      success: false,
      error: 'AI API key not configured. Please set up your OpenAI API key in the settings.'
    };
  }

  if (!config.apiUrl) {
    return {
      chunks: [],
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
        model: config.model || 'gpt-4o-mini', // Use a more capable model for semantic relationships
        messages: [
          {
            role: 'system',
            content: COVER_LETTER_CHUNKING_PROMPT
          },
          {
            role: 'user',
            content: `Please parse this cover letter text into semantic chunks with relationships:\n\n${text}`
          }
        ],
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('AI API error response:', errorData);
      
      if (response.status === 401) {
        return {
          chunks: [],
          success: false,
          error: 'Invalid API key. Please check your OpenAI API key in the settings.'
        };
      }
      
      if (response.status === 429) {
        return {
          chunks: [],
          success: false,
          error: 'API rate limit exceeded. Please try again in a few minutes.'
        };
      }

      return {
        chunks: [],
        success: false,
        error: `AI API error (${response.status}): ${errorData}`
      };
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return {
        chunks: [],
        success: false,
        error: 'Invalid response format from AI API'
      };
    }

    const content = data.choices[0].message.content;
    console.log('Raw AI response for cover letter parsing:', content);
    
    try {
      const parsed = JSON.parse(content);
      console.log('Parsed AI response:', parsed);
      
      if (!parsed.chunks || !Array.isArray(parsed.chunks)) {
        return {
          chunks: [],
          success: false,
          error: 'AI response missing chunks array'
        };
      }

      // Process and fix chunks instead of discarding them
      const processedChunks = parsed.chunks.map((chunk: any, index: number) => {
        const fixedChunk = { ...chunk };
        
        // Fix missing or invalid fields with defaults
        if (!fixedChunk.tags || !Array.isArray(fixedChunk.tags)) {
          console.warn(`Chunk ${index + 1}: Missing tags, adding default tags based on type`);
          fixedChunk.tags = [getChunkTypeLabel(fixedChunk.type)];
        }
        
        if (typeof fixedChunk.order !== 'number') {
          console.warn(`Chunk ${index + 1}: Missing order, using index-based order`);
          fixedChunk.order = index + 1;
        }
        
        // Validate semantic relationships and fix if needed
        if (fixedChunk.semanticRelationships && !Array.isArray(fixedChunk.semanticRelationships)) {
          console.warn(`Chunk ${index + 1}: Invalid semanticRelationships format, resetting to empty array`);
          fixedChunk.semanticRelationships = [];
        } else if (fixedChunk.semanticRelationships && Array.isArray(fixedChunk.semanticRelationships)) {
          // Filter out invalid relationships
          fixedChunk.semanticRelationships = fixedChunk.semanticRelationships.filter((rel: any) => {
            const isValid = rel.type && (rel.entity || rel.context);
            if (!isValid) {
              console.warn(`Chunk ${index + 1}: Removing invalid semantic relationship:`, rel);
            }
            return isValid;
          });
        }
        
        return fixedChunk;
      });

      // Filter out chunks with invalid types or missing essential content
      const validChunks = processedChunks.filter((chunk: any, index: number) => {
        const hasEssentials = chunk.type && chunk.text;
        const hasValidChunkType = isValidChunkType(chunk.type);
        
        if (!hasEssentials) {
          console.error(`Chunk ${index + 1}: Missing essential fields (type or text):`, chunk);
          return false;
        }
        
        if (!hasValidChunkType) {
          console.error(`Chunk ${index + 1}: Invalid chunk type "${chunk.type}". Valid types:`, 
            ['header', 'summary', 'skills', 'experience_section', 'experience_bullet', 'mission_fit', 
             'cover_letter_intro', 'cover_letter_body', 'cover_letter_closing', 'company_research', 
             'skill_demonstration', 'achievement_claim', 'motivation_statement', 'experience_mapping']);
          return false;
        }
        
        return true;
      });

      if (validChunks.length === 0) {
        console.error('No chunks could be processed. Total chunks from AI:', parsed.chunks.length);
        console.error('All chunks:', parsed.chunks);
        return {
          chunks: [],
          success: false,
          error: `No valid chunks found in AI response. Received ${parsed.chunks.length} chunks but all had invalid types or missing essential content. Check console for details.`
        };
      }

      // Log if we had to fix any chunks
      const fixedCount = parsed.chunks.length - validChunks.length;
      if (fixedCount > 0) {
        console.log(`Successfully processed ${validChunks.length}/${parsed.chunks.length} chunks from AI response`);
      }

        // Add sourceDocType to chunks and adjust tags for cover letter context
        const typedChunks = validChunks.map((chunk: any) => ({
          ...chunk,
          sourceDocType: 'cover_letter',
          // Add "Cover Letter:" prefix to tags to distinguish from resume content
          tags: chunk.tags.map((tag: string) => 
            tag.toLowerCase().includes('cover letter:') ? tag : `Cover Letter: ${tag}`
          )
        }));      return {
        chunks: typedChunks,
        success: true
      };

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI response content (first 500 chars):', content?.substring(0, 500));
      console.error('Full AI response length:', content?.length);
      
      return {
        chunks: [],
        success: false,
        error: 'Failed to parse AI response. The AI may have returned malformed JSON. Check console for details.'
      };
    }

  } catch (error) {
    console.error('Error calling AI API:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        chunks: [],
        success: false,
        error: 'Network error: Unable to reach AI API. Check your internet connection.'
      };
    }

    return {
      chunks: [],
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Parse job description text and extract structured information
export async function parseJobDescription(text: string): Promise<{
  extractedInfo: JobDescription['extractedInfo'];
  keywords: string[];
  success: boolean;
  error?: string;
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
            content: `Please extract structured information from this job description:\n\n${text}`
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

      return {
        extractedInfo: parsed.extractedInfo,
        keywords: parsed.keywords,
        success: true
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

// Helper function to get human-readable chunk type names
export function getChunkTypeLabel(type: ChunkType | string): string {
  const labels: Record<string, string> = {
    // New Resume chunk types
    cv_header: 'Resume: Header',
    cv_summary: 'Resume: Summary',
    cv_skills: 'Resume: Skills',
    cv_experience_section: 'Resume: Experience Section',
    cv_experience_bullet: 'Resume: Experience Bullet',
    cv_mission_fit: 'Resume: Mission Fit',
    // New Cover letter chunk types
    cl_intro: 'Cover Letter: Intro',
    cl_body: 'Cover Letter: Body',
    cl_closing: 'Cover Letter: Closing',
    cl_company_research: 'Cover Letter: Company Research',
    cl_skill_demonstration: 'Cover Letter: Skill Demonstration',
    cl_achievement_claim: 'Cover Letter: Achievement Claim',
    cl_motivation_statement: 'Cover Letter: Motivation Statement',
    cl_experience_mapping: 'Cover Letter: Experience Mapping',
    // Legacy chunk types (backward compatibility)
    header: 'Resume: Header',
    summary: 'Resume: Summary',
    skills: 'Resume: Skills',
    experience_section: 'Resume: Experience Section',
    experience_bullet: 'Resume: Experience Bullet',
    mission_fit: 'Resume: Mission Fit',
    cover_letter_intro: 'Cover Letter: Intro',
    cover_letter_body: 'Cover Letter: Body',
    cover_letter_closing: 'Cover Letter: Closing',
    company_research: 'Cover Letter: Company Research',
    skill_demonstration: 'Cover Letter: Skill Demonstration',
    achievement_claim: 'Cover Letter: Achievement Claim',
    motivation_statement: 'Cover Letter: Motivation Statement',
    experience_mapping: 'Cover Letter: Experience Mapping'
  };
  return labels[type] || type;
}

// Generate a new resume tailored to a specific job description
export async function generateTailoredResume(
  jobDescription: JobDescription, 
  relevantChunks: { chunk: any; score: number }[], 
  additionalContext?: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  if (!isAIConfigured()) {
    return { success: false, error: 'AI service is not configured. Please set up your OpenAI API key.' };
  }

  const config = getAIConfig();
  
  const prompt = `You are an expert resume writer. Generate a complete, professional resume using the following template structure. Tailor all content to the specific job description and use the provided resume chunks.

JOB DESCRIPTION:
Company: ${jobDescription.company}
Position: ${jobDescription.title}
Location: ${jobDescription.extractedInfo.location || 'Not specified'}
Experience Level: ${jobDescription.extractedInfo.experienceLevel || 'Not specified'}

Required Skills: ${jobDescription.extractedInfo.requiredSkills.join(', ')}
Preferred Skills: ${jobDescription.extractedInfo.preferredSkills.join(', ')}

Key Requirements:
${jobDescription.extractedInfo.requirements.map(req => `- ${req}`).join('\n')}

Key Responsibilities:
${jobDescription.extractedInfo.responsibilities.map(resp => `- ${resp}`).join('\n')}

${jobDescription.additionalContext ? `Additional Context: ${jobDescription.additionalContext}` : ''}

RELEVANT RESUME CHUNKS (ordered by relevance):
${relevantChunks.map((item, idx) => `
${idx + 1}. [${item.chunk.type}] (Relevance: ${Math.round(item.score * 100)}%)
${item.chunk.text}
`).join('\n')}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}` : ''}

RESUME TEMPLATE STRUCTURE:

**HEADER SECTION:**
- Extract the candidate's actual name, email, phone, location, LinkedIn from cv_header chunks
- If header info is not in chunks, look for contact details in other chunk types
- Format: Full Name on first line, then email | phone | city, state | LinkedIn URL on second line
- Use the candidate's real information, not placeholder text

**PROFESSIONAL SUMMARY:**
- Write 3-4 compelling lines using cv_summary chunks
- Highlight experience most relevant to this ${jobDescription.title} role
- Include key skills that match the job requirements
- Show value proposition for ${jobDescription.company}

**CORE COMPETENCIES:**
- Extract technical and soft skills from cv_skills chunks  
- Prioritize skills mentioned in the job description
- Format as bullet points: • Skill • Skill • Skill
- Include 6-10 most relevant skills

**PROFESSIONAL EXPERIENCE:**
- Use cv_experience_section chunks for job titles/companies/dates
- Use cv_experience_bullet chunks for achievements
- Prioritize experience most relevant to ${jobDescription.title}
- Each bullet should have quantifiable results when possible
- Use strong action verbs (Led, Developed, Implemented, etc.)
- Focus on achievements that match job requirements

**EDUCATION:**
- Include if found in chunks, otherwise create reasonable education background

CRITICAL INSTRUCTIONS:
1. Generate ACTUAL CONTENT, not placeholders like [Name] or [Company]
2. Extract real information from the provided chunks
3. Use the candidate's actual name, contact info, job history, and achievements
4. Prioritize content that matches ${jobDescription.title} requirements
5. Include specific skills mentioned in the job posting
6. Use strong action verbs and quantifiable achievements
7. Ensure ATS compatibility with clean, simple formatting
8. Match keywords from the job description naturally throughout
9. Keep bullets concise but impactful (1-2 lines each)
10. Create a cohesive narrative that positions the candidate for this specific role
11. If information is missing from chunks, create reasonable professional content
12. Format should be clean text suitable for document generation

Generate a complete, ready-to-use resume with actual content now:`;

  try {
    console.log('Making AI API request for resume generation...');
    console.log('API URL:', config.apiUrl);
    console.log('Model:', config.model);
    console.log('Has API Key:', !!config.apiKey);
    
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

    console.log('Resume generation successful, content length:', content.length);
    return { success: true, content };

  } catch (error) {
    console.error('Error generating resume:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

// Generate a new cover letter tailored to a specific job description
export async function generateTailoredCoverLetter(
  jobDescription: JobDescription, 
  relevantChunks: { chunk: any; score: number }[], 
  additionalContext?: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  if (!isAIConfigured()) {
    return { success: false, error: 'AI service is not configured. Please set up your OpenAI API key.' };
  }

  const config = getAIConfig();
  
  const prompt = `You are an expert cover letter writer. Generate a compelling, personalized cover letter using the following professional template structure. Tailor all content to the specific job description and use the provided content chunks.

JOB DESCRIPTION:
Company: ${jobDescription.company}
Position: ${jobDescription.title}
Location: ${jobDescription.extractedInfo.location || 'Not specified'}
Experience Level: ${jobDescription.extractedInfo.experienceLevel || 'Not specified'}

Required Skills: ${jobDescription.extractedInfo.requiredSkills.join(', ')}
Preferred Skills: ${jobDescription.extractedInfo.preferredSkills.join(', ')}

Key Requirements:
${jobDescription.extractedInfo.requirements.map(req => `- ${req}`).join('\n')}

Key Responsibilities:
${jobDescription.extractedInfo.responsibilities.map(resp => `- ${resp}`).join('\n')}

${jobDescription.additionalContext ? `Additional Context: ${jobDescription.additionalContext}` : ''}

RELEVANT CONTENT CHUNKS (ordered by relevance):
${relevantChunks.map((item, idx) => `
${idx + 1}. [${item.chunk.type}] (Relevance: ${Math.round(item.score * 100)}%)
${item.chunk.text}
`).join('\n')}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}` : ''}

COVER LETTER STRUCTURE:

**HEADER:**
- Use current date
- Address to ${jobDescription.company} hiring team
- Professional business letter format

**OPENING PARAGRAPH:**
- Express interest in ${jobDescription.title} position at ${jobDescription.company}
- Mention years of relevant experience from chunks
- Include compelling hook about the company/role
- Show enthusiasm and initial value proposition

**BODY PARAGRAPH 1 - RELEVANT EXPERIENCE:**
- Highlight most relevant previous role from cv_experience chunks
- Include specific achievement with quantifiable results
- Connect experience directly to job requirements
- Use concrete examples from cv_experience_bullet chunks

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
2. Use real information from the provided chunks
3. Write a compelling, personalized letter for ${jobDescription.title} at ${jobDescription.company}
4. Include specific achievements with quantifiable results from chunks
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
    console.error('Error generating cover letter:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

// Show configuration instructions
export function showConfigInstructions(): void {
  const status = getConfigurationStatus();
  alert(
    'OpenAI API Configuration Required\n\n' +
    'To use the AI chunking feature, you need to configure your OpenAI API key:\n\n' +
    '1. Get an API key from https://platform.openai.com/api-keys\n' +
    '2. Copy your API key\n' +
    '3. Open the .env file in your project root\n' +
    '4. Replace "your_openai_api_key_here" with your actual API key\n' +
    '5. Restart the development server (npm run dev)\n\n' +
    `Current status: ${status.message}`
  );
}