import { useRef, useState } from "react";
import { Resume, CoverLetter, AppState } from "../types";
import { saveResume, saveCoverLetter, debugIndexedDB, clearAllData } from "../storage";
import { checkForDuplicates } from "../utils/duplicateChecker";
import { formatFileSize, extractTextFromDocument } from "../utils/documentUtils";

interface FileUploadSectionProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  syncWithStorage?: () => Promise<void>;
}

// Function to parse structured filename: firstname-lastname-month-year-company-jobRoleKeyword-[coverletter|resume].docx
const analyzeFilename = (filename: string): { documentType: 'resume' | 'cover_letter'; companyName?: string; jobRole?: string } => {
  const originalName = filename.replace(/\.docx$/i, ''); // Remove extension
  const parts = originalName.split('-');

  // Expected pattern: firstname-lastname-month-year-company-jobRoleKeyword-[coverletter|resume]
  // Minimum 7 parts: first, last, month, year, company, job, type
  if (parts.length >= 7) {
    const lastPart = parts[parts.length - 1].toLowerCase();

    // Determine document type from last part
    let documentType: 'resume' | 'cover_letter';
    if (lastPart === 'coverletter' || lastPart === 'cover' || lastPart === 'cl') {
      documentType = 'cover_letter';
    } else if (lastPart === 'resume' || lastPart === 'cv') {
      documentType = 'resume';
    } else {
      // Fallback: check if any part suggests cover letter
      const coverLetterIndicators = ['cover', 'letter', 'coverletter', 'application'];
      const isCoverLetter = parts.some(part =>
        coverLetterIndicators.some(indicator => part.toLowerCase().includes(indicator))
      );
      documentType = isCoverLetter ? 'cover_letter' : 'resume';
    }

    // Extract company name (5th position: 0-indexed = parts[4])
    let companyName: string | undefined;
    if (parts[4] && parts[4].trim()) {
      companyName = parts[4]
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters in camelCase
        .trim()
        .split(' ')
        .map(word => {
          // Keep certain words in specific case (e.g., AI, API, iOS)
          const upperCaseWords = ['ai', 'api', 'ios', 'ui', 'ux', 'it', 'hr', 'pr'];
          if (upperCaseWords.includes(word.toLowerCase())) {
            return word.toUpperCase();
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
    }

    // Extract job role (6th position: 0-indexed = parts[5])
    let jobRole: string | undefined;
    if (parts[5] && parts[5].trim()) {
      jobRole = parts[5]
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters in camelCase
        .trim()
        .split(' ')
        .map(word => {
          // Keep certain words in specific case (e.g., AI, API, iOS)
          const upperCaseWords = ['ai', 'api', 'ios', 'ui', 'ux', 'it', 'hr', 'pr', 'ml', 'devops'];
          if (upperCaseWords.includes(word.toLowerCase())) {
            return word.toUpperCase();
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
    }

    console.log(`Structured filename parsed: ${originalName}
      → Type: ${documentType}
      → Company: ${companyName || 'Not detected'}
      → Role: ${jobRole || 'Not detected'}`);

    return { documentType, companyName, jobRole };
  }

  // Fallback to basic detection for non-structured filenames
  const lowerName = filename.toLowerCase();
  const coverLetterKeywords = ['cover', 'letter', 'coverletter', 'application', 'cl'];
  const isCoverLetter = coverLetterKeywords.some(keyword => lowerName.includes(keyword));
  const documentType = isCoverLetter ? 'cover_letter' : 'resume';

  console.log(`Non-structured filename: ${originalName} → ${documentType} (basic detection)`);

  return { documentType };
};

export default function FileUploadSection({ state, setState, syncWithStorage }: FileUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newDocuments: (Resume | CoverLetter)[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Only accept Word documents
      if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        alert(`${file.name} is not supported. Only Word (.docx) files are accepted.`);
        continue;
      }

      const fileType: 'docx' = 'docx';

      // Check file size (warn about very large files)
      if (file.size > 10 * 1024 * 1024) { // 10MB - IndexedDB can handle larger files
        const shouldContinue = confirm(`${file.name} is ${formatFileSize(file.size)}. Very large files may impact performance. Continue?`);
        if (!shouldContinue) continue;
      }

      try {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Analyze filename for document type, company, and job role
        const analysis = analyzeFilename(file.name);
        let { documentType, companyName, jobRole } = analysis;

        // Check for duplicates before processing
        const duplicateCheck = await checkForDuplicates(file.name, file.size, base64, documentType);

        if (duplicateCheck.isDuplicate && duplicateCheck.duplicateInfo) {
          const { type, existingFile } = duplicateCheck.duplicateInfo;
          let duplicateMessage = '';

          switch (type) {
            case 'filename':
              duplicateMessage = `A file with the same name "${file.name}" already exists (uploaded ${new Date(existingFile.uploadDate).toLocaleDateString()}).`;
              break;
            case 'content':
              duplicateMessage = `This file appears to be identical to "${existingFile.fileName}" (uploaded ${new Date(existingFile.uploadDate).toLocaleDateString()}).`;
              break;
            case 'size_and_name':
              duplicateMessage = `A file with similar name and identical size already exists: "${existingFile.fileName}" (uploaded ${new Date(existingFile.uploadDate).toLocaleDateString()}).`;
              break;
          }

          const shouldContinue = confirm(`⚠️ Possible Duplicate Detected\n\n${duplicateMessage}\n\nDo you want to upload this file anyway?`);

          if (!shouldContinue) {
            console.log(`Skipping duplicate file: ${file.name}`);
            continue;
          } else {
            console.log(`User chose to upload potential duplicate: ${file.name}`);
          }
        }

        const detectedParts = [];
        if (companyName) detectedParts.push(`Company: ${companyName}`);
        if (jobRole) detectedParts.push(`Role: ${jobRole}`);

        const detectedInfo = detectedParts.length > 0
          ? `${documentType === 'resume' ? 'Resume' : 'Cover Letter'} (${detectedParts.join(', ')})`
          : `${documentType === 'resume' ? 'Resume' : 'Cover Letter'}`;

        console.log(`Auto-detected ${file.name} as: ${detectedInfo}`);

        // Allow user to override detection if needed
        const confirmMessage = `Detected "${file.name}" as: ${detectedInfo}\n\nIs this correct?`;
        const isCorrect = confirm(confirmMessage);

        if (!isCorrect) {
          const alternativeType = documentType === 'resume' ? 'cover_letter' : 'resume';
          const alternativeText = alternativeType === 'resume' ? 'Resume' : 'Cover Letter';
          const useAlternative = confirm(`Should this be treated as a ${alternativeText} instead?`);
          if (useAlternative) {
            documentType = alternativeType;
            console.log(`User override: ${file.name} changed to: ${documentType}`);
          }
        }

        // Create document based on final type
        if (documentType === 'resume') {
          const resume: Resume = {
            id: crypto.randomUUID(),
            name: file.name.replace(/\.docx$/i, ''),
            fileName: file.name,
            fileSize: file.size,
            uploadDate: new Date().toISOString(),
            fileData: base64,
            fileType: 'docx',
            textContent: '',
          };

          // Extract text content for search
          const textContent = await extractTextFromDocument(resume);
          resume.textContent = textContent;

          // Save resume to IndexedDB immediately
          try {
            await saveResume(resume);
            console.log(`Successfully saved resume ${file.name} to IndexedDB`);
            newDocuments.push(resume);
          } catch (error) {
            console.error(`Error saving resume ${file.name}:`, error);
            alert(`Error saving ${file.name}. Please try again.`);
            continue;
          }
        } else {
          // Get target company and position for cover letter
          const detectedInfo = [];
          if (companyName) detectedInfo.push(`Company: ${companyName}`);
          if (jobRole) detectedInfo.push(`Role: ${jobRole}`);
          const detectedMsg = detectedInfo.length > 0 ? `\n\n✨ Detected: ${detectedInfo.join(', ')}` : '';

          const targetCompany = prompt(`📄 Cover Letter Detected: ${file.name}${detectedMsg}\n\nEnter the target company (leave blank to use detected):`, companyName || '');
          const targetPosition = prompt(`📄 Cover Letter: ${file.name}\n\nEnter the target position (leave blank to use detected):`, jobRole || '');

          const coverLetter: CoverLetter = {
            id: crypto.randomUUID(),
            name: file.name.replace(/\.docx$/i, ''),
            fileName: file.name,
            fileSize: file.size,
            uploadDate: new Date().toISOString(),
            fileData: base64,
            fileType: 'docx',
            textContent: '',
            targetCompany: targetCompany?.trim() || undefined,
            targetPosition: targetPosition?.trim() || undefined,
          };

          // Extract text content for search
          const textContent = await extractTextFromDocument(coverLetter);
          coverLetter.textContent = textContent;

          // Save cover letter to IndexedDB immediately
          try {
            await saveCoverLetter(coverLetter);
            console.log(`Successfully saved cover letter ${file.name} to IndexedDB`);
            newDocuments.push(coverLetter);
          } catch (error) {
            console.error(`Error saving cover letter ${file.name}:`, error);
            alert(`Error saving ${file.name}. Please try again.`);
            continue;
          }
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        alert(`Error processing ${file.name}`);
      }
    }

    if (newDocuments.length > 0) {
      // Sync with storage to get the latest state from IndexedDB
      if (syncWithStorage) {
        await syncWithStorage();
      }
    }

    setIsUploading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <section className="page-card">
      <h2>Upload Documents</h2>
      <p>Upload Word documents (.docx) - we'll automatically extract document type, company, and job role from structured filenames.</p>
      <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
        💡 <strong>Structured Format:</strong> <code>firstname-lastname-month-year-company-jobRole-[coverletter|resume].docx</code>
        <br />
        <strong>Example:</strong> <code>john-smith-nov-2024-google-softwareEngineer-coverletter.docx</code>
      </p>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : '📄 Upload Documents'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            console.log('=== DEBUG BUTTON CLICKED ===');
            setDebugInfo('Running debug...');
            try {
              await debugIndexedDB();
              setDebugInfo(`Debug complete at ${new Date().toLocaleTimeString()} - State has ${state.resumes.length} resumes - Check console for full details`);
            } catch (error) {
              console.error('Debug failed:', error);
              setDebugInfo(`Debug failed: ${error}`);
            }
          }}
        >
          Debug Storage
        </button>
        <button
          type="button"
          className="secondary"
          style={{ backgroundColor: "#dc3545", color: "white" }}
          onClick={async () => {
            if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
              console.log('=== CLEAR ALL DATA CLICKED ===');
              setDebugInfo('Clearing all data...');
              try {
                await clearAllData();
                if (syncWithStorage) {
                  await syncWithStorage();
                } else {
                  setState(prev => ({ ...prev, resumes: [] }));
                }
                setDebugInfo(`All data cleared at ${new Date().toLocaleTimeString()}`);
              } catch (error) {
                console.error('Clear failed:', error);
                setDebugInfo(`Clear failed: ${error}`);
              }
            }
          }}
        >
          Clear All Data
        </button>
        <span style={{ color: "#666", fontSize: "0.9rem" }}>
          Multiple Word documents (.docx) supported
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        style={{ display: "none" }}
        onChange={(event) => handleFileUpload(event.target.files)}
      />

      {debugInfo && (
        <div style={{
          marginTop: "1rem",
          padding: "0.75rem",
          backgroundColor: "#f0f4f8",
          borderRadius: "4px",
          fontSize: "0.9rem",
          border: "1px solid #cbd5e0"
        }}>
          <strong>Debug Info:</strong> {debugInfo}
        </div>
      )}
    </section>
  );
}