import { useState, useCallback } from 'react';
import { JobDescription } from '../types';
import { isAIConfigured } from '../utils/aiService';

// Stub functions that were removed
const getCombinedResumeText = async () => '';
const generateTailoredResumeFromFullText = async (jobDescription?: any, fullResumeText?: string, additionalContext?: any) => ({ success: false, error: 'Feature removed', content: '' });
const generateTailoredCoverLetterFromFullText = async (jobDescription?: any, fullResumeText?: string, additionalContext?: any) => ({ success: false, error: 'Feature removed', content: '' });
const saveGeneratedResume = async (name?: string, content?: string, selectedJob?: any) => ({});
const saveGeneratedCoverLetter = async (name?: string, content?: string, selectedJob?: any) => ({});

interface GenerationHandlers {
  // Generation modal state
  showGeneratedModal: boolean;
  generatedContent: string;
  generatedTitle: string;
  generatedDefaultName: string;
  generationType: 'resume' | 'cover_letter';
  isGenerating: boolean;
  generationError: string | null;
  isGeneratingResume: boolean;
  isGeneratingCoverLetter: boolean;
  
  // CSV import state
  showCSVImportModal: boolean;
  
  // Generation handlers
  handleGenerateResume: (jobDescription: JobDescription, showToast: any) => Promise<void>;
  handleGenerateCoverLetter: (jobDescription: JobDescription, showToast: any) => Promise<void>;
  handleSaveGenerated: (name: string, content: string, selectedJob: JobDescription | null, showToast: any, setState: any) => Promise<void>;
  
  // CSV handlers
  handleCSVImport: (jobDescriptions: JobDescription[], setState: any, showToast: any) => Promise<void>;
  
  // Modal controls
  setShowGeneratedModal: (show: boolean) => void;
  setShowCSVImportModal: (show: boolean) => void;
  
  // Document preview
  handlePreviewDocument: (document: { textContent?: string }) => void;
}

export const useGenerationHandlers = (): GenerationHandlers => {
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedDefaultName, setGeneratedDefaultName] = useState('');
  const [generationType, setGenerationType] = useState<'resume' | 'cover_letter'>('resume');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);

  const handleGenerateResume = useCallback(async (
    jobDescription: JobDescription,
    showToast: any
  ) => {
    if (!isAIConfigured()) {
      showToast('AI service is not configured. Please set up your OpenAI API key in the .env file.', 'warning');
      return;
    }

    setIsGeneratingResume(true);
    setGenerationType('resume');
    setGeneratedTitle('Generated Resume');

    // Generate ATS-optimized filename
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

    setGeneratedDefaultName(`clint-bush-${month}-${year}-${cleanCompany}-${cleanTitle}-resume`);
    setGeneratedContent('');
    setGenerationError(null);
    setIsGenerating(true);
    setShowGeneratedModal(true);

    try {
      console.log('🤖 Generating resume from full text...');
      const fullResumeText = await getCombinedResumeText();
      const result = await generateTailoredResumeFromFullText(
        jobDescription,
        fullResumeText,
        jobDescription.additionalContext
      );

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
  }, []);

  const handleGenerateCoverLetter = useCallback(async (
    jobDescription: JobDescription,
    showToast: any
  ) => {
    if (!isAIConfigured()) {
      showToast('AI service is not configured. Please set up your OpenAI API key in the .env file.', 'warning');
      return;
    }

    setIsGeneratingCoverLetter(true);
    setGenerationType('cover_letter');
    setGeneratedTitle('Generated Cover Letter');

    // Generate filename
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
      console.log('🤖 Generating cover letter from full text...');
      const fullResumeText = await getCombinedResumeText();
      const result = await generateTailoredCoverLetterFromFullText(
        jobDescription,
        fullResumeText,
        jobDescription.additionalContext
      );

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
  }, []);

  const handleSaveGenerated = useCallback(async (
    name: string,
    content: string,
    selectedJob: JobDescription | null,
    showToast: any,
    setState: any
  ) => {
    if (!selectedJob) {
      console.error('No selected job found');
      return;
    }

    console.log('Starting to save generated content:', { name, contentLength: content.length, generationType });

    try {
      if (generationType === 'resume') {
        console.log('Saving generated resume...');
        await saveGeneratedResume(name, content, selectedJob);
        console.log('Resume saved successfully');
      } else {
        console.log('Saving generated cover letter...');
        await saveGeneratedCoverLetter(name, content, selectedJob);
        console.log('Cover letter saved successfully');
      }

      // Load the updated state from the database
      const { loadState } = await import('../storage');
      const updatedState = await loadState();
      setState(updatedState);

      showToast(`${generationType === 'resume' ? 'Resume' : 'Cover letter'} saved successfully! Check your ${generationType === 'resume' ? 'Resume' : 'Cover Letter'} library.`, 'success');
      console.log('Save process completed successfully');
    } catch (error) {
      console.error('Error saving generated content:', error);
      showToast(`Failed to save ${generationType === 'resume' ? 'resume' : 'cover letter'}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      throw error;
    }
  }, [generationType]);

  const handleCSVImport = useCallback(async (
    jobDescriptions: JobDescription[],
    setState: any,
    showToast: any
  ) => {
    try {
      const { saveJobDescription } = await import('../storage');
      
      // Save all job descriptions to storage
      for (const jobDesc of jobDescriptions) {
        await saveJobDescription(jobDesc);
      }

      // Update state with new job descriptions
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: [...prev.jobDescriptions, ...jobDescriptions]
      }));

      showToast(`Successfully imported ${jobDescriptions.length} job description${jobDescriptions.length === 1 ? '' : 's'}!`, 'success');
    } catch (error) {
      console.error('Error importing CSV:', error);
      showToast(`Failed to import job descriptions: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, []);

  const handlePreviewDocument = useCallback((document: { textContent?: string }) => {
    const content = document.textContent || 'No content available';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, []);

  return {
    // State
    showGeneratedModal,
    generatedContent,
    generatedTitle,
    generatedDefaultName,
    generationType,
    isGenerating,
    generationError,
    isGeneratingResume,
    isGeneratingCoverLetter,
    showCSVImportModal,
    
    // Handlers
    handleGenerateResume,
    handleGenerateCoverLetter,
    handleSaveGenerated,
    handleCSVImport,
    handlePreviewDocument,
    
    // Modal controls
    setShowGeneratedModal,
    setShowCSVImportModal
  };
};