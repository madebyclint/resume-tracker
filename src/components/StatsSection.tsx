import { Resume, CoverLetter } from "../types";
import { formatFileSize, formatDate } from "../utils/documentUtils";

interface StatsSectionProps {
  resumes: Resume[];
  coverLetters: CoverLetter[];
}

export default function StatsSection({ resumes, coverLetters }: StatsSectionProps) {
  const totalDocuments = resumes.length + coverLetters.length;
  const totalSize = resumes.reduce((sum, resume) => sum + resume.fileSize, 0) +
    coverLetters.reduce((sum, cl) => sum + cl.fileSize, 0);

  // Get the most recent upload date from both types
  const allDates = [
    ...resumes.map(r => r.uploadDate),
    ...coverLetters.map(cl => cl.uploadDate)
  ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <section className="metrics">
      <div className="metric-card">
        <h4>Total Documents</h4>
        <strong>{totalDocuments}</strong>
        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
          {resumes.length} resumes, {coverLetters.length} cover letters
        </div>
      </div>
      <div className="metric-card">
        <h4>Total Size</h4>
        <strong>{formatFileSize(totalSize)}</strong>
      </div>
      <div className="metric-card">
        <h4>Latest Upload</h4>
        <strong>
          {allDates.length > 0
            ? formatDate(allDates[0])
            : 'None'
          }
        </strong>
      </div>
    </section>
  );
}