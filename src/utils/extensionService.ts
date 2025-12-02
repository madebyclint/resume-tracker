// Extension service to handle communication with browser extension
import { JobDescription } from '../types';

export interface ExtensionJobData {
  title: string;
  company: string;
  description: string;
  location: string;
  url: string;
  extractedAt: string;
  source: string;
}

export class ExtensionService {
  private static instance: ExtensionService;
  private listeners: ((data: ExtensionJobData) => void)[] = [];
  private isListening = false;

  static getInstance(): ExtensionService {
    if (!ExtensionService.instance) {
      ExtensionService.instance = new ExtensionService();
    }
    return ExtensionService.instance;
  }

  constructor() {
    this.startListening();
  }

  // Start listening for extension messages
  startListening() {
    if (this.isListening) return;
    
    this.isListening = true;
    
    // Listen for window messages (for extension communication)
    window.addEventListener('message', this.handleWindowMessage.bind(this));
    
    // Check for stored data from extension periodically
    this.checkStoredData();
    setInterval(() => this.checkStoredData(), 2000);
    
    // Set up a simple API endpoint using fetch interception
    this.setupAPIEndpoint();
  }

  // Handle messages from extension via window.postMessage
  private handleWindowMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    
    if (event.data.type === 'EXTENSION_JOB_DATA') {
      const jobData: ExtensionJobData = event.data.payload;
      this.notifyListeners(jobData);
    }
  }

  // Check Chrome storage for pending job data
  private async checkStoredData() {
    try {
      // Only try Chrome storage if we're in an extension context
      const chromeApi = (window as any).chrome;
      if (typeof chromeApi !== 'undefined' && chromeApi.storage) {
        const result = await chromeApi.storage.local.get(['pendingJobData', 'lastExtraction']);
        
        if (result.pendingJobData && result.lastExtraction) {
          const lastCheck = parseInt(localStorage.getItem('lastExtensionCheck') || '0');
          
          if (result.lastExtraction > lastCheck) {
            this.notifyListeners(result.pendingJobData);
            localStorage.setItem('lastExtensionCheck', result.lastExtraction.toString());
            
            // Clean up the stored data
            chromeApi.storage.local.remove(['pendingJobData', 'lastExtraction']);
          }
        }
      }
    } catch (error) {
      // Chrome storage not available, ignore
      console.debug('Chrome storage not available:', error);
    }
  }

  // Setup API endpoint handling via WebSocket
  private setupAPIEndpoint() {
    // Listen for Vite HMR WebSocket connection
    if (import.meta.hot) {
      import.meta.hot.on('extension-job-data', (jobData: ExtensionJobData) => {
        console.log('📨 Received job data from extension via WebSocket:', jobData);
        this.notifyListeners(jobData);
      });
    }
    
    // Also keep the fetch interception as fallback
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      
      // Handle our job description API endpoint - check for localhost and our endpoint
      if (url.includes('localhost') && url.includes('/api/job-description') && init?.method === 'POST') {
        try {
          console.log('Extension API request intercepted:', url);
          const jobData = JSON.parse(init.body as string) as ExtensionJobData;
          console.log('Parsed job data:', jobData);
          
          this.notifyListeners(jobData);
          
          // Return a successful response
          return new Response(JSON.stringify({ success: true, message: 'Job imported successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Error processing extension job data:', error);
          return new Response(JSON.stringify({ error: 'Invalid data', details: error }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // For all other requests, use the original fetch
      return originalFetch(input, init);
    };
  }

  // Add listener for job data
  addJobDataListener(callback: (data: ExtensionJobData) => void) {
    this.listeners.push(callback);
  }

  // Remove listener
  removeJobDataListener(callback: (data: ExtensionJobData) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Notify all listeners of new job data
  private notifyListeners(data: ExtensionJobData) {
    console.log('Extension job data received:', data);
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in extension listener:', error);
      }
    });
  }

  // Manual method to trigger data check (for testing)
  async checkForExtensionData() {
    await this.checkStoredData();
  }

  // Convert extension data to app format
  static convertToJobDescription(extensionData: ExtensionJobData): JobDescription {
    const now = new Date().toISOString();
    return {
      id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: extensionData.title,
      company: extensionData.company,
      role: extensionData.title,
      location: extensionData.location,
      url: extensionData.url,
      rawText: extensionData.description,
      additionalContext: `Imported from ${extensionData.source} on ${new Date(extensionData.extractedAt).toLocaleDateString()}`,
      extractedInfo: {
        role: extensionData.title,
        company: extensionData.company,
        location: extensionData.location,
        jobUrl: extensionData.url,
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        requirements: []
      },
      keywords: [],
      uploadDate: now,
      linkedResumeIds: [],
      linkedCoverLetterIds: [],
      applicationStatus: 'not_applied',
      priority: 'medium',
      impact: 'medium',
      source: extensionData.source,
      notes: `Imported from browser extension on ${new Date(extensionData.extractedAt).toLocaleDateString()}`,
      statusHistory: [{
        status: 'not_applied',
        date: now,
        notes: 'Job imported from browser extension'
      }],
      activityLog: [{
        id: `${Date.now()}_import`,
        timestamp: now,
        type: 'field_updated',
        field: 'imported',
        toValue: true,
        details: `Imported from ${extensionData.source} via browser extension`
      }],
      aiUsage: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCost: 0,
        parseCount: 0
      }
    };
  }
}

// Initialize the service
export const extensionService = ExtensionService.getInstance();