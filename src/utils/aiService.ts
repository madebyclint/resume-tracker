import { ChunkParseResult, ChunkType } from '../types';

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
const CHUNKING_PROMPT = `You are an expert resume parser. Your task is to analyze the provided resume/cover letter text and break it down into semantic chunks for use in resume building.

Parse the text into the following chunk types:
- "summary": Professional summary or objective statements
- "skills": Technical skills, soft skills, or competencies 
- "experience_section": Job titles, company names, date ranges (headers of work experience)
- "experience_bullet": Individual bullet points describing accomplishments or responsibilities
- "mission_fit": Content about company culture fit, values alignment, or mission statements
- "cover_letter_intro": Opening paragraphs of cover letters
- "cover_letter_body": Main content paragraphs of cover letters  
- "cover_letter_closing": Closing paragraphs and sign-offs

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
      "type": "summary",
      "text": "Results-driven software engineer...",
      "tags": ["Software Engineering", "Leadership", "Problem Solving"],
      "order": 1
    }
  ]
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
            content: CHUNKING_PROMPT
          },
          {
            role: 'user',
            content: `Please parse this resume/cover letter text into semantic chunks:\n\n${text}`
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

      // Validate chunk structure
      const validChunks = parsed.chunks.filter((chunk: any) => {
        return chunk.type && chunk.text && chunk.tags && typeof chunk.order === 'number';
      });

      if (validChunks.length === 0) {
        return {
          chunks: [],
          success: false,
          error: 'No valid chunks found in AI response'
        };
      }

      return {
        chunks: validChunks,
        success: true
      };

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI response content:', content);
      
      return {
        chunks: [],
        success: false,
        error: 'Failed to parse AI response. The AI may have returned malformed JSON.'
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
    'header',
    'summary',
    'skills', 
    'experience_section',
    'experience_bullet',
    'mission_fit',
    'cover_letter_intro',
    'cover_letter_body',
    'cover_letter_closing'
  ];
  return validTypes.includes(type as ChunkType);
}

// Helper function to get human-readable chunk type names
export function getChunkTypeLabel(type: ChunkType): string {
  const labels: Record<ChunkType, string> = {
    header: 'Header',
    summary: 'Summary',
    skills: 'Skills',
    experience_section: 'Experience Section',
    experience_bullet: 'Experience Bullet',
    mission_fit: 'Mission Fit',
    cover_letter_intro: 'Cover Letter Intro',
    cover_letter_body: 'Cover Letter Body',
    cover_letter_closing: 'Cover Letter Closing'
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