// Popup script for the browser extension
class PopupController {
  constructor() {
    this.currentTab = null;
    this.extractedData = null;
    this.isLoading = false;
    
    this.initializeElements();
    this.bindEvents();
    this.checkCurrentPage();
  }
  
  initializeElements() {
    this.statusEl = document.getElementById('status');
    this.extractBtn = document.getElementById('extractBtn');
    this.jobPreview = document.getElementById('jobPreview');
    this.actionsEl = document.getElementById('actions');
    this.sendBtn = document.getElementById('sendBtn');
    this.openAppBtn = document.getElementById('openApp');
    this.testBtn = document.getElementById('testBtn');
    
    // Job preview elements
    this.jobTitle = document.getElementById('jobTitle');
    this.jobCompany = document.getElementById('jobCompany');
    this.jobLocation = document.getElementById('jobLocation');
    this.jobDescription = document.getElementById('jobDescription');
  }
  
  bindEvents() {
    this.extractBtn.addEventListener('click', () => this.extractJobData());
    this.sendBtn.addEventListener('click', () => this.sendToApp());
    this.openAppBtn.addEventListener('click', () => this.openResumeTracker());
    // Keep test connection but hidden
    if (this.testBtn) {
      this.testBtn.addEventListener('click', () => this.testConnection());
    }
  }
  
  async getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]);
      });
    });
  }
  
  async checkCurrentPage() {
    try {
      this.currentTab = await this.getCurrentTab();
      
      if (!this.currentTab) {
        this.showStatus('error', 'Cannot access current tab');
        return;
      }
      
      // Check if this is a job page
      chrome.tabs.sendMessage(this.currentTab.id, { action: 'checkJobPage' }, (response) => {
        if (chrome.runtime.lastError) {
          this.showStatus('error', 'Cannot access this page. Try refreshing.');
          this.updateButton('Refresh Page Required', true);
          return;
        }
        
        if (response && response.isJobPage) {
          this.showStatus('success', `Job detected: ${response.data?.title || 'Untitled Job'}`);
          this.updateButton('Extract Job Description', false);
          
          // Show preview if we have data
          if (response.data) {
            this.showJobPreview(response.data);
          }
        } else {
          this.showStatus('info', 'No job posting detected on this page');
          this.updateButton('Try Extract Anyway', false);
        }
      });
    } catch (error) {
      this.showStatus('error', `Error: ${error.message}`);
    }
  }
  
  showStatus(type, message) {
    this.statusEl.className = `status ${type}`;
    this.statusEl.textContent = message;
  }
  
  updateButton(text, disabled) {
    this.extractBtn.innerHTML = disabled ? 
      `<span class="spinner"></span>${text}` : 
      text;
    this.extractBtn.disabled = disabled;
  }
  
  showJobPreview(data) {
    this.extractedData = data;
    
    this.jobTitle.textContent = data.title || 'No title found';
    this.jobCompany.textContent = data.company || 'No company found';
    this.jobLocation.textContent = data.location || 'No location found';
    this.jobDescription.textContent = data.description ? 
      data.description.substring(0, 150) + (data.description.length > 150 ? '...' : '') :
      'No description found';
    
    this.jobPreview.style.display = 'block';
    this.actionsEl.style.display = 'flex';
  }
  
  hideJobPreview() {
    this.jobPreview.style.display = 'none';
    this.actionsEl.style.display = 'none';
    this.extractedData = null;
  }
  
  async extractJobData() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.updateButton('Extracting...', true);
    this.hideJobPreview();
    this.showStatus('loading', 'Extracting job description...');
    
    try {
      chrome.tabs.sendMessage(this.currentTab.id, { action: 'extractJobData' }, (response) => {
        this.isLoading = false;
        
        if (chrome.runtime.lastError) {
          this.showStatus('error', 'Failed to extract data. Try refreshing the page.');
          this.updateButton('Retry', false);
          return;
        }
        
        if (response && response.success) {
          this.showStatus('success', response.message || 'Job extracted successfully!');
          this.updateButton('Extract Complete ✓', false);
          this.showJobPreview(response.data);
          
          // Auto-send to app if extraction was successful
          setTimeout(() => {
            this.sendToApp();
          }, 1000);
        } else {
          this.showStatus('error', response?.error || 'Failed to extract job data');
          this.updateButton('Try Again', false);
          
          // Still show preview if we got some data
          if (response?.data) {
            this.showJobPreview(response.data);
          }
        }
      });
    } catch (error) {
      this.isLoading = false;
      this.showStatus('error', `Error: ${error.message}`);
      this.updateButton('Try Again', false);
    }
  }
  
  async sendToApp() {
    if (!this.extractedData) {
      this.showStatus('error', 'No job data to send');
      return;
    }
    
    try {
      console.log('Sending data to Resume Tracker:', this.extractedData);
      
      // Try to send directly to the React app
      const response = await fetch('http://localhost:5173/api/job-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.extractedData)
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        this.showStatus('success', 'Sent to Resume Tracker! ✓');
        this.sendBtn.textContent = 'Sent ✓';
        this.sendBtn.disabled = true;
        
        // Auto-close popup after success
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        throw new Error('App not responding');
      }
    } catch (error) {
      console.error('Failed to send to app:', error);
      // Fallback: Store in Chrome storage
      try {
        await chrome.storage.local.set({
          'pendingJobData': this.extractedData,
          'lastExtraction': Date.now()
        });
        
        this.showStatus('info', 'Saved for Resume Tracker. Open the app to import.');
        this.sendBtn.textContent = 'Saved ✓';
        this.openAppBtn.textContent = 'Open App to Import';
        this.openAppBtn.style.fontWeight = 'bold';
      } catch (storageError) {
        this.showStatus('error', 'Failed to save job data');
      }
    }
  }
  
  // Removed copyToClipboard method - functionality simplified
  
  openResumeTracker() {
    chrome.tabs.create({ url: 'http://localhost:5173' });
  }
  
  async testConnection() {
    this.testBtn.textContent = 'Testing...';
    this.testBtn.disabled = true;
    
    try {
      console.log('🧪 Testing connection to Resume Tracker...');
      
      const testData = {
        title: 'Test Job',
        company: 'Test Company',
        description: 'This is a test job description',
        location: 'Test Location',
        url: 'https://test.com',
        extractedAt: new Date().toISOString(),
        source: 'test'
      };
      
      const response = await fetch('http://localhost:5173/api/job-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });
      
      console.log('Test response status:', response.status);
      
      if (response.ok) {
        this.showStatus('success', '✅ Connection test successful!');
        this.testBtn.textContent = 'Test Passed ✅';
      } else {
        this.showStatus('error', `❌ Test failed: ${response.status}`);
        this.testBtn.textContent = 'Test Failed ❌';
      }
    } catch (error) {
      console.error('Test connection error:', error);
      this.showStatus('error', `❌ Connection failed: ${error.message}`);
      this.testBtn.textContent = 'Test Failed ❌';
    }
    
    setTimeout(() => {
      this.testBtn.textContent = 'Test Connection';
      this.testBtn.disabled = false;
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractFromHint') {
    // User clicked the hint button, trigger extraction
    const popup = window.popupController;
    if (popup) {
      popup.extractJobData();
    }
  }
});