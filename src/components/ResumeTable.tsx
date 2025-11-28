import { useState, useEffect } from "react";
import { Resume, Chunk } from "../types";
import { saveResume, deleteResume as deleteResumeFromStorage, saveChunks, getChunksBySourceDoc } from "../storage";
import { formatFileSize, formatDate, extractTextFromDocument } from "../utils/documentUtils";
import { parseTextIntoChunks, isAIConfigured, showConfigInstructions } from "../utils/aiService";
import ChunkReviewModal from "./ChunkReviewModal";

interface ResumeTableProps {
  resumes: Resume[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  setState: React.Dispatch<React.SetStateAction<{ resumes: Resume[] }>>;
  onShowPreview: (text: string) => void;
}

export default function ResumeTable({
  resumes,
  searchTerm,
  setSearchTerm,
  setState,
  onShowPreview
}: ResumeTableProps) {
  const [parsingResumeId, setParsingResumeId] = useState<string | null>(null);
  const [chunkingResumeId, setChunkingResumeId] = useState<string | null>(null);
  const [chunkReviewModal, setChunkReviewModal] = useState<{
    isOpen: boolean;
    chunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[];
    resumeId: string;
    resumeName: string;
  }>({
    isOpen: false,
    chunks: [],
    resumeId: '',
    resumeName: ''
  });
  const [resumeChunkCounts, setResumeChunkCounts] = useState<Record<string, number>>({});

  // Load chunk counts for all resumes
  useEffect(() => {
    const loadChunkCounts = async () => {
      const counts: Record<string, number> = {};
      for (const resume of resumes) {
        try {
          const chunks = await getChunksBySourceDoc(resume.id);
          counts[resume.id] = chunks.length;
        } catch (error) {
          console.error(`Failed to load chunks for resume ${resume.id}:`, error);
          counts[resume.id] = 0;
        }
      }
      setResumeChunkCounts(counts);
    };

    if (resumes.length > 0) {
      loadChunkCounts();
    }
  }, [resumes]);

  const parseIntoChunks = async (resume: Resume) => {
    if (!resume.textContent || resume.textContent.trim().length === 0) {
      alert('No text content available. Please extract text first before parsing into chunks.');
      return;
    }

    // Check if AI is configured
    if (!isAIConfigured()) {
      showConfigInstructions();
      return;
    }

    setChunkingResumeId(resume.id);

    try {
      const result = await parseTextIntoChunks(resume.textContent);

      if (!result.success) {
        alert(`Failed to parse chunks: ${result.error}`);
        return;
      }

      if (result.chunks.length === 0) {
        alert('No chunks were generated from the text. The document may not contain parseable content.');
        return;
      }

      // Open the review modal
      setChunkReviewModal({
        isOpen: true,
        chunks: result.chunks,
        resumeId: resume.id,
        resumeName: resume.name
      });

    } catch (error) {
      console.error('Error parsing chunks:', error);
      alert('An unexpected error occurred while parsing chunks. Check the console for details.');
    } finally {
      setChunkingResumeId(null);
    }
  };

  const handleSaveChunks = async (approvedChunks: Omit<Chunk, 'id' | 'sourceDocId' | 'createdAt' | 'approved'>[]) => {
    try {
      // Convert to full Chunk objects
      const chunks: Chunk[] = approvedChunks.map((chunk, index) => ({
        ...chunk,
        id: crypto.randomUUID(),
        sourceDocId: chunkReviewModal.resumeId,
        createdAt: new Date().toISOString(),
        approved: true
      }));

      await saveChunks(chunks);

      // Update chunk count
      setResumeChunkCounts(prev => ({
        ...prev,
        [chunkReviewModal.resumeId]: chunks.length
      }));

      alert(`✅ Successfully saved ${chunks.length} chunks!`);

    } catch (error) {
      console.error('Error saving chunks:', error);
      alert('Failed to save chunks. Check the console for details.');
    }
  };

  const handleCloseChunkModal = () => {
    setChunkReviewModal({
      isOpen: false,
      chunks: [],
      resumeId: '',
      resumeName: ''
    });
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
    onShowPreview(resume.textContent || 'No text content available');
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
  const filteredResumes = resumes.filter(resume => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      resume.name.toLowerCase().includes(term) ||
      resume.fileName.toLowerCase().includes(term) ||
      (resume.textContent && resume.textContent.toLowerCase().includes(term))
    );
  });

  return (
    <section className="page-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3>Manage Resumes</h3>
        {resumes.length > 0 && (
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

      {resumes.length === 0 ? (
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
              <th>Status</th>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {/* Text Status */}
                    <div>
                      {resume.textContent && resume.textContent.trim().length > 0 ? (
                        <span style={{ color: "#22c55e", fontWeight: "600", fontSize: "0.8rem" }}>
                          Text extracted ✓
                        </span>
                      ) : (
                        <span style={{ color: "#ef4444", fontWeight: "600", fontSize: "0.8rem" }}>
                          No text extracted ✗
                        </span>
                      )}
                      {resume.textContent && (
                        <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "1px" }}>
                          {resume.textContent.length} characters
                        </div>
                      )}
                    </div>

                    {/* Chunk Status */}
                    <div>
                      {resumeChunkCounts[resume.id] > 0 ? (
                        <span style={{ color: "#8b5cf6", fontWeight: "600", fontSize: "0.8rem" }}>
                          {resumeChunkCounts[resume.id]} chunks parsed ✓
                        </span>
                      ) : (
                        <span style={{ color: "#6b7280", fontWeight: "600", fontSize: "0.8rem" }}>
                          No chunks parsed
                        </span>
                      )}
                    </div>
                  </div>
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

                    {/* Parse into Chunks button - only show if text is extracted */}
                    {resume.textContent && resume.textContent.trim().length > 0 && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => parseIntoChunks(resume)}
                        disabled={chunkingResumeId === resume.id}
                        style={{
                          fontSize: "0.8rem",
                          padding: "0.4rem 0.6rem",
                          backgroundColor: chunkingResumeId === resume.id
                            ? "#f0f0f0"
                            : resumeChunkCounts[resume.id] > 0
                              ? "#8b5cf6"
                              : "#f59e0b",
                          color: chunkingResumeId === resume.id ? "#666" : "white",
                          border: "none"
                        }}
                      >
                        {chunkingResumeId === resume.id
                          ? 'Parsing...'
                          : resumeChunkCounts[resume.id] > 0
                            ? `Re-parse Chunks`
                            : 'Parse into Chunks'
                        }
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

      {/* Chunk Review Modal */}
      <ChunkReviewModal
        isOpen={chunkReviewModal.isOpen}
        onClose={handleCloseChunkModal}
        chunks={chunkReviewModal.chunks}
        onSave={handleSaveChunks}
        documentName={chunkReviewModal.resumeName}
      />
    </section>
  );
}