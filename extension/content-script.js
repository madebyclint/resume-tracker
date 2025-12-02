// Content script that runs on job sites to extract job descriptions
class JobDescriptionExtractor {
  constructor() {
    this.jobData = null;
    this.isExtracted = false;
  }

  // Site-specific selectors for job descriptions
  getSelectors() {
    const hostname = window.location.hostname;
    
    const selectors = {
      'www.linkedin.com': {
        title: '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1',
        company: '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description-container a',
        description: '.jobs-description-content__text, .jobs-box__html-content, .description__text',
        location: '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet'
      },
      'www.indeed.com': {
        title: '[data-testid="jobsearch-JobInfoHeader-title"], .jobsearch-JobInfoHeader-title, h1',
        company: '[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyRating, .jobsearch-CompanyInfoWithoutHeaderImage',
        description: '#jobDescriptionText, .jobsearch-jobDescriptionText',
        location: '[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle'
      },
      'jobs.lever.co': {
        title: '.posting-headline h2, .posting-header h2',
        company: '.main-header-link, .posting-headline .company-name',
        description: '.posting-content .content, .section-wrapper .content',
        location: '.posting-categories .location, .workplaceTypes'
      },
      'boards.greenhouse.io': {
        title: '#header .app-title, .job-post h1',
        company: '#header .company-name, .job-post .company-name',
        description: '#content .job-post, .job-description',
        location: '.location'
      },
      'apply.workable.com': {
        title: '[data-ui="job-title"], .job-title h1',
        company: '[data-ui="company-name"], .company-name',
        description: '[data-ui="job-description"], .job-description',
        location: '[data-ui="job-location"], .job-location'
      },
      'jobs.smartrecruiters.com': {
        title: '.job-title, h1',
        company: '.company-info .company-name, .company-name',
        description: '.job-description, .st-text',
        location: '.job-location'
      }
    };

    // Workday sites (dynamic subdomain)
    if (hostname.includes('.workday.com')) {
      return {
        title: '[data-automation-id="jobPostingHeader"], .css-1id4k1 h3',
        company: '[data-automation-id="company"], .css-1tunjzl',
        description: '[data-automation-id="jobPostingDescription"], .css-1t92pv',
        location: '[data-automation-id="locations"]'
      };
    }

    // Default/generic selectors for unknown sites
    return selectors[hostname] || {
      title: 'h1, .job-title, [class*="title"], [id*="title"]',
      company: '.company, [class*="company"], [id*="company"]',
      description: '.description, .job-description, [class*="description"], [id*="job"], main, article',
      location: '.location, [class*="location"], [id*="location"]'
    };
  }

  // Extract text content from elements matching selectors
  extractText(selector) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) return '';
      
      // Try to get the most relevant element (usually the first or largest)
      let bestElement = elements[0];
      let maxLength = bestElement.textContent?.trim().length || 0;
      
      for (const element of elements) {
        const textLength = element.textContent?.trim().length || 0;
        if (textLength > maxLength) {
          bestElement = element;
          maxLength = textLength;
        }
      }
      
      return bestElement.textContent?.trim() || '';
    } catch (error) {
      console.warn('Error extracting text:', error);
      return '';
    }
  }

  // Clean and format extracted text
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  // Extract job data from the current page
  extractJobData() {
    const selectors = this.getSelectors();
    const url = window.location.href;
    
    const rawData = {
      title: this.extractText(selectors.title),
      company: this.extractText(selectors.company),
      description: this.extractText(selectors.description),
      location: this.extractText(selectors.location),
      url: url,
      extractedAt: new Date().toISOString(),
      source: window.location.hostname
    };

    // Clean the extracted data
    this.jobData = {
      title: this.cleanText(rawData.title),
      company: this.cleanText(rawData.company),
      description: this.cleanText(rawData.description),
      location: this.cleanText(rawData.location),
      url: rawData.url,
      extractedAt: rawData.extractedAt,
      source: rawData.source
    };

    return this.jobData;
  }

  // Validate that we have extracted meaningful data
  isValidJobData(data) {
    return data && 
           data.title && data.title.length > 5 &&
           data.description && data.description.length > 50;
  }

  // Send extracted data to the React app
  async sendToResumeTracker(jobData) {
    console.log('🚀 Starting to send job data to Resume Tracker:', jobData);
    
    try {
      // First try to communicate with the React app if it's running locally
      console.log('📡 Making fetch request to localhost:5173...');
      
      const response = await fetch('http://localhost:5173/api/job-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jobData)
      });
      
      console.log('📨 Response received. Status:', response.status);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Success! Response data:', responseData);
        return { success: true, method: 'direct' };
      } else {
        console.log('❌ Response not OK:', response.statusText);
      }
    } catch (error) {
      // If direct communication fails, use Chrome storage as fallback
      console.log('💥 Direct communication failed with error:', error);
      console.log('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }

    // Fallback: Store in Chrome storage for the React app to pick up
    try {
      await chrome.storage.local.set({
        'pendingJobData': jobData,
        'lastExtraction': Date.now()
      });
      return { success: true, method: 'storage' };
    } catch (error) {
      console.error('Failed to store job data:', error);
      return { success: false, error: error.message };
    }
  }
}

// Initialize the extractor
const extractor = new JobDescriptionExtractor();

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractJobData') {
    try {
      const jobData = extractor.extractJobData();
      
      if (extractor.isValidJobData(jobData)) {
        extractor.sendToResumeTracker(jobData).then(result => {
          sendResponse({
            success: true,
            data: jobData,
            message: `Job extracted successfully via ${result.method}`,
            result: result
          });
        }).catch(error => {
          sendResponse({
            success: false,
            error: error.message,
            data: jobData
          });
        });
      } else {
        sendResponse({
          success: false,
          error: 'Could not extract valid job data from this page',
          data: jobData
        });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }
  
  if (request.action === 'checkJobPage') {
    // Check if this looks like a job posting page
    const jobData = extractor.extractJobData();
    const isJobPage = extractor.isValidJobData(jobData);
    
    sendResponse({
      isJobPage: isJobPage,
      url: window.location.href,
      title: document.title,
      data: isJobPage ? jobData : null
    });
  }
});

// Auto-detect job pages and show a subtle indicator
function showExtractionHint() {
  const jobData = extractor.extractJobData();
  
  if (extractor.isValidJobData(jobData)) {
    // Create a subtle floating button
    const hintButton = document.createElement('div');
    hintButton.id = 'resume-tracker-hint';
    hintButton.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: #0066cc;
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: all 0.2s ease;
      " onmouseover="this.style.background='#0052a3'" onmouseout="this.style.background='#0066cc'">
        📋 Extract Job Description
      </div>
    `;
    
    hintButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({action: 'extractFromHint'});
      hintButton.remove();
    });
    
    // Remove any existing hint
    const existing = document.getElementById('resume-tracker-hint');
    if (existing) existing.remove();
    
    document.body.appendChild(hintButton);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (document.getElementById('resume-tracker-hint')) {
        hintButton.remove();
      }
    }, 10000);
  }
}

// Show hint after page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(showExtractionHint, 2000);
  });
} else {
  setTimeout(showExtractionHint, 2000);
}