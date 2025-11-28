import { useRef, useState } from "react";
import { useAppState } from "../state/AppStateContext";
import { Resume } from "../types";
import { saveResume, deleteResume as deleteResumeFromStorage, debugIndexedDB } from "../storage";
import * as mammoth from 'mammoth';

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString();
}

// Word document processing only - no PDF.js needed



// Word document text extraction
async function extractTextFromWord(fileData: string): Promise<string> {
  try {
    console.log('=== WORD DOCUMENT EXTRACTION START ===');
    const base64Data = fileData.split(',')[1];
    const binaryData = atob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }

    // Convert Uint8Array to ArrayBuffer
    const arrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);

    const result = await mammoth.extractRawText({ arrayBuffer });
    console.log('✅ Word extraction successful:', result.value.length, 'characters');
    return result.value;
  } catch (error) {
    console.error('❌ Word extraction failed:', error);
    return '';
  }
}

// Alternative text extraction using manual text input fallback
async function extractTextViaManualInput(fileName: string): Promise<string> {
  return new Promise((resolve) => {
    const userText = prompt(`Document text extraction failed for "${fileName}".\n\nPlease copy and paste the text content:\n\n1. Open your document\n2. Select all text (Cmd+A)\n3. Copy (Cmd+C)\n4. Paste below:`);
    resolve(userText || '');
  });
}

async function extractTextFromDocument(resume: Resume): Promise<string> {
  console.log('=== WORD DOCUMENT TEXT EXTRACTION START ===');

  // Word document extraction
  const wordText = await extractTextFromWord(resume.fileData);
  if (wordText && wordText.trim().length > 0) {
    return wordText.trim();
  }

  // Fallback to manual input if Word extraction fails
  console.log('Attempting manual text input fallback...');
  const manualText = await extractTextViaManualInput(resume.fileName);
  if (manualText && manualText.trim().length > 0) {
    console.log('✅ Manual text input successful:', manualText.length, 'characters');
    return manualText.trim();
  }

  console.error('❌ All text extraction methods failed');
  return '';
} export default function DashboardPage() {
  const { state, setState, isLoading } = useAppState();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [parsingResumeId, setParsingResumeId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading resumes...</p>
      </div>
    );
  }

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

        newResumes.push(resume);

        // Save each resume to IndexedDB immediately
        try {
          await saveResume(resume);
        } catch (error) {
          console.error(`Error saving ${file.name}:`, error);
          alert(`Error saving ${file.name}`);
          continue;
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        alert(`Error processing ${file.name}`);
      }
    }

    if (newResumes.length > 0) {
      setState(prev => ({
        ...prev,
        resumes: [...prev.resumes, ...newResumes]
      }));
    }

    setIsUploading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseText = async (resume: Resume) => {
    setParsingResumeId(resume.id);
    try {
      const textContent = await extractTextFromDocument(resume);

      const updatedResume = {
        ...resume,
        textContent
      };

      // Save to IndexedDB
      await saveResume(updatedResume);

      // Update state
      setState(prev => ({
        ...prev,
        resumes: prev.resumes.map(r =>
          r.id === resume.id ? updatedResume : r
        )
      }));

      if (textContent && textContent.trim().length > 0) {
        alert(`✅ Text extracted successfully!\n\n📄 ${textContent.length} characters extracted`);
      } else {
        const shouldTryAgain = confirm(`❌ Automatic text extraction failed.\n\nThis can happen with:\n• Complex Word document layouts\n• Password-protected documents\n• Corrupted Word files\n\n🔧 Would you like to try the manual text input method?\n\n(Click OK to manually paste text, or Cancel to skip)`);

        if (shouldTryAgain) {
          // Trigger the manual extraction directly
          const manualText = prompt(`📝 Manual Text Input\n\nPlease:\n1. Open your Word document\n2. Select all text (Cmd+A)\n3. Copy the text (Cmd+C)\n4. Paste it below:`);

          if (manualText && manualText.trim().length > 0) {
            const updatedResumeWithManualText = {
              ...resume,
              textContent: manualText.trim()
            };

            await saveResume(updatedResumeWithManualText);
            setState(prev => ({
              ...prev,
              resumes: prev.resumes.map(r =>
                r.id === resume.id ? updatedResumeWithManualText : r
              )
            }));

            alert(`✅ Manual text input successful!\n\n📄 ${manualText.trim().length} characters added`);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing text:', error);
      alert('Error extracting text from Word document');
    } finally {
      setParsingResumeId(null);
    }
  };

  const showTextPreview = (resume: Resume) => {
    setPreviewText(resume.textContent || 'No text content available');
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewText(null);
  };

  const deleteResume = async (resumeId: string) => {
    if (confirm('Are you sure you want to delete this resume?')) {
      try {
        await deleteResumeFromStorage(resumeId);
        setState(prev => ({
          ...prev,
          resumes: prev.resumes.filter(resume => resume.id !== resumeId)
        }));
      } catch (error) {
        console.error('Error deleting resume:', error);
        alert('Error deleting resume');
      }
    }
  };

  const openResume = (resume: Resume) => {
    console.log('=== OPENING RESUME ===');
    console.log('Resume name:', resume.name);
    console.log('File data length:', resume.fileData.length);
    console.log('File type:', resume.fileType);

    // Word documents cannot be displayed in browser - offer download instead
    alert('Word documents cannot be previewed in the browser. The file will be downloaded for viewing.');

    try {
      // Download Word document
      console.log('Downloading Word document...');
      const base64Data = resume.fileData.split(',')[1];
      const binaryData = atob(base64Data);
      const uint8Array = new Uint8Array(binaryData.length);

      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([uint8Array], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      console.log('Created Word blob, size:', blob.size);

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = resume.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        console.log('Cleaned up blob URL');
      }, 1000);
    } catch (error) {
      console.error('Error opening Word document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error opening Word document: ${errorMessage}. Check console for details.`);
    }
  };

  // Filter resumes based on search term
  const filteredResumes = state.resumes.filter(resume => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      resume.name.toLowerCase().includes(term) ||
      resume.fileName.toLowerCase().includes(term) ||
      (resume.textContent && resume.textContent.toLowerCase().includes(term))
    );
  });

  return (
    <div className="page-grid">
      {/* Upload Section */}
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

      {/* Stats Section */}
      <section className="metrics">
        <div className="metric-card">
          <h4>Total Resumes</h4>
          <strong>{state.resumes.length}</strong>
        </div>
        <div className="metric-card">
          <h4>Total Size</h4>
          <strong>{formatFileSize(state.resumes.reduce((sum, resume) => sum + resume.fileSize, 0))}</strong>
        </div>
        <div className="metric-card">
          <h4>Latest Upload</h4>
          <strong>
            {state.resumes.length > 0
              ? formatDate(state.resumes[0].uploadDate)
              : 'None'
            }
          </strong>
        </div>
      </section>

      {/* Resume Management */}
      <section className="page-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3>Manage Resumes</h3>
          {state.resumes.length > 0 && (
            <input
              type="text"
              placeholder="Search resumes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
                width: "250px"
              }}
            />
          )}
        </div>

        {state.resumes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
            <p>No resumes uploaded yet.</p>
            <p>Click "Select Word Resumes" above to get started.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>File Size</th>
                <th>Upload Date</th>
                <th>Text Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResumes.map((resume) => (
                <tr key={resume.id}>
                  <td>
                    <strong>{resume.name}</strong>
                    <br />
                    <span style={{ fontSize: "0.8rem", color: "#666" }}>
                      {resume.fileName}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "12px",
                      backgroundColor: "#2563eb",
                      color: "white",
                      fontWeight: "600",
                      textTransform: "uppercase"
                    }}>
                      DOCX
                    </span>
                  </td>
                  <td>{formatFileSize(resume.fileSize)}</td>
                  <td>{formatDate(resume.uploadDate)}</td>
                  <td>
                    {resume.textContent && resume.textContent.trim().length > 0 ? (
                      <span style={{ color: "#22c55e", fontWeight: "600" }}>
                        Text extracted ✓
                      </span>
                    ) : (
                      <span style={{ color: "#ef4444", fontWeight: "600" }}>
                        No text extracted ✗
                      </span>
                    )}
                    {resume.textContent && (
                      <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "2px" }}>
                        {resume.textContent.length} characters
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => openResume(resume)}
                      >
                        Download
                      </button>
                      {(!resume.textContent || resume.textContent.trim().length === 0) ? (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => parseText(resume)}
                          disabled={parsingResumeId === resume.id}
                          style={{
                            fontSize: "0.8rem",
                            padding: "0.4rem 0.6rem",
                            backgroundColor: parsingResumeId === resume.id ? "#f0f0f0" : "#3b82f6",
                            color: parsingResumeId === resume.id ? "#666" : "white",
                            border: "none"
                          }}
                        >
                          {parsingResumeId === resume.id ? 'Parsing...' : 'Parse Text'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => showTextPreview(resume)}
                          style={{
                            fontSize: "0.8rem",
                            padding: "0.4rem 0.6rem",
                            backgroundColor: "#10b981",
                            color: "white",
                            border: "none"
                          }}
                        >
                          Preview Text
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          console.log('=== WORD DOCUMENT INFO ===');
                          console.log('=== WORD DOCUMENT VALIDATION ===');
                          console.log('File type:', resume.fileType);
                          console.log('File size:', resume.fileSize);
                          console.log('Has text content:', !!resume.textContent);
                          alert(`Word Document Info:\nType: ${resume.fileType}\nSize: ${formatFileSize(resume.fileSize)}\nText extracted: ${resume.textContent ? 'Yes' : 'No'}`);
                        }}
                        style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
                      >
                        Info
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => deleteResume(resume.id)}
                        style={{ color: "#d73a49" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Text Preview Modal */}
      {showPreview && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "1.5rem",
            maxWidth: "80vw",
            maxHeight: "80vh",
            overflow: "auto",
            position: "relative"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem"
            }}>
              <h3>Extracted Text Preview</h3>
              <button
                onClick={closePreview}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  padding: "0.25rem"
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              backgroundColor: "#f8f9fa",
              padding: "1rem",
              borderRadius: "4px",
              border: "1px solid #e9ecef",
              maxHeight: "60vh",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              fontSize: "0.9rem",
              lineHeight: "1.4"
            }}>
              {previewText}
            </div>
            <div style={{
              marginTop: "1rem",
              textAlign: "right"
            }}>
              <button
                onClick={closePreview}
                className="secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
