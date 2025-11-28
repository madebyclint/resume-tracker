import { Resume, CoverLetter } from "../types";
import { loadResumes, loadCoverLetters } from "../storage";

// Utility function to create a hash of file content for duplicate detection
function createContentHash(base64Data: string): string {
  // Simple hash function - in production you might want to use crypto.subtle.digest
  let hash = 0;
  const str = base64Data;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Check for duplicate files
export async function checkForDuplicates(
  fileName: string, 
  fileSize: number, 
  base64Data: string, 
  documentType: 'resume' | 'cover_letter'
): Promise<{ 
  isDuplicate: boolean; 
  duplicateInfo?: { 
    type: string; 
    existingFile: Resume | CoverLetter 
  } 
}> {
  try {
    const contentHash = createContentHash(base64Data);
    
    if (documentType === 'resume') {
      const resumes = await loadResumes();
      
      // Check for exact filename match
      const filenameMatch = resumes.find(r => r.fileName === fileName);
      if (filenameMatch) {
        return { 
          isDuplicate: true, 
          duplicateInfo: { 
            type: 'filename', 
            existingFile: filenameMatch 
          } 
        };
      }
      
      // Check for content hash match (most reliable)
      const contentMatch = resumes.find(r => createContentHash(r.fileData) === contentHash);
      if (contentMatch) {
        return { 
          isDuplicate: true, 
          duplicateInfo: { 
            type: 'content', 
            existingFile: contentMatch 
          } 
        };
      }
      
      // Check for size + similar filename (without extension)
      const baseName = fileName.replace(/\.docx$/i, '');
      const sizeAndNameMatch = resumes.find(r => 
        r.fileSize === fileSize && 
        r.fileName.replace(/\.docx$/i, '').toLowerCase() === baseName.toLowerCase()
      );
      if (sizeAndNameMatch) {
        return { 
          isDuplicate: true, 
          duplicateInfo: { 
            type: 'size_and_name', 
            existingFile: sizeAndNameMatch 
          } 
        };
      }
      
    } else {
      const coverLetters = await loadCoverLetters();
      
      // Check for exact filename match
      const filenameMatch = coverLetters.find(cl => cl.fileName === fileName);
      if (filenameMatch) {
        return { 
          isDuplicate: true, 
          duplicateInfo: { 
            type: 'filename', 
            existingFile: filenameMatch 
          } 
        };
      }
      
      // Check for content hash match (most reliable)
      const contentMatch = coverLetters.find(cl => createContentHash(cl.fileData) === contentHash);
      if (contentMatch) {
        return { 
          isDuplicate: true, 
          duplicateInfo: { 
            type: 'content', 
            existingFile: contentMatch 
          } 
        };
      }
      
      // Check for size + similar filename (without extension)
      const baseName = fileName.replace(/\.docx$/i, '');
      const sizeAndNameMatch = coverLetters.find(cl => 
        cl.fileSize === fileSize && 
        cl.fileName.replace(/\.docx$/i, '').toLowerCase() === baseName.toLowerCase()
      );
      if (sizeAndNameMatch) {
        return { 
          isDuplicate: true, 
          duplicateInfo: { 
            type: 'size_and_name', 
            existingFile: sizeAndNameMatch 
          } 
        };
      }
    }
    
    return { isDuplicate: false };
    
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    // In case of error, allow the upload to proceed
    return { isDuplicate: false };
  }
}