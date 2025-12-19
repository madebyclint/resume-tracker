import { useCallback, useState } from 'react';
import { JobDescription } from '../types';
import { saveJobDescription, deleteJobDescription } from '../storage';
import { parseJobDescription } from '../utils/aiService';
import { smartParseJobDescription } from '../utils/aiParsingService';
import { createTextHash, needsAIParsing, calculateAICost } from '../utils/jobDescriptionHelpers';
import { logActivity } from '../utils/activityLogger';

interface JobActionHooks {
  isExporting: boolean;
  isImporting: boolean;
  handleScrapedJob: (scrapedJob: JobDescription) => Promise<void>;
  handleExportData: () => Promise<void>;
  handleImportData: () => void;
  handleDeleteJob: (jobId: string) => Promise<void>;
  handleToggleArchive: (job: JobDescription) => Promise<void>;
  handleDuplicateJob: (jobId: string, setState: any) => Promise<void>;
  handleUpdateJob: (jobId: string, updates: Partial<JobDescription>, setState: any) => Promise<void>;
  handleParseAllUnparsed: (jobs: JobDescription[], setState: any, showToast: any, setAiParseCache: any, aiParseCache: Map<string, any>) => Promise<void>;
}

export const useJobActions = (
  setState: React.Dispatch<React.SetStateAction<any>>,
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void,
  setScraperModalOpen: (open: boolean) => void
): JobActionHooks => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleScrapedJob = useCallback(async (scrapedJob: JobDescription) => {
    try {
      await saveJobDescription(scrapedJob);

      setState((prev: any) => ({
        ...prev,
        jobDescriptions: [...prev.jobDescriptions, scrapedJob]
      }));

      logActivity(scrapedJob, 'field_updated', {
        field: 'imported',
        toValue: true,
        details: 'Job scraped and imported successfully'
      });

      setScraperModalOpen(false);
      showToast('Job description scraped and saved successfully!', 'success');

    } catch (error) {
      console.error('Error saving scraped job:', error);
      showToast('Failed to save scraped job. Please try again.', 'error');
    }
  }, [setState, showToast, setScraperModalOpen]);

  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    try {
      const { exportAllDataAsJSON } = await import('../storage');
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
  }, [showToast]);

  const handleImportData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement)?.files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const jsonString = await file.text();

        let parsedData;
        try {
          parsedData = JSON.parse(jsonString);
        } catch (parseError) {
          throw new Error(`Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
        }

        if (!parsedData || typeof parsedData !== 'object') {
          throw new Error('Invalid backup file structure');
        }

        const result = { success: false, importedCounts: { resumes: 0, coverLetters: 0, jobDescriptions: 0 }, warnings: [], errors: ['Feature removed'] };

        if (result.success || result.importedCounts.resumes > 0 || result.importedCounts.coverLetters > 0 || result.importedCounts.jobDescriptions > 0) {
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
  }, [setState, showToast]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      await deleteJobDescription(jobId);
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.filter((job: JobDescription) => job.id !== jobId)
      }));
      showToast('Job deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting job:', error);
      showToast('Failed to delete job', 'error');
    }
  }, [setState, showToast]);

  const handleToggleArchive = useCallback(async (job: JobDescription) => {
    const newArchivedStatus = !job.isArchived;
    const updatedJob = { 
      ...job, 
      isArchived: newArchivedStatus,
      applicationStatus: newArchivedStatus ? 'archived' as const : 'not_applied' as const
    };

    try {
      await saveJobDescription(updatedJob);
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((j: JobDescription) => 
          j.id === job.id ? updatedJob : j
        )
      }));

      logActivity(updatedJob, 'field_updated', {
        field: 'isArchived',
        fromValue: job.isArchived,
        toValue: newArchivedStatus,
        details: newArchivedStatus ? 'Job archived' : 'Job unarchived'
      });

      showToast(
        `Job ${newArchivedStatus ? 'archived' : 'unarchived'} successfully`,
        'success'
      );
    } catch (error) {
      console.error('Error toggling archive status:', error);
      showToast('Failed to update job archive status', 'error');
    }
  }, [setState, showToast]);

  const handleDuplicateJob = useCallback(async (jobId: string, setState: any) => {
    const currentState = await new Promise(resolve => setState((prev: any) => { resolve(prev); return prev; }));
    const originalJob = (currentState as any).jobDescriptions.find((job: JobDescription) => job.id === jobId);
    
    if (!originalJob) return;

    const duplicateJob: JobDescription = {
      ...originalJob,
      id: `job_${Date.now()}`,
      title: `${originalJob.title} (Copy)`,
      sequentialId: undefined,
      uploadDate: new Date().toISOString(),
      applicationStatus: 'not_applied',
      applicationDate: '',
      notes: originalJob.notes ? `${originalJob.notes}\n\n[Copied from original]` : '[Copied from original]',
      duplicateOfId: originalJob.id,
      createdAt: new Date().toISOString()
    };

    try {
      await saveJobDescription(duplicateJob);
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: [...prev.jobDescriptions, duplicateJob]
      }));

      logActivity(duplicateJob, 'created', {
        details: `Duplicated from job: ${originalJob.title}`
      });

      showToast('Job duplicated successfully', 'success');
    } catch (error) {
      console.error('Error duplicating job:', error);
      showToast('Failed to duplicate job', 'error');
    }
  }, [showToast]);

  const handleUpdateJob = useCallback(async (jobId: string, updates: Partial<JobDescription>, setState: any) => {
    const currentState = await new Promise(resolve => setState((prev: any) => { resolve(prev); return prev; }));
    const currentJob = (currentState as any).jobDescriptions.find((job: JobDescription) => job.id === jobId);
    
    if (!currentJob) return;

    const updatedJob = { ...currentJob, ...updates };

    try {
      await saveJobDescription(updatedJob);
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((job: JobDescription) =>
          job.id === jobId ? updatedJob : job
        )
      }));

      Object.entries(updates).forEach(([field, newValue]) => {
        const oldValue = (currentJob as any)[field];
        if (oldValue !== newValue) {
          logActivity(updatedJob, 'field_updated', {
            field,
            fromValue: oldValue,
            toValue: newValue
          });
        }
      });

      showToast('Job updated successfully', 'success');
    } catch (error) {
      console.error('Error updating job:', error);
      showToast('Failed to update job', 'error');
    }
  }, [showToast]);

  const handleParseAllUnparsed = useCallback(async (
    jobs: JobDescription[],
    setState: any,
    showToast: any,
    setAiParseCache: any,
    aiParseCache: Map<string, any>
  ) => {
    const unparsedJobs = jobs.filter(job => needsAIParsing(job));
    
    if (unparsedJobs.length === 0) {
      showToast('No unparsed jobs found', 'info');
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const results: JobDescription[] = [];

    showToast(`Starting AI parsing for ${unparsedJobs.length} jobs...`, 'info');

    for (const job of unparsedJobs) {
      try {
        const result = await smartParseJobDescription(
          job.rawText || '',
          job,
          aiParseCache,
          setAiParseCache,
          job.additionalContext ? { additionalContext: job.additionalContext } : undefined
        );

        if (result.success && result.extractedInfo) {
          const extractedInfo = result.extractedInfo;
          const textHash = createTextHash(job.rawText || '');
          
          const updatedJob: JobDescription = {
            ...job,
            title: extractedInfo.title || job.title,
            company: extractedInfo.company || job.company,
            location: extractedInfo.location || job.location,
            salaryMin: extractedInfo.salaryMin || job.salaryMin,
            salaryMax: extractedInfo.salaryMax || job.salaryMax,
            role: extractedInfo.role || job.role,
            extractedInfo: extractedInfo,
            keywords: result.keywords || [],
            aiUsage: {
              parseCount: (job.aiUsage?.parseCount || 0) + 1,
              totalTokens: (job.aiUsage?.totalTokens || 0) + (result.usage?.totalTokens || 0),
              estimatedCost: (job.aiUsage?.estimatedCost || 0) + (result.usage ? calculateAICost(result.usage) : 0),
              lastParsed: new Date().toISOString(),
              rawTextHash: textHash
            }
          };

          await saveJobDescription(updatedJob);
          results.push(updatedJob);
          successCount++;

          logActivity(updatedJob, 'ai_parsed', {
            details: `AI parsing completed. Tokens used: ${result.usage?.totalTokens || 0}`,
            metadata: {
              tokensUsed: result.usage?.totalTokens || 0,
              cost: result.usage ? calculateAICost(result.usage) : 0,
              fromCache: result.fromCache || false
            }
          });
        } else {
          failCount++;
          console.error(`AI parsing failed for job ${job.id}:`, result.error);
        }
      } catch (error) {
        failCount++;
        console.error(`Error processing job ${job.id}:`, error);
      }
    }

    if (results.length > 0) {
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((job: JobDescription) => {
          const updated = results.find(r => r.id === job.id);
          return updated || job;
        })
      }));
    }

    if (successCount > 0) {
      showToast(`Successfully parsed ${successCount} jobs${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
    } else {
      showToast(`Failed to parse all ${failCount} jobs`, 'error');
    }
  }, []);

  return {
    isExporting,
    isImporting,
    handleScrapedJob,
    handleExportData,
    handleImportData,
    handleDeleteJob,
    handleToggleArchive,
    handleDuplicateJob,
    handleUpdateJob,
    handleParseAllUnparsed
  };
};