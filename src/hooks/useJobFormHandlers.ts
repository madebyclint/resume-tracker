import { useState, useCallback } from 'react';
import { JobDescription } from '../types';
import { fetchJobDescriptionFromURL, isAIConfigured } from '../utils/aiService';
import { smartParseJobDescription } from '../utils/aiParsingService';
import { saveJobDescription } from '../storage';
import { createTextHash, calculateAICost, extractSalaryMin, extractSalaryMax } from '../utils/jobDescriptionHelpers';
import { JobDescriptionFormData, convertFormDataToJobDescription } from './useJobFormData';

interface JobFormHandlers {
  isProcessing: boolean;
  isFetchingURL: boolean;
  fetchError: string | null;
  isReparsing: boolean;
  lastParseUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  
  handleFetchURL: (url: string, formData: JobDescriptionFormData, setFormData: any) => Promise<void>;
  handleReparse: (
    rawText: string, 
    formData: JobDescriptionFormData,
    setFormData: any,
    aiParseCache: Map<string, any>,
    setAiParseCache: any,
    editingJobId: string | null,
    existingJob: JobDescription | null,
    setState: any,
    showToast: any,
    getNextSequentialId: () => number
  ) => Promise<void>;
  handleSaveJobDescription: (
    formData: JobDescriptionFormData,
    editingJobId: string | null,
    state: any,
    setState: any,
    showToast: any,
    getNextSequentialId: () => number,
    aiParseCache: Map<string, any>,
    setAiParseCache: any,
    resetForm: () => void
  ) => Promise<void>;
}

// Helper function to clean up LinkedIn URLs
const cleanLinkedInUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('linkedin.com') && urlObj.pathname.startsWith('/jobs/view/')) {
      const jobId = urlObj.pathname.split('/')[3];
      return `https://www.linkedin.com/jobs/view/${jobId}`;
    }
    return url;
  } catch {
    return url;
  }
};

export const useJobFormHandlers = (): JobFormHandlers => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingURL, setIsFetchingURL] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isReparsing, setIsReparsing] = useState(false);
  const [lastParseUsage, setLastParseUsage] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null>(null);

  const handleFetchURL = useCallback(async (
    url: string, 
    formData: JobDescriptionFormData, 
    setFormData: any
  ) => {
    if (!url?.trim()) {
      setFetchError('Please enter a URL first');
      return;
    }

    setIsFetchingURL(true);
    setFetchError(null);

    try {
      const result = await fetchJobDescriptionFromURL(url.trim());

      if (result.success) {
        setFormData((prev: JobDescriptionFormData) => ({
          ...prev,
          title: result.title || prev.title,
          company: result.company || prev.company,
          rawText: result.text || prev.rawText
        }));
        setFetchError(null);
      } else {
        setFetchError(result.error || 'Failed to fetch job description from URL');

        if (result.corsBlocked) {
          setTimeout(() => {
            const textarea = document.getElementById('job-description') as HTMLTextAreaElement;
            if (textarea) {
              textarea.focus();
              textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      }
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch URL');
    } finally {
      setIsFetchingURL(false);
    }
  }, []);

  const handleReparse = useCallback(async (
    rawText: string,
    formData: JobDescriptionFormData,
    setFormData: any,
    aiParseCache: Map<string, any>,
    setAiParseCache: any,
    editingJobId: string | null,
    existingJob: JobDescription | null,
    setState: any,
    showToast: any,
    getNextSequentialId: () => number
  ) => {
    if (!rawText.trim()) {
      showToast('Please add job description text first', 'warning');
      return;
    }

    setIsReparsing(true);

    try {
      const result = await smartParseJobDescription(
        rawText,
        existingJob,
        aiParseCache,
        setAiParseCache,
        {
          applicationDate: new Date().toISOString().split('T')[0],
          applicationId: parseInt(formData.sequentialId) || getNextSequentialId(),
          impactFocus: 'Re-parsed Job Description',
          impactLevel: 'Standard'
        }
      );

      if (result.success && result.extractedInfo) {
        const info = result.extractedInfo;

        if (result.usage && !result.fromCache) {
          setLastParseUsage(result.usage);

          if (editingJobId && existingJob) {
            const textHash = createTextHash(rawText.trim());
            const estimatedCost = calculateAICost(result.usage);
            const updatedUsage = {
              totalTokens: (existingJob.aiUsage?.totalTokens || 0) + result.usage.totalTokens,
              promptTokens: (existingJob.aiUsage?.promptTokens || 0) + result.usage.promptTokens,
              completionTokens: (existingJob.aiUsage?.completionTokens || 0) + result.usage.completionTokens,
              estimatedCost: (existingJob.aiUsage?.estimatedCost || 0) + estimatedCost,
              parseCount: (existingJob.aiUsage?.parseCount || 0) + 1,
              lastParseDate: new Date().toISOString(),
              rawTextHash: textHash
            };

            setState((prev: any) => ({
              ...prev,
              jobDescriptions: prev.jobDescriptions.map((job: JobDescription) =>
                job.id === editingJobId
                  ? {
                    ...job,
                    extractedInfo: info,
                    keywords: result.keywords || [],
                    aiUsage: updatedUsage
                  }
                  : job
              )
            }));

            const updatedJob: JobDescription = {
              ...existingJob,
              extractedInfo: info,
              keywords: result.keywords || [],
              aiUsage: updatedUsage
            };
            saveJobDescription(updatedJob);
          }
        }

        setFormData((prev: JobDescriptionFormData) => ({
          ...prev,
          title: info.role || prev.title,
          company: info.company || prev.company,
          role: info.role || prev.role,
          location: info.location || prev.location,
          workArrangement: (info.workArrangement || prev.workArrangement) as 'hybrid' | 'remote' | 'office' | '',
          salaryMin: info.salaryRange ? extractSalaryMin(info.salaryRange) : prev.salaryMin,
          salaryMax: info.salaryRange ? extractSalaryMax(info.salaryRange) : prev.salaryMax,
          url: info.jobUrl ? cleanLinkedInUrl(info.jobUrl) : prev.url,
          source1Type: info.jobUrl ? 'url' : prev.source1Type,
          source1Content: info.jobUrl ? cleanLinkedInUrl(info.jobUrl) : prev.source1Content,
          sequentialId: prev.sequentialId || (info.applicationId ? info.applicationId.toString() : prev.sequentialId)
        }));

        const message = result.fromCache 
          ? 'Job description processed successfully using cached data (no additional AI cost)!'
          : 'Job description re-parsed successfully! Check the extracted details.';
        showToast(message, 'success');
      } else {
        showToast('Failed to parse job description. Please check the text and try again.', 'error');
      }
    } catch (error) {
      showToast('Error parsing job description: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    } finally {
      setIsReparsing(false);
    }
  }, []);

  const handleSaveJobDescription = useCallback(async (
    formData: JobDescriptionFormData,
    editingJobId: string | null,
    state: any,
    setState: any,
    showToast: any,
    getNextSequentialId: () => number,
    aiParseCache: Map<string, any>,
    setAiParseCache: any,
    resetForm: () => void
  ) => {
    if (!formData.title.trim() || !formData.company.trim() || !formData.rawText.trim()) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      const isEditing = editingJobId !== null;
      const existingJob = isEditing ? state.jobDescriptions.find((jd: JobDescription) => jd.id === editingJobId) : null;

      const finalTitle = formData.title.trim();
      const finalCompany = formData.company.trim();

      if (isEditing && existingJob) {
        const convertedData = convertFormDataToJobDescription(formData);
        const updatedJobDescription: JobDescription = {
          ...existingJob,
          ...convertedData,
          title: finalTitle,
          company: finalCompany,
          url: formData.url?.trim() ? cleanLinkedInUrl(formData.url.trim()) : undefined,
          rawText: formData.rawText.trim(),
          salaryRange: (formData.salaryMin && formData.salaryMax) ? `$${formData.salaryMin} - $${formData.salaryMax}` : undefined,
          applicationDate: formData.applicationDate || existingJob.applicationDate,
          extractedInfo: existingJob.extractedInfo || {
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            requirements: []
          },
          keywords: existingJob.keywords || []
        };

        await saveJobDescription(updatedJobDescription);

        setState((prev: any) => ({
          ...prev,
          jobDescriptions: prev.jobDescriptions.map((jd: JobDescription) =>
            jd.id === editingJobId ? updatedJobDescription : jd
          )
        }));
      } else {
        const convertedData = convertFormDataToJobDescription(formData);
        const sequentialId = convertedData.sequentialId || getNextSequentialId();

        const newJobDescription: JobDescription = {
          ...convertedData,
          id: crypto.randomUUID(),
          sequentialId: isNaN(sequentialId) ? getNextSequentialId() : sequentialId,
          title: finalTitle,
          company: finalCompany,
          url: formData.url?.trim() ? cleanLinkedInUrl(formData.url.trim()) : undefined,
          rawText: formData.rawText.trim(),
          salaryRange: (formData.salaryMin && formData.salaryMax) ? `$${formData.salaryMin} - $${formData.salaryMax}` : undefined,
          extractedInfo: {
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            requirements: []
          },
          keywords: [],
          uploadDate: new Date().toISOString(),
          applicationDate: formData.applicationDate || undefined
        };

        // Parse job description with AI if configured and text is available
        if (formData.rawText.trim() && isAIConfigured()) {
          try {
            const parseResult = await smartParseJobDescription(
              formData.rawText,
              null,
              aiParseCache,
              setAiParseCache,
              {
                applicationDate: new Date().toISOString().split('T')[0],
                applicationId: sequentialId,
                impactFocus: 'New Job Description',
                impactLevel: 'Standard'
              }
            );

            if (parseResult.success && parseResult.extractedInfo) {
              newJobDescription.extractedInfo = parseResult.extractedInfo;
              newJobDescription.keywords = parseResult.keywords || [];

              if (parseResult.usage && !parseResult.fromCache) {
                const textHash = createTextHash(formData.rawText.trim());
                const estimatedCost = calculateAICost(parseResult.usage);
                newJobDescription.aiUsage = {
                  totalTokens: parseResult.usage.totalTokens,
                  promptTokens: parseResult.usage.promptTokens,
                  completionTokens: parseResult.usage.completionTokens,
                  estimatedCost: estimatedCost,
                  parseCount: 1,
                  lastParseDate: new Date().toISOString(),
                  rawTextHash: textHash
                };
              } else if (parseResult.fromCache) {
                const textHash = createTextHash(formData.rawText.trim());
                newJobDescription.aiUsage = {
                  totalTokens: 0,
                  promptTokens: 0,
                  completionTokens: 0,
                  estimatedCost: 0,
                  parseCount: 0,
                  lastParseDate: new Date().toISOString(),
                  rawTextHash: textHash
                };
              }
            }
          } catch (parseError) {
            console.warn('Failed to parse job description with AI:', parseError);
          }
        }

        await saveJobDescription(newJobDescription);

        setState((prev: any) => ({
          ...prev,
          jobDescriptions: [...prev.jobDescriptions, newJobDescription]
        }));
      }

      resetForm();
      showToast('Job description saved successfully!', 'success');

    } catch (error) {
      console.error('Error saving job description:', error);
      showToast('Failed to save job description. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    isProcessing,
    isFetchingURL,
    fetchError,
    isReparsing,
    lastParseUsage,
    handleFetchURL,
    handleReparse,
    handleSaveJobDescription
  };
};