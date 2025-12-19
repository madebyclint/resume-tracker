import { JobDescription } from '../types';

// Helper functions to extract min/max from salary ranges
export const extractSalaryMin = (salaryRange: string): string => {
  const match = salaryRange.match(/\$?([\d,]+)k?/i);
  if (!match) return '';
  let value = match[1].replace(/,/g, '');
  // If the original match included 'k', multiply by 1000
  if (match[0].toLowerCase().includes('k')) {
    value = (parseInt(value) * 1000).toString();
  }
  return value;
};

export const extractSalaryMax = (salaryRange: string): string => {
  const matches = salaryRange.match(/\$?([\d,]+)k?\s*-\s*\$?([\d,]+)k?/i);
  if (!matches || !matches[2]) return '';
  let value = matches[2].replace(/,/g, '');
  // If the original match included 'k', multiply by 1000
  if (matches[0].toLowerCase().includes('k')) {
    value = (parseInt(value) * 1000).toString();
  }
  return value;
};

// Format currency for display
export const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

// Helper function to get impact icon
export const getImpactIcon = (impact: string | undefined) => {
  if (!impact) return null;
  switch (impact.toLowerCase()) {
    case 'high': return 'faFire';
    case 'medium': return 'faThumbsUp'; 
    case 'low': return 'faMinus';
    default: return null;
  }
};

// Helper function to get impact color
export const getImpactColor = (impact: string | undefined): string => {
  if (!impact) return '#6c757d';
  switch (impact.toLowerCase()) {
    case 'high': return '#dc3545';
    case 'medium': return '#28a745';
    case 'low': return '#6c757d';
    default: return '#6c757d';
  }
};

// Simple hash function for text content
export const createTextHash = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

// Check if job needs parsing (substantial content but lacks AI processing)
export const needsAIParsing = (job: JobDescription): boolean => {
  const lacksAIUsage = !job.aiUsage || !job.aiUsage.totalTokens;
  const lacksSequentialId = !job.sequentialId;
  const hasMinimalExtractedInfo = !job.extractedInfo.role && !job.extractedInfo.companyDescription;

  // Only consider jobs with substantial raw text content that haven't been AI processed
  return !!(job.rawText && job.rawText.trim().length > 100 && lacksAIUsage && lacksSequentialId);
};

// Helper function to calculate AI costs (OpenAI GPT-3.5/4 pricing)
export const calculateAICost = (usage: { promptTokens: number; completionTokens: number; totalTokens: number }): number => {
  // OpenAI GPT-3.5-turbo pricing (as of Dec 2025): $0.001 per 1K input tokens, $0.002 per 1K output tokens
  // GPT-4 pricing: $0.01 per 1K input tokens, $0.03 per 1K output tokens
  // Using GPT-3.5 rates as default - adjust based on your model usage
  const inputCostPer1K = 0.001;
  const outputCostPer1K = 0.002;

  const inputCost = (usage.promptTokens / 1000) * inputCostPer1K;
  const outputCost = (usage.completionTokens / 1000) * outputCostPer1K;

  return inputCost + outputCost;
};

// Estimate cost for token usage
export const estimateCost = (usage: { promptTokens: number; completionTokens: number }): string => {
  const cost = calculateAICost({ 
    ...usage, 
    totalTokens: usage.promptTokens + usage.completionTokens 
  });
  return cost.toFixed(4);
};