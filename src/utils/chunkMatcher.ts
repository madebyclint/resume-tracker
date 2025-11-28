import { JobDescription, Chunk } from '../types';
import { getAllChunks } from '../storage';

interface ChunkMatch {
  chunk: Chunk;
  score: number;
  matchedKeywords: string[];
  skillMatches: string[];
}

/**
 * Find chunks relevant to a job description using keyword and skill matching
 */
export async function findRelevantChunks(
  jobDescription: JobDescription,
  minScore: number = 0.1,
  maxResults: number = 20
): Promise<ChunkMatch[]> {
  const allChunks = await getAllChunks();
  
  // Get job keywords and skills
  const jobKeywords = jobDescription.keywords.map(k => k.toLowerCase());
  const requiredSkills = jobDescription.extractedInfo.requiredSkills.map(s => s.toLowerCase());
  const preferredSkills = jobDescription.extractedInfo.preferredSkills.map(s => s.toLowerCase());
  const allJobSkills = [...requiredSkills, ...preferredSkills];
  
  // Score each chunk
  const chunksWithScores: ChunkMatch[] = allChunks.map(chunk => {
    const chunkText = chunk.text.toLowerCase();
    const chunkTags = chunk.tags?.map(t => t.toLowerCase()) || [];
    
    // Find keyword matches
    const matchedKeywords = jobKeywords.filter(keyword => 
      chunkText.includes(keyword) || chunkTags.includes(keyword)
    );
    
    // Find skill matches
    const skillMatches = allJobSkills.filter(skill => 
      chunkText.includes(skill) || chunkTags.includes(skill)
    );
    
    // Calculate score
    let score = 0;
    
    // Keyword matches (weight: 0.3 per match, max 3.0)
    score += Math.min(matchedKeywords.length * 0.3, 3.0);
    
    // Required skill matches (weight: 0.5 per match, max 5.0)
    const requiredSkillMatches = skillMatches.filter(skill => 
      requiredSkills.includes(skill)
    );
    score += Math.min(requiredSkillMatches.length * 0.5, 5.0);
    
    // Preferred skill matches (weight: 0.2 per match, max 2.0)
    const preferredSkillMatches = skillMatches.filter(skill => 
      preferredSkills.includes(skill)
    );
    score += Math.min(preferredSkillMatches.length * 0.2, 2.0);
    
    // Boost for certain chunk types that are more important
    const chunkTypeBoosts: Record<string, number> = {
      'cv_summary': 0.3,
      'cv_skills': 0.4,
      'cv_experience_bullet': 0.2,
      'cv_mission_fit': 0.3,
      'cl_body': 0.2,
      'cl_skill_demonstration': 0.4,
      'cl_achievement_claim': 0.3,
      'cl_experience_mapping': 0.3
    };
    
    const boost = chunkTypeBoosts[chunk.type] || 0;
    score += boost;
    
    // Normalize score to 0-1 range
    score = Math.min(score / 10, 1);
    
    return {
      chunk,
      score,
      matchedKeywords: matchedKeywords,
      skillMatches: skillMatches
    };
  });
  
  // Filter by minimum score and sort by relevance
  return chunksWithScores
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Get chunks specifically for resume generation (filters out cover letter chunks)
 */
export async function findRelevantResumeChunks(
  jobDescription: JobDescription,
  minScore: number = 0.1,
  maxResults: number = 15
): Promise<ChunkMatch[]> {
  const allMatches = await findRelevantChunks(jobDescription, minScore, maxResults * 2);
  
  // Filter to only resume-related chunks
  const resumeChunkTypes = [
    'cv_header', 'cv_summary', 'cv_skills', 'cv_experience_section', 
    'cv_experience_bullet', 'cv_mission_fit'
  ];
  
  return allMatches
    .filter(match => resumeChunkTypes.includes(match.chunk.type))
    .slice(0, maxResults);
}

/**
 * Get chunks for cover letter generation (includes both resume and cover letter chunks)
 */
export async function findRelevantCoverLetterChunks(
  jobDescription: JobDescription,
  minScore: number = 0.1,
  maxResults: number = 15
): Promise<ChunkMatch[]> {
  const allMatches = await findRelevantChunks(jobDescription, minScore, maxResults * 2);
  
  // Prefer cover letter chunks but also include some resume chunks for context
  const coverLetterChunkTypes = [
    'cl_intro', 'cl_body', 'cl_closing', 'cl_company_research',
    'cl_skill_demonstration', 'cl_achievement_claim', 'cl_motivation_statement',
    'cl_experience_mapping'
  ];
  
  const resumeChunkTypes = [
    'cv_summary', 'cv_skills', 'cv_experience_bullet', 'cv_mission_fit'
  ];
  
  // First get cover letter chunks
  const coverLetterMatches = allMatches.filter(match => 
    coverLetterChunkTypes.includes(match.chunk.type)
  );
  
  // Then add some resume chunks for context
  const resumeMatches = allMatches.filter(match => 
    resumeChunkTypes.includes(match.chunk.type)
  ).slice(0, Math.max(5, maxResults - coverLetterMatches.length));
  
  // Combine and re-sort
  return [...coverLetterMatches, ...resumeMatches]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}