import React, { useState } from 'react';
import ReactDOMServer from 'react-dom/server';
import { useAppState } from '../state/AppStateContext';
import { saveGeneratedResume } from '../storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import ValidationMessage from '../components/ValidationMessage';
import './JobDescriptionsPage.css';

// Markdown Resume Generation Prompt Validator
const validateMarkdownResumePrompt = (text: string): Array<{ type: 'pass' | 'warning' | 'error', message: string }> => {
  const results: Array<{ type: 'pass' | 'warning' | 'error', message: string }> = [];

  if (!text.trim()) {
    return [{ type: 'error', message: '❌ No content to validate' }];
  }

  // Check for Markdown format (should have # headers)
  const hasMarkdownHeaders = /^#\s+/m.test(text);
  if (hasMarkdownHeaders) {
    results.push({ type: 'pass', message: '✅ Has proper Markdown headers' });
  } else {
    results.push({ type: 'error', message: '❌ Missing Markdown headers (use # for main title, ## for sections)' });
  }

  // Check for only ONE divider line
  const dividerLines = text.match(/^[-=_*]{3,}$/gm);
  if (dividerLines) {
    if (dividerLines.length === 1) {
      results.push({ type: 'pass', message: '✅ Has exactly one divider line' });
    } else {
      results.push({ type: 'error', message: `❌ Has ${dividerLines.length} divider lines, should have exactly 1` });
    }
  } else {
    results.push({ type: 'error', message: '❌ Missing divider line after header (use --- or similar)' });
  }

  // Check divider placement (should be after header)
  const lines = text.split('\n');
  let headerFound = false;
  let dividerAfterHeader = false;
  let dividerLineNumber = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/^#\s+/)) {
      headerFound = true;
    }
    if (headerFound && line.match(/^[-=_*]{3,}$/)) {
      dividerAfterHeader = true;
      dividerLineNumber = i + 1;
      break;
    }
  }

  if (dividerAfterHeader) {
    results.push({ type: 'pass', message: `✅ Divider correctly placed after header (line ${dividerLineNumber})` });
  } else if (dividerLines && dividerLines.length > 0) {
    results.push({ type: 'error', message: '❌ Divider should come immediately after header section' });
  }

  // Check for header with bullet separators in contact info
  const headerSection = text.split(/^[-=_*]{3,}$/m)[0];
  const hasBulletSeparators = /•|\|/.test(headerSection);
  if (hasBulletSeparators) {
    results.push({ type: 'pass', message: '✅ Header uses bullet separators (• or |)' });
  } else {
    results.push({ type: 'warning', message: '⚠️ Consider using bullet separators (•) in contact info' });
  }

  // Check Skills section has bullet points with bold labels
  const skillsSection = text.match(/##\s+skills.*?(?=##|\n\n|$)/is);
  if (skillsSection) {
    const skillsText = skillsSection[0];
    const hasBoldCategories = /\*\*[^*]+\*\*/.test(skillsText);
    const hasBulletPoints = /^\s*[-*+]\s/gm.test(skillsText);

    if (hasBoldCategories && hasBulletPoints) {
      results.push({ type: 'pass', message: '✅ Skills section properly formatted with bold categories and bullets' });
    } else if (!hasBoldCategories) {
      results.push({ type: 'warning', message: '⚠️ Skills section missing bold category labels (**Category:**)' });
    } else if (!hasBulletPoints) {
      results.push({ type: 'warning', message: '⚠️ Skills section missing bullet points' });
    }
  } else {
    results.push({ type: 'warning', message: '⚠️ No Skills section found' });
  }

  // Check for ASCII-safe content (no em dashes, Unicode, fancy characters)
  const nonAsciiChars = text.match(/[^\x00-\x7F]/g);
  if (!nonAsciiChars) {
    results.push({ type: 'pass', message: '✅ All characters are ASCII-safe' });
  } else {
    const uniqueChars = [...new Set(nonAsciiChars)];
    const problematicChars = uniqueChars.map(char => {
      const code = char.charCodeAt(0);
      if (char === '\u2014') return `"${char}" (em dash - use -- instead)`;
      if (char === '\u2013') return `"${char}" (en dash - use - instead)`;
      if (char === '\u201c' || char === '\u201d') return `"${char}" (smart quotes - use " instead)`;
      if (char === '\u2018' || char === '\u2019') return `"${char}" (smart apostrophe - use ' instead)`;
      return `"${char}" (U+${code.toString(16).toUpperCase()})`;
    });

    results.push({
      type: 'error',
      message: `❌ Non-ASCII characters found: ${problematicChars.slice(0, 5).join(', ')}${problematicChars.length > 5 ? ` and ${problematicChars.length - 5} more` : ''}`
    });
  }

  // Check for additional dividers or horizontal rules elsewhere
  const bodyAfterDivider = text.split(/^[-=_*]{3,}$/m)[1];
  if (bodyAfterDivider) {
    const additionalDividers = bodyAfterDivider.match(/^[-=_*]{3,}$/gm);
    if (additionalDividers) {
      results.push({ type: 'error', message: `❌ Found ${additionalDividers.length} additional divider line(s) in body - remove them` });
    }
  } return results;
};

// Resume validation function
const validateResume = (text: string): Array<{ type: 'pass' | 'warning' | 'error', message: string }> => {
  const results: Array<{ type: 'pass' | 'warning' | 'error', message: string }> = [];

  if (!text.trim()) {
    return [{ type: 'error', message: '❌ No content to validate' }];
  }  // ATS Checks
  const hasName = /^#\s+/.test(text) || text.includes('# ');
  if (hasName) {
    results.push({ type: 'pass', message: '✅ Has name/title header' });
  } else {
    results.push({ type: 'error', message: '❌ Missing name/title header (use # Your Name)' });
  }

  const hasContact = /(@|\.|phone|email|linkedin|github)/i.test(text);
  if (hasContact) {
    results.push({ type: 'pass', message: '✅ Has contact information' });
  } else {
    results.push({ type: 'error', message: '❌ Missing contact information' });
  }

  const hasExperience = /(experience|work|job|position|role)/i.test(text);
  if (hasExperience) {
    results.push({ type: 'pass', message: '✅ Has experience section' });
  } else {
    results.push({ type: 'warning', message: '⚠️ No experience section found' });
  }

  // ASCII Safety Checks with specific character locations
  const lines = text.split('\n');
  const nonAsciiIssues: string[] = [];

  lines.forEach((line, lineIndex) => {
    const nonAsciiChars = line.match(/[^\x00-\x7F]/g);
    if (nonAsciiChars) {
      const uniqueChars = [...new Set(nonAsciiChars)];
      uniqueChars.forEach(char => {
        const charInfo = char === '\u2014' ? 'em dash' :
          char === '\u2013' ? 'en dash' :
            char === '\u201c' || char === '\u201d' ? 'smart quote' :
              char === '\u2018' || char === '\u2019' ? 'smart apostrophe' :
                `Unicode U+${char.charCodeAt(0).toString(16).toUpperCase()}`;
        nonAsciiIssues.push(`Line ${lineIndex + 1}: "${char}" (${charInfo})`);
      });
    }
  });

  if (nonAsciiIssues.length === 0) {
    results.push({ type: 'pass', message: '✅ All characters are ATS-safe (ASCII)' });
  } else {
    results.push({
      type: 'error',
      message: `❌ Non-ASCII characters found:\n${nonAsciiIssues.slice(0, 3).join('\n')}${nonAsciiIssues.length > 3 ? `\n...and ${nonAsciiIssues.length - 3} more` : ''}`
    });
  }

  // Detailed Grammar & Spelling Checks
  const grammarIssues: string[] = [];

  // Check for lowercase "i" 
  const lowercaseI = text.match(/\bi\s/g);
  if (lowercaseI && lowercaseI.length > 0) {
    grammarIssues.push(`Found ${lowercaseI.length} lowercase "i" - should be "I"`);
  }

  // Check for multiple spaces
  lines.forEach((line, lineIndex) => {
    if (line.includes('  ')) {
      grammarIssues.push(`Line ${lineIndex + 1}: Multiple spaces found`);
    }
  });

  // Check for multiple punctuation
  lines.forEach((line, lineIndex) => {
    const multiPunct = line.match(/[.!?]{2,}/g);
    if (multiPunct) {
      grammarIssues.push(`Line ${lineIndex + 1}: Multiple punctuation "${multiPunct[0]}"`);
    }
  });

  // Check for lines starting with lowercase (excluding markdown syntax)
  lines.forEach((line, lineIndex) => {
    if (line.trim() && !line.match(/^(\s*[-*+#]|\s*\d+\.|\s*>|\s*\|)/) && line.trim().match(/^[a-z]/)) {
      grammarIssues.push(`Line ${lineIndex + 1}: Starts with lowercase`);
    }
  });

  // Check for missing periods at end of sentences
  lines.forEach((line, lineIndex) => {
    if (line.trim() && !line.match(/^(\s*[-*+#]|\s*\d+\.)/) && line.trim().length > 20 && !line.trim().match(/[.!?]$/)) {
      grammarIssues.push(`Line ${lineIndex + 1}: Missing ending punctuation`);
    }
  });

  if (grammarIssues.length === 0) {
    results.push({ type: 'pass', message: '✅ No grammar issues detected' });
  } else {
    results.push({
      type: 'warning',
      message: `⚠️ Grammar issues found:\n${grammarIssues.slice(0, 3).join('\n')}${grammarIssues.length > 3 ? `\n...and ${grammarIssues.length - 3} more` : ''}`
    });
  }

  // Length check
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount >= 100 && wordCount <= 800) {
    results.push({ type: 'pass', message: `✅ Good length (${wordCount} words)` });
  } else if (wordCount < 100) {
    results.push({ type: 'warning', message: `⚠️ Short resume (${wordCount} words, aim for 100-800)` });
  } else {
    results.push({ type: 'warning', message: `⚠️ Long resume (${wordCount} words, aim for 100-800)` });
  }

  // Bullet points check
  const hasBullets = /^\s*[-*+]\s/gm.test(text);
  if (hasBullets) {
    results.push({ type: 'pass', message: '✅ Uses bullet points for structure' });
  } else {
    results.push({ type: 'warning', message: '⚠️ Consider using bullet points for better readability' });
  }

  // Dates format check
  const hasDateFormat = /(19|20)\d{2}|\d{4}\s*-\s*(19|20)\d{2}|present|current/i.test(text);
  if (hasDateFormat) {
    results.push({ type: 'pass', message: '✅ Has proper date formatting' });
  } else {
    results.push({ type: 'warning', message: '⚠️ Consider adding dates for experience' });
  }

  // Add Markdown Generation Prompt validation
  const markdownPromptResults = validateMarkdownResumePrompt(text);
  if (markdownPromptResults.length > 0) {
    results.push({ type: 'pass', message: '✅ Markdown Generation Prompt Validation' });
    results.push(...markdownPromptResults);
  }

  return results;
};

const ResumeFormatterPage: React.FC = () => {
  const { state, setState } = useAppState();

  // Resume formatter state
  const [resumeInputText, setResumeInputText] = useState('');
  const [formattedHTML, setFormattedHTML] = useState('');
  const [validationResults, setValidationResults] = useState<Array<{ type: 'pass' | 'warning' | 'error', message: string }>>([]);

  // Save resume modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const validateResume = (text: string) => {
    const results = validateMarkdownResumePrompt(text);
    setValidationResults(results);
  };

  const handleClearResume = () => {
    setResumeInputText('');
    setFormattedHTML('');
    setValidationResults([]);
  };

  const handlePreviewResume = () => {
    if (!formattedHTML) {
      alert('Please format the resume first.');
      return;
    }

    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      alert('Please allow popups to preview the resume.');
      return;
    }

    // Use the exact same logic as the iframe
    const markdownComponent = (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
      >
        {resumeInputText}
      </ReactMarkdown>
    );

    const renderedHTML = ReactDOMServer.renderToStaticMarkup(markdownComponent);

    const previewContent = `
      <!DOCTYPE html>
      <html style="height: 100%; overflow: auto;">
      <head>
        <meta charset="utf-8">
        <title>Resume Preview</title>
        <link rel="stylesheet" href="/src/pages/JobDescriptionsPage.css">
        <style>
          body {
            font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #333;
            margin: 0;
            padding: 20px;
            background: white;
            height: auto;
            min-height: 100%;
            overflow: auto;
          }
        </style>
      </head>
      <body class="formatted-output">
        ${renderedHTML}
      </body>
      </html>
    `;

    previewWindow.document.write(previewContent);
    previewWindow.document.close();
    previewWindow.focus();
  };

  const handleSaveResume = () => {
    if (!formattedHTML) {
      alert('Please format the resume first.');
      return;
    }
    // Generate a simple filename suggestion
    const today = new Date().toISOString().split('T')[0];
    setSaveFileName(`Resume_${today}`);
    setShowSaveModal(true);
  };

  const handleConfirmSave = async () => {
    if (!saveFileName.trim() || !formattedHTML) {
      alert('Please enter a filename and ensure resume is formatted.');
      return;
    }

    setIsSaving(true);

    try {
      // Create a mock job description for the saveGeneratedResume function
      const mockJobDescription = {
        id: 'temp-job',
        title: 'Resume Formatter Job',
        company: 'Manual Entry',
        rawText: '',
        url: '',
        uploadDate: new Date().toISOString(),
        sequentialId: 0,
        linkedResumeIds: [],
        linkedCoverLetterIds: [],
        extractedInfo: {
          requiredSkills: [],
          preferredSkills: [],
          responsibilities: [],
          requirements: []
        },
        keywords: []
      };

      const savedResume = await saveGeneratedResume(saveFileName.trim(), resumeInputText, mockJobDescription);

      setState(prev => ({
        ...prev,
        resumes: [...prev.resumes, savedResume]
      }));

      // Reset form
      setShowSaveModal(false);
      setSaveFileName('');
      alert('Resume saved successfully!');
    } catch (error) {
      console.error('Error saving resume:', error);
      alert('Error saving resume. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="job-descriptions-page">
      <div className="page-header">
        <h1>Resume Formatter</h1>
        <p>Paste your raw resume text below and get a clean, ATS-friendly formatted output</p>
      </div>

      <div className="resume-formatter-content">
        <div className="output-controls">
          <button
            className="save-button"
            onClick={handleSaveResume}
            disabled={!formattedHTML}
          >
            💾 Save Resume
          </button>
          <button
            className="preview-button"
            onClick={handlePreviewResume}
            disabled={!formattedHTML}
          >
            🔍 Preview
          </button>
          <button
            className="validate-button"
            onClick={() => {
              if (resumeInputText.trim()) {
                const promptResults = validateMarkdownResumePrompt(resumeInputText);
                setValidationResults([
                  { type: 'pass' as const, message: '✅ Markdown Generation Prompt Validation' },
                  ...promptResults.map(r => ({ ...r, type: r.type as 'pass' | 'warning' | 'error' }))
                ]);
              } else {
                setValidationResults([{ type: 'error' as const, message: '❌ No text to validate' }]);
              }
            }}
            disabled={!resumeInputText.trim()}
            title="Check resume against Markdown generation prompt requirements"
          >
            ✓ Prompt Check
          </button>
          <button
            className="clear-button"
            onClick={handleClearResume}
          >
            🗑️ Clear
          </button>
        </div>

        <div className="checks-section">
          <h4>Resume Validation</h4>
          <div className="check-results">
            {validationResults.length > 0 ? (
              validationResults.map((result, index) => (
                <div key={index} className={`check-item ${result.type}`}>
                  <span className="check-message">
                    <ValidationMessage message={result.message} />
                  </span>
                </div>
              ))
            ) : (
              <div className="no-validation">
                <p>Start typing to see ATS, grammar, formatting, and Markdown generation prompt validation...</p>
                <div className="markdown-tips">
                  <p><strong>Quick Tips:</strong></p>
                  <ul>
                    <li><code># Your Name</code> for main heading</li>
                    <li><code>## Section Title</code> for sections</li>
                    <li><code>**Bold Text**</code> for emphasis</li>
                    <li><code>- Bullet point</code> for lists</li>
                  </ul>
                  <p><strong>Prompt Requirements:</strong></p>
                  <ul>
                    <li>Exactly ONE divider line after header (---)</li>
                    <li>Header with bullet separators (• or |)</li>
                    <li>Skills with bold categories and bullets</li>
                    <li>ASCII-safe characters only</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="formatter-layout">
          <div className="input-section">
            <h3>Input Resume Text</h3>
            <div className="textarea-with-lines">
              <div className="line-numbers">
                {(resumeInputText || ' ').split('\n').map((_, index) => (
                  <div key={index} className="line-number" id={`line-${index + 1}`}>{index + 1}</div>
                ))}
              </div>
              <textarea
                className="resume-input"
                value={resumeInputText}
                onChange={(e) => {
                  const newText = e.target.value;
                  setResumeInputText(newText);
                  if (newText.trim()) {
                    validateResume(newText);
                    setFormattedHTML(`<div class="formatted-resume">${newText}</div>`);
                  } else {
                    setValidationResults([]);
                    setFormattedHTML('');
                  }
                }}
                placeholder="Paste your resume text here in Markdown format..."
                rows={20}
              />
            </div>
          </div>

          <div className="output-section">
            <h3>Formatted Output</h3>
            <div className="formatted-output">
              {resumeInputText ? (
                <iframe
                  srcDoc={`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="utf-8">
                      <link rel="stylesheet" href="/src/pages/JobDescriptionsPage.css">
                      <style>
                        body { 
                          font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif;
                          font-size: 11pt;
                          line-height: 1.5;
                          color: #333;
                          margin: 0;
                          padding: 20px;
                          background: white;
                        }
                      </style>
                    </head>
                    <body class="formatted-output">
                      ${ReactDOMServer.renderToStaticMarkup(
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                    >
                      {resumeInputText}
                    </ReactMarkdown>
                  )}
                    </body>
                    </html>
                  `}
                  style={{
                    width: '100%',
                    height: '600px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    background: 'white'
                  }}
                  title="Formatted Resume Preview"
                />
              ) : (
                <div className="empty-output">
                  <p>Formatted output will appear here...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Resume Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Save Resume</h3>
              <button onClick={() => setShowSaveModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="save-filename">Resume Name:</label>
                <input
                  id="save-filename"
                  type="text"
                  value={saveFileName}
                  onChange={(e) => setSaveFileName(e.target.value)}
                  placeholder="Enter resume name..."
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button
                onClick={handleConfirmSave}
                disabled={!saveFileName.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Resume'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeFormatterPage;