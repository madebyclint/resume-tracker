import * as pdfjsLib from 'pdfjs-dist';
import { ExtractionError, TextExtractionResult } from '../types/scraperTypes';

export class PDFExtractor {
  private isInitialized = false;

  constructor() {
    this.initializePDFJS();
  }

  private initializePDFJS() {
    if (!this.isInitialized) {
      // Set up PDF.js worker - use jsdelivr CDN which is more reliable
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs';
      this.isInitialized = true;
    }
  }

  async extractText(base64Data: string): Promise<TextExtractionResult> {
    try {
      this.initializePDFJS();
      
      // Convert base64 to Uint8Array
      const binaryData = this.base64ToUint8Array(base64Data);
      
      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: binaryData }).promise;
      const textContent: string[] = [];
      let totalWords = 0;

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          
          const pageText = content.items
            .map((item: any) => item.str)
            .join(' ')
            .trim();
          
          if (pageText) {
            textContent.push(pageText);
            totalWords += pageText.split(/\s+/).length;
          }
        } catch (pageError) {
          console.warn(`Failed to extract text from page ${pageNum}:`, pageError);
          // Continue with other pages
        }
      }

      const fullText = textContent.join('\n\n').trim();
      
      if (!fullText) {
        throw new ExtractionError('No text content found in PDF');
      }

      return {
        text: fullText,
        metadata: {
          pageCount: pdf.numPages,
          wordCount: totalWords,
          confidence: this.calculateTextConfidence(fullText)
        }
      };
    } catch (error) {
      if (error instanceof ExtractionError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ExtractionError(`PDF text extraction failed: ${errorMessage}`, {
        originalError: error
      });
    }
  }

  async extractMetadata(base64Data: string): Promise<{
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
    pageCount?: number;
  }> {
    try {
      this.initializePDFJS();
      
      const binaryData = this.base64ToUint8Array(base64Data);
      const pdf = await pdfjsLib.getDocument({ data: binaryData }).promise;
      const metadata = await pdf.getMetadata();
      
      const info = metadata.info as any;
      return {
        ...info,
        pageCount: pdf.numPages,
        // Convert date strings to Date objects if they exist
        creationDate: info?.CreationDate ? new Date(info.CreationDate) : undefined,
        modificationDate: info?.ModDate ? new Date(info.ModDate) : undefined,
      };
    } catch (error) {
      console.warn('PDF metadata extraction failed:', error);
      return {};
    }
  }

  private base64ToUint8Array(base64Data: string): Uint8Array {
    // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
    const base64Content = base64Data.includes(',') 
      ? base64Data.split(',')[1] 
      : base64Data;
    
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  }

  private calculateTextConfidence(text: string): number {
    // Simple heuristic to estimate text extraction confidence
    let confidence = 1.0;
    
    // Reduce confidence for very short text
    if (text.length < 100) {
      confidence *= 0.5;
    }
    
    // Reduce confidence for text with many special characters (OCR errors)
    const specialCharRatio = (text.match(/[^\w\s.,!?;:()\-]/g) || []).length / text.length;
    if (specialCharRatio > 0.1) {
      confidence *= (1 - specialCharRatio);
    }
    
    // Reduce confidence if text has poor word structure
    const words = text.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    if (avgWordLength < 2) {
      confidence *= 0.3;
    } else if (avgWordLength > 15) {
      confidence *= 0.7;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  validatePDF(base64Data: string): {
    isValid: boolean;
    errors: string[];
    fileInfo?: {
      size: number;
      format: string;
    };
  } {
    try {
      const errors: string[] = [];
      
      // Check if it's a valid base64 string
      if (!base64Data || typeof base64Data !== 'string') {
        errors.push('Invalid PDF data format');
        return { isValid: false, errors };
      }
      
      // Extract base64 content
      const base64Content = base64Data.includes(',') 
        ? base64Data.split(',')[1] 
        : base64Data;
      
      // Validate base64 format
      try {
        atob(base64Content);
      } catch {
        errors.push('Invalid base64 encoding');
        return { isValid: false, errors };
      }
      
      // Calculate file size
      const fileSize = Math.ceil(base64Content.length * 3/4);
      
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024;
      if (fileSize > maxSize) {
        errors.push(`PDF file too large (${(fileSize / 1024 / 1024).toFixed(1)}MB, max 10MB)`);
      }
      
      // Check for PDF signature
      const binaryData = atob(base64Content.substring(0, 20));
      if (!binaryData.startsWith('%PDF-')) {
        errors.push('File does not appear to be a valid PDF');
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        fileInfo: {
          size: fileSize,
          format: 'pdf'
        }
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`PDF validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}