import { JobDescription } from '../types';

export type SnarkLevel = 'gentle' | 'medium' | 'savage';
export type ActionType = 'followup' | 'thankyou' | 'status_check' | 'decision_check';
export type AgingCategory = 'fresh' | 'followup' | 'stale' | 'cold';

export interface ActionItem {
  id: string;
  jobId: string;
  company: string;
  actionType: ActionType;
  urgency: 'low' | 'medium' | 'high';
  message: string;
  daysSince: number;
  canSnooze: boolean;
}

export interface AgingStats {
  fresh: number;    // 0-3 days
  followup: number; // 4-14 days  
  stale: number;    // 15-30 days
  cold: number;     // 30+ days
}

export interface ReminderSettings {
  snarkLevel: SnarkLevel;
  notificationTime: string; // HH:mm format
  dailyNotifications: boolean;
  weeklyNotifications: boolean;
  followupReminderDays: number;
  thankYouReminderDays: number;
  decisionCheckDays: number;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  snarkLevel: 'gentle',
  notificationTime: '09:00',
  dailyNotifications: true,
  weeklyNotifications: false,
  followupReminderDays: 7,
  thankYouReminderDays: 2,
  decisionCheckDays: 10
};

/**
 * Calculate aging category based on days since most recent activity
 */
export const getAgingCategory = (daysSince: number): AgingCategory => {
  if (daysSince <= 3) return 'fresh';
  if (daysSince <= 14) return 'followup';
  if (daysSince <= 30) return 'stale';
  return 'cold';
};

/**
 * Calculate aging statistics for all jobs
 */
export const calculateAgingStats = (jobs: JobDescription[]): AgingStats => {
  const stats: AgingStats = { fresh: 0, followup: 0, stale: 0, cold: 0 };
  
  jobs.forEach(job => {
    // Skip archived and duplicate jobs
    if (job.isArchived || job.applicationStatus === 'archived' || 
        job.applicationStatus === 'duplicate' || job.duplicateOfId) {
      return;
    }
    
    // Calculate days since most recent activity
    const applicationDate = job.applicationDate ? new Date(job.applicationDate) : null;
    const lastActivityDate = job.lastActivityDate ? new Date(job.lastActivityDate) : null;
    const mostRecentDate = lastActivityDate && applicationDate ? 
      (lastActivityDate > applicationDate ? lastActivityDate : applicationDate) :
      lastActivityDate || applicationDate;
    
    if (mostRecentDate) {
      const daysSince = Math.ceil((new Date().getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24));
      const category = getAgingCategory(daysSince);
      stats[category]++;
    }
  });
  
  return stats;
};

/**
 * Generate snark messages based on level and context
 */
export const generateSnarkMessage = (
  actionType: ActionType,
  company: string,
  daysSince: number,
  snarkLevel: SnarkLevel,
  status: JobDescription['applicationStatus']
): string => {
  const messages = {
    followup: {
      gentle: [
        `Consider following up on your ${company} application (${daysSince} days)`,
        `Time for a polite follow-up with ${company}`,
        `${company} might appreciate a status check`
      ],
      medium: [
        `Your ${company} app is getting dusty - maybe send a follow-up?`,
        `${company} probably forgot you exist. Remind them!`,
        `${daysSince} days of silence from ${company}. Time to poke them?`
      ],
      savage: [
        `${company} applied ${daysSince} days ago. They've forgotten you exist. DO SOMETHING.`,
        `Your ${company} application is collecting digital dust. Wake them up!`,
        `${daysSince} days and counting. Either ${company} is dead or you are.`
      ]
    },
    thankyou: {
      gentle: [
        `Thank you note recommended for ${company} interview`,
        `A follow-up thank you to ${company} would be thoughtful`,
        `Consider sending appreciation to ${company}`
      ],
      medium: [
        `${company}'s probably wondering if you fell off the earth. Send that thank you!`,
        `Thank you note to ${company} is overdue. They're judging you.`,
        `${company} interview was ${daysSince} days ago. Where's the gratitude?`
      ],
      savage: [
        `${company} interview was ${daysSince} days ago. Did you ghost them like your last relationship?`,
        `No thank you note to ${company}? They think you're rude now.`,
        `${daysSince} days without thanking ${company}. Your mother would be ashamed.`
      ]
    },
    status_check: {
      gentle: [
        `Check in on your ${company} application status`,
        `Worth asking ${company} about next steps`,
        `Follow up on timing with ${company}`
      ],
      medium: [
        `${company} owes you an update after ${daysSince} days`,
        `Time to ask ${company} what's taking so long`,
        `${daysSince} days of limbo with ${company}. Demand answers!`
      ],
      savage: [
        `${company} has kept you waiting ${daysSince} days. Make them explain themselves.`,
        `${daysSince} days and no word from ${company}? They're being rude.`,
        `Either ${company} is testing your patience or they're just disorganized. Find out which.`
      ]
    },
    decision_check: {
      gentle: [
        `Consider asking ${company} about their decision timeline`,
        `Worth checking on next steps with ${company}`,
        `Follow up on the decision process with ${company}`
      ],
      medium: [
        `${company} should give you a timeline after ${daysSince} days`,
        `Time to ask ${company} when they'll make a decision`,
        `${daysSince} days in limbo. Get a timeline from ${company}!`
      ],
      savage: [
        `${company} has strung you along for ${daysSince} days. Demand a timeline.`,
        `${daysSince} days without a decision from ${company}? They're being unprofessional.`,
        `Either ${company} wants you or they don't. Make them pick after ${daysSince} days.`
      ]
    }
  };

  const options = messages[actionType][snarkLevel];
  return options[Math.floor(Math.random() * options.length)];
};

/**
 * Generate action items for jobs that need attention
 */
export const generateActionItems = (
  jobs: JobDescription[],
  settings: ReminderSettings = DEFAULT_SETTINGS
): ActionItem[] => {
  const actions: ActionItem[] = [];
  const now = new Date();

  jobs.forEach(job => {
    // Skip archived, duplicate, rejected, or withdrawn jobs
    if (job.isArchived || job.applicationStatus === 'archived' || 
        job.applicationStatus === 'duplicate' || job.duplicateOfId ||
        job.applicationStatus === 'rejected' || job.applicationStatus === 'withdrawn') {
      return;
    }

    const applicationDate = job.applicationDate ? new Date(job.applicationDate) : null;
    const lastActivityDate = job.lastActivityDate ? new Date(job.lastActivityDate) : null;
    
    // Check if action was completed or snoozed
    const completedActions = job.completedActions || {};
    const snoozedUntil = job.snoozedUntil || {};

    // Calculate days since application and last activity
    const daysSinceApplication = applicationDate ? 
      Math.ceil((now.getTime() - applicationDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const daysSinceActivity = lastActivityDate ? 
      Math.ceil((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)) : daysSinceApplication;

    // Check for follow-up needed (applied status)
    if (job.applicationStatus === 'applied') {
      const lastFollowup = completedActions.followup;
      const daysSinceLastFollowup = lastFollowup ? 
        Math.ceil((now.getTime() - new Date(lastFollowup).getTime()) / (1000 * 60 * 60 * 24)) : daysSinceApplication;
      
      const followupInterval = lastFollowup ? settings.followupReminderDays * 2 : settings.followupReminderDays; // Slower re-reminding
      
      if (daysSinceLastFollowup >= followupInterval && !isActionSnoozed('followup', job.id, snoozedUntil)) {
        actions.push({
          id: `${job.id}_followup`,
          jobId: job.id,
          company: job.company,
          actionType: 'followup',
          urgency: daysSinceLastFollowup > 14 ? 'high' : daysSinceLastFollowup > 7 ? 'medium' : 'low',
          message: generateSnarkMessage('followup', job.company, daysSinceLastFollowup, settings.snarkLevel, job.applicationStatus),
          daysSince: daysSinceLastFollowup,
          canSnooze: true
        });
      }
    }

    // Check for thank you note needed (interviewing status)
    if (job.applicationStatus === 'interviewing') {
      const lastThankYou = completedActions.thankyou;
      const daysSinceLastActivity = Math.ceil((now.getTime() - (lastActivityDate || applicationDate || now).getTime()) / (1000 * 60 * 60 * 24));
      
      if (!lastThankYou && daysSinceLastActivity >= settings.thankYouReminderDays && 
          !isActionSnoozed('thankyou', job.id, snoozedUntil)) {
        actions.push({
          id: `${job.id}_thankyou`,
          jobId: job.id,
          company: job.company,
          actionType: 'thankyou',
          urgency: daysSinceLastActivity > 5 ? 'high' : 'medium',
          message: generateSnarkMessage('thankyou', job.company, daysSinceLastActivity, settings.snarkLevel, job.applicationStatus),
          daysSince: daysSinceLastActivity,
          canSnooze: true
        });
      }

      // Check for decision timeline request
      const lastDecisionCheck = completedActions.decision_check;
      const daysSinceLastDecisionCheck = lastDecisionCheck ? 
        Math.ceil((now.getTime() - new Date(lastDecisionCheck).getTime()) / (1000 * 60 * 60 * 24)) : daysSinceLastActivity;
      
      const decisionInterval = lastDecisionCheck ? settings.decisionCheckDays * 1.5 : settings.decisionCheckDays; // Slower re-reminding
      
      if (daysSinceLastDecisionCheck >= decisionInterval && !isActionSnoozed('decision_check', job.id, snoozedUntil)) {
        actions.push({
          id: `${job.id}_decision`,
          jobId: job.id,
          company: job.company,
          actionType: 'decision_check',
          urgency: daysSinceLastDecisionCheck > 14 ? 'high' : 'medium',
          message: generateSnarkMessage('decision_check', job.company, daysSinceLastDecisionCheck, settings.snarkLevel, job.applicationStatus),
          daysSince: daysSinceLastDecisionCheck,
          canSnooze: true
        });
      }
    }
  });

  // Sort by urgency and days
  return actions.sort((a, b) => {
    const urgencyOrder = { high: 3, medium: 2, low: 1 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    }
    return b.daysSince - a.daysSince;
  });
};

/**
 * Check if an action is currently snoozed
 */
const isActionSnoozed = (actionType: ActionType, jobId: string, snoozedUntil: Record<string, string>): boolean => {
  const snoozeKey = `${jobId}_${actionType}`;
  const snoozeDate = snoozedUntil[snoozeKey];
  if (!snoozeDate) return false;
  
  return new Date(snoozeDate) > new Date();
};

/**
 * Mark an action as completed
 */
export const markActionCompleted = (job: JobDescription, actionType: ActionType): JobDescription => {
  const timestamp = new Date().toISOString();
  
  return {
    ...job,
    completedActions: {
      ...job.completedActions,
      [actionType]: timestamp
    },
    lastActivityDate: timestamp
  };
};

/**
 * Snooze an action for a specified number of days
 */
export const snoozeAction = (job: JobDescription, actionType: ActionType, days: number): JobDescription => {
  const snoozeUntil = new Date();
  snoozeUntil.setDate(snoozeUntil.getDate() + days);
  
  const snoozeKey = `${job.id}_${actionType}`;
  
  return {
    ...job,
    snoozedUntil: {
      ...job.snoozedUntil,
      [snoozeKey]: snoozeUntil.toISOString()
    }
  };
};

/**
 * Get default reminder settings
 */
export const getDefaultSettings = (): ReminderSettings => DEFAULT_SETTINGS;

/**
 * Load reminder settings from storage (placeholder - implement based on your storage system)
 */
export const loadReminderSettings = (): ReminderSettings => {
  try {
    const stored = localStorage.getItem('reminderSettings');
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Failed to load reminder settings:', error);
  }
  return DEFAULT_SETTINGS;
};

/**
 * Save reminder settings to storage
 */
export const saveReminderSettings = (settings: ReminderSettings): void => {
  try {
    localStorage.setItem('reminderSettings', JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save reminder settings:', error);
  }
};