// Background script for handling extension events
chrome.runtime.onInstalled.addListener(() => {
  console.log('Resume Tracker Job Scraper installed');
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractFromHint') {
    // User clicked the floating hint button
    // Open the popup or trigger extraction
    chrome.action.openPopup();
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup (default behavior)
});

// Clean up old stored data periodically
chrome.storage.local.get(['lastExtraction'], (result) => {
  const lastExtraction = result.lastExtraction || 0;
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  if (lastExtraction < oneWeekAgo) {
    chrome.storage.local.remove(['pendingJobData', 'lastExtraction']);
  }
});