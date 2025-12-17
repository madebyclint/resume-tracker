import { ExtractionError, TextExtractionResult, InputValidation } from '../types/scraperTypes';

export class ImageExtractor {
  private ocrService: OCRService | null = null;

  constructor() {
    // Initialize OCR service when available
    this.initializeOCR();
  }

  async extractText(base64Data: string): Promise<TextExtractionResult> {
    try {
      // Validate image first
      const validation = this.validateImage(base64Data);
      if (!validation.isValid) {
        throw new ExtractionError(`Image validation failed: ${validation.errors.join(', ')}`);
      }

      // For now, we'll provide a placeholder implementation
      // In production, this would integrate with an OCR service
      const text = await this.performOCR(base64Data);
      
      return {
        text,
        metadata: {
          confidence: this.calculateOCRConfidence(text),
          wordCount: text.split(/\s+/).filter(word => word.length > 0).length
        }
      };
    } catch (error) {
      if (error instanceof ExtractionError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ExtractionError(`Image text extraction failed: ${errorMessage}`, {
        originalError: error
      });
    }
  }

  private async performOCR(base64Data: string): Promise<string> {
    try {
      console.log('Starting Tesseract.js OCR processing...');
      
      // Dynamic import to reduce bundle size - only load when needed
      const { createWorker } = await import('tesseract.js');
      
      // Create Tesseract worker
      const worker = createWorker({
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      try {
        console.log('Loading English language data...');
        await (await worker).load();
        await (await worker).loadLanguage('eng');
        await (await worker).initialize('eng');
        
        console.log('Processing image with OCR...');
        
        // Perform OCR on the base64 image
        const result = await (await worker).recognize(base64Data);
        const extractedText = result.data.text?.trim();
        
        if (!extractedText || extractedText.length < 10) {
          throw new ExtractionError(
            'No readable text found in image. Please ensure the image contains clear, readable text.',
            { confidence: result.data.confidence }
          );
        }
        
        console.log(`OCR completed successfully. Extracted ${extractedText.length} characters with ${result.data.confidence}% confidence.`);
        
        return extractedText;
        
      } finally {
        // Always terminate the worker to free memory
        await (await worker).terminate();
      }
      
    } catch (error) {
      console.error('Tesseract.js OCR failed:', error);
      
      if (error instanceof ExtractionError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ExtractionError(
        `OCR processing failed: ${errorMessage}`,
        { 
          originalError: error,
          suggestion: 'Try using a higher quality image with clear, readable text'
        }
      );
    }
  }

  validateImage(base64Data: string): InputValidation {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!base64Data || typeof base64Data !== 'string') {
        errors.push('Invalid image data format');
        return { isValid: false, errors };
      }

      const imageInfo = this.getImageInfo(base64Data);

      // Validate file size (5MB limit for images)
      const maxSize = 5 * 1024 * 1024;
      if (imageInfo.size > maxSize) {
        errors.push(`Image file too large (${(imageInfo.size / 1024 / 1024).toFixed(1)}MB, max 5MB)`);
      }

      // Validate format
      const supportedFormats = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      if (!supportedFormats.includes(imageInfo.format.toLowerCase())) {
        errors.push(`Unsupported image format: ${imageInfo.format}. Supported: ${supportedFormats.join(', ')}`);
      }

      // Add warnings for potentially problematic images
      if (imageInfo.size < 50 * 1024) { // Less than 50KB
        warnings.push('Image file is very small, text extraction may be poor quality');
      }

      if (imageInfo.dimensions && (imageInfo.dimensions.width < 400 || imageInfo.dimensions.height < 300)) {
        warnings.push('Image resolution is low, text extraction accuracy may be reduced');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  private getImageInfo(base64Data: string): {
    format: string;
    size: number;
    dimensions?: { width: number; height: number };
  } {
    // Extract data URL header and base64 content
    const parts = base64Data.split(',');
    const header = parts[0] || '';
    const data = parts[1] || base64Data;
    
    // Extract format from data URL header
    const formatMatch = header.match(/image\/([a-zA-Z0-9]+)/);
    const format = formatMatch ? formatMatch[1] : 'unknown';
    
    // Calculate file size
    const size = Math.ceil(data.length * 3/4);
    
    // For now, we can't easily get dimensions without loading the image
    // This would typically be done by creating an Image element or using Canvas API
    return { format, size };
  }

  private calculateOCRConfidence(text: string): number {
    // Simple heuristic to estimate OCR confidence
    let confidence = 0.8; // Start with reasonable confidence for OCR
    
    // Reduce confidence for very short text
    if (text.length < 50) {
      confidence *= 0.6;
    }
    
    // Reduce confidence for text with many non-alphanumeric characters
    const alphanumericRatio = (text.match(/[a-zA-Z0-9]/g) || []).length / text.length;
    if (alphanumericRatio < 0.7) {
      confidence *= alphanumericRatio;
    }
    
    // Check for common OCR errors (multiple consecutive spaces, mixed case words)
    const multipleSpaces = (text.match(/\s{3,}/g) || []).length;
    if (multipleSpaces > 5) {
      confidence *= 0.7;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  private async initializeOCR() {
    // Placeholder for OCR service initialization
    // This would set up Tesseract.js or configure cloud OCR service credentials
    try {
      // Example: Initialize Tesseract.js
      // this.ocrService = new TesseractOCRService();
    } catch (error) {
      console.warn('OCR service initialization failed:', error);
    }
  }

  // Utility method to get image dimensions (requires DOM)
  async getImageDimensions(base64Data: string): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
          resolve(null);
        };
        img.src = base64Data;
      } catch (error) {
        resolve(null);
      }
    });
  }

  // Check if OCR service is available
  isOCRAvailable(): boolean {
    return this.ocrService !== null;
  }
}

// Interface for OCR service implementations
interface OCRService {
  extractText(imageData: string): Promise<string>;
  isAvailable(): boolean;
}

// Placeholder for future Tesseract.js implementation
class TesseractOCRService implements OCRService {
  async extractText(imageData: string): Promise<string> {
    throw new Error('Tesseract.js not yet implemented');
  }

  isAvailable(): boolean {
    return false;
  }
}