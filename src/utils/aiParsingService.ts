import { JobDescription } from '../types';
import { parseJobDescription } from './aiService';
import { createTextHash } from './jobDescriptionHelpers';

// Smart AI parsing function that avoids duplicate calls
export const smartParseJobDescription = async (
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

  if (result.success) {
    // Cache the result
    cache.set(cacheKey, {
      result: {
        success: true,
        extractedInfo: result.extractedInfo,
        keywords: result.keywords,
        usage: result.usage
      },
      timestamp: Date.now()
    });
    setCache(new Map(cache));

    return result;
  }

  return { success: false, error: result.error };
};