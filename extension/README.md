# Resume Tracker Browser Extension

This browser extension extracts job descriptions from job sites and sends them to your Resume Tracker app.

## Features

- **Auto-detection**: Automatically detects job postings on popular sites
- **One-click extraction**: Extract job details with a single click
- **Multiple job sites**: Works with LinkedIn, Indeed, Lever, Greenhouse, and more
- **Seamless integration**: Sends data directly to your Resume Tracker app
- **Fallback storage**: Uses Chrome storage if the app isn't running

## Installation (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension` folder
4. The extension icon should appear in your browser toolbar

## Usage

1. **Start your Resume Tracker app** (run `npm run dev` in the main project)
2. **Navigate to a job posting** on any supported site
3. **Look for the floating hint button** or click the extension icon
4. **Click "Extract Job Description"** in the popup
5. **The job will be automatically imported** into your Resume Tracker app

## Supported Job Sites

- LinkedIn Jobs
- Indeed
- Lever
- Greenhouse
- Workable
- SmartRecruiters
- Workday sites
- Google Careers
- Apple Jobs
- Glassdoor
- AngelList/Wellfound
- And many more with generic selectors

## How It Works

1. **Content Script**: Runs on job sites to detect and extract job information
2. **Popup Interface**: Provides user controls and preview of extracted data
3. **Background Script**: Handles extension events and cleanup
4. **Communication**: Sends data to React app via HTTP or Chrome storage

## Development

### File Structure
```
extension/
├── manifest.json          # Extension configuration
├── content-script.js      # Job extraction logic
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── background.js         # Background event handling
└── icons/                # Extension icons (16x16, 48x48, 128x128)
```

### Adding New Job Sites

To add support for a new job site, edit `content-script.js` and add selectors to the `getSelectors()` method:

```javascript
const selectors = {
  'newjobsite.com': {
    title: '.job-title-selector',
    company: '.company-name-selector', 
    description: '.job-description-selector',
    location: '.location-selector'
  }
  // ... existing selectors
};
```

### Testing

1. Load the extension in Chrome
2. Navigate to a job posting
3. Click the extension icon
4. Check browser console for any errors
5. Verify data appears in Resume Tracker app

## Troubleshooting

**Extension not detecting jobs:**
- Check if the site is in the supported list
- Look for JavaScript errors in browser console
- Try refreshing the page

**Data not appearing in app:**
- Make sure Resume Tracker app is running on localhost:5173
- Check if CORS is enabled
- Look for network errors in browser dev tools

**Permission issues:**
- Ensure all required permissions are granted
- Try reloading the extension

## Privacy & Security

- Extension only runs on job sites
- No data is sent to external servers
- All communication is local (between extension and your app)
- Job data is stored locally in Chrome storage temporarily
- No tracking or analytics

## Future Enhancements

- [ ] Support for more job sites
- [ ] Advanced parsing with AI
- [ ] Batch import multiple jobs
- [ ] Export functionality
- [ ] Custom field mapping
- [ ] Interview scheduling integration