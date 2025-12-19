import { JobDescription } from '../types';
import { JobDescriptionFormData } from '../hooks/useJobFormData';
import { needsAIParsing } from './aiService';

export const cleanLinkedInUrl = (url: string): string => {
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

export const isJobUnparsed = (job: JobDescription): boolean => {
  return needsAIParsing(job);
};

export const convertJobDescriptionToFormData = (job: JobDescription): JobDescriptionFormData => {
  return {
    title: job.title || '',
    company: job.company || '',
    sequentialId: job.sequentialId?.toString() || '',
    url: job.url || '',
    rawText: job.rawText || '',
    role: job.role || '',
    location: job.location || '',
    workArrangement: job.workArrangement || '',
    impact: typeof job.impact === 'string' ? job.impact : '',
    salaryMin: job.salaryMin?.toString() || '',
    salaryMax: job.salaryMax?.toString() || '',
    source1Type: job.source1?.type || 'url',
    source1Content: job.source1?.content || '',
    source2Type: job.source2?.type || 'url',
    source2Content: job.source2?.content || '',
    contactName: job.contact?.name || '',
    contactEmail: job.contact?.email || '',
    contactPhone: job.contact?.phone || '',
    applicationDate: job.applicationDate || '',
    applicationStatus: job.applicationStatus || 'not_applied',
    notes: job.notes || '',
    additionalContext: job.additionalContext || '',
    waitingForResponse: job.waitingForResponse || false,
    isArchived: job.isArchived || false,
    createdAt: job.createdAt,
    priority: typeof job.priority === 'string' ? job.priority : '',
    interviewStage: job.interviewStage || '',
    offerStage: job.offerStage || '',
    daysSinceApplication: job.daysSinceApplication || 0,
    daysInCurrentStatus: job.daysInCurrentStatus || 0,
  };
};