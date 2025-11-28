import { Resume } from "../types";
import { formatFileSize, formatDate } from "../utils/documentUtils";

interface StatsSectionProps {
  resumes: Resume[];
}

export default function StatsSection({ resumes }: StatsSectionProps) {
  return (
    <section className="metrics">
      <div className="metric-card">
        <h4>Total Resumes</h4>
        <strong>{resumes.length}</strong>
      </div>
      <div className="metric-card">
        <h4>Total Size</h4>
        <strong>{formatFileSize(resumes.reduce((sum, resume) => sum + resume.fileSize, 0))}</strong>
      </div>
      <div className="metric-card">
        <h4>Latest Upload</h4>
        <strong>
          {resumes.length > 0
            ? formatDate(resumes[0].uploadDate)
            : 'None'
          }
        </strong>
      </div>
    </section>
  );
}