import React from 'react';
import { JobDescription } from '../types';
import GeneratedContentModal from './GeneratedContentModal';
import CSVImportModal from './CSVImportModal';
import { JobScraperModal } from './JobScraperModal';
import { JobEditModal } from './JobEditModal';
import DuplicateJobModal from './DuplicateJobModal';
import ReminderSettingsModal from './ReminderSettingsModal';

interface ModalManagerProps {
  // Generated Content Modal
  showGeneratedModal: boolean;
  generatedTitle: string;
  generatedContent: string;
  isGenerating: boolean;
  generationError: string | null;
  generatedDefaultName: string;
  onCloseGeneratedModal: () => void;
  onSaveGenerated: (name: string, content: string) => void;

  // CSV Import Modal
  showCSVImportModal: boolean;
  onCloseCSVImportModal: () => void;
  onCSVImport: (jobs: JobDescription[]) => void;
  existingJobs: JobDescription[];

  // Job Scraper Modal
  scraperModalOpen: boolean;
  onCloseScraperModal: () => void;
  onJobCreated: (job: JobDescription) => void;

  // Job Edit Modal
  jobBeingEdited: JobDescription | null;
  editModalOpen: boolean;
  onCloseEditModal: () => void;
  onSaveEditedJob: (job: JobDescription) => void;

  // Duplicate Job Modal
  showDuplicateModal: boolean;
  duplicateJobId: string | null;
  duplicateSearchQuery: string;
  onCloseDuplicateModal: () => void;
  onDuplicateSearchChange: (query: string) => void;
  onConfirmDuplicate: (originalJobId: string) => void;

  // Reminder Settings Modal
  showReminderSettings: boolean;
  onCloseReminderSettings: () => void;
  onJobUpdate: (job: JobDescription) => void;
  jobs: JobDescription[];
}

const ModalManager: React.FC<ModalManagerProps> = ({
  showGeneratedModal,
  generatedTitle,
  generatedContent,
  isGenerating,
  generationError,
  generatedDefaultName,
  onCloseGeneratedModal,
  onSaveGenerated,

  showCSVImportModal,
  onCloseCSVImportModal,
  onCSVImport,
  existingJobs,

  scraperModalOpen,
  onCloseScraperModal,
  onJobCreated,

  jobBeingEdited,
  editModalOpen,
  onCloseEditModal,
  onSaveEditedJob,

  showDuplicateModal,
  duplicateJobId,
  duplicateSearchQuery,
  onCloseDuplicateModal,
  onDuplicateSearchChange,
  onConfirmDuplicate,

  showReminderSettings,
  onCloseReminderSettings,
  onJobUpdate,
  jobs
}) => {
  return (
    <>
      <GeneratedContentModal
        isOpen={showGeneratedModal}
        onClose={onCloseGeneratedModal}
        onSave={onSaveGenerated}
        title={generatedTitle}
        content={generatedContent}
        isLoading={isGenerating}
        error={generationError || undefined}
        defaultName={generatedDefaultName}
      />

      <CSVImportModal
        isOpen={showCSVImportModal}
        onClose={onCloseCSVImportModal}
        onImport={onCSVImport}
        existingJobs={existingJobs}
      />

      {scraperModalOpen && (
        <JobScraperModal
          isOpen={scraperModalOpen}
          onClose={onCloseScraperModal}
          onJobCreated={onJobCreated}
        />
      )}

      {jobBeingEdited && (
        <JobEditModal
          job={jobBeingEdited}
          isOpen={editModalOpen}
          onClose={onCloseEditModal}
          onSave={onSaveEditedJob}
        />
      )}

      <DuplicateJobModal
        isOpen={showDuplicateModal}
        duplicateJobId={duplicateJobId}
        searchQuery={duplicateSearchQuery}
        jobs={jobs}
        onClose={onCloseDuplicateModal}
        onSearchChange={onDuplicateSearchChange}
        onConfirmDuplicate={onConfirmDuplicate}
      />

      <ReminderSettingsModal
        isOpen={showReminderSettings}
        jobs={jobs}
        onClose={onCloseReminderSettings}
        onJobUpdate={onJobUpdate}
      />
    </>
  );
};

export default ModalManager;