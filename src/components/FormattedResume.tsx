import React from 'react';
import { ParsedResume } from '../utils/resumeFormatter';

interface FormattedResumeProps {
  parsedResume: ParsedResume;
}

const FormattedResume: React.FC<FormattedResumeProps> = ({ parsedResume }) => {
  if (!parsedResume) return null;

  // Try to extract a job title from the summary or first section
  let jobTitle = '';
  const summarySection = parsedResume.sections.find(s => s.type === 'summary');
  if (summarySection && summarySection.content) {
    // Look for a job title pattern in the first line
    const firstLine = summarySection.content.split('\n')[0];
    // Heuristic: If the first line contains 'engineer', 'developer', etc., use it
    if (/engineer|developer|architect|lead|manager|designer|director|programmer|analyst|specialist|consultant|founder|cto|ceo|cpo|product|ux|ui|data|ai|ml|cloud|devops|qa|test/i.test(firstLine)) {
      jobTitle = firstLine.split(/[•·\-–|,]/)[0].trim();
    }
  }
  // Fallback: use a default or leave blank
  if (!jobTitle) jobTitle = 'Professional Title';

  return (
    <div className="formatted-resume">
      {/* Header */}
      <div className="resume-header">
        <div className="resume-job-title" style={{ fontWeight: 700, fontSize: 28, marginBottom: 4 }}>{jobTitle}</div>
        <div className="resume-name" style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>{parsedResume.header.name}</div>
        {(parsedResume.header.location || parsedResume.header.phone || parsedResume.header.email || parsedResume.header.linkedin) && (
          <div className="resume-contact" style={{ fontWeight: 400, fontSize: 16 }}>
            {[
              parsedResume.header.location,
              parsedResume.header.phone,
              parsedResume.header.email,
              parsedResume.header.linkedin
            ].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* Sections */}
      {parsedResume.sections.map((section, idx) => (
        <div className="resume-section" key={idx}>
          <div className="section-title">{section.title}</div>
          {/* Skills Section: Bulleted, bold categories if present */}
          {section.type === 'skills' && section.items ? (
            <ul className="skills-list" style={{ margin: 0, paddingLeft: 24 }}>
              {section.items.map((skill, i) => (
                <li className="skill-item" key={i} style={{ fontWeight: 500 }}>{skill.title}</li>
              ))}
            </ul>
          ) : section.type === 'experience' && section.items && section.items.length > 0 ? (
            section.items.map((item, i) => (
              <div className="experience-item" key={i} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 2 }}>
                  <span className="job-title" style={{ fontWeight: 700, fontSize: 16 }}>{item.title}</span>
                  {(item.subtitle || item.dateRange) && (
                    <span style={{ fontStyle: 'italic', color: '#555', fontSize: 14 }}>
                      {item.subtitle}
                      {item.subtitle && item.dateRange ? ' · ' : ''}
                      {item.dateRange}
                    </span>
                  )}
                </div>
                {item.description && item.description.length > 0 && (
                  <ul className="description" style={{ margin: 0, paddingLeft: 24 }}>
                    {item.description.map((desc, j) => (
                      <li key={j}>{desc}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          ) : section.type === 'education' && section.items && section.items.length > 0 ? (
            section.items.map((item, i) => (
              <div className="education-item" key={i} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 2 }}>
                  <span className="degree-title" style={{ fontWeight: 700, fontSize: 16 }}>{item.title}</span>
                  {(item.subtitle || item.dateRange) && (
                    <span style={{ fontStyle: 'italic', color: '#555', fontSize: 14 }}>
                      {item.subtitle}
                      {item.subtitle && item.dateRange ? ' · ' : ''}
                      {item.dateRange}
                    </span>
                  )}
                </div>
                {item.description && item.description.length > 0 && (
                  <ul className="description" style={{ margin: 0, paddingLeft: 24 }}>
                    {item.description.map((desc, j) => (
                      <li key={j}>{desc}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          ) : (
            <div className="section-content">{section.content.split('\n').map((line, i) => <div key={i}>{line}</div>)}</div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FormattedResume;
