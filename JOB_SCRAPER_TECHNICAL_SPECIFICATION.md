# Job Description Scraper - Technical Specification

## Executive Summary

This technical specification outlines the implementation of an enhanced job description scraper feature for the Resume Tracker application. The feature will support multiple input methods (PDF upload, image upload, copy/paste text) with AI-powered parsing, and enhance the existing browser extension with screenshot/PDF capture capabilities.

## 1. Feature Requirements Analysis

### 1.1 Core Requirements
- **Multi-Modal Upload**: Support PDF files, screenshot images, and copy/paste text input
- **AI-Powered Parsing**: Extract structured data from unstructured job description content
- **Browser Extension Enhancement**: Add page capture capabilities with user-triggered actions
- **Data Extraction**: Parse URL, role, location, work type, salary, skills, deadlines, and company information
- **Preview & Validation**: Allow users to preview and modify extracted data before processing

### 1.2 Integration Requirements  
- Seamless integration with existing JobDescriptionsPage and job management workflow
- Leverage existing AI service infrastructure (aiService.ts)
- Maintain compatibility with current storage and type systems
- Preserve existing browser extension functionality while adding new features

### 1.3 Compliance Requirements
- Legal/ethical job scraping practices (no automated/bulk scraping)
- User-initiated actions only for browser extension captures
- Data privacy and security best practices
- GDPR/CCPA compliant data handling

## 2. System Architecture

### 2.1 Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Job Scraper Feature                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │   Upload Modes  │ │   AI Processing │ │ Browser Extension││
│  │                 │ │                 │ │                 ││
│  │ • PDF Upload    │ │ • Text Extract  │ │ • Screenshot    ││
│  │ • Image Upload  │ │ • AI Parse      │ │ • PDF Capture   ││
│  │ • Copy/Paste    │ │ • Data Validate │ │ • Preview       ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                  Core Integration Layer                     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │  Job Management │ │   AI Service    │ │    Storage      │ │
│ │                 │ │                 │ │                 │ │
│ │ • JobDescPage   │ │ • aiService.ts  │ │ • IndexedDB     │ │
│ │ • JobTable      │ │ • Parsing Logic │ │ • Types System  │ │
│ │ • Status Mgmt   │ │ • Cost Tracking │ │ • State Mgmt    │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Architecture

```
User Input (PDF/Image/Text)
    ↓
Input Validation & File Processing
    ↓
Content Extraction (PDF.js/Canvas/Direct)
    ↓
AI Parsing Service (GPT-3.5/4)
    ↓
Data Validation & Cleanup
    ↓
Preview Modal (User Review)
    ↓
Job Description Creation
    ↓
Storage & State Update
    ↓
JobDescriptionsPage Integration
```

### 2.3 Browser Extension Data Flow

```
User on Job Site
    ↓
Extension Popup (User Action)
    ↓
Capture Options (Screenshot/PDF)
    ↓
Content Script Capture
    ↓
Preview in Extension Popup
    ↓
Send to Main App
    ↓
AI Processing Pipeline
    ↓
Job Management System
```

## 3. Technical Implementation Plan

### 3.1 File Structure

```
src/
├── components/
│   ├── JobScraperModal.tsx              # New: Main scraper interface
│   ├── FileUploadSection.tsx            # Enhanced: Add image/PDF support
│   ├── JobPreviewModal.tsx              # New: Preview extracted data
│   ├── ScraperUploadZone.tsx           # New: Multi-format upload component
│   └── ScraperStatusIndicator.tsx       # New: Processing status display
├── utils/
│   ├── aiService.ts                     # Enhanced: Add scraper parsing
│   ├── scraperService.ts                # New: Core scraper logic
│   ├── pdfExtractor.ts                  # New: PDF content extraction
│   ├── imageExtractor.ts                # New: OCR/image processing
│   ├── contentProcessor.ts              # New: Multi-format processing
│   └── scraperValidation.ts             # New: Input validation
├── types/
│   └── scraperTypes.ts                  # New: Scraper-specific types
└── pages/
    └── JobDescriptionsPage.tsx          # Enhanced: Add scraper integration

extension/
├── content-script.js                    # Enhanced: Add capture capabilities
├── popup.html                           # Enhanced: Add capture UI
├── popup.js                             # Enhanced: Add capture logic
├── capture-handler.js                   # New: Screenshot/PDF capture
└── manifest.json                        # Enhanced: Add capture permissions
```

### 3.2 New Type Definitions

```typescript
// src/types/scraperTypes.ts
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
```

### 3.3 Core Components Implementation

#### 3.3.1 JobScraperModal Component

```typescript
// src/components/JobScraperModal.tsx
interface JobScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated: (job: JobDescription) => void;
  initialData?: Partial<ScraperInput>;
}

export function JobScraperModal({ isOpen, onClose, onJobCreated, initialData }: JobScraperModalProps) {
  const [step, setStep] = useState<'input' | 'processing' | 'preview'>('input');
  const [input, setInput] = useState<ScraperInput | null>(null);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Multi-step workflow implementation
  // File upload handling
  // AI processing coordination
  // Preview and validation
  // Job creation finalization
}
```

#### 3.3.2 ScraperService Implementation

```typescript
// src/utils/scraperService.ts
export class ScraperService {
  private aiService: AIService;
  private pdfExtractor: PDFExtractor;
  private imageExtractor: ImageExtractor;

  constructor() {
    this.aiService = new AIService();
    this.pdfExtractor = new PDFExtractor();
    this.imageExtractor = new ImageExtractor();
  }

  async processInput(input: ScraperInput): Promise<ScraperResult> {
    const startTime = Date.now();
    try {
      // 1. Extract raw text based on input type
      const extractedText = await this.extractText(input);
      
      // 2. Validate text quality
      const validation = this.validateExtractedText(extractedText);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors, /* ... */ };
      }

      // 3. Parse with AI
      const parsedData = await this.parseWithAI(extractedText);
      
      // 4. Validate parsed data
      const validatedData = this.validateParsedData(parsedData);
      
      return {
        success: true,
        extractedText,
        parsedData: validatedData,
        confidence: this.calculateConfidence(validatedData),
        errors: [],
        processingTime: Date.now() - startTime,
        aiUsage: this.getAIUsage()
      };
    } catch (error) {
      return {
        success: false,
        errors: [error.message],
        confidence: 0,
        processingTime: Date.now() - startTime,
        aiUsage: this.getAIUsage()
      };
    }
  }

  private async extractText(input: ScraperInput): Promise<string> {
    switch (input.type) {
      case 'pdf':
        return await this.pdfExtractor.extractText(input.content);
      case 'image':
        return await this.imageExtractor.extractText(input.content);
      case 'text':
        return input.content;
      case 'url':
        return await this.extractFromURL(input.content);
      default:
        throw new Error(`Unsupported input type: ${input.type}`);
    }
  }
}
```

### 3.4 Browser Extension Enhancements

#### 3.4.1 Enhanced Content Script

```javascript
// extension/content-script.js (additions)
class JobDescriptionExtractor {
  constructor() {
    this.jobData = null;
    this.isExtracted = false;
    this.captureHandler = new CaptureHandler(); // New
  }

  // New capture methods
  async captureScreenshot(options = { fullPage: true, format: 'png' }) {
    try {
      const canvas = await this.captureHandler.takeScreenshot(options);
      const imageData = canvas.toDataURL(`image/${options.format}`, 0.9);
      
      return {
        type: 'screenshot',
        data: imageData,
        metadata: {
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString(),
          dimensions: {
            width: canvas.width,
            height: canvas.height
          },
          fileSize: this.estimateBase64Size(imageData)
        }
      };
    } catch (error) {
      throw new Error(`Screenshot capture failed: ${error.message}`);
    }
  }

  async capturePDF() {
    try {
      // Use browser's print-to-PDF capability
      const pdfData = await this.captureHandler.generatePDF();
      
      return {
        type: 'pdf',
        data: pdfData,
        metadata: {
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString(),
          fileSize: this.estimateBase64Size(pdfData)
        }
      };
    } catch (error) {
      throw new Error(`PDF capture failed: ${error.message}`);
    }
  }
}

// New capture handler class
class CaptureHandler {
  async takeScreenshot(options) {
    return new Promise((resolve, reject) => {
      // Use chrome.tabs.captureVisibleTab via message to background script
      chrome.runtime.sendMessage({
        action: 'captureScreenshot',
        options: options
      }, (response) => {
        if (response.success) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
          };
          img.src = response.imageData;
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  async generatePDF() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'capturePDF'
      }, (response) => {
        if (response.success) {
          resolve(response.pdfData);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }
}
```

#### 3.4.2 Enhanced Popup Interface

```javascript
// extension/popup.js (additions)
class PopupController {
  constructor() {
    // ... existing code ...
    this.captureMode = 'extract'; // 'extract' | 'screenshot' | 'pdf'
    this.initializeCaptureUI();
  }

  initializeCaptureUI() {
    // Add capture mode selector
    this.captureModeSelect = document.getElementById('captureMode');
    this.screenshotBtn = document.getElementById('screenshotBtn');
    this.pdfBtn = document.getElementById('pdfBtn');
    this.previewArea = document.getElementById('previewArea');

    // Bind capture events
    this.screenshotBtn.addEventListener('click', () => this.captureScreenshot());
    this.pdfBtn.addEventListener('click', () => this.capturePDF());
    this.captureModeSelect.addEventListener('change', (e) => {
      this.captureMode = e.target.value;
      this.updateCaptureUI();
    });
  }

  async captureScreenshot() {
    try {
      this.showStatus('loading', 'Capturing screenshot...');
      
      const response = await this.sendMessageToContentScript({
        action: 'captureScreenshot',
        options: { fullPage: true, format: 'png' }
      });

      if (response.success) {
        this.showCapturePreview(response.data);
        this.showStatus('success', 'Screenshot captured successfully!');
      } else {
        this.showStatus('error', response.error || 'Screenshot capture failed');
      }
    } catch (error) {
      this.showStatus('error', `Capture error: ${error.message}`);
    }
  }

  showCapturePreview(captureData) {
    this.capturedData = captureData;
    
    if (captureData.type === 'screenshot') {
      const img = document.createElement('img');
      img.src = captureData.data;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '200px';
      this.previewArea.innerHTML = '';
      this.previewArea.appendChild(img);
    } else if (captureData.type === 'pdf') {
      this.previewArea.innerHTML = `
        <div class="pdf-preview">
          <i class="fa fa-file-pdf"></i>
          <span>PDF captured (${this.formatFileSize(captureData.metadata.fileSize)})</span>
        </div>
      `;
    }

    this.previewArea.style.display = 'block';
    this.updateButton('Send Capture to App', false);
  }
}
```

### 3.5 AI Service Enhancements

```typescript
// src/utils/aiService.ts (additions)
export async function parseScrapedJobDescription(
  rawText: string,
  inputType: 'pdf' | 'image' | 'text' | 'url'
): Promise<{
  success: boolean;
  parsedData?: ParsedJobData;
  confidence: number;
  errors: string[];
  aiUsage: AIUsageMetrics;
}> {
  const config = getAIConfig();
  if (!config.apiKey) {
    return {
      success: false,
      errors: ['AI service not configured'],
      confidence: 0,
      aiUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0 }
    };
  }

  const prompt = buildJobScrapingPrompt(rawText, inputType);
  
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: JOB_SCRAPER_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiUsage = calculateAIUsage(data.usage);
    
    // Parse JSON response
    const parsedData = JSON.parse(data.choices[0].message.content);
    const confidence = calculateParsingConfidence(parsedData, rawText);
    
    return {
      success: true,
      parsedData,
      confidence,
      errors: [],
      aiUsage
    };
  } catch (error) {
    return {
      success: false,
      errors: [error.message],
      confidence: 0,
      aiUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0 }
    };
  }
}

const JOB_SCRAPER_SYSTEM_PROMPT = `You are an expert job description parser. Extract structured data from job postings in any format (text, PDF content, or OCR'd images). Return valid JSON only.

Required output format:
{
  "url": "string (if detectable)",
  "role": "string",
  "company": "string", 
  "location": "string",
  "workType": "remote|hybrid|office",
  "summary": "string (2-3 sentences)",
  "skills": {
    "required": ["skill1", "skill2"],
    "preferred": ["skill3", "skill4"]
  },
  "deadlines": {
    "application": "YYYY-MM-DD or null",
    "startDate": "YYYY-MM-DD or null"
  },
  "salary": {
    "min": number or null,
    "max": number or null,
    "range": "string representation",
    "currency": "USD|EUR|GBP etc."
  },
  "companyInfo": {
    "description": "string",
    "industry": "string",
    "size": "startup|small|medium|large|enterprise"
  },
  "benefits": ["benefit1", "benefit2"],
  "requirements": ["req1", "req2"],
  "responsibilities": ["resp1", "resp2"]
}

Rules:
- Extract all available information, use null for missing data
- Normalize salary to annual figures when possible
- Infer work type from job description context
- Use consistent skill formatting (lowercase, standardized terms)
- Return only the JSON object, no explanations`;
```

### 3.6 PDF and Image Processing Utilities

```typescript
// src/utils/pdfExtractor.ts
import * as pdfjsLib from 'pdfjs-dist';

export class PDFExtractor {
  constructor() {
    // Set up PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }

  async extractText(base64Data: string): Promise<string> {
    try {
      // Convert base64 to Uint8Array
      const binaryString = atob(base64Data.split(',')[1]);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const textContent = [];

      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ')
          .trim();
        
        if (pageText) {
          textContent.push(pageText);
        }
      }

      const fullText = textContent.join('\n\n').trim();
      
      if (!fullText) {
        throw new Error('No text content found in PDF');
      }

      return fullText;
    } catch (error) {
      throw new Error(`PDF text extraction failed: ${error.message}`);
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
  }> {
    try {
      const binaryString = atob(base64Data.split(',')[1]);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const metadata = await pdf.getMetadata();
      
      return metadata.info || {};
    } catch (error) {
      console.warn('PDF metadata extraction failed:', error);
      return {};
    }
  }
}
```

```typescript
// src/utils/imageExtractor.ts
export class ImageExtractor {
  async extractText(base64Data: string): Promise<string> {
    try {
      // For now, return a placeholder implementation
      // In production, this would integrate with an OCR service like:
      // - Google Cloud Vision API
      // - AWS Textract  
      // - Azure Computer Vision
      // - Tesseract.js (client-side OCR)
      
      return await this.performOCR(base64Data);
    } catch (error) {
      throw new Error(`Image text extraction failed: ${error.message}`);
    }
  }

  private async performOCR(base64Data: string): Promise<string> {
    // Placeholder for OCR implementation
    // This would be implemented based on chosen OCR service
    
    // Example with Tesseract.js (client-side):
    // const { createWorker } = await import('tesseract.js');
    // const worker = await createWorker();
    // const { data: { text } } = await worker.recognize(base64Data);
    // await worker.terminate();
    // return text;
    
    // For now, return a sample error to indicate implementation needed
    throw new Error('OCR service not implemented. Please integrate with Tesseract.js, Google Vision, or similar service.');
  }

  validateImageContent(base64Data: string): {
    isValid: boolean;
    errors: string[];
    imageInfo: {
      format: string;
      size: number;
      dimensions?: { width: number; height: number };
    };
  } {
    try {
      const imageInfo = this.getImageInfo(base64Data);
      const errors = [];

      // Validate file size (max 10MB)
      if (imageInfo.size > 10 * 1024 * 1024) {
        errors.push('Image file too large (max 10MB)');
      }

      // Validate format
      const supportedFormats = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      if (!supportedFormats.includes(imageInfo.format.toLowerCase())) {
        errors.push(`Unsupported image format: ${imageInfo.format}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        imageInfo
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
        imageInfo: { format: 'unknown', size: 0 }
      };
    }
  }

  private getImageInfo(base64Data: string): {
    format: string;
    size: number;
    dimensions?: { width: number; height: number };
  } {
    const header = base64Data.split(',')[0];
    const data = base64Data.split(',')[1];
    
    // Extract format from data URL header
    const formatMatch = header.match(/image\/([a-zA-Z0-9]+)/);
    const format = formatMatch ? formatMatch[1] : 'unknown';
    
    // Calculate size
    const size = Math.ceil(data.length * 3/4);
    
    return { format, size };
  }
}
```

### 3.7 Integration Points

#### 3.7.1 JobDescriptionsPage Integration

```typescript
// src/pages/JobDescriptionsPage.tsx (additions)
export default function JobDescriptionsPage() {
  // ... existing code ...
  
  const [scraperModalOpen, setScraperModalOpen] = useState(false);
  const [extensionCaptureData, setExtensionCaptureData] = useState<ExtensionCaptureData | null>(null);

  // Listen for extension capture data
  useEffect(() => {
    const handleExtensionData = (data: ExtensionCaptureData) => {
      setExtensionCaptureData(data);
      setScraperModalOpen(true);
    };

    extensionService.addJobDataListener(handleExtensionData);
    
    return () => {
      extensionService.removeJobDataListener(handleExtensionData);
    };
  }, []);

  const handleScrapedJobCreated = async (scrapedJob: JobDescription) => {
    try {
      // Save the scraped job
      await saveJobDescription(scrapedJob);
      
      // Update state
      setState(prev => ({
        ...prev,
        jobDescriptions: [...prev.jobDescriptions, scrapedJob]
      }));

      // Log activity
      logActivity('job_scraped', {
        jobId: scrapedJob.id,
        method: extensionCaptureData ? 'extension_capture' : 'manual_upload',
        aiUsage: scrapedJob.aiUsage
      });

      // Close modal and reset
      setScraperModalOpen(false);
      setExtensionCaptureData(null);
      
    } catch (error) {
      console.error('Error saving scraped job:', error);
      alert('Failed to save scraped job. Please try again.');
    }
  };

  // ... existing render logic ...
  
  return (
    <div className="page">
      {/* Existing content */}
      
      {/* Add scraper button to toolbar */}
      <div className="toolbar">
        {/* Existing buttons */}
        <button
          className="secondary"
          onClick={() => setScraperModalOpen(true)}
          title="Upload and parse job description from PDF, image, or text"
        >
          <FontAwesomeIcon icon={faFileImport} /> Scrape Job
        </button>
      </div>

      {/* Scraper Modal */}
      {scraperModalOpen && (
        <JobScraperModal
          isOpen={scraperModalOpen}
          onClose={() => {
            setScraperModalOpen(false);
            setExtensionCaptureData(null);
          }}
          onJobCreated={handleScrapedJobCreated}
          initialData={extensionCaptureData ? {
            id: crypto.randomUUID(),
            type: extensionCaptureData.type === 'screenshot' ? 'image' : 'pdf',
            content: extensionCaptureData.data,
            fileName: `${extensionCaptureData.type}_${Date.now()}`,
            uploadDate: new Date().toISOString()
          } : undefined}
        />
      )}
      
      {/* Existing job management table */}
    </div>
  );
}
```

## 4. Database/Storage Schema Changes

### 4.1 Enhanced JobDescription Interface

```typescript
// src/types.ts (additions to existing JobDescription interface)
export interface JobDescription {
  // ... existing fields ...
  
  // New scraper-specific fields
  scraperData?: {
    inputType: 'pdf' | 'image' | 'text' | 'url' | 'extension';
    extractedText?: string;
    confidence: number;
    processingTime: number;
    originalFileName?: string;
    captureMetadata?: {
      url?: string;
      timestamp?: string;
      dimensions?: { width: number; height: number };
    };
  };
  
  // Enhanced AI usage tracking
  aiUsage?: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    parseCount: number;
    lastParseDate?: string;
    rawTextHash?: string;
    scraperParseCount?: number; // New: Track scraper-specific parsing
    scraperCost?: number; // New: Track scraper-specific costs
  };
}
```

### 4.2 Storage Utilities Enhancement

```typescript
// src/storage.ts (additions)
export interface ScraperCache {
  id: string;
  inputHash: string;
  result: ScraperResult;
  timestamp: string;
  expiresAt: string;
}

// Cache scraped results to avoid re-processing identical content
export async function cacheScraperResult(inputHash: string, result: ScraperResult): Promise<void> {
  try {
    const cache: ScraperCache = {
      id: crypto.randomUUID(),
      inputHash,
      result,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    await saveToIndexedDB('scraperCache', cache);
  } catch (error) {
    console.warn('Failed to cache scraper result:', error);
  }
}

export async function getCachedScraperResult(inputHash: string): Promise<ScraperResult | null> {
  try {
    const caches = await getAllFromIndexedDB<ScraperCache>('scraperCache');
    const validCache = caches.find(cache => 
      cache.inputHash === inputHash && 
      new Date(cache.expiresAt) > new Date()
    );
    
    return validCache?.result || null;
  } catch (error) {
    console.warn('Failed to retrieve cached scraper result:', error);
    return null;
  }
}

// Clean up expired cache entries
export async function cleanupScraperCache(): Promise<void> {
  try {
    const caches = await getAllFromIndexedDB<ScraperCache>('scraperCache');
    const now = new Date();
    
    for (const cache of caches) {
      if (new Date(cache.expiresAt) <= now) {
        await deleteFromIndexedDB('scraperCache', cache.id);
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup scraper cache:', error);
  }
}
```

## 5. API Specifications

### 5.1 Scraper Service API

```typescript
interface ScraperAPI {
  // Process various input types
  processInput(input: ScraperInput): Promise<ScraperResult>;
  
  // Validate input before processing
  validateInput(input: ScraperInput): { isValid: boolean; errors: string[] };
  
  // Extract text from different sources
  extractTextFromPDF(base64Data: string): Promise<string>;
  extractTextFromImage(base64Data: string): Promise<string>;
  extractTextFromURL(url: string): Promise<string>;
  
  // Parse extracted text with AI
  parseWithAI(text: string, inputType: string): Promise<ParsedJobData>;
  
  // Validate and clean parsed data
  validateParsedData(data: ParsedJobData): ParsedJobData;
  
  // Calculate confidence scores
  calculateConfidence(data: ParsedJobData, originalText: string): number;
  
  // Cache management
  getCachedResult(inputHash: string): Promise<ScraperResult | null>;
  cacheResult(inputHash: string, result: ScraperResult): Promise<void>;
}
```

### 5.2 Extension Communication API

```typescript
// Messages between extension and main app
interface ExtensionMessage {
  type: 'CAPTURE_REQUEST' | 'CAPTURE_COMPLETE' | 'CAPTURE_ERROR' | 'JOB_DATA';
  payload: any;
  timestamp: string;
  id: string;
}

interface CaptureRequest {
  type: 'screenshot' | 'pdf';
  options: CaptureOptions;
}

interface CaptureComplete {
  type: 'screenshot' | 'pdf';
  data: string; // base64
  metadata: any;
}
```

## 6. Risk Assessment and Mitigation Strategies

### 6.1 Technical Risks

| Risk | Impact | Probability | Mitigation Strategy |
|------|---------|-------------|-------------------|
| **AI API Rate Limits** | High | Medium | Implement request queuing, caching, and fallback to manual parsing |
| **Large File Processing** | Medium | High | File size limits, client-side compression, progress indicators |
| **OCR Accuracy Issues** | Medium | Medium | Multiple OCR providers, manual correction interface, confidence scoring |
| **Browser Extension Permissions** | High | Low | Minimal permissions, user consent, clear privacy policy |
| **PDF Parsing Failures** | Medium | Medium | Fallback to manual text entry, multiple parsing libraries |

### 6.2 Security Considerations

- **Data Privacy**: All processing happens client-side or through secure APIs
- **File Upload Security**: Validate file types, sizes, and content before processing
- **API Key Management**: Secure storage of AI service credentials
- **Extension Permissions**: Request minimal necessary permissions only
- **Cross-Origin Safety**: Validate all external content and URLs

### 6.3 Performance Risks

- **Large File Processing**: Implement chunked processing and progress indicators
- **AI API Latency**: Show loading states, implement timeouts and retries
- **Storage Capacity**: Monitor IndexedDB usage, implement cleanup routines
- **Memory Usage**: Process large files in streams rather than loading entirely into memory

### 6.4 Legal/Compliance Risks

- **Website Scraping**: Only user-initiated captures, no bulk automation
- **Copyright**: Users responsible for their own captured content
- **Data Protection**: GDPR compliance for any stored personal information
- **Terms of Service**: Respect job site ToS through manual capture only

## 7. Implementation Task Breakdown

### 7.1 Phase 1: Core Infrastructure (Week 1-2)

**Priority: High**

1. **Types and Interfaces** (2 days)
   - Create `src/types/scraperTypes.ts`
   - Update existing `JobDescription` interface
   - Define API contracts and data structures

2. **Core Services** (3 days)
   - Implement `ScraperService` base class
   - Create `PDFExtractor` utility
   - Develop input validation logic
   - Set up caching infrastructure

3. **AI Service Integration** (3 days)
   - Enhance `aiService.ts` with scraper parsing
   - Implement job-specific AI prompts
   - Add confidence scoring algorithms
   - Create cost tracking mechanisms

### 7.2 Phase 2: UI Components (Week 3-4)

**Priority: High**

1. **Scraper Modal Component** (4 days)
   - Create multi-step upload interface
   - Implement drag-and-drop file upload
   - Add copy/paste text input area
   - Build preview and validation screens

2. **File Processing Components** (3 days)
   - Develop upload progress indicators
   - Create file format detection
   - Implement error handling displays
   - Add processing status feedback

3. **Integration with JobDescriptionsPage** (3 days)
   - Add scraper button to toolbar
   - Integrate with existing job management
   - Update table displays for scraped jobs
   - Implement status indicators

### 7.3 Phase 3: Browser Extension Enhancement (Week 5-6)

**Priority: Medium**

1. **Capture Functionality** (4 days)
   - Implement screenshot capture API
   - Add PDF generation capability
   - Create preview interfaces
   - Handle capture permissions

2. **Enhanced Popup Interface** (3 days)
   - Update popup.html with capture options
   - Implement capture mode switching
   - Add preview and validation UI
   - Enhance error handling

3. **Communication Layer** (3 days)
   - Update extension messaging protocol
   - Implement data transfer optimization
   - Add fallback communication methods
   - Test cross-browser compatibility

### 7.4 Phase 4: Advanced Features (Week 7-8)

**Priority: Low**

1. **OCR Integration** (4 days)
   - Research and select OCR service
   - Implement image text extraction
   - Add OCR quality validation
   - Create manual correction interface

2. **Advanced AI Features** (2 days)
   - Implement multi-format parsing
   - Add confidence-based validation
   - Create smart field suggestions
   - Enhance data cleanup algorithms

3. **Performance Optimizations** (2 days)
   - Implement file compression
   - Add streaming for large files
   - Optimize caching strategies
   - Profile and optimize AI usage

### 7.5 Phase 5: Testing and Polish (Week 9-10)

**Priority: High**

1. **Comprehensive Testing** (4 days)
   - Unit tests for all utilities
   - Integration tests for workflows
   - Browser extension testing
   - Performance testing with large files

2. **Error Handling and UX** (3 days)
   - Comprehensive error scenarios
   - Loading states and progress
   - Help text and user guidance
   - Accessibility improvements

3. **Documentation and Deployment** (3 days)
   - Update user documentation
   - Create developer guides
   - Prepare production deployment
   - Monitor and optimize performance

## 8. Success Metrics and Acceptance Criteria

### 8.1 Functional Requirements

- ✅ **Multi-Format Support**: Successfully process PDF files, images, and text input
- ✅ **AI Parsing Accuracy**: >80% accuracy for standard job description fields
- ✅ **Browser Extension**: Capture screenshots and PDFs with user interaction
- ✅ **Data Validation**: Preview and correction interface for all parsed data
- ✅ **Integration**: Seamless workflow with existing job management features

### 8.2 Performance Requirements

- ✅ **Processing Speed**: <30 seconds for PDF processing, <60 seconds for OCR
- ✅ **File Size Limits**: Support files up to 10MB for PDFs, 5MB for images
- ✅ **Memory Usage**: <100MB additional memory usage during processing
- ✅ **Storage Impact**: <20% increase in IndexedDB storage per scraped job

### 8.3 User Experience Requirements

- ✅ **Ease of Use**: Single-click workflow from upload to job creation
- ✅ **Error Recovery**: Clear error messages with suggested actions
- ✅ **Progress Feedback**: Real-time status updates during processing
- ✅ **Data Accuracy**: User can review and modify all extracted information

## 9. Future Enhancement Opportunities

### 9.1 Advanced AI Features
- **Multi-language Support**: Parse job descriptions in different languages
- **Industry-Specific Parsing**: Specialized parsing for different job types
- **Salary Benchmarking**: Compare extracted salaries with market data
- **Skills Matching**: Automatic matching with user's resume skills

### 9.2 Integration Expansions
- **ATS Integration**: Direct integration with popular ATS systems
- **Job Board APIs**: Official API integration where available
- **Calendar Integration**: Automatic deadline tracking and reminders
- **CRM Features**: Enhanced company research and contact tracking

### 9.3 Advanced Capture Features
- **Video Processing**: Extract information from video job descriptions
- **Audio Transcription**: Process podcast-style job descriptions
- **Batch Processing**: Handle multiple job descriptions simultaneously
- **Smart Scheduling**: Automated capture scheduling and monitoring

---

## Conclusion

This technical specification provides a comprehensive roadmap for implementing the job description scraper feature within the Resume Tracker application. The design prioritizes:

1. **Legal and Ethical Compliance**: All captures are user-initiated and manual
2. **Robust Architecture**: Leveraging existing infrastructure while adding new capabilities
3. **User Experience**: Streamlined workflow from capture to job management
4. **Scalability**: Modular design that supports future enhancements
5. **Security**: Client-side processing and secure data handling practices

The implementation plan spans 10 weeks with a clear phase-based approach, allowing for iterative development and early user feedback. The modular architecture ensures that individual components can be developed and tested independently while maintaining integration with the existing system.

**Estimated Development Effort**: 320-400 hours (10 weeks @ 32-40 hours/week)
**Team Size**: 2-3 developers (Frontend, Backend/AI, QA)
**Technical Risk Level**: Medium (manageable with proper testing and fallbacks)
**Business Impact**: High (significantly enhances job application workflow)