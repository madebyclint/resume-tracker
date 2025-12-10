import React, { useState, useMemo, useEffect } from 'react';
import ReactDOMServer from 'react-dom/server';
import { useAppState } from '../state/AppStateContext';
import { JobDescription, Resume, CoverLetter } from '../types';
import { parseJobDescription, generateTailoredResumeFromFullText, generateTailoredCoverLetterFromFullText, getCombinedResumeText, isAIConfigured, fetchJobDescriptionFromURL } from '../utils/aiService';
import { saveJobDescription, deleteJobDescription, saveGeneratedResume, saveGeneratedCoverLetter, exportAllDataAsJSON, importAllDataFromJSON } from '../storage';
import { calculateDocumentMatches, DocumentMatch } from '../utils/documentMatcher';
import { logStatusChange, logActivity } from '../utils/activityLogger';
import { extensionService, ExtensionJobData, ExtensionService } from '../utils/extensionService';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import GeneratedContentModal from '../components/GeneratedContentModal';
import ValidationMessage from '../components/ValidationMessage';
import CSVImportModal from '../components/CSVImportModal';
import StorageMonitor from '../components/StorageMonitor';
import JobManagementTable from '../components/JobManagementTable';
import StatusDropdown from '../components/StatusDropdown';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import ActionReminderPanel from '../components/ActionReminderPanel';

import './JobDescriptionsPage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbsUp, faMinus, faFire, faTimes, faEdit, faCopy, faTable, faFileAlt, faFileImport, faChartBar, faDollarSign, faSync, faArrowUp, faArrowDown, faCheck, faExclamationTriangle, faPaperclip, faPlus, faSearch, faEye, faDownload, faUpload, faCog } from '@fortawesome/free-solid-svg-icons';

// Remove the local interface since we're using the one from documentMatcher

// Helper functions to extract min/max from salary ranges
const extractSalaryMin = (salaryRange: string): string => {
  const match = salaryRange.match(/\$?([\d,]+)k?/i);
  if (!match) return '';
  let value = match[1].replace(/,/g, '');
  // If the original match included 'k', multiply by 1000
  if (match[0].toLowerCase().includes('k')) {
    value = (parseInt(value) * 1000).toString();
  }
  return value;
};

const extractSalaryMax = (salaryRange: string): string => {
  const matches = salaryRange.match(/\$?([\d,]+)k?/gi);
  if (matches && matches.length >= 2) {
    let value = matches[1].replace(/[\$,]/gi, '');
    // If the second match included 'k', multiply by 1000
    if (matches[1].toLowerCase().includes('k')) {
      value = (parseInt(value) * 1000).toString();
    }
    return value;
  }
  return '';
};

// Helper function to create a simple hash from text (for cache key)
const createTextHash = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
};

// Helper function to determine if a job needs AI processing (is "unparsed")
const isJobUnparsed = (job: JobDescription): boolean => {
  // A job is considered unparsed primarily if it lacks AI processing
  const lacksAIUsage = !job.aiUsage || job.aiUsage.parseCount === 0;

  // Secondary check: missing sequential ID (usually assigned during AI parsing)
  const lacksSequentialId = !job.sequentialId;

  // Only consider jobs with substantial raw text content that haven't been AI processed
  return !!(job.rawText && job.rawText.trim().length > 100 && lacksAIUsage && lacksSequentialId);
};

// Helper function to calculate AI costs (OpenAI GPT-3.5/4 pricing)
const calculateAICost = (usage: { promptTokens: number; completionTokens: number; totalTokens: number }): number => {
  // OpenAI GPT-3.5-turbo pricing (as of Dec 2025): $0.001 per 1K input tokens, $0.002 per 1K output tokens
  // GPT-4 pricing: $0.01 per 1K input tokens, $0.03 per 1K output tokens
  // Using GPT-3.5 rates as default - adjust based on your model usage
  const inputCostPer1K = 0.001;
  const outputCostPer1K = 0.002;

  const inputCost = (usage.promptTokens / 1000) * inputCostPer1K;
  const outputCost = (usage.completionTokens / 1000) * outputCostPer1K;

  return inputCost + outputCost;
};

// Smart AI parsing function that avoids duplicate calls
const smartParseJobDescription = async (
  rawText: string,
  existingJob: JobDescription | null,
  cache: Map<string, any>,
  setCache: (cache: Map<string, any>) => void,
  additionalContext?: any
): Promise<{
  success: boolean;
  extractedInfo?: any;
  keywords?: string[];
  usage?: any;
  error?: string;
  fromCache?: boolean;
}> => {
  if (!rawText.trim()) {
    return { success: false, error: 'No text to parse' };
  }

  const textHash = createTextHash(rawText.trim());
  const cacheKey = `${textHash}_${JSON.stringify(additionalContext || {})}`;

  // Check if existing job already has this text parsed
  if (existingJob?.aiUsage?.rawTextHash === textHash && existingJob.extractedInfo) {
    console.log('Using existing job data - text unchanged');
    return {
      success: true,
      extractedInfo: existingJob.extractedInfo,
      keywords: existingJob.keywords,
      fromCache: true
    };
  }

  // Check in-memory cache
  const cachedResult = cache.get(cacheKey);
  if (cachedResult && (Date.now() - cachedResult.timestamp) < 5 * 60 * 1000) { // 5 minute cache
    console.log('Using cached AI result');
    return {
      ...cachedResult.result,
      fromCache: true
    };
  }

  // No cache hit - make AI call
  console.log('Making new AI parsing call');
  const result = await parseJobDescription(rawText, additionalContext);

  // Cache the result if successful
  if (result.success) {
    const newCache = new Map(cache);
    newCache.set(cacheKey, {
      result,
      textHash,
      timestamp: Date.now()
    });
    setCache(newCache);
  }

  return result;
};

// Helper function to format currency
const formatCurrency = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

// Helper function to clean up LinkedIn URLs
const cleanLinkedInUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('linkedin.com') && urlObj.pathname.startsWith('/jobs/view/')) {
      // Extract just the job ID from the path
      const jobId = urlObj.pathname.split('/')[3];
      return `https://www.linkedin.com/jobs/view/${jobId}`;
    }
    return url; // Return original URL if not a LinkedIn job URL
  } catch {
    return url; // Return original if URL is invalid
  }
};

// Helper function to estimate cost based on OpenAI pricing
const estimateCost = (usage: { promptTokens: number; completionTokens: number }): string => {
  // GPT-3.5-turbo pricing (as of 2024): $0.50 per 1M input tokens, $1.50 per 1M output tokens
  // GPT-4 pricing: $10.00 per 1M input tokens, $30.00 per 1M output tokens
  // Using GPT-3.5-turbo rates as default
  const inputCostPer1M = 0.50;
  const outputCostPer1M = 1.50;

  const inputCost = (usage.promptTokens / 1_000_000) * inputCostPer1M;
  const outputCost = (usage.completionTokens / 1_000_000) * outputCostPer1M;
  const totalCost = inputCost + outputCost;

  if (totalCost < 0.001) {
    return `<$0.001`;
  }
  return `~$${totalCost.toFixed(4)}`;
};

// Helper function to get impact level icon
const getImpactIcon = (impact: any) => {
  if (typeof impact === 'boolean') {
    return impact ? faFire : null;
  }
  switch (impact) {
    case 'high': return faFire;
    case 'medium': return faThumbsUp;
    case 'low': return null;
    default: return null;
  }
};

// Helper function to get impact level color
const getImpactColor = (impact: any) => {
  if (typeof impact === 'boolean') {
    return impact ? '#ff6b35' : '#6c757d';
  }
  switch (impact) {
    case 'high': return '#ff6b35'; // Orange/red for high impact
    case 'medium': return '#28a745'; // Green for medium
    case 'low': return '#6c757d'; // Gray for low (no icon)
    default: return '#6c757d'; // Gray for unspecified
  }
};

const JobDescriptionsPage: React.FC = () => {
  const { state, setState } = useAppState();
  const [activeTab, setActiveTab] = useState<'job-descriptions' | 'analytics'>('job-descriptions');
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    url: '',
    rawText: '',
    additionalContext: '',
    notes: '',
    sequentialId: '',
    role: '',
    location: '',
    workArrangement: '' as 'hybrid' | 'remote' | 'office' | '',
    source1Type: 'url' as 'url' | 'text',
    source1Content: '',
    source2Type: 'url' as 'url' | 'text',
    source2Content: '',
    salaryMin: '',
    salaryMax: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    impact: '' as 'low' | 'medium' | 'high' | '',
    applicationDate: '',
    applicationStatus: '' as 'not_applied' | 'applied' | 'interviewing' | 'rejected' | 'offered' | 'withdrawn' | 'duplicate' | 'archived' | ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingURL, setIsFetchingURL] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isReparsing, setIsReparsing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [lastParseUsage, setLastParseUsage] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  // Duplicate job handling
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateJobId, setDuplicateJobId] = useState<string | null>(null);

  // Filter state
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  const [hideRejectedJobs, setHideRejectedJobs] = useState(true);
  const [showOnlyWaitingJobs, setShowOnlyWaitingJobs] = useState(false);
  const [showUnparsedFirst, setShowUnparsedFirst] = useState(true); // Show unparsed jobs at the top by default
  const [searchQuery, setSearchQuery] = useState('');
  const [duplicateSearchQuery, setDuplicateSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'not_applied' | 'applied' | 'interviewing' | 'rejected' | 'offered' | 'withdrawn' | ''>('');

  // Document matching toggle state
  const [showDocumentMatching, setShowDocumentMatching] = useState<Record<string, boolean>>({});

  // Extension listener for job data from browser extension
  useEffect(() => {
    const handleExtensionJobData = (extensionData: ExtensionJobData) => {
      try {
        // Convert extension data to job description format
        const jobDescription = ExtensionService.convertToJobDescription(extensionData);

        // Add to state
        setState(prevState => ({
          ...prevState,
          jobDescriptions: [...prevState.jobDescriptions, jobDescription]
        }));

        // Log activity and save to storage
        const jobWithActivity = logActivity(jobDescription, 'field_updated', {
          field: 'imported',
          toValue: true,
          details: `Imported from ${extensionData.source} via browser extension`
        });

        // Save to storage
        saveJobDescription(jobWithActivity);

        // Show success toast
        showToast(
          `Job "${jobDescription.title}" imported from browser extension!`,
          'success',
          5000
        );

        console.log('Successfully imported job from extension:', jobDescription);
      } catch (error) {
        console.error('Error importing job from extension:', error);
        showToast('Failed to import job from browser extension', 'error');
      }
    };

    // Add listener to extension service
    extensionService.addJobDataListener(handleExtensionJobData);

    // Cleanup listener on unmount
    return () => {
      extensionService.removeJobDataListener(handleExtensionJobData);
    };
  }, [setState]);

  // Toast helper functions
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { id, message, type, duration };
    setToasts(prev => [...prev, newToast]);

    // Auto-remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const jsonData = await exportAllDataAsJSON();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `resume-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Failed to export data. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement)?.files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const jsonString = await file.text();

        // Validate JSON before importing
        let parsedData;
        try {
          parsedData = JSON.parse(jsonString);
        } catch (parseError) {
          throw new Error(`Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
        }

        // Check for basic structure
        if (!parsedData || typeof parsedData !== 'object') {
          throw new Error('Invalid backup file structure');
        }

        const result = await importAllDataFromJSON(jsonString, {
          replaceExisting: false,
          skipDuplicates: true
        });

        if (result.success || result.importedCounts.resumes > 0 || result.importedCounts.coverLetters > 0 || result.importedCounts.jobDescriptions > 0) {
          // Refresh state by reloading from storage
          const { loadState } = await import('../storage');
          const newState = await loadState();
          setState(newState);

          const imported = result.importedCounts;
          let message = `Successfully imported: ${imported.resumes} resumes, ${imported.coverLetters} cover letters, ${imported.jobDescriptions} job descriptions.`;
          showToast(message, 'success');

          if (result.warnings.length > 0) {
            result.warnings.forEach(warning => showToast(warning, 'warning'));
          }
        } else {
          showToast(`Import failed: ${result.errors.join(', ')}`, 'error');
        }
      } catch (error) {
        console.error('Import failed:', error);
        showToast('Failed to import data. Please check the file format and try again.', 'error');
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };
  const [showExpandedStats, setShowExpandedStats] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('line');
  const [aiParseCache, setAiParseCache] = useState<Map<string, {
    result: any;
    textHash: string;
    timestamp: number;
  }>>(new Map());
  const [toasts, setToasts] = useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
  }>>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Memoized calculations for better performance
  const statsData = useMemo(() => {
    // Filter active jobs for stats (exclude archived and duplicate JDs)
    const activeJobs = state.jobDescriptions.filter(job => {
      // Exclude if explicitly archived
      if (job.isArchived) return false;
      // Exclude if status is archived
      if (job.applicationStatus === 'archived') return false;
      // Exclude if it's a duplicate
      if (job.applicationStatus === 'duplicate' || job.duplicateOfId) return false;
      return true;
    });

    // Basic status stats - do in one pass instead of multiple filters
    const stats = { not_applied: 0, applied: 0, interviewing: 0, rejected: 0, offered: 0, withdrawn: 0 };
    activeJobs.forEach(job => {
      const status = job.applicationStatus || 'not_applied';
      if (status in stats) {
        stats[status as keyof typeof stats]++;
      }
    });
    const total = activeJobs.length;

    // Advanced analytics calculations - optimize with single pass
    let jobsWithDates = [];
    const impactStats = { low: 0, medium: 0, high: 0 };
    const aiStats = { totalTokens: 0, totalCost: 0, parseCount: 0, jobsWithAI: 0 };

    // Single pass through active jobs for multiple calculations (stats use active jobs only)
    for (const job of activeJobs) {
      // Collect jobs with dates
      if (job.uploadDate || job.applicationDate) {
        jobsWithDates.push(job);
      }

      // Count impact stats - only for jobs that have been at least applied to
      if (job.impact && job.impact in impactStats) {
        const applicationStatus = job.applicationStatus || 'not_applied';
        // Only include jobs that have been applied to (not just created)
        if (applicationStatus !== 'not_applied') {
          impactStats[job.impact as keyof typeof impactStats]++;
        }
      }

      // AI stats
      if (job.aiUsage) {
        aiStats.totalTokens += job.aiUsage.totalTokens;
        aiStats.totalCost += job.aiUsage.estimatedCost;
        aiStats.parseCount += job.aiUsage.parseCount;
        aiStats.jobsWithAI += 1;
      }
    }

    // Only sort the jobs with dates
    jobsWithDates.sort((a, b) => {
      const dateA = new Date(a.applicationDate || a.uploadDate);
      const dateB = new Date(b.applicationDate || b.uploadDate);
      return dateA.getTime() - dateB.getTime();
    });

    const firstJobDate = jobsWithDates.length > 0 ? new Date(jobsWithDates[0].applicationDate || jobsWithDates[0].uploadDate) : new Date();
    const daysSinceFirst = Math.floor((new Date().getTime() - firstJobDate.getTime()) / (1000 * 60 * 60 * 24));
    const avgPerDay = daysSinceFirst > 0 ? (total / daysSinceFirst).toFixed(2) : '0';

    // Calculate total applications (all statuses except not_applied)
    const totalApplications = stats.applied + stats.interviewing + stats.rejected + stats.offered + stats.withdrawn;

    const totalWithImpact = impactStats.low + impactStats.medium + impactStats.high;
    const impactRatio = totalWithImpact > 0 ? ((impactStats.high / totalWithImpact) * 100).toFixed(0) : '0';

    // Daily velocity data for chart (last 14 days) - tracking resume applications
    const dailyData = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      // Count job applications that have linked resumes, were applied on this date, and have any status except 'not_applied' (active jobs only)
      const count = activeJobs.filter(job => {
        const applicationDate = job.applicationDate?.split('T')[0];
        const status = job.applicationStatus || 'not_applied';
        return applicationDate === dateStr &&
          job.linkedResumeIds &&
          job.linkedResumeIds.length > 0 &&
          status !== 'not_applied';
      }).length;
      dailyData.push({ date: dateStr, count, displayDate: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) });
    }

    // Weekly velocity data for chart (last 8 weeks) - tracking resume applications
    const weeklyData = [];
    for (let i = 7; i >= 0; i--) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - (i * 7));
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);

      // Count job applications that have linked resumes, were applied in this week, and have any status except 'not_applied' (active jobs only)
      const count = activeJobs.filter(job => {
        if (!job.applicationDate || !job.linkedResumeIds || job.linkedResumeIds.length === 0) {
          return false;
        }
        const status = job.applicationStatus || 'not_applied';
        if (status === 'not_applied') {
          return false;
        }
        const applicationDate = new Date(job.applicationDate);
        return applicationDate >= startDate && applicationDate <= endDate;
      }).length;

      const weekNum = Math.floor(endDate.getTime() / (1000 * 60 * 60 * 24 * 7));
      weeklyData.push({
        week: `W${weekNum % 52}`,
        count,
        startDate: startDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        endDate: endDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        displayWeek: startDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
      });
    }

    return {
      stats,
      total,
      totalApplications,
      daysSinceFirst,
      avgPerDay,
      impactStats,
      impactRatio,
      aiStats,
      dailyData,
      weeklyData
    };
  }, [state.jobDescriptions]);

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




  // CSV import modal state
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);



  // Linked documents search state
  const [linkedDocumentsSearch, setLinkedDocumentsSearch] = useState('');
  const [showDocumentLinkingModal, setShowDocumentLinkingModal] = useState(false);
  const [documentLinkingSearch, setDocumentLinkingSearch] = useState('');

  // Get next sequential job ID
  const getNextSequentialId = (): number => {
    if (state.jobDescriptions.length === 0) return 1;
    const maxId = Math.max(...state.jobDescriptions.map(jd => jd.sequentialId || 0));
    return maxId + 1;
  };

  // Handle URL fetch
  const handleFetchURL = async () => {
    if (!formData.url.trim()) {
      setFetchError('Please enter a URL first');
      return;
    }

    setIsFetchingURL(true);
    setFetchError(null);

    try {
      const result = await fetchJobDescriptionFromURL(formData.url.trim());

      if (result.success) {
        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          company: result.company || prev.company,
          rawText: result.text || prev.rawText
        }));
        setFetchError(null);
      } else {
        setFetchError(result.error || 'Failed to fetch job description from URL');

        // If CORS blocked, provide additional context
        if (result.corsBlocked) {
          // Auto-focus on the job description textarea to guide user
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
  };

  // Auto-parse job description text to extract title, company, etc.

  // Re-parse existing job description with AI
  const handleReparse = async () => {
    if (!formData.rawText.trim()) {
      showToast('Please add job description text first', 'warning');
      return;
    }

    setIsReparsing(true);

    try {
      const existingJob = editingJobId ? state.jobDescriptions.find(job => job.id === editingJobId) || null : null;
      const result = await smartParseJobDescription(
        formData.rawText,
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

        // Store usage data and update job if not from cache
        if (result.usage && !result.fromCache) {
          setLastParseUsage(result.usage);

          // If we're editing an existing job, update its AI usage tracking
          if (editingJobId && existingJob) {
            const textHash = createTextHash(formData.rawText.trim());
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

            // Update the job in state with new AI usage
            setState(prev => ({
              ...prev,
              jobDescriptions: prev.jobDescriptions.map(job =>
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

            // Also save to storage
            const updatedJob: JobDescription = {
              ...existingJob,
              extractedInfo: info,
              keywords: result.keywords || [],
              aiUsage: updatedUsage
            };
            saveJobDescription(updatedJob);
          }
        } else if (result.fromCache) {
          // Show different message for cached results
          console.log('Used cached result - no additional AI cost incurred');
        }

        // Update form data with extracted info, but don't overwrite user-entered data
        setFormData(prev => ({
          ...prev,
          title: info.role || prev.title,
          company: info.company || prev.company,
          // Update new fields if they're empty or if extracted data is available
          role: info.role || prev.role,
          location: info.location || prev.location,
          workArrangement: (info.workArrangement || prev.workArrangement) as 'hybrid' | 'remote' | 'office' | '',
          salaryMin: info.salaryRange ? extractSalaryMin(info.salaryRange) : prev.salaryMin,
          salaryMax: info.salaryRange ? extractSalaryMax(info.salaryRange) : prev.salaryMax,
          // Update URL and Source 1 if URL is extracted (clean LinkedIn URLs)
          url: info.jobUrl ? cleanLinkedInUrl(info.jobUrl) : prev.url,
          source1Type: info.jobUrl ? 'url' : prev.source1Type,
          source1Content: info.jobUrl ? cleanLinkedInUrl(info.jobUrl) : prev.source1Content,
          // Use applicationId if available and sequential ID is not set
          sequentialId: prev.sequentialId || (info.applicationId ? info.applicationId : prev.sequentialId)
        }));

        if (result.fromCache) {
          showToast('Job description processed successfully using cached data (no additional AI cost)!', 'success');
        } else {
          showToast('Job description re-parsed successfully! Check the extracted details.', 'success');
        }
      } else {
        showToast('Failed to parse job description. Please check the text and try again.', 'error');
      }
    } catch (error) {
      showToast('Error parsing job description: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    } finally {
      setIsReparsing(false);
    }
  };

  // Handler for processing unparsed jobs with AI
  const handleProcessJob = async (jobId: string) => {
    const job = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!job) return;

    setIsProcessing(true);
    try {
      const result = await smartParseJobDescription(
        job.rawText,
        job,
        aiParseCache,
        setAiParseCache,
        job.additionalContext
      );

      if (result.success && result.extractedInfo && result.keywords) {
        const updatedJob: JobDescription = {
          ...job,
          extractedInfo: result.extractedInfo,
          keywords: result.keywords,
          sequentialId: job.sequentialId || getNextSequentialId(),
          aiUsage: {
            totalTokens: result.usage?.total_tokens || 0,
            promptTokens: result.usage?.prompt_tokens || 0,
            completionTokens: result.usage?.completion_tokens || 0,
            estimatedCost: result.usage ? calculateAICost(result.usage) : 0,
            parseCount: (job.aiUsage?.parseCount || 0) + 1,
            lastParseDate: new Date().toISOString(),
            rawTextHash: createTextHash(job.rawText.trim())
          }
        };

        setState(prev => ({
          ...prev,
          jobDescriptions: prev.jobDescriptions.map(jd =>
            jd.id === jobId ? updatedJob : jd
          )
        }));

        await saveJobDescription(updatedJob);

        showToast(`Successfully processed job: ${job.title}`, 'success');
      } else {
        showToast(`Failed to process job: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      showToast(`Error processing job: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditJobDescription = (jobId: string) => {
    const job = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!job) return;

    setFormData({
      title: job.title,
      company: job.company,
      url: job.url || '',
      rawText: job.rawText,
      additionalContext: job.additionalContext || '',
      notes: job.notes || '',
      sequentialId: job.sequentialId?.toString() || '',
      role: job.role || '',
      location: job.location || '',
      workArrangement: job.workArrangement || '',
      source1Type: 'url',
      source1Content: job.url || job.source1?.content || '',
      source2Type: job.source2?.type || 'url',
      source2Content: job.source2?.content || '',
      salaryMin: job.salaryMin?.toString() || '',
      salaryMax: job.salaryMax?.toString() || '',
      contactName: job.contact?.name || '',
      contactEmail: job.contact?.email || '',
      contactPhone: job.contact?.phone || '',
      impact: job.impact || '',
      applicationDate: job.applicationDate?.split('T')[0] || '',
      applicationStatus: job.applicationStatus || ''
    });
    setEditingJobId(jobId);
    setShowAddForm(true);
    setLastParseUsage(null); // Clear usage when starting to edit
  };

  const handleCancelEdit = () => {
    setEditingJobId(null);
    setFormData({
      title: '',
      company: '',
      url: '',
      rawText: '',
      additionalContext: '',
      notes: '',
      sequentialId: '',
      role: '',
      location: '',
      workArrangement: '',
      source1Type: 'url',
      source1Content: '',
      source2Type: 'url',
      source2Content: '',
      salaryMin: '',
      salaryMax: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      impact: '',
      applicationDate: '',
      applicationStatus: ''
    });
    setShowAddForm(false);
    setFetchError(null);
    setIsFetchingURL(false);
    setLastParseUsage(null); // Clear usage when canceling
  }; const handleSaveJobDescription = async () => {
    if (!formData.title.trim() || !formData.company.trim() || !formData.rawText.trim()) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      const isEditing = editingJobId !== null;
      const existingJob = isEditing ? state.jobDescriptions.find(jd => jd.id === editingJobId) : null;

      const finalTitle = formData.title.trim();
      const finalCompany = formData.company.trim();



      if (isEditing && existingJob) {
        // Update existing job description
        const updatedSequentialId = formData.sequentialId.trim() ?
          parseInt(formData.sequentialId.trim()) :
          existingJob.sequentialId;

        const updatedJobDescription: JobDescription = {
          ...existingJob,
          title: finalTitle,
          company: finalCompany,
          sequentialId: isNaN(updatedSequentialId || 0) ? (existingJob.sequentialId || 0) : updatedSequentialId,
          url: formData.url.trim() ? cleanLinkedInUrl(formData.url.trim()) : undefined,
          rawText: formData.rawText.trim(),
          additionalContext: formData.additionalContext.trim() || undefined,
          // New fields
          role: formData.role.trim() || undefined,
          location: formData.location.trim() || undefined,
          workArrangement: formData.workArrangement || undefined,
          source1: (formData.url.trim() || formData.source1Content.trim()) ? {
            type: 'url',
            content: formData.url.trim() || formData.source1Content.trim()
          } : undefined,
          source2: formData.source2Content.trim() ? {
            type: formData.source2Type,
            content: formData.source2Content.trim()
          } : undefined,
          salaryMin: formData.salaryMin ? parseFloat(formData.salaryMin) : undefined,
          salaryMax: formData.salaryMax ? parseFloat(formData.salaryMax) : undefined,
          salaryRange: (formData.salaryMin && formData.salaryMax) ? `$${formData.salaryMin} - $${formData.salaryMax}` : undefined,
          contact: (formData.contactName.trim() || formData.contactEmail.trim() || formData.contactPhone.trim()) ? {
            name: formData.contactName.trim() || undefined,
            email: formData.contactEmail.trim() || undefined,
            phone: formData.contactPhone.trim() || undefined
          } : undefined,
          impact: formData.impact || undefined,
          applicationDate: formData.applicationDate || existingJob.applicationDate,
          applicationStatus: formData.applicationStatus || existingJob.applicationStatus || 'not_applied',
          // Keep existing extractedInfo and keywords if not re-parsed
          extractedInfo: existingJob.extractedInfo || {
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            requirements: []
          },
          keywords: existingJob.keywords || []
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
        const sequentialId = formData.sequentialId.trim() ?
          parseInt(formData.sequentialId.trim()) :
          getNextSequentialId();

        const newJobDescription: JobDescription = {
          id: crypto.randomUUID(),
          sequentialId: isNaN(sequentialId) ? getNextSequentialId() : sequentialId,
          title: finalTitle,
          company: finalCompany,
          url: formData.url.trim() ? cleanLinkedInUrl(formData.url.trim()) : undefined,
          rawText: formData.rawText.trim(),
          additionalContext: formData.additionalContext.trim() || undefined,
          // New fields
          role: formData.role.trim() || undefined,
          location: formData.location.trim() || undefined,
          workArrangement: formData.workArrangement || undefined,
          source1: (formData.url.trim() || formData.source1Content.trim()) ? {
            type: 'url',
            content: formData.url.trim() || formData.source1Content.trim()
          } : undefined,
          source2: formData.source2Content.trim() ? {
            type: formData.source2Type,
            content: formData.source2Content.trim()
          } : undefined,
          salaryMin: formData.salaryMin ? parseFloat(formData.salaryMin) : undefined,
          salaryMax: formData.salaryMax ? parseFloat(formData.salaryMax) : undefined,
          salaryRange: (formData.salaryMin && formData.salaryMax) ? `$${formData.salaryMin} - $${formData.salaryMax}` : undefined,
          contact: (formData.contactName.trim() || formData.contactEmail.trim() || formData.contactPhone.trim()) ? {
            name: formData.contactName.trim() || undefined,
            email: formData.contactEmail.trim() || undefined,
            phone: formData.contactPhone.trim() || undefined
          } : undefined,
          impact: formData.impact || undefined,
          extractedInfo: {
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            requirements: []
          },
          keywords: [],
          uploadDate: new Date().toISOString(),
          linkedResumeIds: [],
          linkedCoverLetterIds: [],
          applicationStatus: formData.applicationStatus || 'not_applied',
          applicationDate: formData.applicationDate || undefined
        };

        // Parse job description with AI if configured and text is available
        if (formData.rawText.trim() && isAIConfigured()) {
          try {
            const parseResult = await smartParseJobDescription(
              formData.rawText,
              null, // New job, no existing data
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
              // Update extracted info
              newJobDescription.extractedInfo = parseResult.extractedInfo;
              newJobDescription.keywords = parseResult.keywords || [];

              // Track AI usage (only if not from cache)
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
                // If from cache, set a minimal usage record to track that it was processed
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
            // Continue with saving even if AI parsing fails
          }
        }

        await saveJobDescription(newJobDescription);

        setState(prev => ({
          ...prev,
          jobDescriptions: [...prev.jobDescriptions, newJobDescription]
        }));
      }

      // Reset form
      setFormData({
        title: '',
        company: '',
        url: '',
        rawText: '',
        additionalContext: '',
        notes: '',
        sequentialId: '',
        role: '',
        location: '',
        workArrangement: '',
        source1Type: 'url',
        source1Content: '',
        source2Type: 'url',
        source2Content: '',
        salaryMin: '',
        salaryMax: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        impact: '',
        applicationDate: '',
        applicationStatus: ''
      });
      setShowAddForm(false);

      showToast('Job description saved successfully!', 'success');

    } catch (error) {
      console.error('Error saving job description:', error);
      showToast('Failed to save job description. Please try again.', 'error');
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
      showToast('Failed to delete job description. Please try again.', 'error');
    }
  };

  const handleArchiveJob = async (id: string) => {
    try {
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(job =>
          job.id === id
            ? {
              ...logActivity(job, 'status_change', {
                fromValue: job.applicationStatus || 'not_applied',
                toValue: 'archived',
                field: 'applicationStatus'
              }),
              isArchived: true,
              applicationStatus: 'archived' as JobDescription['applicationStatus']
            }
            : job
        )
      }));
      showToast('Job archived successfully', 'success');
    } catch (error) {
      console.error('Error archiving job:', error);
      showToast('Failed to archive job. Please try again.', 'error');
    }
  };

  const handleUnarchiveJob = async (id: string) => {
    try {
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(job =>
          job.id === id
            ? {
              ...logActivity(job, 'status_change', {
                fromValue: 'archived',
                toValue: 'not_applied',
                field: 'applicationStatus'
              }),
              isArchived: false,
              applicationStatus: 'not_applied' as JobDescription['applicationStatus']
            }
            : job
        )
      }));
      showToast('Job unarchived successfully', 'success');
    } catch (error) {
      console.error('Error unarchiving job:', error);
      showToast('Failed to unarchive job. Please try again.', 'error');
    }
  };

  const handleToggleWaitingForResponse = async (id: string) => {
    try {
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(job => {
          if (job.id === id) {
            const newWaitingStatus = !job.waitingForResponse;
            return {
              ...logActivity(job, 'field_updated', {
                field: 'waitingForResponse',
                fromValue: job.waitingForResponse || false,
                toValue: newWaitingStatus,
                details: `Waiting for response ${newWaitingStatus ? 'enabled' : 'disabled'}`
              }),
              waitingForResponse: newWaitingStatus
            };
          }
          return job;
        })
      }));

      const job = state.jobDescriptions.find(j => j.id === id);
      const newStatus = !job?.waitingForResponse;
      showToast(
        `Job marked as ${newStatus ? 'waiting for response' : 'not waiting for response'}`,
        'success'
      );
    } catch (error) {
      console.error('Error toggling waiting status:', error);
      showToast('Failed to update waiting status. Please try again.', 'error');
    }
  };

  const handleMarkDuplicate = async (jobId: string) => {
    setDuplicateJobId(jobId);
    setDuplicateSearchQuery('');
    setShowDuplicateModal(true);
  };

  const handleConfirmDuplicate = async (originalJobId: string) => {
    if (!duplicateJobId) return;

    try {
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(job => {
          if (job.id === duplicateJobId) {
            // Mark as duplicate and archive
            return {
              ...logActivity(job, 'status_change', {
                fromValue: job.applicationStatus || 'not_applied',
                toValue: 'duplicate',
                field: 'applicationStatus',
                details: `Marked as duplicate of job ${originalJobId}`
              }),
              applicationStatus: 'duplicate' as JobDescription['applicationStatus'],
              duplicateOfId: originalJobId,
              isArchived: true
            };
          } else if (job.id === originalJobId) {
            // Add to linked duplicates
            return {
              ...job,
              linkedDuplicateIds: [...(job.linkedDuplicateIds || []), duplicateJobId]
            };
          }
          return job;
        })
      }));

      setShowDuplicateModal(false);
      setDuplicateJobId(null);
      showToast('Job marked as duplicate and archived', 'success');
    } catch (error) {
      console.error('Error marking job as duplicate:', error);
      showToast('Failed to mark job as duplicate. Please try again.', 'error');
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
      showToast('Failed to link resume. Please try again.', 'error');
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
      showToast('Failed to link cover letter. Please try again.', 'error');
    }
  };

  const handleStatusChange = async (
    jobId: string,
    status: JobDescription['applicationStatus'],
    interviewStage?: JobDescription['interviewStage'],
    offerStage?: JobDescription['offerStage']
  ) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    // Use the activity logger to create an updated job with proper logging
    const updatedJobDescription = logStatusChange(jobDescription, status, interviewStage, offerStage);

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
      showToast('Failed to update status. Please try again.', 'error');
    }
  };

  // Notes management handlers
  const handleQuickNote = async (jobId: string, noteText: string) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    const now = new Date().toLocaleString();
    const newNote = `[${now}] ${noteText}`;
    const updatedNotes = jobDescription.notes
      ? `${jobDescription.notes}\n${newNote}`
      : newNote;

    // Use activity logging to track note addition
    const jobWithNotes = {
      ...jobDescription,
      notes: updatedNotes
    };

    const updatedJobDescription = logActivity(jobWithNotes, 'note_added', {
      details: `Added note: ${noteText}`,
      toValue: noteText
    });

    try {
      await saveJobDescription(updatedJobDescription);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(jd =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
    } catch (error) {
      console.error('Error adding quick note:', error);
      alert('Failed to add note. Please try again.');
    }
  };

  const handleEditNotes = (jobId: string) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    setEditingNotesId(jobId);
    setTempNotes(jobDescription.notes || '');
  };

  const handleSaveNotes = async (jobId: string) => {
    const jobDescription = state.jobDescriptions.find(jd => jd.id === jobId);
    if (!jobDescription) return;

    const updatedJobDescription: JobDescription = {
      ...jobDescription,
      notes: tempNotes.trim() || undefined,
      lastActivityDate: new Date().toISOString()
    };

    try {
      await saveJobDescription(updatedJobDescription);
      setState(prev => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map(jd =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
      setEditingNotesId(null);
      setTempNotes('');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes. Please try again.');
    }
  };

  const handleCancelNotesEdit = () => {
    setEditingNotesId(null);
    setTempNotes('');
  };

  // Calculate potential document matches using sophisticated matching
  const getDocumentMatches = (jobDescription: JobDescription): DocumentMatch[] => {
    return calculateDocumentMatches(jobDescription, state.resumes, state.coverLetters);
  };

  // Generate tailored resume
  const handleGenerateResume = async (jobDescription: JobDescription) => {
    if (!isAIConfigured()) {
      showToast('AI service is not configured. Please set up your OpenAI API key in the .env file.', 'warning');
      return;
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

      // Generate from full resume text
      console.log('🤖 Generating resume from full text...');
      const fullResumeText = await getCombinedResumeText();
      result = await generateTailoredResumeFromFullText(
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
  };

  // Generate tailored cover letter
  const handleGenerateCoverLetter = async (jobDescription: JobDescription) => {
    if (!isAIConfigured()) {
      showToast('AI service is not configured. Please set up your OpenAI API key in the .env file.', 'warning');
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

      // Generate from full resume text
      console.log('🤖 Generating cover letter from full text...');
      const fullResumeText = await getCombinedResumeText();
      result = await generateTailoredCoverLetterFromFullText(
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

      showToast(`${generationType === 'resume' ? 'Resume' : 'Cover letter'} saved successfully! Check your ${generationType === 'resume' ? 'Resume' : 'Cover Letter'} library.`, 'success');
      console.log('Save process completed successfully');
    } catch (error) {
      console.error('Error saving generated content:', error);
      showToast(`Failed to save ${generationType === 'resume' ? 'resume' : 'cover letter'}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      throw error;
    }
  };

  // CSV import handler
  const handleCSVImport = async (jobDescriptions: JobDescription[]) => {
    try {
      // Save all job descriptions to storage
      for (const jobDesc of jobDescriptions) {
        await saveJobDescription(jobDesc);
      }

      // Update state with new job descriptions
      setState(prev => ({
        ...prev,
        jobDescriptions: [...prev.jobDescriptions, ...jobDescriptions]
      }));

      showToast(`Successfully imported ${jobDescriptions.length} job description${jobDescriptions.length === 1 ? '' : 's'}!`, 'success');
    } catch (error) {
      console.error('Error importing CSV:', error);
      showToast(`Failed to import job descriptions: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  // Simple preview function that opens content in new tab
  const handlePreviewDocument = (document: Resume | CoverLetter) => {
    const content = document.textContent || 'No content available';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up the URL object after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
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
            className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <FontAwesomeIcon icon={faChartBar} /> Analytics
          </button>
        </div>
        {activeTab === 'job-descriptions' && (
          <div className="job-actions">
            <button
              className="add-job-button"
              onClick={() => setShowAddForm(true)}
              disabled={showAddForm}
            >
              + Add Job Description
            </button>
            <button
              className="import-csv-button"
              onClick={() => setShowCSVImportModal(true)}
              disabled={showAddForm}
              title="Import job applications from CSV file"
            >
              <FontAwesomeIcon icon={faFileImport} /> Import CSV
            </button>
            <button
              className="export-button"
              onClick={handleExportData}
              disabled={isExporting || showAddForm}
              title="Export all data as backup file"
              style={{
                padding: '8px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FontAwesomeIcon icon={faDownload} /> {isExporting ? 'Exporting...' : 'Export Data'}
            </button>
            <button
              className="import-button"
              onClick={handleImportData}
              disabled={isImporting || showAddForm}
              title="Import data from backup file"
              style={{
                padding: '8px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FontAwesomeIcon icon={faUpload} /> {isImporting ? 'Importing...' : 'Import Data'}
            </button>
            <button
              className="settings-button"
              onClick={() => setShowReminderSettings(!showReminderSettings)}
              title="Action Reminder Settings"
              style={{
                padding: '8px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FontAwesomeIcon icon={faCog} /> Reminder Settings
            </button>
          </div>
        )}
      </div>

      {showAddForm && (
        <div
          className="add-job-form"
          ref={(el) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <div className="form-header">
            <h2>{editingJobId ? 'Edit Job Description' : 'Add New Job Description'}</h2>
            <div className="form-header-actions">
              <button
                onClick={handleSaveJobDescription}
                disabled={isProcessing}
                className="save-button-top"
              >
                {isProcessing ? 'Saving...' : editingJobId ? 'Update Job' : 'Save Job'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isProcessing}
                className="cancel-button-top"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
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
            <div className="form-group" style={{ width: '120px' }}>
              <label htmlFor="sequential-id">Job # (Optional)</label>
              <input
                id="sequential-id"
                type="number"
                min="1"
                value={formData.sequentialId}
                onChange={(e) => setFormData(prev => ({ ...prev, sequentialId: e.target.value }))}
                placeholder={editingJobId ? "Current" : getNextSequentialId().toString()}
                disabled={isProcessing}
                title="Sequential job tracking number (e.g., Job #1, Job #2)"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="job-url">Job Listing URL (Optional)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="job-url"
                type="url"
                value={formData.url}
                onChange={(e) => {
                  const newUrl = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    url: newUrl,
                    // Auto-populate Source 1 with the job listing URL
                    source1Type: 'url',
                    source1Content: newUrl
                  }));
                  setFetchError(null);
                }}
                placeholder="https://company.com/careers/job-id"
                disabled={isProcessing || isFetchingURL}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleFetchURL}
                disabled={isProcessing || isFetchingURL || !formData.url.trim()}
                className="fetch-url-button"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007acc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}
              >
                {isFetchingURL ? 'Fetching...' : 'Fetch JD'}
              </button>
            </div>
            {fetchError && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px', padding: '8px', backgroundColor: '#fdf2f2', border: '1px solid #fecaca', borderRadius: '4px' }}>
                <strong>URL Fetch Failed:</strong> {fetchError}
                {fetchError.includes('CORS') && (
                  <div style={{ marginTop: '4px', fontSize: '11px' }}>
                    <strong>Workaround:</strong> Open the job posting in a new tab, select all text (Ctrl/Cmd+A), copy it, and paste it in the "Job Description Text" field below.
                  </div>
                )}
              </div>
            )}
            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
              Click "Fetch JD" to automatically extract job details from the URL. Note: LinkedIn, Indeed, and similar sites block direct access - you'll need to copy/paste manually for those.
            </small>
          </div>
          <div className="form-group">
            <label htmlFor="job-description">
              Job Description Text *
            </label>
            <textarea
              id="job-description"
              value={formData.rawText}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, rawText: e.target.value }));
              }}
              placeholder="Paste the full job description here and AI will auto-extract company name, job title, and other details...

For LinkedIn/Indeed jobs:
1. Open the job posting in a new tab
2. Select all text (Ctrl/Cmd + A) 
3. Copy (Ctrl/Cmd + C)
4. Paste here (Ctrl/Cmd + V)

AI will automatically fill in the job title and company name fields above!"
              rows={12}
              disabled={isProcessing}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <small style={{ color: '#666', fontSize: '12px' }}>
                Include the full job posting text for best AI extraction results.
              </small>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {lastParseUsage && (
                  <small style={{
                    color: '#888',
                    fontSize: '11px',
                    background: '#f8f9fa',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: '1px solid #e9ecef'
                  }}
                    title={`Input: ${lastParseUsage.promptTokens} tokens, Output: ${lastParseUsage.completionTokens} tokens, Total: ${lastParseUsage.totalTokens} tokens`}
                  >
                    <FontAwesomeIcon icon={faChartBar} /> {lastParseUsage.promptTokens}<FontAwesomeIcon icon={faArrowUp} /> {lastParseUsage.completionTokens}<FontAwesomeIcon icon={faArrowDown} /> • <FontAwesomeIcon icon={faDollarSign} /> {estimateCost(lastParseUsage)}
                  </small>
                )}

                <button
                  type="button"
                  onClick={handleReparse}
                  disabled={isProcessing || isReparsing || !formData.rawText.trim()}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    whiteSpace: 'nowrap'
                  }}
                  title="Re-analyze the job description text with AI to extract missing company/title info"
                >
                  {isReparsing ? 'Re-parsing...' : <><FontAwesomeIcon icon={faSync} /> Re-parse with AI</>}
                </button>
              </div>
            </div>
          </div>

          {/* New edit fields */}
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="job-role">Role/Position</label>
              <input
                id="job-role"
                type="text"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                placeholder="e.g., Senior Software Engineer, Product Manager"
                disabled={isProcessing}
              />
            </div>
            <div className="form-group">
              <label htmlFor="job-location">Location</label>
              <input
                id="job-location"
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., San Francisco, CA"
                disabled={isProcessing}
              />
            </div>
            <div className="form-group" style={{ width: '200px' }}>
              <label htmlFor="work-arrangement">Work Arrangement</label>
              <select
                id="work-arrangement"
                value={formData.workArrangement}
                onChange={(e) => setFormData(prev => ({ ...prev, workArrangement: e.target.value as 'hybrid' | 'remote' | 'office' | '' }))}
                disabled={isProcessing}
              >
                <option value="">Select...</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
                <option value="office">Office</option>
              </select>
            </div>
            <div className="form-group" style={{ width: '200px' }}>
              <label htmlFor="impact-level">
                <FontAwesomeIcon icon={getImpactIcon(formData.impact) || faMinus} style={{ color: getImpactColor(formData.impact), marginRight: '6px' }} />
                Impact Level
              </label>
              <select
                id="impact-level"
                value={formData.impact}
                onChange={(e) => setFormData(prev => ({ ...prev, impact: e.target.value as 'low' | 'medium' | 'high' | '' }))}
                disabled={isProcessing}
              >
                <option value="">Select...</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="salary-min">Salary Min</label>
              <input
                id="salary-min"
                type="number"
                value={formData.salaryMin}
                onChange={(e) => setFormData(prev => ({ ...prev, salaryMin: e.target.value }))}
                placeholder="120000"
                disabled={isProcessing}
              />
              {formData.salaryMin && (
                <small style={{ color: '#666', fontSize: '11px' }}>
                  {formatCurrency(formData.salaryMin)}
                </small>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="salary-max">Salary Max</label>
              <input
                id="salary-max"
                type="number"
                value={formData.salaryMax}
                onChange={(e) => setFormData(prev => ({ ...prev, salaryMax: e.target.value }))}
                placeholder="180000"
                disabled={isProcessing}
              />
              {formData.salaryMax && (
                <small style={{ color: '#666', fontSize: '11px' }}>
                  {formatCurrency(formData.salaryMax)}
                </small>
              )}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="source1-content">Source 1</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={formData.source1Type}
                  onChange={(e) => setFormData(prev => ({ ...prev, source1Type: e.target.value as 'url' | 'text' }))}
                  disabled={isProcessing}
                  style={{ width: '80px' }}
                >
                  <option value="url">URL</option>
                  <option value="text">Text</option>
                </select>
                <input
                  id="source1-content"
                  type={formData.source1Type === 'url' ? 'url' : 'text'}
                  value={formData.source1Content}
                  onChange={(e) => setFormData(prev => ({ ...prev, source1Content: e.target.value }))}
                  placeholder={formData.source1Type === 'url' ? 'https://example.com' : 'Source description'}
                  disabled={isProcessing}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="source2-content">Source 2</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={formData.source2Type}
                  onChange={(e) => setFormData(prev => ({ ...prev, source2Type: e.target.value as 'url' | 'text' }))}
                  disabled={isProcessing}
                  style={{ width: '80px' }}
                >
                  <option value="url">URL</option>
                  <option value="text">Text</option>
                </select>
                <input
                  id="source2-content"
                  type={formData.source2Type === 'url' ? 'url' : 'text'}
                  value={formData.source2Content}
                  onChange={(e) => setFormData(prev => ({ ...prev, source2Content: e.target.value }))}
                  placeholder={formData.source2Type === 'url' ? 'https://example.com' : 'Source description'}
                  disabled={isProcessing}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group">
              <label htmlFor="contact-name">Contact Name (Recruiter/Hiring Manager)</label>
              <input
                id="contact-name"
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                placeholder="e.g., Jane Smith (for LinkedIn messaging)"
                disabled={isProcessing}
              />
            </div>
            <div className="form-group">
              <label htmlFor="contact-email">Contact Email</label>
              <input
                id="contact-email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="e.g., recruiter@company.com"
                disabled={isProcessing}
              />
            </div>
            <div className="form-group">
              <label htmlFor="contact-phone">Contact Phone</label>
              <input
                id="contact-phone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="e.g., (555) 123-4567"
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="application-date">Application Date</label>
              <input
                id="application-date"
                type="date"
                value={formData.applicationDate}
                onChange={(e) => setFormData(prev => ({ ...prev, applicationDate: e.target.value }))}
                disabled={isProcessing}
              />
            </div>
            <div className="form-group">
              <label htmlFor="application-status">Application Status</label>
              <select
                id="application-status"
                value={formData.applicationStatus}
                onChange={(e) => setFormData(prev => ({ ...prev, applicationStatus: e.target.value as 'not_applied' | 'applied' | 'interviewing' | 'rejected' | 'offered' | 'withdrawn' | 'duplicate' | 'archived' | '' }))}
                disabled={isProcessing}
              >
                <option value="">Select...</option>
                <option value="not_applied">Not Applied</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="rejected">Rejected</option>
                <option value="offered">Offered</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="duplicate">Duplicate</option>
                <option value="archived">Archived</option>
              </select>
            </div>
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
              This context will be used when generating tailored resumes and cover letters for this position. After parsing, extracted job details will also be stored here for easy access.
            </small>
          </div>

          {/* Notes field - only show when editing existing job */}
          {editingJobId && (
            <div className="form-group">
              <label htmlFor="notes">Notes (Optional)</label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add personal notes about this job (application status, interview notes, follow-ups, etc.)"
                rows={4}
                disabled={isProcessing}
              />
              <small style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                Use this space for personal tracking notes, interview feedback, follow-up reminders, and other observations.
              </small>
            </div>
          )}

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
              {isProcessing ? 'Saving...' : editingJobId ? 'Update Job Description' : 'Save Job Description'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'job-descriptions' && state.jobDescriptions.length > 0 && (
        <div className="job-stats-section">
          <div className="stats-container">
            {(() => {
              const { stats, total, totalApplications, daysSinceFirst, avgPerDay, impactStats, impactRatio, aiStats, dailyData, weeklyData } = statsData;

              return (
                <>
                  <div className="stats-header">
                    <h3>Application Status Overview</h3>
                    <div className="stats-header-controls">
                      <span className="total-count">Total Jobs: {total}</span>
                      <span className="total-count" style={{ marginLeft: "1rem", color: "#007bff", fontWeight: "600" }}>Applied: {totalApplications}</span>
                      {statusFilter && (
                        <button
                          className="clear-filter-btn"
                          onClick={() => setStatusFilter('')}
                          title={`Clear ${statusFilter} status filter`}
                        >
                          ✕ Clear Filter ({statusFilter.replace('_', ' ')})
                        </button>
                      )}
                      <button
                        className="expand-stats-btn"
                        onClick={() => setShowExpandedStats(!showExpandedStats)}
                        title={showExpandedStats ? "Hide detailed analytics" : "Show detailed analytics"}
                      >
                        {showExpandedStats ? '▼ Less Stats' : '▲ More Stats'}
                      </button>
                    </div>
                  </div>
                  <div className="stats-grid">
                    <div
                      className={`stat-item not-applied clickable ${statusFilter === 'not_applied' ? 'active-filter' : ''}`}
                      onClick={() => setStatusFilter(statusFilter === 'not_applied' ? '' : 'not_applied')}
                      title="Click to filter by Not Applied status"
                    >
                      <span className="stat-label">Not Applied</span>
                      <span className="stat-value">{stats.not_applied}</span>
                    </div>
                    <div
                      className={`stat-item applied clickable ${statusFilter === 'applied' ? 'active-filter' : ''}`}
                      onClick={() => setStatusFilter(statusFilter === 'applied' ? '' : 'applied')}
                      title="Click to filter by Applied status"
                    >
                      <span className="stat-label">Applied</span>
                      <span className="stat-value">{stats.applied}</span>
                    </div>
                    <div
                      className={`stat-item interviewing clickable ${statusFilter === 'interviewing' ? 'active-filter' : ''}`}
                      onClick={() => setStatusFilter(statusFilter === 'interviewing' ? '' : 'interviewing')}
                      title="Click to filter by Interviewing status"
                    >
                      <span className="stat-label">Interviewing</span>
                      <span className="stat-value">{stats.interviewing}</span>
                    </div>
                    <div
                      className={`stat-item offered clickable ${statusFilter === 'offered' ? 'active-filter' : ''}`}
                      onClick={() => setStatusFilter(statusFilter === 'offered' ? '' : 'offered')}
                      title="Click to filter by Offered status"
                    >
                      <span className="stat-label">Offered</span>
                      <span className="stat-value">{stats.offered}</span>
                    </div>
                    <div
                      className={`stat-item rejected clickable ${statusFilter === 'rejected' ? 'active-filter' : ''}`}
                      onClick={() => setStatusFilter(statusFilter === 'rejected' ? '' : 'rejected')}
                      title="Click to filter by Rejected status"
                    >
                      <span className="stat-label">Rejected</span>
                      <span className="stat-value">{stats.rejected}</span>
                    </div>
                    <div
                      className={`stat-item withdrawn clickable ${statusFilter === 'withdrawn' ? 'active-filter' : ''}`}
                      onClick={() => setStatusFilter(statusFilter === 'withdrawn' ? '' : 'withdrawn')}
                      title="Click to filter by Withdrawn status"
                    >
                      <span className="stat-label">Withdrawn</span>
                      <span className="stat-value">{stats.withdrawn}</span>
                    </div>
                  </div>

                  {showExpandedStats && (
                    <div className="expanded-stats">
                      <div className="analytics-section">
                        <h4><FontAwesomeIcon icon={faChartBar} /> Advanced Analytics</h4>
                        <div className="analytics-grid">
                          <div className="analytics-item">
                            <span className="analytics-label">Days Since First</span>
                            <span className="analytics-value">{daysSinceFirst}</span>
                          </div>
                          <div className="analytics-item">
                            <span className="analytics-label">Total Applications</span>
                            <span className="analytics-value">{totalApplications}</span>
                          </div>
                          <div className="analytics-item">
                            <span className="analytics-label">Pending (Applied Status)</span>
                            <span className="analytics-value">{stats.applied}</span>
                          </div>
                          <div className="analytics-item">
                            <span className="analytics-label">High Impact Ratio</span>
                            <span className="analytics-value">{impactRatio}%</span>
                          </div>
                          <div className="analytics-item">
                            <span className="analytics-label">Success Rate</span>
                            <span className="analytics-value">{totalApplications > 0 ? ((stats.offered / totalApplications) * 100).toFixed(0) : '0'}%</span>
                          </div>
                        </div>

                        <div className="ai-cost-section">
                          <h4>🤖 AI Usage & Costs</h4>
                          <div className="analytics-grid">
                            <div className="analytics-item ai-cost">
                              <span className="analytics-label">Total Tokens</span>
                              <span className="analytics-value">{aiStats.totalTokens.toLocaleString()}</span>
                            </div>
                            <div className="analytics-item ai-cost">
                              <span className="analytics-label">Est. Cost</span>
                              <span className="analytics-value">${aiStats.totalCost.toFixed(4)}</span>
                            </div>
                            <div className="analytics-item ai-cost">
                              <span className="analytics-label">Parse Count</span>
                              <span className="analytics-value">{aiStats.parseCount}</span>
                            </div>
                            <div className="analytics-item ai-cost">
                              <span className="analytics-label">Avg Cost/Job</span>
                              <span className="analytics-value">${aiStats.jobsWithAI > 0 ? (aiStats.totalCost / aiStats.jobsWithAI).toFixed(4) : '0.0000'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="storage-monitor-section" style={{ marginBottom: '1.5rem' }}>
                        <StorageMonitor />
                      </div>

                      <div className="impact-section">
                        <h4>🎯 Impact Levels</h4>
                        <div className="impact-grid">
                          <div className="impact-item low">
                            <span className="impact-label">Low Impact</span>
                            <span className="impact-value">{impactStats.low}</span>
                          </div>
                          <div className="impact-item medium">
                            <span className="impact-label">Medium Impact</span>
                            <span className="impact-value">{impactStats.medium}</span>
                          </div>
                          <div className="impact-item high">
                            <span className="impact-label">High Impact</span>
                            <span className="impact-value">{impactStats.high}</span>
                          </div>
                        </div>
                      </div>

                      <div className="charts-section">
                        <div className="charts-header">
                          <h4>📈 Resume Application Velocity</h4>
                          <div className="chart-type-toggle">
                            <button
                              className={`chart-toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
                              onClick={() => setChartType('bar')}
                            >
                              <FontAwesomeIcon icon={faChartBar} /> Bars
                            </button>
                            <button
                              className={`chart-toggle-btn ${chartType === 'line' ? 'active' : ''}`}
                              onClick={() => setChartType('line')}
                            >
                              📈 Lines
                            </button>
                          </div>
                        </div>

                        <div className="chart-container">
                          <h4>Daily Resume Applications (Last 14 Days)</h4>
                          {chartType === 'bar' ? (
                            <div className="mini-chart daily-chart bar-chart">
                              {dailyData.map((day, idx) => (
                                <div key={idx} className="chart-bar-container">
                                  <div
                                    className="chart-bar"
                                    style={{
                                      height: `${Math.max(day.count * 20, 4)}px`,
                                      backgroundColor: day.count > 0 ? '#007bff' : '#e9ecef'
                                    }}
                                    title={`${day.displayDate}: ${day.count} resume applications`}
                                  ></div>
                                  <span className="chart-label">{day.displayDate}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="line-chart-container">
                              <svg className="line-chart daily-line-chart" viewBox="0 0 400 80" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id="dailyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#007bff" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#007bff" stopOpacity="0.1" />
                                  </linearGradient>
                                </defs>
                                {/* Grid lines */}
                                {[0, 1, 2, 3, 4].map(i => (
                                  <line
                                    key={i}
                                    x1="0"
                                    y1={i * 20}
                                    x2="400"
                                    y2={i * 20}
                                    stroke="#e9ecef"
                                    strokeWidth="0.5"
                                  />
                                ))}
                                {/* Data line */}
                                <polyline
                                  fill="none"
                                  stroke="#007bff"
                                  strokeWidth="2"
                                  points={dailyData.map((day, idx) =>
                                    `${(idx / (dailyData.length - 1)) * 400},${80 - Math.min(day.count * 20, 76)}`
                                  ).join(' ')}
                                />
                                {/* Area fill */}
                                <polygon
                                  fill="url(#dailyGradient)"
                                  points={`0,80 ${dailyData.map((day, idx) =>
                                    `${(idx / (dailyData.length - 1)) * 400},${80 - Math.min(day.count * 20, 76)}`
                                  ).join(' ')} 400,80`}
                                />
                                {/* Data points */}
                                {dailyData.map((day, idx) => (
                                  <circle
                                    key={idx}
                                    cx={(idx / (dailyData.length - 1)) * 400}
                                    cy={80 - Math.min(day.count * 20, 76)}
                                    r="3"
                                    fill="#007bff"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                  >
                                    <title>{`${day.displayDate}: ${day.count} resume applications`}</title>
                                  </circle>
                                ))}
                              </svg>
                              <div className="line-chart-labels">
                                {dailyData.filter((_, idx) => idx % 2 === 0).map((day, idx) => (
                                  <span key={idx} className="line-chart-label">{day.displayDate}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="chart-container">
                          <h4>Weekly Resume Applications (Last 8 Weeks)</h4>
                          {chartType === 'bar' ? (
                            <div className="mini-chart weekly-chart bar-chart">
                              {weeklyData.map((week, idx) => (
                                <div key={idx} className="chart-bar-container">
                                  <div
                                    className="chart-bar"
                                    style={{
                                      height: `${Math.max(week.count * 8, 4)}px`,
                                      backgroundColor: week.count > 0 ? '#28a745' : '#e9ecef'
                                    }}
                                    title={`Week ${week.week} (${week.startDate}-${week.endDate}): ${week.count} resume applications`}
                                  ></div>
                                  <span className="chart-label">{week.week}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="line-chart-container">
                              <svg className="line-chart weekly-line-chart" viewBox="0 0 400 80" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id="weeklyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#28a745" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#28a745" stopOpacity="0.1" />
                                  </linearGradient>
                                </defs>
                                {/* Grid lines */}
                                {[0, 1, 2, 3, 4].map(i => (
                                  <line
                                    key={i}
                                    x1="0"
                                    y1={i * 20}
                                    x2="400"
                                    y2={i * 20}
                                    stroke="#e9ecef"
                                    strokeWidth="0.5"
                                  />
                                ))}
                                {/* Data line */}
                                <polyline
                                  fill="none"
                                  stroke="#28a745"
                                  strokeWidth="2"
                                  points={weeklyData.map((week, idx) =>
                                    `${(idx / (weeklyData.length - 1)) * 400},${80 - Math.min(week.count * 10, 76)}`
                                  ).join(' ')}
                                />
                                {/* Area fill */}
                                <polygon
                                  fill="url(#weeklyGradient)"
                                  points={`0,80 ${weeklyData.map((week, idx) =>
                                    `${(idx / (weeklyData.length - 1)) * 400},${80 - Math.min(week.count * 10, 76)}`
                                  ).join(' ')} 400,80`}
                                />
                                {/* Data points */}
                                {weeklyData.map((week, idx) => (
                                  <circle
                                    key={idx}
                                    cx={(idx / (weeklyData.length - 1)) * 400}
                                    cy={80 - Math.min(week.count * 10, 76)}
                                    r="3"
                                    fill="#28a745"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                  >
                                    <title>{`Week ${week.week} (${week.startDate}-${week.endDate}): ${week.count} resume applications`}</title>
                                  </circle>
                                ))}
                              </svg>
                              <div className="line-chart-labels">
                                {weeklyData.map((week, idx) => (
                                  <span key={idx} className="line-chart-label">{week.week}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
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
              <>
                <div className="job-filters">
                  <div className="search-container">
                    <input
                      type="text"
                      placeholder="Search jobs (company, title, role...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={showArchivedJobs}
                      onChange={(e) => setShowArchivedJobs(e.target.checked)}
                    />
                    Show archived jobs
                  </label>
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={hideRejectedJobs}
                      onChange={(e) => setHideRejectedJobs(e.target.checked)}
                    />
                    Hide rejected applications
                  </label>
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={showOnlyWaitingJobs}
                      onChange={(e) => setShowOnlyWaitingJobs(e.target.checked)}
                    />
                    Show only waiting for response
                  </label>
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={showUnparsedFirst}
                      onChange={(e) => setShowUnparsedFirst(e.target.checked)}
                    />
                    Show unparsed jobs first
                  </label>
                </div>



                <div className={`jobs-layout ${selectedJob ? 'split-view' : 'full-width'}`}>
                  <JobManagementTable
                    jobs={(() => {
                      let filteredJobs = state.jobDescriptions;

                      // Filter out archived/duplicates if not showing archived
                      if (!showArchivedJobs) {
                        filteredJobs = filteredJobs.filter(job =>
                          !job.isArchived &&
                          job.applicationStatus !== 'archived' &&
                          job.applicationStatus !== 'duplicate'
                        );
                      }

                      // Filter out rejected if hiding rejected
                      if (hideRejectedJobs) {
                        filteredJobs = filteredJobs.filter(job =>
                          job.applicationStatus !== 'rejected'
                        );
                      }

                      // Show only waiting jobs if filter is enabled
                      if (showOnlyWaitingJobs) {
                        filteredJobs = filteredJobs.filter(job =>
                          job.waitingForResponse === true
                        );
                      }

                      // Apply status filter
                      if (statusFilter) {
                        filteredJobs = filteredJobs.filter(job => {
                          const jobStatus = job.applicationStatus || 'not_applied';
                          return jobStatus === statusFilter;
                        });
                      }

                      // Apply search filter
                      if (searchQuery.trim()) {
                        const query = searchQuery.toLowerCase().trim();
                        filteredJobs = filteredJobs.filter(job =>
                          job.company.toLowerCase().includes(query) ||
                          job.title.toLowerCase().includes(query) ||
                          (job.role && job.role.toLowerCase().includes(query)) ||
                          (job.extractedInfo.role && job.extractedInfo.role.toLowerCase().includes(query)) ||
                          (job.location && job.location.toLowerCase().includes(query)) ||
                          (job.extractedInfo.location && job.extractedInfo.location.toLowerCase().includes(query)) ||
                          (job.source && job.source.toLowerCase().includes(query))
                        );
                      }

                      // Sort to prioritize unparsed jobs if enabled
                      if (showUnparsedFirst) {
                        filteredJobs = filteredJobs.sort((a, b) => {
                          const aUnparsed = isJobUnparsed(a);
                          const bUnparsed = isJobUnparsed(b);

                          // Unparsed jobs first
                          if (aUnparsed && !bUnparsed) return -1;
                          if (!aUnparsed && bUnparsed) return 1;

                          // Within same category (both parsed or both unparsed), sort by upload date (newest first)
                          const aDate = new Date(a.uploadDate).getTime();
                          const bDate = new Date(b.uploadDate).getTime();
                          return bDate - aDate;
                        });
                      }

                      return filteredJobs;
                    })()}
                    onEdit={handleEditJobDescription}
                    onDelete={handleDeleteJobDescription}
                    onArchive={handleArchiveJob}
                    onUnarchive={handleUnarchiveJob}
                    onMarkDuplicate={handleMarkDuplicate}
                    onStatusChange={handleStatusChange}
                    onToggleWaitingForResponse={handleToggleWaitingForResponse}
                    onProcessJob={handleProcessJob}
                    onSelect={setSelectedJobId}
                    selectedJobId={selectedJobId}
                    preserveOrder={showUnparsedFirst}
                  />

                  {selectedJob && (
                    <div className="job-details">
                      <div className="job-details-header">
                        <div className="job-title-section">
                          <h2>{selectedJob.title}</h2>
                          <div className="document-link-indicator">
                            <button
                              className={`paperclip-button ${selectedJob.linkedResumeIds.length === 0 && selectedJob.linkedCoverLetterIds.length === 0
                                ? 'no-documents'
                                : 'has-documents'
                                }`}
                              onClick={() => setShowDocumentLinkingModal(true)}
                              title={
                                selectedJob.linkedResumeIds.length === 0 && selectedJob.linkedCoverLetterIds.length === 0
                                  ? 'No documents linked. Click to search and link documents.'
                                  : `${selectedJob.linkedResumeIds.length + selectedJob.linkedCoverLetterIds.length} document(s) linked: ${[
                                    ...selectedJob.linkedResumeIds.map(id => {
                                      const resume = state.resumes.find(r => r.id === id);
                                      return resume ? `📄 ${resume.name || resume.fileName}` : '';
                                    }),
                                    ...selectedJob.linkedCoverLetterIds.map(id => {
                                      const coverLetter = state.coverLetters.find(cl => cl.id === id);
                                      return coverLetter ? `📝 ${coverLetter.name || coverLetter.fileName}` : '';
                                    })
                                  ].filter(Boolean).join('\n')}`
                              }
                            >
                              <FontAwesomeIcon icon={faPaperclip} />
                              {selectedJob.linkedResumeIds.length === 0 && selectedJob.linkedCoverLetterIds.length === 0 ? (
                                <FontAwesomeIcon icon={faPlus} className="add-icon" />
                              ) : (
                                <span className="document-count">
                                  {selectedJob.linkedResumeIds.length + selectedJob.linkedCoverLetterIds.length}
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="job-actions">
                          <button
                            className="close-split-button"
                            onClick={() => setSelectedJobId(null)}
                            title="Close details panel"
                          >
                            ✕
                          </button>
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
                        <StatusDropdown
                          job={selectedJob}
                          onStatusChange={handleStatusChange}
                          className="job-details-status"
                        />
                      </div>

                      {/* Show duplicate information */}
                      {selectedJob.duplicateOfId && (
                        <div className="duplicate-info-section">
                          <h3>Duplicate Information</h3>
                          <p>This job is marked as a duplicate of:</p>
                          {(() => {
                            const originalJob = state.jobDescriptions.find(j => j.id === selectedJob.duplicateOfId);
                            return originalJob ? (
                              <div className="original-job-link">
                                <button
                                  onClick={() => setSelectedJobId(originalJob.id)}
                                  className="link-button"
                                >
                                  <strong>{originalJob.title}</strong> - {originalJob.company}
                                  {originalJob.sequentialId && <span className="job-number">#{originalJob.sequentialId}</span>}
                                </button>
                              </div>
                            ) : (
                              <p>Original job not found</p>
                            );
                          })()}
                        </div>
                      )}

                      {/* Show linked duplicates */}
                      {selectedJob.linkedDuplicateIds && selectedJob.linkedDuplicateIds.length > 0 && (
                        <div className="linked-duplicates-section">
                          <h3>Linked Duplicates ({selectedJob.linkedDuplicateIds.length})</h3>
                          <p>The following jobs are marked as duplicates of this one:</p>
                          <div className="duplicate-jobs-list">
                            {selectedJob.linkedDuplicateIds.map(duplicateId => {
                              const duplicateJob = state.jobDescriptions.find(j => j.id === duplicateId);
                              return duplicateJob ? (
                                <div key={duplicateId} className="duplicate-job-item">
                                  <button
                                    onClick={() => setSelectedJobId(duplicateJob.id)}
                                    className="link-button"
                                  >
                                    <strong>{duplicateJob.title}</strong> - {duplicateJob.company}
                                    {duplicateJob.sequentialId && <span className="job-number">#{duplicateJob.sequentialId}</span>}
                                  </button>
                                  <span className="duplicate-status">Duplicate (Archived)</span>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}

                      <div className="job-info-section">
                        <h3>Extracted Information</h3>
                        <div className="info-grid">
                          <div className="info-item">
                            <strong>Role:</strong> {selectedJob.extractedInfo.role || 'Not extracted'}
                          </div>
                          {selectedJob.extractedInfo.companyDescription && (
                            <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                              <strong>Company Description:</strong>
                              <div style={{
                                marginTop: '4px',
                                padding: '8px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '4px',
                                fontSize: '14px',
                                fontStyle: 'italic',
                                color: '#495057'
                              }}>
                                {selectedJob.extractedInfo.companyDescription}
                              </div>
                            </div>
                          )}
                          <div className="info-item">
                            <strong>Location:</strong> {selectedJob.location || selectedJob.extractedInfo.location || 'Not specified'}
                          </div>
                          <div className="info-item">
                            <strong>Work Arrangement:</strong> {selectedJob.workArrangement || 'Not specified'}
                          </div>
                          <div className="info-item">
                            <strong>Impact Level:</strong>
                            {selectedJob.impact ? (
                              <span style={{ marginLeft: '8px' }}>
                                <FontAwesomeIcon
                                  icon={getImpactIcon(selectedJob.impact) || faMinus}
                                  style={{ color: getImpactColor(selectedJob.impact), marginRight: '6px' }}
                                />
                                {typeof selectedJob.impact === 'string' ?
                                  selectedJob.impact.charAt(0).toUpperCase() + selectedJob.impact.slice(1) :
                                  'High'}
                              </span>
                            ) : (
                              <span style={{ marginLeft: '8px', color: '#6c757d' }}>Not specified</span>
                            )}
                          </div>
                          <div className="info-item">
                            <strong>Salary Range:</strong> {
                              selectedJob.salaryRange ||
                              selectedJob.extractedInfo.salaryRange ||
                              (selectedJob.salaryMin && selectedJob.salaryMax ?
                                `$${selectedJob.salaryMin.toLocaleString()} - $${selectedJob.salaryMax.toLocaleString()}` :
                                'Not specified')
                            }
                          </div>
                          {selectedJob.extractedInfo.applicantCount && (
                            <div className="info-item">
                              <strong>Applicants:</strong> <span className="applicant-count">{selectedJob.extractedInfo.applicantCount}</span>
                            </div>
                          )}
                          {selectedJob.aiUsage && (
                            <div className="info-item ai-usage-item" style={{ gridColumn: '1 / -1' }}>
                              <strong>AI Parsing Cost:</strong>
                              <div style={{
                                marginTop: '4px',
                                padding: '8px',
                                backgroundColor: '#fff3cd',
                                borderRadius: '4px',
                                fontSize: '12px',
                                border: '1px solid #ffeaa7'
                              }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                                  <span><strong>Tokens:</strong> {selectedJob.aiUsage.totalTokens.toLocaleString()}</span>
                                  <span><strong>Cost:</strong> ${selectedJob.aiUsage.estimatedCost.toFixed(4)}</span>
                                  <span><strong>Parses:</strong> {selectedJob.aiUsage.parseCount}</span>
                                  <span><strong>Last Parse:</strong> {selectedJob.aiUsage.lastParseDate ? new Date(selectedJob.aiUsage.lastParseDate).toLocaleDateString() : 'Unknown'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {(selectedJob.source1 || selectedJob.source2) && (
                          <div className="job-sources-section">
                            <h4>Sources</h4>
                            {selectedJob.source1 && (
                              <div className="source-item">
                                <strong>Source 1 ({selectedJob.source1.type}):</strong>
                                {selectedJob.source1.type === 'url' ? (
                                  <a href={selectedJob.source1.content} target="_blank" rel="noopener noreferrer">
                                    {selectedJob.source1.content} ↗
                                  </a>
                                ) : (
                                  <span>{selectedJob.source1.content}</span>
                                )}
                              </div>
                            )}
                            {selectedJob.source2 && (
                              <div className="source-item">
                                <strong>Source 2 ({selectedJob.source2.type}):</strong>
                                {selectedJob.source2.type === 'url' ? (
                                  <a href={selectedJob.source2.content} target="_blank" rel="noopener noreferrer">
                                    {selectedJob.source2.content} ↗
                                  </a>
                                ) : (
                                  <span>{selectedJob.source2.content}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {selectedJob.contact && (selectedJob.contact.name || selectedJob.contact.email || selectedJob.contact.phone) && (
                          <div className="job-contact-section">
                            <h4>Contact Information</h4>
                            {selectedJob.contact.name && (
                              <div><strong>Name:</strong> {selectedJob.contact.name}</div>
                            )}
                            {selectedJob.contact.email && (
                              <div><strong>Email:</strong> <a href={`mailto:${selectedJob.contact.email}`}>{selectedJob.contact.email}</a></div>
                            )}
                            {selectedJob.contact.phone && (
                              <div><strong>Phone:</strong> <a href={`tel:${selectedJob.contact.phone}`}>{selectedJob.contact.phone}</a></div>
                            )}
                          </div>
                        )}

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

                      {/* Linked Documents Summary */}
                      {(selectedJob.linkedResumeIds.length > 0 || selectedJob.linkedCoverLetterIds.length > 0) && (
                        <div className="linked-documents-summary">
                          <h3>Linked Documents ({selectedJob.linkedResumeIds.length + selectedJob.linkedCoverLetterIds.length})</h3>
                          <div className="document-summary-list">
                            {selectedJob.linkedResumeIds.map(resumeId => {
                              const resume = state.resumes.find(r => r.id === resumeId);
                              return resume ? (
                                <div key={resume.id} className="document-summary-item">
                                  <FontAwesomeIcon icon={faFileAlt} className="document-icon" />
                                  <span className="document-name">{resume.name || resume.fileName}</span>
                                  <span className="document-type">Resume</span>
                                </div>
                              ) : null;
                            })}
                            {selectedJob.linkedCoverLetterIds.map(coverLetterId => {
                              const coverLetter = state.coverLetters.find(cl => cl.id === coverLetterId);
                              return coverLetter ? (
                                <div key={coverLetter.id} className="document-summary-item">
                                  <FontAwesomeIcon icon={faFileAlt} className="document-icon" />
                                  <span className="document-name">{coverLetter.name || coverLetter.fileName}</span>
                                  <span className="document-type">Cover Letter</span>
                                </div>
                              ) : null;
                            })}
                          </div>
                          <p className="document-summary-note">
                            <FontAwesomeIcon icon={faPaperclip} /> Click the paperclip icon next to the job title to manage linked documents.
                          </p>
                        </div>
                      )}

                      {selectedJob.additionalContext && (
                        <div className="additional-context-section">
                          <h3>Additional Context</h3>
                          <div className="context-content">
                            <p>{selectedJob.additionalContext}</p>
                          </div>
                        </div>
                      )}

                      {/* Enhanced Notes Section */}
                      <div className="notes-section">
                        <div className="notes-header">
                          <h3>Notes</h3>
                          <div className="notes-actions">
                            <div className="quick-notes">
                              <button
                                className="quick-note-btn"
                                onClick={() => handleQuickNote(selectedJob.id, 'Applied')}
                                title="Mark as applied"
                              >
                                <FontAwesomeIcon icon={faFileAlt} /> Applied
                              </button>
                              <button
                                className="quick-note-btn"
                                onClick={() => handleQuickNote(selectedJob.id, 'Interview scheduled')}
                                title="Note interview scheduled"
                              >
                                📅 Interview
                              </button>
                              <button
                                className="quick-note-btn"
                                onClick={() => handleQuickNote(selectedJob.id, 'Follow up needed')}
                                title="Mark for follow up"
                              >
                                🔔 Follow up
                              </button>
                              <button
                                className="quick-note-btn"
                                onClick={() => handleQuickNote(selectedJob.id, 'Rejected')}
                                title="Mark as rejected"
                              >
                                <FontAwesomeIcon icon={faTimes} /> Rejected
                              </button>
                            </div>
                            <button
                              className="edit-notes-btn"
                              onClick={() => handleEditNotes(selectedJob.id)}
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        </div>

                        {editingNotesId === selectedJob.id ? (
                          <div className="notes-editing">
                            <textarea
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              placeholder="Add your notes here..."
                              rows={4}
                              className="notes-textarea"
                            />
                            <div className="notes-edit-actions">
                              <button
                                className="save-notes-btn"
                                onClick={() => handleSaveNotes(selectedJob.id)}
                              >
                                Save
                              </button>
                              <button
                                className="cancel-notes-btn"
                                onClick={() => handleCancelNotesEdit()}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="notes-display">
                            {selectedJob.notes ? (
                              <div className="notes-content">
                                {selectedJob.notes.split('\n').map((line, index) => (
                                  <p key={index}>{line}</p>
                                ))}
                              </div>
                            ) : (
                              <p className="no-notes">No notes yet. Use quick actions above or click Edit to add notes.</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* <div className="generation-section">
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
                        <div className="generation-info">
                          <FontAwesomeIcon icon={faFileAlt} />
                          <span>Using full text generation for better context and flow</span>
                        </div>
                      </div>

                      <p className="generation-description">
                        Generate tailored documents using AI based on this job description and your existing content.
                        <br />
                        <strong>💾 Generated documents will be saved to your Resume/Cover Letter library and automatically linked to this job.</strong>
                      </p>
                    </div> */}

                      <div className="resume-matching-section">
                        <div className="section-header-with-toggle">
                          <h3>Document Matching</h3>
                          <button
                            className="toggle-button"
                            onClick={() => {
                              const hasLinkedDocuments = selectedJob.linkedResumeIds.length > 0 || selectedJob.linkedCoverLetterIds.length > 0;
                              setShowDocumentMatching(prev => ({
                                ...prev,
                                [selectedJob.id]: !prev[selectedJob.id]
                              }));
                            }}
                            title={(() => {
                              const hasLinkedDocuments = selectedJob.linkedResumeIds.length > 0 || selectedJob.linkedCoverLetterIds.length > 0;
                              const isVisible = showDocumentMatching[selectedJob.id] ?? !hasLinkedDocuments;
                              return isVisible ? 'Hide document matching' : 'Show document matching';
                            })()}
                          >
                            {(() => {
                              const hasLinkedDocuments = selectedJob.linkedResumeIds.length > 0 || selectedJob.linkedCoverLetterIds.length > 0;
                              const isVisible = showDocumentMatching[selectedJob.id] ?? !hasLinkedDocuments;
                              return isVisible ? '▼' : '▶';
                            })()}
                          </button>
                        </div>
                        {(() => {
                          const hasLinkedDocuments = selectedJob.linkedResumeIds.length > 0 || selectedJob.linkedCoverLetterIds.length > 0;
                          const isVisible = showDocumentMatching[selectedJob.id] ?? !hasLinkedDocuments;
                          return isVisible;
                        })() && (
                            <>
                              {documentMatches.length > 0 ? (
                                <div className="resume-matches">
                                  {documentMatches.map((match: DocumentMatch) => (
                                    <div key={match.documentId} className="resume-match">
                                      <div className="match-header">
                                        <span className="resume-name">
                                          {match.documentName}
                                          <span className="document-type-badge">
                                            <FontAwesomeIcon icon={faFileAlt} />
                                          </span>
                                        </span>
                                        <span className="match-score">
                                          {Math.round(match.matchScore * 100)}% match
                                        </span>
                                        <div className="match-actions">
                                          <button
                                            className="preview-button"
                                            onClick={() => {
                                              const document = match.documentType === 'resume'
                                                ? state.resumes.find(r => r.id === match.documentId)
                                                : state.coverLetters.find(cl => cl.id === match.documentId);

                                              if (document) {
                                                const isLinked = match.documentType === 'resume'
                                                  ? selectedJob.linkedResumeIds.includes(match.documentId)
                                                  : selectedJob.linkedCoverLetterIds.includes(match.documentId);

                                                const onLink = () => {
                                                  if (match.documentType === 'resume') {
                                                    handleLinkResume(selectedJob.id, match.documentId);
                                                  } else {
                                                    handleLinkCoverLetter(selectedJob.id, match.documentId);
                                                  }
                                                };

                                                handlePreviewDocument(document);
                                              }
                                            }}
                                            title="Preview document content"
                                          >
                                            👁️ Preview
                                          </button>
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
                            </>
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
              </>
            )}
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

      <CSVImportModal
        isOpen={showCSVImportModal}
        onClose={() => setShowCSVImportModal(false)}
        onImport={handleCSVImport}
        existingJobs={state.jobDescriptions}
      />



      {/* Document Linking Modal */}
      {showDocumentLinkingModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowDocumentLinkingModal(false)}>
          <div className="modal-content document-linking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Link Documents to "{selectedJob.title}"</h3>
              <button
                className="modal-close"
                onClick={() => setShowDocumentLinkingModal(false)}
                title="Close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="modal-body">
              {/* Search Bar */}
              <div className="document-search-section">
                <div className="search-input-container">
                  <FontAwesomeIcon icon={faSearch} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search documents by name or content..."
                    value={documentLinkingSearch}
                    onChange={(e) => setDocumentLinkingSearch(e.target.value)}
                    className="search-input"
                    autoFocus
                  />
                  {documentLinkingSearch && (
                    <button
                      onClick={() => setDocumentLinkingSearch('')}
                      className="clear-search-button"
                      title="Clear search"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  )}
                </div>
              </div>

              {/* Currently Linked Documents */}
              {(selectedJob.linkedResumeIds.length > 0 || selectedJob.linkedCoverLetterIds.length > 0) && (
                <div className="linked-documents-section">
                  <h4>Currently Linked Documents ({selectedJob.linkedResumeIds.length + selectedJob.linkedCoverLetterIds.length})</h4>

                  {/* Linked Resumes */}
                  {selectedJob.linkedResumeIds.length > 0 && (
                    <div className="document-category">
                      <h5><FontAwesomeIcon icon={faFileAlt} /> Resumes ({selectedJob.linkedResumeIds.length})</h5>
                      <div className="documents-list">
                        {selectedJob.linkedResumeIds.map((resumeId) => {
                          const resume = state.resumes.find(r => r.id === resumeId);
                          if (!resume) return null;
                          return (
                            <div key={resume.id} className="document-item linked">
                              <div className="document-info">
                                <FontAwesomeIcon icon={faFileAlt} className="document-icon" />
                                <div className="document-details">
                                  <span className="document-name">{resume.name || resume.fileName}</span>
                                  <span className="document-date">{new Date(resume.uploadDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="document-actions">
                                <button
                                  className="preview-doc-button"
                                  onClick={() => handlePreviewDocument(resume)}
                                  title="Preview this resume in new tab"
                                >
                                  <FontAwesomeIcon icon={faEye} />
                                </button>
                                <button
                                  className="unlink-button"
                                  onClick={() => handleLinkResume(selectedJob.id, resume.id)}
                                  title="Unlink this resume"
                                >
                                  Unlink
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Linked Cover Letters */}
                  {selectedJob.linkedCoverLetterIds.length > 0 && (
                    <div className="document-category">
                      <h5><FontAwesomeIcon icon={faFileAlt} /> Cover Letters ({selectedJob.linkedCoverLetterIds.length})</h5>
                      <div className="documents-list">
                        {selectedJob.linkedCoverLetterIds.map((coverLetterId) => {
                          const coverLetter = state.coverLetters.find(cl => cl.id === coverLetterId);
                          if (!coverLetter) return null;
                          return (
                            <div key={coverLetter.id} className="document-item linked">
                              <div className="document-info">
                                <FontAwesomeIcon icon={faFileAlt} className="document-icon" />
                                <div className="document-details">
                                  <span className="document-name">{coverLetter.name || coverLetter.fileName}</span>
                                  <span className="document-date">{new Date(coverLetter.uploadDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="document-actions">
                                <button
                                  className="preview-doc-button"
                                  onClick={() => handlePreviewDocument(coverLetter)}
                                  title="Preview this cover letter in new tab"
                                >
                                  <FontAwesomeIcon icon={faEye} />
                                </button>
                                <button
                                  className="unlink-button"
                                  onClick={() => handleLinkCoverLetter(selectedJob.id, coverLetter.id)}
                                  title="Unlink this cover letter"
                                >
                                  Unlink
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Available Documents to Link */}
              <div className="available-documents-section">
                <h4>Available Documents to Link</h4>

                {/* Available Resumes */}
                {(() => {
                  const availableResumes = state.resumes.filter(resume => {
                    // Filter out already linked resumes
                    if (selectedJob.linkedResumeIds.includes(resume.id)) return false;

                    // Apply search filter
                    if (!documentLinkingSearch) return true;
                    const searchTerm = documentLinkingSearch.toLowerCase();
                    const resumeName = (resume.name || resume.fileName || '').toLowerCase();
                    const resumeContent = (resume.textContent || '').toLowerCase();
                    return resumeName.includes(searchTerm) || resumeContent.includes(searchTerm);
                  });

                  return availableResumes.length > 0 && (
                    <div className="document-category">
                      <h5><FontAwesomeIcon icon={faFileAlt} /> Resumes ({availableResumes.length})</h5>
                      <div className="documents-list">
                        {availableResumes.map((resume) => (
                          <div key={resume.id} className="document-item available">
                            <div className="document-info">
                              <FontAwesomeIcon icon={faFileAlt} className="document-icon" />
                              <div className="document-details">
                                <span className="document-name">{resume.name || resume.fileName}</span>
                                <span className="document-date">{new Date(resume.uploadDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="document-actions">
                              <button
                                className="preview-doc-button"
                                onClick={() => window.open(`data:text/plain;charset=utf-8,${encodeURIComponent(resume.textContent || 'No content available')}`, '_blank')}
                                title="Preview this resume in new tab"
                              >
                                <FontAwesomeIcon icon={faEye} />
                              </button>
                              <button
                                className="link-button"
                                onClick={() => handleLinkResume(selectedJob.id, resume.id)}
                                title="Link this resume"
                              >
                                Link
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Available Cover Letters */}
                {(() => {
                  const availableCoverLetters = state.coverLetters.filter(coverLetter => {
                    // Filter out already linked cover letters
                    if (selectedJob.linkedCoverLetterIds.includes(coverLetter.id)) return false;

                    // Apply search filter
                    if (!documentLinkingSearch) return true;
                    const searchTerm = documentLinkingSearch.toLowerCase();
                    const coverLetterName = (coverLetter.name || coverLetter.fileName || '').toLowerCase();
                    const coverLetterContent = (coverLetter.textContent || '').toLowerCase();
                    const targetCompany = ((coverLetter as CoverLetter).targetCompany || '').toLowerCase();
                    const targetPosition = ((coverLetter as CoverLetter).targetPosition || '').toLowerCase();
                    return coverLetterName.includes(searchTerm) ||
                      coverLetterContent.includes(searchTerm) ||
                      targetCompany.includes(searchTerm) ||
                      targetPosition.includes(searchTerm);
                  });

                  return availableCoverLetters.length > 0 && (
                    <div className="document-category">
                      <h5><FontAwesomeIcon icon={faFileAlt} /> Cover Letters ({availableCoverLetters.length})</h5>
                      <div className="documents-list">
                        {availableCoverLetters.map((coverLetter) => (
                          <div key={coverLetter.id} className="document-item available">
                            <div className="document-info">
                              <FontAwesomeIcon icon={faFileAlt} className="document-icon" />
                              <div className="document-details">
                                <span className="document-name">{coverLetter.name || coverLetter.fileName}</span>
                                <span className="document-date">{new Date(coverLetter.uploadDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="document-actions">
                              <button
                                className="preview-doc-button"
                                onClick={() => window.open(`data:text/plain;charset=utf-8,${encodeURIComponent(coverLetter.textContent || 'No content available')}`, '_blank')}
                                title="Preview this cover letter in new tab"
                              >
                                <FontAwesomeIcon icon={faEye} />
                              </button>
                              <button
                                className="link-button"
                                onClick={() => handleLinkCoverLetter(selectedJob.id, coverLetter.id)}
                                title="Link this cover letter"
                              >
                                Link
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* No documents message */}
                {state.resumes.length === 0 && state.coverLetters.length === 0 && (
                  <p className="no-documents-message">
                    No documents available to link. Upload some resumes or cover letters first.
                  </p>
                )}

                {/* No matching documents message */}
                {(state.resumes.length > 0 || state.coverLetters.length > 0) &&
                  state.resumes.filter(r => !selectedJob.linkedResumeIds.includes(r.id)).length === 0 &&
                  state.coverLetters.filter(cl => !selectedJob.linkedCoverLetterIds.includes(cl.id)).length === 0 && (
                    <p className="no-documents-message">
                      All available documents are already linked to this job.
                    </p>
                  )}

                {/* No search results message */}
                {documentLinkingSearch &&
                  state.resumes.filter(r => {
                    if (selectedJob.linkedResumeIds.includes(r.id)) return false;
                    const searchTerm = documentLinkingSearch.toLowerCase();
                    const resumeName = (r.name || r.fileName || '').toLowerCase();
                    const resumeContent = (r.textContent || '').toLowerCase();
                    return resumeName.includes(searchTerm) || resumeContent.includes(searchTerm);
                  }).length === 0 &&
                  state.coverLetters.filter(cl => {
                    if (selectedJob.linkedCoverLetterIds.includes(cl.id)) return false;
                    const searchTerm = documentLinkingSearch.toLowerCase();
                    const coverLetterName = (cl.name || cl.fileName || '').toLowerCase();
                    const coverLetterContent = (cl.textContent || '').toLowerCase();
                    const targetCompany = ((cl as CoverLetter).targetCompany || '').toLowerCase();
                    const targetPosition = ((cl as CoverLetter).targetPosition || '').toLowerCase();
                    return coverLetterName.includes(searchTerm) ||
                      coverLetterContent.includes(searchTerm) ||
                      targetCompany.includes(searchTerm) ||
                      targetPosition.includes(searchTerm);
                  }).length === 0 && (
                    <p className="no-documents-message">
                      No documents match your search "{documentLinkingSearch}".
                    </p>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="analytics-content">
          <AnalyticsDashboard jobs={state.jobDescriptions} />
        </div>
      )}

      {/* Duplicate Job Modal */}
      {showDuplicateModal && duplicateJobId && (
        <div className="modal-overlay" onClick={() => setShowDuplicateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Mark as Duplicate</h3>
              <button
                className="modal-close"
                onClick={() => setShowDuplicateModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>Select the original job that this is a duplicate of:</p>
              <div className="duplicate-search-container">
                <input
                  type="text"
                  placeholder="Search original jobs (company, title, role...)"
                  value={duplicateSearchQuery}
                  onChange={(e) => setDuplicateSearchQuery(e.target.value)}
                  className="duplicate-search-input"
                />
              </div>
              <div className="duplicate-job-list">
                {(() => {
                  let availableJobs = state.jobDescriptions
                    .filter(job => job.id !== duplicateJobId && job.applicationStatus !== 'duplicate');

                  // Apply search filter to duplicate modal
                  if (duplicateSearchQuery.trim()) {
                    const query = duplicateSearchQuery.toLowerCase().trim();
                    availableJobs = availableJobs.filter(job =>
                      job.company.toLowerCase().includes(query) ||
                      job.title.toLowerCase().includes(query) ||
                      (job.role && job.role.toLowerCase().includes(query)) ||
                      (job.extractedInfo.role && job.extractedInfo.role.toLowerCase().includes(query)) ||
                      (job.location && job.location.toLowerCase().includes(query)) ||
                      (job.extractedInfo.location && job.extractedInfo.location.toLowerCase().includes(query))
                    );
                  }

                  return availableJobs.map(job => (
                    <div
                      key={job.id}
                      className="duplicate-job-option"
                      onClick={() => handleConfirmDuplicate(job.id)}
                    >
                      <div className="job-info">
                        <strong>{job.title}</strong>
                        <span className="company-name">{job.company}</span>
                        {job.sequentialId && <span className="job-number">#{job.sequentialId}</span>}
                      </div>
                      <div className="job-status">
                        {job.applicationStatus || 'not_applied'}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Settings Modal */}
      {showReminderSettings && (
        <div className="modal-overlay" onClick={() => setShowReminderSettings(false)}>
          <div className="modal-content reminder-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Action Reminder Settings</h2>
              <button
                className="modal-close-btn"
                onClick={() => setShowReminderSettings(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="modal-body">
              <ActionReminderPanel
                jobs={state.jobDescriptions.filter(job =>
                  !job.isArchived &&
                  job.applicationStatus !== 'archived' &&
                  job.applicationStatus !== 'duplicate'
                )}
                onJobUpdate={(updatedJob: JobDescription) => {
                  setState(prev => ({
                    ...prev,
                    jobDescriptions: prev.jobDescriptions.map(jd =>
                      jd.id === updatedJob.id ? updatedJob : jd
                    )
                  }));

                  // Save to storage
                  saveJobDescription(updatedJob).catch(error => {
                    console.error('Error saving job description:', error);
                    showToast('Failed to save job description. Please try again.', 'error');
                  });
                }}
                showSettingsOnly={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            onClick={() => removeToast(toast.id)}
          >
            <div className="toast-content">
              <span className="toast-icon">
                {toast.type === 'success' && '✅'}
                {toast.type === 'error' && <FontAwesomeIcon icon={faTimes} />}
                {toast.type === 'warning' && '⚠️'}
                {toast.type === 'info' && 'ℹ️'}
              </span>
              <span className="toast-message">{toast.message}</span>
              <button className="toast-close" onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Action Reminder Panel */}
      <ActionReminderPanel
        floating={true}
        jobs={(() => {
          let filteredJobs = state.jobDescriptions;

          // Filter out archived/duplicates for reminders
          filteredJobs = filteredJobs.filter(job =>
            !job.isArchived &&
            job.applicationStatus !== 'archived' &&
            job.applicationStatus !== 'duplicate'
          );

          return filteredJobs;
        })()}
        onJobUpdate={(updatedJob: JobDescription) => {
          setState(prev => ({
            ...prev,
            jobDescriptions: prev.jobDescriptions.map(jd =>
              jd.id === updatedJob.id ? updatedJob : jd
            )
          }));

          // Save to storage
          saveJobDescription(updatedJob).catch(error => {
            console.error('Error saving job description:', error);
            showToast('Failed to save job description. Please try again.', 'error');
          });
        }}
      />
    </div>
  );
};

export default JobDescriptionsPage;