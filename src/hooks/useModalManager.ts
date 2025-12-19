import { useState } from 'react';

// Hook for managing modal states
export const useModalManager = () => {
  // Modal state
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);
  const [scraperModalOpen, setScraperModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);

  // Modal data
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedDefaultName, setGeneratedDefaultName] = useState('');
  const [duplicateJobId, setDuplicateJobId] = useState<string | null>(null);
  const [duplicateSearchQuery, setDuplicateSearchQuery] = useState('');

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  return {
    // Modal visibility states
    showGeneratedModal,
    setShowGeneratedModal,
    showCSVImportModal,
    setShowCSVImportModal,
    scraperModalOpen,
    setScraperModalOpen,
    editModalOpen,
    setEditModalOpen,
    showDuplicateModal,
    setShowDuplicateModal,
    showReminderSettings,
    setShowReminderSettings,

    // Modal data
    generatedTitle,
    setGeneratedTitle,
    generatedContent,
    setGeneratedContent,
    generatedDefaultName,
    setGeneratedDefaultName,
    duplicateJobId,
    setDuplicateJobId,
    duplicateSearchQuery,
    setDuplicateSearchQuery,

    // Loading states
    isGenerating,
    setIsGenerating,
    generationError,
    setGenerationError,
  };
};