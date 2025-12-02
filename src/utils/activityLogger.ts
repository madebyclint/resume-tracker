import { JobDescription } from '../types';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  type: 'status_change' | 'interview_stage_change' | 'note_added' | 'document_linked' | 'field_updated';
  fromValue?: any;
  toValue?: any;
  field?: string;
  details?: string;
}

/**
 * Generates a unique ID for activity log entries
 */
export const generateActivityId = (): string => {
  return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Logs an activity to a job's activity log
 */
export const logActivity = (
  job: JobDescription,
  type: ActivityLogEntry['type'],
  details: {
    fromValue?: any;
    toValue?: any;
    field?: string;
    details?: string;
  }
): JobDescription => {
  const activity: ActivityLogEntry = {
    id: generateActivityId(),
    timestamp: new Date().toISOString(),
    type,
    ...details
  };

  return {
    ...job,
    activityLog: [...(job.activityLog || []), activity],
    lastActivityDate: activity.timestamp
  };
};

/**
 * Logs a status change with proper tracking
 */
export const logStatusChange = (
  job: JobDescription,
  newStatus: JobDescription['applicationStatus'],
  newInterviewStage?: JobDescription['interviewStage']
): JobDescription => {
  const activities: ActivityLogEntry[] = [];
  const timestamp = new Date().toISOString();

  // Log status change if status changed
  if (job.applicationStatus !== newStatus) {
    activities.push({
      id: generateActivityId(),
      timestamp,
      type: 'status_change',
      fromValue: job.applicationStatus,
      toValue: newStatus,
      details: `Status changed from ${job.applicationStatus || 'not_applied'} to ${newStatus}`
    });
  }

  // Log interview stage change if interview stage changed
  if (newStatus === 'interviewing' && job.interviewStage !== newInterviewStage) {
    activities.push({
      id: generateActivityId(),
      timestamp,
      type: 'interview_stage_change',
      fromValue: job.interviewStage,
      toValue: newInterviewStage,
      details: `Interview stage changed from ${job.interviewStage || 'none'} to ${newInterviewStage || 'none'}`
    });
  }

  // Update status history
  const statusHistoryEntry = {
    status: newStatus,
    interviewStage: newInterviewStage,
    date: timestamp,
    notes: activities.map(a => a.details).join('; ')
  };

  return {
    ...job,
    applicationStatus: newStatus,
    interviewStage: newInterviewStage,
    applicationDate: newStatus === 'applied' && !job.applicationDate ? timestamp : job.applicationDate,
    lastActivityDate: timestamp,
    activityLog: [...(job.activityLog || []), ...activities],
    statusHistory: [...(job.statusHistory || []), statusHistoryEntry]
  };
};

/**
 * Gets analytics data from activity logs
 * NOTE: This includes ALL jobs (active, archived, duplicates) for complete historical analysis
 */
export const getAnalytics = (jobs: JobDescription[]) => {
  const analytics = {
    totalJobs: jobs.length,
    statusDistribution: {} as Record<string, number>,
    interviewStageDistribution: {} as Record<string, number>,
    conversionRates: {
      appliedToInterview: 0,
      appliedToHired: 0,
      interviewToHired: 0,
      appliedToRejected: 0,
      interviewToRejected: 0
    },
    timelines: {
      avgDaysToInterview: 0,
      avgDaysToDecision: 0
    },
    activitySummary: {
      totalActivities: 0,
      statusChanges: 0,
      interviewStageChanges: 0,
      notesAdded: 0
    }
  };

  // Count current status distribution
  jobs.forEach(job => {
    const status = job.applicationStatus || 'not_applied';
    analytics.statusDistribution[status] = (analytics.statusDistribution[status] || 0) + 1;
    
    if (job.interviewStage) {
      analytics.interviewStageDistribution[job.interviewStage] = 
        (analytics.interviewStageDistribution[job.interviewStage] || 0) + 1;
    }
    
    // Count activities
    if (job.activityLog) {
      analytics.activitySummary.totalActivities += job.activityLog.length;
      job.activityLog.forEach(activity => {
        switch (activity.type) {
          case 'status_change':
            analytics.activitySummary.statusChanges++;
            break;
          case 'interview_stage_change':
            analytics.activitySummary.interviewStageChanges++;
            break;
          case 'note_added':
            analytics.activitySummary.notesAdded++;
            break;
        }
      });
    }
  });

  // Calculate conversion rates
  const appliedJobs = jobs.filter(j => j.applicationStatus && j.applicationStatus !== 'not_applied');
  const interviewingJobs = jobs.filter(j => j.applicationStatus === 'interviewing');
  const hiredJobs = jobs.filter(j => j.applicationStatus === 'offered');
  const rejectedJobs = jobs.filter(j => j.applicationStatus === 'rejected');

  if (appliedJobs.length > 0) {
    analytics.conversionRates.appliedToInterview = (interviewingJobs.length / appliedJobs.length) * 100;
    analytics.conversionRates.appliedToHired = (hiredJobs.length / appliedJobs.length) * 100;
    analytics.conversionRates.appliedToRejected = (rejectedJobs.length / appliedJobs.length) * 100;
  }

  if (interviewingJobs.length > 0) {
    analytics.conversionRates.interviewToHired = (hiredJobs.length / interviewingJobs.length) * 100;
    analytics.conversionRates.interviewToRejected = (rejectedJobs.length / interviewingJobs.length) * 100;
  }

  return analytics;
};

/**
 * Gets funnel analytics showing progression through stages
 * NOTE: This includes ALL jobs (active, archived, duplicates) for complete historical analysis
 */
export const getFunnelAnalytics = (jobs: JobDescription[]) => {
  const funnel = {
    notApplied: 0,
    applied: 0,
    screening: 0,
    firstInterview: 0,
    followupInterview: 0,
    finalRound: 0,
    assessment: 0,
    offered: 0,
    rejected: 0,
    withdrawn: 0,
    duplicate: 0,
    archived: 0
  };

  jobs.forEach(job => {
    switch (job.applicationStatus) {
      case 'not_applied':
        funnel.notApplied++;
        break;
      case 'applied':
        funnel.applied++;
        break;
      case 'interviewing':
        switch (job.interviewStage) {
          case 'screening':
            funnel.screening++;
            break;
          case 'first_interview':
            funnel.firstInterview++;
            break;
          case 'followup_interview':
            funnel.followupInterview++;
            break;
          case 'final_round':
            funnel.finalRound++;
            break;
          case 'assessment':
            funnel.assessment++;
            break;
          default:
            // Default interviewing without specific stage
            funnel.firstInterview++;
        }
        break;
      case 'offered':
        funnel.offered++;
        break;
      case 'rejected':
        funnel.rejected++;
        break;
      case 'withdrawn':
        funnel.withdrawn++;
        break;
      case 'duplicate':
        funnel.duplicate++;
        break;
      case 'archived':
        funnel.archived++;
        break;
    }
  });

  return funnel;
};