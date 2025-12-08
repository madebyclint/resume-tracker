import { JobDescription, ActionCompletion } from '../types';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  type: 'status_change' | 'interview_stage_change' | 'note_added' | 'document_linked' | 'field_updated' | 'action_completed';
  fromValue?: any;
  toValue?: any;
  field?: string;
  details?: string;
  actionType?: string; // for action_completed type
  actionDetails?: string; // what the user actually did
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
  newInterviewStage?: JobDescription['interviewStage'],
  newOfferStage?: JobDescription['offerStage']
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

  // Log offer stage change if offer stage changed
  if (newStatus === 'offered' && job.offerStage !== newOfferStage) {
    activities.push({
      id: generateActivityId(),
      timestamp,
      type: 'field_updated',
      field: 'offerStage',
      fromValue: job.offerStage,
      toValue: newOfferStage,
      details: `Offer stage changed from ${job.offerStage || 'none'} to ${newOfferStage || 'none'}`
    });
  }

  // Update status history
  const statusHistoryEntry = {
    status: newStatus,
    interviewStage: newInterviewStage,
    offerStage: newOfferStage,
    date: timestamp,
    notes: activities.map(a => a.details).join('; ')
  };

  return {
    ...job,
    applicationStatus: newStatus,
    interviewStage: newInterviewStage,
    offerStage: newOfferStage,
    applicationDate: newStatus === 'applied' && !job.applicationDate ? timestamp : job.applicationDate,
    lastActivityDate: timestamp,
    activityLog: [...(job.activityLog || []), ...activities],
    statusHistory: [...(job.statusHistory || []), statusHistoryEntry]
  };
};

/**
 * Analyzes status history to determine the meaningful journey for analytics
 * Filters out rapid back-and-forth changes and focuses on significant progressions
 */
export const getCleanedStatusJourney = (job: JobDescription) => {
  if (!job.statusHistory || job.statusHistory.length === 0) {
    const currentStatus = job.applicationStatus || 'not_applied';
    const legitimateStatuses = ['applied', 'interviewing', 'rejected', 'offered', 'withdrawn'];
    
    return {
      hasProgressed: legitimateStatuses.includes(currentStatus),
      finalStatus: currentStatus,
      everInterviewed: currentStatus === 'interviewing',
      everRejected: currentStatus === 'rejected',
      everOffered: currentStatus === 'offered',
      statusChangeCount: 0,
      rapidChanges: 0,
      uniqueStatusCount: currentStatus === 'not_applied' ? 0 : 1
    };
  }

  const history = job.statusHistory;
  const currentStatus = job.applicationStatus || 'not_applied';
  
  // Detect rapid changes (multiple changes within 1 hour)
  let rapidChanges = 0;
  for (let i = 1; i < history.length; i++) {
    const timeDiff = new Date(history[i].date).getTime() - new Date(history[i-1].date).getTime();
    if (timeDiff < 60 * 60 * 1000) { // 1 hour in milliseconds
      rapidChanges++;
    }
  }

  // Track unique statuses reached (ignoring rapid back-and-forth)
  const uniqueStatuses = new Set(history.map(h => h.status));
  const everInterviewed = uniqueStatuses.has('interviewing');
  const everRejected = uniqueStatuses.has('rejected');
  const everOffered = uniqueStatuses.has('offered');

  // Determine if this represents a legitimate application attempt
  const legitimateStatuses = ['applied', 'interviewing', 'rejected', 'offered', 'withdrawn'];
  const hasLegitimateProgression = legitimateStatuses.includes(currentStatus) || 
    [...uniqueStatuses].some(status => legitimateStatuses.includes(status));

  return {
    hasProgressed: hasLegitimateProgression,
    finalStatus: currentStatus,
    everInterviewed,
    everRejected,
    everOffered,
    statusChangeCount: history.length,
    rapidChanges,
    uniqueStatusCount: uniqueStatuses.size
  };
};

/**
 * Gets enhanced analytics data that considers status history patterns
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
      notesAdded: 0,
      rapidStatusChanges: 0,
      jobsWithStatusCorrections: 0
    },
    journeyAnalysis: {
      jobsWithMultipleStatusChanges: 0,
      averageStatusChangesPerJob: 0,
      jobsThatReachedInterview: 0,
      jobsThatWereRejected: 0,
      jobsThatWereOffered: 0,
      correctionsDetected: 0
    }
  };

  let totalStatusChanges = 0;
  let totalRapidChanges = 0;
  let jobsWithCorrections = 0;

  // Enhanced analysis using status history
  const journeyData = jobs.map(job => {
    const journey = getCleanedStatusJourney(job);
    
    // Track corrections (rapid changes likely indicate user corrections)
    if (journey.rapidChanges > 0) {
      totalRapidChanges += journey.rapidChanges;
      jobsWithCorrections++;
    }
    
    totalStatusChanges += journey.statusChangeCount;
    
    return { job, journey };
  });

  // Count current status distribution (but flag jobs with corrections)
  journeyData.forEach(({ job, journey }) => {
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

  // Journey analysis (using same legitimate jobs filter)
  const legitimateJourneyData = journeyData.filter(({ job, journey }) => 
    !job.duplicateOfId && 
    job.applicationStatus !== 'duplicate' && 
    journey.hasProgressed
  );

  analytics.journeyAnalysis.jobsWithMultipleStatusChanges = legitimateJourneyData.filter(
    ({ journey }) => journey.statusChangeCount > 1
  ).length;
  
  analytics.journeyAnalysis.averageStatusChangesPerJob = totalStatusChanges / legitimateJourneyData.length || 0;
  
  analytics.journeyAnalysis.jobsThatReachedInterview = legitimateJourneyData.filter(
    ({ journey }) => journey.everInterviewed
  ).length;
  
  analytics.journeyAnalysis.jobsThatWereRejected = legitimateJourneyData.filter(
    ({ journey }) => journey.everRejected
  ).length;
  
  analytics.journeyAnalysis.jobsThatWereOffered = legitimateJourneyData.filter(
    ({ journey }) => journey.everOffered
  ).length;
  
  analytics.activitySummary.rapidStatusChanges = totalRapidChanges;
  analytics.activitySummary.jobsWithStatusCorrections = jobsWithCorrections;
  analytics.journeyAnalysis.correctionsDetected = totalRapidChanges;

  // Calculate proper conversion rates based on meaningful job progressions
  // Only count jobs that actually went through the application process (exclude duplicates, etc.)
  const legitimateJobs = journeyData.filter(({ job, journey }) => 
    !job.duplicateOfId && 
    job.applicationStatus !== 'duplicate' && 
    journey.hasProgressed
  );

  const appliedJobs = legitimateJobs; // All jobs that progressed past not_applied
  const interviewedJobs = legitimateJobs.filter(({ journey }) => journey.everInterviewed);
  const hiredJobs = legitimateJobs.filter(({ journey }) => journey.everOffered);
  const rejectedJobs = legitimateJobs.filter(({ journey }) => journey.everRejected);

  // Applied-based conversion rates (out of all applied jobs)
  if (appliedJobs.length > 0) {
    analytics.conversionRates.appliedToInterview = (interviewedJobs.length / appliedJobs.length) * 100;
    analytics.conversionRates.appliedToHired = (hiredJobs.length / appliedJobs.length) * 100;
    analytics.conversionRates.appliedToRejected = (rejectedJobs.length / appliedJobs.length) * 100;
  }

  // Interview-based conversion rates (out of jobs that reached interview stage)
  // Only count jobs that went from interview to final outcome (not currently interviewing)
  const interviewsWithOutcomes = interviewedJobs.filter(({ journey, job }) => {
    const currentStatus = job.applicationStatus;
    return currentStatus === 'offered' || currentStatus === 'rejected' || currentStatus === 'withdrawn';
  });

  if (interviewsWithOutcomes.length > 0) {
    const interviewToOffered = interviewsWithOutcomes.filter(({ journey }) => journey.everOffered).length;
    const interviewToRejected = interviewsWithOutcomes.filter(({ journey }) => journey.everRejected).length;
    
    analytics.conversionRates.interviewToHired = (interviewToOffered / interviewsWithOutcomes.length) * 100;
    analytics.conversionRates.interviewToRejected = (interviewToRejected / interviewsWithOutcomes.length) * 100;
  } else if (interviewedJobs.length > 0) {
    // If no interviews have concluded yet, show 0% for both
    analytics.conversionRates.interviewToHired = 0;
    analytics.conversionRates.interviewToRejected = 0;
  }

  return analytics;
};

/**
 * Gets funnel analytics showing progression through stages
 * Enhanced to include status correction indicators
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
    archived: 0,
    // Enhanced metrics
    statusCorrections: 0,
    multipleStatusChanges: 0
  };

  jobs.forEach(job => {
    const journey = getCleanedStatusJourney(job);
    
    // Track jobs with corrections
    if (journey.rapidChanges > 0) {
      funnel.statusCorrections++;
    }
    
    if (journey.statusChangeCount > 1) {
      funnel.multipleStatusChanges++;
    }

    // Current status distribution (same as before)
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

/**
 * Gets a human-readable summary of status change issues for a job
 */
export const getStatusChangesSummary = (job: JobDescription): string | null => {
  if (!job.statusHistory || job.statusHistory.length <= 1) {
    return null;
  }

  const journey = getCleanedStatusJourney(job);
  
  if (journey.rapidChanges === 0) {
    return null;
  }

  const corrections = [];
  
  // Find rapid changes
  for (let i = 1; i < job.statusHistory.length; i++) {
    const current = job.statusHistory[i];
    const previous = job.statusHistory[i - 1];
    const timeDiff = new Date(current.date).getTime() - new Date(previous.date).getTime();
    
    if (timeDiff < 60 * 60 * 1000) { // Less than 1 hour
      corrections.push(
        `Changed from ${previous.status} to ${current.status} within ${Math.round(timeDiff / (1000 * 60))} minutes`
      );
    }
  }

  if (corrections.length === 0) {
    return null;
  }

  return `Status corrections detected:\n${corrections.join('\n')}\n\nThis may indicate accidental status changes that could affect analytics accuracy.`;
};

/**
 * Cleans up rapid status changes in a job's history
 * Removes status changes that were reversed within 1 hour (likely corrections)
 * Returns a cleaned version of the job
 */
export const cleanStatusHistory = (job: JobDescription): JobDescription => {
  if (!job.statusHistory || job.statusHistory.length <= 1) {
    return job;
  }

  const cleanedHistory = [];
  const cleanedActivityLog = job.activityLog ? [...job.activityLog] : [];
  
  for (let i = 0; i < job.statusHistory.length; i++) {
    const current = job.statusHistory[i];
    const next = job.statusHistory[i + 1];
    
    // If this is the last entry, always keep it
    if (!next) {
      cleanedHistory.push(current);
      continue;
    }
    
    // Check if the next change happens within 1 hour and reverts this change
    const timeDiff = new Date(next.date).getTime() - new Date(current.date).getTime();
    const isRapidReversal = timeDiff < 60 * 60 * 1000;
    
    if (isRapidReversal) {
      // Skip this entry (it's likely a correction)
      // Also remove corresponding activity log entries
      const currentTime = current.date;
      for (let j = cleanedActivityLog.length - 1; j >= 0; j--) {
        if (cleanedActivityLog[j].timestamp === currentTime && 
            cleanedActivityLog[j].type === 'status_change') {
          cleanedActivityLog.splice(j, 1);
        }
      }
    } else {
      cleanedHistory.push(current);
    }
  }
  
  return {
    ...job,
    statusHistory: cleanedHistory,
    activityLog: cleanedActivityLog
  };
};

/**
 * Cleans all jobs with rapid status changes
 * Returns array of cleaned jobs
 */
export const cleanAllJobsStatusHistory = (jobs: JobDescription[]): JobDescription[] => {
  return jobs.map(job => {
    const journey = getCleanedStatusJourney(job);
    return journey.rapidChanges > 0 ? cleanStatusHistory(job) : job;
  });
};

/**
 * Log an action completion to a job's activity log
 */
export const logActionCompletion = (
  job: JobDescription,
  completion: ActionCompletion
): JobDescription => {
  const activityEntry: ActivityLogEntry = {
    id: generateActivityId(),
    timestamp: new Date().toISOString(),
    type: 'action_completed',
    actionType: completion.actionType,
    actionDetails: `${getCompletionTypeLabel(completion.completionType)}${completion.notes ? `: ${completion.notes}` : ''}`,
    details: `Completed ${getActionTypeLabel(completion.actionType)} via ${getCompletionTypeLabel(completion.completionType)}`
  };

  const updatedJob = {
    ...job,
    activityLog: [...(job.activityLog || []), activityEntry],
    lastActivityDate: completion.date,
    completedActions: {
      ...job.completedActions,
      [completion.actionType]: completion.date
    }
  };

  return updatedJob;
};

/**
 * Get human-readable label for action types
 */
export const getActionTypeLabel = (actionType: string): string => {
  switch (actionType) {
    case 'followup': return 'follow-up';
    case 'thankyou': return 'thank you note';
    case 'status_check': return 'status check';
    case 'decision_check': return 'decision timeline check';
    default: return actionType;
  }
};

/**
 * Get human-readable label for completion types
 */
export const getCompletionTypeLabel = (completionType: string): string => {
  switch (completionType) {
    case 'email': return 'email';
    case 'phone': return 'phone call';
    case 'linkedin': return 'LinkedIn message';
    case 'text': return 'text message';
    case 'in_person': return 'in-person conversation';
    case 'other': return 'other method';
    default: return completionType;
  }
};

/**
 * Calculate delay for next reminder based on action type and completion
 */
export const calculateReminderDelay = (actionType: string, completionType: string): number => {
  // Return delay in days
  const baseDelays = {
    followup: 14,     // 2 weeks before next follow-up reminder
    thankyou: 999,    // Don't remind about thank you notes again (one-time action)
    status_check: 10, // 10 days before next status check
    decision_check: 7 // 1 week before next decision timeline request
  };

  const completionMultipliers = {
    email: 1.0,       // Standard delay
    phone: 1.2,       // Slightly longer (more personal)
    linkedin: 0.9,    // Slightly shorter (less formal)
    text: 0.8,        // Shorter (casual)
    in_person: 1.5,   // Longer (most personal)
    other: 1.0        // Standard
  };

  const baseDelay = baseDelays[actionType as keyof typeof baseDelays] || 7;
  const multiplier = completionMultipliers[completionType as keyof typeof completionMultipliers] || 1.0;

  return Math.round(baseDelay * multiplier);
};

/**
 * Check if enough time has passed since last action for new reminders
 */
export const shouldShowReminder = (
  actionType: string,
  job: JobDescription,
  currentDate: Date = new Date()
): boolean => {
  const completedActions = job.completedActions || {};
  const lastCompletedDate = completedActions[actionType as keyof typeof completedActions];
  
  if (!lastCompletedDate) return true;

  const lastDate = new Date(lastCompletedDate);
  const daysSince = Math.ceil((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const minDelays = {
    followup: 7,        // At least 1 week between follow-ups
    thankyou: 999,      // Never remind again (one-time action)
    status_check: 5,    // At least 5 days between status checks
    decision_check: 7,  // At least 1 week between decision requests
    offer_response: 1   // Daily reminders for offer responses (urgent!)
  };

  const minDelay = minDelays[actionType as keyof typeof minDelays] || 7;
  return daysSince >= minDelay;
};