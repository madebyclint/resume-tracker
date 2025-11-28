import { useState } from "react";
import { useAppState } from "../state/AppStateContext";
import FileUploadSection from "../components/FileUploadSection";
import StatsSection from "../components/StatsSection";
import ResumeTable from "../components/ResumeTable";
import CoverLetterTable from "../components/CoverLetterTable";
import TextPreviewModal from "../components/TextPreviewModal";

export default function DashboardPage() {
  const { state, setState, isLoading, syncWithStorage } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [coverLetterSearchTerm, setCoverLetterSearchTerm] = useState('');
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleShowPreview = (text: string) => {
    setPreviewText(text);
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewText(null);
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <FileUploadSection
        state={state}
        setState={setState}
        syncWithStorage={syncWithStorage}
      />

      <StatsSection
        resumes={state.resumes}
        coverLetters={state.coverLetters}
      />

      <ResumeTable
        resumes={state.resumes}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        setState={setState}
        onShowPreview={handleShowPreview}
      />

      <CoverLetterTable
        coverLetters={state.coverLetters}
        searchTerm={coverLetterSearchTerm}
        setSearchTerm={setCoverLetterSearchTerm}
        setState={setState}
        onShowPreview={handleShowPreview}
      />

      <TextPreviewModal
        showPreview={showPreview}
        previewText={previewText}
        onClose={handleClosePreview}
      />
    </div>
  );
}
