import { useMemo } from 'react';
import { JobDescription } from '../types';
import { calculateAICost } from '../utils/jobDescriptionHelpers';

interface StatsData {
  // Basic status stats (for compatibility)
  stats: {
    not_applied: number;
    applied: number;
    interviewing: number;
    rejected: number;
    offered: number;
    withdrawn: number;
  };
  
  // Individual status counts
  not_applied: number;
  applied: number;
  interviewing: number;
  rejected: number;
  offered: number;
  withdrawn: number;
  total: number;
  totalApplications: number;
  
  // Time-based stats
  daysSinceFirst: number;
  avgPerDay: string;
  
  // Advanced analytics
  impactStats: {
    low: number;
    medium: number;
    high: number;
  };
  impactRatio: string;
  
  aiStats: {
    totalTokens: number;
    totalCost: number;
    parseCount: number;
    jobsWithAI: number;
  };
  
  firstJobDate: Date;
  
  // Chart data
  dailyData: Array<{
    date: string;
    count: number;
    displayDate: string;
  }>;
  
  weeklyData: Array<{
    week: string;
    count: number;
    startDate: string;
    endDate: string;
    displayWeek: string;
  }>;
  
  weeklyStats: Array<{
    week: string;
    applied: number;
    rejected: number;
    interviewing: number;
    offered: number;
  }>;
  
  monthlyStats: Array<{
    month: string;
    applied: number;
    rejected: number;
    interviewing: number;
    offered: number;
  }>;
}

export const useJobAnalytics = (jobDescriptions: JobDescription[]): StatsData => {
  return useMemo(() => {
    // Filter active jobs for stats (exclude archived and duplicate JDs)
    const activeJobs = jobDescriptions.filter(job => {
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
    let jobsWithDates: JobDescription[] = [];
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
    const now = new Date();
    const daysSinceFirst = Math.ceil((now.getTime() - firstJobDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeksSinceFirst = Math.ceil(daysSinceFirst / 7);

    // Generate weekly stats for last 12 weeks or since first job (whichever is shorter)
    const weeksToShow = Math.min(12, weeksSinceFirst);
    const weeklyStats = [];
    
    for (let i = weeksToShow - 1; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7) - 6);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      const weekJobs = activeJobs.filter(job => {
        const jobDate = new Date(job.applicationDate || job.uploadDate);
        return jobDate >= weekStart && jobDate <= weekEnd;
      });

      weeklyStats.push({
        week: weekLabel,
        applied: weekJobs.filter(j => j.applicationStatus === 'applied').length,
        rejected: weekJobs.filter(j => j.applicationStatus === 'rejected').length,
        interviewing: weekJobs.filter(j => j.applicationStatus === 'interviewing').length,
        offered: weekJobs.filter(j => j.applicationStatus === 'offered').length
      });
    }

    // Generate monthly stats for last 6 months
    const monthlyStats = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const monthJobs = activeJobs.filter(job => {
        const jobDate = new Date(job.applicationDate || job.uploadDate);
        return jobDate >= monthStart && jobDate <= monthEnd;
      });

      monthlyStats.push({
        month: monthLabel,
        applied: monthJobs.filter(j => j.applicationStatus === 'applied').length,
        rejected: monthJobs.filter(j => j.applicationStatus === 'rejected').length,
        interviewing: monthJobs.filter(j => j.applicationStatus === 'interviewing').length,
        offered: monthJobs.filter(j => j.applicationStatus === 'offered').length
      });
    }

    const daysSinceFirst = Math.floor((new Date().getTime() - firstJobDate.getTime()) / (1000 * 60 * 60 * 24));
    const avgPerDay = daysSinceFirst > 0 ? (total / daysSinceFirst).toFixed(2) : '0';
    const totalApplications = stats.applied + stats.interviewing + stats.rejected + stats.offered + stats.withdrawn;
    const totalWithImpact = impactStats.low + impactStats.medium + impactStats.high;
    const impactRatio = totalWithImpact > 0 ? ((impactStats.high / totalWithImpact) * 100).toFixed(0) : '0';
    
    // Daily velocity data for chart (last 14 days)
    const dailyData = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = activeJobs.filter(job => {
        const applicationDate = job.applicationDate?.split('T')[0];
        const status = job.applicationStatus || 'not_applied';
        return applicationDate === dateStr && status !== 'not_applied';
      }).length;
      dailyData.push({ date: dateStr, count, displayDate: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) });
    }

    // Weekly velocity data for chart (last 8 weeks)
    const weeklyData = [];
    for (let i = 7; i >= 0; i--) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - (i * 7));
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);

      const count = activeJobs.filter(job => {
        if (!job.applicationDate) return false;
        const status = job.applicationStatus || 'not_applied';
        if (status === 'not_applied') return false;
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
      // Individual status stats
      ...stats,
      // Backward compatibility stats object
      stats,
      total,
      totalApplications,
      daysSinceFirst,
      avgPerDay,
      impactStats,
      impactRatio,
      aiStats,
      firstJobDate,
      dailyData,
      weeklyData,
      weeklyStats,
      monthlyStats
    };
  }, [jobDescriptions]);
};