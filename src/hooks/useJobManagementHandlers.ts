import { useCallback } from 'react';
import { JobDescription } from '../types';
import { saveJobDescription, deleteJobDescription } from '../storage';
import { logStatusChange, logActivity } from '../utils/activityLogger';

interface JobManagementHandlers {
  handleDeleteJobDescription: (id: string, setState: any, showToast: any) => Promise<void>;
  handleArchiveJob: (id: string, setState: any, showToast: any) => Promise<void>;
  handleUnarchiveJob: (id: string, setState: any, showToast: any) => Promise<void>;
  handleToggleWaitingForResponse: (id: string, state: any, setState: any, showToast: any) => Promise<void>;
  handleMarkDuplicate: (jobId: string, setDuplicateJobId: any, setDuplicateSearchQuery: any, setShowDuplicateModal: any) => void;
  handleConfirmDuplicate: (originalJobId: string, duplicateJobId: string | null, setState: any, showToast: any, setShowDuplicateModal: any, setDuplicateJobId: any) => Promise<void>;
  handleStatusChange: (jobId: string, status: JobDescription['applicationStatus'], interviewStage?: JobDescription['interviewStage'], offerStage?: JobDescription['offerStage'], state: any, setState: any, showToast: any) => Promise<void>;
  handleQuickNote: (jobId: string, noteText: string, state: any, setState: any) => Promise<void>;
  handleEditNotes: (jobId: string, setEditingNotesId: any, setTempNotes: any, state: any) => void;
  handleSaveNotes: (jobId: string, tempNotes: string, state: any, setState: any, setEditingNotesId: any, setTempNotes: any) => Promise<void>;
  handleCancelNotesEdit: (setEditingNotesId: any, setTempNotes: any) => void;
  handleProcessJob: (jobId: string, state: any, setState: any, showToast: any, getNextSequentialId: () => number, aiParseCache: Map<string, any>, setAiParseCache: any, setIsProcessing: any) => Promise<void>;
}

export const useJobManagementHandlers = (): JobManagementHandlers => {

  const handleDeleteJobDescription = useCallback(async (
    id: string, 
    setState: any, 
    showToast: any
  ) => {
    if (!confirm('Are you sure you want to delete this job description?')) {
      return;
    }

    try {
      await deleteJobDescription(id);
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.filter((jd: JobDescription) => jd.id !== id)
      }));
      showToast('Job deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting job description:', error);
      showToast('Failed to delete job description. Please try again.', 'error');
    }
  }, []);

  const handleArchiveJob = useCallback(async (
    id: string, 
    setState: any, 
    showToast: any
  ) => {
    try {
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((job: JobDescription) =>
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
  }, []);

  const handleUnarchiveJob = useCallback(async (
    id: string, 
    setState: any, 
    showToast: any
  ) => {
    try {
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((job: JobDescription) =>
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
  }, []);

  const handleToggleWaitingForResponse = useCallback(async (
    id: string,
    state: any,
    setState: any, 
    showToast: any
  ) => {
    try {
      const job = state.jobDescriptions.find((j: JobDescription) => j.id === id);
      if (!job) return;

      const newWaitingStatus = !job.waitingForResponse;

      const updatedJob = {
        ...logActivity(job, 'field_updated', {
          field: 'waitingForResponse',
          fromValue: job.waitingForResponse || false,
          toValue: newWaitingStatus,
          details: `Waiting for response ${newWaitingStatus ? 'enabled' : 'disabled'}`
        }),
        waitingForResponse: newWaitingStatus
      };

      await saveJobDescription(updatedJob);

      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((j: JobDescription) =>
          j.id === id ? updatedJob : j
        )
      }));

      showToast(
        `Job marked as ${newWaitingStatus ? 'waiting for response' : 'not waiting for response'}`,
        'success'
      );
    } catch (error) {
      console.error('Error toggling waiting status:', error);
      showToast('Failed to update waiting status. Please try again.', 'error');
    }
  }, []);

  const handleMarkDuplicate = useCallback((
    jobId: string, 
    setDuplicateJobId: any, 
    setDuplicateSearchQuery: any, 
    setShowDuplicateModal: any
  ) => {
    setDuplicateJobId(jobId);
    setDuplicateSearchQuery('');
    setShowDuplicateModal(true);
  }, []);

  const handleConfirmDuplicate = useCallback(async (
    originalJobId: string,
    duplicateJobId: string | null,
    setState: any,
    showToast: any,
    setShowDuplicateModal: any,
    setDuplicateJobId: any
  ) => {
    if (!duplicateJobId) return;

    try {
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((job: JobDescription) => {
          if (job.id === duplicateJobId) {
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
  }, []);

  const handleStatusChange = useCallback(async (
    jobId: string,
    status: JobDescription['applicationStatus'],
    interviewStage?: JobDescription['interviewStage'],
    offerStage?: JobDescription['offerStage'],
    state: any,
    setState: any,
    showToast: any
  ) => {
    const jobDescription = state.jobDescriptions.find((jd: JobDescription) => jd.id === jobId);
    if (!jobDescription) return;

    const updatedJobDescription = logStatusChange(jobDescription, status, interviewStage, offerStage);

    try {
      await saveJobDescription(updatedJobDescription);
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((jd: JobDescription) =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status. Please try again.', 'error');
    }
  }, []);

  const handleQuickNote = useCallback(async (
    jobId: string,
    noteText: string,
    state: any,
    setState: any
  ) => {
    const jobDescription = state.jobDescriptions.find((jd: JobDescription) => jd.id === jobId);
    if (!jobDescription) return;

    const now = new Date().toLocaleString();
    const newNote = `[${now}] ${noteText}`;
    const updatedNotes = jobDescription.notes
      ? `${jobDescription.notes}\n${newNote}`
      : newNote;

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
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((jd: JobDescription) =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
    } catch (error) {
      console.error('Error adding quick note:', error);
      alert('Failed to add note. Please try again.');
    }
  }, []);

  const handleEditNotes = useCallback((
    jobId: string,
    setEditingNotesId: any,
    setTempNotes: any,
    state: any
  ) => {
    const jobDescription = state.jobDescriptions.find((jd: JobDescription) => jd.id === jobId);
    if (!jobDescription) return;

    setEditingNotesId(jobId);
    setTempNotes(jobDescription.notes || '');
  }, []);

  const handleSaveNotes = useCallback(async (
    jobId: string,
    tempNotes: string,
    state: any,
    setState: any,
    setEditingNotesId: any,
    setTempNotes: any
  ) => {
    const jobDescription = state.jobDescriptions.find((jd: JobDescription) => jd.id === jobId);
    if (!jobDescription) return;

    const updatedJobDescription: JobDescription = {
      ...jobDescription,
      notes: tempNotes.trim() || undefined,
      lastActivityDate: new Date().toISOString()
    };

    try {
      await saveJobDescription(updatedJobDescription);
      setState((prev: any) => ({
        ...prev,
        jobDescriptions: prev.jobDescriptions.map((jd: JobDescription) =>
          jd.id === jobId ? updatedJobDescription : jd
        )
      }));
      setEditingNotesId(null);
      setTempNotes('');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes. Please try again.');
    }
  }, []);

  const handleCancelNotesEdit = useCallback((
    setEditingNotesId: any,
    setTempNotes: any
  ) => {
    setEditingNotesId(null);
    setTempNotes('');
  }, []);

  const handleProcessJob = useCallback(async (
    jobId: string,
    state: any,
    setState: any,
    showToast: any,
    getNextSequentialId: () => number,
    aiParseCache: Map<string, any>,
    setAiParseCache: any,
    setIsProcessing: any
  ) => {
    const job = state.jobDescriptions.find((jd: JobDescription) => jd.id === jobId);
    if (!job) return;

    setIsProcessing(true);
    try {
      const { smartParseJobDescription } = await import('../utils/aiParsingService');
      const { createTextHash, calculateAICost } = await import('../utils/jobDescriptionHelpers');

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

        setState((prev: any) => ({
          ...prev,
          jobDescriptions: prev.jobDescriptions.map((jd: JobDescription) =>
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
  }, []);

  return {
    handleDeleteJobDescription,
    handleArchiveJob,
    handleUnarchiveJob,
    handleToggleWaitingForResponse,
    handleMarkDuplicate,
    handleConfirmDuplicate,
    handleStatusChange,
    handleQuickNote,
    handleEditNotes,
    handleSaveNotes,
    handleCancelNotesEdit,
    handleProcessJob
  };
};