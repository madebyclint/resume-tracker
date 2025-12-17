import { ScraperInput, InputValidation } from '../types/scraperTypes';

export class ScraperValidation {
  static validateInput(input: ScraperInput): InputValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
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

    if (!input.id || typeof input.id !== 'string') {
      errors.push('Input ID is required');
    }

    // Type-specific validation
    switch (input.type) {
      case 'pdf':
        this.validatePDFInput(input, errors, warnings);
        break;
      case 'image':
        this.validateImageInput(input, errors, warnings);
        break;
      case 'text':
        this.validateTextInput(input, errors, warnings);
        break;
      case 'url':
        this.validateURLInput(input, errors, warnings);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private static validatePDFInput(input: ScraperInput, errors: string[], warnings: string[]) {
    if (!input.content.startsWith('data:') && !this.isBase64(input.content)) {
      errors.push('PDF content must be base64 encoded or a data URL');
    }

    // Check file size if available
    if (input.fileSize && input.fileSize > 10 * 1024 * 1024) {
      errors.push('PDF file too large (maximum 10MB)');
    }

    // Check for PDF signature in base64 content
    try {
      const base64Content = input.content.includes(',') 
        ? input.content.split(',')[1] 
        : input.content;
      
      const binaryData = atob(base64Content.substring(0, 20));
      if (!binaryData.startsWith('%PDF-')) {
        warnings.push('File may not be a valid PDF document');
      }
    } catch {
      errors.push('Invalid base64 encoding for PDF content');
    }
  }

  private static validateImageInput(input: ScraperInput, errors: string[], warnings: string[]) {
    if (!input.content.startsWith('data:image/') && !this.isBase64(input.content)) {
      errors.push('Image content must be base64 encoded or a data URL');
    }

    // Check file size if available
    if (input.fileSize && input.fileSize > 5 * 1024 * 1024) {
      errors.push('Image file too large (maximum 5MB)');
    }

    // Extract and validate image format
    if (input.content.startsWith('data:image/')) {
      const formatMatch = input.content.match(/data:image\/([a-zA-Z0-9]+);/);
      if (formatMatch) {
        const format = formatMatch[1].toLowerCase();
        const supportedFormats = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
        if (!supportedFormats.includes(format)) {
          errors.push(`Unsupported image format: ${format}`);
        }
      }
    }

    // Estimate file size from base64 if not provided
    if (!input.fileSize && input.content) {
      const base64Content = input.content.includes(',') 
        ? input.content.split(',')[1] 
        : input.content;
      
      const estimatedSize = Math.ceil(base64Content.length * 3/4);
      if (estimatedSize < 50 * 1024) {
        warnings.push('Image appears to be very small, text extraction may be poor');
      }
    }
  }

  private static validateTextInput(input: ScraperInput, errors: string[], warnings: string[]) {
    if (input.content.length < 50) {
      errors.push('Text content too short (minimum 50 characters)');
    }

    if (input.content.length > 50000) {
      errors.push('Text content too long (maximum 50,000 characters)');
    }

    // Check for common job description indicators
    const jobKeywords = ['position', 'role', 'job', 'company', 'experience', 'skills', 'requirements'];
    const contentLower = input.content.toLowerCase();
    const foundKeywords = jobKeywords.filter(keyword => contentLower.includes(keyword));
    
    if (foundKeywords.length < 2) {
      warnings.push('Text may not contain a job description');
    }
  }

  private static validateURLInput(input: ScraperInput, errors: string[], warnings: string[]) {
    try {
      const url = new URL(input.content);
      
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('Only HTTP and HTTPS URLs are supported');
      }
      
      // Common job board domains
      const jobBoardDomains = [
        'linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com',
        'careerbuilder.com', 'ziprecruiter.com', 'angel.co', 'jobs.com'
      ];
      
      const isJobBoard = jobBoardDomains.some(domain => url.hostname.includes(domain));
      if (!isJobBoard) {
        warnings.push('URL does not appear to be from a recognized job board');
      }
      
    } catch {
      errors.push('Invalid URL format');
    }
  }

  private static isBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }

  static validateExtractedText(text: string): InputValidation {
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

    // Check word count
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount < 20) {
      errors.push('Text appears to have too few words for a job description');
    }

    // Check for excessive special characters (OCR artifacts)
    const specialCharRatio = (text.match(/[^\w\s.,!?;:()\-]/g) || []).length / text.length;
    if (specialCharRatio > 0.2) {
      warnings.push('Text contains many special characters, extraction quality may be poor');
    }

    // Check for repeated characters (OCR errors)
    const repeatedChars = text.match(/(.)\1{4,}/g);
    if (repeatedChars && repeatedChars.length > 3) {
      warnings.push('Text contains repeated characters, may indicate OCR errors');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  static calculateConfidenceScore(
    extractedText: string,
    inputType: 'pdf' | 'image' | 'text' | 'url'
  ): number {
    let confidence = 0.5; // Base confidence

    // Adjust based on input type
    switch (inputType) {
      case 'text':
        confidence += 0.3; // Text has highest confidence
        break;
      case 'pdf':
        confidence += 0.2; // PDF is usually good quality
        break;
      case 'url':
        confidence += 0.15; // URL extraction can be variable
        break;
      case 'image':
        confidence += 0.05; // OCR has lowest confidence
        break;
    }

    // Adjust based on content quality
    const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount > 100) {
      confidence += 0.1;
    }
    if (wordCount > 300) {
      confidence += 0.1;
    }

    // Check for job-related keywords
    const jobKeywords = [
      'experience', 'requirements', 'responsibilities', 'qualifications',
      'skills', 'salary', 'benefits', 'apply', 'position', 'role', 'job'
    ];
    
    const textLower = extractedText.toLowerCase();
    const foundKeywords = jobKeywords.filter(keyword => textLower.includes(keyword)).length;
    confidence += (foundKeywords / jobKeywords.length) * 0.15;

    // Check for structured content indicators
    const structureIndicators = ['•', '-', '*', '1.', '2.', '3.', 'requirements:', 'responsibilities:'];
    const foundStructure = structureIndicators.filter(indicator => 
      textLower.includes(indicator.toLowerCase())
    ).length;
    
    if (foundStructure > 2) {
      confidence += 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }
}