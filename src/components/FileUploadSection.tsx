import { useRef, useState } from "react";
import { Resume } from "../types";
import { saveResume, debugIndexedDB, clearAllData } from "../storage";
import { formatFileSize, extractTextFromDocument } from "../utils/documentUtils";

interface FileUploadSectionProps {
  state: { resumes: Resume[] };
  setState: React.Dispatch<React.SetStateAction<{ resumes: Resume[] }>>;
  syncWithStorage?: () => Promise<void>;
}

export default function FileUploadSection({ state, setState, syncWithStorage }: FileUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newResumes: Resume[] = [];

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

        // Save each resume to IndexedDB immediately
        try {
          await saveResume(resume);
          console.log(`Successfully saved ${file.name} to IndexedDB`);
          newResumes.push(resume);
        } catch (error) {
          console.error(`Error saving ${file.name}:`, error);
          alert(`Error saving ${file.name}. Please try again.`);
          continue;
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        alert(`Error processing ${file.name}`);
      }
    }

    if (newResumes.length > 0) {
      // Sync with storage to get the latest state from IndexedDB
      if (syncWithStorage) {
        await syncWithStorage();
      } else {
        // Fallback to manual state update if sync function not available
        setState(prev => ({
          ...prev,
          resumes: [...prev.resumes, ...newResumes]
        }));
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
      <h2>Upload Resumes</h2>
      <p>Upload multiple Word resume documents (.docx) to manage and track them.</p>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <button
          type="button"
          className="primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Select Word Resumes'}
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