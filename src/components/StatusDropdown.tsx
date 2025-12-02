import React from 'react';
import { JobDescription } from '../types';

interface StatusDropdownProps {
  job: JobDescription;
  onStatusChange: (jobId: string, status: JobDescription['applicationStatus'], interviewStage?: JobDescription['interviewStage']) => void;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

const StatusDropdown: React.FC<StatusDropdownProps> = ({
  job,
  onStatusChange,
  onClick,
  className = ''
}) => {
  const getDisplayText = (status: string, interviewStage?: string) => {
    if (status === 'interviewing' && interviewStage) {
      switch (interviewStage) {
        case 'screening': return 'Screening';
        case 'first_interview': return '1st Interview';
        case 'followup_interview': return 'Follow-up';
        case 'final_round': return 'Final Round';
        case 'assessment': return 'Assessment';
        default: return 'Interviewing';
      }
    }

    switch (status) {
      case 'not_applied': return 'Not Applied';
      case 'applied': return 'Applied';
      case 'interviewing': return 'Interviewing';
      case 'rejected': return 'Rejected';
      case 'offered': return 'Offered';
      case 'withdrawn': return 'Withdrawn';
      default: return 'Not Applied';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    if (value.startsWith('interviewing_')) {
      const interviewStage = value.replace('interviewing_', '') as JobDescription['interviewStage'];
      onStatusChange(job.id, 'interviewing', interviewStage);
    } else {
      onStatusChange(job.id, value as JobDescription['applicationStatus']);
    }
  };

  const getCurrentValue = () => {
    if (job.applicationStatus === 'interviewing' && job.interviewStage) {
      return `interviewing_${job.interviewStage}`;
    }
    return job.applicationStatus || 'not_applied';
  };

  return (
    <select
      value={getCurrentValue()}
      onChange={handleChange}
      onClick={onClick}
      className={`status-select status-${job.applicationStatus || 'not_applied'} ${className}`}
    >
      <option value="not_applied">Not Applied</option>
      <option value="applied">Applied</option>

      <optgroup label="Interview Stages">
        <option value="interviewing_screening">📞 Screening</option>
        <option value="interviewing_first_interview">👥 1st Interview</option>
        <option value="interviewing_followup_interview">🔄 Follow-up</option>
        <option value="interviewing_final_round">🎯 Final Round</option>
        <option value="interviewing_assessment">📝 Assessment</option>
      </optgroup>

      <option value="rejected">Rejected</option>
      <option value="offered">Offered</option>
      <option value="withdrawn">Withdrawn</option>
    </select>
  );
};

export default StatusDropdown;