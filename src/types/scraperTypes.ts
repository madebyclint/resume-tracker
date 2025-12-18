// Job Description Scraper - Type Definitions

export interface ScraperInput {
  id: string;
  type: 'pdf' | 'image' | 'text' | 'url';
  content: string; // base64 for files, raw text for text/url
  fileName?: string;
  fileSize?: number;
  uploadDate: string;
}

export interface ScraperResult {
  success: boolean;
  extractedText?: string;
  parsedData?: ParsedJobData;
  confidence: number;
  errors: string[];
  processingTime: number;
  aiUsage: AIUsageMetrics;
}

export interface ParsedJobData {
  url?: string;
  role?: string;
  company?: string;
  location?: string;
  workType?: 'hybrid' | 'remote' | 'office';
  summary?: string;
  skills: {
    required: string[];
    preferred: string[];
  };
  deadlines?: {
    application?: string;
    startDate?: string;
  };
  salary?: {
    min?: number;
    max?: number;
    range?: string;
    currency?: string;
  };
  companyInfo?: {
    description?: string;
    industry?: string;
    size?: string;
  };
  benefits?: string[];
  requirements?: string[];
  responsibilities?: string[];
  additionalInfo?: Record<string, any>;
}

export interface AIUsageMetrics {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface CaptureOptions {
  type: 'screenshot' | 'pdf';
  fullPage: boolean;
  quality?: number;
  format?: 'png' | 'jpeg' | 'pdf';
}

export interface ExtensionCaptureData {
  type: 'screenshot' | 'pdf';
  data: string; // base64
  metadata: {
    url: string;
    title: string;
    timestamp: string;
    dimensions?: { width: number; height: number };
    fileSize: number;
  };
}

export interface ScraperCache {
  id: string;
  inputHash: string;
  result: ScraperResult;
  timestamp: string;
  expiresAt: string;
}

export interface InputValidation {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface TextExtractionResult {
  text: string;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    confidence?: number;
  };
}

export interface ScraperConfig {
  maxFileSize: {
    pdf: number;
    image: number;
  };
  supportedFormats: {
    pdf: string[];
    image: string[];
  };
  processing: {
    timeout: number;
    maxRetries: number;
    cacheExpiry: number;
  };
  ai: {
    maxTokens: number;
    temperature: number;
    model: string;
  };
}

// Default configuration
export const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  maxFileSize: {
    pdf: 10 * 1024 * 1024, // 10MB
    image: 5 * 1024 * 1024, // 5MB
  },
  supportedFormats: {
    pdf: ['pdf'],
    image: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  },
  processing: {
    timeout: 60000, // 60 seconds
    maxRetries: 3,
    cacheExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  ai: {
    maxTokens: 2000,
    temperature: 0.1,
    model: 'gpt-3.5-turbo',
  },
};

// Error types
export class ScraperError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}

export class FileValidationError extends ScraperError {
  constructor(message: string, details?: any) {
    super(message, 'FILE_VALIDATION_ERROR', details);
  }
}

export class ExtractionError extends ScraperError {
  constructor(message: string, details?: any) {
    super(message, 'EXTRACTION_ERROR', details);
  }
}

export class AIParsingError extends ScraperError {
  constructor(message: string, details?: any) {
    super(message, 'AI_PARSING_ERROR', details);
  }
}

// Additional type definitions for UI components
export type ScraperStep = 'input' | 'extraction' | 'ai-processing' | 'preview';