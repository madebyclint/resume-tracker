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