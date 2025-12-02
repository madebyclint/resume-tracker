import { useState } from "react";
import { CoverLetter, AppState } from "../types";
import { saveCoverLetter, deleteCoverLetter } from "../storage";
import { formatFileSize, formatDate, extractTextFromDocument } from "../utils/documentUtils";
import ProgressSpinner from "./ProgressSpinner";

interface CoverLetterTableProps {
  coverLetters: CoverLetter[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onShowPreview: (text: string) => void;
}

export default function CoverLetterTable({
  coverLetters,
  searchTerm,
  setSearchTerm,
  setState,
  onShowPreview
}: CoverLetterTableProps) {
  const [parsingCoverLetterId, setParsingCoverLetterId] = useState<string | null>(null);





  const parseText = async (coverLetter: CoverLetter) => {
    setParsingCoverLetterId(coverLetter.id);
    try {
      const textContent = await extractTextFromDocument(coverLetter);

      const updatedCoverLetter = {
        ...coverLetter,
        textContent
      };

      // Save to IndexedDB
      await saveCoverLetter(updatedCoverLetter);

      // Update state
      setState(prev => ({
        ...prev,
        coverLetters: prev.coverLetters.map(c =>
          c.id === coverLetter.id ? updatedCoverLetter : c
        )
      }));

      if (textContent && textContent.trim().length > 0) {
        alert(`Text extracted successfully!\n\n${textContent.length} characters extracted`);
      } else {
        const shouldTryAgain = confirm(`❌ Automatic text extraction failed.\n\nThis can happen with:\n• Complex Word document layouts\n• Password-protected documents\n• Corrupted Word files\n\n🔧 Would you like to try the manual text input method?\n\n(Click OK to manually paste text, or Cancel to skip)`);

        if (shouldTryAgain) {
          // Trigger the manual extraction directly
          const manualText = prompt(`📝 Manual Text Input\n\nPlease:\n1. Open your Word document\n2. Select all text (Cmd+A)\n3. Copy the text (Cmd+C)\n4. Paste it below:`);

          if (manualText && manualText.trim().length > 0) {
            const updatedCoverLetterWithManualText = {
              ...coverLetter,
              textContent: manualText.trim()
            };

            await saveCoverLetter(updatedCoverLetterWithManualText);
            setState(prev => ({
              ...prev,
              coverLetters: prev.coverLetters.map(c =>
                c.id === coverLetter.id ? updatedCoverLetterWithManualText : c
              )
            }));

            alert(`Manual text input successful!\n\n${manualText.trim().length} characters added`);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing text:', error);
      alert('Error extracting text from Word document');
    } finally {
      setParsingCoverLetterId(null);
    }
  };

  const showTextPreview = (coverLetter: CoverLetter) => {
    onShowPreview(coverLetter.textContent || 'No text content available');
  };

  const deleteCoverLetterHandler = async (coverLetterId: string) => {
    if (confirm('Are you sure you want to delete this cover letter?')) {
      try {
        await deleteCoverLetter(coverLetterId);
        setState(prev => ({
          ...prev,
          coverLetters: prev.coverLetters.filter(cl => cl.id !== coverLetterId)
        }));
      } catch (error) {
        console.error('Error deleting cover letter:', error);
        alert('Error deleting cover letter');
      }
    }
  };

  const openCoverLetter = (coverLetter: CoverLetter) => {
    console.log('=== OPENING COVER LETTER ===');
    console.log('Cover letter name:', coverLetter.name);
    console.log('File data length:', coverLetter.fileData.length);
    console.log('File type:', coverLetter.fileType);

    // Word documents cannot be displayed in browser - offer download instead
    alert('Word documents cannot be previewed in the browser. The file will be downloaded for viewing.');

    try {
      // Download Word document
      console.log('Downloading Word document...');
      const base64Data = coverLetter.fileData.split(',')[1];
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
      link.download = coverLetter.fileName;
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

  // Filter cover letters based on search term
  const filteredCoverLetters = coverLetters.filter(coverLetter => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      coverLetter.name.toLowerCase().includes(term) ||
      coverLetter.fileName.toLowerCase().includes(term) ||
      (coverLetter.textContent && coverLetter.textContent.toLowerCase().includes(term)) ||
      (coverLetter.targetCompany && coverLetter.targetCompany.toLowerCase().includes(term)) ||
      (coverLetter.targetPosition && coverLetter.targetPosition.toLowerCase().includes(term))
    );
  });

  return (
    <section className="page-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3>Manage Cover Letters</h3>
        {coverLetters.length > 0 && (
          <input
            type="text"
            placeholder="Search cover letters..."
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

      {coverLetters.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
          <p>No cover letters uploaded yet.</p>
          <p>Click "Select Cover Letters" above to get started.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Target</th>
              <th>AI Detected</th>
              <th>Type</th>
              <th>File Size</th>
              <th>Upload Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCoverLetters.map((coverLetter) => (
              <tr key={coverLetter.id}>
                <td>
                  <strong>{coverLetter.name}</strong>
                  <br />
                  <span style={{ fontSize: "0.8rem", color: "#666" }}>
                    {coverLetter.fileName}
                  </span>
                </td>
                <td>
                  <div style={{ fontSize: "0.8rem" }}>
                    {coverLetter.targetCompany && (
                      <div style={{ fontWeight: "600", color: "#374151" }}>
                        {coverLetter.targetCompany}
                      </div>
                    )}
                    {coverLetter.targetPosition && (
                      <div style={{ color: "#6b7280" }}>
                        {coverLetter.targetPosition}
                      </div>
                    )}
                    {!coverLetter.targetCompany && !coverLetter.targetPosition && (
                      <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                        Not specified
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: "0.75rem" }}>
                    {coverLetter.detectedCompany && (
                      <div style={{ color: "#059669", fontWeight: "500", marginBottom: "2px" }}>
                        🏢 {coverLetter.detectedCompany}
                      </div>
                    )}
                    {coverLetter.detectedRole && (
                      <div style={{ color: "#7c3aed", fontWeight: "500" }}>
                        💼 {coverLetter.detectedRole}
                      </div>
                    )}
                    {!coverLetter.detectedCompany && !coverLetter.detectedRole && (
                      <span style={{ color: "#9ca3af" }}>—</span>
                    )}
                  </div>
                </td>
                <td>
                  <span style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "12px",
                    backgroundColor: "#7c3aed",
                    color: "white",
                    fontWeight: "600",
                    textTransform: "uppercase"
                  }}>
                    COVER LETTER
                  </span>
                </td>
                <td>{formatFileSize(coverLetter.fileSize)}</td>
                <td>{formatDate(coverLetter.uploadDate)}</td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {/* Text Status */}
                    <div>
                      {coverLetter.textContent && coverLetter.textContent.trim().length > 0 ? (
                        <span style={{ color: "#22c55e", fontWeight: "600", fontSize: "0.8rem" }}>
                          Text extracted ✓
                        </span>
                      ) : (
                        <span style={{ color: "#ef4444", fontWeight: "600", fontSize: "0.8rem" }}>
                          No text extracted ✗
                        </span>
                      )}
                      {coverLetter.textContent && (
                        <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "1px" }}>
                          {coverLetter.textContent.length} characters
                        </div>
                      )}
                    </div>


                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => openCoverLetter(coverLetter)}
                    >
                      Download
                    </button>
                    {(!coverLetter.textContent || coverLetter.textContent.trim().length === 0) ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => parseText(coverLetter)}
                        disabled={parsingCoverLetterId === coverLetter.id}
                        style={{
                          fontSize: "0.8rem",
                          padding: "0.4rem 0.6rem",
                          backgroundColor: parsingCoverLetterId === coverLetter.id ? "#f0f0f0" : "#3b82f6",
                          color: parsingCoverLetterId === coverLetter.id ? "#666" : "white",
                          border: "none"
                        }}
                      >
                        {parsingCoverLetterId === coverLetter.id ? 'Parsing...' : 'Parse Text'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => showTextPreview(coverLetter)}
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
                        console.log('=== COVER LETTER INFO ===');
                        console.log('File type:', coverLetter.fileType);
                        console.log('File size:', coverLetter.fileSize);
                        console.log('Has text content:', !!coverLetter.textContent);
                        console.log('Target company:', coverLetter.targetCompany);
                        console.log('Target position:', coverLetter.targetPosition);
                        alert(`Cover Letter Info:\nType: ${coverLetter.fileType}\nSize: ${formatFileSize(coverLetter.fileSize)}\nText extracted: ${coverLetter.textContent ? 'Yes' : 'No'}\nTarget: ${coverLetter.targetCompany || 'Not specified'} - ${coverLetter.targetPosition || 'Not specified'}`);
                      }}
                      style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
                    >
                      Info
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => deleteCoverLetterHandler(coverLetter.id)}
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
  );
}