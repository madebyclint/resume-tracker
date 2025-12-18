// Stub file for removed document matching functionality
// This was previously used for resume/cover letter matching

export interface DocumentMatch {
  documentId: string;
  documentName: string;
  documentType: 'resume' | 'cover_letter';
  matchScore: number;
  matchedKeywords: string[];
  skillMatches: string[];
}

export function calculateDocumentMatches(job: any): DocumentMatch[] {
  // Return empty array since we removed resume/cover letter functionality
  return [];
}

export function extractKeywordsFromText(text: string): string[] {
  // Simple keyword extraction - can be enhanced later
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 3)
    .slice(0, 20); // Return first 20 meaningful words
}