import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext';
import { JobDescription } from '../types';
import { parseJobDescription, generateTailoredResume, generateTailoredCoverLetter, generateTailoredResumeFromFullText, generateTailoredCoverLetterFromFullText, getCombinedResumeText, isAIConfigured } from '../utils/aiService';
import { saveJobDescription, deleteJobDescription, saveGeneratedResume, saveGeneratedCoverLetter } from '../storage';
import { calculateDocumentMatches, DocumentMatch } from '../utils/documentMatcher';
import { findRelevantResumeChunks, findRelevantCoverLetterChunks } from '../utils/chunkMatcher';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import GeneratedContentModal from '../components/GeneratedContentModal';
import ValidationMessage from '../components/ValidationMessage';
import './JobDescriptionsPage.css';

// Remove the local interface since we're using the one from documentMatcher

const JobDescriptionsPage: React.FC = () => {
  const { state, setState } = useAppState();
  const [activeTab, setActiveTab] = useState<'job-descriptions' | 'resume-formatter'>('job-descriptions');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    url: '',
    rawText: '',
    additionalContext: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  // Generation modal states
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedDefaultName, setGeneratedDefaultName] = useState('');
  const [generationType, setGenerationType] = useState<'resume' | 'cover_letter'>('resume');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);

  // Full text generation toggles
  const [useFullTextForResume, setUseFullTextForResume] = useState(true);
  const [useFullTextForCoverLetter, setUseFullTextForCoverLetter] = useState(true);

  // Resume formatter state
  const [resumeInputText, setResumeInputText] = useState('');
  const [formattedHTML, setFormattedHTML] = useState('');
  const [validationResults, setValidationResults] = useState<Array<{ type: 'pass' | 'warning' | 'error', message: string }>>([]);


  // Save resume modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleEditJobDescription = (jobId: string) => {
    const job = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!job) return;

    setFormData({
      title: job.title,
      company: job.company,
      url: job.url || '',
      rawText: job.rawText,
      additionalContext: job.additionalContext || ''
    });
    setEditingJobId(jobId);
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingJobId(null);
    setFormData({ title: '', company: '', url: '', rawText: '', additionalContext: '' });
    setShowAddForm(false);
  };

  const handleSaveJobDescription = async () => {
    if (!formData.title.trim() || !formData.company.trim() || !formData.rawText.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);

    try {
      // Parse job description with AI (only if text has changed or it's a new job)
      const isEditing = editingJobId !== null;
      const existingJob = isEditing ? state.jobDescriptions.find(jd => jd.id === editingJobId) : null;

      let parseResult = null;
      if (!isEditing || (existingJob && existingJob.rawText !== formData.rawText.trim())) {
        parseResult = await parseJobDescription(formData.rawText);
      }

      // Use AI-extracted info to fill in missing fields if available
      const finalTitle = formData.title.trim();
      const finalCompany = formData.company.trim();

      if (isEditing && existingJob) {
        // Update existing job description
        const updatedJobDescription: JobDescription = {
          ...existingJob,
          title: finalTitle,
          company: finalCompany,
          url: formData.url.trim() || undefined,
          rawText: formData.rawText.trim(),
          additionalContext: formData.additionalContext.trim() || undefined,
          // Only update AI-extracted info if we re-parsed
          ...(parseResult && {
            extractedInfo: parseResult.extractedInfo,
            keywords: parseResult.keywords
          })
        };

        await saveJobDescription(updatedJobDescription);

        setState(prev => ({
          ...prev,
          jobDescriptions: prev.jobDescriptions.map(jd =>
            jd.id === editingJobId ? updatedJobDescription : jd
          )
        }));

        setEditingJobId(null);
      } else {
        // Create new job description
        const newJobDescription: JobDescription = {
          id: crypto.randomUUID(),
          title: finalTitle,
          company: finalCompany,
          url: formData.url.trim() || undefined,
          rawText: formData.rawText.trim(),
          additionalContext: formData.additionalContext.trim() || undefined,
          extractedInfo: parseResult?.extractedInfo || {
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            requirements: []
          },
          keywords: parseResult?.keywords || [],
          uploadDate: new Date().toISOString(),
          linkedResumeIds: [],
          linkedCoverLetterIds: [],
          applicationStatus: 'not_applied'
        };

        await saveJobDescription(newJobDescription);

        setState(prev => ({
          ...prev,
          jobDescriptions: [...prev.jobDescriptions, newJobDescription]
        }));
      }

      // Reset form
      setFormData({ title: '', company: '', url: '', rawText: '', additionalContext: '' });
      setShowAddForm(false);

      if (parseResult && !parseResult.success && parseResult.error) {
        alert(`Job description saved, but AI parsing failed: ${parseResult.error}`);
      }

    } catch (error) {
      console.error('Error saving job description:', error);
      alert('Failed to save job description. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteJobDescription = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job description?')) {
      return;
    }

    try {
      await deleteJobDescription(id);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.filter(jd => jd.id !== id)
      }));
    } catch (error) {
      console.error('Error deleting job description:', error);
      alert('Failed to delete job description. Please try again.');
    }
  };

  const handleLinkResume = async (jobId: string, resumeId: string) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    const updatedJobDescription: JobDescription = {
      ...jobDescription,
      linkedResumeIds: jobDescription.linkedResumeIds.includes(resumeId)
        ? jobDescription.linkedResumeIds.filter(id => id !== resumeId)
        : [...jobDescription.linkedResumeIds, resumeId]
    };

    try {
      await saveJobDescription(updatedJobDescription);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(jd =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
    } catch (error) {
      console.error('Error linking resume:', error);
      alert('Failed to link resume. Please try again.');
    }
  };

  const handleLinkCoverLetter = async (jobId: string, coverLetterId: string) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    const updatedJobDescription: JobDescription = {
      ...jobDescription,
      linkedCoverLetterIds: jobDescription.linkedCoverLetterIds.includes(coverLetterId)
        ? jobDescription.linkedCoverLetterIds.filter(id => id !== coverLetterId)
        : [...jobDescription.linkedCoverLetterIds, coverLetterId]
    };

    try {
      await saveJobDescription(updatedJobDescription);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(jd =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
    } catch (error) {
      console.error('Error linking cover letter:', error);
      alert('Failed to link cover letter. Please try again.');
    }
  };

  const handleStatusChange = async (jobId: string, status: JobDescription['applicationStatus']) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    const updatedJobDescription: JobDescription = {
      ...jobDescription,
      applicationStatus: status,
      applicationDate: status === 'applied' ? new Date().toISOString() : jobDescription.applicationDate
    };

    try {
      await saveJobDescription(updatedJobDescription);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(jd =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  // Calculate potential document matches using sophisticated matching
  const getDocumentMatches = (jobDescription: JobDescription): DocumentMatch[] => {
    return calculateDocumentMatches(jobDescription, state.resumes, state.coverLetters);
  };

  // Generate tailored resume
  const handleGenerateResume = async (jobDescription: JobDescription) => {
    if (!isAIConfigured()) {
      alert('AI service is not configured. Please set up your OpenAI API key in the .env file.');
      return;
    }

    // Quick diagnostic check
    try {
      const { getAllChunks } = await import('../storage');
      const allChunks = await getAllChunks();
      console.log('🔍 Diagnostic - Total chunks available:', allChunks.length);
      console.log('🔍 Diagnostic - Resumes in state:', state.resumes.length);
      console.log('🔍 Diagnostic - Cover letters in state:', state.coverLetters.length);

      if (allChunks.length === 0) {
        alert('❌ No content chunks found! Please:\n1. Upload some resumes or cover letters\n2. Make sure they are processed into chunks\n3. Check the Chunk Library page to verify chunks exist');
        return;
      }
    } catch (error) {
      console.error('Diagnostic check failed:', error);
    }

    setIsGeneratingResume(true);
    setGenerationType('resume');
    setGeneratedTitle('Generated Resume');

    // Generate ATS-optimized filename: clint-bush-November-2025-Mastercard-FE-resume
    const currentDate = new Date();
    const month = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();
    const cleanCompany = jobDescription.company.replace(/[^a-zA-Z0-9]/g, '').trim();
    const cleanTitle = jobDescription.title
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 8); // Limit to reasonable abbreviation

    setGeneratedDefaultName(`clint-bush-${month}-${year}-${cleanCompany}-${cleanTitle}-resume`);
    setGeneratedContent('');
    setGenerationError(null);
    setIsGenerating(true);
    setShowGeneratedModal(true);

    try {
      let result;

      if (useFullTextForResume) {
        // Generate from full resume text
        console.log('🤖 Generating resume from full text...');
        const fullResumeText = await getCombinedResumeText();
        result = await generateTailoredResumeFromFullText(
          jobDescription,
          fullResumeText,
          jobDescription.additionalContext
        );
      } else {
        // Generate from chunks (original method)
        console.log('🧩 Generating resume from chunks...');
        const relevantChunks = await findRelevantResumeChunks(jobDescription, 0.1, 15);
        console.log('🎯 Found relevant resume chunks:', relevantChunks.map(c => ({ type: c.chunk.type, score: c.score })));

        if (relevantChunks.length === 0) {
          const { getAllChunks } = await import('../storage');
          const allChunks = await getAllChunks();
          const resumeTypes = ['cv_header', 'cv_summary', 'cv_skills', 'cv_experience_section', 'cv_experience_bullet', 'cv_mission_fit'];
          const resumeChunks = allChunks.filter(chunk => resumeTypes.includes(chunk.type));

          throw new Error(`❌ No relevant resume chunks found!\n\nTotal chunks: ${allChunks.length}\nResume chunks: ${resumeChunks.length}\n\nPlease:\n1. Upload and process some resumes\n2. Ensure job description has clear keywords\n3. Check that your resume content matches the job requirements`);
        }

        result = await generateTailoredResume(
          jobDescription,
          relevantChunks,
          jobDescription.additionalContext
        );
      }

      if (!result.success || !result.content) {
        throw new Error(result.error || 'Failed to generate resume');
      }

      setGeneratedContent(result.content);
    } catch (error) {
      console.error('Error generating resume:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
      setIsGeneratingResume(false);
    }
  };

  // Generate tailored cover letter
  const handleGenerateCoverLetter = async (jobDescription: JobDescription) => {
    if (!isAIConfigured()) {
      alert('AI service is not configured. Please set up your OpenAI API key in the .env file.');
      return;
    }

    setIsGeneratingCoverLetter(true);
    setGenerationType('cover_letter');
    setGeneratedTitle('Generated Cover Letter');

    // Generate filename: clint-bush-November-2025-Mastercard-FE-cover-letter
    const currentDate = new Date();
    const month = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();
    const cleanCompany = jobDescription.company.replace(/[^a-zA-Z0-9]/g, '').trim();
    const cleanTitle = jobDescription.title
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 8);

    setGeneratedDefaultName(`clint-bush-${month}-${year}-${cleanCompany}-${cleanTitle}-cover-letter`);
    setGeneratedContent('');
    setGenerationError(null);
    setIsGenerating(true);
    setShowGeneratedModal(true);

    try {
      let result;

      if (useFullTextForCoverLetter) {
        // Generate from full resume text
        console.log('🤖 Generating cover letter from full text...');
        const fullResumeText = await getCombinedResumeText();
        result = await generateTailoredCoverLetterFromFullText(
          jobDescription,
          fullResumeText,
          jobDescription.additionalContext
        );
      } else {
        // Generate from chunks (original method)
        console.log('🧩 Generating cover letter from chunks...');
        const relevantChunks = await findRelevantCoverLetterChunks(jobDescription, 0.1, 15);

        if (relevantChunks.length === 0) {
          throw new Error('No relevant chunks found. Please ensure you have uploaded and processed some documents.');
        }

        result = await generateTailoredCoverLetter(
          jobDescription,
          relevantChunks,
          jobDescription.additionalContext
        );
      }

      if (!result.success || !result.content) {
        throw new Error(result.error || 'Failed to generate cover letter');
      }

      setGeneratedContent(result.content);
    } catch (error) {
      console.error('Error generating cover letter:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
      setIsGeneratingCoverLetter(false);
    }
  };

  // Save generated content
  const handleSaveGenerated = async (name: string, content: string) => {
    if (!selectedJob) {
      console.error('No selected job found');
      return;
    }

    console.log('Starting to save generated content:', { name, contentLength: content.length, generationType });

    try {
      if (generationType === 'resume') {
        console.log('Saving generated resume...');
        const newResume = await saveGeneratedResume(name, content, selectedJob);
        console.log('Resume saved successfully:', newResume);

        // Load the updated state from the database to get the correct linking
        const { loadState } = await import('../storage');
        const updatedState = await loadState();
        const updatedSelectedJob = updatedState.jobDescriptions.find((jd: JobDescription) => jd.id === selectedJob.id);

        console.log('Updated job description linking:', updatedSelectedJob?.linkedResumeIds);

        setState(updatedState);
        console.log('State updated with fresh data from database');
      } else {
        console.log('Saving generated cover letter...');
        const newCoverLetter = await saveGeneratedCoverLetter(name, content, selectedJob);
        console.log('Cover letter saved successfully:', newCoverLetter);

        // Load the updated state from the database to get the correct linking
        const { loadState } = await import('../storage');
        const updatedState = await loadState();
        const updatedSelectedJob = updatedState.jobDescriptions.find((jd: JobDescription) => jd.id === selectedJob.id);

        console.log('Updated job description linking:', updatedSelectedJob?.linkedCoverLetterIds);

        setState(updatedState);
        console.log('State updated with fresh data from database');
      }

      alert(`${generationType === 'resume' ? 'Resume' : 'Cover letter'} saved successfully! Check your ${generationType === 'resume' ? 'Resume' : 'Cover Letter'} library.`);
      console.log('Save process completed successfully');
    } catch (error) {
      console.error('Error saving generated content:', error);
      alert(`Failed to save ${generationType === 'resume' ? 'resume' : 'cover letter'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // Resume validation function
  const validateResume = (text: string) => {
    const results: Array<{ type: 'pass' | 'warning' | 'error', message: string }> = [];

    if (!text.trim()) {
      setValidationResults([]);
      return;
    }

    // ATS Checks
    const hasName = /^#\s+/.test(text) || text.includes('# ');
    if (hasName) {
      results.push({ type: 'pass', message: '✓ Contains header with name' });
    } else {
      results.push({ type: 'warning', message: '⚠️ Consider adding name as main header (# Your Name)' });
    }

    const hasContact = /(@|\.|phone|email|linkedin|github)/i.test(text);
    if (hasContact) {
      results.push({ type: 'pass', message: '✓ Contains contact information' });
    } else {
      results.push({ type: 'warning', message: '⚠️ Add contact information (email, phone, LinkedIn)' });
    }

    const hasExperience = /(experience|work|job|position|role)/i.test(text);
    if (hasExperience) {
      results.push({ type: 'pass', message: '✓ Contains work experience section' });
    } else {
      results.push({ type: 'warning', message: '⚠️ Consider adding work experience section' });
    }

    // ASCII Safety Checks with specific character locations
    const lines = text.split('\n');
    const nonAsciiIssues: string[] = [];

    lines.forEach((line, lineIndex) => {
      const nonAsciiMatches = line.match(/[^\x00-\x7F]/g);
      if (nonAsciiMatches) {
        const charDetails = nonAsciiMatches.map(char => {
          const charCode = char.charCodeAt(0);
          let suggestion = '';

          // Common character replacements
          if (char === '—') suggestion = ' (use regular dash -)';
          else if (char === '–') suggestion = ' (use regular dash -)';
          else if (char === '"' || char === '"') suggestion = ' (use straight quotes ")';
          else if (char === '\u2018' || char === '\u2019') suggestion = " (use straight apostrophe ')";
          else if (char === '•') suggestion = ' (use regular dash - for bullets)';
          else if (char === '→') suggestion = ' (remove or use ->)';
          else suggestion = ` (Unicode ${charCode})`;

          return `"${char}"${suggestion}`;
        });

        nonAsciiIssues.push(`Line <a href="#line-${lineIndex + 1}">${lineIndex + 1}</a>: ${charDetails.join(', ')}`);
      }
    });

    if (nonAsciiIssues.length === 0) {
      results.push({ type: 'pass', message: '✓ ASCII-safe (no special characters that could break ATS)' });
    } else {
      nonAsciiIssues.forEach(issue => {
        results.push({ type: 'warning', message: `⚠️ Non-ASCII character found: ${issue}` });
      });
    }

    // Detailed Grammar & Spelling Checks
    const grammarIssues: string[] = [];

    // Check for lowercase "i" 
    const lowercaseI = text.match(/\bi\s/g);
    if (lowercaseI && lowercaseI.length > 0) {
      const count = lowercaseI.length;
      grammarIssues.push(`Found ${count} instance${count > 1 ? 's' : ''} of lowercase "i" - should be "I"`);
    }

    // Check for multiple spaces
    lines.forEach((line, lineIndex) => {
      const multipleSpaces = line.match(/\s{2,}/g);
      if (multipleSpaces) {
        grammarIssues.push(`Line <a href="#line-${lineIndex + 1}">${lineIndex + 1}</a>: Multiple spaces detected (${multipleSpaces.length} occurrence${multipleSpaces.length > 1 ? 's' : ''})`);
      }
    });

    // Check for multiple punctuation
    lines.forEach((line, lineIndex) => {
      const multiplePunct = line.match(/[.!?]{2,}/g);
      if (multiplePunct) {
        multiplePunct.forEach(punct => {
          grammarIssues.push(`Line <a href="#line-${lineIndex + 1}">${lineIndex + 1}</a>: Multiple punctuation "${punct}" - use single punctuation`);
        });
      }
    });

    // Check for lines starting with lowercase (excluding markdown syntax)
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.match(/^[#*\-+>|`\d]/) && trimmed.match(/^[a-z]/)) {
        grammarIssues.push(`Line <a href="#line-${lineIndex + 1}">${lineIndex + 1}</a>: "${trimmed.substring(0, 20)}${trimmed.length > 20 ? '...' : ''}" should start with capital letter`);
      }
    });

    // Check for missing periods at end of sentences
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (trimmed.length > 10 && !trimmed.match(/^[#*\-+>|`]/) && !trimmed.match(/[.!?:;]$/) && !trimmed.match(/\d{4}$/) && trimmed.split(' ').length > 4) {
        grammarIssues.push(`Line <a href="#line-${lineIndex + 1}">${lineIndex + 1}</a>: Sentence may be missing punctuation at end`);
      }
    });

    if (grammarIssues.length === 0) {
      results.push({ type: 'pass', message: '✓ No grammar issues detected' });
    } else {
      grammarIssues.forEach(issue => {
        results.push({ type: 'warning', message: `⚠️ Grammar: ${issue}` });
      });
    }

    // Length check
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount >= 100 && wordCount <= 800) {
      results.push({ type: 'pass', message: `✓ Good length (${wordCount} words)` });
    } else if (wordCount < 100) {
      results.push({ type: 'warning', message: `⚠️ Resume might be too short (${wordCount} words)` });
    } else {
      results.push({ type: 'warning', message: `⚠️ Resume might be too long (${wordCount} words) - consider condensing` });
    }

    // Bullet points check
    const hasBullets = /^\s*[-*+]\s/gm.test(text);
    if (hasBullets) {
      results.push({ type: 'pass', message: '✓ Uses bullet points for better readability' });
    } else {
      results.push({ type: 'warning', message: '⚠️ Consider using bullet points (- or *) for achievements' });
    }

    // Dates format check
    const hasDateFormat = /(19|20)\d{2}|\d{4}\s*-\s*(19|20)\d{2}|present|current/i.test(text);
    if (hasDateFormat) {
      results.push({ type: 'pass', message: '✓ Contains properly formatted dates' });
    } else {
      results.push({ type: 'warning', message: '⚠️ Add dates to work experience (e.g., 2020-2024)' });
    }

    setValidationResults(results);
  };

  const handleClearResume = () => {
    setResumeInputText('');
    setFormattedHTML('');
    setValidationResults([]);
  };

  const handleCopyHTML = async () => {
    if (!formattedHTML) {
      alert('No formatted resume to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(formattedHTML);
      alert('Markdown copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy markdown:', error);
      alert('Failed to copy markdown. Please try again.');
    }
  };

  const handlePrintResume = () => {
    if (!formattedHTML) {
      alert('No formatted resume to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the resume');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Resume</title>
        <style>
          body { 
            font-family: 'Times New Roman', Times, serif; 
            line-height: 1.6; 
            margin: 1in; 
            color: #333;
          }
          .formatted-resume { line-height: 1.6; color: #333; }
          .resume-header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .resume-name { font-size: 24px; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; }
          .resume-contact { font-size: 14px; color: #666; }
          .resume-section { margin-bottom: 20px; }
          .section-title { font-size: 16px; font-weight: bold; text-transform: uppercase; color: #333; border-bottom: 1px solid #333; margin-bottom: 10px; padding-bottom: 2px; letter-spacing: 0.5px; }
          .experience-item, .education-item { margin-bottom: 15px; }
          .item-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
          .job-title, .degree-title { font-weight: bold; font-size: 15px; }
          .company-name, .school-name { font-style: italic; color: #555; }
          .date-range { font-size: 13px; color: #666; }
          .description { margin: 5px 0; padding-left: 15px; }
          .skills-list { display: flex; flex-wrap: wrap; gap: 8px; }
          .skill-item { background: #f8f9fa; border: 1px solid #dee2e6; padding: 4px 8px; border-radius: 4px; font-size: 13px; }
          @media print {
            body { margin: 0.5in; }
            .resume-header { page-break-after: avoid; }
          }
        </style>
      </head>
      <body>
        ${formattedHTML}
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleSaveResume = () => {
    if (!formattedHTML) {
      alert('No formatted resume to save');
      return;
    }
    // Generate a simple filename suggestion
    const today = new Date().toISOString().split('T')[0];
    setSaveFileName(`Resume_${today}`);
    setShowSaveModal(true);
  };

  const handleConfirmSave = async () => {
    if (!saveFileName.trim() || !formattedHTML) {
      alert('Please enter a filename');
      return;
    }

    setIsSaving(true);

    try {
      // Convert HTML to a simple text format for storage
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formattedHTML;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';

      // Create a new resume entry
      const newResume = {
        id: crypto.randomUUID(),
        name: saveFileName.trim(),
        fileName: `${saveFileName.trim()}.html`,
        fileData: btoa(formattedHTML), // Base64 encode the HTML
        fileSize: formattedHTML.length,
        uploadDate: new Date().toISOString(),
        fileType: 'docx' as const, // Required by type, even though we're storing HTML
        textContent: textContent,
        lastChunkUpdate: new Date().toISOString(),
        chunkCount: 0
      };

      // Save to storage using the existing storage functions
      const { saveResume } = await import('../storage');
      await saveResume(newResume);

      // Update state
      setState(prev => ({
        ...prev,
        resumes: [...prev.resumes, newResume]
      }));

      alert('Resume saved successfully!');
      setShowSaveModal(false);
      setSaveFileName('');
    } catch (error) {
      console.error('Error saving resume:', error);
      alert('Failed to save resume. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };



  const selectedJob = selectedJobId ? state.jobDescriptions.find(jd => jd.id === selectedJobId) : null;
  const documentMatches = selectedJob ? getDocumentMatches(selectedJob) : [];

  return (
    <div className="job-descriptions-page">
      <div className="page-header">
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'job-descriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('job-descriptions')}
          >
            Job Descriptions
          </button>
          <button
            className={`tab-button ${activeTab === 'resume-formatter' ? 'active' : ''}`}
            onClick={() => setActiveTab('resume-formatter')}
          >
            Resume Formatter
          </button>
        </div>
        {activeTab === 'job-descriptions' && (
          <button
            className="add-job-button"
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
          >
            + Add Job Description
          </button >
        )}
      </div >

      {showAddForm && (
        <div className="add-job-form">
          <h2>{editingJobId ? 'Edit Job Description' : 'Add New Job Description'}</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="job-title">Job Title *</label>
              <input
                id="job-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Senior Software Engineer"
                disabled={isProcessing}
              />
            </div>
            <div className="form-group">
              <label htmlFor="company-name">Company *</label>
              <input
                id="company-name"
                type="text"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                placeholder="e.g., TechCorp Inc."
                disabled={isProcessing}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="job-url">Job Listing URL (Optional)</label>
            <input
              id="job-url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://company.com/careers/job-id"
              disabled={isProcessing}
            />
          </div>
          <div className="form-group">
            <label htmlFor="job-description">Job Description Text *</label>
            <textarea
              id="job-description"
              value={formData.rawText}
              onChange={(e) => setFormData(prev => ({ ...prev, rawText: e.target.value }))}
              placeholder="Paste the full job description here..."
              rows={10}
              disabled={isProcessing}
            />
          </div>
          <div className="form-group">
            <label htmlFor="additional-context">Additional Context (Optional)</label>
            <textarea
              id="additional-context"
              value={formData.additionalContext}
              onChange={(e) => setFormData(prev => ({ ...prev, additionalContext: e.target.value }))}
              placeholder="Add any additional context that will help generate resumes and cover letters (e.g., bio info, recommendations, ChatGPT summaries, company insights, etc.)"
              rows={6}
              disabled={isProcessing}
            />
            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
              This context will be used when generating tailored resumes and cover letters for this position.
            </small>
          </div>
          <div className="form-actions">
            <button
              onClick={handleCancelEdit}
              disabled={isProcessing}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveJobDescription}
              disabled={isProcessing}
              className="save-button"
            >
              {isProcessing ? 'Processing...' : editingJobId ? 'Update Job Description' : 'Save & Parse with AI'}
            </button>
          </div>
        </div>
      )}

      {
        activeTab === 'job-descriptions' && (
          <div className="job-descriptions-content">
            {state.jobDescriptions.length === 0 ? (
              <div className="empty-state">
                <p>No job descriptions yet. Add one to get started!</p>
              </div>
            ) : (
              <div className="jobs-layout">
                <div className="jobs-list">
                  <h2>Your Job Descriptions ({state.jobDescriptions.length})</h2>
                  {state.jobDescriptions.map(job => (
                    <div
                      key={job.id}
                      className={`job-card ${selectedJobId === job.id ? 'selected' : ''}`}
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <div className="job-header">
                        <h3>{job.title}</h3>
                        <span className={`status-badge status-${job.applicationStatus}`}>
                          {job.applicationStatus?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="job-company">{job.company}</p>
                      <p className="job-date">Added {new Date(job.uploadDate).toLocaleDateString()}</p>
                      <div className="job-stats">
                        <span>{job.keywords.length} keywords</span>
                        <span>{job.linkedResumeIds.length} resumes</span>
                        <span>{job.linkedCoverLetterIds.length} cover letters</span>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedJob && (
                  <div className="job-details">
                    <div className="job-details-header">
                      <h2>{selectedJob.title}</h2>
                      <div className="job-actions">
                        <button
                          className="edit-button"
                          onClick={() => handleEditJobDescription(selectedJob.id)}
                          disabled={showAddForm}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteJobDescription(selectedJob.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="status-selector">
                      <label>Application Status:</label>
                      <select
                        value={selectedJob.applicationStatus || 'not_applied'}
                        onChange={(e) => handleStatusChange(selectedJob.id, e.target.value as JobDescription['applicationStatus'])}
                      >
                        <option value="not_applied">Not Applied</option>
                        <option value="applied">Applied</option>
                        <option value="interviewing">Interviewing</option>
                        <option value="rejected">Rejected</option>
                        <option value="offered">Offered</option>
                      </select>
                    </div>

                    <div className="job-info-section">
                      <h3>Extracted Information</h3>
                      <div className="info-grid">
                        <div className="info-item">
                          <strong>Role:</strong> {selectedJob.extractedInfo.role || 'Not extracted'}
                        </div>
                        <div className="info-item">
                          <strong>Department:</strong> {selectedJob.extractedInfo.department || 'Not specified'}
                        </div>
                        <div className="info-item">
                          <strong>Location:</strong> {selectedJob.extractedInfo.location || 'Not specified'}
                        </div>
                        <div className="info-item">
                          <strong>Experience Level:</strong> {selectedJob.extractedInfo.experienceLevel || 'Not specified'}
                        </div>
                      </div>

                      {selectedJob.url && (
                        <div className="job-url-section">
                          <strong>Job Listing:</strong>
                          <a
                            href={selectedJob.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="job-url-link"
                          >
                            View Original Posting ↗
                          </a>
                        </div>
                      )}

                      {selectedJob.extractedInfo.requiredSkills.length > 0 && (
                        <div className="skills-section">
                          <strong>Required Skills:</strong>
                          <div className="skills-list">
                            {selectedJob.extractedInfo.requiredSkills.map((skill, idx) => (
                              <span key={idx} className="skill-tag required">{skill}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedJob.extractedInfo.preferredSkills.length > 0 && (
                        <div className="skills-section">
                          <strong>Preferred Skills:</strong>
                          <div className="skills-list">
                            {selectedJob.extractedInfo.preferredSkills.map((skill, idx) => (
                              <span key={idx} className="skill-tag preferred">{skill}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Linked Documents Section */}
                    <div className="linked-documents-section">
                      <h3>Linked Documents</h3>

                      {/* Linked Resumes */}
                      {selectedJob.linkedResumeIds.length > 0 && (
                        <div className="linked-category">
                          <h4>📄 Resumes ({selectedJob.linkedResumeIds.length})</h4>
                          <div className="linked-documents-list">
                            {selectedJob.linkedResumeIds.map((resumeId) => {
                              const resume = state.resumes.find((r: any) => r.id === resumeId);
                              return resume ? (
                                <div key={resumeId} className="linked-document-item">
                                  <div className="document-info">
                                    <span className="document-title">{resume.name || resume.fileName}</span>
                                    <span className="document-date">
                                      {new Date(resume.uploadDate).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="document-actions">
                                    <button
                                      className="view-button"
                                      onClick={() => {
                                        console.log('View resume:', resume.name);
                                      }}
                                    >
                                      View
                                    </button>
                                    <button
                                      className="unlink-button"
                                      onClick={() => handleLinkResume(selectedJob.id, resumeId)}
                                      title="Unlink from this job"
                                    >
                                      🔗
                                    </button>
                                  </div>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}

                      {/* Linked Cover Letters */}
                      {selectedJob.linkedCoverLetterIds.length > 0 && (
                        <div className="linked-category">
                          <h4>📝 Cover Letters ({selectedJob.linkedCoverLetterIds.length})</h4>
                          <div className="linked-documents-list">
                            {selectedJob.linkedCoverLetterIds.map((coverLetterId) => {
                              const coverLetter = state.coverLetters.find((cl: any) => cl.id === coverLetterId);
                              return coverLetter ? (
                                <div key={coverLetterId} className="linked-document-item">
                                  <div className="document-info">
                                    <span className="document-title">{coverLetter.name || coverLetter.fileName}</span>
                                    <span className="document-date">
                                      {new Date(coverLetter.uploadDate).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="document-actions">
                                    <button
                                      className="view-button"
                                      onClick={() => {
                                        console.log('View cover letter:', coverLetter.name);
                                      }}
                                    >
                                      View
                                    </button>
                                    <button
                                      className="unlink-button"
                                      onClick={() => handleLinkCoverLetter(selectedJob.id, coverLetterId)}
                                      title="Unlink from this job"
                                    >
                                      🔗
                                    </button>
                                  </div>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}

                      {selectedJob.linkedResumeIds.length === 0 && selectedJob.linkedCoverLetterIds.length === 0 && (
                        <p className="no-linked-documents">
                          No documents linked to this job yet. Generate new documents or link existing ones from the matching results below.
                        </p>
                      )}
                    </div>

                    {selectedJob.additionalContext && (
                      <div className="additional-context-section">
                        <h3>Additional Context</h3>
                        <div className="context-content">
                          <p>{selectedJob.additionalContext}</p>
                        </div>
                      </div>
                    )}

                    <div className="generation-section">
                      <h3>AI Document Generation</h3>
                      <div className="generation-buttons">
                        <button
                          className="generate-button generate-resume"
                          onClick={() => handleGenerateResume(selectedJob)}
                          disabled={isGeneratingResume || isGeneratingCoverLetter}
                        >
                          {isGeneratingResume ? (
                            <>
                              <div className="button-spinner"></div>
                              Generating Resume...
                            </>
                          ) : (
                            <>🤖 Generate Resume</>
                          )}
                        </button>
                        <button
                          className="generate-button generate-cover-letter"
                          onClick={() => handleGenerateCoverLetter(selectedJob)}
                          disabled={isGeneratingResume || isGeneratingCoverLetter}
                        >
                          {isGeneratingCoverLetter ? (
                            <>
                              <div className="button-spinner"></div>
                              Generating Cover Letter...
                            </>
                          ) : (
                            <>🤖 Generate Cover Letter</>
                          )}
                        </button>
                      </div>

                      <div className="generation-options">
                        <div className="generation-toggle">
                          <label className="toggle-label">
                            <input
                              type="checkbox"
                              checked={useFullTextForResume}
                              onChange={(e) => setUseFullTextForResume(e.target.checked)}
                              className="toggle-checkbox"
                            />
                            <span className="toggle-text">
                              📄 Use Full Text Generation for Resume
                              <span className="toggle-badge">{useFullTextForResume ? 'ON' : 'OFF'}</span>
                            </span>
                          </label>
                          <div className="toggle-description">
                            {useFullTextForResume ?
                              'Generates from complete resume text for better context and flow' :
                              'Generates from relevant content chunks (original method)'
                            }
                          </div>
                        </div>

                        <div className="generation-toggle">
                          <label className="toggle-label">
                            <input
                              type="checkbox"
                              checked={useFullTextForCoverLetter}
                              onChange={(e) => setUseFullTextForCoverLetter(e.target.checked)}
                              className="toggle-checkbox"
                            />
                            <span className="toggle-text">
                              📄 Use Full Text Generation for Cover Letter
                              <span className="toggle-badge">{useFullTextForCoverLetter ? 'ON' : 'OFF'}</span>
                            </span>
                          </label>
                          <div className="toggle-description">
                            {useFullTextForCoverLetter ?
                              'Generates from complete resume text for better context and flow' :
                              'Generates from relevant content chunks (original method)'
                            }
                          </div>
                        </div>
                      </div>

                      <p className="generation-description">
                        Generate tailored documents using AI based on this job description and your existing content.
                        <br />
                        <strong>💾 Generated documents will be saved to your Resume/Cover Letter library and automatically linked to this job.</strong>
                      </p>
                    </div>

                    <div className="resume-matching-section">
                      <h3>Document Matching</h3>
                      {documentMatches.length > 0 ? (
                        <div className="resume-matches">
                          {documentMatches.map((match: DocumentMatch) => (
                            <div key={match.documentId} className="resume-match">
                              <div className="match-header">
                                <span className="resume-name">
                                  {match.documentName}
                                  <span className="document-type-badge">
                                    {match.documentType === 'resume' ? '📄' : '📝'}
                                  </span>
                                </span>
                                <span className="match-score">
                                  {Math.round(match.matchScore * 100)}% match
                                </span>
                                <button
                                  className={`link-button ${(match.documentType === 'resume' && selectedJob.linkedResumeIds.includes(match.documentId)) ||
                                    (match.documentType === 'cover_letter' && selectedJob.linkedCoverLetterIds.includes(match.documentId))
                                    ? 'linked' : ''
                                    }`}
                                  onClick={() => {
                                    if (match.documentType === 'resume') {
                                      handleLinkResume(selectedJob.id, match.documentId);
                                    } else {
                                      handleLinkCoverLetter(selectedJob.id, match.documentId);
                                    }
                                  }}
                                >
                                  {((match.documentType === 'resume' && selectedJob.linkedResumeIds.includes(match.documentId)) ||
                                    (match.documentType === 'cover_letter' && selectedJob.linkedCoverLetterIds.includes(match.documentId)))
                                    ? 'Unlink' : 'Link'}
                                </button>
                              </div>
                              <div className="matched-keywords">
                                <strong>Matched keywords:</strong> {match.matchedKeywords.join(', ')}
                              </div>
                              {match.skillMatches.length > 0 && (
                                <div className="skill-matches">
                                  <strong>Skill matches:</strong> {match.skillMatches.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-matches">No matching documents found based on keywords and skills.</p>
                      )}
                    </div>

                    <div className="keywords-section">
                      <h3>Keywords ({selectedJob.keywords.length})</h3>
                      <div className="keywords-list">
                        {selectedJob.keywords.map((keyword, idx) => (
                          <span key={idx} className="keyword-tag">{keyword}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      }

      {
        activeTab === 'resume-formatter' && (
          <div className="resume-formatter-content">
            <div className="formatter-header">
              <h2>Resume Formatter</h2>
              <p>Paste your raw resume text below and get a clean, ATS-friendly formatted output</p>
            </div>
            <div className="output-controls">
              <button
                className="save-button"
                onClick={handleSaveResume}
                disabled={!formattedHTML}
              >
                💾 Save Resume
              </button>
              <button
                className="copy-button"
                onClick={handleCopyHTML}
                disabled={!formattedHTML}
              >
                Copy HTML
              </button>
              <button
                className="print-button"
                onClick={handlePrintResume}
                disabled={!formattedHTML}
              >
                Print
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
                    <p>Start typing to see ATS, grammar, and formatting validation...</p>
                    <div className="markdown-tips">
                      <p><strong>Quick Tips:</strong></p>
                      <ul>
                        <li><code># Your Name</code> for main heading</li>
                        <li><code>## Section Title</code> for sections</li>
                        <li><code>**Bold Text**</code> for emphasis</li>
                        <li><code>- Bullet point</code> for lists</li>
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
                    placeholder="Paste your raw resume markdown here..."
                    value={resumeInputText}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setResumeInputText(newValue);

                      // Auto-format markdown and generate filename
                      if (newValue.trim()) {
                        setFormattedHTML(newValue);
                        const today = new Date().toISOString().split('T')[0];
                        setSaveFileName(`Resume_${today}`);

                        // Run validation
                        validateResume(newValue);
                      } else {
                        setFormattedHTML('');
                        setValidationResults([]);
                      }
                    }}
                    rows={20}
                    spellCheck={true}
                  />
                </div>
                <div className="formatter-controls">
                  <button
                    className="clear-button"
                    onClick={handleClearResume}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="output-section">
                <h3>Formatted Output</h3>
                <div className="formatted-output">
                  {formattedHTML ? (
                    <div className="markdown-with-lines">
                      <div className="line-numbers">
                        {formattedHTML.split('\n').map((_, index) => (
                          <div key={index} className="line-number">{index + 1}</div>
                        ))}
                      </div>
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            h2: ({ ...props }) => <h2 style={{ margin: '1.25em 0 .5em 0' }} {...props} />,
                            p: ({ ...props }) => <p style={{ margin: '.5em 0' }} {...props} />
                          }}
                        >
                          {formattedHTML}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <p className="placeholder-text">Formatted resume will appear here...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Save Resume Modal */}
      {
        showSaveModal && (
          <div className="modal-overlay">
            <div className="modal-content save-modal">
              <h3>Save Formatted Resume</h3>
              <div className="form-group">
                <label htmlFor="resume-name">Resume Name</label>
                <input
                  id="resume-name"
                  type="text"
                  value={saveFileName}
                  onChange={(e) => setSaveFileName(e.target.value)}
                  placeholder="Enter a name for your resume"
                  disabled={isSaving}
                />
              </div>
              <div className="modal-actions">
                <button
                  className="cancel-button"
                  onClick={() => {
                    setShowSaveModal(false);
                    setSaveFileName('');
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className="save-button"
                  onClick={handleConfirmSave}
                  disabled={isSaving || !saveFileName.trim()}
                >
                  {isSaving ? 'Saving...' : 'Save Resume'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      <GeneratedContentModal
        isOpen={showGeneratedModal}
        onClose={() => setShowGeneratedModal(false)}
        onSave={handleSaveGenerated}
        title={generatedTitle}
        content={generatedContent}
        isLoading={isGenerating}
        error={generationError || undefined}
        defaultName={generatedDefaultName}
      />
    </div >
  );
};

export default JobDescriptionsPage;