import { useRef, useState } from "react";
import { useAppState } from "../state/AppStateContext";
import { Resume } from "../types";
import { saveResume, deleteResume as deleteResumeFromStorage, debugIndexedDB } from "../storage";
import * as pdfjsLib from 'pdfjs-dist';

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString();
}

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.394/pdf.worker.min.js`;

function validatePDFData(pdfData: string): boolean {
  try {
    // Check if it's a valid data URL
    if (!pdfData.startsWith('data:application/pdf;base64,')) {
      console.error('PDF data is not a valid data URL');
      return false;
    }

    // Check if base64 data exists
    const base64Data = pdfData.split(',')[1];
    if (!base64Data || base64Data.length === 0) {
      console.error('No base64 data found');
      return false;
    }

    // Try to decode base64
    const binaryData = atob(base64Data);
    if (binaryData.length === 0) {
      console.error('Decoded binary data is empty');
      return false;
    }

    // Check for PDF signature
    const pdfSignature = binaryData.substring(0, 4);
    if (pdfSignature !== '%PDF') {
      console.error('PDF signature not found, got:', pdfSignature);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating PDF data:', error);
    return false;
  }
}

async function extractTextFromPDF(pdfData: string): Promise<string> {
  try {
    console.log('Extracting text from PDF, data length:', pdfData.length);

    if (!validatePDFData(pdfData)) {
      console.error('Invalid PDF data, skipping text extraction');
      return '';
    }

    // Handle data URL format
    const base64Data = pdfData.split(',')[1];
    console.log('Base64 data length after split:', base64Data.length);

    const binaryData = atob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }

    console.log('Created Uint8Array, length:', uint8Array.length);
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    console.log('PDF loaded successfully, pages:', pdf.numPages);

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item): item is any => 'str' in item)
        .map(item => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    console.log('Text extraction complete, text length:', fullText.length);
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
}



export default function DashboardPage() {
  const { state, setState, isLoading } = useAppState();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debugInfo, setDebugInfo] = useState<string>('');

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

      // Only accept PDF files
      if (file.type !== 'application/pdf') {
        alert(`${file.name} is not a PDF file. Only PDF files are supported.`);
        continue;
      }

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

        // Extract text content for search
        const textContent = await extractTextFromPDF(base64);

        const resume: Resume = {
          id: crypto.randomUUID(),
          name: file.name.replace('.pdf', ''),
          fileName: file.name,
          fileSize: file.size,
          uploadDate: new Date().toISOString(),
          pdfData: base64,
          textContent,
        };

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
    console.log('PDF data length:', resume.pdfData.length);
    console.log('PDF data starts with:', resume.pdfData.substring(0, 100));
    console.log('PDF data ends with:', resume.pdfData.substring(resume.pdfData.length - 50));

    if (!validatePDFData(resume.pdfData)) {
      alert('Invalid PDF data. The file may be corrupted.');
      return;
    }

    try {
      // Method 1: Try blob approach first (more reliable)
      console.log('Trying blob approach...');
      const base64Data = resume.pdfData.split(',')[1];
      const binaryData = atob(base64Data);
      const uint8Array = new Uint8Array(binaryData.length);

      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([uint8Array], { type: 'application/pdf' });
      console.log('Created blob, size:', blob.size);

      const blobUrl = URL.createObjectURL(blob);
      console.log('Created blob URL:', blobUrl);

      const newWindow = window.open(blobUrl, '_blank');
      if (newWindow) {
        console.log('Opened in new window successfully');
        // Clean up after a delay
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          console.log('Cleaned up blob URL');
        }, 5000);
      } else {
        console.log('Popup blocked, trying download fallback...');
        // Fallback: download the file
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = resume.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error opening PDF: ${errorMessage}. Check console for details.`);
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
        <p>Upload multiple PDF resume files to manage and track them.</p>



        <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
          <button
            type="button"
            className="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Select PDF Resumes'}
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
            Multiple files supported (PDF only)
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
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
            <p>Click "Select PDF Resumes" above to get started.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>File Size</th>
                <th>Upload Date</th>
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
                  <td>{formatFileSize(resume.fileSize)}</td>
                  <td>{formatDate(resume.uploadDate)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => openResume(resume)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          console.log('=== PDF VALIDATION TEST ===');
                          const isValid = validatePDFData(resume.pdfData);
                          console.log('PDF is valid:', isValid);
                          if (isValid) {
                            console.log('✓ PDF data is valid');
                          }
                          alert(`PDF validation: ${isValid ? 'VALID' : 'INVALID'} - Check console for details`);
                        }}
                        style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
                      >
                        Test
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
    </div>
  );
}
