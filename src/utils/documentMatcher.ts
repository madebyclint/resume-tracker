import { Resume, CoverLetter, JobDescription } from '../types';

export interface DocumentMatch {
  documentId: string;
  documentName: string;
  documentType: 'resume' | 'cover_letter';
  matchScore: number;
  matchedKeywords: string[];
  skillMatches: string[];
  contentSimilarity: number;
}

/**
 * Calculate similarity between job description and documents (resumes/cover letters)
 */
export function calculateDocumentMatches(
  jobDescription: JobDescription,
  resumes: Resume[],
  coverLetters: CoverLetter[]
): DocumentMatch[] {
  const allMatches: DocumentMatch[] = [];

  // Calculate matches for resumes
  resumes.forEach(resume => {
    const match = calculateSingleDocumentMatch(
      jobDescription,
      resume,
      'resume',
      resume.textContent || ''
    );
    if (match.matchScore > 0) {
      allMatches.push(match);
    }
  });

  // Calculate matches for cover letters
  coverLetters.forEach(coverLetter => {
    const match = calculateSingleDocumentMatch(
      jobDescription,
      coverLetter,
      'cover_letter',
      coverLetter.textContent || ''
    );
    if (match.matchScore > 0) {
      allMatches.push(match);
    }
  });

  // Sort by match score descending
  return allMatches.sort((a, b) => b.matchScore - a.matchScore);
}

function calculateSingleDocumentMatch(
  jobDescription: JobDescription,
  document: Resume | CoverLetter,
  documentType: 'resume' | 'cover_letter',
  documentText: string
): DocumentMatch {
  const documentTextLower = documentText.toLowerCase();
  const jobKeywords = jobDescription.keywords.map(k => k.toLowerCase());
  const requiredSkills = jobDescription.extractedInfo.requiredSkills.map(s => s.toLowerCase());
  const preferredSkills = jobDescription.extractedInfo.preferredSkills.map(s => s.toLowerCase());

  // Find keyword matches
  const matchedKeywords: string[] = [];
  jobKeywords.forEach(keyword => {
    if (documentTextLower.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  });

  // Find skill matches (both required and preferred)
  const skillMatches: string[] = [];
  [...requiredSkills, ...preferredSkills].forEach(skill => {
    if (documentTextLower.includes(skill)) {
      skillMatches.push(skill);
    }
  });

  // Calculate various scores
  const keywordScore = matchedKeywords.length / jobKeywords.length;
  const requiredSkillScore = requiredSkills.filter(skill => 
    documentTextLower.includes(skill)
  ).length / Math.max(requiredSkills.length, 1);
  
  const preferredSkillScore = preferredSkills.filter(skill => 
    documentTextLower.includes(skill)
  ).length / Math.max(preferredSkills.length, 1);

  // Calculate content similarity using simple word overlap
  const contentSimilarity = calculateContentSimilarity(
    jobDescription.rawText.toLowerCase(),
    documentTextLower
  );

  // Weighted final score
  const matchScore = 
    keywordScore * 0.4 +           // 40% weight for keywords
    requiredSkillScore * 0.3 +     // 30% weight for required skills
    preferredSkillScore * 0.2 +    // 20% weight for preferred skills
    contentSimilarity * 0.1;       // 10% weight for content similarity

  return {
    documentId: document.id,
    documentName: document.name,
    documentType,
    matchScore,
    matchedKeywords: [...new Set(matchedKeywords)], // Remove duplicates
    skillMatches: [...new Set(skillMatches)],       // Remove duplicates
    contentSimilarity
  };
}

function calculateContentSimilarity(jobText: string, documentText: string): number {
  // Simple word-based similarity calculation
  const jobWords = new Set(
    jobText.split(/\s+/)
      .filter(word => word.length > 3)  // Only consider words longer than 3 chars
      .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
      .filter(word => word.length > 0)
  );

  const documentWords = new Set(
    documentText.split(/\s+/)
      .filter(word => word.length > 3)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0)
  );

  if (jobWords.size === 0 || documentWords.size === 0) {
    return 0;
  }

  // Calculate intersection over union (Jaccard similarity)
  const intersection = new Set([...jobWords].filter(word => documentWords.has(word)));
  const union = new Set([...jobWords, ...documentWords]);

  return intersection.size / union.size;
}

/**
 * Extract keywords from text using simple frequency analysis
 */
export function extractKeywordsFromText(text: string, maxKeywords: number = 15): string[] {
  // Common stop words to exclude
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
    'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
    'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we',
    'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all',
    'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
    'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make',
    'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could',
    'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only',
    'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use',
    'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
    'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
  ]);

  // Extract and count words
  const wordCounts = new Map<string, number>();
  
  text.toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
    .filter(word => 
      word.length > 2 && 
      !stopWords.has(word) &&
      !/^\d+$/.test(word) // Exclude pure numbers
    )
    .forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

  // Sort by frequency and return top keywords
  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, maxKeywords)
    .map(([word]) => word)
    .filter(word => word.length > 0);
}

/**
 * Suggest potential resume-job pairings based on matching scores
 */
export function suggestDocumentPairings(
  jobDescriptions: JobDescription[],
  resumes: Resume[],
  coverLetters: CoverLetter[],
  minMatchThreshold: number = 0.15
): Array<{
  jobId: string;
  jobTitle: string;
  company: string;
  matches: DocumentMatch[];
}> {
  return jobDescriptions.map(job => {
    const matches = calculateDocumentMatches(job, resumes, coverLetters)
      .filter(match => match.matchScore >= minMatchThreshold);

    return {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      matches
    };
  }).filter(suggestion => suggestion.matches.length > 0);
}