import { JobDescription } from '../types';
import { shouldShowReminder } from './activityLogger';

export type SnarkLevel = 'gentle' | 'medium' | 'savage';
export type ActionType = 'followup' | 'thankyou' | 'status_check' | 'decision_check' | 'offer_response';
export type AgingCategory = 'fresh' | 'followup' | 'stale' | 'cold';

export interface ActionItem {
  id: string;
  jobId: string;
  company: string;
  actionType: ActionType;
  urgency: 'low' | 'medium' | 'high';
  message: string;
  suggestions: string[];
  currentSuggestionIndex: number;
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
 * Generate actionable suggestions for each action type
 */
export const generateActionSuggestions = (
  actionType: ActionType,
  company: string,
  status: JobDescription['applicationStatus']
): string[] => {
  const suggestions = {
    followup: [
      `Send a polite email: "Hi [Name], I wanted to follow up on my application for [Position]. I'm still very interested and would love to discuss how I can contribute to [Company]."`,
      `Connect with the hiring manager on LinkedIn and send a brief message about your continued interest`,
      `Call their main number and ask to speak with HR about your application status`,
      `Check if they have a careers portal where you can message the recruiter directly`,
      `Research the company's recent news and reference it in your follow-up: "I saw [Company] just announced [news]. This makes me even more excited about the [Position] role."`,
      `Send a brief video message through LinkedIn or email introducing yourself and reiterating your interest`
    ],
    thankyou: [
      `Send within 24 hours: "Thank you for taking the time to meet with me today. I enjoyed learning about [specific topic discussed] and am excited about the opportunity to [specific contribution]."`,
      `Email each interviewer individually with personalized notes referencing your conversation`,
      `Connect with interviewers on LinkedIn with a thank you message`,
      `Send a handwritten note if you have their mailing address (extra points for thoughtfulness)`,
      `Include a relevant article or resource: "I came across this article about [topic we discussed] and thought you might find it interesting."`,
      `Reiterate a key point from the interview: "After our conversation about [challenge], I'm even more confident I can help [Company] achieve [specific goal]."`
    ],
    status_check: [
      `Email: "I hope this email finds you well. I wanted to check in regarding the [Position] role. Could you provide an update on the timeline for next steps?"`,
      `Call directly: "Hi, this is [Name]. I interviewed for [Position] on [Date] and wanted to check on the status of my application."`,
      `Ask about their decision timeline: "When should I expect to hear about next steps in the process?"`,
      `Request feedback if it's been over 2 weeks: "If possible, I'd appreciate any feedback on my interview performance."`,
      `Show continued enthusiasm: "I wanted to reiterate my strong interest in the [Position] role and see if there's any additional information I can provide."`,
      `Reference something specific: "I've been thinking more about our conversation regarding [specific topic] and have some additional ideas I'd love to share."`
    ],
    decision_check: [
      `Ask directly: "Could you share the expected timeline for making a final decision on this role?"`,
      `Inquire about next steps: "What are the remaining steps in your hiring process?"`,
      `Show continued interest: "I remain very interested in this position. Is there any additional information I can provide to help with your decision?"`,
      `Set a follow-up date: "Should I plan to follow up again in a week if I haven't heard back?"`,
      `Offer to provide references: "I'd be happy to provide additional references or work samples if that would be helpful for your decision."`,
      `Express flexibility: "I'm flexible with start dates and would be happy to discuss any concerns or questions about my candidacy."`
    ],
    offer_response: [
      `Express gratitude: "Thank you for the offer! I'm excited about the opportunity to join [Company]."`,
      `Ask for details: "Could you provide more details about the compensation package, benefits, and start date?"`,
      `Request time to decide: "I'd appreciate [X days/week] to consider the offer and discuss with my family."`,
      `Negotiate respectfully: "Based on my research and experience, I was hoping for a salary closer to [amount]. Is there flexibility?"`,
      `Clarify terms: "Could we review the job responsibilities, reporting structure, and growth opportunities?"`,
      `Express concerns diplomatically: "I'm very interested, but have some questions about [specific aspect]. Could we discuss?"`
    ]
  };

  return suggestions[actionType];
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
    },
    offer_response: {
      gentle: [
        `You have an offer from ${company} - time to respond thoughtfully`,
        `Consider your response to ${company}'s offer`,
        `${company} is waiting for your decision on their offer`
      ],
      medium: [
        `${company} made you an offer ${daysSince} days ago. Don't leave them hanging!`,
        `Time to respond to ${company}'s offer - they need an answer`,
        `${daysSince} days to think about ${company}'s offer. Decision time!`
      ],
      savage: [
        `${company} offered you a job ${daysSince} days ago. Stop overthinking and respond!`,
        `${daysSince} days of radio silence on ${company}'s offer? They think you're not interested.`,
        `${company} is probably rescinding their offer after ${daysSince} days of no response. ACT NOW.`
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
      const shouldShow = shouldShowReminder('followup', job);
      const isNotSnoozed = !isActionSnoozed('followup', job.id, snoozedUntil);
      const daysSinceLastFollowup = Math.ceil((now.getTime() - (lastActivityDate || applicationDate || now).getTime()) / (1000 * 60 * 60 * 24));
      
      // Ensure we show reminders for jobs in the follow-up category (4-14 days)
      const shouldShowBasedOnAge = daysSinceLastFollowup >= 4;
      
      if ((shouldShow || shouldShowBasedOnAge) && isNotSnoozed && daysSinceLastFollowup >= 1) {
        actions.push({
          id: `${job.id}_followup`,
          jobId: job.id,
          company: job.company,
          actionType: 'followup',
          urgency: daysSinceLastFollowup > 14 ? 'high' : daysSinceLastFollowup > 7 ? 'medium' : 'low',
          message: generateSnarkMessage('followup', job.company, daysSinceLastFollowup, settings.snarkLevel, job.applicationStatus),
          suggestions: generateActionSuggestions('followup', job.company, job.applicationStatus),
          currentSuggestionIndex: 0,
          daysSince: daysSinceLastFollowup,
          canSnooze: true
        });
      }
    }

    // Check for thank you note needed (interviewing status)
    if (job.applicationStatus === 'interviewing') {
      if (shouldShowReminder('thankyou', job) && !isActionSnoozed('thankyou', job.id, snoozedUntil)) {
        const daysSinceLastActivity = Math.ceil((now.getTime() - (lastActivityDate || applicationDate || now).getTime()) / (1000 * 60 * 60 * 24));
        actions.push({
          id: `${job.id}_thankyou`,
          jobId: job.id,
          company: job.company,
          actionType: 'thankyou',
          urgency: daysSinceLastActivity > 5 ? 'high' : 'medium',
          message: generateSnarkMessage('thankyou', job.company, daysSinceLastActivity, settings.snarkLevel, job.applicationStatus),
          suggestions: generateActionSuggestions('thankyou', job.company, job.applicationStatus),
          currentSuggestionIndex: 0,
          daysSince: daysSinceLastActivity,
          canSnooze: true
        });
      }

      // Check for decision timeline request
      if (shouldShowReminder('decision_check', job) && !isActionSnoozed('decision_check', job.id, snoozedUntil)) {
        const daysSinceLastActivity = Math.ceil((now.getTime() - (lastActivityDate || applicationDate || now).getTime()) / (1000 * 60 * 60 * 24));
        actions.push({
          id: `${job.id}_decision`,
          jobId: job.id,
          company: job.company,
          actionType: 'decision_check',
          urgency: daysSinceLastActivity > 14 ? 'high' : 'medium',
          message: generateSnarkMessage('decision_check', job.company, daysSinceLastActivity, settings.snarkLevel, job.applicationStatus),
          suggestions: generateActionSuggestions('decision_check', job.company, job.applicationStatus),
          currentSuggestionIndex: 0,
          daysSince: daysSinceLastActivity,
          canSnooze: true
        });
      }
    }

    // Check for offer response needed (offered status)
    if (job.applicationStatus === 'offered') {
      // For offers, check if they need to respond based on offer stage
      if (job.offerStage === 'received' || job.offerStage === 'considering') {
        if (shouldShowReminder('offer_response', job) && !isActionSnoozed('offer_response', job.id, snoozedUntil)) {
          const daysSinceLastActivity = Math.ceil((now.getTime() - (lastActivityDate || applicationDate || now).getTime()) / (1000 * 60 * 60 * 24));
          const urgency = daysSinceLastActivity > 7 ? 'high' : daysSinceLastActivity > 3 ? 'medium' : 'low';
          
          actions.push({
            id: `${job.id}_offer_response`,
            jobId: job.id,
            company: job.company,
            actionType: 'offer_response',
            urgency: urgency,
            message: generateSnarkMessage('offer_response', job.company, daysSinceLastActivity, settings.snarkLevel, job.applicationStatus),
            suggestions: generateActionSuggestions('offer_response', job.company, job.applicationStatus),
            currentSuggestionIndex: 0,
            daysSince: daysSinceLastActivity,
            canSnooze: true
          });
        }
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