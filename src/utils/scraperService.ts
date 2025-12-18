import { 
  ScraperInput, 
  ScraperResult, 
  ParsedJobData, 
  InputValidation,
  ScraperError,
  ExtractionError,
  AIParsingError,
  DEFAULT_SCRAPER_CONFIG,
  ScraperConfig
} from '../types/scraperTypes';
import { PDFExtractor } from './pdfExtractor';
import { ImageExtractor } from './imageExtractor';
import { parseScrapedJobDescription } from './aiService';
import { getCachedScraperResult, cacheScraperResult } from '../storage';
// Removed crypto import - we'll use a simpler hash function for browser compatibility

export class ScraperService {
  private pdfExtractor: PDFExtractor;
  private imageExtractor: ImageExtractor;
  private config: ScraperConfig;

  constructor(config?: Partial<ScraperConfig>) {
    this.pdfExtractor = new PDFExtractor();
    this.imageExtractor = new ImageExtractor();
    this.config = { ...DEFAULT_SCRAPER_CONFIG, ...config };
  }

  async processInput(input: ScraperInput): Promise<ScraperResult> {
    const startTime = Date.now();
    
    try {
      // 1. Validate input
      const validation = this.validateInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          confidence: 0,
          processingTime: Date.now() - startTime,
          aiUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0 }
        };
      }

      // 2. Check cache first
      const inputHash = this.createInputHash(input);
      const cachedResult = await getCachedScraperResult(inputHash);
      if (cachedResult) {
        console.log('Using cached scraper result');
        return {
          ...cachedResult,
          processingTime: Date.now() - startTime // Update processing time
        };
      }

      // 3. Extract raw text based on input type
      const extractedText = await this.extractText(input);
      
      // 4. Validate extracted text quality
      const textValidation = this.validateExtractedText(extractedText);
      if (!textValidation.isValid) {
        return {
          success: false,
          extractedText,
          errors: textValidation.errors,
          confidence: 0,
          processingTime: Date.now() - startTime,
          aiUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0 }
        };
      }

      // 5. Parse with AI
      const aiResult = await parseScrapedJobDescription(extractedText, input.type);
      
      if (!aiResult.success) {
        return {
          success: false,
          extractedText,
          errors: aiResult.errors,
          confidence: aiResult.confidence,
          processingTime: Date.now() - startTime,
          aiUsage: aiResult.aiUsage
        };
      }

      // 6. Validate and clean parsed data
      const validatedData = this.validateParsedData(aiResult.parsedData!);
      
      // 7. Calculate final confidence
      const finalConfidence = this.calculateConfidence(validatedData, extractedText);

      const result: ScraperResult = {
        success: true,
        extractedText,
        parsedData: validatedData,
        confidence: finalConfidence,
        errors: [],
        processingTime: Date.now() - startTime,
        aiUsage: aiResult.aiUsage
      };

      // 8. Cache the result
      await cacheScraperResult(inputHash, result);

      return result;

    } catch (error) {
      console.error('ScraperService processing error:', error);
      
      return {
        success: false,
        errors: [error instanceof ScraperError ? error.message : `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        confidence: 0,
        processingTime: Date.now() - startTime,
        aiUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0 }
      };
    }
  }

  validateInput(input: ScraperInput): InputValidation {
    const errors: string[] = [];
    
    if (!input) {
      errors.push('Input is required');
      return { isValid: false, errors };
    }

    if (!input.type || !['pdf', 'image', 'text', 'url'].includes(input.type)) {
      errors.push('Invalid input type. Must be pdf, image, text, or url');
    }

    if (!input.content || typeof input.content !== 'string') {
      errors.push('Input content is required');
    }

    // Type-specific validation
    switch (input.type) {
      case 'pdf':
        // PDF validation removed - not supported in production version
        errors.push('PDF processing is not available in this version');
        break;
        
      case 'image':
        const imageValidation = this.imageExtractor.validateImage(input.content);
        if (!imageValidation.isValid) {
          errors.push(...imageValidation.errors);
        }
        break;
        
      case 'text':
        if (input.content.length < 50) {
          errors.push('Text content too short (minimum 50 characters)');
        }
        if (input.content.length > 50000) {
          errors.push('Text content too long (maximum 50,000 characters)');
        }
        break;
        
      case 'url':
        if (!this.isValidURL(input.content)) {
          errors.push('Invalid URL format');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async extractText(input: ScraperInput): Promise<string> {
    switch (input.type) {
      case 'pdf':
        throw new ExtractionError('PDF processing is not supported in this version');
        
      case 'image':
        throw new ExtractionError('Image processing is not supported in this version');
        
      case 'text':
        return input.content;
        
      case 'url':
        return await this.extractFromURL(input.content);
        
      default:
        throw new ExtractionError(`Unsupported input type: ${input.type}`);
    }
  }

  private async extractFromURL(url: string): Promise<string> {
    // Placeholder for URL content extraction
    // This would need to be implemented with a backend service or proxy
    // due to CORS restrictions in browsers
    throw new ExtractionError(
      'URL content extraction not yet implemented. Please copy and paste the job description text instead.',
      {
        suggestion: 'Use copy/paste or screenshot capture for now'
      }
    );
  }

  private validateExtractedText(text: string): InputValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!text || text.trim().length === 0) {
      errors.push('No text content extracted');
      return { isValid: false, errors };
    }

    if (text.length < 100) {
      errors.push('Extracted text is too short to be a valid job description');
    }

    if (text.length > 50000) {
      errors.push('Extracted text is too long');
    }

    // Check for common extraction issues
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 20) {
      errors.push('Text appears to have too few words for a job description');
    }

    // Check for excessive special characters (OCR artifacts)
    const specialCharRatio = (text.match(/[^\w\s.,!?;:()\-]/g) || []).length / text.length;
    if (specialCharRatio > 0.2) {
      warnings.push('Text contains many special characters, extraction quality may be poor');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateParsedData(data: ParsedJobData): ParsedJobData {
    // Clean and validate parsed data
    const validated: ParsedJobData = {
      ...data,
      skills: {
        required: data.skills?.required || [],
        preferred: data.skills?.preferred || []
      }
    };

    // Clean up string fields
    if (validated.role) {
      validated.role = this.cleanString(validated.role);
    }
    if (validated.company) {
      validated.company = this.cleanString(validated.company);
    }
    if (validated.location) {
      validated.location = this.cleanString(validated.location);
    }
    if (validated.summary) {
      validated.summary = this.cleanString(validated.summary);
    }

    // Validate and normalize work type
    if (validated.workType && !['hybrid', 'remote', 'office'].includes(validated.workType)) {
      validated.workType = this.normalizeWorkType(validated.workType);
    }

    // Clean up skills arrays
    if (validated.skills.required) {
      validated.skills.required = validated.skills.required
        .map(skill => this.cleanString(skill))
        .filter(skill => skill.length > 0);
    }
    if (validated.skills.preferred) {
      validated.skills.preferred = validated.skills.preferred
        .map(skill => this.cleanString(skill))
        .filter(skill => skill.length > 0);
    }

    // Validate salary data
    if (validated.salary) {
      if (validated.salary.min && validated.salary.max && validated.salary.min > validated.salary.max) {
        // Swap if min is greater than max
        [validated.salary.min, validated.salary.max] = [validated.salary.max, validated.salary.min];
      }
    }

    return validated;
  }

  calculateConfidence(data: ParsedJobData, originalText: string): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on extracted fields
    const fields = [
      data.role, data.company, data.location, data.summary,
      data.skills.required?.length, data.skills.preferred?.length
    ];
    
    const populatedFields = fields.filter(field => 
      field && (typeof field === 'string' ? field.trim().length > 0 : field > 0)
    ).length;
    
    confidence += (populatedFields / fields.length) * 0.3;
    
    // Increase confidence if key job-related terms are present
    const jobTerms = [
      'experience', 'requirements', 'responsibilities', 'qualifications',
      'skills', 'salary', 'benefits', 'apply', 'position', 'role'
    ];
    
    const textLower = originalText.toLowerCase();
    const foundTerms = jobTerms.filter(term => textLower.includes(term)).length;
    confidence += (foundTerms / jobTerms.length) * 0.2;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private cleanString(str: string): string {
    return str.trim().replace(/\s+/g, ' ').replace(/[^\w\s.,!?;:()\-]/g, '');
  }

  private normalizeWorkType(workType: string): 'hybrid' | 'remote' | 'office' {
    const type = workType.toLowerCase();
    
    if (type.includes('remote') || type.includes('work from home') || type.includes('wfh')) {
      return 'remote';
    }
    if (type.includes('hybrid') || type.includes('flexible')) {
      return 'hybrid';
    }
    if (type.includes('office') || type.includes('on-site') || type.includes('in-person')) {
      return 'office';
    }
    
    return 'office'; // Default
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private createInputHash(input: ScraperInput): string {
    // Create a simple hash of the input for caching purposes
    const hashContent = `${input.type}:${input.content}`;
    let hash = 0;
    
    for (let i = 0; i < hashContent.length; i++) {
      const char = hashContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  // Utility method to get processing stats
  getProcessingStats(): {
    supportedTypes: string[];
    maxFileSizes: Record<string, number>;
    isOCRAvailable: boolean;
  } {
    return {
      supportedTypes: ['pdf', 'image', 'text', 'url'],
      maxFileSizes: this.config.maxFileSize,
      isOCRAvailable: this.imageExtractor.isOCRAvailable()
    };
  }
}